import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../backend/worker.js';
import {
  ASSISTANT_MODEL,
  detectLanguage,
  redactSensitive,
  retrieveChunks,
  runAssistant,
  stripExternalLinks,
} from '../backend/assistant.js';

const ORIGIN = 'https://bosphorly.com';

function baseEnv(extra = {}) {
  return {
    PUBLIC_ORIGIN: ORIGIN,
    RATE_LIMITER: { limit: async () => ({ success: true }) },
    TURNSTILE_SECRET: 'ts-secret',
    RESEND_API_KEY: 'resend-key',
    REQUEST_FROM_EMAIL: 'no-reply@bosphorly.com',
    ASSISTANT_DAILY_LIMIT: '1500',
    ...extra,
  };
}

test('language detection handles tr, ru, ar, and unknown -> en', () => {
  assert.equal(detectLanguage({ message: 'Boğaz turu fiyatı nedir?' }), 'tr');
  assert.equal(detectLanguage({ message: 'Сколько стоит круиз по Босфору?' }), 'ru');
  assert.equal(detectLanguage({ message: 'كم سعر جولة البوسفور؟' }), 'ar');
  assert.equal(detectLanguage({ message: 'Hello', telegramLang: 'xx-unknown', pageLang: 'zz' }), 'en');
  assert.equal(detectLanguage({ message: 'Hello', telegramLang: 'tr' }), 'tr');
  assert.equal(detectLanguage({ message: 'Hello', pageLang: 'de' }), 'de');
});

test('unknown information triggers handoff decision', async () => {
  const res = await runAssistant({
    message: 'xyzzy quantum unicorn telescope?',
    pageLang: 'tr',
    env: { AI: { run: async () => ({ response: '{"handoff":false,"reply":"should not run"}' }) } },
    actorKey: 'test-unknown-1',
  });
  assert.equal(res.handoff, true);
  assert.ok(res.reply.includes('bilmiyorum') || res.reply.includes('iletiyorum'));

  const resModel = await runAssistant({
    message: 'Bosphorus cruise',
    pageLang: 'en',
    env: {
      AI: {
        run: async () => ({
          response: JSON.stringify({ handoff: true, reply: 'I do not know this for sure, forwarding to our team.' }),
        }),
      },
    },
    actorKey: 'test-unknown-2',
  });
  assert.equal(resModel.handoff, true);
});

test('payment method question returns the exact required sentence', async () => {
  const res = await runAssistant({
    message: 'Ödemeyi nasıl yapabilirim?',
    pageLang: 'tr',
    env: {},
    actorKey: 'test-payment-1',
  });
  assert.equal(res.handoff, false);
  assert.ok(res.reply.includes('Ödeme yöntemi talebinden sonra seninle iletişime geçtiğimizde paylaşılır.'));
});

test('card numbers and passport numbers are redacted', () => {
  const r1 = redactSensitive('Kart numaram 4532 1234 5678 9012 lütfen çekin');
  assert.equal(r1.hadSensitive, true);
  assert.ok(!r1.text.includes('4532'));
  assert.ok(r1.text.includes('[CARD REDACTED]'));

  const r2 = redactSensitive('Pasaport no: U12345678');
  assert.equal(r2.hadSensitive, true);
  assert.ok(!r2.text.includes('U12345678'));
  assert.ok(r2.text.includes('[PASSPORT REDACTED]'));
});

test('external links are stripped while bosphorly.com links are preserved', async () => {
  const cleaned = stripExternalLinks('See https://evil.example.com/phish or https://bosphorly.com/prices.html for info.');
  assert.ok(!cleaned.includes('evil.example.com'));
  assert.ok(cleaned.includes('https://bosphorly.com/prices.html'));

  const res = await runAssistant({
    message: 'What is the airport transfer price to Sultanahmet?',
    pageLang: 'en',
    env: {
      AI: {
        run: async (model) => {
          assert.equal(model, ASSISTANT_MODEL);
          return {
            response: JSON.stringify({
              handoff: false,
              reply: 'IST to Sultanahmet is €60. Book at https://spam.example.org or https://bosphorly.com/booking.html',
            }),
          };
        },
      },
    },
    actorKey: 'test-links-1',
  });
  assert.equal(res.handoff, false);
  assert.ok(!res.reply.includes('spam.example.org'));
  assert.ok(res.reply.includes('https://bosphorly.com/booking.html'));
});

test('per-actor rate limit (6/min) and global daily limit work', async () => {
  const aiEnv = {
    ASSISTANT_DAILY_LIMIT: '100',
    AI: { run: async () => ({ response: JSON.stringify({ handoff: false, reply: 'IST is €60 https://bosphorly.com/booking.html' }) }) },
  };
  const now = 1_700_000_000_000;
  for (let i = 0; i < 6; i++) {
    const ok = await runAssistant({ message: 'IST transfer price?', pageLang: 'en', env: aiEnv, actorKey: 'ip:1.2.3.4', now });
    assert.equal(ok.ok, true);
  }
  const limited = await runAssistant({ message: 'IST transfer price?', pageLang: 'en', env: aiEnv, actorKey: 'ip:1.2.3.4', now });
  assert.equal(limited.ok, false);
  assert.equal(limited.status, 429);

  const busyEnv = { ...aiEnv, ASSISTANT_DAILY_LIMIT: '1' };
  const busy = await runAssistant({ message: 'IST transfer price?', pageLang: 'tr', env: busyEnv, actorKey: 'ip:9.9.9.9', now: now + 120000 });
  assert.equal(busy.busy, true);
  assert.equal(busy.handoff, true);
  assert.ok(busy.reply.includes('Şu an yoğunuz'));
});

test('invalid Turnstile token is rejected with 403 and CORS is restricted to PUBLIC_ORIGIN', async t => {
  t.mock.method(globalThis, 'fetch', async (url) => {
    assert.ok(String(url).includes('siteverify'));
    return Response.json({ success: false });
  });
  const req = new Request(`${ORIGIN}/v1/assistant`, {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'IST transfer?', lang: 'en', history: [], turnstileToken: 'bad-token' }),
  });
  const res = await worker.fetch(req, baseEnv());
  assert.equal(res.status, 403);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), ORIGIN);

  const badOrigin = new Request(`${ORIGIN}/v1/assistant`, {
    method: 'POST',
    headers: { Origin: 'https://other.example.com', 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'hi', turnstileToken: 'x' }),
  });
  assert.equal((await worker.fetch(badOrigin, baseEnv())).status, 403);
});

test('AI error falls back silently to handoff', async () => {
  const res = await runAssistant({
    message: 'Bosphorus cruise schedule?',
    pageLang: 'en',
    env: { AI: { run: async () => { throw new Error('Workers AI down'); } } },
    actorKey: 'test-ai-err',
  });
  assert.equal(res.ok, true);
  assert.equal(res.handoff, true);
  assert.equal(res.fallback, true);
});

test('assistant handoff forwards conversation to info@bosphorly.com with Reply-To', async t => {
  let sent;
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    if (String(url).includes('siteverify')) return Response.json({ success: true });
    assert.equal(url, 'https://api.resend.com/emails');
    sent = JSON.parse(init.body);
    return Response.json({ id: 'email-1' });
  });
  const req = new Request(`${ORIGIN}/v1/assistant/handoff`, {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'guest@example.org',
      lang: 'tr',
      history: [
        { role: 'user', content: 'Kartım 4532123456789012' },
        { role: 'assistant', content: 'Lütfen paylaşmayın' },
      ],
      turnstileToken: 'ok',
    }),
  });
  const res = await worker.fetch(req, baseEnv());
  assert.equal(res.status, 202);
  assert.deepEqual(sent.to, ['info@bosphorly.com']);
  assert.equal(sent.reply_to, 'guest@example.org');
  assert.ok(!sent.text.includes('4532123456789012'));
  assert.ok(sent.text.includes('[CARD REDACTED]'));
});

test('retrieveChunks returns 5-8 relevant chunks for Istanbul queries', () => {
  const chunks = retrieveChunks('Sultanahmet airport transfer IST', 6);
  assert.ok(chunks.length >= 5 && chunks.length <= 8);
  assert.ok(chunks.every((c) => c.url.startsWith('https://bosphorly.com/')));
});

test('telegram webhook requires valid HMAC-SHA256(CODE_PEPPER, "tg-webhook") header (fail-closed)', async () => {
  const { computeTelegramWebhookSecret } = await import('../backend/telegram.js');
  const pepper = 'test-pepper-123';
  const reqNoHeader = new Request(`${ORIGIN}/v1/telegram/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { chat: { id: 1, type: 'private' }, text: 'hi' } }),
  });
  assert.equal((await worker.fetch(reqNoHeader, baseEnv({ CODE_PEPPER: pepper }))).status, 401);
  assert.equal((await worker.fetch(reqNoHeader, baseEnv({ CODE_PEPPER: '' }))).status, 401);

  const reqWrong = new Request(`${ORIGIN}/v1/telegram/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': 'wrong' },
    body: JSON.stringify({ message: { chat: { id: 1, type: 'private' }, text: 'hi' } }),
  });
  assert.equal((await worker.fetch(reqWrong, baseEnv({ CODE_PEPPER: pepper }))).status, 401);

  const validSecret = await computeTelegramWebhookSecret(pepper);
  assert.equal(validSecret.length, 64);
});

test('telegram webhook ignores non-private chats with 200', async t => {
  const { computeTelegramWebhookSecret } = await import('../backend/telegram.js');
  const pepper = 'test-pepper-123';
  const secret = await computeTelegramWebhookSecret(pepper);
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url) => { calls.push(url); return Response.json({ ok: true }); });
  const req = new Request(`${ORIGIN}/v1/telegram/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': secret },
    body: JSON.stringify({ message: { chat: { id: -100123, type: 'group' }, from: { id: 42 }, text: 'hello group' } }),
  });
  const res = await worker.fetch(req, baseEnv({ CODE_PEPPER: pepper, TELEGRAM_BOT_TOKEN: 'bot-tok' }));
  assert.equal(res.status, 200);
  assert.deepEqual(calls, []);
});

test('telegram webhook uses linked member email without asking and omits Telegram chat ID from email', async t => {
  const { computeTelegramWebhookSecret } = await import('../backend/telegram.js');
  const pepper = 'test-pepper-123';
  const secret = await computeTelegramWebhookSecret(pepper);
  let sentEmail;
  let tgReply;
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    if (String(url).includes('api.resend.com')) {
      sentEmail = JSON.parse(init.body);
      return Response.json({ id: 'e-tg-1' });
    }
    if (String(url).includes('api.telegram.org')) {
      tgReply = JSON.parse(init.body);
      return Response.json({ ok: true });
    }
    return Response.json({ ok: true });
  });

  const mockDb = {
    prepare: (sql) => ({
      bind: (...args) => ({
        first: async () => {
          if (sql.includes('member_identities') && args[0] === '998877') {
            return { email: 'linked-member@example.org' };
          }
          return null;
        },
        run: async () => ({ success: true }),
      }),
    }),
  };

  const req = new Request(`${ORIGIN}/v1/telegram/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': secret },
    body: JSON.stringify({
      message: {
        chat: { id: 998877, type: 'private' },
        from: { id: 998877, username: 'eren_guest', language_code: 'tr' },
        text: 'insanla konuşmak istiyorum',
      },
    }),
  });
  const res = await worker.fetch(req, baseEnv({ CODE_PEPPER: pepper, TELEGRAM_BOT_TOKEN: 'bot-tok', DB: mockDb }));
  assert.equal(res.status, 200);
  assert.ok(sentEmail, 'email should be forwarded immediately for linked member');
  assert.equal(sentEmail.reply_to, 'linked-member@example.org');
  assert.ok(sentEmail.text.includes('Telegram: @eren_guest'));
  assert.ok(!sentEmail.text.includes('Telegram chat ID'));
  assert.ok(tgReply && tgReply.text.includes('info@bosphorly.com'));
});

