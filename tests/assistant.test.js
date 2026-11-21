import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../backend/worker.js';
import {
  ASSISTANT_MESSAGES,
  ASSISTANT_MODEL,
  SUPPORTED_LANGS,
  detectLanguage,
  isSmallTalk,
  redactSensitive,
  retrieveChunks,
  runAssistant,
  stripExternalLinks,
  stripFakeUrgency,
} from '../backend/assistant.js';
import { TG_TEXT, computeTelegramWebhookSecret } from '../backend/telegram.js';

const ORIGIN = 'https://bosphorly.com';
const ALL_23_LANGS = [
  'ar', 'az', 'bn', 'bs', 'de', 'en', 'es', 'fa', 'fr', 'he', 'hi', 'hr',
  'hu', 'id', 'it', 'ja', 'ko', 'nl', 'pt', 'ru', 'tr', 'uk', 'zh',
];

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

test('language detection prioritizes pageLang/telegramLang and switches on different script/alphabet', () => {
  assert.equal(detectLanguage({ message: 'Boğaz turu fiyatı nedir?' }), 'tr');
  assert.equal(detectLanguage({ message: 'Сколько стоит круиз по Босфору?', pageLang: 'en' }), 'ru');
  assert.equal(detectLanguage({ message: 'كم سعر جولة البوسفور؟', pageLang: 'en' }), 'ar');
  assert.equal(detectLanguage({ message: 'Привіт, як справи?', pageLang: 'en' }), 'uk');
  assert.equal(detectLanguage({ message: 'سلام، قیمت چطور است؟', pageLang: 'en' }), 'fa');
  assert.equal(detectLanguage({ message: 'Hello', telegramLang: 'xx-unknown', pageLang: 'zz' }), 'en');
  assert.equal(detectLanguage({ message: 'Hello', telegramLang: 'tr' }), 'tr');
  assert.equal(detectLanguage({ message: 'Hello', pageLang: 'de' }), 'de');
  assert.equal(detectLanguage({ message: 'Danke schön', pageLang: 'de' }), 'de');
  assert.equal(detectLanguage({ message: 'Hello', pageLang: 'fr', telegramLang: 'tr' }), 'fr');
});

test('small talk greetings in TR, EN, RU, AR return handoff=false in the guest language without calling AI', async () => {
  let aiCalled = false;
  const env = { AI: { run: async () => { aiCalled = true; return { response: '{}' }; } } };
  const cases = [
    { message: 'Merhaba', expectedLang: 'tr' },
    { message: 'Hello', pageLang: 'en', expectedLang: 'en' },
    { message: 'Привет', expectedLang: 'ru' },
    { message: 'مرحبا', expectedLang: 'ar' },
  ];
  for (const c of cases) {
    const res = await runAssistant({ ...c, env, actorKey: `smalltalk-${c.expectedLang}` });
    assert.equal(res.ok, true);
    assert.equal(res.handoff, false);
    assert.equal(res.lang, c.expectedLang);
    assert.ok(res.reply.length > 20);
  }
  assert.equal(aiCalled, false);
});

test('all 23 languages have complete static dictionaries and pass greeting small-talk flow', async () => {
  assert.equal(SUPPORTED_LANGS.size, 23);
  for (const lang of ALL_23_LANGS) assert.ok(SUPPORTED_LANGS.has(lang), lang);

  // Check backend/assistant.js ASSISTANT_MESSAGES
  for (const [key, map] of Object.entries(ASSISTANT_MESSAGES)) {
    for (const lang of ALL_23_LANGS) {
      assert.ok(typeof map[lang] === 'string' && map[lang].trim().length > 0, `ASSISTANT_MESSAGES.${key}.${lang}`);
    }
  }

  // Check backend/telegram.js TG_TEXT
  for (const [key, map] of Object.entries(TG_TEXT)) {
    for (const lang of ALL_23_LANGS) {
      assert.ok(typeof map[lang] === 'string' && map[lang].trim().length > 0, `TG_TEXT.${key}.${lang}`);
    }
  }

  // Check assistant-chat.js UI and config/api.js LABELS
  const chatJs = readFileSync(new URL('../assistant-chat.js', import.meta.url), 'utf8');
  const uiBlock = chatJs.match(/const UI = (\{[\s\S]*?\n  \});/)[1];
  const uiObj = new Function(`return ${uiBlock}`)();
  for (const [key, map] of Object.entries(uiObj)) {
    for (const lang of ALL_23_LANGS) {
      assert.ok(typeof map[lang] === 'string' && map[lang].trim().length > 0, `assistant-chat UI.${key}.${lang}`);
    }
  }
  const apiJs = readFileSync(new URL('../config/api.js', import.meta.url), 'utf8');
  const labelsMatch = apiJs.match(/const LABELS = (\{[^}]+\});/);
  const labelsObj = new Function(`return ${labelsMatch[1]}`)();
  for (const lang of ALL_23_LANGS) {
    assert.ok(typeof labelsObj[lang] === 'string' && labelsObj[lang].trim().length > 0, `config/api LABELS.${lang}`);
  }

  const GREETINGS = {
    ar: 'مرحبا', az: 'Salam', bn: 'হ্যালো', bs: 'Zdravo', de: 'Hallo', en: 'Hello', es: 'Hola',
    fa: 'سلام', fr: 'Bonjour', he: 'שלום', hi: 'नमस्ते', hr: 'Pozdrav', hu: 'Szia', id: 'Halo',
    it: 'Ciao', ja: 'こんにちは', ko: '안녕하세요', nl: 'Hallo', pt: 'Olá', ru: 'Привет',
    tr: 'Merhaba', uk: 'Вітаю', zh: '你好',
  };
  const THANKS = {
    ar: 'شكرا', az: 'Təşəkkür', bn: 'ধন্যবাদ', bs: 'Hvala', de: 'Danke', en: 'Thank you', es: 'Gracias',
    fa: 'ممنون', fr: 'Merci', he: 'תודה', hi: 'धन्यवाद', hr: 'Hvala', hu: 'Köszönöm', id: 'Terima kasih',
    it: 'Grazie', ja: 'ありがとう', ko: '감사합니다', nl: 'Bedankt', pt: 'Obrigado', ru: 'Спасибо',
    tr: 'Teşekkürler', uk: 'Дякую', zh: '谢谢',
  };
  const GOODBYES = {
    ar: 'مع السلامة', az: 'Görüşənədək', bn: 'বিদায়', bs: 'Doviđenja', de: 'Tschüss', en: 'Goodbye', es: 'Adiós',
    fa: 'خداحافظ', fr: 'Au revoir', he: 'להתראות', hi: 'अलविदा', hr: 'Doviđenja', hu: 'Viszlát', id: 'Sampai jumpa',
    it: 'Arrivederci', ja: 'さようなら', ko: '안녕히 가세요', nl: 'Tot ziens', pt: 'Tchau', ru: 'До свидания',
    tr: 'Görüşürüz', uk: 'До побачення', zh: '再见',
  };

  for (const lang of ALL_23_LANGS) {
    assert.equal(isSmallTalk(GREETINGS[lang]), true, `greeting smalltalk ${lang}`);
    assert.equal(isSmallTalk(THANKS[lang]), true, `thanks smalltalk ${lang}`);
    assert.equal(isSmallTalk(GOODBYES[lang]), true, `goodbye smalltalk ${lang}`);

    const res = await runAssistant({
      message: GREETINGS[lang],
      pageLang: lang,
      env: { AI: { run: async () => { throw new Error('AI should not be called for smalltalk'); } } },
      actorKey: `loop-23-${lang}`,
    });
    assert.equal(res.ok, true);
    assert.equal(res.handoff, false, `handoff=false for ${lang}`);
    assert.equal(res.lang, lang, `lang match for ${lang}`);
    assert.equal(res.reply, ASSISTANT_MESSAGES.greeting[lang]);
  }
});

test('general Istanbul question calls model even when chunks are sparse and returns handoff=false', async () => {
  let calledWith;
  const res = await runAssistant({
    message: "Ayasofya'yı ne zaman ziyaret etmeliyim?",
    pageLang: 'tr',
    env: {
      AI: {
        run: async (model, opts) => {
          calledWith = { model, opts };
          return {
            response: JSON.stringify({
              handoff: false,
              reply: 'Sabah erken saatler daha sakin olur; güncel ziyaret saatlerini ve bilet bilgisini resmî kaynaktan kontrol et. Dilersen Eski Şehir turumuza göz atabilirsin: https://bosphorly.com/booking.html?service=bb-oldcity&lang=tr',
            }),
          };
        },
      },
    },
    actorKey: 'test-hagia-1',
  });
  assert.ok(calledWith);
  assert.equal(calledWith.model, ASSISTANT_MODEL);
  assert.equal(res.handoff, false);
  assert.equal(res.lang, 'tr');
  assert.ok(res.reply.includes('https://bosphorly.com/booking.html?service=bb-oldcity&lang=tr'));

  // Empty retrieveChunks still invokes the model for general Istanbul tips
  let emptyChunksCalled = false;
  const generalRes = await runAssistant({
    message: 'İstanbul’da kahvaltı için ne önerirsin?',
    pageLang: 'tr',
    env: {
      AI: {
        run: async () => {
          emptyChunksCalled = true;
          return {
            response: JSON.stringify({
              handoff: false,
              reply: 'Beşiktaş veya Karaköy tarafında Boğaz havasında serpme kahvaltı keyifli olur. İstanbul’a hangi tarihlerde geliyorsun?',
            }),
          };
        },
      },
    },
    actorKey: 'test-general-empty',
  });
  assert.equal(emptyChunksCalled, true);
  assert.equal(generalRes.handoff, false);
});

test('refund/complaint/human requests offer handoff first, and escalate only after confirmation', async () => {
  const offer = await runAssistant({
    message: 'iade istiyorum',
    pageLang: 'tr',
    env: { AI: { run: async () => { throw new Error('should not call AI'); } } },
    actorKey: 'test-handoff-offer',
  });
  assert.equal(offer.ok, true);
  assert.equal(offer.handoff, false);
  assert.equal(offer.handoffOffer, true);
  assert.ok(offer.reply.includes('iletmemi ister misin'));

  const declined = await runAssistant({
    message: 'hayır',
    pageLang: 'tr',
    history: [
      { role: 'user', content: 'iade istiyorum' },
      { role: 'assistant', content: offer.reply },
    ],
    env: {},
    actorKey: 'test-handoff-offer',
  });
  assert.equal(declined.handoff, false);

  const confirmed = await runAssistant({
    message: 'evet',
    pageLang: 'tr',
    history: [
      { role: 'user', content: 'iade istiyorum' },
      { role: 'assistant', content: offer.reply },
    ],
    env: {},
    actorKey: 'test-handoff-offer',
  });
  assert.equal(confirmed.handoff, true);
  assert.ok(confirmed.reply.includes('e-posta'));
});

test('payment method question returns the exact required sentence while payment issue offers handoff', async () => {
  const res = await runAssistant({
    message: 'Ödemeyi nasıl yapabilirim?',
    pageLang: 'tr',
    env: {},
    actorKey: 'test-payment-1',
  });
  assert.equal(res.handoff, false);
  assert.ok(res.reply.includes('Ödeme yöntemi talebinden sonra seninle iletişime geçtiğimizde paylaşılır.'));

  const issue = await runAssistant({
    message: 'Ödeme sorunu yaşıyorum, kartım hata veriyor',
    pageLang: 'tr',
    env: {},
    actorKey: 'test-payment-issue',
  });
  assert.equal(issue.handoff, false);
  assert.equal(issue.handoffOffer, true);
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

test('external links and fake urgency phrases (son yer, only today, last seats) are stripped from output', async () => {
  const cleaned = stripExternalLinks('See https://evil.example.com/phish or https://bosphorly.com/prices.html for info.');
  assert.ok(!cleaned.includes('evil.example.com'));
  assert.ok(cleaned.includes('https://bosphorly.com/prices.html'));

  const deUrgent = stripFakeUrgency('Sadece bugün geçerli, son yer! Only today, last seats available. Book at https://bosphorly.com/booking.html?service=bb-morning&lang=en');
  assert.ok(!/son yer|sadece bugün|only today|last seats/i.test(deUrgent));
  assert.ok(deUrgent.includes('https://bosphorly.com/booking.html?service=bb-morning&lang=en'));

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
              reply: 'IST to Sultanahmet is €60. Only today, last seats! Check https://spam.example.org or https://bosphorly.com/index.html?lang=en#booking',
            }),
          };
        },
      },
    },
    actorKey: 'test-links-1',
  });
  assert.equal(res.handoff, false);
  assert.ok(!res.reply.includes('spam.example.org'));
  assert.ok(!/only today|last seats/i.test(res.reply));
  assert.ok(res.reply.includes('https://bosphorly.com/index.html?lang=en#booking'));
});

test('per-actor rate limit (6/min) and global daily limit work', async () => {
  const aiEnv = {
    ASSISTANT_DAILY_LIMIT: '100',
    AI: { run: async () => ({ response: JSON.stringify({ handoff: false, reply: 'IST is €60 https://bosphorly.com/index.html?lang=en#booking' }) }) },
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

test('AI error or empty/nonsensical output falls back silently to handoff and supports object/choices formats', async () => {
  assert.equal(ASSISTANT_MODEL, '@cf/zai-org/glm-4.7-flash');

  const res = await runAssistant({
    message: 'Bosphorus cruise schedule?',
    pageLang: 'en',
    env: { AI: { run: async () => { throw new Error('Workers AI down'); } } },
    actorKey: 'test-ai-err',
  });
  assert.equal(res.ok, true);
  assert.equal(res.handoff, true);
  assert.equal(res.fallback, true);

  for (const bad of ['', '   ', '...', '{}', 'null', { choices: [{ message: { content: '   ' } }] }, { response: '{"handoff":false,"reply":"..."}' }]) {
    const r = await runAssistant({
      message: 'Bosphorus cruise schedule?',
      pageLang: 'tr',
      env: { AI: { run: async () => (typeof bad === 'string' ? { response: bad } : bad) } },
      actorKey: `test-ai-bad-${Math.random()}`,
    });
    assert.equal(r.ok, true);
    assert.equal(r.handoff, true);
    assert.equal(r.fallback, true);
  }

  const choicesRes = await runAssistant({
    message: 'IST airport transfer price?',
    pageLang: 'en',
    env: {
      AI: {
        run: async () => ({
          choices: [{ message: { content: JSON.stringify({ handoff: false, reply: 'IST to Sultanahmet is €60. https://bosphorly.com/index.html?lang=en#booking' }) } }],
        }),
      },
    },
    actorKey: 'test-ai-choices',
  });
  assert.equal(choicesRes.ok, true);
  assert.equal(choicesRes.handoff, false);
  assert.ok(choicesRes.reply.includes('€60'));

  const objRes = await runAssistant({
    message: 'IST airport transfer price?',
    pageLang: 'en',
    env: {
      AI: {
        run: async () => ({
          response: { handoff: false, reply: 'IST to Sultanahmet is €60. https://bosphorly.com/index.html?lang=en#booking' },
        }),
      },
    },
    actorKey: 'test-ai-obj',
  });
  assert.equal(objRes.ok, true);
  assert.equal(objRes.handoff, false);
  assert.ok(objRes.reply.includes('€60'));

  const resultNestedRes = await runAssistant({
    message: 'SAW airport transfer price?',
    pageLang: 'en',
    env: {
      AI: {
        run: async () => ({
          result: { response: JSON.stringify({ handoff: false, reply: 'SAW to Sultanahmet is €65. https://bosphorly.com/index.html?lang=en#booking' }) },
        }),
      },
    },
    actorKey: 'test-ai-result-nested',
  });
  assert.equal(resultNestedRes.ok, true);
  assert.equal(resultNestedRes.handoff, false);
  assert.ok(resultNestedRes.reply.includes('€65'));
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

test('retrieveChunks covers transfers, discover places, routes, and themed tours', () => {
  const chunks = retrieveChunks('Sultanahmet airport transfer IST', 6);
  assert.ok(chunks.length >= 5 && chunks.length <= 8);
  assert.ok(chunks.every((c) => c.url.startsWith('https://bosphorly.com/')));

  const tourChunks = retrieveChunks('Jewish heritage Ottoman imperial Balat', 6);
  assert.ok(tourChunks.some((c) => c.id.startsWith('discover-tour-') || c.id.startsWith('place-')));

  const guideChunks = retrieveChunks('M11 metro T1 tram İstanbulkart', 6);
  assert.ok(guideChunks.some((c) => c.id === 'city-guide-getting-around'));
});

test('telegram webhook requires valid HMAC-SHA256(CODE_PEPPER, "tg-webhook") header (fail-closed)', async () => {
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

test('telegram webhook asks handoff confirmation then forwards linked member email without asking email or logging chat ID', async t => {
  const pepper = 'test-pepper-123';
  const secret = await computeTelegramWebhookSecret(pepper);
  let sentEmail;
  const tgReplies = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    if (String(url).includes('api.resend.com')) {
      sentEmail = JSON.parse(init.body);
      return Response.json({ id: 'e-tg-1' });
    }
    if (String(url).includes('api.telegram.org')) {
      tgReplies.push(JSON.parse(init.body));
      return Response.json({ ok: true });
    }
    return Response.json({ ok: true });
  });

  const tgState = new Map();
  const mockDb = {
    prepare: (sql) => ({
      bind: (...args) => ({
        first: async () => {
          if (sql.includes('member_identities') && args[0] === '998877') {
            return { email: 'linked-member@example.org' };
          }
          if (sql.includes('telegram_handoff_state')) {
            return tgState.get(args[0]) || null;
          }
          return null;
        },
        run: async () => {
          if (sql.includes('INSERT INTO telegram_handoff_state')) {
            tgState.set(args[0], {
              pending_handoff: args[1],
              lang: args[2],
              context_json: args[3],
              updated_at: args[4],
            });
          } else if (sql.includes('DELETE FROM telegram_handoff_state')) {
            tgState.delete(args[0]);
          }
          return { success: true };
        },
      }),
    }),
  };

  const env = baseEnv({ CODE_PEPPER: pepper, TELEGRAM_BOT_TOKEN: 'bot-tok', DB: mockDb });

  // Turn 1: asks "Ekibimize iletmemi ister misin?"
  const req1 = new Request(`${ORIGIN}/v1/telegram/webhook`, {
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
  const res1 = await worker.fetch(req1, env);
  assert.equal(res1.status, 200);
  assert.equal(sentEmail, undefined);
  assert.ok(tgReplies[0].text.includes('iletmemi ister misin'));

  // Turn 2: guest says "evet" -> linked member forwards immediately without asking for email
  const req2 = new Request(`${ORIGIN}/v1/telegram/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': secret },
    body: JSON.stringify({
      message: {
        chat: { id: 998877, type: 'private' },
        from: { id: 998877, username: 'eren_guest', language_code: 'tr' },
        text: 'evet',
      },
    }),
  });
  const res2 = await worker.fetch(req2, env);
  assert.equal(res2.status, 200);
  assert.ok(sentEmail, 'email should be forwarded immediately for linked member after confirmation');
  assert.equal(sentEmail.reply_to, 'linked-member@example.org');
  assert.ok(sentEmail.text.includes('Telegram: @eren_guest'));
  assert.ok(!sentEmail.text.includes('Telegram chat ID'));
  assert.ok(tgReplies[1] && tgReplies[1].text.includes('info@bosphorly.com'));
});
