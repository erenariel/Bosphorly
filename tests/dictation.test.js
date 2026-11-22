import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../backend/worker.js';
import {
  SPEECH_LOCALES,
  SUPPORTED_LANGS,
  TRANSCRIBE_MAX_BYTES,
  WHISPER_MODEL,
  createChatSessionToken,
  speechLocale,
  transcribeAudio,
  verifyChatSessionToken,
} from '../backend/assistant.js';
import { TG_TEXT, computeTelegramWebhookSecret } from '../backend/telegram.js';

const ORIGIN = 'https://bosphorly.com';
const ALL_23 = [...SUPPORTED_LANGS];
const PHRASE = 'UNSTORED-PHRASE-bosphorly';
const IP = '203.0.113.10';

function decodeAudio(b64) {
  return [...Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))];
}

function env(extra = {}) {
  return {
    PUBLIC_ORIGIN: ORIGIN,
    CODE_PEPPER: 'pepper-dictation',
    RATE_LIMITER: { limit: async () => ({ success: true }) },
    TURNSTILE_SECRET: 'ts-secret',
    ASSISTANT_DAILY_LIMIT: '1500',
    ...extra,
  };
}

async function sessionToken(pepper = 'pepper-dictation', ip = IP, now = Date.now()) {
  const token = await createChatSessionToken(pepper, ip, now);
  assert.equal(typeof token, 'string');
  assert.equal(await verifyChatSessionToken(pepper, token, ip, now), true);
  return token;
}

test('speech locales cover all 23 languages with the required BCP-47 tags', () => {
  assert.equal(Object.keys(SPEECH_LOCALES).length, 23);
  for (const lang of ALL_23) assert.equal(typeof SPEECH_LOCALES[lang], 'string');
  assert.equal(speechLocale('tr'), 'tr-TR');
  assert.equal(speechLocale('he'), 'he-IL');
  assert.equal(speechLocale('ar'), 'ar-SA');
  assert.equal(speechLocale('ru'), 'ru-RU');
  assert.equal(speechLocale('zh-Hans'), 'zh-CN');
  assert.equal(speechLocale('pt'), 'pt-PT');
  assert.equal(speechLocale('xx'), 'en-US');
  const chat = readFileSync(new URL('../assistant-chat.js', import.meta.url), 'utf8');
  const client = new Function(`return ${chat.match(/const SPEECH_LOCALES = (\{[^}]+\})/)[1]}`)();
  assert.deepEqual(client, SPEECH_LOCALES);
});

test('browser speech recognition is preferred and Whisper is the fallback', () => {
  const chat = readFileSync(new URL('../assistant-chat.js', import.meta.url), 'utf8');
  const fn = chat.match(/function chooseDictationMode\(caps\) \{[\s\S]*?\n  \}/)[0];
  const choose = new Function(`${fn}; return chooseDictationMode;`)();
  const Rec = function SpeechRecognition() {};
  const MediaRecorder = function MediaRecorder() {};
  assert.equal(choose({ SpeechRecognition: Rec, MediaRecorder, mediaDevices: {} }), 'browser');
  assert.equal(choose({ webkitSpeechRecognition: Rec, MediaRecorder, mediaDevices: {} }), 'browser');
  assert.equal(choose({ MediaRecorder, mediaDevices: { getUserMedia() {} } }), 'whisper');
  assert.equal(choose({}), 'none');
  assert.match(chat, /\/v1\/assistant\/transcribe/);
  assert.match(chat, /DICTATION_MAX_MS = 30000/);
  assert.match(chat, /DICTATION_MAX_BYTES = 1024 \* 1024/);
  const apply = chat.slice(chat.indexOf('function applyDictationText'), chat.indexOf('function setListening'));
  assert.match(apply, /input\.value/);
  assert.doesNotMatch(apply, /submit|\/v1\/assistant/);
  const upload = chat.slice(chat.indexOf('async function uploadDictation'), chat.indexOf('function startBrowser'));
  assert.match(upload, /\/v1\/assistant\/transcribe/);
  assert.doesNotMatch(upload, /requestSubmit|form\.submit|\/v1\/assistant['"`]/);
  const css = readFileSync(new URL('../assistant-chat.css', import.meta.url), 'utf8');
  assert.match(css, /\.bc-mic\{[^}]*min-width:44px;min-height:44px/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\{\.bc-mic\.listening\{animation:none\}\}/);
  assert.match(css, /bc-mic-pulse/);
});

test('dictation labels exist in all 23 languages and privacy names the browser provider and Whisper', () => {
  const chat = readFileSync(new URL('../assistant-chat.js', import.meta.url), 'utf8');
  const ui = new Function(`return ${chat.match(/const UI = (\{[\s\S]*?\n  \});/)[1]}`)();
  for (const key of ['mic', 'listening', 'micDenied', 'micFailed', 'micTooBig']) {
    for (const lang of ALL_23) {
      assert.ok(ui[key][lang] && ui[key][lang].trim(), `${key}.${lang}`);
    }
  }
  for (const key of ['voiceTooLong', 'voiceFailed']) {
    for (const lang of ALL_23) assert.ok(TG_TEXT[key][lang] && TG_TEXT[key][lang].trim(), `${key}.${lang}`);
  }
  const privacy = readFileSync(new URL('../privacy.html', import.meta.url), 'utf8');
  assert.match(privacy, /Google/);
  assert.match(privacy, /@cf\/openai\/whisper-large-v3-turbo/);
  assert.match(privacy, /saklanmaz/);
  assert.match(privacy, /not stored/);
  assert.match(privacy, /60 saniye/);
});

test('transcribe requires a chat session, rejects over 1 MB, and does not store or log audio', async (t) => {
  const logs = [];
  t.mock.method(console, 'error', (...args) => { logs.push(JSON.stringify(args)); });
  t.mock.method(console, 'log', (...args) => { logs.push(JSON.stringify(args)); });
  const binds = [];
  let aiCalls = 0;
  const aiEnv = env({
    AI: {
      run: async (model, opts) => {
        aiCalls += 1;
        assert.equal(model, WHISPER_MODEL);
        assert.equal(opts.language, 'tr');
        assert.equal(opts.task, 'transcribe');
        assert.equal(typeof opts.audio, 'string');
        assert.deepEqual(decodeAudio(opts.audio), [1, 2, 3, 4, 5, 6, 7, 8]);
        return { text: PHRASE };
      },
    },
    DB: {
      prepare: (sql) => ({
        bind: (...args) => ({
          first: async () => null,
          run: async () => { binds.push([sql, args]); return { success: true }; },
        }),
      }),
    },
  });
  const token = await sessionToken();
  const ok = await worker.fetch(new Request(`${ORIGIN}/v1/assistant/transcribe?lang=tr`, {
    method: 'POST',
    headers: { Origin: ORIGIN, Authorization: `Bearer ${token}`, 'Content-Type': 'audio/webm', 'CF-Connecting-IP': IP },
    body: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
  }), aiEnv);
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { text: PHRASE });
  assert.equal(aiCalls, 1);
  assert.equal((await worker.fetch(new Request(`${ORIGIN}/v1/assistant/transcribe?lang=tr`, {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'audio/webm', 'CF-Connecting-IP': IP },
    body: new Uint8Array([1, 2, 3]),
  }), aiEnv)).status, 401);
  const otherIp = await worker.fetch(new Request(`${ORIGIN}/v1/assistant/transcribe?lang=tr`, {
    method: 'POST',
    headers: { Origin: ORIGIN, Authorization: `Bearer ${token}`, 'Content-Type': 'audio/webm', 'CF-Connecting-IP': '198.51.100.8' },
    body: new Uint8Array([1, 2, 3]),
  }), aiEnv);
  assert.equal(otherIp.status, 401);
  const expired = await createChatSessionToken(aiEnv.CODE_PEPPER, IP, Date.now() - 31 * 60 * 1000);
  assert.equal(await verifyChatSessionToken(aiEnv.CODE_PEPPER, expired, IP), false);
  aiCalls = 0;
  const tooBig = await worker.fetch(new Request(`${ORIGIN}/v1/assistant/transcribe?lang=en`, {
    method: 'POST',
    headers: { Origin: ORIGIN, Authorization: `Bearer ${token}`, 'Content-Type': 'audio/webm', 'CF-Connecting-IP': IP },
    body: new Uint8Array(TRANSCRIBE_MAX_BYTES + 1),
  }), aiEnv);
  assert.equal(tooBig.status, 413);
  assert.equal(aiCalls, 0);
  const dumped = JSON.stringify(logs) + JSON.stringify(binds);
  assert.equal(dumped.includes(PHRASE), false);
  assert.equal(dumped.includes('"audio"'), false);
});

test('telegram voice is transcribed and passed to Mimo; audio over 60s is refused and not stored', async (t) => {
  const pepper = 'pepper-dictation';
  const secret = await computeTelegramWebhookSecret(pepper);
  const binds = [];
  const fetches = [];
  const models = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    const u = String(url);
    fetches.push(u);
    if (u.includes('/getFile')) {
      return Response.json({ ok: true, result: { file_path: 'voice/a.oga', file_size: 32 } });
    }
    if (u.includes('/file/bot')) return new Response(new Uint8Array([9, 8, 7, 6]));
    if (u.includes('sendMessage')) return Response.json({ ok: true, sent: JSON.parse(init.body) });
    return Response.json({ ok: true });
  });
  const tgState = new Map();
  const blocks = new Map();
  const seenUsers = [];
  let nextVoiceText = 'Boğaz turu fiyatı nedir';
  const db = {
    prepare: (sql) => ({
      bind: (...args) => ({
        first: async () => {
          if (sql.includes('telegram_handoff_state')) return tgState.get(String(args[0])) || null;
          if (sql.includes('assistant_blocks')) return blocks.get(String(args[0])) || null;
          return null;
        },
        run: async () => {
          binds.push([sql, args.map((a) => (typeof a === 'string' ? a : typeof a))]);
          if (sql.includes('INSERT INTO telegram_handoff_state')) {
            tgState.set(String(args[0]), { pending_handoff: args[1], lang: args[2], context_json: args[3], updated_at: args[4] });
          }
          if (sql.includes('INSERT INTO assistant_blocks')) {
            blocks.set(String(args[0]), { blocked_until: args[1], strike_count: args[2] });
          }
          return { success: true };
        },
      }),
    }),
  };
  const ai = {
    run: async (model, opts) => {
      models.push(model);
      if (model === WHISPER_MODEL) {
        assert.equal(typeof opts.audio, 'string');
        assert.deepEqual(decodeAudio(opts.audio), [9, 8, 7, 6]);
        return { text: nextVoiceText };
      }
      const user = opts.messages[opts.messages.length - 1].content;
      seenUsers.push(user);
      return { response: JSON.stringify({ abuse: false, handoff: false, reply: 'IST transferi araç başı yaklaşık 60 euro.' }) };
    },
  };
  const base = env({ CODE_PEPPER: pepper, TELEGRAM_BOT_TOKEN: 'bot-tok', DB: db, AI: ai });
  const headers = { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': secret };
  const voice = await worker.fetch(new Request(`${ORIGIN}/v1/telegram/webhook`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message: {
        chat: { id: 4242, type: 'private' },
        from: { id: 4242, language_code: 'tr' },
        voice: { file_id: 'voice-file', duration: 12, mime_type: 'audio/ogg' },
      },
    }),
  }), base);
  assert.equal(voice.status, 200);
  assert.ok(models.includes(WHISPER_MODEL));
  assert.ok(models.includes('@cf/google/gemma-4-26b-a4b-it'));
  const sent = fetches.includes('https://api.telegram.org/botbot-tok/sendMessage') || fetches.some((u) => u.includes('sendMessage'));
  assert.equal(sent, true);
  const state = tgState.get('4242');
  assert.match(state.context_json, /Boğaz turu fiyatı nedir/);
  assert.equal(JSON.stringify(binds).includes('voice-file'), false);
  assert.equal(JSON.stringify(binds).includes('[9,8,7,6]'), false);

  models.length = 0;
  fetches.length = 0;
  const long = await worker.fetch(new Request(`${ORIGIN}/v1/telegram/webhook`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message: {
        chat: { id: 4242, type: 'private' },
        from: { id: 4242, language_code: 'tr' },
        voice: { file_id: 'too-long', duration: 61 },
      },
    }),
  }), base);
  assert.equal(long.status, 200);
  assert.deepEqual(models, []);
  assert.equal(fetches.some((u) => u.includes('getFile')), false);
  assert.equal(fetches.some((u) => u.includes('sendMessage')), true);

  nextVoiceText = 'kart numaram 4532123456789012';
  models.length = 0;
  seenUsers.length = 0;
  binds.length = 0;
  const card = await worker.fetch(new Request(`${ORIGIN}/v1/telegram/webhook`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message: {
        chat: { id: 5151, type: 'private' },
        from: { id: 5151, language_code: 'tr' },
        voice: { file_id: 'card-voice', duration: 8 },
      },
    }),
  }), base);
  assert.equal(card.status, 200);
  assert.equal(seenUsers.length, 1);
  assert.match(seenUsers[0], /\[CARD REDACTED\]/);
  assert.equal(seenUsers[0].includes('4532123456789012'), false);
  assert.match(tgState.get('5151').context_json, /\[CARD REDACTED\]/);
  assert.equal(JSON.stringify(binds).includes('4532123456789012'), false);

  nextVoiceText = 'aptal bot';
  models.length = 0;
  const abuse = await worker.fetch(new Request(`${ORIGIN}/v1/telegram/webhook`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message: {
        chat: { id: 6161, type: 'private' },
        from: { id: 6161, language_code: 'tr' },
        voice: { file_id: 'abuse-voice', duration: 4 },
      },
    }),
  }), base);
  assert.equal(abuse.status, 200);
  assert.deepEqual(await abuse.json(), { ok: true, closed: true });
  assert.deepEqual(models, [WHISPER_MODEL]);

  models.length = 0;
  fetches.length = 0;
  const afterBlock = await worker.fetch(new Request(`${ORIGIN}/v1/telegram/webhook`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message: {
        chat: { id: 6161, type: 'private' },
        from: { id: 6161, language_code: 'tr' },
        voice: { file_id: 'after-block', duration: 3 },
      },
    }),
  }), base);
  assert.equal(afterBlock.status, 200);
  assert.equal((await afterBlock.json()).blocked, true);
  assert.deepEqual(models, []);
  assert.equal(fetches.some((u) => u.includes('getFile')), false);
});

test('per-minute dictation limit returns 429 without calling Whisper again', async () => {
  let calls = 0;
  const aiEnv = env({
    AI: { run: async () => { calls += 1; return { text: 'merhaba' }; } },
  });
  const now = Date.UTC(2026, 10, 22, 12, 0, 0);
  for (let i = 0; i < 6; i++) {
    const res = await transcribeAudio({ env: aiEnv, audioBytes: new Uint8Array([1, 2, 3]), lang: 'tr', actorKey: 'limit-user', now });
    assert.equal(res.ok, true);
  }
  const blocked = await transcribeAudio({ env: aiEnv, audioBytes: new Uint8Array([1, 2, 3]), lang: 'tr', actorKey: 'limit-user', now });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.status, 429);
  assert.equal(calls, 6);
});

test('dictation passes AI Gateway option to Whisper and returns 429 on gateway limit without retrying', async () => {
  const seenOpts = [];
  const okEnv = env({
    AI: {
      run: async (_m, _inputs, opts) => {
        seenOpts.push(opts);
        return { text: 'boğaz turu' };
      },
    },
  });
  const okRes = await transcribeAudio({ env: okEnv, audioBytes: new Uint8Array([1, 2, 3]), lang: 'tr', actorKey: 'gw-whisper-ok' });
  assert.equal(okRes.ok, true);
  assert.deepEqual(seenOpts, [{ gateway: { id: 'mimo' } }]);

  let failCalls = 0;
  const errEnv = env({
    AI_GATEWAY_ID: 'mimo',
    AI: {
      run: async (_m, _inputs, opts) => {
        failCalls += 1;
        assert.deepEqual(opts, { gateway: { id: 'mimo' } });
        const err = new Error('AI Gateway 429 spend limit reached');
        err.status = 429;
        throw err;
      },
    },
  });
  const errRes = await transcribeAudio({ env: errEnv, audioBytes: new Uint8Array([1, 2, 3]), lang: 'tr', actorKey: 'gw-whisper-429' });
  assert.equal(failCalls, 1);
  assert.equal(errRes.ok, false);
  assert.equal(errRes.status, 429);
  assert.equal(errRes.error, 'gateway_limit');
});

