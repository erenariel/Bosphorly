import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../backend/worker.js';
import {
  GUEST_DAILY_LIMIT,
  GOLD_DAILY_LIMIT,
  IP_DAILY_LIMIT,
  PER_MIN_LIMIT,
  PLATINUM_DAILY_LIMIT,
  SILVER_DAILY_LIMIT,
  chatDailyLimitForTier,
  checkAndIncrementLimits,
  createChatSessionToken,
  runAssistant,
} from '../backend/assistant.js';
import { computeTelegramWebhookSecret, handleTelegramWebhook } from '../backend/telegram.js';
import {
  MIMO_YEAR_MS,
  acceptGapTitle,
  applySummary,
  buildWeeklyReportText,
  classifyTopic,
  computeMemberTier,
  containsSensitive,
  forgetNote,
  isoWeekKey,
  observeAssistantTurn,
  previousIsoWeekKey,
  recordVoteMetric,
  resolveMemberAuth,
  sanitizeNote,
  sendWeeklyMimoReport,
  setConsent,
} from '../backend/mimo.js';

const ORIGIN = 'https://example.com';
const LANGS = ['ar', 'az', 'bn', 'bs', 'de', 'en', 'es', 'fa', 'fr', 'he', 'hi', 'hr', 'hu', 'id', 'it', 'ja', 'ko', 'nl', 'pt', 'ru', 'tr', 'uk', 'zh'];

function d1() {
  const db = new DatabaseSync(':memory:');
  for (const file of ['0001.sql', '0002_members.sql', '0003_member_preferences_newsletter.sql', '0004_member_sync_requests_details.sql', '0005_identities_passkeys.sql', '0006_oauth_pending.sql', '0007_assistant.sql', '0008_assistant_blocks.sql', '0009_tts_usage.sql', '0010_mimo.sql']) {
    db.exec(readFileSync(new URL('../backend/migrations/' + file, import.meta.url), 'utf8'));
  }
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...args).changes) } }),
    _run: () => db.prepare(sql).run(...args),
  });
  return {
    raw: db,
    prepare: (sql) => stmt(sql),
    batch: async (list) => {
      db.exec('BEGIN');
      try { const r = list.map((s) => s._run()); db.exec('COMMIT'); return r; }
      catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}

function setup() {
  const DB = d1();
  DB.raw.exec(`INSERT INTO hotels VALUES ('hotel-a','verified','EUR',1000,'contract');
               INSERT INTO campaigns (id, kind, percent_bps, valid_days, hotel_id) VALUES ('hotel-a-2026','hotel',500,60,'hotel-a');`);
  return {
    DB,
    PUBLIC_ORIGIN: ORIGIN,
    RATE_LIMITER: { limit: async () => ({ success: true }) },
    CODE_PEPPER: 'test-pepper',
    DEV_RETURN_CODE: '1',
  };
}

const call = async (env, path, body, token, method = 'POST') => {
  const headers = { Origin: ORIGIN, ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) };
  const r = await worker.fetch(new Request('https://api.example' + path, { method, headers, body: body ? JSON.stringify(body) : undefined }), env);
  return { status: r.status, body: await r.json() };
};

async function signUp(env, email = 'ada@example.com') {
  const s = await call(env, '/v1/auth/start', { email, lang: 'tr' });
  assert.equal(s.status, 200);
  const v = await call(env, '/v1/auth/verify', { email, code: s.body.devCode, name: 'Ada Yılmaz' });
  assert.equal(v.status, 200, JSON.stringify(v.body));
  return v.body.token;
}

const goodNote = {
  tone: 'samimi', emoji: 'orta', length: 'kısa', lang: 'tr',
  interests: ['yemek', 'cami'],
  lastTopics: ['Boğaz akşam turu'],
};

test('topic tags and sensitive-data filter keep tours, drop personal data', () => {
  assert.equal(classifyTopic('IST havalimanı transfer'), 'transfer');
  assert.equal(classifyTopic('Boğaz akşam turu'), 'bogaz');
  assert.equal(classifyTopic('Tarihi hamam'), 'hamam');
  assert.equal(classifyTopic('Ayasofya turu'), 'sehir');
  assert.equal(classifyTopic('İstanbul’da kahvaltı'), 'genel');
  assert.equal(classifyTopic('asdf qwer'), 'diger');
  for (const bad of ['05551234567', 'ada@example.com', 'pasaport', 'hastane randevusu', 'müslüman', 'din dersi', 'eşcinsel', 'İstiklal Caddesi', '4532123456789012']) {
    assert.equal(containsSensitive(bad), true, bad);
  }
  assert.equal(containsSensitive('Sultanahmet cami ve Boğaz'), false);
  assert.equal(containsSensitive('İstanbul'), false);
  assert.equal(containsSensitive('مدينة'), false);
  for (const bad of [
    'דרכון', 'טלפון', 'כתובת', 'בריאות', 'דת',
    'паспорт', 'телефон', 'адрес', 'здоровье', 'религия',
    'جواز سفر', 'هاتف', 'عنوان', 'صحة', 'دين',
    'Reisepass', 'Handy', 'Adresse', 'Krankenhaus', 'schwanger', 'Religion',
  ]) {
    assert.equal(containsSensitive(bad), true, bad);
  }
  const clean = sanitizeNote({
    tone: 'samimi', emoji: 'çok', length: 'detaylı', lang: 'tr',
    interests: ['yemek', '05551234567', 'ada@example.com', 'pasaport', 'hastane', 'müslüman', 'din dersi', 'cami', 7],
    lastTopics: ['Boğaz akşam turu'],
  });
  assert.equal(clean, null);
  const kept = sanitizeNote({
    ...goodNote,
    interests: ['yemek', '05551234567', 'ada@example.com', 'pasaport', 'hastane randevusu', 'müslüman', 'din dersi', 'cami'],
    lastTopics: ['Boğaz akşam turu', 'pasaport yenileme'],
    transcript: 'GIZLI 05551234567',
  });
  assert.deepEqual(kept.interests, ['yemek', 'cami']);
  assert.deepEqual(kept.lastTopics, ['Boğaz akşam turu']);
  assert.equal(JSON.stringify(kept).includes('0555'), false);
  assert.equal(JSON.stringify(kept).includes('pasaport'), false);
  assert.equal(acceptGapTitle('Kapadokya turu'), 'Kapadokya turu');
  assert.equal(acceptGapTitle('çocuk koltuğu'), 'çocuk koltuğu');
  assert.equal(acceptGapTitle('05551234567 transfer'), null);
  assert.equal(acceptGapTitle('Kapadokya'), null);
});

test('no note is written without consent, schema mismatches are dropped, forget clears it, delete removes it', async () => {
  const env = setup();
  const token = await signUp(env);
  let aiCalls = 0;
  env.AI = { run: async () => { aiCalls += 1; return { response: JSON.stringify(goodNote) }; } };

  const before = await call(env, '/v1/me/mimo', null, token, 'GET');
  assert.deepEqual(before.body, { consent: false, asked: false, note: null });
  const skipped = await call(env, '/v1/me/mimo/summary', { history: [{ role: 'user', content: 'Boğaz turu' }], lang: 'tr' }, token);
  assert.equal(skipped.body.saved, false);
  assert.equal(skipped.body.reason, 'no_consent');
  assert.equal(aiCalls, 0);
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM mimo_profile').get().n, 0);

  const refused = await call(env, '/v1/me/mimo', { note: goodNote }, token);
  assert.equal(refused.status, 403);
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM mimo_profile').get().n, 0);

  const asked = await call(env, '/v1/me/mimo', { consent: false }, token);
  assert.equal(asked.body.consent, false);
  assert.equal(asked.body.asked, true);
  assert.equal(asked.body.note, null);

  await call(env, '/v1/me/mimo', { consent: true }, token);
  const saved = await call(env, '/v1/me/mimo', { note: {
    ...goodNote,
    interests: ['yemek', '05551234567', 'ada@example.com', 'pasaport', 'hastane randevusu', 'müslüman', 'cami'],
    lastTopics: ['Boğaz akşam turu', 'pasaport yenileme'],
  } }, token);
  assert.equal(saved.status, 200);
  assert.deepEqual(saved.body.note.interests, ['yemek', 'cami']);
  assert.deepEqual(saved.body.note.lastTopics, ['Boğaz akşam turu']);
  const raw = env.DB.raw.prepare('SELECT note_json FROM mimo_profile').get().note_json;
  for (const banned of ['05551234567', 'ada@example.com', 'pasaport', 'hastane', 'müslüman']) {
    assert.equal(raw.includes(banned), false, banned);
  }

  env.AI = { run: async () => { aiCalls += 1; return { response: '{"tone":"nope","emoji":"orta","length":"kısa","lang":"tr","interests":[],"lastTopics":[]}' }; } };
  const rejected = await call(env, '/v1/me/mimo/summary', { history: [{ role: 'user', content: 'Boğaz turu ve 05551234567' }], lang: 'tr' }, token);
  assert.equal(rejected.body.saved, false);
  assert.equal(rejected.body.reason, 'schema');
  assert.equal(env.DB.raw.prepare('SELECT note_json FROM mimo_profile').get().note_json, raw);

  env.AI = { run: async () => ({ response: JSON.stringify({
    tone: 'resmî', emoji: 'az', length: 'detaylı', lang: 'tr',
    interests: ['tarih', '05559876543'],
    lastTopics: ['IST transfer'],
    transcript: 'ham konuşma 05559876543',
  }) }) };
  const merged = await call(env, '/v1/me/mimo/summary', { history: [{ role: 'user', content: 'tarih ve transfer' }], lang: 'tr' }, token);
  assert.equal(merged.body.saved, true);
  assert.equal(merged.body.note.tone, 'resmî');
  assert.ok(merged.body.note.interests.includes('tarih'));
  assert.ok(merged.body.note.interests.includes('yemek'));
  assert.equal(JSON.stringify(merged.body.note).includes('0555'), false);
  assert.equal(JSON.stringify(merged.body.note).includes('ham konuşma'), false);

  const forgotten = await call(env, '/v1/me/mimo', { forget: true }, token);
  assert.equal(forgotten.body.consent, true);
  assert.equal(forgotten.body.note, null);
  assert.equal(env.DB.raw.prepare('SELECT note_json FROM mimo_profile').get().note_json, '');

  const removed = await call(env, '/v1/me/delete', {}, token);
  assert.equal(removed.status, 200);
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM mimo_profile').get().n, 0);
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM members').get().n, 0);
});

test('a note unused for 12 months is deleted', async () => {
  const env = setup();
  const token = await signUp(env);
  await call(env, '/v1/me/mimo', { consent: true }, token);
  await call(env, '/v1/me/mimo', { note: goodNote }, token);
  env.DB.raw.prepare('UPDATE mimo_profile SET updated_at=?').run(Date.now() - MIMO_YEAR_MS - 1000);
  const stale = await call(env, '/v1/me/mimo', null, token, 'GET');
  assert.equal(stale.body.asked, false);
  assert.equal(stale.body.note, null);
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM mimo_profile').get().n, 0);
});

test('member note is added to the system prompt only when one exists', async () => {
  let prompt = '';
  const env = { AI: { run: async (_model, opts) => { prompt = opts.messages[0].content; return { response: JSON.stringify({ abuse: false, handoff: false, reply: 'Akşam Boğaz turu sakin olur. Tarihin ne?' }) }; } } };
  const withNote = await runAssistant({
    message: 'Bu akşam ne yapalım?',
    pageLang: 'tr',
    memberNote: goodNote,
    env,
    actorKey: 'mimo-note',
  });
  assert.equal(withNote.ok, true);
  assert.match(prompt, /MEMBER NOTE/);
  assert.match(prompt, /Boğaz akşam turu/);
  assert.match(prompt, /Geçen sefer Boğaz turuna bakmıştın/);
  prompt = '';
  await runAssistant({ message: 'Bu akşam ne yapalım?', pageLang: 'tr', env, actorKey: 'mimo-plain' });
  assert.equal(prompt.includes('MEMBER NOTE'), false);
});

test('telegram uses the familiarity note only for a linked member', async () => {
  const prev = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('api.telegram.org')) return Response.json({ ok: true });
    return prev(url);
  };
  try {
    const now = Date.UTC(2026, 10, 22, 12);
    const secret = await computeTelegramWebhookSecret('test-pepper');
    const env = setup();
    env.TELEGRAM_BOT_TOKEN = 'bot';
    const prompts = [];
    env.AI = { run: async (_model, opts) => {
      prompts.push(opts.messages[0].content);
      if (String(opts.messages[0].content).startsWith('Extract ONLY')) {
        return { response: JSON.stringify({ ...goodNote, interests: ['yemek', '05551234567'], lastTopics: ['Boğaz akşam turu'] }) };
      }
      return { response: JSON.stringify({ abuse: false, handoff: false, reply: 'Akşam turu için tarihini yazar mısın?' }) };
    } };
    env.DB.raw.exec(`INSERT INTO members (id, email, lang, referral_code) VALUES ('mem1','ada@example.com','tr','ABCD2345')`);
    env.DB.raw.exec(`INSERT INTO member_identities (provider, subject, member_id) VALUES ('telegram','555','mem1')`);
    await setConsent(env, 'mem1', true, now - 20 * 60 * 1000);
    env.DB.raw.prepare('INSERT INTO telegram_handoff_state (chat_id, pending_handoff, lang, context_json, updated_at) VALUES (?,?,?,?,?)')
      .run('777', 0, 'tr', JSON.stringify([{ role: 'user', content: 'Boğaz turu ve telefon 05551234567' }]), now - 11 * 60 * 1000);
    const linked = await handleTelegramWebhook(new Request('https://api.example/v1/telegram/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': secret },
      body: JSON.stringify({ message: { chat: { id: 777, type: 'private' }, from: { id: 555, language_code: 'tr' }, text: 'Boğaz turu fiyatı nedir?' } }),
    }), env, now);
    assert.equal(linked.status, 200);
    const note = env.DB.raw.prepare('SELECT note_json FROM mimo_profile WHERE member_id=?').get('mem1').note_json;
    assert.match(note, /Boğaz akşam turu/);
    assert.equal(note.includes('05551234567'), false);
    assert.equal(prompts.some((p) => p.includes('MEMBER NOTE') && p.includes('Boğaz akşam turu')), true);

    const env2 = setup();
    env2.TELEGRAM_BOT_TOKEN = 'bot';
    const prompts2 = [];
    env2.AI = { run: async (_model, opts) => {
      prompts2.push(opts.messages[0].content);
      return { response: JSON.stringify({ abuse: false, handoff: false, reply: 'Nasıl yardımcı olayım?' }) };
    } };
    const unlinked = await handleTelegramWebhook(new Request('https://api.example/v1/telegram/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': secret },
      body: JSON.stringify({ message: { chat: { id: 888, type: 'private' }, from: { id: 999, language_code: 'tr' }, text: 'Boğaz turu fiyatı nedir?' } }),
    }), env2, now);
    assert.equal(unlinked.status, 200);
    assert.equal(env2.DB.raw.prepare('SELECT COUNT(*) AS n FROM mimo_profile').get().n, 0);
    assert.equal(prompts2.some((p) => p.includes('MEMBER NOTE')), false);
  } finally {
    globalThis.fetch = prev;
  }
});

test('weekly report counts topics and never includes message text', async () => {
  const env = setup();
  const monday = Date.UTC(2026, 10, 23, 6, 0, 0);
  const during = monday - 3 * 86400000;
  assert.equal(previousIsoWeekKey(monday), isoWeekKey(during));
  const secret = 'GIZLI CUMLE 05551234567 pasaport';
  let gapCalls = 0;
  env.AI = { run: async () => { gapCalls += 1; return { response: 'Kapadokya turu' }; } };
  await observeAssistantTurn(env, { message: secret, result: { lang: 'tr', fallback: true, abuse: false }, now: during });
  assert.equal(gapCalls, 0);
  await observeAssistantTurn(env, { message: 'Kapadokya turu var mı', result: { lang: 'tr', fallback: true }, now: during });
  assert.equal(gapCalls, 1);
  await observeAssistantTurn(env, { message: 'çok kabasın', result: { lang: 'tr', closed: true, abuse: true }, now: during });
  await recordVoteMetric(env, 'up', 'tr', during);
  await recordVoteMetric(env, 'down', 'en', during);
  const text = await buildWeeklyReportText(env, monday);
  assert.match(text, /Kapadokya turu/);
  assert.match(text, /Bu konular siteye eklenirse Mimo cevaplayabilir/);
  assert.match(text, /Zorbalık nedeniyle kapatılan sohbet: 1/);
  assert.match(text, /tools\/build_knowledge\.py/);
  assert.equal(text.includes(secret), false);
  assert.equal(text.includes('05551234567'), false);
  assert.equal(text.includes('pasaport'), false);
  assert.equal(text.includes('çok kabasın'), false);
  const stored = JSON.stringify(env.DB.raw.prepare('SELECT metric, bucket, count FROM assistant_metrics').all())
    + JSON.stringify(env.DB.raw.prepare('SELECT topic, bucket, count FROM assistant_gap_topics').all());
  assert.equal(stored.includes(secret), false);
  assert.equal(stored.includes('05551234567'), false);

  const prev = globalThis.fetch;
  const sent = [];
  globalThis.fetch = async (_url, init) => { sent.push(JSON.parse(init.body)); return Response.json({ id: 'm1' }); };
  try {
    env.RESEND_API_KEY = 'rk';
    env.MAIL_FROM = 'Bosphorly <no-reply@notify.bosphorly.com>';
    const mailed = await sendWeeklyMimoReport(env, monday);
    assert.equal(mailed.ok, true);
    assert.deepEqual(sent[0].to, ['info@bosphorly.com']);
    assert.equal(sent[0].text.includes(secret), false);
    assert.match(sent[0].text, /Bu konular siteye eklenirse Mimo cevaplayabilir/);
  } finally {
    globalThis.fetch = prev;
  }
});

test('consent copy, privacy and cron stay in place for all 23 languages', () => {
  const chat = readFileSync(new URL('../assistant-chat.js', import.meta.url), 'utf8');
  const ui = new Function(`return ${chat.match(/const UI = (\{[\s\S]*?\n  \});/)[1]}`)();
  for (const key of ['remember', 'rememberNo']) {
    for (const lang of LANGS) assert.ok(ui[key][lang] && ui[key][lang].trim(), key + '.' + lang);
  }
  assert.equal(ui.remember.tr, 'Mimo konuşma tarzımı ve ilgi alanlarımı hatırlasın 💙');
  assert.match(chat, /<input class="bc-remember-input" type="checkbox">/);
  const dismiss = chat.slice(chat.indexOf('function dismissRemember'), chat.indexOf('function closePanel'));
  assert.equal(dismiss.includes('submitMessage'), false);
  assert.equal(chat.includes('bc-remember'), true);
  assert.ok(chat.indexOf('bc-remember') < chat.indexOf('<form class="bc-form">'));

  const copy = JSON.parse(readFileSync(new URL('../data/mimo-ui.json', import.meta.url), 'utf8'));
  for (const key of Object.keys(copy)) {
    for (const lang of LANGS) assert.ok(copy[key][lang] && copy[key][lang].trim(), key + '.' + lang);
  }
  assert.equal(copy.consent.tr, ui.remember.tr);
  assert.equal(copy.forget.tr, 'Hepsini unut');
  assert.equal(copy.title.tr, 'Mimo seni nasıl tanıyor?');
  const account = readFileSync(new URL('../account-member.js', import.meta.url), 'utf8');
  assert.match(account, /forget: true/);
  assert.match(account, /data\/mimo-ui\.json/);

  const privacy = readFileSync(new URL('../privacy.html', import.meta.url), 'utf8');
  assert.match(privacy, /12 ay/);
  assert.match(privacy, /12 months/);
  assert.match(privacy, /Hepsini unut/);
  assert.match(privacy, /Forget everything/);
  assert.match(privacy, /Ham sohbet metni saklanmaz/);
  assert.match(privacy, /Raw chat is not stored/);
  assert.match(privacy, /Mimo tanışıklık notunuzu/);

  const sql = readFileSync(new URL('../backend/migrations/0010_mimo.sql', import.meta.url), 'utf8');
  assert.match(sql, /mimo_profile/);
  assert.match(sql, /assistant_metrics/);
  assert.match(sql, /assistant_gap_topics/);
  const ddl = sql.replace(/--[^\n]*/g, '');
  assert.doesNotMatch(ddl, /\bmessage\b/i);
  assert.doesNotMatch(ddl, /\bcontent\b/i);
  assert.match(readFileSync(new URL('../backend/wrangler.jsonc', import.meta.url), 'utf8'), /0 6 \* \* 1/);
  assert.match(readFileSync(new URL('../tools/build_knowledge.py', import.meta.url), 'utf8'), /does not edit this file/);
  const css = readFileSync(new URL('../assistant-chat.css', import.meta.url), 'utf8');
  assert.match(css, /min-height:44px/);
  assert.match(css, /\.bc-remember\[hidden\]\{display:none\}/);
});

test('summary endpoint allows 6 calls per member each hour and returns 429 on the 7th', async () => {
  const env = setup();
  const token = await signUp(env);
  await call(env, '/v1/me/mimo', { consent: true }, token);
  let calls = 0;
  env.AI = { run: async () => { calls += 1; return { response: JSON.stringify(goodNote) }; } };
  const body = { history: [{ role: 'user', content: 'Boğaz turu' }], lang: 'tr' };
  for (let i = 0; i < 6; i++) {
    const ok = await call(env, '/v1/me/mimo/summary', body, token);
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.saved, true);
  }
  const blocked = await call(env, '/v1/me/mimo/summary', body, token);
  assert.equal(blocked.status, 429);
  assert.equal(calls, 6);

  const t0 = Date.UTC(2026, 10, 22, 12, 1, 0);
  const key = 'mimo-summary:hour-window';
  for (let i = 0; i < 6; i++) {
    const ok = await checkAndIncrementLimits({ env: {}, actorKey: key, now: t0 + i * 9 * 60 * 1000, perHour: 6, skipGlobal: true });
    assert.equal(ok.allowed, true);
  }
  const seventh = await checkAndIncrementLimits({ env: {}, actorKey: key, now: t0 + 54 * 60 * 1000, perHour: 6, skipGlobal: true });
  assert.equal(seventh.allowed, false);
  const nextHour = await checkAndIncrementLimits({ env: {}, actorKey: key, now: t0 + 61 * 60 * 1000, perHour: 6, skipGlobal: true });
  assert.equal(nextHour.allowed, true);
});

test('observeAssistantTurn and idle summary do not block the reply when ctx.waitUntil is present', async () => {
  const env = setup();
  env.TURNSTILE_SECRET = 'turnstile';
  const ip = '203.0.113.44';
  const chatSession = await createChatSessionToken(env.CODE_PEPPER, ip);
  let releaseGap;
  const gapGate = new Promise((resolve) => { releaseGap = resolve; });
  let aiCalls = 0;
  env.AI = {
    run: async () => {
      aiCalls += 1;
      if (aiCalls === 1) throw new Error('chat down');
      await gapGate;
      return { response: 'Kapadokya turu' };
    },
  };
  const waits = [];
  const ctx = { waitUntil(p) { waits.push(p); } };
  const started = Date.now();
  const res = await worker.fetch(new Request('https://api.example/v1/assistant', {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify({ message: 'Kapadokya turu var mı', lang: 'tr', chatSession }),
  }), env, ctx);
  assert.equal(res.status, 200);
  assert.ok(Date.now() - started < 1000);
  assert.equal(waits.length, 1);
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM assistant_gap_topics').get().n, 0);
  releaseGap();
  await waits[0];
  assert.equal(env.DB.raw.prepare("SELECT topic FROM assistant_gap_topics").get().topic, 'Kapadokya turu');

  const now = Date.UTC(2026, 10, 22, 15);
  const secret = await computeTelegramWebhookSecret('test-pepper');
  env.TELEGRAM_BOT_TOKEN = 'bot';
  env.DB.raw.exec(`INSERT INTO members (id, email, lang, referral_code) VALUES ('mem9','m9@example.com','tr','MEM9AAAA')`);
  env.DB.raw.exec(`INSERT INTO member_identities (provider, subject, member_id) VALUES ('telegram','919','mem9')`);
  await setConsent(env, 'mem9', true, now - 20 * 60 * 1000);
  env.DB.raw.prepare('INSERT INTO telegram_handoff_state (chat_id, pending_handoff, lang, context_json, updated_at) VALUES (?,?,?,?,?)')
    .run('919', 0, 'tr', JSON.stringify([{ role: 'user', content: 'Boğaz turu' }]), now - 11 * 60 * 1000);
  let releaseSummary;
  const summaryGate = new Promise((resolve) => { releaseSummary = resolve; });
  env.AI = {
    run: async (_model, opts) => {
      if (String(opts.messages[0].content).startsWith('Extract ONLY')) {
        await summaryGate;
        return { response: JSON.stringify(goodNote) };
      }
      return { response: JSON.stringify({ abuse: false, handoff: false, reply: 'Tarihini yazar mısın?' }) };
    },
  };
  const prev = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ ok: true });
  const tgWaits = [];
  const tgCtx = { waitUntil(p) { tgWaits.push(p); } };
  try {
    const tg = await handleTelegramWebhook(new Request('https://api.example/v1/telegram/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': secret },
      body: JSON.stringify({ message: { chat: { id: 919, type: 'private' }, from: { id: 919, language_code: 'tr' }, text: 'Boğaz turu fiyatı nedir?' } }),
    }), env, now, tgCtx);
    assert.equal(tg.status, 200);
    const pending = env.DB.raw.prepare('SELECT note_json FROM mimo_profile WHERE member_id=?').get('mem9');
    assert.equal(!pending || !String(pending.note_json || '').includes('Boğaz akşam turu'), true);
    assert.ok(tgWaits.length >= 1);
    releaseSummary();
    await Promise.all(tgWaits);
    assert.match(env.DB.raw.prepare('SELECT note_json FROM mimo_profile WHERE member_id=?').get('mem9').note_json, /Boğaz akşam turu/);
  } finally {
    globalThis.fetch = prev;
    releaseSummary();
  }
});

test('applySummary does not call the model when consent is off', async () => {
  const env = setup();
  env.DB.raw.exec(`INSERT INTO members (id, email, lang, referral_code) VALUES ('mem2','ada2@example.com','tr','ZZZZ2345')`);
  let called = false;
  env.AI = { run: async () => { called = true; return { response: JSON.stringify(goodNote) }; } };
  const result = await applySummary(env, 'mem2', [{ role: 'user', content: 'Boğaz' }], 'tr');
  assert.equal(result.saved, false);
  assert.equal(called, false);
  await setConsent(env, 'mem2', true);
  await forgetNote(env, 'mem2');
  assert.equal(env.DB.raw.prepare('SELECT note_json FROM mimo_profile WHERE member_id=?').get('mem2').note_json, '');
});

async function seedMember(env, {
  id,
  email,
  token,
  fulfilled = 0,
  cancelled = 0,
  expiresAt = '2099-01-01 00:00:00',
}) {
  const ref = `REF${id.replace(/[^a-z0-9]/gi, '').toUpperCase().padEnd(6, 'X').slice(0, 6)}`;
  env.DB.raw.prepare(
    `INSERT INTO members (id, email, lang, referral_code) VALUES (?, ?, 'tr', ?)`
  ).run(id, email, ref);
  const dig = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const hash = [...new Uint8Array(dig)].map((b) => b.toString(16).padStart(2, '0')).join('');
  env.DB.raw.prepare(
    `INSERT INTO sessions (token_hash, member_id, expires_at) VALUES (?, ?, ?)`
  ).run(hash, id, expiresAt);
  for (let i = 0; i < fulfilled; i += 1) {
    env.DB.raw.prepare(
      `INSERT INTO member_requests (ref, member_id, service_id, service_date, guests, state) VALUES (?, ?, 'tour-1', '2026-12-01', 2, 'fulfilled')`
    ).run(`${id}-f-${i}`.padEnd(8, '0'), id);
  }
  for (let i = 0; i < cancelled; i += 1) {
    env.DB.raw.prepare(
      `INSERT INTO member_requests (ref, member_id, service_id, service_date, guests, state) VALUES (?, ?, 'tour-1', '2026-12-01', 2, 'cancelled')`
    ).run(`${id}-c-${i}`.padEnd(8, '0'), id);
  }
}

test('member tier chat limits (15 guest / 60 silver / 120 gold & platinum / 150 IP brake / 6 min) and D1 counter keys', async () => {
  assert.equal(PER_MIN_LIMIT, 6);
  assert.equal(GUEST_DAILY_LIMIT, 15);
  assert.equal(SILVER_DAILY_LIMIT, 60);
  assert.equal(GOLD_DAILY_LIMIT, 120);
  assert.equal(PLATINUM_DAILY_LIMIT, 120);
  assert.equal(IP_DAILY_LIMIT, 150);
  assert.deepEqual([0, 1, 2, 4, 5, 8].map(computeMemberTier), ['silver', 'silver', 'gold', 'gold', 'platinum', 'platinum']);
  assert.deepEqual(
    ['guest', 'silver', 'gold', 'platinum', 'fake'].map(chatDailyLimitForTier),
    [15, 60, 120, 120, 15]
  );

  const env = setup();
  env.ASSISTANT_DAILY_LIMIT = '5000';
  env.AI = {
    run: async () => ({ response: JSON.stringify({ abuse: false, handoff: false, reply: 'Kısa bir yanıt.' }) }),
  };

  await seedMember(env, { id: 'sil1', email: 'sil1@example.com', token: 'tok-sil-1', fulfilled: 1, cancelled: 6 });
  await seedMember(env, { id: 'gld1', email: 'gld1@example.com', token: 'tok-gld-1', fulfilled: 2, cancelled: 3 });
  await seedMember(env, { id: 'plt1', email: 'plt1@example.com', token: 'tok-plt-1', fulfilled: 5 });
  await seedMember(env, { id: 'plt2', email: 'plt2@example.com', token: 'tok-plt-2', fulfilled: 7 });
  await seedMember(env, { id: 'exp1', email: 'exp1@example.com', token: 'tok-exp-1', fulfilled: 9, expiresAt: '2020-01-01 00:00:00' });

  const t0 = Date.UTC(2026, 10, 22, 9, 0, 0);
  assert.equal((await resolveMemberAuth(env, 'Bearer tok-sil-1', t0)).tier, 'silver');
  assert.equal((await resolveMemberAuth(env, 'Bearer tok-gld-1', t0)).tier, 'gold');
  assert.equal((await resolveMemberAuth(env, 'Bearer tok-plt-1', t0)).tier, 'platinum');
  assert.equal(await resolveMemberAuth(env, 'Bearer tok-exp-1', t0), null);
  assert.equal(await resolveMemberAuth(env, 'Bearer forged', t0), null);

  // Guest: 15/day via ip:<ip>
  for (let i = 0; i < GUEST_DAILY_LIMIT; i += 1) {
    const t = t0 + Math.floor(i / PER_MIN_LIMIT) * 60_000;
    const r = await runAssistant({ message: 'Bogaz turu fiyat?', pageLang: 'tr', env, actorKey: 'ip:g1', ipActorKey: 'ip:g1', tier: 'guest', now: t });
    assert.equal(r.ok, true, `guest message ${i + 1}`);
  }
  const g16 = await runAssistant({ message: 'Bogaz turu fiyat?', pageLang: 'tr', env, actorKey: 'ip:g1', ipActorKey: 'ip:g1', tier: 'guest', now: t0 + 3 * 60_000 });
  assert.equal(g16.ok, false);
  assert.equal(g16.status, 429);
  assert.equal(env.DB.raw.prepare(`SELECT day_count FROM assistant_rate_limits WHERE key='ip:g1'`).get().day_count, 16);

  // Silver: 60/day (cancelled requests do not bump tier)
  for (let i = 0; i < SILVER_DAILY_LIMIT; i += 1) {
    const t = t0 + Math.floor(i / PER_MIN_LIMIT) * 60_000;
    const r = await runAssistant({ message: 'Bogaz turu?', pageLang: 'tr', env, actorKey: 'member:sil1', ipActorKey: 'ip:s1', tier: 'silver', now: t });
    assert.equal(r.ok, true, `silver ${i + 1}`);
  }
  const sil61 = await runAssistant({ message: 'Bogaz turu?', pageLang: 'tr', env, actorKey: 'member:sil1', ipActorKey: 'ip:s1', tier: 'silver', now: t0 + 11 * 60_000 });
  assert.equal(sil61.ok, false);
  assert.equal(sil61.status, 429);

  // Gold (2 fulfilled): 120/day
  for (let i = 0; i < GOLD_DAILY_LIMIT; i += 1) {
    const t = t0 + Math.floor(i / PER_MIN_LIMIT) * 60_000;
    const r = await runAssistant({ message: 'Bogaz turu?', pageLang: 'tr', env, actorKey: 'member:gld1', ipActorKey: 'ip:gld', tier: 'gold', now: t });
    assert.equal(r.ok, true, `gold ${i + 1}`);
  }
  const gld121 = await runAssistant({ message: 'Bogaz turu?', pageLang: 'tr', env, actorKey: 'member:gld1', ipActorKey: 'ip:gld', tier: 'gold', now: t0 + 21 * 60_000 });
  assert.equal(gld121.ok, false);
  assert.equal(gld121.status, 429);

  // Platinum (5 fulfilled): 120/day + 6/min burst enforcement
  for (let i = 0; i < PER_MIN_LIMIT; i += 1) {
    const r = await runAssistant({ message: 'Hamam?', pageLang: 'tr', env, actorKey: 'member:plt1', ipActorKey: 'ip:plt-burst', tier: 'platinum', now: t0 });
    assert.equal(r.ok, true);
  }
  const burst7 = await runAssistant({ message: 'Hamam?', pageLang: 'tr', env, actorKey: 'member:plt1', ipActorKey: 'ip:plt-burst', tier: 'platinum', now: t0 });
  assert.equal(burst7.ok, false);
  assert.equal(burst7.status, 429);

  // Reset burst counters and verify Platinum reaches 120 on one day across minutes and fails 121st
  env.DB.raw.prepare(`DELETE FROM assistant_rate_limits WHERE key IN ('member:plt1', 'ip:plt-burst')`).run();
  for (let i = 0; i < PLATINUM_DAILY_LIMIT; i += 1) {
    const t = t0 + Math.floor(i / PER_MIN_LIMIT) * 60_000;
    const r = await runAssistant({ message: 'Hamam?', pageLang: 'tr', env, actorKey: 'member:plt1', ipActorKey: 'ip:plt-full', tier: 'platinum', now: t });
    assert.equal(r.ok, true, `plat ${i + 1}`);
  }
  const plt121 = await runAssistant({ message: 'Hamam?', pageLang: 'tr', env, actorKey: 'member:plt1', ipActorKey: 'ip:plt-full', tier: 'platinum', now: t0 + 21 * 60_000 });
  assert.equal(plt121.ok, false);
  assert.equal(plt121.status, 429);

  // IP brake (150/day across members on shared Wi-Fi IP): plt1 already did 120 on another IP,
  // reset plt1 + seed 2 Platinum members sharing 'ip:hotel-wifi' -> 80 + 70 = 150 ok, 151st fails without consuming plt2
  env.DB.raw.prepare(`DELETE FROM assistant_rate_limits WHERE key = 'member:plt1'`).run();
  for (let i = 0; i < 80; i += 1) {
    const t = t0 + Math.floor(i / PER_MIN_LIMIT) * 60_000;
    const r = await runAssistant({ message: 'Tur?', pageLang: 'tr', env, actorKey: 'member:plt1', ipActorKey: 'ip:hotel-wifi', tier: 'platinum', now: t });
    assert.equal(r.ok, true);
  }
  for (let i = 0; i < 70; i += 1) {
    const t = t0 + Math.floor(i / PER_MIN_LIMIT) * 60_000;
    const r = await runAssistant({ message: 'Tur?', pageLang: 'tr', env, actorKey: 'member:plt2', ipActorKey: 'ip:hotel-wifi', tier: 'platinum', now: t });
    assert.equal(r.ok, true);
  }
  assert.equal(env.DB.raw.prepare(`SELECT day_count FROM assistant_rate_limits WHERE key='ip:hotel-wifi'`).get().day_count, 150);
  const brake151 = await runAssistant({ message: 'Tur?', pageLang: 'tr', env, actorKey: 'member:plt2', ipActorKey: 'ip:hotel-wifi', tier: 'platinum', now: t0 + 13 * 60_000 });
  assert.equal(brake151.ok, false);
  assert.equal(brake151.status, 429);
  assert.equal(env.DB.raw.prepare(`SELECT day_count FROM assistant_rate_limits WHERE key='member:plt2'`).get().day_count, 70);
  const plt2Clean = await runAssistant({ message: 'Tur?', pageLang: 'tr', env, actorKey: 'member:plt2', ipActorKey: 'ip:clean-ip', tier: 'platinum', now: t0 + 13 * 60_000 });
  assert.equal(plt2Clean.ok, true);
});

test('HTTP /v1/assistant enforces tier quotas, ignores spoofed tier, and uses memberNote + observeAssistantTurn on SSE stream', async () => {
  const env = setup();
  env.TURNSTILE_SECRET = 'turnstile';
  env.ASSISTANT_DAILY_LIMIT = '1000';
  const ip = '203.0.113.88';
  const chatSession = await createChatSessionToken(env.CODE_PEPPER, ip);
  await seedMember(env, { id: 'silhttp', email: 'silhttp@example.com', token: 'tok-sil-http', fulfilled: 0, cancelled: 4 });
  await setConsent(env, 'silhttp', true);
  env.DB.raw.prepare(`UPDATE mimo_profile SET note_json = ? WHERE member_id = ?`)
    .run(JSON.stringify(goodNote), 'silhttp');

  const today = new Date().toISOString().slice(0, 10);
  env.DB.raw.prepare(
    `INSERT INTO assistant_rate_limits (key, min_bucket, min_count, day_bucket, day_count) VALUES (?, 0, 0, ?, 14)`
  ).run(`ip:${ip}`, today);

  const promptsSeen = [];
  env.AI = {
    run: async (_model, opts) => {
      promptsSeen.push(JSON.stringify(opts.messages));
      const enc = new TextEncoder();
      return new ReadableStream({
        start(controller) {
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ response: 'Boğaz akşam turu için seni bekliyoruz 💙 [[flags:abuse=0;handoff=0]]' })}\n\n`));
          controller.enqueue(enc.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });
    },
  };

  // 15th guest request passes, 16th with spoofed body tier + invalid bearer token fails 429 as guest
  const waits1 = [];
  const res15 = await worker.fetch(new Request('https://api.example/v1/assistant', {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', Accept: 'text/event-stream', 'CF-Connecting-IP': ip },
    body: JSON.stringify({ message: 'Boğaz turu önerir misin?', lang: 'tr', stream: true, chatSession }),
  }), env, { waitUntil(p) { waits1.push(p); } });
  assert.equal(res15.status, 200);
  const sse15 = await res15.text();
  assert.match(sse15, /event: delta/);
  assert.match(sse15, /event: done/);

  const guest16 = await worker.fetch(new Request('https://api.example/v1/assistant', {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', Authorization: 'Bearer forged-tok', 'CF-Connecting-IP': ip },
    body: JSON.stringify({ message: 'Boğaz turu?', lang: 'tr', tier: 'platinum', memberTier: 'platinum', chatSession }),
  }), env);
  assert.equal(guest16.status, 429);

  // Valid Silver member on SAME IP (even though ip:<ip> is 16 < 150) succeeds on SSE stream with memberNote + observeAssistantTurn!
  const waits2 = [];
  const memberRes = await worker.fetch(new Request('https://api.example/v1/assistant', {
    method: 'POST',
    headers: {
      Origin: ORIGIN,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      Authorization: 'Bearer tok-sil-http',
      'CF-Connecting-IP': ip,
    },
    body: JSON.stringify({ message: 'Boğaz turu önerir misin?', lang: 'tr', stream: true, chatSession, tier: 'platinum' }),
  }), env, { waitUntil(p) { waits2.push(p); } });
  assert.equal(memberRes.status, 200);
  const memberSse = await memberRes.text();
  assert.match(memberSse, /event: done/);
  await Promise.all([...waits1, ...waits2]);

  assert.match(promptsSeen[promptsSeen.length - 1], /Boğaz akşam turu/);
  assert.equal(env.DB.raw.prepare(`SELECT day_count FROM assistant_rate_limits WHERE key='member:silhttp'`).get().day_count, 1);
  assert.equal(env.DB.raw.prepare(`SELECT day_count FROM assistant_rate_limits WHERE key=?`).get(`ip:${ip}`).day_count, 17);
  assert.ok(env.DB.raw.prepare(`SELECT count FROM assistant_metrics WHERE metric='topic:bogaz'`).get().count >= 2);
});

test('Telegram webhook applies linked D1 member tier under member:<id> while keeping tg:<chatId> abuse block', async () => {
  const env = setup();
  env.ASSISTANT_DAILY_LIMIT = '1000';
  env.TELEGRAM_BOT_TOKEN = 'bot';
  const secret = await computeTelegramWebhookSecret(env.CODE_PEPPER);
  await seedMember(env, { id: 'tggold', email: 'tggold@example.com', token: 'tok-tg-gold', fulfilled: 2 });
  env.DB.raw.exec(`INSERT INTO member_identities (provider, subject, member_id) VALUES ('telegram', '707', 'tggold')`);
  env.AI = {
    run: async () => ({ response: JSON.stringify({ abuse: false, handoff: false, reply: 'Boğazda görüşürüz.' }) }),
  };

  const prev = globalThis.fetch;
  const sent = [];
  globalThis.fetch = async (_u, init) => { sent.push(JSON.parse(init.body)); return Response.json({ ok: true }); };
  try {
    const t0 = Date.UTC(2026, 10, 22, 11, 0, 0);
    for (let i = 0; i < 20; i += 1) {
      const now = t0 + Math.floor(i / PER_MIN_LIMIT) * 60_000;
      const r = await handleTelegramWebhook(new Request('https://api.example/v1/telegram/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': secret },
        body: JSON.stringify({ message: { chat: { id: 707, type: 'private' }, from: { id: 707, language_code: 'tr' }, text: 'Bogaz turu?' } }),
      }), env, now);
      assert.equal(r.status, 200);
      assert.notEqual(sent[sent.length - 1].text.includes('limit'), true);
    }
    assert.equal(env.DB.raw.prepare(`SELECT day_count FROM assistant_rate_limits WHERE key='member:tggold'`).get().day_count, 20);
    assert.equal(env.DB.raw.prepare(`SELECT key FROM assistant_rate_limits WHERE key='tg:707'`).get() ?? null, null);
  } finally {
    globalThis.fetch = prev;
  }
});
