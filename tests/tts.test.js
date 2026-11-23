import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../backend/worker.js';
import { createChatSessionToken } from '../backend/assistant.js';
import * as ttsModule from '../backend/tts.js';
import {
  CHIRP_TTS_LOCALES,
  DEFAULT_TTS_MONTHLY_CHAR_CAP,
  TTS_GOLD_DAILY_LIMIT,
  TTS_GUEST_DAILY_LIMIT,
  TTS_IP_DAILY_LIMIT,
  TTS_MAX_CHARS,
  TTS_PER_MIN_LIMIT,
  TTS_PLATINUM_DAILY_LIMIT,
  TTS_SILVER_DAILY_LIMIT,
  checkTtsActorRateLimit,
  handleTtsRoute,
  resolveChirpVoice,
  sanitizeSpeechText,
  synthesizeTtsAudio,
  ttsDailyLimitForTier,
} from '../backend/tts.js';

const ORIGIN = 'https://bosphorly.com';
const CODE_PEPPER = 'test-tts-pepper';

function createMockD1() {
  const usage = new Map();
  const limits = new Map();
  return {
    usage,
    limits,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.includes('FROM tts_usage WHERE month = ?')) {
                const chars = usage.get(args[0]);
                return chars === undefined ? null : { chars };
              }
              if (sql.includes('FROM assistant_rate_limits WHERE key = ?')) {
                return limits.get(args[0]) || null;
              }
              return null;
            },
            async run() {
              if (sql.includes('INSERT INTO tts_usage')) {
                const [month, insertChars, deltaChars] = args;
                const prev = usage.get(month);
                usage.set(month, prev === undefined ? Number(insertChars) : Number(prev) + Number(deltaChars));
                return { success: true };
              }
              if (sql.includes('INSERT INTO assistant_rate_limits')) {
                const [key, min_bucket, min_count, day_bucket, day_count] = args;
                limits.set(key, { min_bucket, min_count, day_bucket, day_count });
                return { success: true };
              }
              return { success: true };
            },
          };
        },
      };
    },
  };
}

function createMemoryCache() {
  const store = new Map();
  return {
    store,
    async match(req) {
      const hit = store.get(typeof req === 'string' ? req : req.url);
      return hit ? hit.clone() : undefined;
    },
    async put(req, res) {
      store.set(typeof req === 'string' ? req : req.url, res.clone());
    },
  };
}

async function authHeaders(ip, now = Date.now()) {
  const token = await createChatSessionToken(CODE_PEPPER, ip, now);
  return {
    Origin: ORIGIN,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'CF-Connecting-IP': ip,
  };
}

test('wrangler.jsonc sets TTS_MONTHLY_CHAR_CAP to 800000 and limits constants are configured', () => {
  const raw = readFileSync(new URL('../backend/wrangler.jsonc', import.meta.url), 'utf8');
  assert.match(raw, /"TTS_MONTHLY_CHAR_CAP"\s*:\s*"800000"/);
  assert.equal(DEFAULT_TTS_MONTHLY_CHAR_CAP, 800000);
  assert.equal('TTS_PER_DAY_LIMIT' in ttsModule, false);
  assert.equal(TTS_PER_MIN_LIMIT, 10);
  assert.equal(TTS_GUEST_DAILY_LIMIT, 5);
  assert.equal(TTS_SILVER_DAILY_LIMIT, 15);
  assert.equal(TTS_GOLD_DAILY_LIMIT, 25);
  assert.equal(TTS_PLATINUM_DAILY_LIMIT, 100);
  assert.equal(TTS_IP_DAILY_LIMIT, 60);
  assert.equal(ttsDailyLimitForTier('guest'), 5);
  assert.equal(ttsDailyLimitForTier('silver'), 15);
  assert.equal(ttsDailyLimitForTier('gold'), 25);
  assert.equal(ttsDailyLimitForTier('platinum'), 100);
  assert.equal(ttsDailyLimitForTier('forged'), 5);
});

test('POST /v1/tts rejects missing, forged, wrong-IP, or expired chatSession with 401 without calling Google or burning limits', async () => {
  const db = createMockD1();
  const env = {
    PUBLIC_ORIGIN: ORIGIN,
    CODE_PEPPER,
    GOOGLE_TTS_API_KEY: 'key-123',
    DB: db,
    RATE_LIMITER: { limit: async () => ({ success: true }) },
  };
  let googleCalled = false;
  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => { googleCalled = true; throw new Error('Google must not be called on 401'); };

  try {
    const ip = '203.0.113.10';
    const wrongIpToken = await createChatSessionToken(CODE_PEPPER, '198.51.100.99');
    const expiredToken = await createChatSessionToken(CODE_PEPPER, ip, Date.now() - 3600_000, 1000);

    const invalidHeaders = [
      { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
      { Origin: ORIGIN, Authorization: 'Bearer invalid.sig', 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
      { Origin: ORIGIN, Authorization: `Bearer ${wrongIpToken}`, 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
      { Origin: ORIGIN, Authorization: `Bearer ${expiredToken}`, 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    ];

    for (const headers of invalidHeaders) {
      const res = await worker.fetch(
        new Request('https://worker.example/v1/tts', {
          method: 'POST',
          headers,
          body: JSON.stringify({ text: 'Merhaba', lang: 'tr' }),
        }),
        env
      );
      assert.equal(res.status, 401);
      assert.deepEqual(await res.json(), { error: 'Chat session required' });
    }
    assert.equal(googleCalled, false);
    assert.equal(db.limits.size, 0);

    const optRes = await worker.fetch(
      new Request('https://worker.example/v1/tts', {
        method: 'OPTIONS',
        headers: { Origin: ORIGIN },
      }),
      env
    );
    assert.equal(optRes.status, 204);
    assert.match(optRes.headers.get('Access-Control-Allow-Headers') || '', /Authorization/i);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('CHIRP_TTS_LOCALES maps all 20 supported languages and rejects fa/az/bs cleanly', async () => {
  const expected = {
    tr: 'tr-TR',
    en: 'en-US',
    ru: 'ru-RU',
    uk: 'uk-UA',
    de: 'de-DE',
    fr: 'fr-FR',
    nl: 'nl-NL',
    ar: 'ar-XA',
    he: 'he-IL',
    es: 'es-ES',
    it: 'it-IT',
    pt: 'pt-BR',
    hr: 'hr-HR',
    hu: 'hu-HU',
    zh: 'cmn-CN',
    ja: 'ja-JP',
    ko: 'ko-KR',
    hi: 'hi-IN',
    bn: 'bn-IN',
    id: 'id-ID',
  };
  assert.deepEqual(CHIRP_TTS_LOCALES, expected);

  for (const [lang, locale] of Object.entries(expected)) {
    const v = resolveChirpVoice(lang);
    assert.deepEqual(v, {
      shortLang: lang,
      locale,
      voiceName: `${locale}-Chirp3-HD-Puck`,
    });
  }
  assert.equal(resolveChirpVoice('iw-IL').voiceName, 'he-IL-Chirp3-HD-Puck');
  assert.equal(resolveChirpVoice('in-ID').voiceName, 'id-ID-Chirp3-HD-Puck');
  assert.equal(resolveChirpVoice('cmn-Hans-CN').voiceName, 'cmn-CN-Chirp3-HD-Puck');

  for (const unsupported of ['fa', 'az', 'bs', 'fa-IR', 'az-Latn-AZ']) {
    assert.equal(resolveChirpVoice(unsupported), null, `${unsupported} must be unsupported`);
  }

  let fetchCalled = false;
  const now = Date.UTC(2026, 10, 22, 12, 0, 0);
  const headers = await authHeaders('1.2.3.4', now);
  for (const lang of ['fa', 'az', 'bs']) {
    const req = new Request('https://api.example/v1/tts', {
      method: 'POST',
      headers,
      body: JSON.stringify({ text: 'Merhaba Boğaz turu', lang }),
    });
    const env = {
      PUBLIC_ORIGIN: ORIGIN,
      CODE_PEPPER,
      GOOGLE_TTS_API_KEY: 'secret-key',
      DB: createMockD1(),
      RATE_LIMITER: { limit: async () => ({ success: true }) },
    };
    const origFetch = globalThis.fetch;
    globalThis.fetch = async () => { fetchCalled = true; throw new Error('Should not fetch'); };
    try {
      const res = await handleTtsRoute(req, env, null, now);
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { fallback: true });
    } finally {
      globalThis.fetch = origFetch;
    }
  }
  assert.equal(fetchCalled, false);
});

test('backend sanitizeSpeechText cleans links/flags, turns sentence emojis into ". ", and truncates at 600 chars', () => {
  const raw = '<|channel>thought\nhidden<channel|>Merhaba 👋 Bugün Boğaz çok güzel 😊\nDetay: https://bosphorly.com/tours 💙 [[flags:abuse=0;handoff=0]]';
  const cleaned = sanitizeSpeechText(raw);
  assert.ok(cleaned.includes('Merhaba. Bugün Boğaz çok güzel. Detay'));
  assert.doesNotMatch(cleaned, /hidden|https?:|bosphorly\.com|flags|\p{Extended_Pictographic}/iu);

  const longInput = 'Boğaz turu harika! '.repeat(60);
  const capped = sanitizeSpeechText(longInput);
  assert.ok(capped.length > 500 && capped.length <= TTS_MAX_CHARS);
  assert.equal(sanitizeSpeechText('a'.repeat(700)).length, TTS_MAX_CHARS);
});

test('synthesizeTtsAudio sends API key strictly in X-Goog-Api-Key header (never in URL), uses Chirp3-HD-Puck & Cache API, skips DB write on cache hit, and never logs text', async () => {
  const db = createMockD1();
  const cache = createMemoryCache();
  const fetchCalls = [];
  const fakeMp3 = Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00, 0x01]);
  const env = {
    PUBLIC_ORIGIN: ORIGIN,
    GOOGLE_TTS_API_KEY: 'test-goog-key-999',
    TTS_MONTHLY_CHAR_CAP: '800000',
    DB: db,
    TTS_CACHE: cache,
  };
  const now = Date.UTC(2026, 10, 22, 12, 0, 0);
  const secretPhrase = 'GizliPuckTestMetni12345 Boğaz çok güzel';
  const logs = [];
  const origLog = console.log;
  console.log = (...args) => logs.push(args.map((a) => String(a)).join(' '));

  try {
    const mockFetch = async (url, init) => {
      fetchCalls.push({ url, init });
      return new Response(JSON.stringify({ audioContent: fakeMp3.toString('base64') }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const r1 = await synthesizeTtsAudio({ env, text: secretPhrase, lang: 'tr', now, fetchImpl: mockFetch });
    assert.equal(r1.kind, 'audio');
    assert.equal(r1.cached, false);
    assert.deepEqual(Buffer.from(r1.audio), fakeMp3);

    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, 'https://texttospeech.googleapis.com/v1/text:synthesize');
    assert.ok(!fetchCalls[0].url.includes('test-goog-key-999') && !fetchCalls[0].url.includes('key='));
    assert.equal(fetchCalls[0].init.headers['X-Goog-Api-Key'], 'test-goog-key-999');
    const reqBody = JSON.parse(fetchCalls[0].init.body);
    assert.equal(reqBody.input.text, secretPhrase);
    assert.equal(reqBody.voice.languageCode, 'tr-TR');
    assert.equal(reqBody.voice.name, 'tr-TR-Chirp3-HD-Puck');
    assert.equal(reqBody.audioConfig.audioEncoding, 'MP3');
    assert.equal(reqBody.audioConfig.speakingRate, 1.05);

    const monthCharsAfterMiss = db.usage.get('2026-11');
    assert.equal(monthCharsAfterMiss, secretPhrase.length);
    assert.equal(cache.store.size, 1);
    const cachedEntry = [...cache.store.values()][0];
    assert.match(cachedEntry.headers.get('Cache-Control'), /max-age=2592000/);

    const r2 = await synthesizeTtsAudio({ env, text: secretPhrase, lang: 'tr', now, fetchImpl: mockFetch });
    assert.equal(r2.kind, 'audio');
    assert.equal(r2.cached, true);
    assert.deepEqual(Buffer.from(r2.audio), fakeMp3);
    assert.equal(fetchCalls.length, 1);
    assert.equal(db.usage.get('2026-11'), monthCharsAfterMiss);

    assert.equal(logs.length, 2);
    for (const line of logs) {
      assert.ok(!line.includes('GizliPuckTestMetni12345'), 'TTS log must not contain spoken text');
      assert.match(line, /^assistant_tts \{/);
      const parsed = JSON.parse(line.replace(/^assistant_tts /, ''));
      assert.deepEqual(Object.keys(parsed).sort(), ['cached', 'chars', 'fallback', 'lang', 'ms']);
    }
    assert.equal(JSON.parse(logs[0].replace(/^assistant_tts /, '')).cached, false);
    assert.equal(JSON.parse(logs[1].replace(/^assistant_tts /, '')).cached, true);
  } finally {
    console.log = origLog;
  }
});

test('monthly character cap blocks Google API call before spending and returns { fallback: true }', async () => {
  const db = createMockD1();
  db.usage.set('2026-11', 799995);
  let googleCalled = false;
  const now = Date.UTC(2026, 10, 22, 12, 0, 0);
  const env = {
    PUBLIC_ORIGIN: ORIGIN,
    CODE_PEPPER,
    GOOGLE_TTS_API_KEY: 'test-key',
    TTS_MONTHLY_CHAR_CAP: '800000',
    DB: db,
    TTS_CACHE: createMemoryCache(),
    RATE_LIMITER: { limit: async () => ({ success: true }) },
  };
  const headers = await authHeaders('10.0.0.1', now);
  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => { googleCalled = true; throw new Error('Should not call Google when cap reached'); };
  try {
    const req = new Request('https://api.example/v1/tts', {
      method: 'POST',
      headers,
      body: JSON.stringify({ text: 'Merhaba', lang: 'tr' }),
    });
    const res = await handleTtsRoute(req, env, null, now);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { fallback: true });
    assert.equal(googleCalled, false);
    assert.equal(db.usage.get('2026-11'), 799995);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('missing secret or Google error returns 200 { fallback: true } and does not advance counter', async () => {
  const db = createMockD1();
  const now = Date.UTC(2026, 10, 22, 12, 0, 0);
  const envNoKey = {
    PUBLIC_ORIGIN: ORIGIN,
    CODE_PEPPER,
    DB: db,
    TTS_CACHE: createMemoryCache(),
    RATE_LIMITER: { limit: async () => ({ success: true }) },
  };
  const rNoKey = await handleTtsRoute(
    new Request('https://api.example/v1/tts', {
      method: 'POST',
      headers: await authHeaders('10.0.0.2', now),
      body: JSON.stringify({ text: 'Hello', lang: 'en' }),
    }),
    envNoKey,
    null,
    now
  );
  assert.equal(rNoKey.status, 200);
  assert.deepEqual(await rNoKey.json(), { fallback: true });

  const envErr = {
    PUBLIC_ORIGIN: ORIGIN,
    CODE_PEPPER,
    GOOGLE_TTS_API_KEY: 'key',
    DB: db,
    TTS_CACHE: createMemoryCache(),
    RATE_LIMITER: { limit: async () => ({ success: true }) },
  };
  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('quota exceeded', { status: 429 });
  try {
    const rErr = await handleTtsRoute(
      new Request('https://api.example/v1/tts', {
        method: 'POST',
        headers: await authHeaders('10.0.0.3', now),
        body: JSON.stringify({ text: 'Hello', lang: 'en' }),
      }),
      envErr,
      null,
      now
    );
    assert.equal(rErr.status, 200);
    assert.deepEqual(await rErr.json(), { fallback: true });
    assert.equal(db.usage.get('2026-11'), undefined);
  } finally {
    globalThis.fetch = origFetch;
  }
});

function realSqlD1() {
  const db = new DatabaseSync(':memory:');
  for (const file of [
    '0001.sql',
    '0002_members.sql',
    '0003_member_preferences_newsletter.sql',
    '0004_member_sync_requests_details.sql',
    '0005_identities_passkeys.sql',
    '0006_oauth_pending.sql',
    '0007_assistant.sql',
    '0008_assistant_blocks.sql',
    '0009_tts_usage.sql',
    '0010_mimo.sql',
  ]) {
    db.exec(readFileSync(new URL('../backend/migrations/' + file, import.meta.url), 'utf8'));
  }
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...args).changes) } }),
  });
  return { raw: db, prepare: (sql) => stmt(sql) };
}

async function seedMemberSession(db, {
  memberId,
  token,
  fulfilledCount = 0,
  cancelledCount = 0,
  expiresAt = '2099-01-01 00:00:00',
}) {
  db.raw.prepare(
    `INSERT INTO members (id, email, lang, referral_code) VALUES (?, ?, 'tr', ?)`
  ).run(memberId, `${memberId}@example.com`, `REF${memberId.slice(0, 6).toUpperCase()}`);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const tokenHash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  db.raw.prepare(
    `INSERT INTO sessions (token_hash, member_id, expires_at) VALUES (?, ?, ?)`
  ).run(tokenHash, memberId, expiresAt);
  for (let i = 0; i < fulfilledCount; i += 1) {
    db.raw.prepare(
      `INSERT INTO member_requests (ref, member_id, service_id, service_date, guests, state) VALUES (?, ?, 'tour-1', '2026-12-01', 2, 'fulfilled')`
    ).run(`RF-${memberId}-${i}`, memberId);
  }
  for (let i = 0; i < cancelledCount; i += 1) {
    db.raw.prepare(
      `INSERT INTO member_requests (ref, member_id, service_id, service_date, guests, state) VALUES (?, ?, 'tour-1', '2026-12-01', 2, 'cancelled')`
    ).run(`RC-${memberId}-${i}`, memberId);
  }
}

test('POST /v1/tts enforces Origin/CORS, X-Member-Session preflight, and guest 5/day { fallback: true }', async () => {
  const db = createMockD1();
  const cache = createMemoryCache();
  const env = {
    PUBLIC_ORIGIN: ORIGIN,
    CODE_PEPPER,
    GOOGLE_TTS_API_KEY: 'key-123',
    TTS_MONTHLY_CHAR_CAP: '800000',
    DB: db,
    TTS_CACHE: cache,
    RATE_LIMITER: { limit: async () => ({ success: true }) },
  };

  // Preflight exposes X-Member-Session and X-Chat-Session CORS headers
  const preflight = await worker.fetch(
    new Request('https://worker.example/v1/tts', {
      method: 'OPTIONS',
      headers: { Origin: ORIGIN },
    }),
    env
  );
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get('Access-Control-Allow-Headers') || '', /X-Member-Session/);
  assert.match(preflight.headers.get('Access-Control-Allow-Headers') || '', /X-Chat-Session/);

  // Disallowed origin -> 403 via worker.fetch
  const badOriginRes = await worker.fetch(
    new Request('https://worker.example/v1/tts', {
      method: 'POST',
      headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Hello', lang: 'en' }),
    }),
    env
  );
  assert.equal(badOriginRes.status, 403);

  const fakeMp3 = Buffer.from([0xff, 0xfb, 0x90, 0x64]);
  let googleCalls = 0;
  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    googleCalls += 1;
    return new Response(JSON.stringify({ audioContent: fakeMp3.toString('base64') }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  try {
    const dayStart = Date.UTC(2026, 10, 22, 10, 0, 0);
    const dayIp = '198.51.100.31';
    const guestHeaders = await authHeaders(dayIp, dayStart);
    for (let i = 0; i < TTS_GUEST_DAILY_LIMIT; i += 1) {
      const r = await handleTtsRoute(
        new Request('https://worker.example/v1/tts', {
          method: 'POST',
          headers: guestHeaders,
          body: JSON.stringify({ text: 'Guest quota test', lang: 'en' }),
        }),
        env,
        null,
        dayStart + i * 1000
      );
      assert.equal(r.status, 200);
      assert.equal(r.headers.get('Content-Type'), 'audio/mpeg');
    }

    // 6th guest request same day -> silent { fallback: true } without calling Google
    const callsBefore6th = googleCalls;
    const res6 = await handleTtsRoute(
      new Request('https://worker.example/v1/tts', {
        method: 'POST',
        headers: guestHeaders,
        body: JSON.stringify({ text: 'Uncached 6th guest request', lang: 'en' }),
      }),
      env,
      null,
      dayStart + 60_000
    );
    assert.equal(res6.status, 200);
    assert.deepEqual(await res6.json(), { fallback: true });
    assert.equal(googleCalls, callsBefore6th);

    // Next UTC day resets guest quota
    const nextDay = dayStart + 24 * 60 * 60_000;
    const resNextDay = await handleTtsRoute(
      new Request('https://worker.example/v1/tts', {
        method: 'POST',
        headers: await authHeaders(dayIp, nextDay),
        body: JSON.stringify({ text: 'Guest quota test', lang: 'en' }),
      }),
      env,
      null,
      nextDay
    );
    assert.equal(resNextDay.status, 200);
    assert.equal(resNextDay.headers.get('Content-Type'), 'audio/mpeg');
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('POST /v1/tts verifies D1 member tiers (Silver 10/min & 15/day, Gold 25/day, Platinum 100/day), enforces 100/day Platinum IP brake, and ignores forged claims', async () => {
  const db = realSqlD1();
  const cache = createMemoryCache();
  const env = {
    PUBLIC_ORIGIN: ORIGIN,
    CODE_PEPPER,
    GOOGLE_TTS_API_KEY: 'key-123',
    TTS_MONTHLY_CHAR_CAP: '800000',
    DB: db,
    TTS_CACHE: cache,
    RATE_LIMITER: { limit: async () => ({ success: true }) },
  };

  await seedMemberSession(db, { memberId: 'silver1', token: 'tok-silver-1', fulfilledCount: 1, cancelledCount: 5 });
  await seedMemberSession(db, { memberId: 'gold1', token: 'tok-gold-1', fulfilledCount: 2 });
  await seedMemberSession(db, { memberId: 'plat1', token: 'tok-plat-1', fulfilledCount: 5 });
  await seedMemberSession(db, { memberId: 'plat2', token: 'tok-plat-2', fulfilledCount: 6 });
  await seedMemberSession(db, {
    memberId: 'expired1',
    token: 'tok-expired-1',
    fulfilledCount: 6,
    expiresAt: '2020-01-01 00:00:00',
  });

  const fakeMp3 = Buffer.from([0xff, 0xfb, 0x90, 0x64]);
  const origFetch = globalThis.fetch;
  let googleCalls = 0;
  globalThis.fetch = async () => {
    googleCalls += 1;
    return new Response(JSON.stringify({ audioContent: fakeMp3.toString('base64') }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const dayStart = Date.UTC(2026, 10, 22, 10, 0, 0);

    // Silver: 10/min -> 11th returns 429; 30/day -> 31st returns { fallback: true }
    const silverIp = '198.51.100.70';
    const silverBurstChat = await createChatSessionToken(CODE_PEPPER, silverIp);
    for (let i = 0; i < TTS_PER_MIN_LIMIT; i += 1) {
      const r = await worker.fetch(
        new Request('https://worker.example/v1/tts', {
          method: 'POST',
          headers: {
            Origin: ORIGIN,
            Authorization: `Bearer ${silverBurstChat}`,
            'X-Member-Session': 'tok-silver-1',
            'Content-Type': 'application/json',
            'CF-Connecting-IP': silverIp,
          },
          body: JSON.stringify({ text: 'Hello Istanbul', lang: 'en' }),
        }),
        env
      );
      assert.equal(r.status, 200);
      assert.equal(r.headers.get('Content-Type'), 'audio/mpeg');
    }
    const silverBurst429 = await handleTtsRoute(
      new Request('https://worker.example/v1/tts', {
        method: 'POST',
        headers: {
          Origin: ORIGIN,
          Authorization: `Bearer ${silverBurstChat}`,
          'X-Member-Session': 'tok-silver-1',
          'Content-Type': 'application/json',
          'CF-Connecting-IP': silverIp,
        },
        body: JSON.stringify({ text: 'Hello Istanbul', lang: 'en' }),
      }),
      env,
      null,
      Date.now()
    );
    assert.equal(silverBurst429.status, 429);

    // Remaining 20 requests across later minutes on same day (using X-Chat-Session + Bearer member token header variant)
    const silverIpDay = '198.51.100.71';
    const silverDayChat = await createChatSessionToken(CODE_PEPPER, silverIpDay, dayStart);
    await db.raw.prepare(`DELETE FROM assistant_rate_limits WHERE key IN ('tts:member:silver1', 'tts:ip:198.51.100.70')`).run();
    for (let i = 0; i < TTS_SILVER_DAILY_LIMIT; i += 1) {
      const t = dayStart + Math.floor(i / TTS_PER_MIN_LIMIT) * 60_000;
      const r = await handleTtsRoute(
        new Request('https://worker.example/v1/tts', {
          method: 'POST',
          headers: {
            Origin: ORIGIN,
            'X-Chat-Session': silverDayChat,
            Authorization: 'Bearer tok-silver-1',
            'Content-Type': 'application/json',
            'CF-Connecting-IP': silverIpDay,
          },
          body: JSON.stringify({ text: 'Hello Istanbul', lang: 'en' }),
        }),
        env,
        null,
        t
      );
      assert.equal(r.status, 200);
      assert.equal(r.headers.get('Content-Type'), 'audio/mpeg');
    }
    const silver31 = await handleTtsRoute(
      new Request('https://worker.example/v1/tts', {
        method: 'POST',
        headers: {
          Origin: ORIGIN,
          'X-Chat-Session': silverDayChat,
          Authorization: 'Bearer tok-silver-1',
          'Content-Type': 'application/json',
          'CF-Connecting-IP': silverIpDay,
        },
        body: JSON.stringify({ text: 'Hello Istanbul 31', lang: 'en' }),
      }),
      env,
      null,
      dayStart + 4 * 60_000
    );
    assert.equal(silver31.status, 200);
    assert.deepEqual(await silver31.json(), { fallback: true });

    // Gold: 60/day -> 61st returns { fallback: true }
    const goldIp = '198.51.100.80';
    const goldChat = await createChatSessionToken(CODE_PEPPER, goldIp, dayStart);
    for (let i = 0; i < TTS_GOLD_DAILY_LIMIT; i += 1) {
      const t = dayStart + Math.floor(i / TTS_PER_MIN_LIMIT) * 60_000;
      const r = await handleTtsRoute(
        new Request('https://worker.example/v1/tts', {
          method: 'POST',
          headers: {
            Origin: ORIGIN,
            Authorization: `Bearer ${goldChat}`,
            'X-Member-Session': 'tok-gold-1',
            'Content-Type': 'application/json',
            'CF-Connecting-IP': goldIp,
          },
          body: JSON.stringify({ text: 'Hello Istanbul', lang: 'en' }),
        }),
        env,
        null,
        t
      );
      assert.equal(r.status, 200);
      assert.equal(r.headers.get('Content-Type'), 'audio/mpeg');
    }
    const gold61 = await handleTtsRoute(
      new Request('https://worker.example/v1/tts', {
        method: 'POST',
        headers: {
          Origin: ORIGIN,
          Authorization: `Bearer ${goldChat}`,
          'X-Member-Session': 'tok-gold-1',
          'Content-Type': 'application/json',
          'CF-Connecting-IP': goldIp,
        },
        body: JSON.stringify({ text: 'Gold 61', lang: 'en' }),
      }),
      env,
      null,
      dayStart + 7 * 60_000
    );
    assert.equal(gold61.status, 200);
    assert.deepEqual(await gold61.json(), { fallback: true });

    // IP brake (60/day independent of member): Platinum1 uses 40, Platinum2 uses 20 on sharedIp, 21st for Platinum2 returns { fallback: true }
    // without wasting Platinum2's member quota when moving to a clean IP.
    const sharedIp = '198.51.100.90';
    const sharedChat = await createChatSessionToken(CODE_PEPPER, sharedIp, dayStart);
    for (let i = 0; i < 40; i += 1) {
      const t = dayStart + Math.floor(i / TTS_PER_MIN_LIMIT) * 60_000;
      const r = await handleTtsRoute(
        new Request('https://worker.example/v1/tts', {
          method: 'POST',
          headers: {
            Origin: ORIGIN,
            Authorization: `Bearer ${sharedChat}`,
            'X-Member-Session': 'tok-plat-1',
            'Content-Type': 'application/json',
            'CF-Connecting-IP': sharedIp,
          },
          body: JSON.stringify({ text: 'Hello Istanbul', lang: 'en' }),
        }),
        env,
        null,
        t
      );
      assert.equal(r.headers.get('Content-Type'), 'audio/mpeg');
    }
    for (let i = 0; i < 60; i += 1) {
      const t = dayStart + Math.floor(i / TTS_PER_MIN_LIMIT) * 60_000;
      const r = await handleTtsRoute(
        new Request('https://worker.example/v1/tts', {
          method: 'POST',
          headers: {
            Origin: ORIGIN,
            Authorization: `Bearer ${sharedChat}`,
            'X-Member-Session': 'tok-plat-2',
            'Content-Type': 'application/json',
            'CF-Connecting-IP': sharedIp,
          },
          body: JSON.stringify({ text: 'Hello Istanbul', lang: 'en' }),
        }),
        env,
        null,
        t
      );
      assert.equal(r.headers.get('Content-Type'), 'audio/mpeg');
    }
    const callsBeforeBrake = googleCalls;
    const brakeRes = await handleTtsRoute(
      new Request('https://worker.example/v1/tts', {
        method: 'POST',
        headers: {
          Origin: ORIGIN,
          Authorization: `Bearer ${sharedChat}`,
          'X-Member-Session': 'tok-plat-2',
          'Content-Type': 'application/json',
          'CF-Connecting-IP': sharedIp,
        },
        body: JSON.stringify({ text: 'IP brake uncached', lang: 'en' }),
      }),
      env,
      null,
      dayStart + 20 * 60_000
    );
    assert.equal(brakeRes.status, 200);
    assert.deepEqual(await brakeRes.json(), { fallback: true });
    assert.equal(googleCalls, callsBeforeBrake);
    const plat2Row = db.raw.prepare(`SELECT day_count FROM assistant_rate_limits WHERE key = 'tts:member:plat2'`).get();
    assert.equal(plat2Row.day_count, 60);

    // Moving Platinum2 to a clean IP still allows remaining member quota
    const cleanIp = '198.51.100.91';
    const cleanChat = await createChatSessionToken(CODE_PEPPER, cleanIp, dayStart);
    const plat2Clean = await handleTtsRoute(
      new Request('https://worker.example/v1/tts', {
        method: 'POST',
        headers: {
          Origin: ORIGIN,
          Authorization: `Bearer ${cleanChat}`,
          'X-Member-Session': 'tok-plat-2',
          'Content-Type': 'application/json',
          'CF-Connecting-IP': cleanIp,
        },
        body: JSON.stringify({ text: 'Hello Istanbul', lang: 'en' }),
      }),
      env,
      null,
      dayStart + 20 * 60_000
    );
    assert.equal(plat2Clean.headers.get('Content-Type'), 'audio/mpeg');

    // Forged / expired member token + spoofed body tier fall back to guest 5/day limit
    const spoofIp = '198.51.100.99';
    const spoofChat = await createChatSessionToken(CODE_PEPPER, spoofIp, dayStart);
    for (let i = 0; i < TTS_GUEST_DAILY_LIMIT; i += 1) {
      const r = await handleTtsRoute(
        new Request('https://worker.example/v1/tts', {
          method: 'POST',
          headers: {
            Origin: ORIGIN,
            Authorization: `Bearer ${spoofChat}`,
            'X-Member-Session': i % 2 === 0 ? 'tok-expired-1' : 'forged-member-token',
            'Content-Type': 'application/json',
            'CF-Connecting-IP': spoofIp,
          },
          body: JSON.stringify({ text: 'Hello Istanbul', lang: 'en', tier: 'platinum', memberTier: 'platinum' }),
        }),
        env,
        null,
        dayStart + i * 1000
      );
      assert.equal(r.headers.get('Content-Type'), 'audio/mpeg');
    }
    const spoof6th = await handleTtsRoute(
      new Request('https://worker.example/v1/tts', {
        method: 'POST',
        headers: {
          Origin: ORIGIN,
          Authorization: `Bearer ${spoofChat}`,
          'X-Member-Session': 'tok-expired-1',
          'Content-Type': 'application/json',
          'CF-Connecting-IP': spoofIp,
        },
        body: JSON.stringify({ text: 'Spoofed 6th', lang: 'en', tier: 'platinum' }),
      }),
      env,
      null,
      dayStart + 10_000
    );
    assert.deepEqual(await spoof6th.json(), { fallback: true });
    assert.equal(db.raw.prepare(`SELECT key FROM assistant_rate_limits WHERE key = 'tts:member:expired1'`).get() ?? null, null);

    // Complete Platinum2 remaining quota on cleanIp (already at 21 from cleanIp request #1 -> reach 60 -> 61st returns fallback)
    for (let i = 61; i < TTS_PLATINUM_DAILY_LIMIT; i += 1) {
      const t = dayStart + (21 + Math.floor((i - 61) / TTS_PER_MIN_LIMIT)) * 60_000;
      const r = await handleTtsRoute(
        new Request('https://worker.example/v1/tts', {
          method: 'POST',
          headers: {
            Origin: ORIGIN,
            Authorization: `Bearer ${cleanChat}`,
            'X-Member-Session': 'tok-plat-2',
            'Content-Type': 'application/json',
            'CF-Connecting-IP': cleanIp,
          },
          body: JSON.stringify({ text: 'Hello Istanbul', lang: 'en' }),
        }),
        env,
        null,
        t
      );
      assert.equal(r.headers.get('Content-Type'), 'audio/mpeg');
    }
    const plat61 = await handleTtsRoute(
      new Request('https://worker.example/v1/tts', {
        method: 'POST',
        headers: {
          Origin: ORIGIN,
          Authorization: `Bearer ${cleanChat}`,
          'X-Member-Session': 'tok-plat-2',
          'Content-Type': 'application/json',
          'CF-Connecting-IP': cleanIp,
        },
        body: JSON.stringify({ text: 'Platinum 61st', lang: 'en' }),
      }),
      env,
      null,
      dayStart + 29 * 60_000
    );
    assert.equal(plat61.status, 200);
    assert.deepEqual(await plat61.json(), { fallback: true });

    // Logging out revokes session in D1 and drops caller back to guest 5/day limit + privacy log emits only tier name and counts
    await seedMemberSession(db, { memberId: 'logout1', token: 'tok-logout-1', fulfilledCount: 5 });
    const logoutIp = '198.51.100.120';
    const logoutChat = await createChatSessionToken(CODE_PEPPER, logoutIp, dayStart);
    const logsCaptured = [];
    const prevConsoleLog = console.log;
    console.log = (...args) => logsCaptured.push(args.map((a) => String(a)).join(' '));
    try {
      const signedInRes = await handleTtsRoute(
        new Request('https://worker.example/v1/tts', {
          method: 'POST',
          headers: {
            Origin: ORIGIN,
            Authorization: `Bearer ${logoutChat}`,
            'X-Member-Session': 'tok-logout-1',
            'Content-Type': 'application/json',
            'CF-Connecting-IP': logoutIp,
          },
          body: JSON.stringify({ text: 'Secret guest spoken text logout1', lang: 'en' }),
        }),
        env,
        null,
        dayStart
      );
      assert.equal(signedInRes.headers.get('Content-Type'), 'audio/mpeg');
      assert.equal(db.raw.prepare(`SELECT day_count FROM assistant_rate_limits WHERE key = 'tts:member:logout1'`).get().day_count, 1);

      const outRes = await worker.fetch(
        new Request('https://worker.example/v1/auth/logout', {
          method: 'POST',
          headers: { Origin: ORIGIN, 'Content-Type': 'application/json', Authorization: 'Bearer tok-logout-1' },
          body: '{}',
        }),
        env
      );
      assert.equal(outRes.status, 200);
      assert.deepEqual(await outRes.json(), { signedOut: true });

      // Note: logoutIp already recorded day_count = 1 while signed in (from IP brake); 4 more as guest reach 5, 6th falls back!
      for (let i = 1; i < TTS_GUEST_DAILY_LIMIT; i += 1) {
        const r = await handleTtsRoute(
          new Request('https://worker.example/v1/tts', {
            method: 'POST',
            headers: {
              Origin: ORIGIN,
              Authorization: `Bearer ${logoutChat}`,
              'X-Member-Session': 'tok-logout-1',
              'Content-Type': 'application/json',
              'CF-Connecting-IP': logoutIp,
            },
            body: JSON.stringify({ text: 'After logout guest message', lang: 'en' }),
          }),
          env,
          null,
          dayStart + i * 1000
        );
        assert.equal(r.headers.get('Content-Type'), 'audio/mpeg');
      }
      const afterLogout6 = await handleTtsRoute(
        new Request('https://worker.example/v1/tts', {
          method: 'POST',
          headers: {
            Origin: ORIGIN,
            Authorization: `Bearer ${logoutChat}`,
            'X-Member-Session': 'tok-logout-1',
            'Content-Type': 'application/json',
            'CF-Connecting-IP': logoutIp,
          },
          body: JSON.stringify({ text: 'After logout 6th', lang: 'en' }),
        }),
        env,
        null,
        dayStart + 10_000
      );
      assert.deepEqual(await afterLogout6.json(), { fallback: true });
      assert.equal(db.raw.prepare(`SELECT day_count FROM assistant_rate_limits WHERE key = 'tts:member:logout1'`).get().day_count, 1);

      const ttsLogs = logsCaptured.filter((l) => l.startsWith('assistant_tts '));
      assert.ok(ttsLogs.length >= 2);
      const parsedLogs = ttsLogs.map((l) => JSON.parse(l.replace(/^assistant_tts /, '')));
      assert.equal(parsedLogs[0].tier, 'platinum');
      assert.equal(parsedLogs[parsedLogs.length - 1].tier, 'guest');
      const allJoined = ttsLogs.join('\n');
      assert.equal(allJoined.includes('logout1'), false);
      assert.equal(allJoined.includes('logout1@example.com'), false);
      assert.equal(allJoined.includes('Secret guest spoken text'), false);
    } finally {
      console.log = prevConsoleLog;
    }
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('checkTtsActorRateLimit without env.DB tracks guest (5/day) and member tier (10/min, silver 15/day) in memory and always returns boolean', async () => {
  const baseTime = Date.UTC(2026, 10, 22, 8, 0, 0);

  // Guest default (5/day) in memory path without DB
  for (let i = 0; i < TTS_GUEST_DAILY_LIMIT; i += 1) {
    const ok = await checkTtsActorRateLimit({ env: {}, actorKey: 'ip:mem-guest', now: baseTime + i * 1000 });
    assert.strictEqual(ok, true);
  }
  assert.strictEqual(
    await checkTtsActorRateLimit({ env: {}, actorKey: 'ip:mem-guest', now: baseTime + 60_000 }),
    false
  );
  assert.strictEqual(
    await checkTtsActorRateLimit({ env: {}, actorKey: 'ip:mem-guest', now: baseTime + 24 * 60 * 60_000 }),
    true
  );

  // Per-minute limit (10/min) with Silver tier (30/day) in memory path (env = {})
  for (let i = 0; i < TTS_PER_MIN_LIMIT; i += 1) {
    const ok = await checkTtsActorRateLimit({ env: {}, actorKey: 'member:mem-min', tier: 'silver', now: baseTime });
    assert.strictEqual(ok, true);
  }
  const blockedMin = await checkTtsActorRateLimit({ env: {}, actorKey: 'member:mem-min', tier: 'silver', now: baseTime });
  assert.strictEqual(blockedMin, false);

  // Next minute resets min limit while preserving daily count
  const okNextMin = await checkTtsActorRateLimit({ env: {}, actorKey: 'member:mem-min', tier: 'silver', now: baseTime + 60_000 });
  assert.strictEqual(okNextMin, true);

  // Silver daily limit (30/day) in memory path without DB
  for (let i = 0; i < TTS_SILVER_DAILY_LIMIT; i += 1) {
    const t = baseTime + Math.floor(i / TTS_PER_MIN_LIMIT) * 60_000;
    const ok = await checkTtsActorRateLimit({ env: {}, actorKey: 'member:mem-day', tier: 'silver', now: t });
    assert.strictEqual(ok, true, `memory daily request ${i + 1} must be allowed`);
  }
  const blocked31 = await checkTtsActorRateLimit({
    env: {},
    actorKey: 'member:mem-day',
    tier: 'silver',
    now: baseTime + 3 * 60_000,
  });
  assert.strictEqual(blocked31, false, '31st daily request in memory path must return boolean false');

  // Next UTC day resets in-memory daily counter
  const nextDayAllowed = await checkTtsActorRateLimit({
    env: {},
    actorKey: 'member:mem-day',
    tier: 'silver',
    now: baseTime + 24 * 60 * 60_000,
  });
  assert.strictEqual(nextDayAllowed, true);
});
