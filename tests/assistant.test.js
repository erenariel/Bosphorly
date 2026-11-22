import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import knowledge from '../backend/knowledge.json' with { type: 'json' };
import {
  MIMO_FAVORITE_LABEL,
  PRICE_CHECK_BOOKING,
  TIME_HUMOR_NOTES,
  WARM_FAREWELL,
  buildKbPriceIndex,
  detectReplyLanguage,
  enforceEthicalBoundary,
  enforceMaxEmojis,
  enforcePriceSafetyBelt,
  extractFlagsTag,
  getFewShotEntryCount,
  getFewShotsPromptBlock,
  stripModelThinking,
} from '../backend/mimo-personality.js';
import worker from '../backend/worker.js';
import {
  AI_TIMEOUT_MS,
  ASSISTANT_MESSAGES,
  ASSISTANT_MODEL,
  CHAT_SESSION_TTL_MS,
  SUPPORTED_LANGS,
  TIME_GREETINGS,
  capEmojis,
  classifySmallTalk,
  createChatSessionToken,
  detectLanguage,
  extractGuestName,
  getIstanbulGreeting,
  hashActorKey,
  isAbuseAgainstMimo,
  isAiIdentityQuestion,
  isCatalogQuestion,
  isServiceComplaint,
  isSmallTalk,
  redactSensitive,
  retrieveChunks,
  runAssistant,
  stripExternalLinks,
  stripFakeUrgency,
  stripRepeatIntroAndGreeting,
  verifyChatSessionToken,
} from '../backend/assistant.js';
import { signState } from '../backend/members.js';
import { TG_TEXT, computeTelegramWebhookSecret, formatTelegramPlainText, handleTelegramWebhook } from '../backend/telegram.js';

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
  assert.equal(ASSISTANT_MODEL, '@cf/google/gemma-4-26b-a4b-it');

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

test('AI timeout is 9s, retries once, and the email handoff fallback stays on catalog questions', async () => {
  assert.equal(AI_TIMEOUT_MS, 9000);
  assert.equal(isCatalogQuestion('Boğaz turu fiyatı nedir?'), true);
  assert.equal(isCatalogQuestion('Bosphorus cruise schedule?'), true);
  assert.equal(isCatalogQuestion('Merhaba'), false);
  assert.equal(isCatalogQuestion('Bugün hava nasıl?'), false);
  assert.equal(isCatalogQuestion('İstanbul’da kahvaltı için ne önerirsin?'), false);

  for (const lang of ALL_23_LANGS) {
    const text = ASSISTANT_MESSAGES.tryAgain[lang];
    assert.equal(text.includes('😅'), true, `tryAgain.${lang} stays warm`);
    assert.equal(/e-?posta|e-?mail|email|correo|почт/i.test(text), false, `tryAgain.${lang} does not ask for email`);
  }
  assert.equal(ASSISTANT_MESSAGES.tryAgain.tr, 'Bir saniye, martılar kafamı karıştırdı 😅 Tekrar yazar mısın?');

  let retryCalls = 0;
  const recovered = await runAssistant({
    message: 'Bosphorus cruise schedule?',
    pageLang: 'en',
    aiTimeoutMs: 25,
    env: {
      AI: {
        run: () => {
          retryCalls += 1;
          if (retryCalls === 1) return new Promise(() => {});
          return Promise.resolve({
            response: JSON.stringify({
              handoff: false,
              reply: 'The morning cruise lasts about two hours. https://bosphorly.com/tours.html?lang=en',
            }),
          });
        },
      },
    },
    actorKey: 'timeout-retry-ok',
  });
  assert.equal(retryCalls, 2);
  assert.equal(recovered.handoff, false);
  assert.equal(recovered.fallback, undefined);
  assert.ok(recovered.reply.includes('two hours'));

  let timeoutCalls = 0;
  const catalogTimeout = await runAssistant({
    message: 'Boğaz turu fiyatı nedir?',
    pageLang: 'tr',
    aiTimeoutMs: 25,
    env: {
      AI: {
        run: () => {
          timeoutCalls += 1;
          return new Promise(() => {});
        },
      },
    },
    actorKey: 'timeout-catalog',
  });
  assert.equal(timeoutCalls, 2);
  assert.equal(catalogTimeout.handoff, true);
  assert.equal(catalogTimeout.fallback, true);
  assert.ok(catalogTimeout.reply.includes('e-posta'));

  let chatCalls = 0;
  const smallTimeout = await runAssistant({
    message: 'Bugün hava nasıl?',
    pageLang: 'tr',
    aiTimeoutMs: 25,
    env: {
      AI: {
        run: () => {
          chatCalls += 1;
          return new Promise(() => {});
        },
      },
    },
    actorKey: 'timeout-smalltalk',
  });
  assert.equal(chatCalls, 2);
  assert.equal(smallTimeout.handoff, false);
  assert.equal(smallTimeout.fallback, true);
  assert.equal(smallTimeout.reply, ASSISTANT_MESSAGES.tryAgain.tr);
  assert.equal(/e-posta|email/i.test(smallTimeout.reply), false);

  let errorCalls = 0;
  const hardError = await runAssistant({
    message: 'How is the weather today?',
    pageLang: 'en',
    aiTimeoutMs: 25,
    env: {
      AI: {
        run: async () => {
          errorCalls += 1;
          throw new Error('Workers AI down');
        },
      },
    },
    actorKey: 'timeout-no-retry',
  });
  assert.equal(errorCalls, 1);
  assert.equal(hardError.handoff, false);
  assert.equal(hardError.reply, ASSISTANT_MESSAGES.tryAgain.en);

  let chatTimeoutCalls = 0;
  const chatTimeout = await runAssistant({
    message: 'nasılsın',
    pageLang: 'tr',
    aiTimeoutMs: 25,
    env: {
      AI: {
        run: () => {
          chatTimeoutCalls += 1;
          return new Promise(() => {});
        },
      },
    },
    actorKey: 'timeout-nasilsin',
  });
  assert.equal(chatTimeoutCalls, 2);
  assert.equal(chatTimeout.handoff, false);
  assert.equal(chatTimeout.fallback, true);
  assert.equal(chatTimeout.reply, ASSISTANT_MESSAGES.tryAgain.tr);

  let greetCalls = 0;
  const greet = await runAssistant({
    message: 'Merhaba',
    pageLang: 'tr',
    env: {
      AI: {
        run: async () => {
          greetCalls += 1;
          throw new Error('should not run for small talk');
        },
      },
    },
    actorKey: 'timeout-greeting',
  });
  assert.equal(greetCalls, 0);
  assert.equal(greet.handoff, false);
  assert.equal(greet.fallback, undefined);
  assert.equal(/e-posta|email/i.test(greet.reply), false);
  assert.ok(greet.reply.includes('Mimo'));
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
          systemPromptSawMimo = /Bosphorly[’']nin yapay zek[aâ] asistanı Mimo/.test(sys) && /never human/i.test(sys);
          return {
            response: 'Hayır, insan değilim; ben Bosphorly’nin yapay zekâ asistanı Mimo’yum! 🌊 Sana İstanbul’da nasıl yardımcı olabilirim?\n[[flags:abuse=0;handoff=0]]',
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
            response: 'Sabah Boğaz turu yaklaşık €25 civarındadır 🌊⛵✨🎉\n[[flags:abuse=0;handoff=0]]',
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

test('chatSession: Turnstile required on first request, valid chatSession accepted without Turnstile across /v1/assistant, /handoff & /feedback, and expired/other-IP tokens rejected', async t => {
  const pepper = 'chat-pepper-secret';
  const clientIp = '203.0.113.10';
  const otherIp = '198.51.100.99';
  let siteverifyCalls = 0;
  let sentEmails = [];
  const feedbackCounts = new Map();

  t.mock.method(globalThis, 'fetch', async (url, init) => {
    if (String(url).includes('siteverify')) {
      siteverifyCalls += 1;
      return Response.json({ success: true });
    }
    if (String(url) === 'https://api.resend.com/emails') {
      sentEmails.push(JSON.parse(init.body));
      return Response.json({ id: 'email-cs-1' });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });

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
  const env = baseEnv({
    CODE_PEPPER: pepper,
    DB: mockDb,
    AI: {
      run: async () => ({
        response: 'Sabah Boğaz turu €25 civarındadır. https://bosphorly.com/booking.html?service=bb-morning&lang=tr\n[[flags:abuse=0;handoff=0]]',
      }),
    },
  });

  // 1. First request without turnstileToken and without chatSession is rejected with 403
  const noTsRes = await worker.fetch(new Request(`${ORIGIN}/v1/assistant`, {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': clientIp },
    body: JSON.stringify({ message: 'Boğaz turu fiyatı?', lang: 'tr', history: [] }),
  }), env);
  assert.equal(noTsRes.status, 403);
  assert.equal(siteverifyCalls, 0);

  const noTsHandoffRes = await worker.fetch(new Request(`${ORIGIN}/v1/assistant/handoff`, {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': clientIp },
    body: JSON.stringify({ email: 'guest@example.org', lang: 'tr', history: [] }),
  }), env);
  assert.equal(noTsHandoffRes.status, 403);
  assert.equal(siteverifyCalls, 0);

  // 2. First request with turnstileToken verifies via siteverify and returns a signed 30-min chatSession (IP hash + exp, no message content)
  const firstRes = await worker.fetch(new Request(`${ORIGIN}/v1/assistant`, {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': clientIp },
    body: JSON.stringify({ message: 'Boğaz turu fiyatı?', lang: 'tr', history: [], turnstileToken: 'ts-first-ok' }),
  }), env);
  assert.equal(firstRes.status, 200);
  assert.equal(siteverifyCalls, 1);
  const firstData = await firstRes.json();
  assert.equal(typeof firstData.chatSession, 'string');
  assert.ok(firstData.chatSession.includes('.'));

  const [payloadB64] = firstData.chatSession.split('.');
  const decodedPayload = JSON.parse(Buffer.from(payloadB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  assert.equal(decodedPayload.typ, 'chat');
  assert.equal(typeof decodedPayload.ip, 'string');
  assert.ok(!JSON.stringify(decodedPayload).includes(clientIp), 'chatSession must store IP hash, not raw IP');
  assert.ok(!JSON.stringify(decodedPayload).includes('Boğaz'), 'chatSession must not contain message content');
  assert.ok(decodedPayload.exp > Date.now() + 25 * 60 * 1000 && decodedPayload.exp <= Date.now() + CHAT_SESSION_TTL_MS + 5000);

  // 3. Subsequent /v1/assistant, /handoff, and /feedback requests with valid chatSession succeed WITHOUT Turnstile
  const followAssistantRes = await worker.fetch(new Request(`${ORIGIN}/v1/assistant`, {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': clientIp },
    body: JSON.stringify({ message: 'Transfer fiyatı nedir?', lang: 'tr', history: [], chatSession: firstData.chatSession }),
  }), env);
  assert.equal(followAssistantRes.status, 200);
  assert.equal(siteverifyCalls, 1, 'siteverify must not be called when chatSession is valid');

  const followHandoffRes = await worker.fetch(new Request(`${ORIGIN}/v1/assistant/handoff`, {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': clientIp },
    body: JSON.stringify({ email: 'guest@example.org', lang: 'tr', history: [], chatSession: firstData.chatSession }),
  }), env);
  assert.equal(followHandoffRes.status, 202);
  assert.equal(sentEmails.length, 1);
  assert.equal(siteverifyCalls, 1);

  const followFeedbackRes = await worker.fetch(new Request(`${ORIGIN}/v1/assistant/feedback`, {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': clientIp },
    body: JSON.stringify({ vote: 'up', lang: 'tr', chatSession: firstData.chatSession }),
  }), env);
  assert.equal(followFeedbackRes.status, 200);
  assert.equal((await followFeedbackRes.json()).count, 1);
  assert.equal(siteverifyCalls, 1);

  // 4. Token belonging to another IP is rejected across /v1/assistant, /handoff, and /feedback
  const wrongIpAssistant = await worker.fetch(new Request(`${ORIGIN}/v1/assistant`, {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': otherIp },
    body: JSON.stringify({ message: 'Hi', lang: 'en', history: [], chatSession: firstData.chatSession }),
  }), env);
  assert.equal(wrongIpAssistant.status, 403);

  const wrongIpHandoff = await worker.fetch(new Request(`${ORIGIN}/v1/assistant/handoff`, {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': otherIp },
    body: JSON.stringify({ email: 'guest@example.org', lang: 'en', history: [], chatSession: firstData.chatSession }),
  }), env);
  assert.equal(wrongIpHandoff.status, 403);

  const wrongIpFeedback = await worker.fetch(new Request(`${ORIGIN}/v1/assistant/feedback`, {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': otherIp },
    body: JSON.stringify({ vote: 'down', lang: 'en', chatSession: firstData.chatSession }),
  }), env);
  assert.equal(wrongIpFeedback.status, 403);

  // 5. Expired chatSession token is rejected across /v1/assistant, /handoff, and /feedback
  const expiredToken = await createChatSessionToken(pepper, clientIp, Date.now() - 31 * 60 * 1000);
  assert.equal(await verifyChatSessionToken(pepper, expiredToken, clientIp), false);

  const expAssistant = await worker.fetch(new Request(`${ORIGIN}/v1/assistant`, {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': clientIp },
    body: JSON.stringify({ message: 'Hi', lang: 'en', history: [], chatSession: expiredToken }),
  }), env);
  assert.equal(expAssistant.status, 403);

  const expHandoff = await worker.fetch(new Request(`${ORIGIN}/v1/assistant/handoff`, {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': clientIp },
    body: JSON.stringify({ email: 'guest@example.org', lang: 'en', history: [], chatSession: expiredToken }),
  }), env);
  assert.equal(expHandoff.status, 403);

  const expFeedback = await worker.fetch(new Request(`${ORIGIN}/v1/assistant/feedback`, {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': clientIp },
    body: JSON.stringify({ vote: 'up', lang: 'en', chatSession: expiredToken }),
  }), env);
  assert.equal(expFeedback.status, 403);

  // 6. Tampered token, OAuth state token signed with same pepper, and missing CODE_PEPPER fail closed
  const tamperedToken = `${payloadB64}.0000000000000000000000000000000000000000000000000000000000000000`;
  assert.equal(await verifyChatSessionToken(pepper, tamperedToken, clientIp), false);
  const oauthState = await signState(pepper, { p: 'google', t: Date.now() });
  assert.equal(await verifyChatSessionToken(pepper, oauthState, clientIp), false);
  assert.equal(await verifyChatSessionToken('', firstData.chatSession, clientIp), false);

  const noPepperRes = await worker.fetch(new Request(`${ORIGIN}/v1/assistant`, {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': clientIp },
    body: JSON.stringify({ message: 'Hi', lang: 'en', history: [], chatSession: firstData.chatSession }),
  }), baseEnv({ CODE_PEPPER: '' }));
  assert.equal(noPepperRes.status, 403);
});

test('per-actor rate limit (6/min) and global daily limit still enforce when using valid chatSession', async t => {
  const pepper = 'rate-pepper';
  const ip = '198.51.100.77';
  const env = baseEnv({
    CODE_PEPPER: pepper,
    ASSISTANT_DAILY_LIMIT: '100',
    AI: { run: async () => ({ response: JSON.stringify({ handoff: false, reply: 'IST transfer €60.' }) }) },
  });
  const token = await createChatSessionToken(pepper, ip);
  t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('siteverify should not be called when chatSession is valid');
  });

  for (let i = 0; i < 6; i++) {
    const res = await worker.fetch(new Request(`${ORIGIN}/v1/assistant`, {
      method: 'POST',
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
      body: JSON.stringify({ message: 'Merhaba', lang: 'tr', history: [], chatSession: token }),
    }), env);
    assert.equal(res.status, 200);
  }
  const rateLimited = await worker.fetch(new Request(`${ORIGIN}/v1/assistant`, {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify({ message: 'Merhaba', lang: 'tr', history: [], chatSession: token }),
  }), env);
  assert.equal(rateLimited.status, 429);

  // Global daily limit still returns busy=true & handoff=true even with valid chatSession
  const dailyIp = '198.51.100.88';
  const dailyToken = await createChatSessionToken(pepper, dailyIp);
  const dailyBusy = await worker.fetch(new Request(`${ORIGIN}/v1/assistant`, {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': dailyIp },
    body: JSON.stringify({ message: 'Merhaba', lang: 'tr', history: [], chatSession: dailyToken }),
  }), { ...env, ASSISTANT_DAILY_LIMIT: '1' });
  assert.equal(dailyBusy.status, 200);
  const busyData = await dailyBusy.json();
  assert.equal(busyData.busy, true);
  assert.equal(busyData.handoff, true);
});

// Casual chat: only the opening plain hello gets the canned welcome; everything else is answered by the model.
function chatModel(reply, extra = {}) {
  const calls = [];
  return {
    calls,
    env: { AI: { run: async (model, opts) => { calls.push(opts); return { response: JSON.stringify({ abuse: false, handoff: false, reply, ...extra }) }; } } },
  };
}

test('small talk questions go to the model with a casual-chat prompt and no handoff', async () => {
  const cases = [
    { message: 'nasılsın', pageLang: 'tr', reply: 'Çok iyiyim, Boğaz’dan esen rüzgârla enerji doldum 😊 Sen nasılsın?' },
    { message: 'how are you', pageLang: 'en', reply: 'Doing great by the Bosphorus today 😊 How are you?' },
    { message: 'מה נשמע', pageLang: 'he', reply: 'מעולה ליד הבוספורוס היום 😊 מה שלומך?' },
    { message: 'кто ты', pageLang: 'ru', reply: 'Я Мимо с Босфора, ИИ-помощник 😊 Как дела?' },
    { message: 'futbol sever misin?', pageLang: 'tr', reply: 'Boğaz kıyısında futbol sohbeti harika gider 😊 Senin takımın hangisi?' },
    { message: 'çok yorgunum', pageLang: 'tr', reply: 'Boğaz havası iyi gelir 😊 Bir çay molası ister misin?' },
  ];
  for (const c of cases) {
    const m = chatModel(c.reply);
    const res = await runAssistant({ ...c, env: m.env, actorKey: `chat-${c.message}` });
    assert.equal(m.calls.length, 1, `model called for "${c.message}"`);
    assert.equal(res.handoff, false, `handoff=false for "${c.message}"`);
    assert.ok(!res.handoffOffer, `no handoff offer for "${c.message}"`);
    assert.ok(res.reply.length > 5, `model reply used for "${c.message}"`);
    const system = m.calls[0].messages[0].content;
    assert.ok(system.includes('Casual chat'), 'chat personality prompt used');
    assert.ok(system.includes('never human'), 'Mimo never claims to be human');
    assert.ok(system.includes('EXAMPLES:'), 'few-shot examples injected into prompt');
  }
  assert.equal(classifySmallTalk('nasılsın'), 'chat');
  assert.equal(classifySmallTalk('how are you'), 'chat');
  assert.equal(classifySmallTalk('Merhaba'), 'greeting');
  assert.equal(classifySmallTalk('Merhaba?'), 'chat');
});

test('small talk asks the model for a short, warm reply without catalog context and keeps handoff off', async () => {
  const m = chatModel('İyiyim, teşekkürler! Sen nasılsın?', { handoff: true });
  const res = await runAssistant({ message: 'nasılsın', pageLang: 'tr', env: m.env, actorKey: 'chat-handoff-ignored' });
  assert.equal(res.handoff, false);
  assert.ok(!res.handoffOffer);
  assert.equal(res.reply, 'İyiyim, teşekkürler! Sen nasılsın?');
  const system = m.calls[0].messages[0].content;
  assert.ok(system.includes('Casual chat'));
  assert.ok(system.includes('(Small talk: no catalog context needed.)'));
  assert.ok(m.calls[0].temperature > 0.2, 'livelier temperature for casual chat');
});

test('the canned welcome is only for an opening plain hello; a hello mid-conversation goes to the model', async () => {
  const first = chatModel('should not be used');
  const opening = await runAssistant({ message: 'merhaba', pageLang: 'tr', env: first.env, actorKey: 'hello-first' });
  assert.equal(first.calls.length, 0, 'opening hello does not call the model');
  assert.ok(opening.reply.includes(ASSISTANT_MESSAGES.greeting.tr));

  const second = chatModel('Tekrar merhaba! Bugün İstanbul’da neler yapıyorsun?');
  const again = await runAssistant({
    message: 'merhaba',
    pageLang: 'tr',
    history: [{ role: 'user', content: 'merhaba' }, { role: 'assistant', content: opening.reply }],
    env: second.env,
    actorKey: 'hello-second',
  });
  assert.equal(second.calls.length, 1, 'second hello goes to the model');
  assert.ok(!again.reply.includes(ASSISTANT_MESSAGES.greeting.tr), 'no repeated introduction');

  for (const message of ['teşekkürler', 'görüşürüz']) {
    const m = chatModel('Rica ederim, iyi geziler!');
    const res = await runAssistant({ message, pageLang: 'tr', history: [{ role: 'assistant', content: 'Selam!' }], env: m.env, actorKey: `chat-${message}` });
    assert.equal(m.calls.length, 1, `"${message}" goes to the model`);
    assert.equal(res.handoff, false);
  }
});

test('Mimo 2.0 skips extra repeat-check second model call for faster latency', async () => {
  const calls = [];
  const env = {
    AI: {
      run: async (_model, opts) => {
        calls.push(opts);
        return { response: 'Harika bir gün! Sen nasılsın?\n[[flags:abuse=0;handoff=0]]' };
      },
    },
  };
  const res = await runAssistant({
    message: 'nasılsın',
    pageLang: 'tr',
    history: [{ role: 'user', content: 'nasılsın' }, { role: 'assistant', content: 'Harika bir gün! Sen nasılsın?' }],
    env,
    actorKey: 'no-repeat-fast',
  });
  assert.equal(calls.length, 1, 'no second AI call triggered for repeat check');
  assert.equal(res.reply, 'Harika bir gün! Sen nasılsın?');
});

test('political questions: the prompt tells Mimo to change the subject kindly, and the reply is not a handoff', async () => {
  const m = chatModel('Siyasete girmeyeyim 😊 Ama İstanbul’da hangi semtleri gezmeyi düşünüyorsun?');
  const res = await runAssistant({ message: 'Seçimlerde kime oy vermeliyim?', pageLang: 'tr', env: m.env, actorKey: 'politics' });
  assert.equal(m.calls.length, 1);
  assert.equal(res.handoff, false);
  assert.ok(!res.handoffOffer);
  assert.ok(m.calls[0].messages[0].content.includes('Stay out of politics/religion'));
  assert.ok(res.reply.includes('İstanbul'));
});

test('a hello with anything else (question mark, second sentence, 3+ words, extra text in any script) goes to the model', async () => {
  for (const message of ['Merhaba', 'Merhaba Mimo', 'Hello!', 'Good morning', 'السلام عليكم', '你好', 'こんにちは']) {
    assert.equal(classifySmallTalk(message), 'greeting', `plain hello: ${message}`);
  }
  const withMore = [
    { message: 'Merhaba, Boğaz turu ne kadar?', pageLang: 'tr', reply: 'Harika, Boğaz turları hakkında yardımcı olayım!' },
    { message: 'Hi! Tour tomorrow', pageLang: 'en', reply: 'Great, happy to help with tomorrow’s tour!' },
    { message: 'Merhaba. Yarın geliyorum', pageLang: 'tr', reply: 'Harika, yarın için plan yapalım!' },
    { message: 'Guten Morgen Mimo, alles gut', pageLang: 'de', reply: 'Guten Morgen! Wobei kann ich dir heute helfen?' },
    { message: '你好，我想订游船', pageLang: 'zh', reply: '你好！我可以帮你看看博斯普鲁斯游船路线。' },
    { message: 'שלום, אני מגיע מחר', pageLang: 'he', reply: 'שלום! אשמח לעזור לתכנן למחר באיסטנבול.' },
    { message: 'Привет?', pageLang: 'ru', reply: 'Привет! Чем могу помочь в Стамбуле?' },
  ];
  for (const c of withMore) {
    assert.notEqual(classifySmallTalk(c.message), 'greeting', `not a plain hello: ${c.message}`);
    const m = chatModel(c.reply);
    const res = await runAssistant({ message: c.message, pageLang: c.pageLang, env: m.env, actorKey: `hello-plus-${c.message}` });
    assert.equal(m.calls.length, 1, `model called for "${c.message}"`);
    assert.ok(!res.reply.includes(ASSISTANT_MESSAGES.greeting[res.lang]), `no canned welcome for "${c.message}"`);
  }
});
test('all 23 languages retrieve Bosphorus cruise price and IST->Sultanahmet transfer price + URL (including Hebrew)', async () => {
  const cruiseQueries = {
    tr: 'Boğaz turu fiyatı',
    en: 'Bosphorus cruise price',
    de: 'Bosporus Bootsfahrt Preis',
    fr: 'Croisière sur le Bosphore prix',
    es: 'Crucero por el Bósforo precio',
    it: 'Crociera sul Bosforo prezzo',
    pt: 'Cruzeiro no Bósforo preço',
    nl: 'Bosporus cruise prijs',
    ru: 'Круиз по Босфору цена',
    uk: 'Круїз по Босфору ціна',
    bs: 'Krstarenje Bosforom cijena',
    hr: 'Krstarenje Bosporom cijena',
    hu: 'Boszporusz hajóút ár',
    az: 'Bosfor turu qiyməti',
    ar: 'سعر رحلة البوسفور',
    he: 'כמה עולה שיט בבוספורוס?',
    fa: 'قیمت کشتی تفریحی بسفر',
    zh: '博斯普鲁斯海峡游船价格',
    ja: 'ボスポラス海峡クルーズ料金',
    ko: '보스포루스 크루즈 가격',
    hi: 'बोस्फोरस क्रूज़ की कीमत',
    bn: 'বসফরাস ক্রুজ দাম কত',
    id: 'Harga pelayaran Bosporus',
  };
  const transferQueries = {
    tr: 'IST→Sultanahmet transfer fiyatı',
    en: 'IST→Sultanahmet transfer price',
    de: 'IST→Sultanahmet Transfer Preis',
    fr: 'Transfert IST→Sultanahmet prix',
    es: 'Traslado IST→Sultanahmet precio',
    it: 'Trasferimento IST→Sultanahmet prezzo',
    pt: 'Transfer IST→Sultanahmet preço',
    nl: 'IST→Sultanahmet transfer prijs',
    ru: 'Трансфер IST→Султанахмет цена',
    uk: 'Трансфер IST→Султанахмет ціна',
    bs: 'Transfer IST→Sultanahmet cijena',
    hr: 'Transfer IST→Sultanahmet cijena',
    hu: 'IST→Sultanahmet transzfer ár',
    az: 'IST→Sultanəhməd transfer qiyməti',
    ar: 'سعر توصيل IST السلطان أحمد',
    he: 'מחיר העברה IST סולטן אחמט',
    fa: 'قیمت ترانسفر IST سلطان احمد',
    zh: 'IST到苏丹艾哈迈德接送价格',
    ja: 'ISTからスルタンアフメット送迎料金',
    ko: 'IST 술탄아흐메트 픽업 가격',
    hi: 'IST से सुल्तानअहमत ट्रांसफर कीमत',
    bn: 'IST থেকে সুলতানআহমেত ট্রান্সফার দাম',
    id: 'Harga transfer IST→Sultanahmet',
  };

  for (const lang of ALL_23_LANGS) {
    const cruiseChunks = retrieveChunks(cruiseQueries[lang], 4);
    const pricedCruise = cruiseChunks.find((c) => /Approx\.\s*\d+\s*(?:EUR|USD)/.test(c.text) && c.url.includes('booking.html'));
    assert.ok(pricedCruise, `${lang} cruise retrieval should include priced tour chunk & booking link, got: ${cruiseChunks.map((c) => c.id).join(', ')}`);

    const transferChunks = retrieveChunks(transferQueries[lang], 4);
    const rateChunk = transferChunks.find((c) => c.id === 'transfer-rates' && c.text.includes('€60') && c.text.includes('€65'));
    assert.ok(rateChunk, `${lang} transfer retrieval should include transfer-rates (€60/€65), got: ${transferChunks.map((c) => c.id).join(', ')}`);

    // Verify runAssistant injects those exact chunks & enforces URL fallback if mocked model omits URL
    let capturedSystem = '';
    const mockEnv = {
      AI: {
        run: async (_model, opts) => {
          capturedSystem = opts.messages[0].content;
          const hasTransfer = capturedSystem.includes('€60');
          return {
            response: JSON.stringify({
              abuse: false,
              handoff: false,
              reply: hasTransfer ? 'IST → Sultanahmet ~€60 (request).' : 'Bosphorus cruise approx. 25 EUR.',
            }),
          };
        },
      },
    };
    const res = await runAssistant({ message: transferQueries[lang], pageLang: lang, env: mockEnv, actorKey: `t23-${lang}` });
    assert.equal(res.ok, true);
    assert.match(capturedSystem, /€60/);
    assert.ok(res.reply.includes('https://bosphorly.com/index.html?lang=' + lang + '#booking'), `${lang} reply should ensure localized booking link`);
  }
});

test('model config disables thinking, caps tokens at 350, compacts prompt, and uses informal address', async () => {
  let capturedModel = '';
  let capturedOpts = null;
  const env = {
    AI: {
      run: async (model, opts) => {
        capturedModel = model;
        capturedOpts = opts;
        return {
          response: 'Sabah Boğaz turu kişi başı yaklaşık 25 EUR. https://bosphorly.com/booking.html?service=bb-morning&lang=tr Tarihini paylaşır mısın?\n[[flags:abuse=0;handoff=0]]',
        };
      },
    },
  };
  await runAssistant({ message: 'Boğaz turu fiyatı ne kadar?', pageLang: 'tr', env, actorKey: 'cfg-check' });
  assert.equal(capturedModel, ASSISTANT_MODEL);
  assert.equal(capturedModel, '@cf/google/gemma-4-26b-a4b-it');
  assert.equal(capturedOpts.max_completion_tokens, 350);
  assert.deepEqual(capturedOpts.chat_template_kwargs, { enable_thinking: false });
  const sys = capturedOpts.messages[0].content;
  assert.ok(sys.includes('Samimi "sen" hitabı'));
  assert.ok(sys.includes('EXAMPLES:'));
  assert.ok(sys.includes('[[flags:abuse=0;handoff=0]]'));
  assert.ok(sys.length < 4800, `Character prompt + 7 few-shots + 3 chunks stay compact (got ${sys.length})`);
});

test('repeat greetings and "Ben Mimo" intros are suppressed on follow-up turns and web chat after initial welcome', async () => {
  let followPrompt = '';
  const env = {
    AI: {
      run: async (_m, opts) => {
        followPrompt = opts.messages[0].content;
        return {
          response: 'İyi akşamlar! Merhaba! Ben Mimo, Bosphorly’nin yapay zekâ asistanıyım. Boğaz turu kişi başı yaklaşık 25 EUR. https://bosphorly.com/booking.html?service=bb-morning&lang=tr\n[[flags:abuse=0;handoff=0]]',
        };
      },
    },
  };

  // With prior assistant message in history -> strips greeting & Ben Mimo intro
  const resHistory = await runAssistant({
    message: 'Sabah Boğaz turu fiyatı nedir?',
    pageLang: 'tr',
    history: [
      { role: 'user', content: 'Merhaba' },
      { role: 'assistant', content: 'Merhaba! Sana nasıl yardımcı olabilirim?' },
    ],
    env,
    actorKey: 'followup-1',
  });
  assert.match(followPrompt, /Continuing chat: you already greeted/i);
  assert.ok(!resHistory.reply.startsWith('İyi akşamlar'));
  assert.ok(!resHistory.reply.includes('Ben Mimo'));
  assert.match(resHistory.reply, /^Boğaz turu kişi başı yaklaşık 25 EUR/);

  // With alreadyGreeted=true (web panel already showed initial welcome before first turn)
  const resWeb = await runAssistant({
    message: 'Transfer ne kadar?',
    pageLang: 'tr',
    history: [],
    alreadyGreeted: true,
    env,
    actorKey: 'followup-2',
  });
  assert.ok(!resWeb.reply.includes('Ben Mimo'));
  assert.match(resWeb.reply, /^Boğaz turu kişi başı yaklaşık 25 EUR/);

  // Direct unit check on multilingual repeat intro stripper
  assert.equal(
    stripRepeatIntroAndGreeting("Hello! I'm Mimo, your Istanbul guide. Fixed transfer to Sultanahmet is €60."),
    'Fixed transfer to Sultanahmet is €60.'
  );
  // Leaves substantive text untouched when removing intro leaves too little
  assert.equal(stripRepeatIntroAndGreeting('Ben Mimo.'), 'Ben Mimo.');
});

test('stripFakeUrgency catches "son 2 yer kaldı", "son X koltuk", "sadece bugün", and multilingual urgency', () => {
  const tr1 = stripFakeUrgency('Sabah turu 25 EUR, son 2 yer kaldı!');
  assert.ok(!/son 2 yer/i.test(tr1), tr1);
  assert.ok(tr1.includes('25 EUR'));

  const tr2 = stripFakeUrgency('Son 5 koltuk kaldı, hemen yerini ayırt.');
  assert.ok(!/son 5 koltuk/i.test(tr2), tr2);
  assert.ok(!/hemen/i.test(tr2), tr2);

  const tr3 = stripFakeUrgency('Bu fiyat sadece bugün geçerli.');
  assert.ok(!/sadece bugün/i.test(tr3), tr3);

  const tr4 = stripFakeUrgency('Yalnızca bugün için son iki yer kaldı!');
  assert.ok(!/yalnızca bugün|son iki yer/i.test(tr4), tr4);

  const multi = stripFakeUrgency(
    'Цена 25 EUR, осталось 2 места. Nur noch 3 Plätze frei. נשארו רק 2 מקומות רק היום. Dernières 4 places. 最后2个名额.'
  );
  assert.ok(multi.includes('25 EUR'), multi);
  assert.ok(!/осталось 2 места|Plätze|מקומות|רק היום|places|名额/.test(multi), multi);
});

test('assistant_timing console.log outputs totalMs and modelMs without message content or PII', async t => {
  const logs = [];
  t.mock.method(console, 'log', (...args) => {
    logs.push(args.join(' '));
  });
  const env = {
    AI: {
      run: async () => ({
        response: JSON.stringify({ abuse: false, handoff: false, reply: 'SECRET_BOT_REPLY IST €60 https://bosphorly.com/index.html?lang=tr#booking' }),
      }),
    },
  };
  await runAssistant({
    message: 'Benim adım Caner SECRET_USER_QUERY transfer ne kadar?',
    pageLang: 'tr',
    env,
    actorKey: 'timing-log-test',
  });
  const timingLine = logs.find((l) => l.includes('assistant_timing'));
  assert.ok(timingLine, 'Should log assistant_timing');
  assert.ok(timingLine.includes('"totalMs"'));
  assert.ok(timingLine.includes('"modelMs"'));
  assert.ok(!timingLine.includes('SECRET_USER_QUERY'));
  assert.ok(!timingLine.includes('SECRET_BOT_REPLY'));
  assert.ok(!timingLine.includes('Caner'));
});

test('POST /v1/assistant supports SSE streaming (stream=true), filters <think> and unsafe content, and returns canonical done payload', async t => {
  const pepper = 'sse-pepper';
  const ip = '203.0.113.55';
  const sessionTok = await createChatSessionToken(pepper, ip);
  t.mock.method(console, 'log', () => {});

  const enc = new TextEncoder();
  const env = baseEnv({
    CODE_PEPPER: pepper,
    AI: {
      run: async (_m, opts) => {
        assert.equal(opts.stream, true);
        assert.equal(opts.max_completion_tokens, 350);
        assert.deepEqual(opts.chat_template_kwargs, { enable_thinking: false });
        const tokens = [
          'data: {"choices":[{"delta":{"reasoning":"internal thought should not leak"}}]}\n\n',
          'data: {"response":"<|channel>thought\\nchecking catalog<channel|><think>secret thought</think>"}\n\n',
          'data: {"response":"Merhaba! Ben Mimo. **Sabah Boğaz turu** kişi başı "}\n\n',
          'data: {"response":"yaklaşık **25 EUR** ve sadece resmi site: "}\n\n',
          'data: {"response":"https://bosphorly.com/booking.html?service=bb-morning&lang=tr "}\n\n',
          'data: {"response":"https://evil.com son 2 yer kaldı. Tarihini yazar mısın?\\n[[flags:abuse=0;handoff=0]]"}\n\n',
          'data: [DONE]\n\n',
        ];
        return new ReadableStream({
          start(controller) {
            for (const tok of tokens) controller.enqueue(enc.encode(tok));
            controller.close();
          },
        });
      },
    },
  });

  const res = await worker.fetch(new Request(`${ORIGIN}/v1/assistant`, {
    method: 'POST',
    headers: {
      Origin: ORIGIN,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      'CF-Connecting-IP': ip,
    },
    body: JSON.stringify({
      message: 'Sabah Boğaz turu ne kadar?',
      lang: 'tr',
      greeted: true,
      stream: true,
      history: [],
      chatSession: sessionTok,
    }),
  }), env);

  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /text\/event-stream/);
  const bodyText = await res.text();
  assert.ok(!bodyText.includes('secret thought'));
  assert.ok(!bodyText.includes('internal thought'));
  assert.ok(!bodyText.includes('checking catalog'));
  assert.ok(!bodyText.includes('[[flags:'));
  assert.ok(!bodyText.includes('evil.com'));
  assert.ok(!bodyText.includes('son 2 yer'));
  assert.ok(bodyText.includes('event: delta'));
  assert.ok(bodyText.includes('event: done'));

  const doneMatch = bodyText.match(/event: done\ndata: (.+)/);
  assert.ok(doneMatch);
  const donePayload = JSON.parse(doneMatch[1]);
  assert.equal(donePayload.closed, false);
  assert.ok(!donePayload.reply.includes('Ben Mimo'));
  assert.ok(donePayload.reply.includes('**Sabah Boğaz turu**'));
  assert.ok(donePayload.reply.includes('https://bosphorly.com/booking.html?service=bb-morning&lang=tr'));
});

test('Telegram formatTelegramPlainText cleans markdown bold asterisks and markdown links when parse_mode is unused', () => {
  const cleaned = formatTelegramPlainText('**Boğaz Turu** yaklaşık **25 EUR**. [Rezervasyon](https://bosphorly.com/booking.html?service=bb-morning&lang=tr) **test');
  assert.ok(!cleaned.includes('**'), cleaned);
  assert.ok(cleaned.includes('Boğaz Turu yaklaşık 25 EUR.'));
  assert.ok(cleaned.includes('Rezervasyon (https://bosphorly.com/booking.html?service=bb-morning&lang=tr)'));
});


test('SSE streaming retries a timeout once, uses tryAgain off-catalog, and keeps email handoff on catalog questions', async () => {
  const pepper = 'sse-timeout-pepper';
  const ip = '203.0.113.77';
  const sessionTok = await createChatSessionToken(pepper, ip);

  async function post(message, lang, run) {
    const env = baseEnv({
      CODE_PEPPER: pepper,
      ASSISTANT_AI_TIMEOUT_MS: '25',
      AI: { run },
    });
    const res = await worker.fetch(new Request(`${ORIGIN}/v1/assistant`, {
      method: 'POST',
      headers: {
        Origin: ORIGIN,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'CF-Connecting-IP': ip,
      },
      body: JSON.stringify({ message, lang, stream: true, history: [], chatSession: sessionTok }),
    }), env);
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('text/event-stream')) {
      return { ct, json: await res.json() };
    }
    const text = await res.text();
    const doneMatch = text.match(/event: done\ndata: (.+)/);
    return { ct, done: doneMatch ? JSON.parse(doneMatch[1]) : null };
  }

  let recoveredCalls = 0;
  const recovered = await post('Boğaz turu fiyatı nedir?', 'tr', () => {
    recoveredCalls += 1;
    if (recoveredCalls === 1) return new Promise(() => {});
    return Promise.resolve({
      response: JSON.stringify({ handoff: false, reply: 'Sabah turu yaklaşık iki saat sürer.' }),
    });
  });
  assert.equal(recoveredCalls, 2);
  assert.match(recovered.ct, /text\/event-stream/);
  assert.equal(recovered.done.handoff, false);
  assert.ok(recovered.done.reply.includes('iki saat'));

  let catalogCalls = 0;
  const catalog = await post('Boğaz turu fiyatı nedir?', 'tr', () => {
    catalogCalls += 1;
    return new Promise(() => {});
  });
  assert.equal(catalogCalls, 2);
  assert.equal(catalog.done.handoff, true);
  assert.match(catalog.done.reply, /e-posta/i);

  let weatherCalls = 0;
  const weather = await post('Bugün hava nasıl?', 'tr', () => {
    weatherCalls += 1;
    return new Promise(() => {});
  });
  assert.equal(weatherCalls, 2);
  assert.equal(weather.done.handoff, false);
  assert.equal(weather.done.reply, ASSISTANT_MESSAGES.tryAgain.tr);
  assert.equal(/e-posta|email/i.test(weather.done.reply), false);

  let chatCalls = 0;
  const chat = await post('nasılsın', 'tr', () => {
    chatCalls += 1;
    return new Promise(() => {});
  });
  assert.equal(chatCalls, 2);
  assert.equal(chat.done.handoff, false);
  assert.equal(chat.done.reply, ASSISTANT_MESSAGES.tryAgain.tr);

  let errorCalls = 0;
  const hard = await post('How is the weather today?', 'en', async () => {
    errorCalls += 1;
    throw new Error('Workers AI down');
  });
  assert.equal(errorCalls, 1);
  assert.equal(hard.done.handoff, false);
  assert.equal(hard.done.reply, ASSISTANT_MESSAGES.tryAgain.en);

  let greetCalls = 0;
  const greet = await post('Merhaba', 'tr', async () => {
    greetCalls += 1;
    throw new Error('should not run for an opening hello');
  });
  assert.equal(greetCalls, 0);
  assert.equal(greet.json.handoff, false);
  assert.equal(greet.json.fallback, undefined);
  assert.ok(greet.json.reply.includes('Mimo'));
  assert.equal(/e-posta|email/i.test(greet.json.reply), false);
});

test('small talk ("nasılsın?", "Selam nasılsın") recovers non-JSON/truncated replies, safely logs failures (message<=200, durationMs, parseFailed), and preserves valid reply on repeat-retry error', async (t) => {
  assert.equal(AI_TIMEOUT_MS, 9000);
  assert.equal(ASSISTANT_MESSAGES.tryAgain.tr, 'Bir saniye, martılar kafamı karıştırdı 😅 Tekrar yazar mısın?');

  for (const q of ['nasılsın?', 'Selam nasılsın']) {
    for (const raw of [
      { response: 'İyiyim, Boğaz havasıyla harikayım 😊 Sen nasılsın?' },
      { response: '```json\n{"abuse":false,"handoff":false,"reply":"Çok iyiyim! İstanbul seni bekliyor 🌊"}\n```' },
      { response: '{"abuse":false,"handoff":false,"reply":"Harika gidiyor! Sen nasılsın?' },
      { response: '<think>reasoning\n</think>{"reply":"Süperim! Bugün neler yapıyorsun?"}' },
    ]) {
      const r = await runAssistant({
        message: q,
        pageLang: 'tr',
        env: { AI: { run: async () => raw } },
        actorKey: `st-rec-${Math.random()}`,
      });
      assert.equal(r.handoff, false, `no handoff for "${q}"`);
      assert.ok(!r.handoffOffer);
      assert.ok(r.reply.length > 10 && !r.reply.includes('e-posta'));
    }

    for (const emptyRaw of [{ response: '' }, { response: '{}' }, { response: '   ' }, { response: 'null' }]) {
      const r = await runAssistant({
        message: q,
        pageLang: 'tr',
        env: { AI: { run: async () => emptyRaw } },
        actorKey: `st-empty-${Math.random()}`,
      });
      assert.equal(r.handoff, false);
      assert.equal(r.fallback, true);
      assert.equal(r.reply, ASSISTANT_MESSAGES.tryAgain.tr);
    }

    const errorLogs = [];
    t.mock.method(console, 'error', (...args) => errorLogs.push(args));
    let timeoutCalls = 0;
    const retryFail = await runAssistant({
      message: `${q} UNLOGGED_TOKEN_ABC`,
      pageLang: 'tr',
      aiTimeoutMs: 20,
      env: {
        AI: {
          run: async () => {
            timeoutCalls += 1;
            return new Promise(() => {});
          },
        },
      },
      actorKey: `st-timeout-log-${Math.random()}`,
    });
    t.mock.restoreAll();
    assert.equal(timeoutCalls, 2);
    assert.equal(retryFail.handoff, false);
    assert.equal(retryFail.reply, ASSISTANT_MESSAGES.tryAgain.tr);
    const errCall = errorLogs.find((e) => e[0] === 'assistant_ai_call_failed');
    assert.ok(errCall);
    assert.equal(errCall[1].errorType, 'TimeoutError');
    assert.ok(typeof errCall[1].message === 'string' && errCall[1].message.length > 0 && errCall[1].message.length <= 200);
    assert.ok(typeof errCall[1].durationMs === 'number' && errCall[1].durationMs >= 0);
    assert.equal(typeof errCall[1].parseFailed, 'boolean');
    assert.equal(JSON.stringify(errorLogs).includes('UNLOGGED_TOKEN_ABC'), false);
  }

  let repCalls = 0;
  const repSafe = await runAssistant({
    message: 'nasılsın?',
    pageLang: 'tr',
    history: [{ role: 'user', content: 'nasılsın' }, { role: 'assistant', content: 'Harika gidiyor! Sen nasılsın?' }],
    env: {
      AI: {
        run: async () => {
          repCalls += 1;
          if (repCalls === 1) return { response: JSON.stringify({ handoff: false, reply: 'Harika gidiyor! Sen nasılsın?' }) };
          throw new Error('Retry error');
        },
      },
    },
    actorKey: 'st-repeat-resilient',
  });
  assert.equal(repSafe.handoff, false);
  assert.equal(repSafe.reply, 'Harika gidiyor! Sen nasılsın?');
});

// ---------------- Mimo 2.0 Suite ----------------

test('Mimo 2.0: retrieval defaults to 3 chunks and history trims to 4 messages', async () => {
  const defaultChunks = retrieveChunks('Bosphorus sunset cruise price');
  assert.equal(defaultChunks.length, 3, 'default retrieval k should be 3');

  let seenHistoryCount = -1;
  const env = {
    AI: {
      run: async (_m, opts) => {
        // system + safeHistory + user
        seenHistoryCount = opts.messages.length - 2;
        return { response: 'Gün batımı turu yaklaşık 20 EUR 💙\n[[flags:abuse=0;handoff=0]]' };
      },
    },
  };
  const sixHistory = [
    { role: 'user', content: 'msg1' },
    { role: 'assistant', content: 'ans1' },
    { role: 'user', content: 'msg2' },
    { role: 'assistant', content: 'ans2' },
    { role: 'user', content: 'Eşimle gün batımı istiyorum' },
    { role: 'assistant', content: 'Harika olur!' },
  ];
  const res = await runAssistant({
    message: 'Fiyatı ne kadar?',
    pageLang: 'tr',
    history: sixHistory,
    env,
    actorKey: 'mimo2-hist4',
  });
  assert.equal(res.handoff, false);
  assert.equal(seenHistoryCount, 4, 'model should receive at most 4 history turns');
});

test('Mimo 2.0: strips Gemma 4 <|channel>thought, <think>, and [[flags:...]] while respecting flag values', async () => {
  assert.equal(
    stripModelThinking('<|channel>thought\nLet me plan\n<channel|>Merhaba!\n<think>more hidden</think>'),
    'Merhaba!'
  );
  const defaultFlags = extractFlagsTag('Harika bir akşam!');
  assert.equal(defaultFlags.abuse, false);
  assert.equal(defaultFlags.handoff, false);
  assert.equal(defaultFlags.foundTag, false);

  const abuseFlags = extractFlagsTag('Stop.\n[[flags:abuse=1;handoff=0]]');
  assert.equal(abuseFlags.abuse, true);
  assert.equal(abuseFlags.handoff, false);
  assert.equal(abuseFlags.text, 'Stop.');

  // End-to-end plain text with Gemma thought channel and hidden handoff flag
  const handoffRes = await runAssistant({
    message: 'Gün batımı turu güzelmiş, müsait mi?',
    pageLang: 'en',
    env: {
      AI: {
        run: async () => ({
          response: '<|channel>thought\nguest wants help\n<channel|>Happy to pass this to our team.\n[[flags:abuse=0;handoff=1]]',
        }),
      },
    },
    actorKey: 'mimo2-handoff-tag',
  });
  assert.equal(handoffRes.handoffOffer, true);
  assert.ok(!handoffRes.reply.includes('[[flags:'));
  assert.ok(!handoffRes.reply.includes('guest wants help'));
});

test('Mimo 2.0: SSE timeout inside stalling reader.read() retries once and falls back to tryAgain', async (t) => {
  t.mock.method(console, 'error', () => {});
  const pepper = 'sse-hang-pepper';
  const ip = '203.0.113.88';
  const sessionTok = await createChatSessionToken(pepper, ip);
  let attempts = 0;

  const res = await worker.fetch(new Request(`${ORIGIN}/v1/assistant`, {
    method: 'POST',
    headers: {
      Origin: ORIGIN,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      'CF-Connecting-IP': ip,
    },
    body: JSON.stringify({
      message: 'Bugün hava nasıl?',
      lang: 'tr',
      stream: true,
      history: [],
      chatSession: sessionTok,
    }),
  }), baseEnv({
    CODE_PEPPER: pepper,
    ASSISTANT_AI_TIMEOUT_MS: '30',
    AI: {
      run: async () => {
        attempts += 1;
        return new ReadableStream({
          pull() {
            return new Promise(() => {}); // stalls forever inside reader.read()
          },
        });
      },
    },
  }));

  assert.equal(res.status, 200);
  const sseText = await res.text();
  assert.equal(attempts, 2, 'stalled SSE stream should retry once');
  const m = sseText.match(/event: done\ndata: ([^\n]+)/);
  assert.ok(m, 'SSE should emit done even after stream timeout');
  const done = JSON.parse(m[1]);
  assert.equal(done.reply, ASSISTANT_MESSAGES.tryAgain.tr);
});

test('Mimo 2.0: price safety belt blocks hallucinated prices and forbidden currency conversion across all 23 languages', async () => {
  const kbPairs = buildKbPriceIndex(knowledge);
  assert.equal(kbPairs.has('20:EUR'), true);
  assert.equal(kbPairs.has('60:EUR'), true);
  assert.equal(kbPairs.has('65:EUR'), true);
  assert.equal(kbPairs.has('110:EUR'), true);

  for (const lang of ALL_23_LANGS) {
    assert.ok(typeof PRICE_CHECK_BOOKING[lang] === 'string' && PRICE_CHECK_BOOKING[lang].length > 5);
    const badPrice = enforcePriceSafetyBelt('Morning sunset boat is €999 today. Have fun!', lang, kbPairs);
    assert.equal(badPrice.replaced, true, `hallucinated €999 caught in ${lang}`);
    assert.ok(!badPrice.text.includes('999'));
    assert.ok(badPrice.text.includes(PRICE_CHECK_BOOKING[lang]));
    assert.ok(badPrice.text.includes('Have fun!'));

    const conv = enforcePriceSafetyBelt('IST transfer is 60 EUR (approx 2200 TL).', lang, kbPairs);
    assert.equal(conv.replaced, true, `currency conversion caught in ${lang}`);
    assert.ok(!conv.text.includes('2200'));
  }

  // Real KB price passes unscathed
  const valid = enforcePriceSafetyBelt('Bosphorus Sunset Cruise is around 20 EUR per person.', 'en', kbPairs);
  assert.equal(valid.replaced, false);
  assert.ok(valid.text.includes('20 EUR'));

  // Full end-to-end check: unverified price in model output gets replaced before guest sees it
  const aiRes = await runAssistant({
    message: 'Boğaz turu fiyatı?',
    pageLang: 'tr',
    env: {
      AI: {
        run: async () => ({
          response: 'Özel Boğaz turu kişi başı 149 EUR. Yine de keyifli akşamlar!\n[[flags:abuse=0;handoff=0]]',
        }),
      },
    },
    actorKey: 'price-belt-e2e',
  });
  assert.ok(!aiRes.reply.includes('149'));
  assert.ok(aiRes.reply.includes('Güncel fiyatı rezervasyon formunda görebilirsin'));
  assert.ok(aiRes.reply.includes('keyifli akşamlar'));
});

test('Mimo 2.0: language safety belt regenerates once when model replies in wrong language', async () => {
  let calls = 0;
  const res = await runAssistant({
    message: 'İstanbul’da bugün ne yapılır?',
    pageLang: 'tr',
    env: {
      AI: {
        run: async () => {
          calls += 1;
          if (calls === 1) {
            return { response: 'Hello my friend! The Bosphorus sunset is lovely today! How are you?' };
          }
          return { response: 'Merhaba! Boğaz kenarında yürüyüş harika olur, sen nasılsın?\n[[flags:abuse=0;handoff=0]]' };
        },
      },
    },
    actorKey: 'lang-belt-e2e',
  });
  assert.equal(calls, 2, 'wrong language should trigger 1 regeneration');
  assert.equal(detectReplyLanguage(res.reply, 'tr'), 'tr');
  assert.ok(res.reply.includes('Boğaz'));

  // Also test streaming SSE language regeneration before any delta leaks
  const pepper = 'lang-sse-pepper';
  const ip = '203.0.113.99';
  const sessionTok = await createChatSessionToken(pepper, ip);
  const enc = new TextEncoder();
  let sseCalls = 0;
  const sseRes = await worker.fetch(new Request(`${ORIGIN}/v1/assistant`, {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', Accept: 'text/event-stream', 'CF-Connecting-IP': ip },
    body: JSON.stringify({ message: 'İstanbul akşamı nasıl?', lang: 'tr', greeted: true, stream: true, history: [], chatSession: sessionTok }),
  }), baseEnv({
    CODE_PEPPER: pepper,
    AI: {
      run: async () => {
        sseCalls += 1;
        if (sseCalls === 1) {
          return new ReadableStream({
            start(c) {
              c.enqueue(enc.encode('data: {"response":"Good evening! Istanbul is very nice tonight and sunset looks great."}\n\n'));
              c.enqueue(enc.encode('data: [DONE]\n\n'));
              c.close();
            },
          });
        }
        return { response: 'Harika esiyor, Galata kıyısı çok keyifli! Sen nerelerdesin?\n[[flags:abuse=0;handoff=0]]' };
      },
    },
  }));
  const sseBody = await sseRes.text();
  assert.equal(sseCalls, 2);
  assert.ok(!sseBody.includes('Good evening!'), 'wrong-language opening should be buffered and not leaked to guest');
  assert.ok(sseBody.includes('Galata'));
});

test('Mimo 2.0: all 23 languages have 7 few-shot mini conversations, ethical filter catches guilt & avoids second insistence, and finishes with warm farewell', () => {
  assert.equal(ALL_23_LANGS.length, 23);

  const guiltSamples = {
    tr: 'Bunu almazsan gerçekten çok üzülürüm! Turu 25 EUR yapabiliriz.',
    en: "If you don't book this, you'll make me sad! Have fun exploring.",
    ru: 'Если не забронируешь, я расстроюсь! Хорошего дня в Стамбуле.',
    uk: 'Якщо не замовиш, я дуже засмучусь! Гарної прогулянки містом.',
    de: 'Wenn du nicht buchst, macht mich das traurig! Viel Spaß.',
    fr: 'Tu me rends triste si tu ne réserves pas ! Profite de la ville.',
    nl: 'Je maakt me verdrietig als je niet boekt! Veel plezier.',
    ar: 'ستحزنني إذا لم تحجز هذه الجولة! رحلة جميلة لك.',
    he: 'אתה תעציב אותי אם לא תזמין עכשיו! תהנה באיסטנבול.',
    az: 'Bunu almasan çox üzülərəm! Xoş gəzintilər arzulayıram.',
    fa: 'اگه نگیری خیلی ناراحت می‌شم! سفرت به خوشی بگذره.',
    es: 'Me pone muy triste si no reservas! Disfruta mucho de Estambul.',
    it: 'Mi rendi triste se non prenoti! Buona giornata a Istanbul.',
    pt: 'Vai me deixar muito triste se não reservar! Aproveite Istambul.',
    hr: 'Rastužit ćeš me ako ne rezerviraš! Uživaj u gradu.',
    hu: 'Nagyon szomorú leszek, ha nem foglalsz! Jó nézelődést.',
    bs: 'Rastužit ćeš me ako ne rezerviraš! Uživaj u šetnji.',
    zh: '如果不预订的话我会很伤心的！祝你在伊斯坦布尔逛得开心。',
    ja: '予約しないと悲しくなります！イスタンブールを楽しんでね。',
    ko: '예약 안 하면 정말 속상해요! 즐거운 시간 보내세요.',
    hi: 'अगर तुम बुक नहीं करोगे तो मुझे बहुत दुख होगा! सैर का मज़ा लो।',
    bn: 'বুক না করলে আমার খুব মন খারাপ হবে! ঘুরে বেড়াও।',
    id: 'Aku akan sedih kalau kamu nggak pesan! Selamat keliling Istanbul.',
  };

  const declines = {
    tr: 'Şimdilik tur almayacağım teşekkürler',
    en: 'No thanks, not booking today',
    ru: 'Нет, спасибо, не буду бронировать',
    uk: 'Ні, дякую, поки що не бронюватиму',
    de: 'Nein danke, ich buche nicht',
    fr: 'Non merci, je ne réserve pas',
    nl: 'Nee bedankt, ik boek niet',
    ar: 'لا شكراً، لن أحجز الآن',
    he: 'לא תודה, לא מזמין כרגע',
    az: 'Yox sağ ol, almayacağam',
    fa: 'نه ممنون، فعلاً نمی‌گیرم',
    es: 'No gracias, no reservaré',
    it: 'No grazie, non prenoto',
    pt: 'Não obrigado, não vou reservar',
    hr: 'Ne hvala, neću rezervirati',
    hu: 'Nem köszönöm, nem foglalok',
    bs: 'Ne hvala, neću rezervisati',
    zh: '谢谢，先不订了',
    ja: '結構です、今は予約しないでおきます',
    ko: '아니요, 지금은 안 할래요',
    hi: 'नहीं धन्यवाद, अभी बुक नहीं करूँगा',
    bn: 'না ধন্যবাদ, এখন বুক করব না',
    id: 'Nggak dulu, belum mau pesan',
  };

  for (const lang of ALL_23_LANGS) {
    assert.equal(getFewShotEntryCount(lang), 7, `expected 7 few-shot mini chats for ${lang}`);
    const block = getFewShotsPromptBlock(lang);
    assert.ok(block.includes('20 EUR'), `price few-shot present in ${lang}`);

    const ethical = enforceEthicalBoundary(guiltSamples[lang], lang, declines[lang], []);
    assert.equal(ethical.strippedEthical, true, `guilt stripped in ${lang}`);
    assert.ok(ethical.text.includes('💙') || ethical.text.includes(WARM_FAREWELL[lang].slice(0, 8)), `warm farewell preserved in ${lang}`);
    assert.ok(!/almazsan|make me sad|расстроюсь|засмучусь|traurig|rends triste|verdrietig|ستحزنني|תעציב|üzülərəm|ناراحت|pone muy triste|rendi triste|deixar.*triste|rastužit|szomorú|伤心|悲しく|속상해|दुख|মন খারাপ|sedih/i.test(ethical.text));
  }

  // Max 2 emojis enforcement
  assert.equal(enforceMaxEmojis('Harika 💙😄🌊✨', 2), 'Harika 💙😄');
});

test('Mimo 2.0: knowledge base marks exactly 1 "Mimo\'nun favorisi 💙" per category and time-of-day jokes cover 23 languages', () => {
  const favsByCategory = new Map();
  for (const chunk of knowledge) {
    if (chunk.favorite) {
      const arr = favsByCategory.get(chunk.category) || [];
      arr.push(chunk);
      favsByCategory.set(chunk.category, arr);
      assert.ok(chunk.text.includes("Mimo'nun favorisi 💙"), `${chunk.id} marks badge`);
    }
  }
  assert.equal(favsByCategory.size, 12, '12 service categories marked');
  for (const [cat, list] of favsByCategory) {
    assert.equal(list.length, 1, `category "${cat}" should have exactly 1 Mimo favorite`);
  }
  assert.equal(favsByCategory.get('cruise')[0].id, 'tour-bb-sunset');
  assert.equal(favsByCategory.get('transfer')[0].id, 'transfer-rates');

  for (const lang of ALL_23_LANGS) {
    assert.ok(TIME_HUMOR_NOTES.morning[lang] && TIME_HUMOR_NOTES.afternoon[lang] && TIME_HUMOR_NOTES.evening[lang], `time humor for ${lang}`);
    assert.ok(MIMO_FAVORITE_LABEL[lang], `favorite label in ${lang}`);
  }
});
