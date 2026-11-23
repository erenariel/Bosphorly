import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../backend/worker.js';
import {
  CHIRP_TTS_LOCALES,
  DEFAULT_TTS_MONTHLY_CHAR_CAP,
  TTS_MAX_CHARS,
  TTS_PER_MIN_LIMIT,
  handleTtsRoute,
  resolveChirpVoice,
  sanitizeSpeechText,
  synthesizeTtsAudio,
} from '../backend/tts.js';

const ORIGIN = 'https://bosphorly.com';

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

test('wrangler.jsonc sets TTS_MONTHLY_CHAR_CAP to 800000', () => {
  const raw = readFileSync(new URL('../backend/wrangler.jsonc', import.meta.url), 'utf8');
  assert.match(raw, /"TTS_MONTHLY_CHAR_CAP"\s*:\s*"800000"/);
  assert.equal(DEFAULT_TTS_MONTHLY_CHAR_CAP, 800000);
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
  for (const lang of ['fa', 'az', 'bs']) {
    const req = new Request('https://api.example/v1/tts', {
      method: 'POST',
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': '1.2.3.4' },
      body: JSON.stringify({ text: 'Merhaba Boğaz turu', lang }),
    });
    const env = {
      PUBLIC_ORIGIN: ORIGIN,
      GOOGLE_TTS_API_KEY: 'secret-key',
      DB: createMockD1(),
      RATE_LIMITER: { limit: async () => ({ success: true }) },
    };
    const origFetch = globalThis.fetch;
    globalThis.fetch = async () => { fetchCalled = true; throw new Error('Should not fetch'); };
    try {
      const res = await handleTtsRoute(req, env);
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

    // First call -> hits Google TTS, writes DB usage & 30d Cache API
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

    // Second call -> served from Cache API, zero Google fetches, zero additional DB increments
    const r2 = await synthesizeTtsAudio({ env, text: secretPhrase, lang: 'tr', now, fetchImpl: mockFetch });
    assert.equal(r2.kind, 'audio');
    assert.equal(r2.cached, true);
    assert.deepEqual(Buffer.from(r2.audio), fakeMp3);
    assert.equal(fetchCalls.length, 1);
    assert.equal(db.usage.get('2026-11'), monthCharsAfterMiss);

    // Privacy check: text must NEVER be logged
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
  const env = {
    PUBLIC_ORIGIN: ORIGIN,
    GOOGLE_TTS_API_KEY: 'test-key',
    TTS_MONTHLY_CHAR_CAP: '800000',
    DB: db,
    TTS_CACHE: createMemoryCache(),
    RATE_LIMITER: { limit: async () => ({ success: true }) },
  };
  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => { googleCalled = true; throw new Error('Should not call Google when cap reached'); };
  try {
    const req = new Request('https://api.example/v1/tts', {
      method: 'POST',
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.0.0.1' },
      body: JSON.stringify({ text: 'Merhaba', lang: 'tr' }), // 7 chars -> 799995 + 7 > 800000
    });
    const res = await handleTtsRoute(req, env, null, Date.UTC(2026, 10, 22, 12, 0, 0));
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
  const envNoKey = {
    PUBLIC_ORIGIN: ORIGIN,
    DB: db,
    TTS_CACHE: createMemoryCache(),
    RATE_LIMITER: { limit: async () => ({ success: true }) },
  };
  const rNoKey = await handleTtsRoute(
    new Request('https://api.example/v1/tts', {
      method: 'POST',
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.0.0.2' },
      body: JSON.stringify({ text: 'Hello', lang: 'en' }),
    }),
    envNoKey
  );
  assert.equal(rNoKey.status, 200);
  assert.deepEqual(await rNoKey.json(), { fallback: true });

  const envErr = {
    PUBLIC_ORIGIN: ORIGIN,
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
        headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.0.0.3' },
        body: JSON.stringify({ text: 'Hello', lang: 'en' }),
      }),
      envErr,
      null,
      Date.UTC(2026, 10, 22, 12, 0, 0)
    );
    assert.equal(rErr.status, 200);
    assert.deepEqual(await rErr.json(), { fallback: true });
    assert.equal(db.usage.get('2026-11'), undefined);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('POST /v1/tts enforces Origin/CORS, RATE_LIMITER, 10/min actor rate limit, and returns audio/mpeg headers on hit', async () => {
  const db = createMockD1();
  const cache = createMemoryCache();
  const env = {
    PUBLIC_ORIGIN: ORIGIN,
    GOOGLE_TTS_API_KEY: 'key-123',
    TTS_MONTHLY_CHAR_CAP: '800000',
    DB: db,
    TTS_CACHE: cache,
    RATE_LIMITER: { limit: async () => ({ success: true }) },
  };

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
  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ audioContent: fakeMp3.toString('base64') }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
  try {
    // 10 allowed calls/min from same IP
    for (let i = 0; i < TTS_PER_MIN_LIMIT; i += 1) {
      const okRes = await worker.fetch(
        new Request('https://worker.example/v1/tts', {
          method: 'POST',
          headers: {
            Origin: ORIGIN,
            'Content-Type': 'application/json',
            'CF-Connecting-IP': '198.51.100.7',
          },
          body: JSON.stringify({ text: 'Hello Istanbul', lang: 'en' }),
        }),
        env
      );
      assert.equal(okRes.status, 200);
      assert.equal(okRes.headers.get('Content-Type'), 'audio/mpeg');
      assert.equal(okRes.headers.get('Cache-Control'), 'private, max-age=86400');
      assert.equal(okRes.headers.get('Access-Control-Allow-Origin'), ORIGIN);
      assert.deepEqual(Buffer.from(await okRes.arrayBuffer()), fakeMp3);
    }

    // 11th request in same minute -> 429
    const limitedRes = await worker.fetch(
      new Request('https://worker.example/v1/tts', {
        method: 'POST',
        headers: {
          Origin: ORIGIN,
          'Content-Type': 'application/json',
          'CF-Connecting-IP': '198.51.100.7',
        },
        body: JSON.stringify({ text: 'Hello Istanbul', lang: 'en' }),
      }),
      env
    );
    assert.equal(limitedRes.status, 429);
  } finally {
    globalThis.fetch = origFetch;
  }
});
