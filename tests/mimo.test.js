import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../backend/worker.js';
import { checkAndIncrementLimits, createChatSessionToken, runAssistant } from '../backend/assistant.js';
import { computeTelegramWebhookSecret, handleTelegramWebhook } from '../backend/telegram.js';
import {
  MIMO_YEAR_MS,
  acceptGapTitle,
  applySummary,
  buildWeeklyReportText,
  classifyTopic,
  containsSensitive,
  forgetNote,
  isoWeekKey,
  observeAssistantTurn,
  previousIsoWeekKey,
  recordVoteMetric,
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
