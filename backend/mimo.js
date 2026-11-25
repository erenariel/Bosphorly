// Consented member familiarity notes and anonymous Mimo development counters.
// Raw chat is never written. Health, religion, politics, orientation, passport,
// card, address, phone and email are dropped before anything is stored.
// Mimo does not edit its knowledge base; the site owner runs tools/build_knowledge.py.

const SUMMARY_MODEL = '@cf/google/gemma-4-26b-a4b-it';
const NOTE_MAX = 600;
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const IDLE_MS = 10 * 60 * 1000;

function gatewayOpts(env) {
  const id = (env && typeof env.AI_GATEWAY_ID === 'string' && env.AI_GATEWAY_ID.trim()) || 'mimo';
  return { gateway: { id } };
}

const LANGS = new Set([
  'ar', 'az', 'bn', 'bs', 'de', 'en', 'es', 'fa', 'fr', 'he', 'hi', 'hr',
  'hu', 'id', 'it', 'ja', 'ko', 'nl', 'pt', 'ru', 'tr', 'uk', 'zh',
]);

const TOPIC_LABELS = {
  transfer: 'Transfer',
  bogaz: 'Boğaz',
  hamam: 'Hamam',
  sehir: 'Şehir',
  genel: 'Genel',
  diger: 'Diğer',
};

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha256 = async (s) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
const sqlTime = (d) => d.toISOString().replace('T', ' ').slice(0, 19);

export function foldText(s) {
  return String(s || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/ğ/g, 'g')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u');
}

const SENSITIVE_WORDS = [
  /\b(pasaport|passport|kimlik)\b/,
  /\b(saglik|hastane|hamile|ilac|kanser|hastalik|hospital|pregnan|cancer|diabetes|diyabet|recete|ameliyat)\b/,
  /\b(musluman|hristiyan|yahudi|ateist|islam|christian|jewish|muslim|siyon|ortodoks|katolik|hindu|buddhist|budist)\b/,
  /\b(siyaset|secim|election|politic)\b/,
  /\b(escinsel|lgbt|gay|lezbiyen|lesbian|queer|transgender)\b/,
  /\b(adres|sokak|sokagi|mahalle|mahallesi|cadde(si)?|street|avenue|postcode)\b/,
  /\b(telefon|phone|gsm)\b/,
  /(^|[^a-z])din([^a-z]|$)/,
  // German, plus Hebrew, Russian and Arabic basics (passport, phone, address, health, religion).
  /\b(reisepass|handy|adresse|strasse|straße|gesundheit|krankenhaus|krankheit|schwanger|religion|christentum|christlich|muslimisch|judentum)\b/,
  /паспорт|телефон|адрес|здоровье|религия|דרכון|טלפון|כתובת|בריאות|جواز|هاتف|عنوان|صحة/,
  /(^|[^\p{L}])(דת|دين)([^\p{L}]|$)/u,
];

export function containsSensitive(value) {
  const raw = String(value || '');
  if (!raw.trim()) return false;
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(raw)) return true;
  const compact = raw.replace(/[\s().]/g, '');
  if (/(?<!\d)\d{8,19}(?!\d)/.test(compact)) return true;
  const folded = foldText(raw);
  return SENSITIVE_WORDS.some((re) => re.test(folded));
}

function canonTone(v) {
  const s = foldText(v).replace(/\s+/g, '');
  if (s === 'samimi') return 'samimi';
  if (s === 'resmi') return 'resmî';
  return null;
}
function canonEmoji(v) {
  const s = foldText(v).replace(/\s+/g, '');
  if (s === 'az') return 'az';
  if (s === 'orta') return 'orta';
  if (s === 'cok') return 'çok';
  return null;
}
function canonLength(v) {
  const s = foldText(v).replace(/\s+/g, '');
  if (s === 'kisa') return 'kısa';
  if (s === 'detayli') return 'detaylı';
  return null;
}

function cleanTag(value, max) {
  const t = String(value || '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t || t.length > max || /[<>]/.test(t)) return '';
  return t;
}

function takeTags(list, maxItems, maxLen) {
  if (!Array.isArray(list)) return null;
  const out = [];
  for (const item of list) {
    if (typeof item !== 'string') return null;
    const tag = cleanTag(item, maxLen);
    if (!tag || containsSensitive(tag) || out.includes(tag)) continue;
    out.push(tag);
    if (out.length >= maxItems) break;
  }
  return out;
}

export function sanitizeNote(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const tone = canonTone(input.tone);
  const emoji = canonEmoji(input.emoji);
  const length = canonLength(input.length);
  const lang = typeof input.lang === 'string' && LANGS.has(input.lang) ? input.lang : null;
  if (!tone || !emoji || !length || !lang) return null;
  const interests = takeTags(input.interests, 8, 40);
  const lastTopics = takeTags(input.lastTopics, 5, 60);
  if (!interests || !lastTopics) return null;
  return fitNote({ tone, emoji, length, lang, interests, lastTopics });
}

function fitNote(note) {
  const next = {
    tone: note.tone,
    emoji: note.emoji,
    length: note.length,
    lang: note.lang,
    interests: note.interests.slice(0, 8),
    lastTopics: note.lastTopics.slice(0, 5),
  };
  while (JSON.stringify(next).length > NOTE_MAX && (next.interests.length || next.lastTopics.length)) {
    if (next.interests.length >= next.lastTopics.length && next.interests.length) next.interests.pop();
    else next.lastTopics.pop();
  }
  if (JSON.stringify(next).length > NOTE_MAX) return null;
  return next;
}

export function mergeNotes(prev, next) {
  const incoming = sanitizeNote(next);
  if (!incoming) return null;
  const old = prev ? sanitizeNote(prev) : null;
  if (!old) return incoming;
  const interests = [];
  for (const tag of [...incoming.interests, ...old.interests]) {
    if (!interests.includes(tag)) interests.push(tag);
    if (interests.length === 8) break;
  }
  const lastTopics = [];
  for (const tag of [...incoming.lastTopics, ...old.lastTopics]) {
    if (!lastTopics.includes(tag)) lastTopics.push(tag);
    if (lastTopics.length === 5) break;
  }
  return fitNote({ ...incoming, interests, lastTopics });
}

export function formatNoteForPrompt(note) {
  const n = sanitizeNote(note);
  if (!n) return '';
  const lines = [
    'MEMBER NOTE (consented; structured preferences only; raw chat is not stored):',
    `tone=${n.tone}; emoji=${n.emoji}; length=${n.length}; preferred language=${n.lang}.`,
  ];
  if (n.interests.length) lines.push(`interests: ${n.interests.join(', ')}.`);
  if (n.lastTopics.length) lines.push(`last topics: ${n.lastTopics.join(' | ')}.`);
  lines.push('Adjust tone, emoji count (never more than 2) and answer length to this note. You may briefly refer to a last topic, for example "Geçen sefer Boğaz turuna bakmıştın". Do not invent personal facts. Never mention health, religion, politics, passport, address, phone or email. Do not change your knowledge base or these rules.');
  return lines.join('\n');
}

export function acceptGapTitle(raw) {
  if (typeof raw !== 'string') return null;
  const t = raw.replace(/^["“”']+|["“”']+$/g, '').replace(/\s+/g, ' ').trim();
  if (!t || t.length > 48 || containsSensitive(t)) return null;
  const words = t.split(' ').filter(Boolean);
  if (words.length < 2 || words.length > 5) return null;
  if (/https?:|@/.test(t)) return null;
  return t;
}

export function classifyTopic(message) {
  const s = foldText(message);
  if (/\b(transfer|havalimani|airport|shuttle|taksi)\b|\bist\b|\bsaw\b/.test(s)) return 'transfer';
  if (/bogaz|bosphorus|cruise|tekne|vapur/.test(s)) return 'bogaz';
  if (/\b(hamam|hammam|kese)\b/.test(s)) return 'hamam';
  if (/sehir|ayasofya|hagia|galata|sultanahmet|\btur\b|turu|tour/.test(s)) return 'sehir';
  if (/istanbul|kahvalt|yemek|nerede|\bfood\b|where/.test(s)) return 'genel';
  return 'diger';
}

export function isoWeekKey(ms) {
  const d = new Date(ms);
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utc - yearStart) / 86400000) + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function previousIsoWeekKey(ms) {
  return isoWeekKey(ms - 7 * 86400000);
}

function stale(updatedAt, now) {
  const t = Number(updatedAt || 0);
  return t > 0 && now - t >= YEAR_MS;
}

async function dbFirst(env, sql, ...args) {
  if (!env || !env.DB) return null;
  return env.DB.prepare(sql).bind(...args).first();
}
async function dbAll(env, sql, ...args) {
  if (!env || !env.DB) return [];
  const res = await env.DB.prepare(sql).bind(...args).all();
  if (Array.isArray(res)) return res;
  return (res && res.results) || [];
}
async function dbRun(env, sql, ...args) {
  if (!env || !env.DB) return;
  await env.DB.prepare(sql).bind(...args).run();
}

function parseStored(raw) {
  if (!raw || typeof raw !== 'string') return null;
  try { return sanitizeNote(JSON.parse(raw)); } catch { return null; }
}

export function computeMemberTier(fulfilledCount) {
  const n = Number(fulfilledCount || 0);
  if (n >= 5) return 'platinum';
  if (n >= 2) return 'gold';
  return 'silver';
}

// Site owners (comma-separated e-mails in the OWNER_EMAILS secret) are always
// platinum and get the internal 'owner' limit tier so they can test freely.
// The list lives in a Worker secret, never in this public repository.
export function isOwnerEmail(env, email) {
  const e = String(email || '').trim().toLowerCase();
  if (!e || !env) return false;
  if (typeof env.ADMIN_OWNER_EMAIL === 'string' && env.ADMIN_OWNER_EMAIL.trim().toLowerCase() === e) return true;
  if (!env.OWNER_EMAILS) return false;
  return String(env.OWNER_EMAILS).split(',').some(x => x.trim().toLowerCase() === e);
}

export async function memberTierById(env, memberId) {
  if (!env || !env.DB || !memberId) return 'silver';
  try {
    if (env.OWNER_EMAILS || env.ADMIN_OWNER_EMAIL) {
      const m = await dbFirst(env, `SELECT email FROM members WHERE id=?`, String(memberId));
      if (m && isOwnerEmail(env, m.email)) return 'owner';
    }
    const row = await dbFirst(
      env,
      `SELECT COUNT(*) AS n FROM member_requests WHERE member_id=? AND state='fulfilled'`,
      String(memberId),
    );
    return computeMemberTier(row ? row.n : 0);
  } catch {
    return 'silver';
  }
}

function extractSessionToken(tokenOrHeader) {
  const raw = String(tokenOrHeader || '').trim();
  if (!raw) return '';
  const bearer = /^Bearer\s+(\S+)$/i.exec(raw);
  if (bearer) return bearer[1];
  return /\s/.test(raw) ? '' : raw;
}

export async function resolveMemberAuth(env, tokenOrHeader, now = Date.now()) {
  const tok = extractSessionToken(tokenOrHeader);
  if (!tok || tok.length > 100 || !env || !env.DB) return null;
  try {
    const nowMs = Number.isFinite(Number(now)) ? Number(now) : Date.now();
    const row = await dbFirst(
      env,
      `SELECT m.id AS member_id, m.email AS email FROM sessions s JOIN members m ON m.id=s.member_id WHERE s.token_hash=? AND s.expires_at>?`,
      await sha256(tok),
      sqlTime(new Date(nowMs)),
    );
    if (!row || !row.member_id) return null;
    const memberId = String(row.member_id);
    if (isOwnerEmail(env, row.email)) {
      return { memberId, tier: 'owner', fulfilledCount: 0, owner: true };
    }
    let fulfilledCount = 0;
    try {
      const cnt = await dbFirst(
        env,
        `SELECT COUNT(*) AS n FROM member_requests WHERE member_id=? AND state='fulfilled'`,
        memberId,
      );
      fulfilledCount = Number(cnt ? cnt.n : 0) || 0;
    } catch { /* older fixtures without member_requests treat authenticated member as silver */ }
    return {
      memberId,
      tier: computeMemberTier(fulfilledCount),
      fulfilledCount,
    };
  } catch {
    return null;
  }
}

export async function memberIdFromBearer(env, header, now = Date.now()) {
  const m = /^Bearer\s+(\S+)$/.exec(String(header || ''));
  if (!m) return null;
  const auth = await resolveMemberAuth(env, m[1], now);
  return auth ? auth.memberId : null;
}

export async function memberIdFromTelegram(env, telegramId) {
  if (!env || !env.DB || telegramId == null || telegramId === '') return null;
  try {
    const row = await dbFirst(
      env,
      `SELECT member_id FROM member_identities WHERE provider='telegram' AND subject=?`,
      String(telegramId),
    );
    return row && row.member_id ? String(row.member_id) : null;
  } catch {
    return null;
  }
}

export async function getMimoState(env, memberId, now = Date.now()) {
  const empty = { consent: false, asked: false, note: null };
  try {
    const row = await dbFirst(env, `SELECT consent, note_json, updated_at FROM mimo_profile WHERE member_id=?`, memberId);
    if (!row) return empty;
    if (stale(row.updated_at, now)) {
      await dbRun(env, `DELETE FROM mimo_profile WHERE member_id=?`, memberId);
      return empty;
    }
    const consent = Number(row.consent) === 1;
    return { consent, asked: true, note: consent ? parseStored(row.note_json) : null };
  } catch {
    return empty;
  }
}

export async function setConsent(env, memberId, consent, now = Date.now()) {
  if (consent) {
    await dbRun(
      env,
      `INSERT INTO mimo_profile (member_id, consent, note_json, updated_at) VALUES (?, 1, '', ?)
       ON CONFLICT(member_id) DO UPDATE SET consent=1, updated_at=excluded.updated_at`,
      memberId, now,
    );
  } else {
    await dbRun(
      env,
      `INSERT INTO mimo_profile (member_id, consent, note_json, updated_at) VALUES (?, 0, '', ?)
       ON CONFLICT(member_id) DO UPDATE SET consent=0, note_json='', updated_at=excluded.updated_at`,
      memberId, now,
    );
  }
  return getMimoState(env, memberId, now);
}

export async function forgetNote(env, memberId, now = Date.now()) {
  await dbRun(env, `UPDATE mimo_profile SET note_json='', updated_at=? WHERE member_id=?`, now, memberId);
  return getMimoState(env, memberId, now);
}

export async function saveNote(env, memberId, note, now = Date.now(), { merge = true } = {}) {
  const clean = sanitizeNote(note);
  if (!clean) return { saved: false, reason: 'schema' };
  const row = await dbFirst(env, `SELECT consent, note_json, updated_at FROM mimo_profile WHERE member_id=?`, memberId);
  if (!row || Number(row.consent) !== 1) return { saved: false, reason: 'no_consent' };
  if (stale(row.updated_at, now)) {
    await dbRun(env, `DELETE FROM mimo_profile WHERE member_id=?`, memberId);
    return { saved: false, reason: 'no_consent' };
  }
  const prev = parseStored(row.note_json);
  const next = merge && prev ? mergeNotes(prev, clean) : clean;
  if (!next) return { saved: false, reason: 'schema' };
  const json = JSON.stringify(next);
  await dbRun(
    env,
    `UPDATE mimo_profile SET note_json=?, updated_at=? WHERE member_id=? AND consent=1`,
    json, now, memberId,
  );
  return { saved: true, note: next };
}

export async function loadConsentedNote(env, memberId, now = Date.now()) {
  const state = await getMimoState(env, memberId, now);
  if (!state.consent || !state.note) return null;
  try {
    await dbRun(env, `UPDATE mimo_profile SET updated_at=? WHERE member_id=? AND consent=1`, now, memberId);
  } catch { /* activity stamp is best-effort */ }
  return state.note;
}

function parseModelJson(ai) {
  const text = typeof ai === 'string' ? ai : (ai && (ai.response || ai.text || '')) || '';
  const start = String(text).indexOf('{');
  const end = String(text).lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(String(text).slice(start, end + 1)); } catch { return null; }
}

export async function summarizeProfile(env, history, lang) {
  if (!env || !env.AI || typeof env.AI.run !== 'function') return null;
  const turns = (Array.isArray(history) ? history : []).slice(-6).map((h) => {
    const role = h && h.role === 'assistant' ? 'A' : 'G';
    return `${role}: ${String((h && h.content) || '').slice(0, 400)}`;
  }).join('\n').slice(0, 2500);
  if (!turns.trim()) return null;
  const preferred = LANGS.has(lang) ? lang : 'en';
  try {
    const ai = await env.AI.run(SUMMARY_MODEL, {
      messages: [
        {
          role: 'system',
          content: `Extract ONLY a JSON object with keys tone ("samimi" or "resmî"), emoji ("az", "orta" or "çok"), length ("kısa" or "detaylı"), lang (a 2-letter code, default "${preferred}"), interests (max 8 short tags) and lastTopics (max 5 short titles). No other keys. Never include health, religion, politics, sexual orientation, passport, payment card, address, phone, email, or verbatim quotes. If unknown, use tone "samimi", emoji "orta", length "kısa", lang "${preferred}" and empty arrays.`,
        },
        { role: 'user', content: turns },
      ],
      max_completion_tokens: 220,
      temperature: 0,
      chat_template_kwargs: { enable_thinking: false },
    }, gatewayOpts(env));
    return sanitizeNote(parseModelJson(ai));
  } catch {
    return null;
  }
}

export async function applySummary(env, memberId, history, lang, now = Date.now()) {
  const state = await getMimoState(env, memberId, now);
  if (!state.consent) return { saved: false, reason: 'no_consent' };
  const extracted = await summarizeProfile(env, history, lang);
  if (!extracted) return { saved: false, reason: 'schema' };
  return saveNote(env, memberId, extracted, now, { merge: true });
}

export async function purgeInactive(env, now = Date.now()) {
  try {
    await dbRun(env, `DELETE FROM mimo_profile WHERE updated_at > 0 AND updated_at <= ?`, now - YEAR_MS);
  } catch { /* table may be absent in older fixtures */ }
}

async function bump(env, metric, bucket) {
  try {
    await dbRun(
      env,
      `INSERT INTO assistant_metrics (metric, bucket, count) VALUES (?, ?, 1)
       ON CONFLICT(metric, bucket) DO UPDATE SET count = count + 1`,
      metric, bucket,
    );
  } catch { /* counters are best-effort and never store message text */ }
}

async function bumpGap(env, topic, bucket) {
  try {
    await dbRun(
      env,
      `INSERT INTO assistant_gap_topics (topic, bucket, count) VALUES (?, ?, 1)
       ON CONFLICT(topic, bucket) DO UPDATE SET count = count + 1`,
      topic, bucket,
    );
  } catch { /* same as metrics */ }
}

export async function extractGapTitle(env, message) {
  const clipped = String(message || '').slice(0, 240).trim();
  if (!clipped || containsSensitive(clipped) || !env || !env.AI || typeof env.AI.run !== 'function') return null;
  let timer = null;
  try {
    const rawTimeout = Number(env.ASSISTANT_AI_TIMEOUT_MS);
    const timeoutMs = Number.isFinite(rawTimeout) && rawTimeout > 0 ? Math.min(rawTimeout, 5000) : 5000;
    const aiOpts = {
      messages: [
        { role: 'system', content: 'Return ONLY a 2 to 5 word anonymous travel topic title. No names, phone numbers, email, health, religion, politics, passport, address, or quotes.' },
        { role: 'user', content: clipped },
      ],
      max_completion_tokens: 24,
      temperature: 0,
      chat_template_kwargs: { enable_thinking: false },
    };
    const runPromise = env.AI.run(SUMMARY_MODEL, aiOpts, gatewayOpts(env));
    const timeoutPromise = new Promise((resolve) => {
      timer = setTimeout(() => resolve(null), timeoutMs);
    });
    const ai = await Promise.race([runPromise, timeoutPromise]);
    if (!ai) return null;
    const text = typeof ai === 'string' ? ai : (ai && (ai.response || ai.text)) || '';
    return acceptGapTitle(String(text).split('\n')[0]);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function observeAssistantTurn(env, { message = '', result = {}, now = Date.now() } = {}) {
  if (!env || !env.DB) return;
  try {
    const bucket = isoWeekKey(now);
    await bump(env, `topic:${classifyTopic(message)}`, bucket);
    await bump(env, `lang:${String(result.lang || 'en').slice(0, 2)}`, bucket);
    if (result.closed && result.abuse && !result.blocked) await bump(env, 'outcome:closed', bucket);
    if (result.fallback) {
      await bump(env, 'outcome:unknown', bucket);
      const title = await extractGapTitle(env, message);
      if (title) await bumpGap(env, title, bucket);
    } else if (result.handoff || result.handoffOffer) {
      await bump(env, 'outcome:handoff', bucket);
    }
  } catch { /* never block a reply on stats */ }
}

export async function recordVoteMetric(env, vote, lang, now = Date.now()) {
  if (vote !== 'up' && vote !== 'down') return;
  const bucket = isoWeekKey(now);
  await bump(env, `vote:${vote}`, bucket);
  await bump(env, `vote:${vote}:${String(lang || 'en').slice(0, 2)}`, bucket);
}

function countOf(rows, metric) {
  const row = rows.find((r) => r.metric === metric);
  return row ? Number(row.count || 0) : 0;
}

export async function buildWeeklyReportText(env, now = Date.now(), bucket = previousIsoWeekKey(now)) {
  let metrics = [];
  let gaps = [];
  try { metrics = await dbAll(env, `SELECT metric, count FROM assistant_metrics WHERE bucket=?`, bucket); } catch { metrics = []; }
  try {
    gaps = await dbAll(env, `SELECT topic, count FROM assistant_gap_topics WHERE bucket=? ORDER BY count DESC LIMIT 10`, bucket);
  } catch { gaps = []; }
  const topics = Object.keys(TOPIC_LABELS).map((key) => ({ key, label: TOPIC_LABELS[key], count: countOf(metrics, `topic:${key}`) }));
  topics.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'tr'));
  const langs = metrics
    .filter((r) => String(r.metric || '').startsWith('lang:'))
    .map((r) => ({ lang: String(r.metric).slice(5), count: Number(r.count || 0) }))
    .sort((a, b) => b.count - a.count || a.lang.localeCompare(b.lang));
  const up = countOf(metrics, 'vote:up');
  const down = countOf(metrics, 'vote:down');
  const votes = up + down;
  const ratio = votes ? `${Math.round((up / votes) * 100)}% olumlu` : 'veri yok';
  const lines = [
    `Mimo haftalık gelişim raporu (${bucket})`,
    '',
    'En çok sorulan konular:',
    ...topics.map((t) => `- ${t.label}: ${t.count}`),
    '',
    'Cevaplanamayan ilk 10 konu:',
    ...(gaps.length ? gaps.map((g, i) => `${i + 1}. ${g.topic} (${g.count})`) : ['- Bu hafta cevaplanamayan konu yok.']),
    '',
    `Beğeni: ${up} 👍 / ${down} 👎 (${ratio})`,
    '',
    'Dil dağılımı:',
    ...(langs.length ? langs.map((l) => `- ${l.lang}: ${l.count}`) : ['- veri yok']),
    '',
    `Zorbalık nedeniyle kapatılan sohbet: ${countOf(metrics, 'outcome:closed')}`,
    '',
    'Öneri: Bu konular siteye eklenirse Mimo cevaplayabilir.',
    'Mimo kendi bilgi tabanını veya sistem yönergesini otomatik değiştirmez. Eklemeler site sahibinin onayıyla tools/build_knowledge.py üzerinden yapılır.',
  ];
  return lines.join('\n');
}

export async function sendWeeklyMimoReport(env, now = Date.now()) {
  await purgeInactive(env, now);
  const bucket = previousIsoWeekKey(now);
  const text = await buildWeeklyReportText(env, now, bucket);
  const fromEmail = env && (env.REQUEST_FROM_EMAIL || env.MAIL_FROM);
  if (!env || !env.RESEND_API_KEY || !fromEmail) return { ok: false, error: 'email_not_configured', text };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: ['info@bosphorly.com'],
        subject: `Mimo haftalık gelişim raporu ${bucket}`,
        text,
      }),
    });
    return { ok: !!res.ok, text };
  } catch {
    return { ok: false, error: 'email_failed', text };
  }
}

export const MIMO_IDLE_MS = IDLE_MS;
export const MIMO_YEAR_MS = YEAR_MS;

// Background work must not delay the reply. Tests call handlers without ctx and still await.
export async function runInBackground(ctx, job) {
  const task = Promise.resolve(job);
  if (ctx && typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(task);
    return;
  }
  await task;
}
