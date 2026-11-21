import { detectLanguage, forwardConversationEmail, redactSensitive, runAssistant } from './assistant.js';

const TG_TEXT = {
  welcome: {
    tr: 'Merhaba! Ben Bosphorly asistanıyım. İstanbul turları, Boğaz gezileri, hamam ve havalimanı transferleri hakkında soru sorabilir veya ekibimize ulaşmak için "insanla konuşmak istiyorum" yazabilirsiniz.',
    en: 'Hello! I am the Bosphorly assistant. Ask me about Istanbul tours, Bosphorus cruises, hammams, or airport transfers—or type "talk to a human" to reach our team.',
    ru: 'Здравствуйте! Я ассистент Bosphorly. Спрашивайте о турах по Стамбулу, круизах по Босфору, хаммамах и трансферах из аэропорта или напишите «человек», чтобы связаться с командой.',
    ar: 'مرحبًا! أنا مساعد Bosphorly. اسألني عن جولات إسطنبول ورحلات البوسفور والحمّام التركي والنقل من المطار، أو اكتب "التحدث مع موظف" للتواصل مع فريقنا.',
  },
  askEmail: {
    tr: 'Mesajınızı info@bosphorly.com ekibimize iletmem için lütfen e-posta adresinizi yazın (iptal etmek için /cancel).',
    en: 'Please reply with your email address so I can forward your message to our team at info@bosphorly.com (or /cancel).',
    ru: 'Пожалуйста, укажите ваш e-mail, чтобы я передал сообщение нашей команде на info@bosphorly.com (или /cancel).',
    ar: 'يرجى إرسال بريدك الإلكتروني لأتمكن من تحويل رسالتك إلى فريقنا على info@bosphorly.com (أو /cancel).',
  },
  forwarded: {
    tr: 'Teşekkürler! Mesajınız ve son konuşmamız info@bosphorly.com ekibimize iletildi. En kısa sürede e-posta ile dönüş yapacağız.',
    en: 'Thank you! Your message and recent conversation have been forwarded to info@bosphorly.com. Our team will reply by email shortly.',
    ru: 'Спасибо! Ваше сообщение и недавняя переписка отправлены на info@bosphorly.com. Наша команда скоро ответит по e-mail.',
    ar: 'شكرًا لك! تم إرسال رسالتك والمحادثة الأخيرة إلى info@bosphorly.com. سيتواصل معك فريقنا عبر البريد الإلكتروني قريبًا.',
  },
  forwardFailed: {
    tr: 'Şu an e-posta iletiminde sorun oluştu. Lütfen doğrudan info@bosphorly.com adresine yazın.',
    en: 'Could not forward right now. Please email us directly at info@bosphorly.com.',
    ru: 'Не удалось отправить сообщение. Пожалуйста, напишите напрямую на info@bosphorly.com.',
    ar: 'تعذر الإرسال حاليًا. يرجى مراسلتنا مباشرة على info@bosphorly.com.',
  },
  cancelled: {
    tr: 'İletme işlemi iptal edildi. Başka bir sorunuz varsa yazabilirsiniz.',
    en: 'Forwarding cancelled. Feel free to ask another question.',
    ru: 'Отправка отменена. Можете задать другой вопрос.',
    ar: 'تم إلغاء الإرسال. يمكنك طرح سؤال آخر.',
  },
};

function t(key, lang) {
  return (TG_TEXT[key] && (TG_TEXT[key][lang] || TG_TEXT[key].en)) || '';
}

export async function computeTelegramWebhookSecret(pepper) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(String(pepper)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode('tg-webhook'));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sendTelegramMessage(env, chatId, text) {
  if (!env.TELEGRAM_BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

async function findLinkedMemberEmail(env, telegramId) {
  if (!env || !env.DB || !telegramId) return null;
  try {
    const row = await env.DB.prepare(
      `SELECT m.email FROM member_identities mi
       JOIN members m ON m.id = mi.member_id
       WHERE mi.provider = 'telegram' AND mi.subject = ?`
    ).bind(String(telegramId)).first();
    return row && row.email ? String(row.email) : null;
  } catch {
    return null;
  }
}

async function getState(env, chatId) {
  if (!env.DB) return null;
  const row = await env.DB.prepare(
    'SELECT pending_handoff, lang, context_json, updated_at FROM telegram_handoff_state WHERE chat_id = ?'
  ).bind(String(chatId)).first();
  if (!row) return null;
  if (Date.now() - Number(row.updated_at || 0) > 30 * 60 * 1000) {
    await env.DB.prepare('DELETE FROM telegram_handoff_state WHERE chat_id = ?').bind(String(chatId)).run();
    return null;
  }
  let history = [];
  try { history = JSON.parse(row.context_json || '[]'); } catch {}
  return { pendingHandoff: Boolean(row.pending_handoff), lang: row.lang || 'en', history: Array.isArray(history) ? history : [] };
}

async function saveState(env, chatId, pendingHandoff, lang, history) {
  if (!env.DB) return;
  const trimmed = (Array.isArray(history) ? history : []).slice(-6);
  await env.DB.prepare(
    `INSERT INTO telegram_handoff_state (chat_id, pending_handoff, lang, context_json, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(chat_id) DO UPDATE SET pending_handoff = excluded.pending_handoff, lang = excluded.lang,
       context_json = excluded.context_json, updated_at = excluded.updated_at`
  ).bind(String(chatId), pendingHandoff ? 1 : 0, lang, JSON.stringify(trimmed), Date.now()).run();
}

async function clearState(env, chatId) {
  if (!env.DB) return;
  await env.DB.prepare('DELETE FROM telegram_handoff_state WHERE chat_id = ?').bind(String(chatId)).run();
}

export async function handleTelegramWebhook(request, env) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }
  if (!env || !env.CODE_PEPPER) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const sig = request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '';
  const expected = await computeTelegramWebhookSecret(env.CODE_PEPPER);
  if (!sig || !constantTimeEqual(sig, expected)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  let update;
  try {
    update = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const msg = update && update.message;
  if (!msg || !msg.chat || msg.chat.type !== 'private' || typeof msg.text !== 'string' || !msg.text.trim()) {
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  const chatId = String(msg.chat.id);
  const telegramId = String((msg.from && msg.from.id) || chatId);
  const tgUser = msg.from && msg.from.username ? `@${msg.from.username}` : '';
  const text = msg.text.trim();
  const telegramLang = (msg.from && msg.from.language_code) || '';
  const lang = detectLanguage({ message: text, telegramLang });

  if (/^\/(start|help)\b/i.test(text)) {
    await clearState(env, chatId);
    await sendTelegramMessage(env, chatId, t('welcome', lang));
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  const state = await getState(env, chatId);

  if (/^\/cancel\b|^iptal$/i.test(text) && state && state.pendingHandoff) {
    await clearState(env, chatId);
    await sendTelegramMessage(env, chatId, t('cancelled', state.lang || lang));
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  if (state && state.pendingHandoff) {
    const emailMatch = text.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
    if (!emailMatch) {
      await sendTelegramMessage(env, chatId, t('askEmail', state.lang || lang));
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    const guestEmail = emailMatch[0];
    const forwarded = await forwardConversationEmail({
      env,
      email: guestEmail,
      lang: state.lang || lang,
      history: state.history,
      message: text,
      source: 'telegram',
      meta: { telegramUser: tgUser },
    });
    await clearState(env, chatId);
    await sendTelegramMessage(env, chatId, forwarded.ok ? t('forwarded', state.lang || lang) : t('forwardFailed', state.lang || lang));
    return new Response(JSON.stringify({ ok: true, forwarded: forwarded.ok }), { status: 200 });
  }

  const history = state ? state.history : [];
  const res = await runAssistant({
    message: text,
    telegramLang,
    history,
    env,
    actorKey: `tg:${chatId}`,
  });

  const cleanUser = redactSensitive(text).text;
  const nextHistory = [
    ...history,
    { role: 'user', content: cleanUser },
    { role: 'assistant', content: res.reply },
  ].slice(-6);

  if (res.handoff) {
    const linkedEmail = await findLinkedMemberEmail(env, telegramId);
    if (linkedEmail) {
      const forwarded = await forwardConversationEmail({
        env,
        email: linkedEmail,
        lang: res.lang || lang,
        history,
        message: cleanUser,
        source: 'telegram',
        meta: { telegramUser: tgUser },
      });
      await clearState(env, chatId);
      await sendTelegramMessage(env, chatId, forwarded.ok ? t('forwarded', res.lang || lang) : t('forwardFailed', res.lang || lang));
      return new Response(JSON.stringify({ ok: true, handoff: true, forwarded: forwarded.ok }), { status: 200 });
    }
    await saveState(env, chatId, true, res.lang || lang, nextHistory);
    await sendTelegramMessage(env, chatId, `${res.reply}\n\n${t('askEmail', res.lang || lang)}`);
  } else {
    await saveState(env, chatId, false, res.lang || lang, nextHistory);
    await sendTelegramMessage(env, chatId, res.reply);
  }

  return new Response(JSON.stringify({ ok: true, handoff: Boolean(res.handoff) }), { status: 200 });
}
