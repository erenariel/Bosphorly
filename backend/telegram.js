import {
  ASSISTANT_MESSAGES,
  detectLanguage,
  forwardConversationEmail,
  isAffirmative,
  isNegative,
  redactSensitive,
  runAssistant,
} from './assistant.js';

export const TG_TEXT = {
  welcome: {
    tr: 'Merhaba! Ben Bosphorly İstanbul danışmanın. Havalimanı transferleri, Boğaz turları, hamam, şehir turları veya İstanbul gezi önerileri hakkında sorabilir ya da ekibimize ulaşmak için "insanla konuşmak istiyorum" yazabilirsin.',
    en: 'Hello! I am your Bosphorly Istanbul advisor. Ask me about airport transfers, Bosphorus cruises, hammams, city tours, or Istanbul tips—or type "talk to a human" to reach our team.',
    ru: 'Здравствуйте! Я ваш консультант Bosphorly по Стамбулу. Спрашивайте о трансферах, круизах по Босфору, хаммамах, турах и советах по городу или напишите «человек», чтобы связаться с командой.',
    uk: 'Вітаю! Я ваш консультант Bosphorly у Стамбулі. Запитуйте про трансфери, круїзи Босфором, хамами, тури та поради щодо міста або напишіть «оператор», щоб зв’язатися з командою.',
    de: 'Hallo! Ich bin Ihr Bosphorly-Berater für Istanbul. Fragen Sie mich nach Flughafentransfers, Bosporus-Fahrten, Hamam, Touren oder Istanbul-Tipps—oder schreiben Sie „Mit Team sprechen“.',
    fr: 'Bonjour ! Je suis votre conseiller Bosphorly à Istanbul. Posez vos questions sur les transferts, croisières sur le Bosphore, hammams, visites ou conseils locaux—ou écrivez « parler à un humain ».',
    nl: 'Hallo! Ik ben je Bosphorly-adviseur voor Istanbul. Stel vragen over transfers, Bosporuscruises, hamam, tours of tips voor Istanbul—of typ „spreek met een medewerker“.',
    ar: 'مرحبًا! أنا مستشارك من Bosphorly في إسطنبول. اسألني عن النقل من المطار، رحلات البوسفور، الحمّام، جولات المدينة أو نصائح السفر—أو اكتب "التحدث مع موظف" للتواصل مع فريقنا.',
    he: 'שלום! אני היועץ של Bosphorly באיסטנבול. שאלו אותי על הסעות, שייט בבוספורוס, חמאם, סיורים וטיפים—או כתבו "לדבר עם נציג".',
    az: 'Salam! Mən Bosphorly İstanbul məsləhətçinizəm. Transferlər, Boğaz turları, hamam, şəhər gəzintiləri və ya İstanbul məsləhətləri barədə soruşun, yaxud "insanla danış" yazın.',
    fa: 'سلام! من مشاور Bosphorly در استانبول هستم. درباره ترانسفر، کروز بسفر، حمام، تورها یا راهنمای استانبول بپرسید یا برای گفتگو با تیم بنویسید «گفتگو با کارشناس».',
    es: '¡Hola! Soy tu asesor de Bosphorly en Estambul. Pregunta por traslados, cruceros por el Bósforo, hammam, tours o consejos locales—o escribe «hablar con una persona».',
    it: 'Ciao! Sono il tuo consulente Bosphorly a Istanbul. Chiedi pure su transfer, crociere sul Bosforo, hammam, tour o consigli—oppure scrivi «parla con il team».',
    pt: 'Olá! Sou seu consultor da Bosphorly em Istambul. Pergunte sobre traslados, cruzeiros pelo Bósforo, hammam, passeios ou dicas—ou digite «falar com atendimento».',
    hr: 'Pozdrav! Ja sam vaš Bosphorly savjetnik za Istanbul. Pitajte o transferima, krstarenjima Bosporom, hamamu, turama ili savjetima—ili napišite „razgovaraj s osobom“.',
    hu: 'Szia! A Bosphorly isztambuli tanácsadója vagyok. Kérdezz transzferekről, boszporuszi hajózásról, hamamról, túrákról vagy tippekről—vagy írd be: „beszélj munkatárssal”.',
    bs: 'Zdravo! Ja sam vaš Bosphorly savjetnik za Istanbul. Pitajte o transferima, krstarenjima Bosporom, hamamu, turama ili savjetima—ili napišite „razgovaraj s osobom“.',
    zh: '您好！我是您的 Bosphorly 伊斯坦布尔旅行顾问。欢迎咨询机场接送、博斯普鲁斯游船、土耳其浴、城市游览或当地攻略—也可以输入“联系人工客服”。',
    ja: 'こんにちは！Bosphorlyのイスタンブール案内担当です。空港送迎、クルーズ、ハマム、市内ツアーや観光のコツをお気軽にお尋ねください。「スタッフに相談」と入力するとチームにお繋ぎします。',
    ko: '안녕하세요! Bosphorly 이스탄불 여행 어드바이저입니다. 공항 픽업, 보스포루스 크루즈, 하맘, 시티 투어나 여행 팁을 물어보세요. 팀 연결은 “상담원 연결”을 입력하세요.',
    hi: 'नमस्ते! मैं आपका Bosphorly इस्तांबुल सलाहकार हूँ। ट्रांसफ़र, बोस्फोरस क्रूज़, हम्माम, सिटी टूर या यात्रा सुझावों के बारे में पूछें—या टीम से जुड़ने के लिए "टीम से बात करें" लिखें।',
    bn: 'হ্যালো! আমি আপনার Bosphorly ইস্তাম্বুল পরামর্শদাতা। ট্রান্সফার, বসফরাস ক্রুজ, হামাম, সিটি ট্যুর বা ভ্রমণ টিপস নিয়ে জিজ্ঞাসা করুন—অথবা টিমের সাথে কথা বলতে "মানুষের সাথে কথা বলুন" লিখুন।',
    id: 'Halo! Saya penasihat Bosphorly Anda untuk Istanbul. Tanyakan tentang transfer bandara, pelayaran Bosphorus, hamam, tur kota, atau tips lokal—atau ketik "bicara dengan tim".',
  },
  askEmail: {
    tr: 'Mesajınızı info@bosphorly.com ekibimize iletmem için lütfen e-posta adresinizi yazın (iptal etmek için /cancel).',
    en: 'Please reply with your email address so I can forward your message to our team at info@bosphorly.com (or /cancel).',
    ru: 'Пожалуйста, укажите ваш e-mail, чтобы я передал сообщение нашей команде на info@bosphorly.com (или /cancel).',
    uk: 'Будь ласка, вкажіть ваш e-mail, щоб я передав повідомлення команді на info@bosphorly.com (або /cancel).',
    de: 'Bitte nennen Sie Ihre E-Mail-Adresse, damit ich Ihre Nachricht an info@bosphorly.com weiterleiten kann (oder /cancel).',
    fr: 'Merci d’indiquer votre adresse e-mail afin que je transmette votre message à info@bosphorly.com (ou /cancel).',
    nl: 'Stuur je e-mailadres zodat ik je bericht kan doorsturen naar info@bosphorly.com (of /cancel).',
    ar: 'يرجى إرسال بريدك الإلكتروني لأتمكن من تحويل رسالتك إلى فريقنا على info@bosphorly.com (أو /cancel).',
    he: 'אנא שלחו את כתובת הדוא״ל שלכם כדי שאעביר את הפנייה לצוות ב-info@bosphorly.com (או /cancel).',
    az: 'Mesajınızı info@bosphorly.com komandamıza yönləndirmək üçün e-poçt ünvanınızı yazın (ləğv etmək üçün /cancel).',
    fa: 'لطفاً ایمیل خود را بفرستید تا پیامتان را به تیم ما در info@bosphorly.com ارسال کنم (یا /cancel).',
    es: 'Por favor, responde con tu correo electrónico para enviarlo a info@bosphorly.com (o /cancel).',
    it: 'Rispondi con la tua e-mail così posso inoltrare il messaggio a info@bosphorly.com (o /cancel).',
    pt: 'Responda com seu e-mail para que eu encaminhe sua mensagem para info@bosphorly.com (ou /cancel).',
    hr: 'Odgovorite svojom e-mail adresom kako bih poruku proslijedio timu na info@bosphorly.com (ili /cancel).',
    hu: 'Kérlek, írd meg az e-mail címed, hogy továbbítsam az üzeneted az info@bosphorly.com címre (vagy /cancel).',
    bs: 'Odgovorite svojom e-mail adresom kako bih poruku proslijedio timu na info@bosphorly.com (ili /cancel).',
    zh: '请回复您的电子邮箱地址，以便我将消息转发至 info@bosphorly.com（取消请输入 /cancel）。',
    ja: 'info@bosphorly.com へ引き継ぐためメールアドレスをご返信ください（中止は /cancel）。',
    ko: 'info@bosphorly.com 팀에 전달할 수 있도록 이메일 주소를 입력해 주세요(취소는 /cancel).',
    hi: 'कृपया अपना ईमेल पता लिखें ताकि मैं आपका संदेश info@bosphorly.com पर हमारी टीम को भेज सकूँ (या /cancel)।',
    bn: 'আপনার বার্তা info@bosphorly.com-এ পাঠাতে অনুগ্রহ করে আপনার ইমেইল ঠিকানা লিখুন (বাতিল করতে /cancel)।',
    id: 'Silakan balas dengan alamat email Anda agar saya dapat meneruskannya ke info@bosphorly.com (atau /cancel).',
  },
  forwarded: {
    tr: 'Teşekkürler! Mesajınız ve son konuşmamız info@bosphorly.com ekibimize iletildi. En kısa sürede e-posta ile dönüş yapacağız.',
    en: 'Thank you! Your message and recent conversation have been forwarded to info@bosphorly.com. Our team will reply by email shortly.',
    ru: 'Спасибо! Ваше сообщение и недавняя переписка отправлены на info@bosphorly.com. Наша команда скоро ответит по e-mail.',
    uk: 'Дякуємо! Ваше повідомлення та нещодавнє листування надіслано на info@bosphorly.com. Команда незабаром відповість на e-mail.',
    de: 'Vielen Dank! Ihre Nachricht wurde an info@bosphorly.com weitergeleitet. Unser Team antwortet in Kürze per E-Mail.',
    fr: 'Merci ! Votre message et l’historique récent ont été transmis à info@bosphorly.com. Notre équipe vous répondra rapidement par e-mail.',
    nl: 'Bedankt! Je bericht en recente gesprek zijn doorgestuurd naar info@bosphorly.com. Ons team reageert snel per e-mail.',
    ar: 'شكرًا لك! تم إرسال رسالتك والمحادثة الأخيرة إلى info@bosphorly.com. سيتواصل معك فريقنا عبر البريد الإلكتروني قريبًا.',
    he: 'תודה! הפנייה והשיחה האחרונה הועברו ל-info@bosphorly.com. הצוות שלנו יחזור אליכם בדוא״ל בהקדם.',
    az: 'Təşəkkür edirik! Mesajınız və son söhbət info@bosphorly.com ünvanına göndərildi. Komandamız tezliklə e-poçtla cavab verəcək.',
    fa: 'متشکرم! پیام و گفتگوی اخیر شما به info@bosphorly.com ارسال شد. تیم ما به‌زودی از طریق ایمیل پاسخ می‌دهد.',
    es: '¡Gracias! Tu mensaje y la conversación reciente se enviaron a info@bosphorly.com. Te responderemos pronto por correo.',
    it: 'Grazie! Il messaggio e la conversazione recente sono stati inoltrati a info@bosphorly.com. Il team risponderà presto via e-mail.',
    pt: 'Obrigado! Sua mensagem e a conversa recente foram enviadas para info@bosphorly.com. Nossa equipe responderá por e-mail em breve.',
    hr: 'Hvala! Vaša poruka i nedavni razgovor proslijeđeni su na info@bosphorly.com. Tim će uskoro odgovoriti e-mailom.',
    hu: 'Köszönjük! Üzenetedet és az előzményeket továbbítottuk az info@bosphorly.com címre. Csapatunk hamarosan válaszol.',
    bs: 'Hvala! Vaša poruka i nedavni razgovor proslijeđeni su na info@bosphorly.com. Tim će uskoro odgovoriti e-mailom.',
    zh: '谢谢！您的消息与近期对话已转发至 info@bosphorly.com，我们的团队会尽快通过邮件回复您。',
    ja: 'ありがとうございます！メッセージと直近の会話内容を info@bosphorly.com へ転送しました。担当よりメールでご返信いたします。',
    ko: '감사합니다! 메시지와 최근 대화가 info@bosphorly.com으로 전달되었습니다. 곧 이메일로 답변드리겠습니다.',
    hi: 'धन्यवाद! आपका संदेश और हाल की बातचीत info@bosphorly.com पर भेज दी गई है। हमारी टीम जल्द ईमेल से जवाब देगी।',
    bn: 'ধন্যবাদ! আপনার বার্তা ও সাম্প্রতিক কথোপকথন info@bosphorly.com-এ পাঠানো হয়েছে। আমাদের টিম শীঘ্রই ইমেইলে উত্তর দেবে।',
    id: 'Terima kasih! Pesan dan percakapan terbaru Anda telah diteruskan ke info@bosphorly.com. Tim kami akan segera membalas via email.',
  },
  forwardFailed: {
    tr: 'Şu an e-posta iletiminde sorun oluştu. Lütfen doğrudan info@bosphorly.com adresine yazın.',
    en: 'Could not forward right now. Please email us directly at info@bosphorly.com.',
    ru: 'Не удалось отправить сообщение. Пожалуйста, напишите напрямую на info@bosphorly.com.',
    uk: 'Не вдалося надіслати повідомлення. Будь ласка, напишіть напряму на info@bosphorly.com.',
    de: 'Weiterleitung gerade nicht möglich. Bitte schreiben Sie direkt an info@bosphorly.com.',
    fr: 'Impossible de transmettre pour le moment. Écrivez directement à info@bosphorly.com.',
    nl: 'Doorsturen lukt nu niet. Mail rechtstreeks naar info@bosphorly.com.',
    ar: 'تعذر الإرسال حاليًا. يرجى مراسلتنا مباشرة على info@bosphorly.com.',
    he: 'לא ניתן להעביר כרגע. אנא כתבו ישירות אל info@bosphorly.com.',
    az: 'Hazırda e-poçt göndərilə bilmədi. Zəhmət olmasa birbaşa info@bosphorly.com ünvanına yazın.',
    fa: 'ارسال ایمیل در حال حاضر ممکن نشد. لطفاً مستقیماً به info@bosphorly.com پیام دهید.',
    es: 'No se pudo reenviar ahora. Escríbenos directamente a info@bosphorly.com.',
    it: 'Impossibile inoltrare ora. Scrivi direttamente a info@bosphorly.com.',
    pt: 'Não foi possível encaminhar agora. Escreva diretamente para info@bosphorly.com.',
    hr: 'Trenutačno nije moguće proslijediti. Pišite izravno na info@bosphorly.com.',
    hu: 'Most nem sikerült továbbítani. Kérjük, írj közvetlenül az info@bosphorly.com címre.',
    bs: 'Trenutno nije moguće proslijediti. Pišite direktno na info@bosphorly.com.',
    zh: '暂时无法转发邮件，请直接发送邮件至 info@bosphorly.com。',
    ja: '現在メールを送信できませんでした。直接 info@bosphorly.com までご連絡ください。',
    ko: '지금은 이메일 전달에 실패했습니다. info@bosphorly.com으로 직접 메일을 보내주세요.',
    hi: 'अभी ईमेल नहीं भेजा जा सका। कृपया सीधे info@bosphorly.com पर ईमेल करें।',
    bn: 'এই মুহূর্তে পাঠানো যায়নি। অনুগ্রহ করে সরাসরি info@bosphorly.com-এ ইমেইল করুন।',
    id: 'Gagal meneruskan saat ini. Silakan kirim email langsung ke info@bosphorly.com.',
  },
  cancelled: {
    tr: 'İletme işlemi iptal edildi. Başka bir sorunuz varsa yazabilirsiniz.',
    en: 'Forwarding cancelled. Feel free to ask another question.',
    ru: 'Отправка отменена. Можете задать другой вопрос.',
    uk: 'Надсилання скасовано. Можете поставити інше запитання.',
    de: 'Weiterleitung abgebrochen. Stellen Sie gerne eine weitere Frage.',
    fr: 'Transfert annulé. N’hésitez pas à poser une autre question.',
    nl: 'Doorsturen geannuleerd. Stel gerust een andere vraag.',
    ar: 'تم إلغاء الإرسال. يمكنك طرح سؤال آخر.',
    he: 'ההעברה בוטלה. מוזמנים לשאול שאלה נוספת.',
    az: 'Yönləndirmə ləğv edildi. Başqa sualınız varsa yaza bilərsiniz.',
    fa: 'ارسال لغو شد. اگر سوال دیگری دارید بفرمایید.',
    es: 'Envío cancelado. Puedes hacer otra pregunta cuando quieras.',
    it: 'Inoltro annullato. Puoi fare un’altra domanda quando vuoi.',
    pt: 'Encaminhamento cancelado. Fique à vontade para fazer outra pergunta.',
    hr: 'Prosljeđivanje otkazano. Slobodno postavite drugo pitanje.',
    hu: 'Továbbítás törölve. Nyugodtan tegyél fel másik kérdést.',
    bs: 'Prosljeđivanje otkazano. Slobodno postavite drugo pitanje.',
    zh: '已取消转发。如有其他问题，欢迎随时提问。',
    ja: '転送をキャンセルしました。他にご質問があればどうぞ。',
    ko: '전달이 취소되었습니다. 다른 질문이 있으시면 말씀해 주세요.',
    hi: 'भेजना रद्द किया गया। कोई अन्य प्रश्न हो तो पूछें।',
    bn: 'পাঠানো বাতিল হয়েছে। অন্য কোনো প্রশ্ন থাকলে জিজ্ঞাসা করতে পারেন।',
    id: 'Penerusan dibatalkan. Silakan ajukan pertanyaan lain.',
  },
};

function t(key, lang) {
  return (TG_TEXT[key] && (TG_TEXT[key][lang] || TG_TEXT[key].en)) || '';
}

function declinedMsg(lang) {
  return (ASSISTANT_MESSAGES.handoffDeclined && (ASSISTANT_MESSAGES.handoffDeclined[lang] || ASSISTANT_MESSAGES.handoffDeclined.en)) || '';
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
  return {
    pendingHandoff: Number(row.pending_handoff || 0),
    lang: row.lang || 'en',
    history: Array.isArray(history) ? history : [],
  };
}

async function saveState(env, chatId, pendingHandoff, lang, history) {
  if (!env.DB) return;
  const trimmed = (Array.isArray(history) ? history : []).slice(-6);
  const mode = typeof pendingHandoff === 'number' ? pendingHandoff : (pendingHandoff ? 1 : 0);
  await env.DB.prepare(
    `INSERT INTO telegram_handoff_state (chat_id, pending_handoff, lang, context_json, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(chat_id) DO UPDATE SET pending_handoff = excluded.pending_handoff, lang = excluded.lang,
       context_json = excluded.context_json, updated_at = excluded.updated_at`
  ).bind(String(chatId), mode, lang, JSON.stringify(trimmed), Date.now()).run();
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

  if (/^\/cancel\b|^iptal$/i.test(text) && state && state.pendingHandoff > 0) {
    await clearState(env, chatId);
    await sendTelegramMessage(env, chatId, t('cancelled', state.lang || lang));
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  if (state && state.pendingHandoff === 1) {
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

  if (state && state.pendingHandoff === 2) {
    const activeLang = state.lang || lang;
    if (isAffirmative(text)) {
      const linkedEmail = await findLinkedMemberEmail(env, telegramId);
      if (linkedEmail) {
        const forwarded = await forwardConversationEmail({
          env,
          email: linkedEmail,
          lang: activeLang,
          history: state.history,
          message: text,
          source: 'telegram',
          meta: { telegramUser: tgUser },
        });
        await clearState(env, chatId);
        await sendTelegramMessage(env, chatId, forwarded.ok ? t('forwarded', activeLang) : t('forwardFailed', activeLang));
        return new Response(JSON.stringify({ ok: true, handoff: true, forwarded: forwarded.ok }), { status: 200 });
      }
      await saveState(env, chatId, 1, activeLang, state.history);
      await sendTelegramMessage(env, chatId, t('askEmail', activeLang));
      return new Response(JSON.stringify({ ok: true, handoff: true }), { status: 200 });
    }
    if (isNegative(text)) {
      const reply = declinedMsg(activeLang);
      const nextHistory = [
        ...state.history,
        { role: 'user', content: redactSensitive(text).text },
        { role: 'assistant', content: reply },
      ].slice(-6);
      await saveState(env, chatId, 0, activeLang, nextHistory);
      await sendTelegramMessage(env, chatId, reply);
      return new Response(JSON.stringify({ ok: true, handoff: false }), { status: 200 });
    }
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

  if (res.handoffOffer) {
    await saveState(env, chatId, 2, res.lang || lang, nextHistory);
    await sendTelegramMessage(env, chatId, res.reply);
    return new Response(JSON.stringify({ ok: true, handoffOffer: true }), { status: 200 });
  }

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
    await saveState(env, chatId, 1, res.lang || lang, nextHistory);
    await sendTelegramMessage(env, chatId, `${res.reply}\n\n${t('askEmail', res.lang || lang)}`);
  } else {
    await saveState(env, chatId, 0, res.lang || lang, nextHistory);
    await sendTelegramMessage(env, chatId, res.reply);
  }

  return new Response(JSON.stringify({ ok: true, handoff: Boolean(res.handoff) }), { status: 200 });
}
