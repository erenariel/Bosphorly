import knowledge from './knowledge.json' with { type: 'json' };

export const ASSISTANT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
export const SUPPORTED_LANGS = new Set([
  'tr', 'en', 'ru', 'uk', 'de', 'fr', 'nl', 'ar', 'he', 'az',
  'fa', 'es', 'it', 'pt', 'hr', 'hu', 'bs', 'zh', 'ja', 'ko', 'hi', 'bn', 'id'
]);

const PER_MIN_LIMIT = 6;
const PER_DAY_LIMIT = 40;
const DEFAULT_GLOBAL_DAILY_LIMIT = 200;
const AI_TIMEOUT_MS = 15000;

const memoryLimits = new Map();

const MESSAGES = {
  unknownHandoff: {
    tr: 'Bunu kesin bilmiyorum, ekibimize iletiyorum. E-posta adresini paylaşırsan ekibimiz en kısa sürede sana dönüş yapar.',
    en: 'I do not know this for sure, so I am forwarding your question to our team. Please share your email address so we can reply.',
    ru: 'Я не могу ответить на это точно, поэтому передаю ваш вопрос нашей команде. Укажите ваш e-mail, чтобы мы могли ответить.',
    ar: 'لا أعرف ذلك على وجه اليقين، لذا أحيل سؤالك إلى فريقنا. يرجى مشاركة بريدك الإلكتروني لنتمكن من الرد عليك.',
  },
  handoff: {
    tr: 'Memnuniyetle ekibimize iletiyorum. Size dönüş yapabilmemiz için e-posta adresinizi paylaşır mısınız?',
    en: 'I am forwarding this to our team. Please share your email address so we can get back to you.',
    ru: 'Передаю ваш запрос нашей команде. Пожалуйста, укажите ваш e-mail для ответа.',
    ar: 'أحيل طلبك إلى فريقنا. يرجى مشاركة بريدك الإلكتروني لنتواصل معك.',
  },
  payment: {
    tr: 'Ödeme yöntemi talebinden sonra seninle iletişime geçtiğimizde paylaşılır.',
    en: 'The payment method is shared when we contact you after your request.',
    ru: 'Способ оплаты сообщается, когда мы связываемся с вами после вашей заявки.',
    ar: 'تتم مشاركة طريقة الدفع عندما نتواصل معك بعد تقديم طلبك.',
  },
  busy: {
    tr: 'Şu an yoğunuz, mesajını ekibe iletelim mi? E-posta adresini paylaşabilirsin.',
    en: 'We are currently busy—would you like us to forward your message to our team? Please share your email address.',
    ru: 'Сейчас мы заняты — передать ваше сообщение нашей команде? Укажите ваш e-mail.',
    ar: 'نحن مشغولون حاليًا، هل نرسل رسالتك إلى فريقنا؟ يمكنك مشاركة بريدك الإلكتروني.',
  },
  sensitiveWarn: {
    tr: 'Güvenliğiniz için lütfen kart veya pasaport numarası paylaşmayın; bu bilgiler gizlendi.',
    en: 'For your security, please do not share card or passport numbers; they have been hidden.',
    ru: 'В целях безопасности не указывайте номера карт или паспортов; они были скрыты.',
    ar: 'لحمايتك، يرجى عدم مشاركة أرقام البطاقات أو جوازات السفر؛ تم إخفاؤها.',
  },
  rateLimit: {
    tr: 'Çok hızlı soru gönderdiniz. Kısa bir süre sonra tekrar deneyebilir veya mesajınızı ekibimize iletebilirsiniz.',
    en: 'You are sending messages too quickly. Please try again shortly or forward your message to our team.',
    ru: 'Слишком много сообщений. Попробуйте чуть позже или передайте вопрос нашей команде.',
    ar: 'لقد أرسلت رسائل كثيرة بسرعة. يرجى المحاولة لاحقًا أو إرسال رسالتك إلى فريقنا.',
  },
};

function msg(key, lang) {
  return (MESSAGES[key] && (MESSAGES[key][lang] || MESSAGES[key].en)) || '';
}

export function detectLanguage({ message = '', pageLang = '', telegramLang = '' } = {}) {
  const text = String(message || '');
  if (/[\u0400-\u04FF]/.test(text)) {
    return /[іїєґІЇЄҐ]/.test(text) ? 'uk' : 'ru';
  }
  if (/[\u0600-\u06FF]/.test(text)) {
    return /[پچژگک]/.test(text) ? 'fa' : 'ar';
  }
  if (/[\u0590-\u05FF]/.test(text)) return 'he';
  if (/[\u3040-\u30FF]/.test(text)) return 'ja';
  if (/[\uAC00-\uD7AF]/.test(text)) return 'ko';
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh';
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  if (/[\u0980-\u09FF]/.test(text)) return 'bn';

  if (/[ğüşöçıİĞÜŞÖÇ]/.test(text) || /\b(merhaba|selam|fiyat|fiyatı|ne kadar|nasıl|nerede|tur|turlar|boğaz|ödeme|ödemeyi|teşekkür|insanla|yetkili)\b/i.test(text)) {
    return 'tr';
  }

  for (const candidate of [telegramLang, pageLang]) {
    if (typeof candidate === 'string' && candidate.trim()) {
      let code = candidate.trim().toLowerCase().split(/[-_]/)[0];
      if (code === 'in') code = 'id';
      if (SUPPORTED_LANGS.has(code)) return code;
    }
  }
  return 'en';
}

export function redactSensitive(input) {
  let text = String(input || '');
  let hadSensitive = false;

  // Credit/debit card numbers: 13 to 19 digits with optional spaces or hyphens
  const cardRe = /(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g;
  text = text.replace(cardRe, (m) => {
    const digits = m.replace(/\D/g, '');
    if (digits.length >= 13 && digits.length <= 19) {
      hadSensitive = true;
      return '[CARD REDACTED]';
    }
    return m;
  });

  // Passport numbers when mentioned alongside passport keywords
  const passportRe = /\b(pasaport(?:\s*(?:no|numarası|numarasi))?|passport(?:\s*(?:no|number))?|паспорт(?:\s*№)?)\s*[:#\-]?\s*([A-Z0-9]{6,12})\b/gi;
  text = text.replace(passportRe, (_, label) => {
    hadSensitive = true;
    return `${label}: [PASSPORT REDACTED]`;
  });

  return { text, hadSensitive };
}

export function stripExternalLinks(input) {
  let text = String(input || '');
  // Replace markdown links [label](https://external...) -> label
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/gi, (full, label, url) => {
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (host === 'bosphorly.com' || host === 'www.bosphorly.com') return full;
    } catch {}
    return label;
  });
  // Remove bare external URLs
  text = text.replace(/https?:\/\/[^\s)>\]"']+/gi, (url) => {
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (host === 'bosphorly.com' || host === 'www.bosphorly.com') return url;
    } catch {}
    return '';
  });
  text = text.replace(/\bwww\.[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s)>\]"']*)?/gi, (url) => {
    if (url.toLowerCase().startsWith('www.bosphorly.com')) return url;
    return '';
  });
  return text.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function normalizeToken(tok) {
  return tok
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

function tokenize(text) {
  const raw = String(text || '').toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) || [];
  const out = [];
  for (const t of raw) {
    out.push(t);
    const n = normalizeToken(t);
    if (n !== t) out.push(n);
  }
  return out;
}

const DOC_STATS = (() => {
  const docs = Array.isArray(knowledge) ? knowledge : [];
  const df = new Map();
  let totalLen = 0;
  const parsed = docs.map((d) => {
    const tokens = tokenize(`${d.title || ''} ${d.text || ''}`);
    const titleTokens = new Set(tokenize(d.title || ''));
    totalLen += tokens.length;
    const tf = new Map();
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
    for (const t of tf.keys()) df.set(t, (df.get(t) || 0) + 1);
    return { doc: d, tf, len: tokens.length, titleTokens };
  });
  const avgLen = parsed.length ? totalLen / parsed.length : 1;
  return { parsed, df, avgLen, N: parsed.length };
})();

export function retrieveChunks(query, k = 6) {
  const qTokens = [...new Set(tokenize(query))];
  if (!qTokens.length || !DOC_STATS.N) return [];
  const k1 = 1.5;
  const b = 0.75;
  const scored = [];

  for (const item of DOC_STATS.parsed) {
    let score = 0;
    for (const qt of qTokens) {
      const f = item.tf.get(qt) || 0;
      if (!f) continue;
      const df = DOC_STATS.df.get(qt) || 0;
      const idf = Math.log(1 + (DOC_STATS.N - df + 0.5) / (df + 0.5));
      const num = f * (k1 + 1);
      const den = f + k1 * (1 - b + b * (item.len / DOC_STATS.avgLen));
      score += idf * (num / den);
      if (item.titleTokens.has(qt)) score += 0.5;
    }
    if (score > 0) scored.push({ score, doc: item.doc });
  }

  scored.sort((a, bScore) => bScore.score - a.score);
  return scored.slice(0, Math.min(8, Math.max(5, k))).map((s) => s.doc);
}

export function isPaymentQuestion(message) {
  const t = String(message || '').toLowerCase();
  return /(?:^|[^\p{L}])(ödeme\w*|nasıl öde\w*|neyle öde\w*|kredi kart\w*|havale|eft|kapıda ödeme|payment|how to pay|how do i pay|pay by|credit card|cash|оплат\w*|способ оплаты|دفع|طريقة الدفع)(?=$|[^\p{L}])/iu.test(t);
}

export function isHumanOrHandoffTopic(message) {
  const t = String(message || '').toLowerCase();
  return /(?:^|[^\p{L}])(insanla konuş\w*|müşteri hizmet\w*|yetkili\w*|canlı destek|temsilci\w*|şikayet\w*|şikâyet\w*|iade|iptal et\w*|rezervasyonumu|onayla\w*|talk to a human|speak to someone|human agent|customer support|complaint|refund|cancel my booking|confirm my booking|человек|оператор|жалоба|возврат|تحدث مع|موظف|شكوى|استرداد)(?=$|[^\p{L}])/iu.test(t);
}

async function incrementCounter(env, key, minBucket, dayBucket) {
  if (env && env.DB) {
    const row = await env.DB.prepare(
      'SELECT min_bucket, min_count, day_bucket, day_count FROM assistant_rate_limits WHERE key = ?'
    ).bind(key).first();
    const minCount = row && row.min_bucket === minBucket ? row.min_count + 1 : 1;
    const dayCount = row && row.day_bucket === dayBucket ? row.day_count + 1 : 1;
    await env.DB.prepare(
      `INSERT INTO assistant_rate_limits (key, min_bucket, min_count, day_bucket, day_count)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET min_bucket = excluded.min_bucket, min_count = excluded.min_count,
         day_bucket = excluded.day_bucket, day_count = excluded.day_count`
    ).bind(key, minBucket, minCount, dayBucket, dayCount).run();
    return { minCount, dayCount };
  }
  const prev = memoryLimits.get(key) || { minBucket: 0, minCount: 0, dayBucket: '', dayCount: 0 };
  const minCount = prev.minBucket === minBucket ? prev.minCount + 1 : 1;
  const dayCount = prev.dayBucket === dayBucket ? prev.dayCount + 1 : 1;
  memoryLimits.set(key, { minBucket, minCount, dayBucket, dayCount });
  return { minCount, dayCount };
}

export async function checkAndIncrementLimits({ env, actorKey, now = Date.now() }) {
  const minBucket = Math.floor(now / 60000);
  const dayBucket = new Date(now).toISOString().slice(0, 10);
  const actor = await incrementCounter(env, actorKey, minBucket, dayBucket);
  if (actor.minCount > PER_MIN_LIMIT || actor.dayCount > PER_DAY_LIMIT) {
    return { allowed: false, reason: 'actor_limit' };
  }
  const globalLimit = Number(env && env.ASSISTANT_DAILY_LIMIT) || DEFAULT_GLOBAL_DAILY_LIMIT;
  const global = await incrementCounter(env, `global:${dayBucket}`, minBucket, dayBucket);
  if (global.dayCount > globalLimit) {
    return { allowed: false, reason: 'global_limit' };
  }
  return { allowed: true };
}

function capWords(text, maxWords = 120) {
  const words = String(text || '').trim().split(/\s+/);
  if (words.length <= maxWords) return String(text || '').trim();
  return words.slice(0, maxWords).join(' ') + '…';
}

function parseModelOutput(raw) {
  const text = typeof raw === 'string' ? raw : (raw && typeof raw.response === 'string' ? raw.response : '');
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const obj = JSON.parse(jsonMatch[0]);
      if (obj && typeof obj.reply === 'string') {
        return { handoff: Boolean(obj.handoff), reply: obj.reply.trim() };
      }
    } catch {}
  }
  const handoff = /\[HANDOFF\]/i.test(trimmed);
  return { handoff, reply: trimmed.replace(/\[HANDOFF\]/gi, '').trim() };
}

export async function runAssistant({ message, pageLang = '', telegramLang = '', history = [], env = {}, actorKey = 'anon', now = Date.now() }) {
  const { text: cleanMsg, hadSensitive: msgSensitive } = redactSensitive(message);
  const lang = detectLanguage({ message: cleanMsg, pageLang, telegramLang });

  const limitRes = await checkAndIncrementLimits({ env, actorKey, now });
  if (!limitRes.allowed) {
    if (limitRes.reason === 'global_limit') {
      return { ok: true, busy: true, handoff: true, lang, reply: msg('busy', lang) };
    }
    return { ok: false, status: 429, handoff: true, lang, reply: msg('rateLimit', lang) };
  }

  const warnPrefix = msgSensitive ? msg('sensitiveWarn', lang) + '\n\n' : '';

  if (isPaymentQuestion(cleanMsg)) {
    return {
      ok: true,
      handoff: false,
      lang,
      reply: `${warnPrefix}${msg('payment', lang)} https://bosphorly.com/faq.html`,
    };
  }

  if (isHumanOrHandoffTopic(cleanMsg)) {
    return {
      ok: true,
      handoff: true,
      lang,
      reply: `${warnPrefix}${msg('handoff', lang)}`,
    };
  }

  const chunks = retrieveChunks(cleanMsg, 6);
  if (!chunks.length) {
    return {
      ok: true,
      handoff: true,
      lang,
      reply: `${warnPrefix}${msg('unknownHandoff', lang)}`,
    };
  }

  if (!env || !env.AI || typeof env.AI.run !== 'function') {
    return {
      ok: true,
      handoff: true,
      fallback: true,
      lang,
      reply: `${warnPrefix}${msg('unknownHandoff', lang)}`,
    };
  }

  const contextBlock = chunks
    .map((c, i) => `[${i + 1}] ${c.title}\nURL: ${c.url}\n${c.text}`)
    .join('\n\n');

  const systemPrompt = [
    'You are the Bosphorly assistant for Istanbul transfers, Bosphorus cruises, tours, and hammams.',
    `Reply strictly in language code "${lang}".`,
    'RULES:',
    '1. Answer ONLY using the PROVIDED CONTEXT below. Do not invent facts, schedules, or prices.',
    '2. If the answer is not in the context, or the guest asks about booking confirmation, complaints, refunds, payment issues, or booking changes, set handoff=true and say you are forwarding to the Bosphorly team.',
    '3. State prices as approximate and confirmed upon request ("yaklaşık / güncel fiyat talep sırasında teyit edilir" in Turkish, or equivalent in guest language), except fixed Sultanahmet transfers (€60 IST, €65 SAW) which are also confirmed on request.',
    '4. Never confirm a booking, never promise a discount, never ask for payment details, card numbers, or passport numbers.',
    '5. Keep the reply concise (max ~120 words) and include the relevant bosphorly.com URL from the context.',
    '6. Output ONLY valid JSON: {"handoff": boolean, "reply": "string"}',
    '',
    'PROVIDED CONTEXT:',
    contextBlock,
  ].join('\n');

  const safeHistory = (Array.isArray(history) ? history : [])
    .slice(-6)
    .filter((h) => h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string')
    .map((h) => ({ role: h.role, content: redactSensitive(h.content).text.slice(0, 600) }));

  const messages = [
    { role: 'system', content: systemPrompt },
    ...safeHistory,
    { role: 'user', content: cleanMsg.slice(0, 1000) },
  ];

  try {
    const aiResult = await Promise.race([
      env.AI.run(ASSISTANT_MODEL, { messages, max_tokens: 260, temperature: 0.2 }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('AI timeout')), AI_TIMEOUT_MS)),
    ]);
    const parsed = parseModelOutput(aiResult);
    let reply = stripExternalLinks(redactSensitive(parsed.reply).text);
    if (!reply) {
      return { ok: true, handoff: true, lang, reply: `${warnPrefix}${msg('unknownHandoff', lang)}` };
    }
    reply = capWords(reply, 120);
    if (!parsed.handoff && !/bosphorly\.com/i.test(reply) && chunks[0] && chunks[0].url) {
      reply = `${reply}\n${chunks[0].url}`;
    }
    return { ok: true, handoff: parsed.handoff, lang, reply: `${warnPrefix}${reply}` };
  } catch {
    return {
      ok: true,
      handoff: true,
      fallback: true,
      lang,
      reply: `${warnPrefix}${msg('unknownHandoff', lang)}`,
    };
  }
}

export async function forwardConversationEmail({ env, email, lang = 'en', history = [], message = '', source = 'web', meta = {} }) {
  const cleanEmail = String(email || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { ok: false, status: 400, error: 'Valid email is required' };
  }
  const fromEmail = env.REQUEST_FROM_EMAIL || env.MAIL_FROM;
  if (!env.RESEND_API_KEY || !fromEmail) {
    return { ok: false, status: 503, error: 'Email delivery is not configured' };
  }
  const safeHistory = (Array.isArray(history) ? history : [])
    .slice(-6)
    .filter((h) => h && typeof h.content === 'string')
    .map((h) => `${h.role === 'assistant' ? 'Assistant' : 'Guest'}: ${redactSensitive(h.content).text}`);
  const cleanMessage = redactSensitive(message).text.trim();
  const ref = `BOS-CHAT-${Date.now().toString(36).toUpperCase()}`;
  const subject = `Bosphorly ${source} assistant handoff · ${ref}`;
  const lines = [
    subject,
    `Source: ${source}`,
    `Language: ${lang}`,
    `Guest email: ${cleanEmail}`,
    meta.telegramUser ? `Telegram: ${meta.telegramUser}` : '',
    '',
    'Recent conversation:',
    ...(safeHistory.length ? safeHistory : ['(no prior turns)']),
    cleanMessage ? `Latest message: ${cleanMessage}` : '',
  ].filter(Boolean);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': ref,
    },
    body: JSON.stringify({
      from: fromEmail,
      to: ['info@bosphorly.com'],
      subject,
      text: lines.join('\n'),
      reply_to: cleanEmail,
    }),
  });
  if (!res.ok) return { ok: false, status: 502, error: 'Email provider rejected request' };
  return { ok: true, reference: ref };
}

async function verifyTurnstile(env, token, remoteip) {
  if (!env.TURNSTILE_SECRET || typeof token !== 'string' || !token.trim() || token.length > 2048) {
    return false;
  }
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token.trim(), remoteip: remoteip || '' }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  return Boolean(data && data.success);
}

async function readJsonBody(request, maxBytes = 16384) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) {
    return { error: 'JSON required', status: 415 };
  }
  const reader = request.body?.getReader();
  let raw = '';
  let size = 0;
  const decoder = new TextDecoder();
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        return { error: 'Payload too large', status: 413 };
      }
      raw += decoder.decode(value, { stream: true });
    }
  }
  raw += decoder.decode();
  try {
    return { data: JSON.parse(raw) };
  } catch {
    return { error: 'Invalid JSON', status: 400 };
  }
}

export async function handleAssistantRoutes(request, env, url) {
  const origin = request.headers.get('Origin');
  const jsonResp = (body, status = 200) => {
    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    };
    if (origin && origin === env.PUBLIC_ORIGIN) {
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Vary'] = 'Origin';
    }
    return new Response(JSON.stringify(body), { status, headers });
  };

  if (request.method !== 'POST') return jsonResp({ error: 'Method not allowed' }, 405);
  const parsed = await readJsonBody(request);
  if (parsed.error) return jsonResp({ error: parsed.error }, parsed.status);
  const body = parsed.data;
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

  const turnstileOk = await verifyTurnstile(env, body && body.turnstileToken, ip);
  if (!turnstileOk) return jsonResp({ error: 'Bot verification failed' }, 403);

  if (url.pathname === '/v1/assistant') {
    if (!body || typeof body.message !== 'string' || !body.message.trim() || body.message.length > 1000) {
      return jsonResp({ error: 'Invalid message' }, 400);
    }
    const result = await runAssistant({
      message: body.message,
      pageLang: typeof body.lang === 'string' ? body.lang : '',
      history: Array.isArray(body.history) ? body.history.slice(-6) : [],
      env,
      actorKey: `ip:${ip}`,
    });
    if (!result.ok) return jsonResp({ error: result.reply, handoff: true, lang: result.lang }, result.status || 429);
    return jsonResp({ reply: result.reply, handoff: result.handoff, busy: Boolean(result.busy), lang: result.lang }, 200);
  }

  if (url.pathname === '/v1/assistant/handoff') {
    if (!body || typeof body.email !== 'string') return jsonResp({ error: 'Valid email required' }, 400);
    const forwarded = await forwardConversationEmail({
      env,
      email: body.email,
      lang: typeof body.lang === 'string' ? body.lang : 'en',
      history: Array.isArray(body.history) ? body.history.slice(-6) : [],
      message: typeof body.message === 'string' ? body.message : '',
      source: 'web',
    });
    if (!forwarded.ok) return jsonResp({ error: forwarded.error }, forwarded.status);
    return jsonResp({ accepted: true, reference: forwarded.reference }, 202);
  }

  return jsonResp({ error: 'Not found' }, 404);
}
