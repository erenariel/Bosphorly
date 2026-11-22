import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import worker from '../backend/worker.js';
import {
  ASSISTANT_MESSAGES,
  ASSISTANT_MODEL,
  SUPPORTED_LANGS,
  TIME_GREETINGS,
  capEmojis,
  detectLanguage,
  extractGuestName,
  getIstanbulGreeting,
  hashActorKey,
  isAbuseAgainstMimo,
  isAiIdentityQuestion,
  isServiceComplaint,
  isSmallTalk,
  redactSensitive,
  retrieveChunks,
  runAssistant,
  stripExternalLinks,
  stripFakeUrgency,
} from '../backend/assistant.js';
import { TG_TEXT, computeTelegramWebhookSecret, handleTelegramWebhook } from '../backend/telegram.js';

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

  // Check backend/assistant.js ASSISTANT_MESSAGES and TIME_GREETINGS
  for (const [key, map] of Object.entries(ASSISTANT_MESSAGES)) {
    for (const lang of ALL_23_LANGS) {
      assert.ok(typeof map[lang] === 'string' && map[lang].trim().length > 0, `ASSISTANT_MESSAGES.${key}.${lang}`);
    }
  }
  for (const lang of ALL_23_LANGS) {
    assert.ok(ASSISTANT_MESSAGES.greeting[lang].includes('Mimo'), `greeting includes Mimo in ${lang}`);
    assert.ok(ASSISTANT_MESSAGES.aiIdentity[lang].includes('Mimo'), `aiIdentity includes Mimo in ${lang}`);
    for (const slot of ['morning', 'afternoon', 'evening']) {
      assert.ok(typeof TIME_GREETINGS[slot][lang] === 'string' && TIME_GREETINGS[slot][lang].trim().length > 0, `TIME_GREETINGS.${slot}.${lang}`);
    }
  }

  // Check backend/telegram.js TG_TEXT (Mimo personality + wave emoji 🌊, never 🕊)
  assert.ok(TG_TEXT.welcome.tr.startsWith('Merhaba, ben Mimo 🌊'));
  for (const [key, map] of Object.entries(TG_TEXT)) {
    for (const lang of ALL_23_LANGS) {
      assert.ok(typeof map[lang] === 'string' && map[lang].trim().length > 0, `TG_TEXT.${key}.${lang}`);
    }
  }
  for (const lang of ALL_23_LANGS) {
    assert.ok(TG_TEXT.welcome[lang].includes('Mimo'), `TG_TEXT.welcome.${lang} includes Mimo`);
    assert.ok(TG_TEXT.welcome[lang].includes('🌊'), `TG_TEXT.welcome.${lang} includes wave emoji`);
    assert.ok(!TG_TEXT.welcome[lang].includes('🕊'), `TG_TEXT.welcome.${lang} must not use dove emoji`);
  }

  // Check assistant-chat.js UI and config/api.js LABELS & BUBBLE_GREET
  const chatJs = readFileSync(new URL('../assistant-chat.js', import.meta.url), 'utf8');
  assert.ok(!chatJs.includes('Bosphorly Asistan'), 'assistant-chat.js replaces Bosphorly Asistan with Mimo');
  const uiBlock = chatJs.match(/const UI = (\{[\s\S]*?\n  \});/)[1];
  const uiObj = new Function(`return ${uiBlock}`)();
  for (const [key, map] of Object.entries(uiObj)) {
    for (const lang of ALL_23_LANGS) {
      assert.ok(typeof map[lang] === 'string' && map[lang].trim().length > 0, `assistant-chat UI.${key}.${lang}`);
    }
  }
  assert.equal(uiObj.title.tr, 'Mimo · İstanbul asistanın');
  for (const lang of ALL_23_LANGS) {
    assert.ok(uiObj.title[lang].includes('Mimo'), `UI.title.${lang} includes Mimo`);
  }
  const apiJs = readFileSync(new URL('../config/api.js', import.meta.url), 'utf8');
  const labelsMatch = apiJs.match(/const LABELS = (\{[^}]+\});/);
  const labelsObj = new Function(`return ${labelsMatch[1]}`)();
  const bubbleMatch = apiJs.match(/const BUBBLE_GREET = (\{[^}]+\});/);
  const bubbleObj = new Function(`return ${bubbleMatch[1]}`)();
  for (const lang of ALL_23_LANGS) {
    assert.ok(typeof labelsObj[lang] === 'string' && labelsObj[lang].trim().length > 0, `config/api LABELS.${lang}`);
    assert.ok(typeof bubbleObj[lang] === 'string' && bubbleObj[lang].includes('Mimo'), `config/api BUBBLE_GREET.${lang}`);
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

    const fixedNow = Date.UTC(2026, 5, 15, 6, 30, 0); // 09:30 in Europe/Istanbul (morning)
    const res = await runAssistant({
      message: GREETINGS[lang],
      pageLang: lang,
      env: { AI: { run: async () => { throw new Error('AI should not be called for smalltalk'); } } },
      actorKey: `loop-23-${lang}`,
      now: fixedNow,
    });
    assert.equal(res.ok, true);
    assert.equal(res.handoff, false, `handoff=false for ${lang}`);
    assert.equal(res.lang, lang, `lang match for ${lang}`);
    assert.ok(res.reply.includes(TIME_GREETINGS.morning[lang]), `morning greeting in ${lang}`);
    assert.ok(res.reply.includes(ASSISTANT_MESSAGES.greeting[lang]), `Mimo greeting in ${lang}`);
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


test('telegram-cta builds https://t.me/<bot>?start=<lang> for all 23 languages and hides when telegramBot is empty', () => {
  const ctaSrc = readFileSync(new URL('../telegram-cta.js', import.meta.url), 'utf8');
  const loadCta = (telegramBot) => {
    const win = { BOSPHORLY_API: { telegramBot } };
    const makeEl = (tag) => {
      const attrs = {};
      const children = [];
      return {
        tagName: tag.toUpperCase(),
        hidden: false,
        children,
        setAttribute(k, v) { attrs[k] = String(v); },
        getAttribute(k) { return attrs[k] ?? null; },
        removeAttribute(k) { delete attrs[k]; if (k === 'href') delete this.href; },
        querySelector(sel) {
          if (sel === 'img.tg-ico') return children.find((c) => c.tagName === 'IMG') || null;
          if (sel === 'span') return children.find((c) => c.tagName === 'SPAN') || null;
          return null;
        },
        replaceChildren(...nodes) { children.splice(0, children.length, ...nodes); },
      };
    };
    const doc = { currentScript: null, createElement: makeEl };
    new Function('window', 'document', ctaSrc)(win, doc);
    return { tg: win.BosphorlyTelegram, makeEl };
  };

  const { tg } = loadCta('BosphorlyBot');
  for (const [key, map] of Object.entries(tg.TEXT)) {
    for (const lang of ALL_23_LANGS) {
      assert.ok(typeof map[lang] === 'string' && map[lang].trim().length > 0, `telegram-cta TEXT.${key}.${lang}`);
    }
  }
  for (const lang of ALL_23_LANGS) {
    assert.equal(tg.url(lang), `https://t.me/BosphorlyBot?start=${lang}`);
  }
  assert.equal(tg.url('he-IL'), 'https://t.me/BosphorlyBot?start=he');
  assert.equal(tg.url('in'), 'https://t.me/BosphorlyBot?start=id');

  const { tg: tgAt } = loadCta('@BosphorlyBot');
  assert.equal(tgAt.url('tr'), 'https://t.me/BosphorlyBot?start=tr');

  for (const emptyVal of ['', '   ', null, undefined]) {
    const { tg: emptyTg, makeEl } = loadCta(emptyVal);
    assert.equal(emptyTg.url('he'), '');
    assert.equal(emptyTg.createLink({ key: 'ask', lang: 'he' }), null);
    const el = makeEl('a');
    el.href = 'https://t.me/old';
    assert.equal(emptyTg.fillLink(el, { key: 'ask', lang: 'he' }), false);
    assert.equal(el.hidden, true);
    assert.equal(el.href, undefined);
  }
});

test('telegram webhook /start <lang> sends welcome in payload lang, saves chat lang, and falls back to language_code', async t => {
  const pepper = 'test-pepper-123';
  const secret = await computeTelegramWebhookSecret(pepper);
  const tgReplies = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
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
          if (sql.includes('telegram_handoff_state')) return tgState.get(args[0]) || null;
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

  // 1. /start he overrides language_code ("en") and saves "he" for chat 111
  const resHe = await worker.fetch(new Request(`${ORIGIN}/v1/telegram/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': secret },
    body: JSON.stringify({
      message: { chat: { id: 111, type: 'private' }, from: { id: 111, language_code: 'en' }, text: '/start he' },
    }),
  }), env);
  assert.equal(resHe.status, 200);
  assert.equal(tgReplies[0].text, TG_TEXT.welcome.he);
  assert.equal(tgState.get('111')?.lang, 'he');

  // Subsequent Latin smalltalk in chat 111 uses saved "he" language instead of language_code "en"
  const resFollow = await worker.fetch(new Request(`${ORIGIN}/v1/telegram/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': secret },
    body: JSON.stringify({
      message: { chat: { id: 111, type: 'private' }, from: { id: 111, language_code: 'en' }, text: 'Hello' },
    }),
  }), env);
  assert.equal(resFollow.status, 200);
  assert.ok(tgReplies[1].text.includes(ASSISTANT_MESSAGES.greeting.he), 'saved /start language is used for the next message');

  // 2. /start without payload uses from.language_code ("tr") and saves "tr"
  const resTr = await worker.fetch(new Request(`${ORIGIN}/v1/telegram/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': secret },
    body: JSON.stringify({
      message: { chat: { id: 222, type: 'private' }, from: { id: 222, language_code: 'tr' }, text: '/start' },
    }),
  }), env);
  assert.equal(resTr.status, 200);
  assert.equal(tgReplies[2].text, TG_TEXT.welcome.tr);
  assert.equal(tgState.get('222')?.lang, 'tr');

  // 3. /start without payload and without language_code falls back to "en"
  const resEn = await worker.fetch(new Request(`${ORIGIN}/v1/telegram/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': secret },
    body: JSON.stringify({
      message: { chat: { id: 333, type: 'private' }, from: { id: 333 }, text: '/start' },
    }),
  }), env);
  assert.equal(resEn.status, 200);
  assert.equal(tgReplies[3].text, TG_TEXT.welcome.en);
  assert.equal(tgState.get('333')?.lang, 'en');
});


test('Mimo mascot SVG files (default, hello, thinking, happy) exist under assets/brand/mimo/ and are < 4 KB each', () => {
  const states = ['mimo-default.svg', 'mimo-hello.svg', 'mimo-thinking.svg', 'mimo-happy.svg'];
  for (const file of states) {
    const url = new URL(`../assets/brand/mimo/${file}`, import.meta.url);
    const st = statSync(url);
    assert.ok(st.size > 200 && st.size < 4096, `${file} must be < 4 KB (actual: ${st.size} bytes)`);
    const svg = readFileSync(url, 'utf8');
    assert.ok(svg.includes('<svg') && svg.includes('#0a1753'), `${file} uses Bosphorly navy #0a1753`);
  }
});

test('"Sen insan mısın?" returns a response stating Mimo is an AI assistant (mock and fallback)', async () => {
  assert.equal(isAiIdentityQuestion('Sen insan mısın?'), true);
  assert.equal(isAiIdentityQuestion('Are you human?'), true);
  assert.equal(isAiIdentityQuestion('Are you a real person?'), true);

  let systemPromptSawMimo = false;
  const mockedRes = await runAssistant({
    message: 'Sen insan mısın?',
    pageLang: 'tr',
    env: {
      AI: {
        run: async (_model, opts) => {
          const sys = opts.messages.find((m) => m.role === 'system').content;
          systemPromptSawMimo = sys.includes("Bosphorly'nin yapay zekâ asistanı Mimo") && sys.includes('NEVER claim to be human');
          return {
            response: JSON.stringify({
              handoff: false,
              reply: 'Hayır, insan değilim; ben Bosphorly’nin yapay zekâ asistanı Mimo’yum! 🌊 Sana İstanbul’da nasıl yardımcı olabilirim?',
            }),
          };
        },
      },
    },
    actorKey: 'test-ai-identity-mock',
  });
  assert.equal(systemPromptSawMimo, true);
  assert.equal(mockedRes.ok, true);
  assert.equal(mockedRes.handoff, false);
  assert.ok(/yapay zek[aâ]/i.test(mockedRes.reply));
  assert.ok(mockedRes.reply.includes('Mimo'));

  // Without AI or on empty model response, deterministic fallback also clearly identifies Mimo as AI
  const fallbackRes = await runAssistant({
    message: 'Sen insan mısın?',
    pageLang: 'tr',
    env: {},
    actorKey: 'test-ai-identity-fallback',
  });
  assert.equal(fallbackRes.ok, true);
  assert.equal(fallbackRes.handoff, false);
  assert.ok(/yapay zek[aâ]/i.test(fallbackRes.reply));
  assert.ok(fallbackRes.reply.includes('Mimo'));
});

test('Mimo addresses guest by name from conversation history without storing name on server, and caps emojis to 2', async () => {
  assert.equal(extractGuestName([{ role: 'user', content: 'Merhaba, benim adım Deniz' }], 'Boğaz turu var mı?'), 'Deniz');
  assert.equal(capEmojis('Harika! 🌊⛵🛁🗺️✨', 2), 'Harika! 🌊⛵');

  const res = await runAssistant({
    message: 'Boğaz turu fiyatları nedir?',
    pageLang: 'tr',
    history: [
      { role: 'user', content: 'Merhaba, benim adım Deniz' },
      { role: 'assistant', content: 'Merhaba Deniz!' },
    ],
    env: {
      AI: {
        run: async (_model, opts) => {
          const sys = opts.messages.find((m) => m.role === 'system').content;
          assert.ok(sys.includes('Deniz'));
          return {
            response: JSON.stringify({
              handoff: false,
              reply: 'Sabah Boğaz turu yaklaşık €15 civarındadır 🌊⛵✨🎉',
            }),
          };
        },
      },
    },
    actorKey: 'test-guest-name',
  });
  assert.equal(res.handoff, false);
  assert.ok(res.reply.includes('Deniz'));
  const emojiMatches = res.reply.match(/\p{Extended_Pictographic}/gu) || [];
  assert.ok(emojiMatches.length <= 2, `Expected <= 2 emojis, got ${emojiMatches.length}`);

  // Time-of-day greetings in Istanbul time (UTC+3)
  const morningTs = Date.UTC(2026, 5, 15, 6, 0, 0);   // 09:00 Istanbul
  const afternoonTs = Date.UTC(2026, 5, 15, 11, 0, 0); // 14:00 Istanbul
  const eveningTs = Date.UTC(2026, 5, 15, 18, 0, 0);   // 21:00 Istanbul
  assert.equal(getIstanbulGreeting('tr', morningTs), 'Günaydın');
  assert.equal(getIstanbulGreeting('tr', afternoonTs), 'İyi günler');
  assert.equal(getIstanbulGreeting('tr', eveningTs), 'İyi akşamlar');
});

test('👍/👎 feedback endpoint (/v1/assistant/feedback) stores only vote & language counter in D1 and rejects message content', async () => {
  const feedbackCounts = new Map();
  const mockDb = {
    prepare: (sql) => ({
      bind: (...args) => ({
        run: async () => {
          if (sql.includes('INSERT INTO assistant_feedback')) {
            const k = `${args[0]}:${args[1]}`;
            feedbackCounts.set(k, (feedbackCounts.get(k) || 0) + 1);
          }
          return { success: true };
        },
        first: async () => {
          if (sql.includes('SELECT count FROM assistant_feedback')) {
            const k = `${args[0]}:${args[1]}`;
            return { count: feedbackCounts.get(k) || 0 };
          }
          return null;
        },
      }),
    }),
  };

  const env = baseEnv({ DB: mockDb });

  // Valid 👍 request with ONLY vote and lang
  const reqUp = new Request(`${ORIGIN}/v1/assistant/feedback`, {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ vote: 'up', lang: 'tr' }),
  });
  const resUp = await worker.fetch(reqUp, env);
  assert.equal(resUp.status, 200);
  const dataUp = await resUp.json();
  assert.deepEqual(dataUp, { ok: true, lang: 'tr', vote: 'up', count: 1 });
  assert.equal(feedbackCounts.get('tr:up'), 1);

  // Second 👍 increments counter in D1
  const resUp2 = await worker.fetch(new Request(`${ORIGIN}/v1/assistant/feedback`, {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ vote: 'up', lang: 'tr' }),
  }), env);
  assert.equal((await resUp2.json()).count, 2);

  // Any request that includes message content or history is rejected with 400
  for (const forbiddenBody of [
    { vote: 'up', lang: 'tr', message: 'secret chat text' },
    { vote: 'down', lang: 'en', content: 'assistant reply text' },
    { vote: 'up', lang: 'tr', history: [{ role: 'user', content: 'hi' }] },
  ]) {
    const badReq = new Request(`${ORIGIN}/v1/assistant/feedback`, {
      method: 'POST',
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
      body: JSON.stringify(forbiddenBody),
    });
    const badRes = await worker.fetch(badReq, env);
    assert.equal(badRes.status, 400);
  }
});

test('23 languages include abuseClose & kindNote, Telegram /start includes kindNote, and privacy/FAQ include Mimo policy sentence', () => {
  for (const lang of ALL_23_LANGS) {
    assert.ok(typeof ASSISTANT_MESSAGES.abuseClose[lang] === 'string' && ASSISTANT_MESSAGES.abuseClose[lang].includes('info@bosphorly.com'), `abuseClose in ${lang}`);
    assert.ok(typeof ASSISTANT_MESSAGES.kindNote[lang] === 'string' && ASSISTANT_MESSAGES.kindNote[lang].includes('💙'), `kindNote in ${lang}`);
    assert.ok(TG_TEXT.welcome[lang].includes(ASSISTANT_MESSAGES.kindNote[lang]), `TG_TEXT.welcome.${lang} includes kindNote`);
  }

  const privacyHtml = readFileSync(new URL('../privacy.html', import.meta.url), 'utf8');
  assert.ok(privacyHtml.includes("Asistanımız Mimo'ya karşı saygısız dil kullanıldığında sohbet otomatik olarak sonlandırılır."));
  assert.ok(privacyHtml.includes('If disrespectful language is used toward our assistant Mimo, the chat is automatically ended.'));

  const faqHtml = readFileSync(new URL('../faq.html', import.meta.url), 'utf8');
  assert.ok(faqHtml.includes('If disrespectful language is used toward our assistant Mimo, the chat is automatically ended.'));

  const faqJson = JSON.parse(readFileSync(new URL('../data/faq.json', import.meta.url), 'utf8'));
  assert.ok(faqJson.tr.qa[8][1].includes("Asistanımız Mimo'ya karşı saygısız dil kullanıldığında sohbet otomatik olarak sonlandırılır."));
  assert.ok(faqJson.en.qa[8][1].includes('If disrespectful language is used toward our assistant Mimo, the chat is automatically ended.'));
  for (const lang of ALL_23_LANGS) {
    assert.ok(faqJson[lang].qa[8][1].includes('Mimo'), `data/faq.json ${lang} includes Mimo policy`);
  }
});

test('zero-tolerance abuse vs service complaint: insults & threats close immediately with hashed D1 block and no email forwarding, while service complaints offer handoff', async t => {
  let emailSent = false;
  t.mock.method(globalThis, 'fetch', async (url) => {
    if (String(url).includes('siteverify')) return Response.json({ success: true });
    if (String(url).includes('api.resend.com')) emailSent = true;
    return Response.json({ ok: true });
  });

  const blockRows = new Map();
  const mockDb = {
    prepare: (sql) => ({
      bind: (...args) => ({
        first: async () => {
          if (sql.includes('SELECT blocked_until') || sql.includes('SELECT strike_count')) {
            return blockRows.get(args[0]) || null;
          }
          return null;
        },
        run: async () => {
          if (sql.includes('INSERT INTO assistant_blocks')) {
            blockRows.set(args[0], {
              actor_hash: args[0],
              blocked_until: args[1],
              strike_count: args[2],
              updated_at: args[3],
            });
          }
          return { success: true };
        },
      }),
    }),
  };

  const now = Date.now();
  const pepper = 'pepper-zero-tol';
  const env = baseEnv({ CODE_PEPPER: pepper, DB: mockDb });

  // 1. Service complaints must NOT close chat; they route to handoffOffer
  for (const complaint of ['transfer gelmedi', 'berbat hizmet verdi acente']) {
    assert.equal(isAbuseAgainstMimo(complaint), false);
    assert.equal(isServiceComplaint(complaint), true);
    const compRes = await runAssistant({
      message: complaint,
      pageLang: 'tr',
      env: { ...env, AI: { run: async () => { throw new Error('AI should not run for handoff complaint'); } } },
      actorKey: 'ip:10.0.0.1',
      now,
    });
    assert.equal(Boolean(compRes.closed), false);
    assert.equal(compRes.handoffOffer, true);
  }

  // 2. Direct insult to Mimo -> immediate closure on 1st violation (no warning), stored only as hash in D1
  const insultText = 'Sen çok aptalsın işe yaramaz bot';
  assert.equal(isAbuseAgainstMimo(insultText), true);
  const insultRes = await runAssistant({
    message: insultText,
    pageLang: 'tr',
    env: { ...env, AI: { run: async () => { throw new Error('AI not needed on regex abuse'); } } },
    actorKeys: ['ip:203.0.113.55', 'sess:s_insult1'],
    now,
  });
  assert.equal(insultRes.closed, true);
  assert.equal(insultRes.status, 'closed');
  assert.equal(insultRes.handoff, false);
  assert.equal(insultRes.reply, ASSISTANT_MESSAGES.abuseClose.tr);
  assert.equal(emailSent, false);

  // Check D1 privacy: only SHA-256 hashes and expiry timestamp are stored, never raw IP, session ID, or insult text
  const ipHash = await hashActorKey('ip:203.0.113.55', pepper);
  const sessHash = await hashActorKey('sess:s_insult1', pepper);
  assert.ok(blockRows.has(ipHash));
  assert.ok(blockRows.has(sessHash));
  const serializedDb = JSON.stringify([...blockRows.entries()]);
  assert.ok(!serializedDb.includes('203.0.113.55'));
  assert.ok(!serializedDb.includes('s_insult1'));
  assert.ok(!serializedDb.includes('aptalsın'));
  assert.equal(blockRows.get(ipHash).blocked_until, now + 24 * 60 * 60 * 1000);

  // Subsequent request from same IP or session within 24h returns "closed"
  const webFollowReq = new Request(`${ORIGIN}/v1/assistant`, {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.55' },
    body: JSON.stringify({ message: 'Boğaz turu kaç euro?', lang: 'tr', turnstileToken: 'ok', sessionId: 's_insult1' }),
  });
  const webFollowRes = await worker.fetch(webFollowReq, env);
  assert.equal(webFollowRes.status, 200);
  const webFollowJson = await webFollowRes.json();
  assert.equal(webFollowJson.closed, true);
  assert.equal(webFollowJson.status, 'closed');
  assert.equal(emailSent, false);

  // 3. Threat -> immediate closure
  const threatText = 'I will kill you';
  assert.equal(isAbuseAgainstMimo(threatText), true);
  const threatRes = await runAssistant({
    message: threatText,
    pageLang: 'en',
    env: { ...env, AI: { run: async () => { throw new Error('AI not needed'); } } },
    actorKeys: ['ip:203.0.113.77'],
    now,
  });
  assert.equal(threatRes.closed, true);
  assert.equal(threatRes.status, 'closed');
  assert.equal(threatRes.reply, ASSISTANT_MESSAGES.abuseClose.en);

  // 4. Model classification "abuse": true also triggers immediate closure & block
  const modelAbuseRes = await runAssistant({
    message: 'Seninle uğraşamam, tamamen gereksiz bir şeysin',
    pageLang: 'tr',
    env: {
      ...env,
      AI: {
        run: async () => ({
          response: JSON.stringify({ abuse: true, handoff: false, reply: '' }),
        }),
      },
    },
    actorKeys: ['ip:203.0.113.88'],
    now,
  });
  assert.equal(modelAbuseRes.closed, true);
  assert.equal(modelAbuseRes.status, 'closed');
  const nextModelBlocked = await runAssistant({
    message: 'Merhaba',
    pageLang: 'tr',
    env,
    actorKeys: ['ip:203.0.113.88'],
    now: now + 60_000,
  });
  assert.equal(nextModelBlocked.closed, true);
  assert.equal(nextModelBlocked.status, 'closed');
});

test('Telegram zero-tolerance: blocks chat_id for 7 days on 1st violation, unblocks after expiry, and blocks 30 days on repeat violation', async t => {
  const pepper = 'tg-block-pepper';
  const secret = await computeTelegramWebhookSecret(pepper);
  const tgReplies = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    if (String(url).includes('api.telegram.org')) {
      tgReplies.push(JSON.parse(init.body));
    }
    return Response.json({ ok: true });
  });

  const blockRows = new Map();
  const tgState = new Map();
  const mockDb = {
    prepare: (sql) => ({
      bind: (...args) => ({
        first: async () => {
          if (sql.includes('assistant_blocks')) return blockRows.get(args[0]) || null;
          if (sql.includes('telegram_handoff_state')) return tgState.get(args[0]) || null;
          return null;
        },
        run: async () => {
          if (sql.includes('INSERT INTO assistant_blocks')) {
            blockRows.set(args[0], {
              actor_hash: args[0],
              blocked_until: args[1],
              strike_count: args[2],
              updated_at: args[3],
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
  const makeReq = (text) =>
    new Request(`${ORIGIN}/v1/telegram/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': secret },
      body: JSON.stringify({
        message: { chat: { id: 556677, type: 'private' }, from: { id: 556677, language_code: 'tr' }, text },
      }),
    });

  const t0 = 1_750_000_000_000;
  // 1st violation -> calm closing message sent once, chat_id hashed and blocked for 7 days
  const res1 = await handleTelegramWebhook(makeReq('Aptal bot kes sesini'), env, t0);
  assert.equal(res1.status, 200);
  assert.equal(tgReplies.length, 1);
  assert.equal(tgReplies[0].text, ASSISTANT_MESSAGES.abuseClose.tr);
  const tgHash = await hashActorKey('tg:556677', pepper);
  assert.ok(blockRows.has(tgHash));
  assert.equal(blockRows.get(tgHash).strike_count, 1);
  assert.equal(blockRows.get(tgHash).blocked_until, t0 + 7 * 24 * 60 * 60 * 1000);

  // Within 7 days -> no reply sent at all (even for /start)
  const resDuring = await handleTelegramWebhook(makeReq('Merhaba'), env, t0 + 3 * 24 * 60 * 60 * 1000);
  assert.equal(resDuring.status, 200);
  assert.equal(tgReplies.length, 1);

  // After 7 days expire -> unblocks and responds normally again
  const tAfter7 = t0 + 7 * 24 * 60 * 60 * 1000 + 5000;
  const resAfter = await handleTelegramWebhook(makeReq('Merhaba'), env, tAfter7);
  assert.equal(resAfter.status, 200);
  assert.equal(tgReplies.length, 2);
  assert.ok(tgReplies[1].text.includes('Mimo'));

  // Repeat violation -> blocked for 30 days
  const tRepeat = tAfter7 + 10_000;
  const resRepeat = await handleTelegramWebhook(makeReq('Sen gerizekalısın'), env, tRepeat);
  assert.equal(resRepeat.status, 200);
  assert.equal(tgReplies.length, 3);
  assert.equal(blockRows.get(tgHash).strike_count, 2);
  assert.equal(blockRows.get(tgHash).blocked_until, tRepeat + 30 * 24 * 60 * 60 * 1000);
});

