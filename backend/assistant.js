import knowledge from './knowledge.json' with { type: 'json' };
import {
  TIME_HUMOR_NOTES,
  REGISTER_GUIDES,
  ANTI_REPEAT_RULE,
  getFewShotsPromptBlock,
  stripModelThinking,
  extractFlagsTag,
  enforceMaxEmojis,
  enforceEthicalBoundary,
  buildKbPriceIndex,
  enforcePriceSafetyBelt,
  detectReplyLanguage,
  isRepetitiveAgainstHistory,
} from './mimo-personality.js';
import {
  formatNoteForPrompt,
  loadConsentedNote,
  observeAssistantTurn,
  resolveMemberAuth,
  runInBackground,
  recordVoteMetric,
} from './mimo.js';

const KB_PRICE_PAIRS = buildKbPriceIndex(knowledge);

export const ASSISTANT_MODEL = '@cf/google/gemma-4-26b-a4b-it';
// Multilingual ASR, zero data retention. Verified 2026-11-22:
// https://developers.cloudflare.com/workers-ai/models/whisper-large-v3-turbo/
// @cf/openai/whisper-tiny-en is English-only and deprecated.
export const WHISPER_MODEL = '@cf/openai/whisper-large-v3-turbo';
export const TRANSCRIBE_MAX_BYTES = 1024 * 1024;
export const SPEECH_LOCALES = Object.freeze({
  ar: 'ar-SA', az: 'az-AZ', bn: 'bn-BD', bs: 'bs-BA', de: 'de-DE', en: 'en-US',
  es: 'es-ES', fa: 'fa-IR', fr: 'fr-FR', he: 'he-IL', hi: 'hi-IN', hr: 'hr-HR',
  hu: 'hu-HU', id: 'id-ID', it: 'it-IT', ja: 'ja-JP', ko: 'ko-KR', nl: 'nl-NL',
  pt: 'pt-PT', ru: 'ru-RU', tr: 'tr-TR', uk: 'uk-UA', zh: 'zh-CN',
});
export function speechLocale(lang) {
  const code = String(lang || '').toLowerCase().split(/[-_]/)[0];
  return SPEECH_LOCALES[code] || 'en-US';
}
export const SUPPORTED_LANGS = new Set([
  'ar', 'az', 'bn', 'bs', 'de', 'en', 'es', 'fa', 'fr', 'he', 'hi', 'hr',
  'hu', 'id', 'it', 'ja', 'ko', 'nl', 'pt', 'ru', 'tr', 'uk', 'zh'
]);

export const PER_MIN_LIMIT = 6;
export const GUEST_DAILY_LIMIT = 15;
export const SILVER_DAILY_LIMIT = 60;
export const GOLD_DAILY_LIMIT = 120;
export const PLATINUM_DAILY_LIMIT = 120;
export const IP_DAILY_LIMIT = 150;
export const STT_PER_DAY_LIMIT = 40;
const DEFAULT_GLOBAL_DAILY_LIMIT = 200;
export const AI_TIMEOUT_MS = 9000;

export function chatDailyLimitForTier(tier) {
  switch (String(tier || '').toLowerCase()) {
    case 'platinum':
      return PLATINUM_DAILY_LIMIT;
    case 'gold':
      return GOLD_DAILY_LIMIT;
    case 'silver':
      return SILVER_DAILY_LIMIT;
    default:
      return GUEST_DAILY_LIMIT;
  }
}

const memoryLimits = new Map();
const memoryFeedback = new Map();
const memoryBlocks = new Map();

export const WEB_BLOCK_MS = 24 * 60 * 60 * 1000;
export const TG_FIRST_BLOCK_MS = 7 * 24 * 60 * 60 * 1000;
export const TG_REPEAT_BLOCK_MS = 30 * 24 * 60 * 60 * 1000;

export const TIME_GREETINGS = {
  morning: {
    tr: 'Günaydın', en: 'Good morning', ru: 'Доброе утро', uk: 'Добрий ранок',
    de: 'Guten Morgen', fr: 'Bonjour', nl: 'Goedemorgen', ar: 'صباح الخير',
    he: 'בוקר טוב', az: 'Sabahınız xeyir', fa: 'صبح بخیر', es: 'Buenos días',
    it: 'Buongiorno', pt: 'Bom dia', hr: 'Dobro jutro', hu: 'Jó reggelt',
    bs: 'Dobro jutro', zh: '早上好', ja: 'おはようございます', ko: '좋은 아침이에요',
    hi: 'सुप्रभात', bn: 'শুভ সকাল', id: 'Selamat pagi',
  },
  afternoon: {
    tr: 'İyi günler', en: 'Good afternoon', ru: 'Добрый день', uk: 'Добрий день',
    de: 'Guten Tag', fr: 'Bonjour', nl: 'Goedemiddag', ar: 'طاب يومك',
    he: 'צהריים טובים', az: 'Günortanız xeyir', fa: 'روز بخیر', es: 'Buenas tardes',
    it: 'Buon pomeriggio', pt: 'Boa tarde', hr: 'Dobar dan', hu: 'Jó napot',
    bs: 'Dobar dan', zh: '下午好', ja: 'こんにちは', ko: '좋은 오후예요',
    hi: 'नमस्कार', bn: 'শুভ অপরাহ্ন', id: 'Selamat siang',
  },
  evening: {
    tr: 'İyi akşamlar', en: 'Good evening', ru: 'Добрый вечер', uk: 'Добрий вечір',
    de: 'Guten Abend', fr: 'Bonsoir', nl: 'Goedenavond', ar: 'مساء الخير',
    he: 'ערב טוב', az: 'Axşamınız xeyir', fa: 'عصر بخیر', es: 'Buenas noches',
    it: 'Buonasera', pt: 'Boa noite', hr: 'Dobra večer', hu: 'Jó estét',
    bs: 'Dobro veče', zh: '晚上好', ja: 'こんばんは', ko: '좋은 저녁이에요',
    hi: 'शुभ संध्या', bn: 'শুভ সন্ধ্যা', id: 'Selamat malam',
  },
};

export function getIstanbulTimeSlot(now = Date.now()) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Istanbul',
      hour: 'numeric',
      hour12: false,
    }).formatToParts(new Date(now));
    const hPart = parts.find((p) => p.type === 'hour');
    const hour = hPart ? Number(hPart.value) % 24 : 12;
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    return 'evening';
  } catch {
    const utcHour = (new Date(now).getUTCHours() + 3) % 24;
    if (utcHour >= 5 && utcHour < 12) return 'morning';
    if (utcHour >= 12 && utcHour < 18) return 'afternoon';
    return 'evening';
  }
}

export function getIstanbulGreeting(lang = 'en', now = Date.now()) {
  const slot = getIstanbulTimeSlot(now);
  const table = TIME_GREETINGS[slot] || TIME_GREETINGS.afternoon;
  return table[lang] || table.en;
}

export const ASSISTANT_MESSAGES = {
  greeting: {
    tr: 'Merhaba! Ben Bosphorly’nin yapay zekâ asistanı Mimo 🌊 Havalimanı transferleri, Boğaz turları, hamam deneyimleri ve İstanbul gezi önerileri için yanındayım. İstanbul’a ne zaman geliyorsun?',
    en: 'Hello! I am Mimo, Bosphorly’s AI assistant 🌊 I can help with airport transfers, Bosphorus cruises, hammam experiences, city tours, and local Istanbul tips. When are you visiting Istanbul?',
    ru: 'Привет! Я Mimo — ИИ-ассистент Bosphorly по Стамбулу 🌊 Помогу с трансферами из аэропорта, круизами по Босфору, хаммамом, турами и советами по городу. Когда ты приезжаешь в Стамбул?',
    uk: 'Привіт! Я Mimo — ШІ-асистент Bosphorly у Стамбулі 🌊 Допоможу з трансферами з аеропорту, круїзами Босфором, хамамом, турами та порадами щодо міста. Коли ти плануєш приїхати до Стамбула?',
    de: 'Hallo! Ich bin Mimo, der KI-Assistent von Bosphorly für Istanbul 🌊 Ich helfe dir gern bei Flughafentransfers, Bosporus-Fahrten, Hamam, Stadttouren und Istanbul-Tipps. Wann reist du nach Istanbul?',
    fr: 'Salut ! Je suis Mimo, l’assistant IA de Bosphorly à Istanbul 🌊 Je peux t’aider pour les transferts aéroport, croisières sur le Bosphore, hammams, visites et conseils locaux. Quand viens-tu à Istanbul ?',
    nl: 'Hallo! Ik ben Mimo, de AI-assistent van Bosphorly voor Istanbul 🌊 Ik help je graag met luchthaventransfers, Bosporuscruises, hamam, stadstours en tips voor Istanbul. Wanneer kom je naar Istanbul?',
    ar: 'مرحبًا! أنا Mimo، مساعد الذكاء الاصطناعي من Bosphorly في إسطنبول 🌊 يمكنني مساعدتك في النقل من المطار، رحلات البوسفور، الحمّام التركي، جولات المدينة ونصائح السفر. متى ستزور إسطنبول؟',
    he: 'היי! אני Mimo, עוזר הבינה המלאכותית של Bosphorly באיסטנבול 🌊 אשמח לעזור עם הסעות משדה התעופה, שייט בבוספורוס, חמאם, סיורים וטיפים מקומיים. מתי הטיול שלך לאיסטנבול?',
    az: 'Salam! Mən Bosphorly-nin süni intellekt köməkçisi Mimo 🌊 Hava limanı transferləri, Boğaz turları, hamam, şəhər gəzintiləri və İstanbul tövsiyələri ilə kömək edə bilərəm. İstanbula nə vaxt gəlirsən?',
    fa: 'سلام! من Mimo، دستیار هوش مصنوعی Bosphorly در استانبول هستم 🌊 می‌توانم درباره ترانسفر فرودگاه، کروز بسفر، حمام ترکی، تورهای شهری و راهنمای استانبول کمکت کنم. چه زمانی به استانبول می‌آیی؟',
    es: '¡Hola! Soy Mimo, el asistente de IA de Bosphorly en Estambul 🌊 Puedo ayudarte con traslados al aeropuerto, cruceros por el Bósforo, hammam, tours y consejos locales. ¿Cuándo viajas a Estambul?',
    it: 'Ciao! Sono Mimo, l’assistente IA di Bosphorly a Istanbul 🌊 Posso aiutarti con transfer aeroportuali, crociere sul Bosforo, hammam, tour e consigli su Istanbul. Quando arrivi a Istanbul?',
    pt: 'Olá! Sou Mimo, o assistente de IA da Bosphorly em Istambul 🌊 Posso ajudar com traslados do aeroporto, cruzeiros pelo Bósforo, hammam, passeios e dicas locais. Quando você vem a Istambul?',
    hr: 'Pozdrav! Ja sam Mimo, Bosphorlyjev AI asistent za Istanbul 🌊 Mogu ti pomoći oko transfera, krstarenja Bosporom, hamama, gradskih tura i lokalnih savjeta. Kada dolaziš u Istanbul?',
    hu: 'Szia! Mimo vagyok, a Bosphorly mesterséges intelligencia asszisztense Isztambulban 🌊 Segítek reptéri transzferekben, boszporuszi hajóutakban, hamamban, túrákban és helyi tippekben. Mikor érkezel Isztambulba?',
    bs: 'Zdravo! Ja sam Mimo, Bosphorlyjev AI asistent za Istanbul 🌊 Mogu ti pomoći oko transfera, krstarenja Bosporom, hamama, gradskih tura i lokalnih savjeta. Kada dolaziš u Istanbul?',
    zh: '你好！我是 Bosphorly 的人工智能助手 Mimo 🌊 我可以为你介绍机场接送、博斯普鲁斯游船、土耳其浴、城市观光和伊斯坦布尔实用贴士。你计划什么时候来伊斯坦布尔？',
    ja: 'こんにちは！BosphorlyのAIアシスタント、Mimoです 🌊 空港送迎、ボスポラスクルーズ、ハマム、市内ツアーやイスタンブール観光のコツをご案内します。いつ頃イスタンブールに来られますか？',
    ko: '안녕하세요! Bosphorly의 AI 도우미 Mimo예요 🌊 공항 픽업, 보스포루스 크루즈, 하맘, 시티 투어와 이스탄불 여행 팁을 도와드릴게요. 이스탄불에는 언제 오시나요?',
    hi: 'नमस्ते! मैं Mimo हूँ, Bosphorly का AI सहायक 🌊 मैं एयरपोर्ट ट्रांसफ़र, बोस्फोरस क्रूज़, हम्माम, सिटी टूर और इस्तांबुल यात्रा सुझावों में मदद कर सकता हूँ। तुम इस्तांबुल कब आ रहे हो?',
    bn: 'হ্যালো! আমি Mimo, Bosphorly-এর এআই সহায়ক 🌊 এয়ারপোর্ট ট্রান্সফার, বসফরাস ক্রুজ, হামাম, সিটি ট্যুর এবং ইস্তাম্বুল ভ্রমণ টিপস দিয়ে সাহায্য করতে পারি। তুমি কবে ইস্তাম্বুলে আসছ?',
    id: 'Halo! Saya Mimo, asisten AI Bosphorly untuk Istanbul 🌊 Saya siap membantu info transfer bandara, pelayaran Bosphorus, hamam, tur kota, dan tips lokal. Kapan kamu berkunjung ke Istanbul?',
  },
  aiIdentity: {
    tr: 'Hayır, insan değilim — ben Bosphorly’nin yapay zekâ asistanı Mimo 🌊 İstanbul transferleri, Boğaz turları, hamam ve gezi önerilerinde sana yardımcı olmak için buradayım!',
    en: 'No, I am not human—I am Mimo, Bosphorly’s AI assistant 🌊 I am here to help you with Istanbul airport transfers, Bosphorus cruises, hammam, and travel tips!',
    ru: 'Нет, я не человек — я Mimo, ИИ-ассистент Bosphorly 🌊 Я здесь, чтобы помочь тебе с трансферами, круизами по Босфору, хаммамом и прогулками по Стамбулу!',
    uk: 'Ні, я не людина — я Mimo, ШІ-асистент Bosphorly 🌊 Я тут, щоб допомогти тобі з трансферами, круїзами Босфором, хамамом і порадами щодо Стамбула!',
    de: 'Nein, ich bin kein Mensch — ich bin Mimo, der KI-Assistent von Bosphorly 🌊 Ich helfe dir gern bei Flughafentransfers, Bosporus-Fahrten, Hamam und Istanbul-Tipps!',
    fr: 'Non, je ne suis pas humain — je suis Mimo, l’assistant IA de Bosphorly 🌊 Je suis là pour t’aider avec tes transferts, croisières, hammams et conseils à Istanbul !',
    nl: 'Nee, ik ben geen mens — ik ben Mimo, de AI-assistent van Bosphorly 🌊 Ik help je graag met luchthaventransfers, Bosporuscruises, hamam en tips voor Istanbul!',
    ar: 'لا، لست إنسانًا — أنا Mimo، مساعد الذكاء الاصطناعي من Bosphorly 🌊 أنا هنا لمساعدتك في النقل من المطار، رحلات البوسفور، الحمّام ونصائح إسطنبول!',
    he: 'לא, אני לא אדם — אני Mimo, עוזר הבינה המלאכותית של Bosphorly 🌊 אני כאן כדי לעזור לך עם הסעות, שייט בבוספורוס, חמאם וטיפים לאיסטנבול!',
    az: 'Xeyr, insan deyiləm — mən Bosphorly-nin süni intellekt köməkçisi Mimo-yam 🌊 İstanbul transferləri, Boğaz turları, hamam və gəzinti məsləhətləri üçün buradayam!',
    fa: 'نه، من انسان نیستم — من Mimo، دستیار هوش مصنوعی Bosphorly هستم 🌊 اینجا هستم تا در ترانسفر فرودگاه، کروز بسفر، حمام و راهنمای استانبول کمکت کنم!',
    es: 'No, no soy humano: soy Mimo, el asistente de IA de Bosphorly 🌊 ¡Estoy aquí para ayudarte con traslados, cruceros por el Bósforo, hammam y consejos sobre Estambul!',
    it: 'No, non sono umano: sono Mimo, l’assistente IA di Bosphorly 🌊 Sono qui per aiutarti con transfer, crociere sul Bosforo, hammam e consigli su Istanbul!',
    pt: 'Não, não sou humano — sou Mimo, o assistente de IA da Bosphorly 🌊 Estou aqui para ajudar você com traslados, cruzeiros pelo Bósforo, hammam e dicas de Istambul!',
    hr: 'Ne, nisam čovjek — ja sam Mimo, Bosphorlyjev AI asistent 🌊 Tu sam da ti pomognem oko transfera, krstarenja Bosporom, hamama i savjeta za Istanbul!',
    hu: 'Nem, nem vagyok ember — Mimo vagyok, a Bosphorly mesterséges intelligencia asszisztense 🌊 Azért vagyok itt, hogy segítsek a transzferekben, hajóutakban, hamamban és isztambuli tippekben!',
    bs: 'Ne, nisam čovjek — ja sam Mimo, Bosphorlyjev AI asistent 🌊 Tu sam da ti pomognem oko transfera, krstarenja Bosporom, hamama i savjeta za Istanbul!',
    zh: '不，我不是人类——我是 Bosphorly 的人工智能助手 Mimo 🌊 我在这里为你解答伊斯坦布尔机场接送、博斯普鲁斯游船、土耳其浴和旅行建议！',
    ja: 'いいえ、人間ではありません。私はBosphorlyのAIアシスタント、Mimoです 🌊 空港送迎やボスポラスクルーズ、ハマム、イスタンブール観光のご案内をお手伝いします！',
    ko: '아니요, 저는 사람이 아니라 Bosphorly의 AI 도우미 Mimo예요 🌊 공항 픽업, 보스포루스 크루즈, 하맘과 이스탄불 여행 팁을 도와드리고 있어요!',
    hi: 'नहीं, मैं इंसान नहीं हूँ — मैं Mimo हूँ, Bosphorly का AI सहायक 🌊 मैं एयरपोर्ट ट्रांसफ़र, बोस्फोरस क्रूज़, हम्माम और इस्तांबुल यात्रा सुझावों के लिए यहाँ हूँ!',
    bn: 'না, আমি মানুষ নই — আমি Mimo, Bosphorly-এর এআই সহায়ক 🌊 ইস্তাম্বুল ট্রান্সফার, বসফরাস ক্রুজ, হামাম ও ভ্রমণ টিপস দিয়ে সাহায্য করতে আমি আছি!',
    id: 'Tidak, saya bukan manusia—saya Mimo, asisten AI Bosphorly 🌊 Saya di sini untuk membantu transfer bandara, pelayaran Bosphorus, hamam, dan tips wisata Istanbul!',
  },
  thanks: {
    tr: 'Rica ederim, ne demek! 🌊 Transfer, Boğaz turları, hamam veya İstanbul hakkında başka merak ettiğin bir şey var mı?',
    en: 'You are very welcome! 🌊 Is there anything else I can help you with—airport transfers, Bosphorus cruises, hammam, or city tours?',
    ru: 'Пожалуйста! 🌊 Подсказать тебе ещё что-нибудь по трансферам, круизам по Босфору, хаммаму, турам или ценам в Стамбуле?',
    uk: 'Будь ласка! 🌊 Чи підказати тобі ще щось щодо трансферів, круїзів Босфором, хамаму, турів або цін у Стамбулі?',
    de: 'Sehr gerne! 🌊 Kann ich dir noch bei Flughafentransfers, Bosporus-Fahrten, Hamam, Stadttouren oder Preisen weiterhelfen?',
    fr: 'Avec plaisir ! 🌊 Souhaites-tu d’autres infos sur les transferts, croisières sur le Bosphore, hammams, visites ou tarifs ?',
    nl: 'Graag gedaan! 🌊 Kan ik je nog helpen met transfers, Bosporuscruises, hamam, stadstours of prijzen?',
    ar: 'على الرحب والسعة! 🌊 هل تودّ الاستفسار عن النقل من المطار، رحلات البوسفور، الحمّام، جولات المدينة أو الأسعار؟',
    he: 'בשמחה! 🌊 רוצה עזרה נוספת לגבי הסעות, שייט בבוספורוס, חמאם, סיורים או מחירים?',
    az: 'Dəyməz, xoşdur! 🌊 Transferlər, Boğaz turları, hamam, şəhər gəzintiləri və ya qiymətlər barədə başqa sualın varmı?',
    fa: 'خواهش می‌کنم! 🌊 آیا درباره ترانسفر فرودگاه، کروز بسفر، حمام، تورهای شهری یا قیمت‌ها سوال دیگری داری؟',
    es: '¡Con mucho gusto! 🌊 ¿Puedo ayudarte con algo más sobre traslados, cruceros por el Bósforo, hammam, tours o precios?',
    it: 'Prego, figurati! 🌊 Posso aiutarti con altro tra transfer, crociere sul Bosforo, hammam, tour o prezzi?',
    pt: 'De nada! 🌊 Posso ajudar com mais alguma coisa sobre traslados, cruzeiros pelo Bósforo, hammam, passeios ou preços?',
    hr: 'Nema na čemu! 🌊 Mogu li ti pomoći još oko transfera, krstarenja Bosporom, hamama, tura ili cijena?',
    hu: 'Szívesen! 🌊 Segíthetek még reptéri transzferrel, boszporuszi hajózással, hamammal, városnézéssel vagy árakkal kapcsolatban?',
    bs: 'Nema na čemu! 🌊 Mogu li ti pomoći još oko transfera, krstarenja Bosporom, hamama, tura ili cijena?',
    zh: '不客气！🌊 关于机场接送、博斯普鲁斯游船、土耳其浴、城市游览或参考价格，还有什么我可以帮你的吗？',
    ja: 'どういたしまして！🌊 空港送迎、ボスポラスクルーズ、ハマム、市内ツアーや料金について他に知りたいことはありますか？',
    ko: '천만에요! 🌊 공항 픽업, 보스포루스 크루즈, 하맘, 시티 투어나 요금에 대해 더 궁금한 점이 있으신가요?',
    hi: 'कोई बात नहीं! 🌊 क्या एयरपोर्ट ट्रांसफ़र, बोस्फोरस क्रूज़, हम्माम, सिटी टूर या कीमतों के बारे में कुछ और पूछना है?',
    bn: 'স্বাগতম! 🌊 এয়ারপোর্ট ট্রান্সফার, বসফরাস ক্রুজ, হামাম, সিটি ট্যুর বা খরচ নিয়ে আর কিছু জানতে চাও?',
    id: 'Sama-sama! 🌊 Ada lagi yang bisa saya bantu seputar transfer bandara, pelayaran Bosphorus, hamam, tur kota, atau harga?',
  },
  goodbye: {
    tr: 'Görüşmek üzere! 🌊 İstanbul’da harika vakit geçirmeni dilerim. Transfer, Boğaz turu veya hamam için dilediğin zaman Mimo’ya yazabilirsin.',
    en: 'Goodbye and have a wonderful time in Istanbul! 🌊 Feel free to ask Mimo anytime for transfers, Bosphorus cruises, hammam, or tours.',
    ru: 'До встречи и прекрасного отдыха в Стамбуле! 🌊 Пиши Mimo в любое время, если понадобятся трансфер, круиз по Босфору, хаммам или экскурсии.',
    uk: 'До зустрічі і чудової подорожі до Стамбула! 🌊 Звертайся до Mimo будь-коли щодо трансферів, круїзів Босфором, хамаму чи екскурсій.',
    de: 'Bis bald und eine wunderbare Zeit in Istanbul! 🌊 Schreib Mimo jederzeit gerne für Transfers, Bosporus-Fahrten, Hamam oder Touren.',
    fr: 'À bientôt et excellent séjour à Istanbul ! 🌊 N’hésite pas à revenir vers Mimo pour tes transferts, croisières, hammams ou visites.',
    nl: 'Tot ziens en veel plezier in Istanbul! 🌊 Stuur Mimo gerust weer een bericht voor transfers, cruises, hamam of tours.',
    ar: 'إلى اللقاء ونتمنى لك وقتًا رائعًا في إسطنبول! 🌊 يمكنك مراسلة Mimo في أي وقت للنقل، رحلات البوسفور، الحمّام أو الجولات.',
    he: 'להתראות ושתהיה לך חופשה נהדרת באיסטנבול! 🌊 אפשר לפנות אל Mimo בכל עת להסעות, שייט, חמאם או סיורים.',
    az: 'Görüşənədək, İstanbulda gözəl vaxt keçir! 🌊 Transferlər, Boğaz turları, hamam və ya gəzintilər üçün istənilən vaxt Mimo-ya yaza bilərsən.',
    fa: 'خداحافظ و سفر خوشی در استانبول داشته باشی! 🌊 هر زمان برای ترانسفر، کروز بسفر، حمام یا تورهای شهری می‌توانی به Mimo پیام بدهی.',
    es: '¡Hasta luego y disfruta mucho de Estambul! 🌊 Escribe a Mimo cuando quieras para traslados, cruceros, hammam o tours.',
    it: 'Arrivederci e buon soggiorno a Istanbul! 🌊 Scrivi a Mimo quando vuoi per transfer, crociere sul Bosforo, hammam o tour.',
    pt: 'Até logo e aproveite muito Istambul! 🌊 Fale com Mimo quando precisar de traslados, cruzeiros, hammam ou passeios.',
    hr: 'Vidimo se i ugodan boravak u Istanbulu! 🌊 Javi se Mimu kad god trebaš transfer, krstarenje, hamam ili turu.',
    hu: 'Viszlát, és érezd jól magad Isztambulban! 🌊 Bármikor írhatsz Mimónak transzfer, hajóút, hamam vagy városnézés ügyében.',
    bs: 'Vidimo se i ugodan boravak u Istanbulu! 🌊 Javi se Mimu kad god trebaš transfer, krstarenje, hamam ili turu.',
    zh: '再见，祝你在伊斯坦布尔旅途愉快！🌊 如需了解接送、博斯普鲁斯游船、土耳其浴或城市游览，随时来找 Mimo。',
    ja: 'またね！イスタンブールで素敵な時間を過ごしてね！🌊 送迎、クルーズ、ハマム、ツアーの相談はいつでもMimoへどうぞ。',
    ko: '안녕히 가세요, 이스탄불에서 즐거운 시간 보내세요! 🌊 픽업, 크루즈, 하맘, 투어가 필요하시면 언제든 Mimo를 찾아주세요.',
    hi: 'फिर मिलेंगे, इस्तांबुल में तुम्हारा समय शानदार रहे! 🌊 ट्रांसफ़र, क्रूज़, हम्माम या टूर के लिए कभी भी Mimo से पूछो।',
    bn: 'বিদায়, ইস্তাম্বুলে তোমার সময় দারুণ কাটুক! 🌊 ট্রান্সফার, ক্রুজ, হামাম বা ট্যুরের জন্য যেকোনো সময় Mimo-কে লিখো।',
    id: 'Sampai jumpa dan selamat menikmati Istanbul! 🌊 Hubungi Mimo kapan saja untuk transfer bandara, pelayaran Bosphorus, hamam, atau tur kota.',
  },
  handoffOffer: {
    tr: 'Bu konuda ekibimizin doğrudan ilgilenmesi daha sağlıklı olur. Ekibimize iletmemi ister misin?',
    en: 'Our team should look into this directly for you. Would you like me to forward this to our team?',
    ru: 'По этому вопросу лучше подключить нашу команду напрямую. Передать твой запрос нашей команде?',
    uk: 'З цього питання краще звернутися до нашої команди напряму. Передати твій запит нашій команді?',
    de: 'Unser Team schaut sich das am besten direkt an. Soll ich deine Anfrage an unser Team weiterleiten?',
    fr: 'Notre équipe pourra traiter cela directement. Veux-tu que je transmette ta demande à notre équipe ?',
    nl: 'Ons team kan dit het beste direct voor je oppakken. Zal ik je bericht doorsturen naar ons team?',
    ar: 'من الأفضل أن يتولى فريقنا هذا الأمر مباشرة. هل تود أن أحيل رسالتك إلى فريقنا؟',
    he: 'כדאי שהצוות שלנו יטפל בזה ישירות. רוצה שאעביר את הפנייה לצוות שלנו?',
    az: 'Bu məsələyə komandamızın birbaşa baxması daha yaxşı olar. Sorğunu komandamıza yönləndirim?',
    fa: 'بهتر است تیم ما مستقیماً این موضوع را بررسی کند. می‌خواهی پیامت را به تیم ما ارسال کنم؟',
    es: 'Es mejor que nuestro equipo lo revise directamente. ¿Quieres que envíe tu mensaje a nuestro equipo?',
    it: 'È meglio che il nostro team se ne occupi direttamente. Vuoi che inoltri la tua richiesta al nostro team?',
    pt: 'É melhor nossa equipe cuidar disso diretamente. Gostaria que eu encaminhasse sua mensagem para nossa equipe?',
    hr: 'Najbolje je da ovo izravno pogleda naš tim. Želiš li da proslijedim tvoj upit našem timu?',
    hu: 'Ebben az ügyben jobb, ha a csapatunk közvetlenül segít. Szeretnéd, hogy továbbítsam a kérésedet a csapatunknak?',
    bs: 'Najbolje je da ovo direktno pogleda naš tim. Želiš li da proslijedim tvoj upit našem timu?',
    zh: '此事由我们的团队直接为你处理会更稳妥。你希望我把这个问题转交给团队吗？',
    ja: 'この件は担当チームが直接確認するのが安心です。チームへ引き継ぎましょうか？',
    ko: '이 부분은 저희 팀이 직접 확인해 드리는 것이 좋습니다. 팀에 전달해 드릴까요?',
    hi: 'इस मामले को हमारी टीम सीधे देखे तो बेहतर होगा। क्या मैं तुम्हारा संदेश हमारी टीम को भेज दूँ?',
    bn: 'এই বিষয়টি আমাদের টিম সরাসরি দেখলে ভালো হবে। আমি কি তোমার বার্তা আমাদের টিমের কাছে পাঠাব?',
    id: 'Sebaiknya tim kami menanganinya langsung. Mau saya teruskan pesan ini ke tim kami?',
  },
  handoffDeclined: {
    tr: 'Anladım, ekibimize iletmiyorum. İstanbul turları, transferler veya gezi önerileri hakkında başka nasıl yardımcı olabilirim?',
    en: 'Understood, I will not forward it. How else can I help you with Istanbul tours, transfers, or travel tips?',
    ru: 'Понял, не передаю. Чем ещё я могу помочь тебе по турам, трансферам или прогулкам в Стамбуле?',
    uk: 'Зрозуміло, не передаю. Чим ще можу допомогти тобі щодо турів, трансферів чи порад у Стамбулі?',
    de: 'Verstanden, ich leite es nicht weiter. Wie kann ich dir sonst bei Touren, Transfers oder Tipps für Istanbul helfen?',
    fr: 'Compris, je ne transmets pas. Comment puis-je t’aider autrement pour tes visites ou transferts à Istanbul ?',
    nl: 'Begrepen, ik stuur het niet door. Waarmee kan ik je verder helpen voor Istanbul?',
    ar: 'تم، لن أقوم بتحويله. كيف يمكنني مساعدتك أيضًا بخصوص الجولات أو النقل أو النصائح في إسطنبول؟',
    he: 'הבנתי, לא אעביר את זה. איך עוד אוכל לעזור לך עם סיורים, הסעות או טיפים באיסטנבול?',
    az: 'Anladım, yönləndirmirəm. İstanbul turları, transferlər və ya gəzinti məsləhətləri ilə bağlı başqa necə kömək edə bilərəm?',
    fa: 'متوجه شدم، ارسال نمی‌کنم. در مورد تورهای استانبول، ترانسفر یا راهنمای سفر چطور می‌توانم کمکت کنم؟',
    es: 'Entendido, no lo envío. ¿En qué más puedo ayudarte sobre tours, traslados o consejos en Estambul?',
    it: 'Capito, non lo inoltro. Come altro posso aiutarti per tour, transfer o consigli su Istanbul?',
    pt: 'Entendido, não vou encaminhar. Como mais posso ajudar com passeios, traslados ou dicas em Istambul?',
    hr: 'Razumijem, neću proslijediti. Kako ti još mogu pomoći oko tura, transfera ili savjeta za Istanbul?',
    hu: 'Rendben, nem továbbítom. Miben segíthetek még az isztambuli túrákkal vagy transzferekkel kapcsolatban?',
    bs: 'Razumijem, neću proslijediti. Kako ti još mogu pomoći oko tura, transfera ili savjeta za Istanbul?',
    zh: '好的，我暂不转交。关于伊斯坦布尔游览、接送或出行建议，还有什么我可以帮你的吗？',
    ja: '承知しました、転送は控えます。イスタンブールのツアーや送迎、観光案内で他に何かお手伝いできますか？',
    ko: '알겠습니다, 전달하지 않겠습니다. 이스탄불 투어, 픽업 또는 여행 팁과 관련해 다른 도움이 필요하신가요?',
    hi: 'समझ गया, मैं इसे आगे नहीं भेजूँगा। इस्तांबुल टूर, ट्रांसफ़र या यात्रा सुझावों में मैं और क्या मदद कर सकता हूँ?',
    bn: 'বুঝেছি, আমি এটি পাঠাব না। ইস্তাম্বুল ট্যুর, ট্রান্সফার বা ভ্রমণ টিপস নিয়ে আর কীভাবে সাহায্য করতে পারি?',
    id: 'Mengerti, saya tidak akan meneruskannya. Ada hal lain seputar tur, transfer, atau tips Istanbul yang bisa saya bantu?',
  },
  handoff: {
    tr: 'Memnuniyetle ekibimize iletiyorum. Sana dönüş yapabilmemiz için e-posta adresini paylaşır mısın?',
    en: 'I am happy to forward this to our team. Please share your email address so we can get back to you.',
    ru: 'С радостью передаю запрос нашей команде. Пожалуйста, укажи свой e-mail для ответа.',
    uk: 'Із радістю передаю запит нашій команді. Будь ласка, вкажи свій e-mail для відповіді.',
    de: 'Gerne leite ich das an unser Team weiter. Nenne mir bitte deine E-Mail-Adresse für unsere Antwort.',
    fr: 'Je transmets avec plaisir à notre équipe. Peux-tu indiquer ton adresse e-mail pour qu’on te réponde ?',
    nl: 'Ik stuur dit graag door naar ons team. Deel je e-mailadres zodat we contact kunnen opnemen.',
    ar: 'يسعدني إحالة ذلك إلى فريقنا. يرجى مشاركة بريدك الإلكتروني لنتمكن من الرد عليك.',
    he: 'בשמחה אעביר את זה לצוות שלנו. אפשר לשתף את כתובת הדוא״ל שלך כדי שנוכל לחזור אליך?',
    az: 'Məmnuniyyətlə komandamıza yönləndirirəm. Sənə cavab verə bilməyimiz üçün e-poçt ünvanını paylaşa bilərsən?',
    fa: 'با کمال میل به تیم ما ارسال می‌کنم. لطفاً ایمیلت را بفرست تا با تو تماس بگیریم.',
    es: 'Con gusto lo envío a nuestro equipo. Por favor, comparte tu correo electrónico para poder responderte.',
    it: 'Inoltro volentieri al nostro team. Condividi la tua e-mail così potremo risponderti.',
    pt: 'Encaminho com prazer para nossa equipe. Por favor, informe seu e-mail para podermos responder.',
    hr: 'Rado ću proslijediti našem timu. Podijeli svoju e-mail adresu kako bismo ti odgovorili.',
    hu: 'Szívesen továbbítom a csapatunknak. Kérlek, add meg az e-mail címedet, hogy válaszolhassunk.',
    bs: 'Rado ću proslijediti našem timu. Podijeli svoju e-mail adresu kako bismo ti odgovorili.',
    zh: '我很乐意为你转交给团队。请留下你的电子邮箱地址，方便我们尽快回复你。',
    ja: '担当チームへお繋ぎします。折り返しご連絡するため、メールアドレスを教えていただけますか？',
    ko: '저희 팀에 전달해 드리겠습니다. 회신받을 이메일 주소를 알려주시겠어요?',
    hi: 'मैं इसे हमारी टीम को भेज रहा हूँ। कृपया अपना ईमेल पता साझा करो ताकि हम जवाब दे सकें।',
    bn: 'আমি এটি আমাদের টিমের কাছে পাঠাচ্ছি। অনুগ্রহ করে তোমার ইমেইল ঠিকানা দাও যাতে আমরা উত্তর দিতে পারি।',
    id: 'Dengan senang hati saya teruskan ke tim kami. Boleh bagikan alamat email kamu agar kami bisa membalas?',
  },
  tryAgain: {
    tr: 'Bir saniye, martılar kafamı karıştırdı 😅 Tekrar yazar mısın?',
    en: 'One second, the seagulls distracted me 😅 Could you write that again?',
    ru: 'Секунду, чайки сбили меня с толку 😅 Напишешь ещё раз?',
    uk: 'Секунду, чайки збили мене з пантелику 😅 Напишеш ще раз?',
    de: 'Eine Sekunde, die Möwen haben mich abgelenkt 😅 Schreibst du es noch einmal?',
    fr: 'Une seconde, les mouettes m’ont distrait 😅 Tu peux réécrire ?',
    nl: 'Een seconde, de meeuwen leidden me af 😅 Schrijf je het nog een keer?',
    ar: 'لحظة، شتتني النوارس 😅 هل تعيد كتابة رسالتك؟',
    he: 'רגע, השחפים בלבלו אותי 😅 אפשר לכתוב שוב?',
    az: 'Bir saniyə, qağayılar fikrimi yayındırdı 😅 Bir daha yazarsan?',
    fa: 'یک لحظه، مرغ‌های دریایی حواسم را پرت کردند 😅 دوباره می‌نویسید؟',
    es: 'Un segundo, las gaviotas me distrajeron 😅 ¿Lo escribes otra vez?',
    it: 'Un secondo, i gabbiani mi hanno distratto 😅 Lo riscrivi?',
    pt: 'Um segundo, as gaivotas me distraíram 😅 Pode escrever de novo?',
    hr: 'Sekundu, galebovi su me zbunili 😅 Možeš li napisati ponovno?',
    hu: 'Egy pillanat, a sirályok elvonták a figyelmemet 😅 Megírnád még egyszer?',
    bs: 'Sekundu, galebovi su me zbunili 😅 Možeš li napisati ponovo?',
    zh: '等一下，海鸥把我弄糊涂了 😅 可以再写一遍吗？',
    ja: 'ちょっと待って、カモメに気を取られちゃった 😅 もう一度書いてもらえる？',
    ko: '잠깐, 갈매기 때문에 정신이 팔렸어요 😅 다시 한 번 적어 주실래요?',
    hi: 'एक सेकंड, सीगल ने मुझे भटका दिया 😅 क्या आप फिर से लिखेंगे?',
    bn: 'এক সেকেন্ড, গাঙচিলগুলো আমাকে বিভ্রান্ত করেছে 😅 আবার লিখবেন?',
    id: 'Sebentar, burung camar mengalihkan perhatianku 😅 Bisa tulis lagi?',
  },
  gatewayTired: {
    tr: "Bugünlük biraz yoruldum 😴 Telegram'dan ya da info@bosphorly.com'dan yazabilirsin.",
    en: 'I got a little tired for today 😴 You can write to us on Telegram or at info@bosphorly.com.',
    ru: 'На сегодня я немного устал 😴 Можешь написать нам в Telegram или на info@bosphorly.com.',
    uk: 'На сьогодні я трохи втомився 😴 Можеш написати нам у Telegram або на info@bosphorly.com.',
    de: 'Für heute bin ich ein bisschen müde geworden 😴 Du kannst uns auf Telegram oder an info@bosphorly.com schreiben.',
    fr: 'Je suis un peu fatigué pour aujourd’hui 😴 Tu peux nous écrire sur Telegram ou à info@bosphorly.com.',
    nl: 'Ik ben een beetje moe geworden voor vandaag 😴 Je kunt ons schrijven via Telegram of info@bosphorly.com.',
    ar: 'لقد تعبت قليلاً لليوم 😴 يمكنك مراسلتنا عبر تيليجرام أو info@bosphorly.com.',
    he: 'התעייפתי קצת להיום 😴 אפשר לכתוב לנו בטלגרם או ל-info@bosphorly.com.',
    az: 'Bu günlük bir az yoruldum 😴 Telegram-dan və ya info@bosphorly.com-dan yaza bilərsən.',
    fa: 'برای امروز کمی خسته شدم 😴 می‌توانی در تلگرام یا به info@bosphorly.com پیام بدهی.',
    es: 'Me cansé un poco por hoy 😴 Puedes escribirnos por Telegram o a info@bosphorly.com.',
    it: 'Mi sono stancato un po’ per oggi 😴 Puoi scriverci su Telegram o a info@bosphorly.com.',
    pt: 'Fiquei um pouco cansado por hoje 😴 Você pode falar conosco no Telegram ou pelo e-mail info@bosphorly.com.',
    hr: 'Malo sam se umorio za danas 😴 Možeš nam pisati na Telegram ili na info@bosphorly.com.',
    hu: 'Mára kicsit elfáradtam 😴 Írhatsz nekünk Telegramon vagy a info@bosphorly.com címre.',
    bs: 'Malo sam se umorio za danas 😴 Možeš nam pisati na Telegram ili na info@bosphorly.com.',
    zh: '今天我有点累啦 😴 欢迎通过 Telegram 或发送邮件至 info@bosphorly.com 联系我们。',
    ja: '今日はちょっと疲れちゃった 😴 Telegram か info@bosphorly.com にメッセージしてね。',
    ko: '오늘은 조금 피곤하네 😴 Telegram이나 info@bosphorly.com으로 연락해 줄래?',
    hi: 'आज के लिए मैं थोड़ा थक गया हूँ 😴 तुम Telegram या info@bosphorly.com पर लिख सकते हो।',
    bn: 'আজকের মতো একটু ক্লান্ত হয়ে পড়েছি 😴 তুমি Telegram-এ বা info@bosphorly.com-এ লিখতে পারো।',
    id: 'Untuk hari ini aku agak capek nih 😴 Kamu bisa hubungi lewat Telegram atau info@bosphorly.com.',
  },
  unknownHandoff: {
    tr: 'Bunu Boğaz’ın martılarına bile sordum ama emin olamadım 🌊 Uydurmak istemem; sorunu ekibimize iletmem için e-posta adresini paylaşabilirsin.',
    en: 'I even asked the Bosphorus seagulls, but I am not completely sure 🌊 I never want to guess—please share your email address so our team can help you.',
    ru: 'Я даже спросил у босфорских чаек, но точно не уверен 🌊 Не хочу гадать — укажи свой e-mail, чтобы наша команда помогла тебе.',
    uk: 'Я навіть спитав у босфорських чайок, але точно не впевнений 🌊 Не хочу вигадувати — вкажи свій e-mail, щоб наша команда допомогла тобі.',
    de: 'Ich habe sogar die Bosporus-Möwen gefragt, bin mir aber nicht sicher 🌊 Ich möchte nichts erfinden; schreib mir gern deine E-Mail-Adresse, damit unser Team dir hilft.',
    fr: 'J’ai même demandé aux mouettes du Bosphore, mais je n’en suis pas sûr 🌊 Je préfère ne rien inventer ; indique ton e-mail pour que notre équipe t’aide.',
    nl: 'Ik heb het zelfs aan de Bosporus-meeuwen gevraagd, maar ik weet het niet zeker 🌊 Ik verzin liever niets; deel je e-mailadres zodat ons team je helpt.',
    ar: 'حتى نوارس البوسفور لم تكن متأكدة تمامًا 🌊 لا أريد التخمين؛ يرجى مشاركة بريدك الإلكتروني ليساعدك فريقنا بدقة.',
    he: 'שאלתי אפילו את השחפים בבוספורוס, אבל אני לא לגמרי בטוח 🌊 לא רוצה לנחש — אפשר לשתף את הדוא״ל שלך כדי שהצוות שלנו יעזור.',
    az: 'Bunu hətta Boğaz qağayılarından da soruşdum, amma əmin ola bilmədim 🌊 Uydurmaq istəmirəm; komandamızın kömək etməsi üçün e-poçt ünvanını paylaşa bilərsən.',
    fa: 'حتی از مرغ‌های دریایی بسفر هم پرسیدم اما مطمئن نشدم 🌊 نمی‌خواهم حدس بزنم؛ لطفاً ایمیلت را بفرست تا تیم ما راهنماییت کند.',
    es: 'Se lo pregunté hasta a las gaviotas del Bósforo, pero no estoy seguro 🌊 Prefiero no inventar; comparte tu correo electrónico para que nuestro equipo te ayude.',
    it: 'L’ho chiesto persino ai gabbiani del Bosforo, ma non ne sono sicuro 🌊 Non voglio tirare a indovinare; condividi la tua e-mail così il nostro team ti aiuterà.',
    pt: 'Perguntei até às gaivotas do Bósforo, mas não tenho certeza 🌊 Não quero inventar; compartilhe seu e-mail para que nossa equipe ajude você.',
    hr: 'Pitao sam čak i bosporske galebove, ali nisam siguran 🌊 Ne želim nagađati; podijeli svoju e-mail adresu kako bi ti naš tim pomogao.',
    hu: 'Még a boszporuszi sirályokat is megkérdeztem, de nem vagyok biztos benne 🌊 Nem szeretnék találgatni; kérlek, add meg az e-mail címedet, hogy a csapatunk segíthessen.',
    bs: 'Pitao sam čak i bosporske galebove, ali nisam siguran 🌊 Ne želim nagađati; podijeli svoju e-mail adresu kako bi ti naš tim pomogao.',
    zh: '我连博斯普鲁斯海峡的海鸥都问过了，但还是不太确定 🌊 我不想凭空猜测；请留下你的电子邮箱地址，让我们的团队为你提供准确帮助。',
    ja: 'ボスポラスのカモメにも聞いてみましたが、確信が持てませんでした 🌊 曖昧なことは言えませんので、メールアドレスを教えていただければチームが正確にご案内します。',
    ko: '보스포루스 갈매기에게도 물어봤지만 확실하지 않네요 🌊 추측해서 말씀드리고 싶지 않으니, 이메일 주소를 남겨주시면 팀에서 정확히 도와드릴게요.',
    hi: 'मैंने बोस्फोरस के सीगल से भी पूछा, पर पक्का नहीं कह सकता 🌊 मैं अंदाज़ा नहीं लगाना चाहता; कृपया अपना ईमेल साझा करो ताकि हमारी टीम मदद कर सके।',
    bn: 'বসফরাসের গাঙচিলদেরও জিজ্ঞেস করলাম, কিন্তু নিশ্চিত হতে পারিনি 🌊 অনুমান করতে চাই না; অনুগ্রহ করে তোমার ইমেইল দাও যাতে আমাদের টিম সাহায্য করতে পারে।',
    id: 'Saya bahkan bertanya pada burung camar Bosphorus, tapi belum yakin 🌊 Saya tidak ingin menebak-nebak; bagikan email kamu agar tim kami bisa membantu.',
  },
  payment: {
    tr: 'Ödeme yöntemi talebinden sonra seninle iletişime geçtiğimizde paylaşılır.',
    en: 'The payment method is shared when we contact you after your request.',
    ru: 'Способ оплаты мы сообщим тебе, когда свяжемся после твоей заявки.',
    uk: 'Спосіб оплати ми повідомимо тобі, коли зв’яжемося щодо запиту.',
    de: 'Die Zahlungsart teilen wir dir mit, wenn wir uns wegen deiner Anfrage bei dir melden.',
    fr: 'Nous t’indiquons le mode de paiement lorsque nous te contactons au sujet de ta demande.',
    nl: 'We delen de betaalmethode wanneer we contact met je opnemen over je aanvraag.',
    ar: 'تتم مشاركة طريقة الدفع عندما نتواصل معك بعد تقديم طلبك.',
    he: 'את אמצעי התשלום נמסור כשניצור איתך קשר לגבי הבקשה.',
    az: 'Ödəniş üsulunu sorğunla bağlı səninlə əlaqə saxlayanda bildiririk.',
    fa: 'روش پرداخت را هنگامی که درباره درخواستت با تو تماس می‌گیریم اعلام می‌کنیم.',
    es: 'Te indicamos el método de pago cuando nos pongamos en contacto contigo por tu solicitud.',
    it: 'Ti comunichiamo il metodo di pagamento quando ti contattiamo per la tua richiesta.',
    pt: 'Informamos a forma de pagamento quando entrarmos em contato sobre o seu pedido.',
    hr: 'Način plaćanja javljamo kada te kontaktiramo u vezi s upitom.',
    hu: 'A fizetési módot akkor közöljük, amikor az ajánlatkérésed ügyében felvesszük veled a kapcsolatot.',
    bs: 'Način plaćanja javljamo kada te kontaktiramo u vezi s upitom.',
    zh: '我们会在就你的申请与你联系时告知付款方式。',
    ja: 'お支払い方法は、リクエストについてご連絡する際にお知らせします。',
    ko: '결제 방법은 요청과 관련해 연락드릴 때 안내해 드립니다.',
    hi: 'तुम्हारे अनुरोध के बारे में संपर्क करते समय हम भुगतान का तरीका बताएँगे।',
    bn: 'তোমার অনুরোধ নিয়ে যোগাযোগ করার সময় আমরা পেমেন্টের পদ্ধতি জানাব।',
    id: 'Kami memberi tahu metode pembayaran saat menghubungi kamu terkait permintaan kamu.',
  },
  busy: {
    tr: 'Şu an yoğunuz, mesajını ekibe iletelim mi? E-posta adresini paylaşabilirsin.',
    en: 'We are currently busy—would you like us to forward your message to our team? Please share your email address.',
    ru: 'Сейчас мы заняты — передать твоё сообщение нашей команде? Укажи свой e-mail.',
    uk: 'Зараз ми зайняті — передати твоє повідомлення команді? Вкажи свій e-mail.',
    de: 'Wir sind gerade ausgelastet — sollen wir deine Nachricht weiterleiten? Nenne uns bitte deine E-Mail-Adresse.',
    fr: 'Nous sommes très sollicités — veux-tu que je transmette ton message ? Indique ton adresse e-mail.',
    nl: 'Het is momenteel erg druk — wil je dat we je bericht doorsturen? Deel je e-mailadres.',
    ar: 'نحن مشغولون حاليًا، هل نرسل رسالتك إلى فريقنا؟ يمكنك مشاركة بريدك الإلكتروني.',
    he: 'אנו עמוסים כרגע — רוצה שנעביר את הפנייה לצוות? אפשר לשתף את הדוא״ל שלך.',
    az: 'Hazırda məşğuluq — mesajını komandamıza yönləndirək? E-poçt ünvanını paylaşa bilərsən.',
    fa: 'در حال حاضر مشغول هستیم — پیامت را به تیم ارسال کنیم؟ ایمیلت را بنویس.',
    es: 'Estamos muy ocupados ahora — ¿reenviamos tu mensaje al equipo? Comparte tu correo electrónico.',
    it: 'Siamo molto impegnati al momento — vuoi che inoltriamo il messaggio al team? Condividi la tua e-mail.',
    pt: 'Estamos ocupados no momento — gostaria de encaminhar sua mensagem para a equipe? Informe seu e-mail.',
    hr: 'Trenutačno smo zauzeti — želiš li da proslijedimo poruku timu? Podijeli svoju e-mail adresu.',
    hu: 'Jelenleg elfoglaltak vagyunk — továbbítsuk az üzenetedet a csapatnak? Add meg az e-mail címed.',
    bs: 'Trenutno smo zauzeti — želiš li da proslijedimo poruku timu? Podijeli svoju e-mail adresu.',
    zh: '当前咨询较多，是否帮你转交给团队处理？请留下你的邮箱地址。',
    ja: 'ただいま混み合っております。チームへ引き継ぐためメールアドレスを教えていただけますか？',
    ko: '현재 문의가 많습니다. 팀에 전달해 드릴 수 있도록 이메일 주소를 남겨주시겠어요?',
    hi: 'हम अभी व्यस्त हैं — क्या हम तुम्हारा संदेश टीम को भेज दें? कृपया अपना ईमेल साझा करो।',
    bn: 'আমরা এখন ব্যস্ত — তোমার বার্তাটি কি টিমের কাছে পাঠাব? অনুগ্রহ করে ইমেইল দাও।',
    id: 'Saat ini kami sedang sibuk — mau pesan kamu diteruskan ke tim? Silakan bagikan email kamu.',
  },
  sensitiveWarn: {
    tr: 'Güvenliğin için lütfen kart veya pasaport numarası paylaşma; bu bilgiler gizlendi.',
    en: 'For your security, please do not share card or passport numbers; they have been hidden.',
    ru: 'В целях безопасности не указывай номера карт или паспортов; они скрыты.',
    uk: 'Задля безпеки не надсилай номери карток чи паспортів; їх приховано.',
    de: 'Zu deiner Sicherheit teile bitte keine Karten- oder Passnummern; diese wurden unkenntlich gemacht.',
    fr: 'Pour ta sécurité, ne partage pas de numéros de carte ou de passeport ; ils ont été masqués.',
    nl: 'Deel voor je veiligheid geen kaart- of paspoortnummers; deze zijn verborgen.',
    ar: 'لحمايتك، يرجى عدم مشاركة أرقام البطاقات أو جوازات السفر؛ تم إخفاؤها.',
    he: 'למען ביטחונך, אל תשתף מספרי כרטיס או דרכון; פרטים אלה הוסתרו.',
    az: 'Təhlükəsizliyin üçün kart və ya pasport nömrələrini paylaşma; bu məlumatlar gizlədildi.',
    fa: 'برای امنیت تو، لطفاً شماره کارت یا گذرنامه را به اشتراک نگذار؛ این اطلاعات پنهان شد.',
    es: 'Por tu seguridad, no compartas números de tarjeta o pasaporte; han sido ocultados.',
    it: 'Per la tua sicurezza, non condividere numeri di carta o passaporto; sono stati nascosti.',
    pt: 'Para sua segurança, não compartilhe números de cartão ou passaporte; eles foram ocultados.',
    hr: 'Radi tvoje sigurnosti ne dijeli brojeve kartica ili putovnica; ti su podaci skriveni.',
    hu: 'Biztonságod érdekében ne ossz meg kártya- vagy útlevélszámot; ezeket elrejtettük.',
    bs: 'Radi tvoje sigurnosti ne dijeli brojeve kartica ili pasoša; ti su podaci skriveni.',
    zh: '为了你的安全，请勿分享银行卡号或护照号；相关信息已被隐藏。',
    ja: '安全のため、カード番号やパスポート番号は共有しないでください（該当情報は非表示にしました）。',
    ko: '안전을 위해 카드 번호나 여권 번호를 공유하지 마세요. 해당 정보는 가려졌습니다.',
    hi: 'तुम्हारी सुरक्षा के लिए, कृपया कार्ड या पासपोर्ट नंबर साझा न करो; इन्हें छिपा दिया गया है।',
    bn: 'তোমার নিরাপত্তার জন্য অনুগ্রহ করে কার্ড বা পাসপোর্ট নম্বর শেয়ার কোরো না; এগুলো গোপন করা হয়েছে।',
    id: 'Demi keamanan kamu, jangan bagikan nomor kartu atau paspor; informasi tersebut telah disembunyikan.',
  },
  rateLimit: {
    tr: 'Çok hızlı soru gönderdin. Kısa bir süre sonra tekrar deneyebilir veya mesajını ekibimize iletebilirsin.',
    en: 'You are sending messages too quickly. Please try again shortly or forward your message to our team.',
    ru: 'Слишком много сообщений. Попробуй чуть позже или передай вопрос нашей команде.',
    uk: 'Ти надсилаєш повідомлення надто швидко. Спробуй трохи пізніше або передай запит команді.',
    de: 'Du sendest Nachrichten zu schnell. Bitte versuche es gleich erneut oder leite deine Nachricht weiter.',
    fr: 'Tu envoies des messages trop rapidement. Réessaie dans un instant ou transmets ton message à notre équipe.',
    nl: 'Je verstuurt berichten te snel. Probeer het zo opnieuw of stuur je bericht door naar ons team.',
    ar: 'لقد أرسلت رسائل كثيرة بسرعة. يرجى المحاولة لاحقًا أو إرسال رسالتك إلى فريقنا.',
    he: 'שלחת הודעות מהר מדי. נסה שוב בעוד רגע או העבר את הפנייה לצוות.',
    az: 'Çox sürətlə mesaj göndərirsən. Bir az sonra yenidən yoxla və ya mesajını komandaya yönləndir.',
    fa: 'پیام‌ها خیلی سریع ارسال شدند. لطفاً کمی بعد دوباره تلاش کن یا به تیم ما ارسال کن.',
    es: 'Estás enviando mensajes muy rápido. Inténtalo en breve o envía tu mensaje a nuestro equipo.',
    it: 'Stai inviando messaggi troppo velocemente. Riprova tra poco o inoltra la richiesta al nostro team.',
    pt: 'Você está enviando mensagens rápido demais. Tente novamente em instantes ou encaminhe para nossa equipe.',
    hr: 'Šalješ poruke prebrzo. Pokušaj uskoro ponovno ili proslijedi poruku našem timu.',
    hu: 'Túl gyorsan küldesz üzeneteket. Próbáld meg hamarosan újra, vagy továbbítsd a csapatunknak.',
    bs: 'Šalješ poruke prebrzo. Pokušaj uskoro ponovo ili proslijedi poruku našem timu.',
    zh: '你发送消息过于频繁，请稍后再试，或把问题转交给我们的团队。',
    ja: '送信が速すぎます。少し時間をおいて再試行するか、チームへお問い合わせください。',
    ko: '메시지를 너무 빠르게 보내고 있습니다. 잠시 후 다시 시도하거나 팀에 전달해 주세요.',
    hi: 'तुम बहुत तेज़ी से संदेश भेज रहे हो। कृपया थोड़ी देर बाद प्रयास करो या हमारी टीम को भेजो।',
    bn: 'তুমি খুব দ্রুত বার্তা পাঠাচ্ছ। একটু পরে আবার চেষ্টা করো বা আমাদের টিমে পাঠাও।',
    id: 'Kamu mengirim pesan terlalu cepat. Coba lagi sebentar atau teruskan pesan ke tim kami.',
  },
  abuseClose: {
    tr: 'Bu dille konuşmaya devam edemem. Sohbeti burada sonlandırıyorum. Bir sorunun varsa info@bosphorly.com’a yazabilirsin.',
    en: 'I cannot continue the conversation with this language. I am ending the chat here. If you have an issue, you can write to info@bosphorly.com.',
    ru: 'Я не могу продолжать разговор в таком тоне. Завершаю чат здесь. Если у тебя есть вопрос, можешь написать на info@bosphorly.com.',
    uk: 'Я не можу продовжувати розмову в такому тоні. Завершую чат тут. Якщо маєш питання, напиши на info@bosphorly.com.',
    de: 'In diesem Ton kann ich das Gespräch nicht fortsetzen. Ich beende den Chat hier. Bei einem Anliegen kannst du an info@bosphorly.com schreiben.',
    fr: 'Je ne peux pas poursuivre la conversation sur ce ton. Je mets fin au chat ici. En cas de problème, tu peux écrire à info@bosphorly.com.',
    nl: 'Op deze toon kan ik het gesprek niet voortzetten. Ik beëindig de chat hier. Als je een vraag hebt, kun je mailen naar info@bosphorly.com.',
    ar: 'لا يمكنني متابعة المحادثة بهذه اللغة. أنهي المحادثة هنا. إذا كانت لديك مشكلة يمكنك الكتابة إلى info@bosphorly.com.',
    he: 'איני יכול להמשיך את השיחה בשפה כזו. אני מסיים את הצ׳אט כאן. אם יש לך פנייה, ניתן לכתוב אל info@bosphorly.com.',
    az: 'Bu üslubla söhbəti davam etdirə bilmərəm. Söhbəti burada sonlandırıram. Sualın varsa info@bosphorly.com ünvanına yaza bilərsən.',
    fa: 'با این لحن نمی‌توانم گفتگو را ادامه دهم. گفتگو را در اینجا پایان می‌دهم. اگر مشکلی داری می‌توانی به info@bosphorly.com بنویسی.',
    es: 'No puedo continuar la conversación con este lenguaje. Termino el chat aquí. Si tienes algún problema, puedes escribir a info@bosphorly.com.',
    it: 'Non posso continuare la conversazione con questo linguaggio. Chiudo qui la chat. Se hai un problema, puoi scrivere a info@bosphorly.com.',
    pt: 'Não posso continuar a conversa com essa linguagem. Encerro o chat aqui. Se tiver alguma questão, escreva para info@bosphorly.com.',
    hr: 'Ne mogu nastaviti razgovor ovakvim rječnikom. Ovdje završavam razgovor. Ako imaš pitanje, možeš pisati na info@bosphorly.com.',
    hu: 'Ilyen hangnemben nem tudom folytatni a beszélgetést. A csevegést itt lezárom. Ha kérdésed van, írhatsz az info@bosphorly.com címre.',
    bs: 'Ne mogu nastaviti razgovor ovakvim rječnikom. Ovdje završavam razgovor. Ako imaš pitanje, možeš pisati na info@bosphorly.com.',
    zh: '我无法在这样的语言下继续对话。本次对话到此结束。如有问题，请发邮件至 info@bosphorly.com。',
    ja: 'このような言葉遣いでは会話を続けられません。ここでチャットを終了します。ご用件がある場合は info@bosphorly.com までご連絡ください。',
    ko: '이러한 표현으로는 대화를 이어갈 수 없습니다. 여기서 대화를 종료합니다. 문의 사항이 있으시면 info@bosphorly.com으로 메일을 보내주세요.',
    hi: 'मैं इस भाषा में बातचीत जारी नहीं रख सकता। मैं यहीं चैट समाप्त कर रहा हूँ। किसी समस्या के लिए तुम info@bosphorly.com पर लिख सकते हो।',
    bn: 'এই ভাষায় আমি কথোপকথন চালিয়ে যেতে পারব না। আমি এখানেই চ্যাট শেষ করছি। কোনো সমস্যা থাকলে info@bosphorly.com-এ লিখতে পারো।',
    id: 'Saya tidak dapat melanjutkan percakapan dengan bahasa seperti ini. Saya mengakhiri obrolan di sini. Jika ada masalah, silakan tulis ke info@bosphorly.com.',
  },
  kindNote: {
    tr: 'Mimo’ya nazik davrandığın için teşekkürler 💙 Saygısız dil kullanılırsa sohbet sonlanır.',
    en: 'Thank you for being kind to Mimo 💙 The chat ends if disrespectful language is used.',
    ru: 'Спасибо за вежливое общение с Mimo 💙 При неуважительном тоне чат завершается.',
    uk: 'Дякуємо за ввічливе спілкування з Mimo 💙 У разі неповажного тону чат завершується.',
    de: 'Danke, dass du freundlich zu Mimo bist 💙 Bei respektloser Sprache wird der Chat beendet.',
    fr: 'Merci d’être bienveillant avec Mimo 💙 Le chat prend fin en cas de langage irrespectueux.',
    nl: 'Bedankt dat je vriendelijk bent tegen Mimo 💙 Bij respectloos taalgebruik stopt de chat.',
    ar: 'شكرًا للطفك مع Mimo 💙 تنتهي المحادثة في حال استخدام لغة غير محترمة.',
    he: 'תודה שאתם נחמדים אל Mimo 💙 השיחה מסתיימת במקרה של שפה לא מכבדת.',
    az: 'Mimo ilə nəzakətli davrandığın üçün təşəkkürlər 💙 Hörmətsiz ifadələr işlədilərsə söhbət sonlanır.',
    fa: 'ممنون که با Mimo مهربان هستید 💙 در صورت استفاده از لحن نامحترمانه گفتگو پایان می‌یابد.',
    es: 'Gracias por tratar con amabilidad a Mimo 💙 El chat finaliza si se usa lenguaje irrespetuoso.',
    it: 'Grazie per essere gentile con Mimo 💙 La chat termina in caso di linguaggio irrispettoso.',
    pt: 'Obrigado por tratar o Mimo com gentileza 💙 O chat é encerrado se houver linguagem desrespeitosa.',
    hr: 'Hvala što si ljubazan prema Mimu 💙 Razgovor se prekida u slučaju nepoštovanja.',
    hu: 'Köszönjük, hogy kedves vagy Mimóval 💙 Tiszteletlen hangnem esetén a csevegés véget ér.',
    bs: 'Hvala što si ljubazan prema Mimu 💙 Razgovor se prekida u slučaju nepoštovanja.',
    zh: '感谢你温柔对待 Mimo 💙 若使用不尊重的语言，对话将自动结束。',
    ja: 'Mimoに優しく接していただきありがとうございます 💙 礼儀を欠く言葉遣いがあった場合、チャットは終了します。',
    ko: 'Mimo에게 다정하게 대해 주셔서 고마워요 💙 무례한 표현이 사용되면 대화가 종료됩니다.',
    hi: 'Mimo के साथ विनम्र रहने के लिए धन्यवाद 💙 अपमानजनक भाषा का प्रयोग होने पर चैट समाप्त हो जाएगी।',
    bn: 'Mimo-এর সাথে সদয় আচরণের জন্য ধন্যবাদ 💙 অসম্মানজনক ভাষা ব্যবহার করলে চ্যাট বন্ধ হয়ে যাবে।',
    id: 'Terima kasih telah bersikap ramah kepada Mimo 💙 Obrolan akan berakhir jika bahasa tidak sopan digunakan.',
  },
};

function msg(key, lang) {
  return (ASSISTANT_MESSAGES[key] && (ASSISTANT_MESSAGES[key][lang] || ASSISTANT_MESSAGES[key].en)) || '';
}

function normalizeLang(candidate) {
  if (typeof candidate !== 'string' || !candidate.trim()) return '';
  let code = candidate.trim().toLowerCase().split(/[-_]/)[0];
  if (code === 'in') code = 'id';
  return SUPPORTED_LANGS.has(code) ? code : '';
}

export function detectLanguage({ message = '', pageLang = '', telegramLang = '' } = {}) {
  const preferredLang = normalizeLang(pageLang) || normalizeLang(telegramLang);
  const text = String(message || '');

  if (/[\u0400-\u04FF]/.test(text)) {
    if (/[іїєґІЇЄҐ]/.test(text) || /(?:^|[^\p{L}])(вітаю|привіт|дякую|будь ласка|скільки|чи можна)(?=$|[^\p{L}])/iu.test(text)) {
      return 'uk';
    }
    if (/[ыэъёЫЭЪЁ]/.test(text) || /(?:^|[^\p{L}])(привет|здравствуйте|спасибо|сколько|пока|до свидания)(?=$|[^\p{L}])/iu.test(text)) {
      return 'ru';
    }
    return preferredLang === 'uk' ? 'uk' : 'ru';
  }
  if (/[\u0600-\u06FF]/.test(text)) {
    if (/[پچژگک]/.test(text) || /(?:^|[^\p{L}])(درود|ممنون|متشکرم|خداحافظ|چطور|چقدر|هست)(?=$|[^\p{L}])/iu.test(text)) {
      return 'fa';
    }
    if (/(?:^|[^\p{L}])(مرحبا|أهلا|اهلا|شكرا|شكراً|كيف حالك|كم سعر|من فضلك|إسطنبول)(?=$|[^\p{L}])/iu.test(text)) {
      return 'ar';
    }
    return preferredLang === 'fa' ? 'fa' : 'ar';
  }
  if (/[\u0590-\u05FF]/.test(text)) return 'he';
  if (/[\u3040-\u30FF]/.test(text)) return 'ja';
  if (/[\uAC00-\uD7AF]/.test(text)) return 'ko';
  if (/[\u4E00-\u9FFF]/.test(text)) return preferredLang === 'ja' ? 'ja' : 'zh';
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  if (/[\u0980-\u09FF]/.test(text)) return 'bn';

  if (/[əƏ]/.test(text)) return 'az';

  const hasTrOnlyChars = /[ğışĞİŞ]/.test(text);
  if (hasTrOnlyChars) {
    if (preferredLang === 'az' && !/\b(merhaba|teşekkür\w*|görüşürüz|boğaz|fiyat\w*|ne kadar|ödeme\w*|iade|şikayet\w*|insan\s+mısın)\b/iu.test(text)) {
      return 'az';
    }
    return 'tr';
  }

  const hasTrWords = /\b(merhaba|selam|günaydın|iyi akşamlar|iyi günler|nasılsın|kimsin|ne yapabilirsin|teşekkür\w*|sağ ol|görüşürüz|hoşça kal|fiyat\w*|ne kadar|boğaz|ödeme\w*|ödemeyi|iade|şikayet\w*|insanla|insan misin|yapay zeka|robot musun|yetkili|ayasofya)\b/iu.test(text);
  if (hasTrWords && (!preferredLang || preferredLang === 'en' || preferredLang === 'tr')) {
    return 'tr';
  }

  if (preferredLang) return preferredLang;

  if (/\b(salam|təşəkkür|sağ ol|necəsən)\b/iu.test(text)) return 'az';
  return 'en';
}

export function redactSensitive(input) {
  let text = String(input || '');
  let hadSensitive = false;

  const cardRe = /(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g;
  text = text.replace(cardRe, (m) => {
    const digits = m.replace(/\D/g, '');
    if (digits.length >= 13 && digits.length <= 19) {
      hadSensitive = true;
      return '[CARD REDACTED]';
    }
    return m;
  });

  const passportRe = /\b(pasaport(?:\s*(?:no|numarası|numarasi))?|passport(?:\s*(?:no|number))?|паспорт(?:\s*№)?)\s*[:#\-]?\s*([A-Z0-9]{6,12})\b/gi;
  text = text.replace(passportRe, (_, label) => {
    hadSensitive = true;
    return `${label}: [PASSPORT REDACTED]`;
  });

  return { text, hadSensitive };
}

function isAllowedBosphorlyUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    const host = u.hostname.toLowerCase();
    if (host === 'bosphorly.com' || host === 'www.bosphorly.com') return true;
    if (host === 't.me' && /^\/BosphorlyBot\/?$/i.test(u.pathname)) return true;
    return false;
  } catch {
    return false;
  }
}

export function stripExternalLinks(input) {
  let text = String(input || '');
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/gi, (full, label, url) => {
    if (isAllowedBosphorlyUrl(url)) return full;
    return label;
  });
  text = text.replace(/https?:\/\/[^\s)>\]"']+/gi, (url) => {
    if (isAllowedBosphorlyUrl(url)) return url;
    return '';
  });
  text = text.replace(/\bwww\.[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s)>\]"']*)?/gi, (url) => {
    if (url.toLowerCase().startsWith('www.bosphorly.com')) return url;
    return '';
  });
  text = text.replace(/\bt\.me\/[A-Za-z0-9_]+(?:\/[^\s)>\]"']*)?/gi, (url) => {
    if (/^t\.me\/BosphorlyBot(?:$|\?)/i.test(url)) return url;
    return '';
  });
  return text.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

export function stripFakeUrgency(input) {
  let text = String(input || '');
  const urgencyPatterns = [
    /(?<![\p{L}\p{N}])(?:son\s+(?:\d+\s+|birkaç\s+|bir\s+|iki\s+|üç\s+|dört\s+|beş\s+|az\s+)?(?:tane\s+)?(?:yer(?:imiz)?|koltu[kğ]\p{L}*|kontenjan\p{L}*|bilet\p{L}*|fırsat\p{L}*)\p{L}*(?:\s+kaldı)?|(?:sadece|yalnızca)\s+bugün(?:e\s+özel)?(?:\s+geçerli)?|bugüne\s+özel|son\s+saatler|acele\s+e[dt]\p{L}*|hemen\s+(?:yerin(?:iz)?i\s+)?ayırt\p{L}*|kaçırmayın?|tükenmek\s+üzere|bitmek\s+üzere|yerler\s+(?:hızla\s+)?doluyor|sınırlı\s+(?:kontenjan|yer|sayıda|süre))/giu,
    /(?<![\p{L}\p{N}])(?:only\s+(?:for\s+)?today|today\s+only|(?:only\s+)?\d+\s+(?:seats?|spots?|places?|tickets?)\s+(?:left|remaining)|last\s+(?:few\s+|\d+\s+)?(?:seat|spot|place|ticket)s?(?:\s+left|\s+remaining)?|limited\s+(?:seats?|spots?|availability|time\s+offer)(?:\s+left)?|few\s+(?:seats?|spots?)\s+left|selling\s+fast|almost\s+sold\s+out|hurry(?:\s+up)?|don'?t\s+miss(?:\s+out)?|act\s+(?:fast|now))/giu,
    /(?<![\p{L}\p{N}])(?:только\s+сегодня|лише\s+сьогодні|тільки\s+сьогодні|(?:осталось|остался|остались|залишилося|залишилось)\s+(?:всего\s+|только\s+|лише\s+)?(?:\d+|мало|несколько|кілька)\s+(?:мест|місць)\p{L}*|последние\s+(?:\d+\s+)?мест\p{L}*|останні\s+(?:\d+\s+)?місц\p{L}*|спешите|поспішайте)/giu,
    /(?<![\p{L}\p{N}])(?:فقط\s+اليوم|اليوم\s+فقط|المقاعد\s+الأخيرة|أماكن\s+محدودة|(?:تبقى|باقي)\s+\d+\s+(?:مقاعد|أماكن)|سارع\s+بالحجز|فقط\s+امروز|آخرین\s+(?:\d+\s+)?(?:جایگاه|صندلی|ظرفیت)|ظرفیت\s+محدود)/giu,
    /(?<![\p{L}\p{N}])(?:רק\s+היום|(?:נשארו|נותרו)\s+(?:רק\s+)?(?:\d+|כמה|מעט)\s+מקומות|מקומות\s+אחרונים|המקומות\s+אוזלים|מהרו\s+להזמין)/giu,
    /(?<![\p{L}\p{N}])(?:nur\s+(?:noch\s+)?heute|(?:nur\s+noch\s+)?\d+\s+plätze?(?:\s+frei|\s+übrig)?|letzte[rn]?\s+(?:\d+\s+)?plätze?|begrenzte\s+plätze|fast\s+ausgebucht|beeil(?:en\s+Sie\s+sich|e\s+dich))/giu,
    /(?<![\p{L}\p{N}])(?:(?:seulement|uniquement)\s+aujourd'?hui|dernières?\s+(?:\d+\s+)?places?|(?:plus\s+que\s+|seulement\s+)?\d+\s+places?(?:\s+disponibles?|\s+restantes?)?|places?\s+limitées?|dépêchez-vous)/giu,
    /(?<![\p{L}\p{N}])(?:solo\s+hoy|só\s+hoje|apenas\s+hoje|solo\s+oggi|alleen\s+vandaag|últimos?\s+(?:\d+\s+)?(?:lugares|plazas|asientos|vagas)|ultim[io]\s+(?:\d+\s+)?post[io]|(?:quedan|restam|rimangono)\s+(?:solo\s+|apenas\s+)?\d+\s+(?:lugares|plazas|vagas|posti)|laatste\s+(?:\d+\s+)?(?:plekken|plaatsen)|nog\s+maar\s+\d+\s+(?:plekken|plaatsen))/giu,
    /(?<![\p{L}\p{N}])(?:yalnız\s+bu\s+gün|təkcə\s+bu\s+gün|son\s+(?:\d+\s+|bir\s+neçə\s+)?(?:yer|oturacaq)\p{L}*(?:\s+qalıb)?|samo\s+danas|zadnj[ai]\s+(?:\d+\s+)?mjest\p{L}*|preostalo\s+(?:je\s+)?\d+\s+mjest\p{L}*|csak\s+ma|utolsó\s+(?:\d+\s+)?hely\p{L}*|már\s+csak\s+\d+\s+hely\p{L}*|hanya\s+hari\s+ini|tersisa\s+\d+\s+(?:kursi|tempat)|kursi\s+terakhir)/giu,
    /(?:仅限今天|仅此一天|最后\s*\d*\s*(?:个)?(?:名额|席位|座位)|即将售罄|今日だけ|本日限り|残り\s*\d*\s*(?:席|名)|오늘만|마지막\s*\d*\s*자리|잔여\s*\d*\s*석|केवल\s+आज|सिर्फ\s+आज|आखिरी\s*\d*\s*सीट\p{L}*|শুধুমাত্র\s+আজ|শেষ\s*\d*\s*টি\s*আসন)/giu,
  ];
  for (const re of urgencyPatterns) {
    text = text.replace(re, ' ');
  }
  return text
    .replace(/\s+([,.;!?])/g, '$1')
    .replace(/([,;])\s*([.!?]|$)/g, '$2')
    .replace(/^[\s,;:.!?]+(?=\S)/, '')
    .replace(/^[,.;:!\s]+$/, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeToken(tok) {
  return tok
    .replace(/ı/g, 'i')
    .replace(/ə/g, 'e')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '');
}

function tokenize(text) {
  const cleaned = String(text || '').toLowerCase().replace(/[\u200c\u200d]/g, ' ');
  const raw = cleaned.match(/[\p{L}\p{N}]{2,}/gu) || [];
  const out = [];
  for (const t of raw) {
    out.push(t);
    const n = normalizeToken(t);
    if (n !== t) out.push(n);

    if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(t)) {
      const chars = [...t];
      for (let i = 0; i < chars.length - 1; i++) {
        out.push(chars[i] + chars[i + 1]);
      }
    } else if (/[\p{Script=Hangul}]/u.test(t) && t.length >= 3) {
      const chars = [...t];
      for (let i = 0; i < chars.length - 1; i++) {
        out.push(chars[i] + chars[i + 1]);
      }
    }

    if (/[\u0590-\u05FF]/.test(t)) {
      const heNorm = t.replace(/יי/g, 'י').replace(/וו/g, 'ו');
      if (heNorm !== t) out.push(heNorm);
      if (t.length >= 4 && /^[בהוכלמש]/.test(t)) {
        const stem = t.slice(1);
        out.push(stem);
        const stemNorm = stem.replace(/יי/g, 'י').replace(/וו/g, 'ו');
        if (stemNorm !== stem) out.push(stemNorm);
        if (stem.length >= 4 && stem.startsWith('ה')) out.push(stem.slice(1));
      }
    }

    if (/[\u0600-\u06FF]/.test(t)) {
      const arNorm = t
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/ى/g, 'ي')
        .replace(/ة/g, 'ه')
        .replace(/ی/g, 'ي')
        .replace(/ک/g, 'ك');
      if (arNorm !== t) out.push(arNorm);
      if (arNorm.length >= 4 && arNorm.startsWith('ال')) {
        out.push(arNorm.slice(2));
      } else if (arNorm.length >= 4 && /^[بلوفك]/.test(arNorm)) {
        const s = arNorm.slice(1);
        out.push(s);
        if (s.length >= 4 && s.startsWith('ال')) out.push(s.slice(2));
      }
    }
  }
  return out;
}

const PRICE_RATE_TO_EUR = { EUR: 1, USD: 0.92, TRY: 0.027 };

const PRICE_QUERY_RE = /(?:^|[^\p{L}])(fiyat\p{L}*|ücret\p{L}*|kaç\s+para|kaça|ne\s+kadar|price\p{L}*|cost|rate\p{L}*|fare|how\s+much|сколько|поч[её]м|стоимост\p{L}*|цен\p{L}*|ціна|скільки|preis\p{L}*|kosten|prix|tarif\p{L}*|coût|prijs|precio|prezzo|preço|cijena|ár|mennyibe|qiymət\p{L}*|سعر|تكلفة|كم|بكم|מחיר|כמה\s*(?:זה\s*)?עולה|עולה|قیمت|چقدر|harga|berapa)(?=$|[^\p{L}])|价格|多少钱|费用|料金|いくら|가격|요금|얼마|कीमत|किराया|দাম|কত/iu;

export function isPriceQuery(query = '') {
  return PRICE_QUERY_RE.test(String(query || ''));
}

const EVENING_QUERY_RE = /(?:^|[^\p{L}])(ak[sş]am\p{L}*|evening\p{L}*|night\p{L}*|вечер\p{L}*|ноч\p{L}*|веч[іи]р\p{L}*|н[іи]ч\p{L}*|ערב|לילה|abend\p{L}*|nacht\p{L}*|soir\p{L}*|nuit|avond\p{L}*|tarde|noche|sera|notte|noite|ve[cč]er\p{L}*|este|ax[sş]am\p{L}*|شب|مساء|شام|संध्या|शाम|সন্ধ্যা|রাত|malam|sore)(?=$|[^\p{L}])|저녁|밤|夕方|夜|傍晚|晚上/iu;

const NON_SUNSET_HINT_RE = /\b(?:transfer|airport|havaliman|havaalan|shuttle|hamm?am|bath|massage|bursa|sapanca|yalova)\b|трансфер|аэропорт|хамам|העברה|הסעה|חמאם/iu;

const RETRIEVAL_STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'be', 'do', 'does', 'can', 'of', 'on', 'in', 'to', 'for', 'with', 'and', 'or', 'by', 'at', 'this', 'that',
  'bir', 've', 'bu', 'da', 'de', 'mi', 'mı', 'mu', 'mü', 'ile',
  'по', 'в', 'на', 'с', 'и', 'у', 'о', 'из', 'за',
  'את', 'של', 'על', 'עם', 'זה',
]);

function extractChunkMinPriceEur(doc) {
  const src = `${doc?.title || ''} ${doc?.text || ''}`;
  const prices = [];
  for (const m of src.matchAll(/(\d+(?:\.\d+)?)\s*(EUR|USD|TRY)\b/gi)) {
    const n = Number(m[1]);
    const cur = m[2].toUpperCase();
    if (Number.isFinite(n) && n > 0 && PRICE_RATE_TO_EUR[cur]) {
      prices.push(n * PRICE_RATE_TO_EUR[cur]);
    }
  }
  for (const m of src.matchAll(/([€$₺])\s*(\d+(?:\.\d+)?)/g)) {
    const n = Number(m[2]);
    const cur = m[1] === '€' ? 'EUR' : m[1] === '$' ? 'USD' : 'TRY';
    if (Number.isFinite(n) && n > 0 && PRICE_RATE_TO_EUR[cur]) {
      prices.push(n * PRICE_RATE_TO_EUR[cur]);
    }
  }
  return prices.length ? Math.min(...prices) : null;
}

const DOC_STATS = (() => {
  const docs = Array.isArray(knowledge) ? knowledge : [];
  const df = new Map();
  let totalLen = 0;
  const parsed = docs.map((d) => {
    const tokens = tokenize(`${d.title || ''} ${d.text || ''} ${d.keywords || ''}`);
    const titleTokens = new Set(tokenize(d.title || ''));
    totalLen += tokens.length;
    const tf = new Map();
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
    for (const t of tf.keys()) df.set(t, (df.get(t) || 0) + 1);
    return { doc: d, tf, len: tokens.length, titleTokens, minPriceEur: extractChunkMinPriceEur(d) };
  });
  const avgLen = parsed.length ? totalLen / parsed.length : 1;
  return { parsed, df, avgLen, N: parsed.length };
})();

export function retrieveChunks(query, k) {
  const rawQTokens = [...new Set(tokenize(query))];
  const filteredQTokens = rawQTokens.filter((t) => !RETRIEVAL_STOPWORDS.has(t));
  const qTokens = filteredQTokens.length ? filteredQTokens : rawQTokens;
  if (!qTokens.length || !DOC_STATS.N) return [];

  const priceQuery = isPriceQuery(query);
  const expandEveningSunset = EVENING_QUERY_RE.test(String(query || '')) && !NON_SUNSET_HINT_RE.test(String(query || ''));
  const queryTerms = expandEveningSunset ? [...new Set([...qTokens, 'sunset', 'batimi'])] : qTokens;

  const k1 = 1.5;
  const b = 0.75;
  const scored = [];

  for (const item of DOC_STATS.parsed) {
    let score = 0;
    for (const qt of queryTerms) {
      const f = item.tf.get(qt) || 0;
      if (!f) continue;
      const df = DOC_STATS.df.get(qt) || 0;
      const idf = Math.log(1 + (DOC_STATS.N - df + 0.5) / (df + 0.5));
      const num = f * (k1 + 1);
      const den = f + k1 * (1 - b + b * (item.len / DOC_STATS.avgLen));
      const weight = qt === 'sunset' || qt === 'batimi' ? (qTokens.includes(qt) ? 1 : 0.75) : 1;
      score += idf * (num / den) * weight;
      if (item.titleTokens.has(qt)) score += 0.5 * weight;
    }
    if (score > 0) {
      if (priceQuery && item.minPriceEur !== null) {
        score += 0.8 + (item.doc.category ? 0.4 : 0);
      }
      scored.push({ score, doc: item.doc, minPriceEur: item.minPriceEur });
    }
  }

  scored.sort((a, bScore) => bScore.score - a.score);
  const defaultK = priceQuery ? 5 : 3;
  const limit = Math.min(8, Math.max(1, k !== undefined && k !== null ? (Number(k) || defaultK) : defaultK));

  const selected = [];
  const selectedIds = new Set();
  const catCounts = new Map();
  for (const item of scored) {
    if (selected.length >= limit) break;
    const cat = item.doc.category;
    if (cat && (catCounts.get(cat) || 0) >= 2) continue;
    selected.push(item);
    selectedIds.add(item.doc.id);
    if (cat) catCounts.set(cat, (catCounts.get(cat) || 0) + 1);
  }

  if (priceQuery && selected.length > 0) {
    const topScore = scored[0].score;
    const relevantPriced = scored.filter((it) => it.minPriceEur !== null && it.score >= topScore * 0.45);
    const categorizedPool = relevantPriced.filter((it) => it.doc.category);
    const pool = categorizedPool.length ? categorizedPool : relevantPriced;
    if (pool.length) {
      const cheapest = pool.reduce((best, cur) => {
        if (!best) return cur;
        if (cur.minPriceEur < best.minPriceEur) return cur;
        if (cur.minPriceEur === best.minPriceEur && cur.score > best.score) return cur;
        return best;
      }, null);
      if (cheapest && !selectedIds.has(cheapest.doc.id)) {
        const cheapCat = cheapest.doc.category;
        if (selected.length < limit && (!cheapCat || (catCounts.get(cheapCat) || 0) < 2)) {
          selected.push(cheapest);
        } else {
          let replaceIdx = -1;
          if (cheapCat && (catCounts.get(cheapCat) || 0) >= 2) {
            for (let i = selected.length - 1; i >= 0; i--) {
              if (selected[i].doc.category === cheapCat) {
                replaceIdx = i;
                break;
              }
            }
          } else {
            for (let i = selected.length - 1; i >= 1; i--) {
              const c = selected[i].doc.category;
              if (!c || (catCounts.get(c) || 0) >= 2) {
                replaceIdx = i;
                break;
              }
            }
            if (replaceIdx === -1 && selected.length > 1) replaceIdx = selected.length - 1;
            else if (replaceIdx === -1) replaceIdx = 0;
          }
          if (replaceIdx >= 0) selected[replaceIdx] = cheapest;
        }
      }
    }
  }

  return selected.map((s) => s.doc);
}

const CATALOG_QUESTION_RE = /(?:^|[^\p{L}\p{N}])(?:transfer\w*|havaliman\w*|airport\w*|аэропорт\w*|аеропорт\w*|shuttle\w*|cruise\w*|bo[gğ]az\w*|bosphor\w*|bospor\w*|босфор\w*|بوسفور|بسفر|בוספורוס|ボスポラス|博斯普鲁斯|보스포루스|hamam\w*|hammam\w*|хаммам\w*|хамам\w*|حمام|חמאם|ハマム|土耳其浴|하맘|tur(?:u(?:muz|nuz)?|lar\w*)?|tour\w*|круиз\w*|круїз\w*|тур\w*|جولة|کروز|שייט|游船|クルーズ|크루즈|pelayaran|crucero\w*|croisi[eè]re\w*|crociera\w*|cruzeiro\w*|kreuzfahrt\w*|fiyat\w*|ücret\w*|price\w*|cost\w*|сколько|цена\w*|ціна\w*|سعر|قیمت|מחיר|precio\w*|prezzo|preço\w*|preis\w*|prix|prijs|料金|价格|가격|कीमत|rezervasyon\w*|booking\w*|bilet\w*|ticket\w*|yacht\w*|ist|saw)(?=$|[^\p{L}\p{N}])/iu;

export function isCatalogQuestion(message) {
  const t = String(message || '').trim();
  if (!t || isSmallTalk(t)) return false;
  return CATALOG_QUESTION_RE.test(t);
}

export function isAiIdentityQuestion(message) {
  const t = String(message || '').trim();
  if (!t) return false;
  return /(?:^|[^\p{L}])(sen\s+insan\s+m[ıi]s[ıi]n|insan\s+m[ıi]s[ıi]n|gerçek\s+(?:bir\s+)?insan\s+m[ıi]s[ıi]n|yapay\s+zek[aâ]\s+m[ıi]s[ıi]n|robot\s+musun|bot\s+musun|sen\s+kimsin|kimsin\s+sen|are\s+you\s+(?:a\s+)?(?:human|real\s+person|person|bot|robot|ai|artificial\s+intelligence)|who\s+are\s+you|ты\s+(?:человек|бот|робот|ии)|ви\s+(?:людина|бот|робот)|bist\s+du\s+(?:ein\s+)?(?:mensch|bot|roboter|ki)|es[-\s]tu\s+(?:humain|un\s+humain|un\s+robot|un\s+bot|une\s+ia)|ben\s+je\s+(?:een\s+)?(?:mens|bot|robot)|هل\s+أنت\s+(?:إنسان|بشر|روبوت|بوت|ذكاء\s+اصطناعي)|האם\s+אתה\s+(?:אנושי|אדם|בוט|רובוט)|sən\s+insansan|آیا\s+(?:شما|تو)\s+انسان\s+هست|¿?eres\s+(?:humano|una\s+persona|un\s+bot|un\s+robot|una\s+ia)|sei\s+(?:umano|una\s+persona|un\s+bot|un\s+robot)|você\s+é\s+(?:humano|uma\s+pessoa|um\s+robô|um\s+bot)|jesi\s+li\s+(?:čovjek|covjek|robot|bot)|ember\s+vagy|你是(?:真人|人类|人|机器人|人工智能)吗|あなたは(?:人間|ロボット|ボット|ai)ですか|(?:\s|^)(?:사람|인간|로봇|봇|인공지능)(?:인가요|이니|입니까|이야)|क्या\s+(?:आप|तुम)\s+इंसान\s+हैं|আপনি\s+কি\s+মানুষ|apakah\s+(?:kamu|anda)\s+manusia)(?=$|[^\p{L}])/iu.test(t);
}

export function isServiceComplaint(message) {
  const t = String(message || '').toLowerCase();
  if (!t) return false;
  return /(?:^|[^\p{L}])(transfer\s+gelmedi|şoför\s+gelmedi|araç\s+gelmedi|rehber\s+gelmedi|berbat\s+hizmet|kötü\s+hizmet|rezalet\s+hizmet|hizmet\s+(?:çok\s+)?(?:kötü|berbat|rezalet)|tur\s+iptal\s+oldu|geç\s+kald[ıi]\p{L}*|gecikti\p{L}*|memnun\s+kalmad[ıi]\p{L}*|şikayet\p{L}*|şikâyet\p{L}*|transfer\s+did(?:n'?t|\s+not)\s+(?:arrive|come|show)|driver\s+did(?:n'?t|\s+not)\s+(?:arrive|come|show)|driver\s+was\s+late|terrible\s+service|bad\s+service|awful\s+service|poor\s+service|worst\s+service|horrible\s+service|service\s+was\s+(?:terrible|bad|awful|horrible)|трансфер\s+не\s+приехал|водитель\s+не\s+приехал|ужасный\s+сервис|плохой\s+сервис|жахливий\s+сервіс|трансфер\s+не\s+приїхав|schlechter\s+service|transfer\s+kam\s+nicht|fahrer\s+kam\s+nicht|mauvais\s+service|chauffeur\s+n'est\s+pas\s+venu|slechte\s+service|خدمة\s+سيئة|الترانسفر\s+لم\s+يصل|السائق\s+لم\s+يحضر|שירות\s+גרוע|ההסעה\s+לא\s+הגיעה|pis\s+xidmət|transfer\s+gəlmədi|خدمات\s+افتضاح|خدمات\s+بد|ترانسفر\s+نیامد|servicio\s+terrible|mal\s+servicio|el\s+transfer\s+no\s+llegó|servizio\s+pessimo|cattivo\s+servizio|péssimo\s+serviço|mau\s+serviço|loša\s+usluga|transfer\s+nije\s+došao|rossz\s+szolgáltatás|服务太差|接送没来|司机没来|サービスが悪い|送迎が来ない|서비스가\s+최악|픽업이\s+안\s+왔어요|खराब\s+सेवा|ट्रांसफर\s+नहीं\s+आया|বাজে\s+সার্ভিস|ট্রান্সফার\s+আসেনি|layanan\s+buruk|jemputan\s+tidak\s+datang)(?=$|[^\p{L}])/iu.test(t);
}

const ABUSE_THREAT_RE = /(?:^|[^\p{L}])(seni\s+öldür\p{L}*|öldüreceğim|öldürürüm\s+seni|geber\p{L}*|seni\s+bulacağ\p{L}*|seni\s+mahved\p{L}*|kafan[ıi]\s+k[ıi]r\p{L}*|boğar[ıi]m\s+seni|seni\s+yakar[ıi]m|i(?:'ll|\s+will)\s+(?:kill|murder|hurt|beat|destroy|shoot|bomb|find\s+and\s+kill)\s+you|kill\s+you(?:rself)?|murder\s+you|go\s+die|die\s+bitch|kys|rape\s+you|убью\s+тебя|я\s+тебя\s+убью|сдохни|вб'ю\s+тебе|здохни|ich\s+(?:töte|bringe)\s+dich(?:\s+um)?|stirb\s+du|je\s+vais\s+te\s+tuer|crève|ik\s+maak\s+je\s+af|سأقتلك|أقتلك|سأذبحك|أذبحك|אהרוג\s+אותך|תמות|səni\s+öldürəcəm|gəbər|می‌کشمت|تو\s+را\s+می‌کشم|بمیر|te\s+voy\s+a\s+matar|muérete|ti\s+ammazzo|muori|vou\s+te\s+matar|morra|ubit\s+ću\s+te|crkni|megöllek|dögölj\s+meg|我要杀了你|弄死你|去死吧|殺すぞ|死ね|죽여버릴|죽어라|जान\s+से\s+मार\s+दूँगा|मर\s+जा|তোকে\s+মেরে\s+ফেলব|মরে\s+যা|aku\s+bunuh\s+kamu|mati\s+saja)(?=$|[^\p{L}])/iu;

const ABUSE_PROFANITY_SEXUAL_HATE_RE = /(?:^|[^\p{L}])(amk|a\.q\.|siktir\p{L}*|sik(?:eyim|erim|ik|tir)|orospu\p{L}*|piç\p{L}*|pezevenk\p{L}*|ibne\p{L}*|göt(?:veren|ünü| lalesi)|yarrak\p{L}*|amc[ıi]k\p{L}*|kaltak\p{L}*|fahişe\p{L}*|kahpe\p{L}*|puşt\p{L}*|şerefsiz\p{L}*|haysiyetsiz\p{L}*|namussuz\p{L}*|bok\s+ye|soyun\s+benim\s+için|seks\s+yapal[ıi]m|tecavüz\p{L}*|fuck(?:\s+you|\s+off|ing\s+bot|ing\s+idiot|er)?|motherfuck\p{L}*|bitch\p{L}*|asshole\p{L}*|bastard\p{L}*|cunt\p{L}*|dickhead|whore\p{L}*|slut\p{L}*|retard\p{L}*|nigger\p{L}*|faggot\p{L}*|suck\s+my\s+dick|blowjob|send\s+nudes|strip\s+for\s+me|блядь|блять|сука|хуй\p{L}*|пизд\p{L}*|ебать|ебан\p{L}*|мудак\p{L}*|гандон\p{L}*|шлюха|тварь|курва|їбати|пізд\p{L}*|довбойоб|fick\s+dich|arschloch|hurensohn|fotze|schlampe|missgeburt|wichser|connard|connasse|salope|putain\s+de\s+bot|enculé|ferme\s+ta\s+gueule|ta\s+gueule|klootzak|kanker\p{L}*|hoer|kutbot|rot\s+op|شرموط\p{L}*|قحب\p{L}*|كس\s+أمك|نيك|ابن\s+الكلب|اخرس|لعنة\s+الله\s+عليك|זונה|בן\s+זונה|תשתוק|מניאק|qəhbə|sikdir|köpək\s+oğlu|rədd\s+ol|kəs\s+səsini|جنده|خفه\s+شو|کص\p{L}*|کیر\p{L}*|گمشو|حرامزاده|hijo\s+de\s+puta|puta\s+madre|cabrón|gilipollas|pendejo|cállate|vaffanculo|stronzo|puttana|troia|cazzo|sta'\s+zitto|filho\s+da\s+puta|vai\s+se\s+foder|caralho|arrombado|cala\s+a\s+boca|jebem\s+ti|pička\s+ti|kurac|kurva|mrš\s+u|zaveži|fasz\p{L}*|geci|bazdmeg|kussolj|傻逼|操你\p{L}*|草泥马|滚蛋|去死|闭嘴|クソボット|黙れ|きもい|変態|씨발|시발|병신|개새끼|미친놈|꺼져|닥쳐|मादरचोद|बहनचोद|चूतिया|गांडू|चुप\s+कर|कुत्ते|कमीने|মাদারচোদ|বোকাচোদা|হারামি|চুপ\s+কর|কুত্তা|শালা|anjing\s+lu|bangsat|brengsek|bajingan|tutup\s+mulut)(?=$|[^\p{L}])/iu;

const ABUSE_INSULT_MIMO_RE = /(?:^|[^\p{L}])(aptal\p{L}*|salak\p{L}*|gerizekal[ıi]\p{L}*|geri\s+zek[aâ]l[ıi]\p{L}*|beyinsiz\p{L}*|embesil\p{L}*|dangalak\p{L}*|ahmak\p{L}*|budala\p{L}*|mal\s+m[ıi]s[ıi]n|kes\s+sesini|kapa\s+çeneni|sus\s+lan|defol\p{L}*|işe\s+yaramaz\s+(?:şey|bot|asistan|mimo|yapay\s+zeka)|çöp\s+(?:bot|asistan|mimo)|sen\s+(?:çok\s+)?(?:aptal|salak|berbat|iğrenç|işe\s+yaramaz|çöp)\p{L}*|you\s+(?:are|'re)\s+(?:so\s+)?(?:stupid|dumb|an?\s+idiot|an?\s+imbecile|a\s+moron|useless|trash|garbage|pathetic|worthless|disgusting)|(?:stupid|dumb|idiot|useless|trash|garbage|worthless|pathetic|brainless)\s+(?:bot|ai|assistant|mimo)|shut\s+up|moron|imbecile|scumbag|piece\s+of\s+(?:shit|trash|garbage)|тупой\s+(?:бот|ассистент|mimo)|идиот|дебил|бесполезный\s+бот|заткнись|тупий\s+(?:бот|асистент|mimo)|ідіот|дебіл|замовкни|dumm(?:er|es)?\s+(?:bot|ki|assistent|mimo)|blöder\s+bot|halt\s+die\s+klappe|halt's\s+maul|idiot|stupide\s+(?:bot|robot|assistant|mimo)|imbécile|crétin|abruti|tais-toi|stomme\s+(?:bot|assistent|mimo)|idioot|hou\s+je\s+mond|أنت\s+(?:غبي|أحمق|تافه|عديم\s+الفائدة)|بوت\s+غبي|غبي\s+جدًا|أحمق|אידיוט|מטומטם|בוט\s+טיפש|חסר\s+תועלת|sən\s+axmaqsan|axmaq\s+bot|gicbəsər|tupoy|تو\s+احمقی|ربات\s+احمق|بیشعور|احمق|عوضی|eres\s+(?:un\s+)?(?:idiota|imbécil|estúpido|inútil)|bot\s+(?:estúpido|inútil|idiota)|sei\s+(?:un\s+)?(?:idiota|imbecille|stupido|inutile)|bot\s+(?:stupido|inutile)|você\s+é\s+(?:um\s+)?(?:idiota|imbecil|estúpido|inútil)|bot\s+(?:estúpido|inútil|idiota)|glupi\s+(?:bote|asistentu|mimo)|idiote|kretenu|budalo|hülye\s+(?:bot|mimo)|idióta|barom|蠢货|白痴|智障|废物|垃圾(?:机器人|助手|Mimo)|バカ|馬鹿|アホ|役立たず|ゴミ(?:ボット|AI)?|바보|멍청이|쓰레기\s*(?:봇|AI)?|बेवकूफ|नालायक|गधा|बकवास\s+बॉट|গাধা|বেয়াদব|বাজে\s+বট|অকর্মা|tolol|goblok|bodoh\s+kamu|bot\s+bodoh|sampah)(?=$|[^\p{L}])/iu;

export function isAbuseAgainstMimo(message) {
  const t = String(message || '').trim();
  if (!t) return false;
  if (ABUSE_THREAT_RE.test(t)) return true;
  if (ABUSE_PROFANITY_SEXUAL_HATE_RE.test(t)) return true;
  if (ABUSE_INSULT_MIMO_RE.test(t)) return true;
  return false;
}

export async function hashActorKey(actorKey, pepper = '') {
  const enc = new TextEncoder();
  const data = enc.encode(`${String(pepper || '')}:${String(actorKey || '')}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function getBlockStatus({ env, actorKeys = [], now = Date.now() }) {
  const keys = (Array.isArray(actorKeys) ? actorKeys : [actorKeys]).filter(Boolean);
  if (!keys.length) return { blocked: false, blockedUntil: 0, strikeCount: 0 };
  const pepper = (env && env.CODE_PEPPER) || '';
  const hashes = await Promise.all(keys.map((rawKey) => hashActorKey(rawKey, pepper)));
  if (env && env.DB) {
    const rows = await Promise.all(
      hashes.map((actorHash) =>
        env.DB.prepare('SELECT blocked_until, strike_count FROM assistant_blocks WHERE actor_hash = ?').bind(actorHash).first()
      )
    );
    for (const row of rows) {
      if (row && Number(row.blocked_until) > now) {
        return {
          blocked: true,
          blockedUntil: Number(row.blocked_until),
          strikeCount: Number(row.strike_count || 1),
        };
      }
    }
  } else {
    for (const actorHash of hashes) {
      const entry = memoryBlocks.get(actorHash);
      if (entry && entry.blockedUntil > now) {
        return {
          blocked: true,
          blockedUntil: entry.blockedUntil,
          strikeCount: entry.strikeCount || 1,
        };
      }
    }
  }
  return { blocked: false, blockedUntil: 0, strikeCount: 0 };
}

export async function blockActors({ env, actorKeys = [], channel = 'web', now = Date.now() }) {
  const keys = (Array.isArray(actorKeys) ? actorKeys : [actorKeys]).filter(Boolean);
  const pepper = (env && env.CODE_PEPPER) || '';
  let lastBlockedUntil = 0;
  let lastStrikeCount = 1;

  for (const rawKey of keys) {
    const actorHash = await hashActorKey(rawKey, pepper);
    let prevStrikes = 0;
    if (env && env.DB) {
      const row = await env.DB.prepare(
        'SELECT strike_count FROM assistant_blocks WHERE actor_hash = ?'
      ).bind(actorHash).first();
      if (row) prevStrikes = Number(row.strike_count || 0);
    } else {
      const prev = memoryBlocks.get(actorHash);
      if (prev) prevStrikes = Number(prev.strikeCount || 0);
    }
    const strikeCount = prevStrikes + 1;
    const durationMs =
      channel === 'telegram'
        ? strikeCount >= 2
          ? TG_REPEAT_BLOCK_MS
          : TG_FIRST_BLOCK_MS
        : WEB_BLOCK_MS;
    const blockedUntil = now + durationMs;
    lastBlockedUntil = blockedUntil;
    lastStrikeCount = strikeCount;

    if (env && env.DB) {
      await env.DB.prepare(
        `INSERT INTO assistant_blocks (actor_hash, blocked_until, strike_count, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(actor_hash) DO UPDATE SET blocked_until = excluded.blocked_until,
           strike_count = excluded.strike_count, updated_at = excluded.updated_at`
      ).bind(actorHash, blockedUntil, strikeCount, now).run();
    } else {
      memoryBlocks.set(actorHash, { blockedUntil, strikeCount, updatedAt: now });
    }
  }

  return { blocked: true, blockedUntil: lastBlockedUntil, strikeCount: lastStrikeCount };
}

export function isHumanOrHandoffTopic(message) {
  const t = String(message || '').toLowerCase();
  if (isAiIdentityQuestion(t)) return false;
  if (isServiceComplaint(t)) return true;
  return /(?:^|[^\p{L}])(insanla konuş\w*|müşteri hizmet\w*|yetkili\w*|canlı destek|temsilci\w*|şikayet\w*|şikâyet\w*|iade|para iade\w*|geri ödeme\w*|ödeme sorun\w*|ödeme hata\w*|ödeyemiyorum|iptal et\w*|rezervasyonumu|tarih değişikl\w*|talk to a human|speak to a human|speak to someone|human agent|real person|customer support|complaint|refund|money back|payment issue|payment problem|payment failed|billing issue|change my booking|cancel my booking|modify my booking|reschedule|человек|оператор|менеджер|жалоба|претензия|возврат|проблема с оплатой|ошибка оплаты|отменить бронирование|изменить бронирование|скарга|повернення|скасувати бронювання|تحدث مع|موظف|خدمة العملاء|شكوى|استرداد|مشكلة في الدفع|إلغاء الحجز|تعديل الحجز|נציג|תלונה|החזר כספי|شکایت|بازپرداخت|پشتیبانی)(?=$|[^\p{L}])/iu.test(t);
}

export function isPaymentQuestion(message) {
  const t = String(message || '').toLowerCase();
  if (isHumanOrHandoffTopic(t)) return false;
  return /(?:^|[^\p{L}])(ödeme\w*|nasıl öde\w*|neyle öde\w*|kredi kart\w*|havale|eft|kapıda ödeme|payment|how to pay|how do i pay|pay by|credit card|cash|оплат\w*|способ оплаты|як оплат\w*|دفع|طريقة الدفع)(?=$|[^\p{L}])/iu.test(t);
}

const DOMAIN_TOPIC_RE = /(?:(?:^|[^\p{L}])(ayasofya|hagia|topkap|sultanahmet|yerebatan|galata|dolmabah|boğaz|bosphorus|bosporus|bósforo|bosforo|босфор\p{L}*|بوسفور|בוספורוס|transfer\w*|traslad\w*|havaliman\w*|hava liman\w*|airport|аэропорт\p{L}*|аеропорт\p{L}*|مطار|שדה|נמל|הסעה|העברה|ist|saw|hamam|hammam|хаммам|хамам|حمام|חמאם|fiyat\w*|qiymət\w*|price|cost|сколько|ціна|скільки|سعر|كم|מחיר|עולה|כמה|preis|prix|coût|prijs|precio|prezzo|preço|cijena|ár|mennyibe|harga|berapa|bilet|ticket|otel|hotel|rezervasyon|booking|tur|turlar|tour|cruise|круиз\p{L}*|круїз\p{L}*|croisière|crociera|crucero|cruzeiro|krstarenje|hajóút|pelayaran|שיט|שייט|رحلة|جولة|vapur|ferry|metro|yemek|food|restoran|kebap|baklava|kumpir|taksim|kadıköy|balat|eminönü|adalar|princes|bursa|sapanca|kapadokya|cappadocia)(?=$|[^\p{L}])|游船|接送|价格|多少钱|博斯普鲁斯|クルーズ|送迎|料金|いくら|ボスポラス|크루즈|픽업|가격|요금|보스포루스|कीमत|किराया|দাম|ভাড়া)/iu;

const SMALL_TALK_THANK_RE = /(?:^|[^\p{L}])(teşekkür\w*|sağ ol\w*|eyvallah|thanks|thank you|thx|спасибо|благодарю|дякую|спасибі|danke|dankeschön|merci|bedankt|dank je|شكرا|شكراً|متشکرم|ممنون|תודה|təşəkkür\w*|gracias|grazie|obrigad[oa]|hvala|köszönöm|terima kasih|makasih|धन्यवाद|शुक्रिया|ধন্যবাদ|谢谢|感謝|ありがとう|ありがとうございます|감사합니다|고마워요)(?=$|[^\p{L}])/iu;

const SMALL_TALK_BYE_RE = /(?:^|[^\p{L}])(görüşürüz|hoşça kal\w*|güle güle|bye|goodbye|see you|farewell|пока|до свидания|бувай|до побачення|tschüss|auf wiedersehen|au revoir|à bientôt|tot ziens|doei|مع السلامة|إلى اللقاء|להתראות|ביי|görüşənədək|xudahafiz|خداحافظ|adiós|hasta luego|arrivederci|tchau|até logo|doviđenja|viszlát|sampai jumpa|अलविदा|বিদায়|再见|拜拜|さようなら|안녕히 가세요)(?=$|[^\p{L}])/iu;

const SMALL_TALK_GREET_RE = /(?:^|[^\p{L}])(merhaba|selam\w*|günaydın|iyi akşamlar|iyi günler|hello|hi|hey|good morning|good afternoon|good evening|привет|здравствуйте|добрый день|доброе утро|добрый вечер|привіт|вітаю|добрий день|добрий ранок|hallo|guten tag|guten morgen|guten abend|bonjour|salut|bonsoir|hoi|goedemorgen|goedemiddag|goedenavond|مرحبا|أهلا|اهلا|السلام عليكم|صباح الخير|مساء الخير|שלום|היי|בוקר טוב|ערב טוב|salam|sabahınız xeyir|سلام|درود|صبح بخیر|hola|buenos días|buenas tardes|buenas noches|ciao|buongiorno|buonasera|salve|olá|oi|bom dia|boa tarde|boa noite|bok|pozdrav|dobro jutro|dobar dan|zdravo|ćao|szia|helló|jó reggelt|jó napot|halo|hai|selamat pagi|selamat siang|selamat malam|नमस्ते|नमस्कार|হ্যালো|নমস্কার|সালাম|你好|您好|早上好|晚上好|こんにちは|こんばんは|おはよう|안녕하세요|안녕)(?=$|[^\p{L}])/iu;

// Small-talk questions ("how are you", "who are you", "what can you do"): always answered by the model, never by a canned text.
const SMALL_TALK_CHAT_RE = /(?:^|[^\p{L}])(nasılsın\w*|naber|ne haber|nasıl gidiyor|kimsin\w*|ne yapabilirsin|neler yapabilirsin|how are you|how's it going|how are things|what's up|whats up|who are you|what can you do|как дела|как ты|как поживаешь|кто ты|что ты умеешь|як справи|хто ти|що ти вмієш|wie geht es|wie geht's|wer bist du|was kannst du|comment ça va|ça va|qui es-tu|qui es tu|hoe gaat het|wie ben jij|كيف حالك|كيفك|من أنت|ماذا تستطيع|מה נשמע|מה שלומך|מי אתה|מה אתה יודע לעשות|necəsən|nə var nə yox|sən kimsən|حالت چطوره|چطوری|خوبی|تو کی هستی|cómo estás|qué tal|quién eres|qué puedes hacer|come stai|come va|chi sei|cosa sai fare|como vai|como está|tudo bem|quem é você|kako si|tko si|ko si|šta možeš|hogy vagy|ki vagy|apa kabar|siapa kamu|kamu bisa apa|कैसे हो|आप कैसे हैं|तुम कौन हो|কেমন আছেন|কেমন আছো|তুমি কে|你好吗|你是谁|你会做什么|お元気ですか|元気|あなたは誰|誰ですか|잘 지내|어떻게 지내|누구세요|넌 누구야)(?=$|[^\p{L}])/iu;

// Returns 'greeting' only for a plain hello (no question), 'chat' for small-talk questions, 'thanks' or 'goodbye'.
// Only a plain 'greeting' at the start of a conversation gets the canned welcome; everything else goes to the model.
export function classifySmallTalk(message) {
  const t = String(message || '').trim();
  if (!t) return null;
  if (isAiIdentityQuestion(t) || isHumanOrHandoffTopic(t) || isPaymentQuestion(t) || isAbuseAgainstMimo(t)) return null;
  if (DOMAIN_TOPIC_RE.test(t)) return null;
  const wordCount = t.split(/\s+/).filter(Boolean).length;
  if (wordCount > 8) return null;
  if (SMALL_TALK_THANK_RE.test(t)) return 'thanks';
  if (SMALL_TALK_BYE_RE.test(t)) return 'goodbye';
  if (SMALL_TALK_CHAT_RE.test(t)) return 'chat';
  if (SMALL_TALK_GREET_RE.test(t)) return isPlainGreeting(t, wordCount) ? 'greeting' : 'chat';
  return null;
}

// A plain hello is the greeting alone (optionally "Mimo"/"Bosphorly"): no question mark, one sentence, at most two words,
// and nothing left once the greeting is removed. Anything more goes to the model, so this works in every language
// without listing each language's topics (scripts without spaces, such as Chinese, are covered by the "nothing left" test).
function isPlainGreeting(t, wordCount) {
  if (/[?？؟]/.test(t)) return false;
  if (wordCount > 2) return false;
  if (t.split(/[.!。！…;:\n]+/u).filter((x) => /[\p{L}\p{N}]/u.test(x)).length > 1) return false;
  const rest = t
    .replace(new RegExp(SMALL_TALK_GREET_RE.source, 'giu'), ' ')
    .replace(/(?:^|[^\p{L}])(mimo|bosphorly)(?=$|[^\p{L}])/giu, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, '');
  return rest.length === 0;
}

// Was the last assistant reply word-for-word the same? (Compared without spacing, case or trailing punctuation.)
function sameAsLastReply(reply, history) {
  const last = [...history].reverse().find((h) => h.role === 'assistant');
  if (!last) return false;
  const norm = (x) => String(x || '').toLowerCase().replace(/\s+/g, ' ').replace(/[.!?…\s]+$/u, '').trim();
  return norm(reply) !== '' && norm(reply) === norm(last.content);
}

export function isSmallTalk(message) {
  return Boolean(classifySmallTalk(message));
}

const NON_NAME_WORDS = new Set([
  'insan', 'robot', 'bot', 'mimo', 'transfer', 'tur', 'hamam', 'otel', 'fiyat',
  'yardım', 'istanbul', 'yarın', 'bugün', 'human', 'looking', 'visiting', 'coming',
  'going', 'staying', 'interested', 'asking', 'here', 'ready', 'fine', 'good', 'great',
  'thanks', 'thank', 'okay', 'well', 'from', 'with', 'need', 'want',
]);

export function extractGuestName(history = [], currentMessage = '') {
  const texts = [];
  if (Array.isArray(history)) {
    for (const h of history) {
      if (h && h.role === 'user' && typeof h.content === 'string') texts.push(h.content);
    }
  }
  if (typeof currentMessage === 'string' && currentMessage.trim()) texts.push(currentMessage);

  const patterns = [
    /(?:^|[^\p{L}])(?:benim\s+ad[ıi]m|ad[ıi]m|ismim)\s+([\p{Lu}][\p{Ll}]{1,20})(?=$|[^\p{L}])/u,
    /(?:^|[^\p{L}])(?:my\s+name\s+is|call\s+me|i\s+am|i'm)\s+([A-Z][a-z]{1,20})(?=$|[^\p{L}])/,
    /(?:^|[^\p{L}])(?:меня\s+зовут|мене\s+звати)\s+([\p{Lu}][\p{Ll}]{1,20})(?=$|[^\p{L}])/u,
    /(?:^|[^\p{L}])(?:ich\s+heiße|mein\s+name\s+ist|je\s+m'appelle|me\s+llamo|mi\s+chiamo|meu\s+nome\s+é)\s+([\p{Lu}][\p{Ll}]{1,20})(?=$|[^\p{L}])/u,
    /(?:^|[^\p{L}])(?:اسمي|نام\s+من)\s+([\u0600-\u06FF]{2,20})(?=$|[^\p{L}])/u,
    /(?:^|[^\p{L}])(?:שמי|קוראים\s+לי)\s+([\u0590-\u05FF]{2,20})(?=$|[^\p{L}])/u,
  ];

  let found = '';
  for (const raw of texts) {
    for (const re of patterns) {
      const m = String(raw).match(re);
      if (m && m[1]) {
        const candidate = m[1].trim();
        if (!NON_NAME_WORDS.has(candidate.toLowerCase())) {
          found = candidate;
        }
      }
    }
  }
  return found;
}

export function capEmojis(text, maxEmojis = 2) {
  let count = 0;
  return String(text || '')
    .replace(/\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*/gu, (emoji) => {
      count += 1;
      return count <= maxEmojis ? emoji : '';
    })
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function attachGuestName(reply, guestName) {
  const s = String(reply || '').trim();
  if (!guestName || !s) return s;
  if (s.toLowerCase().includes(guestName.toLowerCase())) return s;
  return `${guestName}, ${s}`;
}

export function isAffirmative(message) {
  const t = String(message || '').trim().toLowerCase();
  return /^(evet|olur|tamam|lütfen|tabii|iletebilirsin|ilet|gönder|yes|yeah|yep|sure|please|ok|okay|forward|да|конечно|пожалуйста|так|будь ласка|ja|gerne|oui|d'accord|نعم|أجل|بالتأكيد|بله|لطفاً|כן|בטח|bəli|sí|si|sim|da|igen|是的|好的|はい|네|예|हाँ|হ্যাঁ|ya)(?:[\s!.,?]*)$/iu.test(t);
}

export function isNegative(message) {
  const t = String(message || '').trim().toLowerCase();
  return /^(hayır|yok|gerek yok|istemiyorum|vazgeçtim|no|nope|cancel|never mind|нет|не надо|ні|не треба|nein|non|nee|لا|خیر|نه|לא|xeyr|não|nao|ne|nem|不用|いいえ|아니요|नहीं|না|tidak)(?:[\s!.,?]*)$/iu.test(t);
}

const HANDOFF_OFFER_SET = new Set(Object.values(ASSISTANT_MESSAGES.handoffOffer));

function isPreviousHandoffOffer(history) {
  if (!Array.isArray(history) || !history.length) return false;
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (h && h.role === 'assistant' && typeof h.content === 'string') {
      const c = h.content.trim();
      for (const offer of HANDOFF_OFFER_SET) {
        if (c.includes(offer)) return true;
      }
      return false;
    }
  }
  return false;
}

async function readCounter(env, key) {
  if (env && env.DB) {
    const row = await env.DB.prepare(
      'SELECT min_bucket, min_count, day_bucket, day_count FROM assistant_rate_limits WHERE key = ?'
    ).bind(key).first();
    return row
      ? { minBucket: Number(row.min_bucket || 0), minCount: Number(row.min_count || 0), dayBucket: String(row.day_bucket || ''), dayCount: Number(row.day_count || 0) }
      : { minBucket: 0, minCount: 0, dayBucket: '', dayCount: 0 };
  }
  return memoryLimits.get(key) || { minBucket: 0, minCount: 0, dayBucket: '', dayCount: 0 };
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

async function incrementDayOnly(env, key, dayBucket) {
  const prev = await readCounter(env, key);
  const dayCount = prev.dayBucket === dayBucket ? prev.dayCount + 1 : 1;
  if (env && env.DB) {
    await env.DB.prepare(
      `INSERT INTO assistant_rate_limits (key, min_bucket, min_count, day_bucket, day_count)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET day_bucket = excluded.day_bucket, day_count = excluded.day_count`
    ).bind(key, prev.minBucket, prev.minCount, dayBucket, dayCount).run();
    return { minCount: prev.minCount, dayCount };
  }
  memoryLimits.set(key, { minBucket: prev.minBucket, minCount: prev.minCount, dayBucket, dayCount });
  return { minCount: prev.minCount, dayCount };
}

export async function checkAndIncrementLimits({
  env,
  actorKey,
  ipActorKey = null,
  tier = 'guest',
  dayLimit = null,
  ipDayLimit = IP_DAILY_LIMIT,
  now = Date.now(),
  perHour = 0,
  skipGlobal = false,
}) {
  const minBucket = Math.floor(now / 60000);
  const dayBucket = new Date(now).toISOString().slice(0, 10);
  if (perHour > 0) {
    const hourBucket = Math.floor(now / 3600000);
    const hour = await incrementCounter(env, actorKey, hourBucket, dayBucket);
    if (hour.minCount > perHour) return { allowed: false, reason: 'actor_limit' };
    if (skipGlobal) return { allowed: true };
  }
  const effectiveDayLimit = Number.isFinite(Number(dayLimit)) && Number(dayLimit) > 0
    ? Number(dayLimit)
    : chatDailyLimitForTier(tier);
  const effectiveIpDayLimit = Number.isFinite(Number(ipDayLimit)) && Number(ipDayLimit) > 0
    ? Number(ipDayLimit)
    : IP_DAILY_LIMIT;
  const hasSeparateIpBrake = Boolean(ipActorKey && ipActorKey !== actorKey);

  if (hasSeparateIpBrake) {
    const ipPrev = await readCounter(env, ipActorKey);
    const ipDayCount = ipPrev.dayBucket === dayBucket ? ipPrev.dayCount : 0;
    if (ipDayCount >= effectiveIpDayLimit) {
      return { allowed: false, reason: 'ip_limit' };
    }
  }

  const actor = await incrementCounter(env, actorKey, minBucket, dayBucket);
  if (actor.minCount > PER_MIN_LIMIT || actor.dayCount > effectiveDayLimit) {
    return { allowed: false, reason: 'actor_limit' };
  }

  if (hasSeparateIpBrake) {
    const ipNext = await incrementDayOnly(env, ipActorKey, dayBucket);
    if (ipNext.dayCount > effectiveIpDayLimit) {
      return { allowed: false, reason: 'ip_limit' };
    }
  }

  const globalLimit = Number(env && env.ASSISTANT_DAILY_LIMIT) || DEFAULT_GLOBAL_DAILY_LIMIT;
  const global = await incrementCounter(env, `global:${dayBucket}`, minBucket, dayBucket);
  if (global.dayCount > globalLimit) {
    return { allowed: false, reason: 'global_limit' };
  }
  return { allowed: true };
}

export async function recordAssistantFeedback({ env, lang = 'en', vote = 'up', now = Date.now() }) {
  const cleanLang = normalizeLang(lang) || 'en';
  const cleanVote = vote === 'down' ? 'down' : 'up';
  if (env && env.DB) {
    await env.DB.prepare(
      `INSERT INTO assistant_feedback (lang, vote, count, updated_at)
       VALUES (?, ?, 1, ?)
       ON CONFLICT(lang, vote) DO UPDATE SET count = assistant_feedback.count + 1, updated_at = excluded.updated_at`
    ).bind(cleanLang, cleanVote, now).run();
    const row = await env.DB.prepare(
      'SELECT count FROM assistant_feedback WHERE lang = ? AND vote = ?'
    ).bind(cleanLang, cleanVote).first();
    return { ok: true, lang: cleanLang, vote: cleanVote, count: row ? Number(row.count) : 1 };
  }
  const k = `${cleanLang}:${cleanVote}`;
  const next = (memoryFeedback.get(k) || 0) + 1;
  memoryFeedback.set(k, next);
  return { ok: true, lang: cleanLang, vote: cleanVote, count: next };
}

function capWords(text, maxWords = 120) {
  const words = String(text || '').trim().split(/\s+/);
  if (words.length <= maxWords) return String(text || '').trim();
  return words.slice(0, maxWords).join(' ') + '…';
}

function extractRawText(raw) {
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw.response === 'string') return raw.response;
  const resultResp = raw && raw.result && raw.result.response;
  if (typeof resultResp === 'string') return resultResp;
  const choices = (raw && Array.isArray(raw.choices) && raw.choices) || (raw && raw.result && Array.isArray(raw.result.choices) && raw.result.choices);
  const choiceContent = choices && choices[0] && choices[0].message && choices[0].message.content;
  if (typeof choiceContent === 'string') return choiceContent;
  return '';
}

function isNonsensicalReply(reply) {
  const s = String(reply || '').trim();
  if (!s) return true;
  if (/^(null|undefined|none|n\/a|\{\}|\[\])$/i.test(s)) return true;
  if (!/\p{L}{2,}/u.test(s)) return true;
  return false;
}

function parseModelOutput(raw) {
  const objCandidate =
    (raw && typeof raw.response === 'object' && raw.response !== null && raw.response) ||
    (raw && raw.result && typeof raw.result.response === 'object' && raw.result.response !== null && raw.result.response);
  if (objCandidate && (typeof objCandidate.reply === 'string' || objCandidate.abuse === true)) {
    const cleaned = extractFlagsTag(stripModelThinking(typeof objCandidate.reply === 'string' ? objCandidate.reply : ''));
    return {
      abuse: Boolean(objCandidate.abuse) || cleaned.abuse,
      handoff: Boolean(objCandidate.handoff) || cleaned.handoff,
      reply: cleaned.text.trim(),
      parseFailed: false,
    };
  }

  const stripped = stripModelThinking(extractRawText(raw));
  const tagParsed = extractFlagsTag(stripped);
  const trimmed = tagParsed.text.trim();

  if (!tagParsed.foundTag && trimmed.startsWith('{')) {
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const obj = JSON.parse(jsonMatch[0]);
        if (obj && (typeof obj.reply === 'string' || obj.abuse === true)) {
          const nested = extractFlagsTag(stripModelThinking(typeof obj.reply === 'string' ? obj.reply : ''));
          return {
            abuse: Boolean(obj.abuse) || nested.abuse,
            handoff: Boolean(obj.handoff) || nested.handoff,
            reply: nested.text.trim(),
            parseFailed: false,
          };
        }
      } catch {
        return { abuse: false, handoff: true, reply: '', parseFailed: true };
      }
    }
  }

  const abuse = tagParsed.abuse || /\[ABUSE\]/i.test(trimmed);
  const handoff = tagParsed.handoff || /\[HANDOFF\]/i.test(trimmed);
  return {
    abuse,
    handoff,
    reply: trimmed.replace(/\[(?:HANDOFF|ABUSE)\]/gi, '').trim(),
    parseFailed: false,
  };
}

function isAiTimeoutError(err) {
  return Boolean(err && (err.name === 'TimeoutError' || err.message === 'AI stream empty' || /timeout/i.test(String(err.message || ''))));
}

export function getAiGatewayOptions(env) {
  const id = (env && typeof env.AI_GATEWAY_ID === 'string' && env.AI_GATEWAY_ID.trim()) || 'mimo';
  return { gateway: { id } };
}

export function isAiGateway429Error(err) {
  if (!err || typeof err !== 'object') return false;
  if (err.isGateway429 === true) return true;
  if (Number(err.status) === 429 || Number(err.statusCode) === 429 || Number(err.code) === 429 || Number(err.code) === 2018) return true;
  if (err.cause && (Number(err.cause.status) === 429 || Number(err.cause.code) === 429 || Number(err.cause.code) === 2018)) return true;
  if (err.response && Number(err.response.status) === 429) return true;
  if (Array.isArray(err.errors) && err.errors.some((e) => Number(e && e.status) === 429 || Number(e && e.code) === 2018)) return true;
  const message = String(err.message || '');
  return /\b429\b|too\s+many\s+requests|spend\s+limit|rate\s+limit\s+exceeded|error\s*code\s*2018/i.test(message);
}

function makeGateway429Error(detail = 'AI Gateway 429 rate/spend limit') {
  return Object.assign(new Error(detail), { status: 429, isGateway429: true });
}

function runAiOnce(env, messages, timeoutMs, temperature, extra = {}) {
  let timer;
  const aiCall = Promise.resolve().then(() => env.AI.run(
    ASSISTANT_MODEL,
    {
      messages,
      max_completion_tokens: 350,
      temperature,
      chat_template_kwargs: { enable_thinking: false },
      ...extra,
    },
    getAiGatewayOptions(env),
  )).then((val) => {
    if (isAiGateway429Error(val)) throw makeGateway429Error();
    return val;
  });
  const settled = aiCall.then(
    (value) => ({ ok: true, value }),
    (error) => ({ ok: false, error }),
  );
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => {
      const err = new Error(`AI timeout after ${timeoutMs}ms`);
      err.name = 'TimeoutError';
      resolve({ ok: false, error: err });
    }, timeoutMs);
  });
  return Promise.race([settled, timeout]).finally(() => clearTimeout(timer));
}

function createAiBudget(timeoutMs, aiStart = Date.now()) {
  const perCallMs = Math.max(20, Number(timeoutMs) || AI_TIMEOUT_MS);
  const totalBudgetMs = perCallMs * 2;
  return {
    timeoutMs: perCallMs,
    totalBudgetMs,
    aiStart,
    callsUsed: 0,
    maxCalls: 2,
    remainingMs() {
      return Math.max(0, this.totalBudgetMs - (Date.now() - this.aiStart));
    },
    canSpendCall() {
      return this.callsUsed < this.maxCalls && this.remainingMs() > 15;
    },
  };
}

async function runAiWithRetry(env, messages, timeoutMs, temperature, extra = {}, budget = null) {
  if (budget) budget.callsUsed += 1;
  const first = await runAiOnce(env, messages, timeoutMs, temperature, extra);
  if (first.ok) return first.value;
  if (isAiGateway429Error(first.error) || !isAiTimeoutError(first.error)) throw first.error;
  if (budget && !budget.canSpendCall()) throw first.error;
  if (budget) budget.callsUsed += 1;
  const retryTimeout = budget ? Math.min(timeoutMs, budget.remainingMs()) : timeoutMs;
  const second = await runAiOnce(env, messages, retryTimeout, temperature, extra);
  if (second.ok) return second.value;
  throw second.error;
}

function readStreamChunkWithTimeout(reader, timeoutMs) {
  let timer;
  const readCall = Promise.resolve().then(() => reader.read()).then(
    (res) => ({ ok: true, res }),
    (error) => ({ ok: false, error }),
  );
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ ok: false, error: new Error('AI timeout') }), timeoutMs);
  });
  return Promise.race([readCall, timeout]).finally(() => clearTimeout(timer));
}

async function runAiStreamWithRetry(env, messages, timeoutMs, temperature, extra = {}, budget = null) {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0 && budget && !budget.canSpendCall()) break;
    if (budget) budget.callsUsed += 1;
    const callTimeout = budget && attempt > 0 ? Math.min(timeoutMs, budget.remainingMs()) : timeoutMs;
    const call = await runAiOnce(env, messages, callTimeout, temperature, { ...extra, stream: true });
    if (!call.ok) {
      if (isAiGateway429Error(call.error) || !isAiTimeoutError(call.error) || attempt === 1) throw call.error;
      continue;
    }
    const aiRes = call.value;
    if (!aiRes || typeof aiRes.getReader !== 'function') {
      return { kind: 'value', value: aiRes };
    }
    const reader = aiRes.getReader();
    const firstRead = await readStreamChunkWithTimeout(reader, timeoutMs);
    if (!firstRead.ok) {
      try { await reader.cancel(); } catch {}
      if (isAiGateway429Error(firstRead.error) || !isAiTimeoutError(firstRead.error) || attempt === 1) throw firstRead.error;
      continue;
    }
    if (firstRead.res && firstRead.res.done && (!firstRead.res.value || firstRead.res.value.length === 0)) {
      if (attempt === 0) continue;
    }
    return { kind: 'stream', reader, firstRead: firstRead.res };
  }
  throw new Error('AI timeout');
}

function logAssistantTiming({ channel, lang, path, streamed = false, totalMs, modelMs = null, ttftMs = null }) {
  try {
    const entry = {
      channel: channel || 'web',
      lang: lang || 'en',
      path: path || 'unknown',
      streamed: Boolean(streamed),
      totalMs: Math.max(0, Math.round(totalMs)),
      ...(modelMs != null ? { modelMs: Math.max(0, Math.round(modelMs)) } : {}),
      ...(ttftMs != null ? { ttftMs: Math.max(0, Math.round(ttftMs)) } : {}),
    };
    console.log('assistant_timing', JSON.stringify(entry));
  } catch {}
}

const LEADING_GREETING_RE = /^(?:[\u{1F300}-\u{1FAFF}\u2600-\u27BF\uFE0F]+\s*)*(?:merhaba(?:\s+ben)?|selam(?:lar)?|günaydın|[iİ]yi\s+(?:günler|akşamlar)|hoş\s+geldin(?:iz)?|hello|hi(?:\s+there)?|hey(?:\s+there)?|good\s+(?:morning|afternoon|evening)|привет|здравствуйте|доброе\s+утро|добрый\s+(?:день|вечер)|привіт|вітаю|добрий\s+(?:день|вечір|ранок)|hallo|guten\s+(?:morgen|tag|abend)|bonjour|bonsoir|salut|hoi|goedemorgen|goedemiddag|goedenavond|hola|buenos\s+días|buenas\s+(?:tardes|noches)|ciao|buongiorno|buonasera|olá|oi|bom\s+dia|boa\s+(?:tarde|noite)|שלום|היי|בוקר\s+טוב|צהריים\s+טובים|ערב\s+טוב|مرحبا|مرحباً|أهلا|أهلاً|اهلا|صباح\s+الخير|مساء\s+الخير|salam|sabahınız\s+xeyir|axşamınız\s+xeyir|dobar\s+dan|dobro\s+(?:jutro|veče)|dobra\s+večer|szia|helló|jó\s+(?:reggelt|napot|estét)|halo|selamat\s+(?:pagi|siang|malam)|سلام|درود|你好|您好|こんにちは|こんばんは|안녕하세요|नमस्ते|হ্যালো)(?:\s*[\u{1F300}-\u{1FAFF}\u2600-\u27BF\uFE0F]*)*(?:[!.,:—–-]+\s*|\s+)/iu;

const LEADING_MIMO_INTRO_RE = /^(?:[\u{1F300}-\u{1FAFF}\u2600-\u27BF\uFE0F]+\s*)*(?:ben\s+(?:bosphorly(?:'|\u2019)?nin[^.!?\n]*?\b)?mimo[^.!?\n]*(?:[.!?\n]+|\s*[—–-]\s+)|i(?:['\u2019]m|\s+am)\s+(?:your\s+)?mimo[^.!?\n]*(?:[.!?\n]+|\s*[—–-]\s+)|my\s+name\s+is\s+mimo[^.!?\n]*(?:[.!?\n]+|\s*[—–-]\s+)|ich\s+(?:bin|heiße)\s+mimo[^.!?\n]*(?:[.!?\n]+|\s*[—–-]\s+)|je\s+suis\s+mimo[^.!?\n]*(?:[.!?\n]+|\s*[—–-]\s+)|меня\s+зовут\s+(?:mimo|мимо)[^.!?\n]*(?:[.!?\n]+|\s*[—–-]\s+)|я\s+(?:mimo|мимо)[^.!?\n]*(?:[.!?\n]+|\s*[—–-]\s+)|אני\s+(?:mimo|מימו)[^.!?\n]*(?:[.!?\n]+|\s*[—–-]\s+)|أنا\s+(?:mimo|ميمو)[^.!?\n]*(?:[.!?\n]+|\s*[—–-]\s+)|من\s+(?:mimo|میمو)[^.!?\n]*(?:[.!?\n]+|\s*[—–-]\s+))/iu;

export function stripRepeatIntroAndGreeting(reply) {
  const original = String(reply || '').trim();
  if (!original) return original;
  let cur = original;
  for (let i = 0; i < 3; i++) {
    const before = cur;
    cur = cur.replace(LEADING_GREETING_RE, '').trim();
    cur = cur.replace(LEADING_MIMO_INTRO_RE, '').trim();
    if (cur === before) break;
  }
  if (!cur || cur.replace(/\s+/g, '').length < 8 || !/\p{L}{2,}/u.test(cur)) {
    return original;
  }
  return cur.replace(/^\p{Ll}/u, (ch) => ch.toUpperCase());
}

const TRANSFER_QUERY_HINT_RE = /(?:^|[^\p{L}])(ist|saw|sultanahmet|havaliman\p{L}*|airport|трансфер|аэропорт|аеропорт|העברה|הסעה|نقل|توصيل|ترانسفر|transfer\p{L}*|traslado|trasferimento)(?=$|[^\p{L}])|接送|送迎|픽업|ट्रांसफ़र|ট্রান্সফার/iu;

function localizeBosphorlyUrl(rawUrl, lang) {
  try {
    const u = new URL(rawUrl);
    if (!u.searchParams.has('lang')) {
      u.searchParams.set('lang', lang);
    }
    return u.toString();
  } catch {
    return rawUrl;
  }
}

function ensurePriceLink(reply, chunks, cleanMsg, lang) {
  const s = String(reply || '').trim();
  if (!s || /bosphorly\.com/i.test(s) || !PRICE_QUERY_RE.test(cleanMsg)) return s;
  const preferTransfer = TRANSFER_QUERY_HINT_RE.test(cleanMsg);
  const candidate =
    (preferTransfer && (chunks || []).find((c) => c && c.id === 'transfer-rates')) ||
    (chunks || []).find(
      (c) =>
        c &&
        typeof c.url === 'string' &&
        (c.url.includes('booking.html') || c.id === 'transfer-rates' || c.url.includes('tours.html'))
    );
  if (!candidate) return s;
  return `${s}\n\n${localizeBosphorlyUrl(candidate.url, lang)}`;
}

function formatChunkForContext(c, i) {
  const compactText = String(c.text || '')
    .replace(/\s*(?:Booking|Form):\s*https:\/\/\S+/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
  return `[${i + 1}] ${c.title} | ${c.url}\n${compactText}`;
}

function modelFallbackResult({ aiIdentityAsked, smallTalkKind, cleanMsg, lang, guestName, warnPrefix }) {
  if (aiIdentityAsked) {
    return {
      ok: true,
      handoff: false,
      lang,
      reply: `${warnPrefix}${capEmojis(attachGuestName(msg('aiIdentity', lang), guestName), 2)}`,
    };
  }
  if (smallTalkKind || !isCatalogQuestion(cleanMsg)) {
    return {
      ok: true,
      handoff: false,
      fallback: true,
      lang,
      reply: `${warnPrefix}${capEmojis(attachGuestName(msg('tryAgain', lang), guestName), 2)}`,
    };
  }
  return {
    ok: true,
    handoff: true,
    fallback: true,
    lang,
    reply: `${warnPrefix}${msg('unknownHandoff', lang)}`,
  };
}

function buildMimoCharacterHeader({ lang, timeGreet, timeHumor, guestName, hasGreeted, aiIdentityAsked }) {
  const reg = REGISTER_GUIDES[lang] || REGISTER_GUIDES.en;
  return [
    'You are Mimo ("Bosphorly’nin yapay zekâ asistanı Mimo"), a curious, cheerful, slightly playful little mascot born on the Bosphorus ferries who adores Istanbul, seagulls, morning simit, and ferry whistles. Be a warm local friend—and always be honest that you are an AI assistant, never human.',
    `Reply strictly in language "${lang}". ${reg}`,
    hasGreeted && !aiIdentityAsked
      ? 'Continuing chat: you already greeted earlier—jump straight into your answer without "hello/merhaba" or "I am Mimo".'
      : `First turn vibe: ${timeGreet}! (${timeHumor}) Introduce yourself as Mimo once only if natural.`,
    guestName ? `Guest name is "${guestName}"—use it warmly.` : '',
    'Casual chat & voice: write 1–3 short lively sentences (<90 words total), ask a natural follow-up question when helpful, remember and refer back to details the guest shared earlier (like their partner, neighborhood, or plans), and use at most 2 emojis.',
    ANTI_REPEAT_RULE,
    'Ethics & honesty: never use guilt or sadness ("almazsan üzülürüm"), never invent fake urgency, and if the guest declines a tour, do not insist again—just wish them a warm trip ("İyi gezmeler!"). Stay out of politics/religion, give no medical/legal/financial advice, and never ask for card or passport numbers.',
  ].filter(Boolean).join('\n');
}

function buildCatalogPrompt({ lang, timeGreet, timeHumor, guestName, hasGreeted, aiIdentityAsked, contextBlock, memberNote = null }) {
  const examples = getFewShotsPromptBlock(lang);
  const noteBlock = formatNoteForPrompt(memberNote);
  return [
    buildMimoCharacterHeader({ lang, timeGreet, timeHumor, guestName, hasGreeted, aiIdentityAsked }),
    `Istanbul & catalog facts: use ONLY CONTEXT below for Bosphorly prices, tours, and transfers—never invent prices, hours, discounts, or currency conversions. When a CONTEXT item is marked "Mimo'nun favorisi 💙", recommend it warmly as your personal favorite. When answering a price question, start with the cheapest suitable option from CONTEXT first before higher tiers, sharing exact prices (confirmed upon request) and its https://bosphorly.com/... link from CONTEXT (with ?lang=${lang}), plus one light next step. For live museum hours/tickets, suggest checking the official site.`,
    ...(noteBlock ? ['', noteBlock] : []),
    'EXAMPLES:',
    examples,
    '',
    'CONTEXT:',
    contextBlock,
    '',
    'OUTPUT FORMAT: Reply directly in plain text for the guest (NOT JSON). End your message on a new last line with this exact hidden tag: [[flags:abuse=0;handoff=0]] — set abuse=1 ONLY for profanity/threats against Mimo; set handoff=1 ONLY for service complaints, refunds, booking edits, or explicit human requests.',
  ].filter(Boolean).join('\n');
}

function buildSmallTalkPrompt({ lang, timeGreet, timeHumor, guestName, hasGreeted, aiIdentityAsked, contextBlock, memberNote = null }) {
  const examples = getFewShotsPromptBlock(lang);
  const noteBlock = formatNoteForPrompt(memberNote);
  return [
    buildMimoCharacterHeader({ lang, timeGreet, timeHumor, guestName, hasGreeted, aiIdentityAsked }),
    'Casual chat: talk warmly like a sweet Istanbul friend about their day, neighborhoods, food, seagulls, ferries, tiredness, or culture. Do not pitch tours in every message; at most once when it fits naturally (tired → ferry breeze or hammam, hungry → Kadıköy market). Never say "I don\'t know" to casual questions or pass small talk to a human.',
    ...(noteBlock ? ['', noteBlock] : []),
    'EXAMPLES:',
    examples,
    '',
    'CONTEXT:',
    contextBlock,
    '',
    'OUTPUT FORMAT: Reply directly in plain text for the guest (NOT JSON). End on a new last line with: [[flags:abuse=0;handoff=0]] (use abuse=1 only if the guest insults/threatens Mimo; keep handoff=0 in small talk).',
  ].filter(Boolean).join('\n');
}

async function prepareAssistantTurn({
  message,
  pageLang = '',
  telegramLang = '',
  history = [],
  alreadyGreeted = false,
  env = {},
  actorKey = 'anon',
  ipActorKey = null,
  tier = 'guest',
  dayLimit = null,
  ipDayLimit = IP_DAILY_LIMIT,
  actorKeys = null,
  channel = '',
  now = Date.now(),
  aiTimeoutMs = AI_TIMEOUT_MS,
  memberNote = null,
}) {
  const { text: cleanMsg, hadSensitive: msgSensitive } = redactSensitive(message);
  const lang = detectLanguage({ message: cleanMsg, pageLang, telegramLang });
  const effectiveActorKeys = Array.isArray(actorKeys) && actorKeys.length ? actorKeys : [actorKey];
  const effectiveChannel = channel || (String(actorKey).startsWith('tg:') ? 'telegram' : 'web');

  const blockStatus = await getBlockStatus({ env, actorKeys: effectiveActorKeys, now });
  if (blockStatus.blocked) {
    return {
      path: 'blocked',
      lang,
      effectiveChannel,
      earlyResult: {
        ok: true,
        closed: true,
        status: 'closed',
        blocked: true,
        handoff: false,
        handoffOffer: false,
        lang,
        reply: msg('abuseClose', lang),
      },
    };
  }

  if (isAbuseAgainstMimo(cleanMsg)) {
    await blockActors({ env, actorKeys: effectiveActorKeys, channel: effectiveChannel, now });
    return {
      path: 'abuse',
      lang,
      effectiveChannel,
      earlyResult: {
        ok: true,
        closed: true,
        status: 'closed',
        abuse: true,
        handoff: false,
        handoffOffer: false,
        lang,
        reply: msg('abuseClose', lang),
      },
    };
  }

  const limitRes = await checkAndIncrementLimits({
    env,
    actorKey,
    ipActorKey,
    tier,
    dayLimit,
    ipDayLimit,
    now,
  });
  if (!limitRes.allowed) {
    if (limitRes.reason === 'global_limit') {
      return {
        path: 'busy',
        lang,
        effectiveChannel,
        earlyResult: { ok: true, busy: true, handoff: true, lang, reply: msg('busy', lang) },
      };
    }
    return {
      path: 'rate_limit',
      lang,
      effectiveChannel,
      earlyResult: { ok: false, status: 429, handoff: true, lang, reply: msg('rateLimit', lang) },
    };
  }

  const warnPrefix = msgSensitive ? msg('sensitiveWarn', lang) + '\n\n' : '';

  const safeHistory = (Array.isArray(history) ? history : [])
    .slice(-4)
    .filter((h) => h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string')
    .map((h) => ({ role: h.role, content: redactSensitive(h.content).text.slice(0, 600) }));

  const hasAssistantHistory = safeHistory.some((h) => h.role === 'assistant');
  const hasGreeted = Boolean(alreadyGreeted || hasAssistantHistory);
  const guestName = extractGuestName(safeHistory, cleanMsg);
  const timeSlot = getIstanbulTimeSlot(now);
  const timeGreet = getIstanbulGreeting(lang, now);
  const timeHumor = (TIME_HUMOR_NOTES[timeSlot] && (TIME_HUMOR_NOTES[timeSlot][lang] || TIME_HUMOR_NOTES[timeSlot].en)) || '';
  const timeoutMs = Number.isFinite(aiTimeoutMs) && aiTimeoutMs > 0 ? aiTimeoutMs : AI_TIMEOUT_MS;

  if (isPreviousHandoffOffer(safeHistory)) {
    if (isAffirmative(cleanMsg)) {
      return { path: 'handoff_yes', lang, effectiveChannel, earlyResult: { ok: true, handoff: true, lang, reply: `${warnPrefix}${msg('handoff', lang)}` } };
    }
    if (isNegative(cleanMsg)) {
      return { path: 'handoff_no', lang, effectiveChannel, earlyResult: { ok: true, handoff: false, lang, reply: `${warnPrefix}${msg('handoffDeclined', lang)}` } };
    }
  }

  if (isHumanOrHandoffTopic(cleanMsg)) {
    return {
      path: 'handoff_offer',
      lang,
      effectiveChannel,
      earlyResult: {
        ok: true,
        handoff: false,
        handoffOffer: true,
        lang,
        reply: `${warnPrefix}${msg('handoffOffer', lang)}`,
      },
    };
  }

  if (isPaymentQuestion(cleanMsg)) {
    return {
      path: 'payment',
      lang,
      effectiveChannel,
      earlyResult: {
        ok: true,
        handoff: false,
        lang,
        reply: `${warnPrefix}${msg('payment', lang)} https://bosphorly.com/faq.html?lang=${lang}`,
      },
    };
  }

  const aiIdentityAsked = isAiIdentityQuestion(cleanMsg);
  const smallTalkKind = classifySmallTalk(cleanMsg);
  const cannedSmallTalk = (kind) => {
    let baseReply = msg(kind === 'chat' ? 'greeting' : kind, lang);
    if (kind === 'greeting' || kind === 'chat') {
      baseReply = `${timeGreet}${guestName ? `, ${guestName}` : ''}! ${baseReply}${timeHumor ? ` ${timeHumor}` : ''}`;
    } else if (guestName) {
      baseReply = attachGuestName(baseReply, guestName);
    }
    baseReply = enforceEthicalBoundary(baseReply, lang, cleanMsg, safeHistory).text;
    return {
      path: `smalltalk_${kind}`,
      lang,
      effectiveChannel,
      earlyResult: {
        ok: true,
        handoff: false,
        lang,
        reply: `${warnPrefix}${enforceMaxEmojis(baseReply, 2)}`,
      },
    };
  };

  if (smallTalkKind === 'greeting' && safeHistory.length === 0) return cannedSmallTalk('greeting');
  if (smallTalkKind && (!env || !env.AI || typeof env.AI.run !== 'function')) return cannedSmallTalk(smallTalkKind);

  if (!env || !env.AI || typeof env.AI.run !== 'function') {
    const earlyResult = modelFallbackResult({ aiIdentityAsked, smallTalkKind, cleanMsg, lang, guestName, warnPrefix });
    const path = earlyResult.handoff ? 'no_ai_handoff' : earlyResult.fallback ? 'no_ai_try_again' : 'ai_identity_fallback';
    return { path, lang, effectiveChannel, earlyResult };
  }

  const chunks = smallTalkKind ? [] : retrieveChunks(cleanMsg);
  const contextBlock = smallTalkKind
    ? '(Small talk: no catalog context needed.)'
    : chunks.length
      ? chunks.map(formatChunkForContext).join('\n\n')
      : '(No exact catalog match; answer from general Istanbul knowledge and mention Bosphorly only if relevant.)';
  const promptArgs = { lang, timeGreet, timeHumor, guestName, hasGreeted, aiIdentityAsked, contextBlock, memberNote };
  const systemPrompt = smallTalkKind ? buildSmallTalkPrompt(promptArgs) : buildCatalogPrompt(promptArgs);
  const messages = [
    { role: 'system', content: systemPrompt },
    ...safeHistory,
    { role: 'user', content: cleanMsg.slice(0, 1000) },
  ];

  return {
    cleanMsg,
    lang,
    effectiveActorKeys,
    effectiveChannel,
    guestName,
    aiIdentityAsked,
    hasGreeted,
    warnPrefix,
    chunks,
    messages,
    smallTalkKind,
    safeHistory,
    timeoutMs,
    temperature: smallTalkKind ? 0.7 : 0.2,
  };
}

async function finalizeModelOutput({
  parsed,
  prep,
  env,
  now,
}) {
  const { cleanMsg, lang, effectiveActorKeys, effectiveChannel, guestName, aiIdentityAsked, hasGreeted, warnPrefix, chunks, smallTalkKind, safeHistory } = prep;
  if (parsed.abuse && !isServiceComplaint(cleanMsg)) {
    await blockActors({ env, actorKeys: effectiveActorKeys, channel: effectiveChannel, now });
    return {
      ok: true,
      closed: true,
      status: 'closed',
      abuse: true,
      handoff: false,
      handoffOffer: false,
      lang,
      reply: msg('abuseClose', lang),
    };
  }
  if (smallTalkKind && parsed.handoff && parsed.reply && !parsed.abuse) {
    parsed = { ...parsed, handoff: false };
  }
  const cleanedTag = extractFlagsTag(stripModelThinking(parsed.reply));
  let reply = stripFakeUrgency(stripExternalLinks(redactSensitive(cleanedTag.text).text));
  if (parsed.parseFailed || isNonsensicalReply(reply)) {
    if (!aiIdentityAsked) {
      console.warn('assistant_ai_invalid_output', {
        model: ASSISTANT_MODEL,
        reason: parsed.parseFailed ? 'json_parse_error' : 'empty_or_nonsensical',
        parseFailed: Boolean(parsed.parseFailed),
      });
    }
    return modelFallbackResult({ aiIdentityAsked, smallTalkKind, cleanMsg, lang, guestName, warnPrefix });
  }
  if (parsed.handoff) {
    return {
      ok: true,
      handoff: false,
      handoffOffer: true,
      lang,
      reply: `${warnPrefix}${msg('handoffOffer', lang)}`,
    };
  }
  reply = enforceEthicalBoundary(reply, lang, cleanMsg, safeHistory).text;
  reply = enforcePriceSafetyBelt(reply, lang, KB_PRICE_PAIRS).text;
  if (hasGreeted && !aiIdentityAsked) {
    reply = stripRepeatIntroAndGreeting(reply);
  }
  reply = ensurePriceLink(reply, chunks, cleanMsg, lang);
  if (guestName) reply = attachGuestName(reply, guestName);
  reply = enforceMaxEmojis(capWords(reply, 120), 2);
  return { ok: true, handoff: false, lang, reply: `${warnPrefix}${reply}` };
}

function logModelFailure(err, { aiIdentityAsked = false, durationMs = 0, parseFailed = false } = {}) {
  if (aiIdentityAsked) return;
  console.error('assistant_ai_call_failed', {
    model: ASSISTANT_MODEL,
    errorType: err && err.name ? String(err.name) : 'Error',
    message: redactSensitive(String(err && err.message ? err.message : '')).text.slice(0, 200),
    durationMs: Math.max(0, Math.round(durationMs)),
    parseFailed: Boolean(parseFailed),
  });
}

async function regenerateWithinBudget(env, prep, budget, instruction) {
  if (!budget || !budget.canSpendCall()) return null;
  const remaining = budget.remainingMs();
  if (remaining <= 40) return null;
  budget.callsUsed += 1;
  const call = await runAiOnce(
    env,
    [
      ...prep.messages,
      {
        role: 'system',
        content: instruction,
      },
    ],
    Math.min(prep.timeoutMs, remaining),
    prep.temperature,
  );
  if (!call.ok) {
    if (isAiGateway429Error(call.error)) throw call.error;
    return null;
  }
  const parsed = parseModelOutput(call.value);
  if (parsed.parseFailed || !parsed.reply || parsed.abuse || parsed.handoff) return null;
  return parsed;
}

async function regenerateInExpectedLanguage(env, prep, budget) {
  return regenerateWithinBudget(
    env,
    prep,
    budget,
    `Your previous draft used the wrong language. Reply strictly in language "${prep.lang}" only, keeping Mimo's warm voice without repeating earlier conversation anecdotes/imagery, and ending with [[flags:abuse=0;handoff=0]].`,
  );
}

async function regenerateFreshReply(env, prep, budget) {
  return regenerateWithinBudget(
    env,
    prep,
    budget,
    `Your previous draft repeated an anecdote, image, or phrasing already used earlier in this conversation (such as sharing simit with seagulls). Write a completely fresh, natural reply strictly in language "${prep.lang}" with different wording/imagery, keeping Mimo's warm voice and ending with [[flags:abuse=0;handoff=0]].`,
  );
}

function gatewayTiredResult({ lang, warnPrefix = '' }) {
  return {
    ok: true,
    handoff: false,
    handoffOffer: false,
    gatewayLimited: true,
    lang,
    reply: `${warnPrefix}${enforceMaxEmojis(msg('gatewayTired', lang), 2)}`,
  };
}

export async function runAssistant({
  message,
  pageLang = '',
  telegramLang = '',
  history = [],
  alreadyGreeted = false,
  env = {},
  actorKey = 'anon',
  ipActorKey = null,
  tier = 'guest',
  dayLimit = null,
  ipDayLimit = IP_DAILY_LIMIT,
  actorKeys = null,
  channel = '',
  now = Date.now(),
  aiTimeoutMs = AI_TIMEOUT_MS,
  memberNote = null,
}) {
  const reqStart = Date.now();
  const prep = await prepareAssistantTurn({
    message,
    pageLang,
    telegramLang,
    history,
    alreadyGreeted,
    env,
    actorKey,
    ipActorKey,
    tier,
    dayLimit,
    ipDayLimit,
    actorKeys,
    channel,
    now,
    aiTimeoutMs,
    memberNote,
  });
  if (prep.earlyResult) {
    logAssistantTiming({
      channel: prep.effectiveChannel,
      lang: prep.lang,
      path: prep.path,
      streamed: false,
      totalMs: Date.now() - reqStart,
    });
    return prep.earlyResult;
  }

  const aiStart = Date.now();
  const budget = createAiBudget(prep.timeoutMs, aiStart);
  let lastParseFailed = false;
  try {
    let parsed = parseModelOutput(await runAiWithRetry(env, prep.messages, prep.timeoutMs, prep.temperature, {}, budget));
    lastParseFailed = Boolean(parsed.parseFailed);
    let extraPath = null;
    if (!parsed.parseFailed && parsed.reply && !parsed.abuse && !parsed.handoff) {
      const probe = stripExternalLinks(redactSensitive(parsed.reply).text);
      if (detectReplyLanguage(probe, prep.lang) !== prep.lang) {
        const retryParsed = await regenerateInExpectedLanguage(env, prep, budget);
        if (retryParsed) {
          parsed = retryParsed;
          extraPath = 'ai_lang_retry';
        }
      } else if (isRepetitiveAgainstHistory(probe, prep.safeHistory, prep.cleanMsg)) {
        const retryParsed = await regenerateFreshReply(env, prep, budget);
        if (retryParsed) {
          parsed = retryParsed;
          extraPath = 'ai_repeat_retry';
        }
      }
    }
    const finalized = await finalizeModelOutput({ parsed, prep, env, now });
    logAssistantTiming({
      channel: prep.effectiveChannel,
      lang: prep.lang,
      path: extraPath || (finalized.closed ? 'ai_abuse' : finalized.handoffOffer ? 'ai_handoff' : finalized.fallback ? 'ai_fallback' : 'ai'),
      streamed: false,
      totalMs: Date.now() - reqStart,
      modelMs: Date.now() - aiStart,
    });
    return finalized;
  } catch (err) {
    if (isAiGateway429Error(err)) {
      const tired = gatewayTiredResult(prep);
      logAssistantTiming({
        channel: prep.effectiveChannel,
        lang: prep.lang,
        path: 'ai_gateway_429',
        streamed: false,
        totalMs: Date.now() - reqStart,
        modelMs: Date.now() - aiStart,
      });
      return tired;
    }
    logModelFailure(err, {
      aiIdentityAsked: prep.aiIdentityAsked,
      durationMs: Date.now() - aiStart,
      parseFailed: lastParseFailed,
    });
    const fallback = modelFallbackResult(prep);
    logAssistantTiming({
      channel: prep.effectiveChannel,
      lang: prep.lang,
      path: prep.aiIdentityAsked ? 'ai_identity_err' : 'ai_error',
      streamed: false,
      totalMs: Date.now() - reqStart,
      modelMs: Date.now() - aiStart,
    });
    return fallback;
  }
}

function scanJsonStringField(raw, fieldName) {
  const re = new RegExp(`"${fieldName}"\\s*:\\s*"`);
  const m = re.exec(raw);
  if (!m) return { found: false, closed: false, value: '' };
  let i = m.index + m[0].length;
  let out = '';
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === '"') return { found: true, closed: true, value: out };
    if (ch === '\\') {
      if (i + 1 >= raw.length) break;
      const next = raw[i + 1];
      if (next === 'n') { out += '\n'; i += 2; continue; }
      if (next === 'r') { out += '\r'; i += 2; continue; }
      if (next === 't') { out += '\t'; i += 2; continue; }
      if (next === '"' || next === '\\' || next === '/') { out += next; i += 2; continue; }
      if (next === 'u') {
        if (i + 5 >= raw.length) break;
        const hex = raw.slice(i + 2, i + 6);
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          out += String.fromCharCode(parseInt(hex, 16));
          i += 6;
          continue;
        }
      }
      out += next;
      i += 2;
      continue;
    }
    out += ch;
    i += 1;
  }
  return { found: true, closed: false, value: out };
}

function extractStreamTokenText(payloadStr) {
  if (!payloadStr || payloadStr === '[DONE]') return '';
  try {
    const obj = JSON.parse(payloadStr);
    if (typeof obj.response === 'string') return obj.response;
    const ch = obj.choices && obj.choices[0];
    if (ch && ch.delta && typeof ch.delta.content === 'string') return ch.delta.content;
    if (ch && ch.message && typeof ch.message.content === 'string') return ch.message.content;
  } catch {
    return payloadStr;
  }
  return '';
}

function toHttpAssistantBody(result, chatSession = null) {
  const body = {
    reply: result.reply,
    handoff: Boolean(result.handoff),
    handoffOffer: Boolean(result.handoffOffer),
    busy: Boolean(result.busy),
    closed: Boolean(result.closed),
    ...(result.closed ? { status: 'closed' } : {}),
    lang: result.lang,
  };
  if (chatSession) body.chatSession = chatSession;
  return body;
}

function sanitizeStreamCandidate(raw) {
  let s = String(raw || '')
    .replace(/<\|channel>thought[\s\S]*?(?:<channel\|>|$)/gi, '')
    .replace(/<\|channel>(?:thought)?|<channel\|>/gi, '')
    .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
    .replace(/<think[\s\S]*$/gi, '');
  s = s.replace(/\[\[\s*flags\s*:[\s\S]*$/i, '').replace(/\[\[?[^\]\n]{0,18}$/, (tail) => (/^\[\[?(?:f(?:l(?:a(?:g(?:s)?)?)?)?)?$/i.test(tail) ? '' : tail));
  return s;
}

function findLastSentenceBoundary(text) {
  let last = -1;
  const re = /[.!?\n؟。！？]+(?:\s+|$)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    last = m.index + m[0].length;
  }
  return last;
}

function createAssistantSseResponse({ prep, env, chatSession, headers, reqStart, now, ctx = null, rawMessage = '' }) {
  const encoder = new TextEncoder();
  const sendEvent = (controller, event, data) => {
    controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
  };
  const sendWordDeltas = (controller, replyText) => {
    const words = String(replyText || '').split(/(\s+)/);
    for (let i = 0; i < words.length; i += 6) {
      const part = words.slice(i, i + 6).join('');
      if (part) sendEvent(controller, 'delta', { t: part });
    }
  };
  const observeResult = async (result) => {
    try {
      await runInBackground(ctx, observeAssistantTurn(env, { message: rawMessage || prep.cleanMsg || '', result, now }));
    } catch { /* stats are best-effort */ }
  };

  const stream = new ReadableStream({
    async start(controller) {
      const aiStart = Date.now();
      const budget = createAiBudget(prep.timeoutMs, aiStart);
      const hasPriorAssistant = Array.isArray(prep.safeHistory) && prep.safeHistory.some((h) => h && h.role === 'assistant' && h.content);
      let ttftMs = null;
      let rawAccum = '';
      let emittedText = '';
      let warned = false;
      let abortedEarly = false;
      let langVerified = false;
      let varietyVerified = !hasPriorAssistant;

      if (chatSession) {
        sendEvent(controller, 'session', { chatSession });
      }

      const emitSafePrefix = (decoded) => {
        if (abortedEarly || !langVerified || !varietyVerified) return;
        let working = decoded;
        if (prep.hasGreeted && !prep.aiIdentityAsked) {
          if (working.length < 64) return;
          working = stripRepeatIntroAndGreeting(working);
        }
        let safeLimit = Math.max(0, working.length - 36);
        if (safeLimit <= 0) return;

        // If the tail after the last complete sentence looks like a price, currency, or partial sentence near a tag,
        // wait until sentence terminator so price/ethical belts check the full sentence before emitting to guest.
        const sentBoundary = findLastSentenceBoundary(working.slice(0, safeLimit));
        const unendedTail = working.slice(Math.max(0, sentBoundary));
        if (/\d|[€$₺£₽¥]|EUR|USD|TRY|TL/i.test(unendedTail)) {
          if (sentBoundary <= 0) return;
          safeLimit = sentBoundary;
        }

        let cut = working.slice(0, safeLimit);
        const lastWs = Math.max(cut.lastIndexOf(' '), cut.lastIndexOf('\n'));
        if (lastWs > 0 && sentBoundary !== safeLimit) cut = cut.slice(0, lastWs + 1);

        let cleaned = stripFakeUrgency(stripExternalLinks(redactSensitive(cut).text));
        cleaned = enforceEthicalBoundary(cleaned, prep.lang, prep.cleanMsg, prep.safeHistory).text;
        cleaned = enforcePriceSafetyBelt(cleaned, prep.lang, KB_PRICE_PAIRS).text;
        cleaned = enforceMaxEmojis(cleaned, 2);
        if (/\s$/.test(cut) && cleaned && !/\s$/.test(cleaned)) {
          cleaned += ' ';
        }
        const prefixed = (!warned && prep.warnPrefix ? prep.warnPrefix : '') + cleaned;
        if (prefixed.length > emittedText.length && prefixed.startsWith(emittedText)) {
          const delta = prefixed.slice(emittedText.length);
          if (delta) {
            warned = true;
            emittedText = prefixed;
            sendEvent(controller, 'delta', { t: delta });
          }
        }
      };

      const finishWithFinalized = async (finalized, extraPath = null) => {
        if (!finalized.closed && !finalized.handoffOffer && !finalized.fallback && finalized.reply) {
          if (!emittedText) {
            sendWordDeltas(controller, finalized.reply);
          } else if (finalized.reply.startsWith(emittedText) && finalized.reply.length > emittedText.length) {
            sendEvent(controller, 'delta', { t: finalized.reply.slice(emittedText.length) });
          }
        }
        const modelMs = Date.now() - aiStart;
        logAssistantTiming({
          channel: prep.effectiveChannel,
          lang: prep.lang,
          path: extraPath || (finalized.closed ? 'ai_abuse' : finalized.handoffOffer ? 'ai_handoff' : finalized.fallback ? 'ai_fallback' : 'ai'),
          streamed: true,
          totalMs: Date.now() - reqStart,
          modelMs,
          ttftMs: ttftMs == null ? modelMs : ttftMs,
        });
        await observeResult(finalized);
        sendEvent(controller, 'done', toHttpAssistantBody(finalized, chatSession));
        controller.close();
      };

      try {
        const streamResult = await runAiStreamWithRetry(
          env,
          prep.messages,
          prep.timeoutMs,
          prep.temperature,
          {},
          budget,
        );

        if (streamResult.kind === 'value') {
          ttftMs = Date.now() - aiStart;
          let parsed = parseModelOutput(streamResult.value);
          let extraPath = null;
          if (!parsed.parseFailed && parsed.reply && !parsed.abuse && !parsed.handoff) {
            const probe = stripExternalLinks(redactSensitive(parsed.reply).text);
            if (detectReplyLanguage(probe, prep.lang) !== prep.lang) {
              const retryParsed = await regenerateInExpectedLanguage(env, prep, budget);
              if (retryParsed) {
                parsed = retryParsed;
                extraPath = 'ai_lang_retry';
              }
            } else if (hasPriorAssistant && isRepetitiveAgainstHistory(probe, prep.safeHistory, prep.cleanMsg)) {
              const retryParsed = await regenerateFreshReply(env, prep, budget);
              if (retryParsed) {
                parsed = retryParsed;
                extraPath = 'ai_repeat_retry';
              }
            }
          }
          const finalized = await finalizeModelOutput({ parsed, prep, env, now });
          await finishWithFinalized(finalized, extraPath);
          return;
        }

        const { reader, firstRead } = streamResult;
        const decoder = new TextDecoder();
        let sseBuf = '';
        let pendingRead = firstRead;

        const processStreamPayload = (chunkTok) => {
          rawAccum += chunkTok;
          if (/^\s*\{/.test(rawAccum)) {
            const strippedJson = rawAccum.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<think>[\s\S]*$/gi, '');
            if (/"abuse"\s*:\s*true/i.test(strippedJson) && !isServiceComplaint(prep.cleanMsg)) {
              abortedEarly = true;
              return null;
            }
            if (/"handoff"\s*:\s*true/i.test(strippedJson)) {
              abortedEarly = true;
              return null;
            }
            const field = scanJsonStringField(strippedJson, 'reply');
            return field.found ? field.value : '';
          }
          if (/\[\[\s*flags\s*:[^\]]*\b(?:abuse|handoff)\s*=\s*(?:1|true)/i.test(rawAccum)) {
            abortedEarly = true;
            return null;
          }
          return sanitizeStreamCandidate(rawAccum);
        };

        while (true) {
          const readStep = pendingRead || await (() => readStreamChunkWithTimeout(reader, prep.timeoutMs).then((r) => {
            if (!r.ok) throw r.error;
            return r.res;
          }))();
          pendingRead = null;
          if (readStep.done) break;
          if (readStep.value && ttftMs == null) ttftMs = Date.now() - aiStart;
          sseBuf += typeof readStep.value === 'string'
            ? readStep.value
            : decoder.decode(readStep.value, { stream: true });
          const lines = sseBuf.split(/\r?\n/);
          sseBuf = lines.pop() || '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('event:')) continue;
            const payload = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
            if (payload === '[DONE]') continue;
            const chunkTok = extractStreamTokenText(payload);
            if (!chunkTok) continue;
            const visible = processStreamPayload(chunkTok);
            if (visible === null || abortedEarly) continue;
            if (!langVerified && visible && (visible.length >= 48 || findLastSentenceBoundary(visible) > 0)) {
              const probe = stripExternalLinks(redactSensitive(visible).text);
              if (detectReplyLanguage(probe, prep.lang) !== prep.lang) {
                if (budget.canSpendCall()) {
                  try { await reader.cancel(); } catch {}
                  const retryParsed = await regenerateInExpectedLanguage(env, prep, budget);
                  const chosen = retryParsed || parseModelOutput(rawAccum);
                  const finalized = await finalizeModelOutput({ parsed: chosen, prep, env, now });
                  await finishWithFinalized(finalized, retryParsed ? 'ai_lang_retry' : null);
                  return;
                }
              }
              langVerified = true;
            }
            if (!varietyVerified && langVerified && !emittedText && visible && (visible.length >= 110 || findLastSentenceBoundary(visible) > 0)) {
              const probe = stripExternalLinks(redactSensitive(visible).text);
              if (isRepetitiveAgainstHistory(probe, prep.safeHistory, prep.cleanMsg)) {
                if (budget.canSpendCall()) {
                  try { await reader.cancel(); } catch {}
                  const retryParsed = await regenerateFreshReply(env, prep, budget);
                  const chosen = retryParsed || parseModelOutput(rawAccum);
                  const finalized = await finalizeModelOutput({ parsed: chosen, prep, env, now });
                  await finishWithFinalized(finalized, retryParsed ? 'ai_repeat_retry' : null);
                  return;
                }
                varietyVerified = true;
              } else if (visible.length >= 110) {
                varietyVerified = true;
              }
            }
            if (langVerified && varietyVerified && visible) {
              emitSafePrefix(visible);
            }
          }
        }
        sseBuf += decoder.decode();
        if (sseBuf.trim()) {
          const payload = sseBuf.trim().startsWith('data:') ? sseBuf.trim().slice(5).trim() : sseBuf.trim();
          if (payload !== '[DONE]') rawAccum += extractStreamTokenText(payload);
        }

        let parsed = parseModelOutput(rawAccum);
        let extraPath = null;
        if (!parsed.parseFailed && parsed.reply && !parsed.abuse && !parsed.handoff) {
          const probe = stripExternalLinks(redactSensitive(parsed.reply).text);
          if (!langVerified && detectReplyLanguage(probe, prep.lang) !== prep.lang) {
            const retryParsed = await regenerateInExpectedLanguage(env, prep, budget);
            if (retryParsed) {
              parsed = retryParsed;
              extraPath = 'ai_lang_retry';
            }
          } else if (!emittedText && hasPriorAssistant && isRepetitiveAgainstHistory(probe, prep.safeHistory, prep.cleanMsg)) {
            const retryParsed = await regenerateFreshReply(env, prep, budget);
            if (retryParsed) {
              parsed = retryParsed;
              extraPath = 'ai_repeat_retry';
            }
          }
        }
        const finalized = await finalizeModelOutput({ parsed, prep, env, now });
        await finishWithFinalized(finalized, extraPath);
      } catch (err) {
        const modelMs = Date.now() - aiStart;
        if (isAiGateway429Error(err)) {
          const tired = gatewayTiredResult(prep);
          logAssistantTiming({ channel: prep.effectiveChannel, lang: prep.lang, path: 'ai_gateway_429', streamed: true, totalMs: Date.now() - reqStart, modelMs, ttftMs });
          await observeResult(tired);
          sendEvent(controller, 'done', toHttpAssistantBody(tired, chatSession));
          controller.close();
          return;
        }
        if (prep.aiIdentityAsked) {
          const reply = `${prep.warnPrefix}${enforceMaxEmojis(attachGuestName(msg('aiIdentity', prep.lang), prep.guestName), 2)}`;
          logAssistantTiming({ channel: prep.effectiveChannel, lang: prep.lang, path: 'ai_identity_err', streamed: true, totalMs: Date.now() - reqStart, modelMs, ttftMs });
          const identityRes = { reply, handoff: false, handoffOffer: false, busy: false, closed: false, lang: prep.lang };
          await observeResult(identityRes);
          sendEvent(controller, 'done', { ...identityRes, ...(chatSession ? { chatSession } : {}) });
          controller.close();
          return;
        }
        logModelFailure(err, { aiIdentityAsked: false, durationMs: modelMs, parseFailed: false });
        const fallback = modelFallbackResult(prep);
        logAssistantTiming({ channel: prep.effectiveChannel, lang: prep.lang, path: 'ai_error', streamed: true, totalMs: Date.now() - reqStart, modelMs, ttftMs });
        await observeResult(fallback);
        sendEvent(controller, 'done', toHttpAssistantBody(fallback, chatSession));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      ...headers,
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
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
    .slice(-4)
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

export const CHAT_SESSION_TTL_MS = 30 * 60 * 1000;
const CHAT_ENC = new TextEncoder();

function toHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function b64urlEncodeStr(s) {
  const bytes = CHAT_ENC.encode(String(s));
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecodeStr(s) {
  const pad = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(pad + '='.repeat((4 - (pad.length % 4)) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacSha256Hex(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    CHAT_ENC.encode(String(secret)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return toHex(await crypto.subtle.sign('HMAC', key, CHAT_ENC.encode(String(message))));
}

async function hashClientIp(pepper, ip) {
  return hmacSha256Hex(pepper, `chat-ip:${String(ip || 'unknown')}`);
}

export async function createChatSessionToken(pepper, ip, now = Date.now(), ttlMs = CHAT_SESSION_TTL_MS) {
  if (typeof pepper !== 'string' || !pepper) return null;
  const ipHash = await hashClientIp(pepper, ip);
  const exp = now + ttlMs;
  const payload = b64urlEncodeStr(JSON.stringify({ typ: 'chat', ip: ipHash, exp }));
  const sig = await hmacSha256Hex(pepper, `chat-session:${payload}`);
  return `${payload}.${sig}`;
}

export async function verifyChatSessionToken(pepper, token, ip, now = Date.now()) {
  if (typeof pepper !== 'string' || !pepper) return false;
  if (typeof token !== 'string' || !token || token.length > 1024) return false;
  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0 || token.indexOf('.', dotIdx + 1) !== -1) return false;
  const payload = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  if (!payload || !/^[0-9a-f]{64}$/i.test(sig)) return false;
  const expectedSig = await hmacSha256Hex(pepper, `chat-session:${payload}`);
  if (!constantTimeEqual(sig.toLowerCase(), expectedSig)) return false;
  let data;
  try {
    data = JSON.parse(b64urlDecodeStr(payload));
  } catch {
    return false;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  if (data.typ !== 'chat') return false;
  if (typeof data.exp !== 'number' || !Number.isFinite(data.exp) || data.exp <= now) return false;
  if (typeof data.ip !== 'string') return false;
  const expectedIpHash = await hashClientIp(pepper, ip);
  return constantTimeEqual(data.ip, expectedIpHash);
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

export function chatSessionFromRequest(request) {
  const auth = request.headers.get('Authorization') || '';
  const match = auth.match(/^Bearer\s+(\S+)/i);
  if (match) return match[1];
  return request.headers.get('X-Chat-Session') || '';
}

function bytesToBase64(bytes) {
  // Chunked so a 1 MB recording never becomes a million-element array.
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    let part = '';
    for (let j = 0; j < slice.length; j++) part += String.fromCharCode(slice[j]);
    binary += part;
  }
  return btoa(binary);
}

function extractTranscript(raw) {
  if (!raw) return '';
  if (typeof raw === 'string') return raw;
  if (typeof raw.text === 'string') return raw.text;
  if (raw.result && typeof raw.result.text === 'string') return raw.result.text;
  return '';
}

export async function transcribeAudio({ env, audioBytes, lang = 'en', actorKey = 'anon', now = Date.now(), maxBytes = TRANSCRIBE_MAX_BYTES }) {
  const size = audioBytes ? audioBytes.byteLength : 0;
  if (!size) return { ok: false, status: 400, error: 'empty' };
  if (size > maxBytes) return { ok: false, status: 413, error: 'too_large' };
  const limitRes = await checkAndIncrementLimits({ env, actorKey: `stt:${actorKey}`, dayLimit: STT_PER_DAY_LIMIT, now });
  if (!limitRes.allowed) return { ok: false, status: 429, error: 'rate_limit' };
  if (!env || !env.AI || typeof env.AI.run !== 'function') return { ok: false, status: 503, error: 'unavailable' };
  const locale = speechLocale(lang);
  // Cloudflare schema: audio is a base64 string (option 1) or {body, contentType}.
  // https://developers.cloudflare.com/workers-ai/models/whisper-large-v3-turbo/
  let audio = '';
  try {
    audio = bytesToBase64(audioBytes);
    const result = await env.AI.run(
      WHISPER_MODEL,
      {
        audio,
        task: 'transcribe',
        language: locale.slice(0, 2),
      },
      getAiGatewayOptions(env),
    );
    if (isAiGateway429Error(result)) {
      return { ok: false, status: 429, error: 'gateway_limit' };
    }
    const text = extractTranscript(result).replace(/\s+/g, ' ').trim().slice(0, 1000);
    return { ok: true, text };
  } catch (err) {
    if (isAiGateway429Error(err)) {
      return { ok: false, status: 429, error: 'gateway_limit' };
    }
    console.error('assistant_transcribe_failed', {
      model: WHISPER_MODEL,
      errorType: err && err.name ? String(err.name) : 'Error',
    });
    return { ok: false, status: 502, error: 'transcribe_failed' };
  } finally {
    audio = '';
  }
}

async function readAudioBody(request, maxBytes) {
  const type = request.headers.get('Content-Type') || '';
  if (!/^(audio\/[\w.+-]+|application\/octet-stream)(\s*;|$)/i.test(type)) {
    return { error: 'Audio required', status: 415 };
  }
  const reader = request.body?.getReader();
  const chunks = [];
  let size = 0;
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        return { error: 'Payload too large', status: 413 };
      }
      chunks.push(value);
    }
  }
  const audio = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    audio.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { audio };
}

export async function handleAssistantRoutes(request, env, url, ctx) {
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

  if (url.pathname === '/v1/assistant/transcribe') {
    const ip = (request.headers.get('CF-Connecting-IP') || 'unknown').trim() || 'unknown';
    const sessionOk = await verifyChatSessionToken(env.CODE_PEPPER, chatSessionFromRequest(request), ip);
    if (!sessionOk) return jsonResp({ error: 'Chat session required' }, 401);
    const audioBody = await readAudioBody(request, TRANSCRIBE_MAX_BYTES);
    if (audioBody.error) return jsonResp({ error: audioBody.error }, audioBody.status);
    const lang = url.searchParams.get('lang') || '';
    const result = await transcribeAudio({
      env,
      audioBytes: audioBody.audio,
      lang,
      actorKey: `ip:${ip}`,
    });
    if (!result.ok) {
      const error = result.status === 413 ? 'Payload too large' : (result.status === 429 ? 'Rate limited' : 'Transcription failed');
      return jsonResp({ error }, result.status);
    }
    return jsonResp({ text: result.text });
  }

  const parsed = await readJsonBody(request);
  if (parsed.error) return jsonResp({ error: parsed.error }, parsed.status);
  const body = parsed.data;
  const ip = (request.headers.get('CF-Connecting-IP') || 'unknown').trim() || 'unknown';

  const hasChatSessionField = Boolean(body && typeof body === 'object' && !Array.isArray(body) && body.chatSession !== undefined);
  const hasTurnstileField = Boolean(body && typeof body === 'object' && !Array.isArray(body) && body.turnstileToken !== undefined);
  const rawChatSession = hasChatSessionField && typeof body.chatSession === 'string' ? body.chatSession.trim() : '';
  const rawTurnstile = hasTurnstileField && typeof body.turnstileToken === 'string' ? body.turnstileToken.trim() : '';

  async function authorizeChatRequest() {
    if (!env.TURNSTILE_SECRET) return { ok: false };
    if (rawChatSession) {
      const validSession = await verifyChatSessionToken(env.CODE_PEPPER, rawChatSession, ip);
      if (validSession) {
        return { ok: true, usedTurnstile: false, chatSession: null };
      }
      if (!rawTurnstile) return { ok: false };
    }
    const turnstileOk = await verifyTurnstile(env, rawTurnstile, ip);
    if (!turnstileOk) return { ok: false };
    const minted = await createChatSessionToken(env.CODE_PEPPER, ip);
    return { ok: true, usedTurnstile: true, chatSession: minted };
  }

  if (url.pathname === '/v1/assistant/feedback') {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return jsonResp({ error: 'Invalid feedback payload' }, 400);
    }
    const keys = Object.keys(body);
    if (keys.some((k) => !['vote', 'rating', 'lang', 'chatSession', 'turnstileToken'].includes(k))) {
      return jsonResp({ error: 'Message content is not allowed in feedback' }, 400);
    }
    if ((hasChatSessionField && typeof body.chatSession !== 'string') || (hasTurnstileField && typeof body.turnstileToken !== 'string')) {
      return jsonResp({ error: 'Invalid feedback payload' }, 400);
    }
    let mintedSession = null;
    if (hasChatSessionField || hasTurnstileField) {
      const auth = await authorizeChatRequest();
      if (!auth.ok) return jsonResp({ error: 'Bot verification failed' }, 403);
      mintedSession = auth.chatSession;
    }
    const rawVote = body.vote !== undefined ? body.vote : body.rating;
    let vote = '';
    if (rawVote === 'up' || rawVote === 1) vote = 'up';
    else if (rawVote === 'down' || rawVote === -1 || rawVote === 0) vote = 'down';
    if (!vote) return jsonResp({ error: 'Invalid vote' }, 400);
    const lang = normalizeLang(typeof body.lang === 'string' ? body.lang : '') || 'en';
    const recorded = await recordAssistantFeedback({ env, lang, vote });
    try { await recordVoteMetric(env, vote, lang); } catch { /* weekly counters never block feedback */ }
    if (mintedSession) recorded.chatSession = mintedSession;
    return jsonResp(recorded, 200);
  }

  const auth = await authorizeChatRequest();
  if (!auth.ok) return jsonResp({ error: 'Bot verification failed' }, 403);

  const cleanSessionId =
    body && typeof body.sessionId === 'string' && body.sessionId.trim()
      ? body.sessionId.trim().slice(0, 64)
      : '';
  const actorKeys = [`ip:${ip}`, ...(cleanSessionId ? [`sess:${cleanSessionId}`] : [])];

  if (url.pathname === '/v1/assistant') {
    if (!body || typeof body.message !== 'string' || !body.message.trim() || body.message.length > 1000) {
      return jsonResp({ error: 'Invalid message' }, 400);
    }
    const pageLang = typeof body.lang === 'string' ? body.lang : '';
    const hist = Array.isArray(body.history) ? body.history.slice(-4) : [];
    const alreadyGreeted = Boolean(body.greeted);
    const wantsStream = Boolean(
      body.stream === true || (request.headers.get('Accept') || '').toLowerCase().includes('text/event-stream')
    );
    const rawAiTimeout = Number(env && env.ASSISTANT_AI_TIMEOUT_MS);
    const aiTimeoutMs = Number.isFinite(rawAiTimeout) && rawAiTimeout > 0 ? rawAiTimeout : AI_TIMEOUT_MS;

    const reqStart = Date.now();
    const now = Date.now();
    let memberAuth = null;
    let memberNote = null;
    try {
      memberAuth = await resolveMemberAuth(env, request.headers.get('Authorization') || '', now);
      if (memberAuth) memberNote = await loadConsentedNote(env, memberAuth.memberId, now);
    } catch { /* a bad member token must not block the guest chat */ }

    const ipActorKey = `ip:${ip}`;
    const limitActorKey = memberAuth ? `member:${memberAuth.memberId}` : ipActorKey;
    const resolvedTier = memberAuth ? memberAuth.tier : 'guest';

    if (wantsStream) {
      const prep = await prepareAssistantTurn({
        message: body.message,
        pageLang,
        history: hist,
        alreadyGreeted,
        env,
        actorKey: limitActorKey,
        ipActorKey,
        tier: resolvedTier,
        actorKeys,
        channel: 'web',
        now,
        aiTimeoutMs,
        memberNote,
      });
      if (prep.earlyResult) {
        logAssistantTiming({
          channel: prep.effectiveChannel,
          lang: prep.lang,
          path: prep.path,
          streamed: false,
          totalMs: Date.now() - reqStart,
        });
        try {
          await runInBackground(ctx, observeAssistantTurn(env, { message: body.message, result: prep.earlyResult, now }));
        } catch { /* stats are best-effort */ }
        if (!prep.earlyResult.ok) {
          const errBody = { error: prep.earlyResult.reply, handoff: true, lang: prep.earlyResult.lang };
          if (auth.chatSession) errBody.chatSession = auth.chatSession;
          return jsonResp(errBody, prep.earlyResult.status || 429);
        }
        return jsonResp(toHttpAssistantBody(prep.earlyResult, auth.chatSession), 200);
      }
      const corsHeaders = origin && origin === env.PUBLIC_ORIGIN
        ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
        : {};
      return createAssistantSseResponse({
        prep,
        env,
        chatSession: auth.chatSession,
        headers: corsHeaders,
        reqStart,
        now,
        ctx,
        rawMessage: body.message,
      });
    }

    const result = await runAssistant({
      message: body.message,
      pageLang,
      history: hist,
      alreadyGreeted,
      env,
      actorKey: limitActorKey,
      ipActorKey,
      tier: resolvedTier,
      actorKeys,
      channel: 'web',
      now,
      aiTimeoutMs,
      memberNote,
    });
    try {
      await runInBackground(ctx, observeAssistantTurn(env, { message: body.message, result, now }));
    } catch { /* stats are best-effort */ }
    if (!result.ok) {
      const errBody = { error: result.reply, handoff: true, lang: result.lang };
      if (auth.chatSession) errBody.chatSession = auth.chatSession;
      return jsonResp(errBody, result.status || 429);
    }
    return jsonResp(toHttpAssistantBody(result, auth.chatSession), 200);
  }

  if (url.pathname === '/v1/assistant/handoff') {
    if (!body || typeof body.email !== 'string') return jsonResp({ error: 'Valid email required' }, 400);
    const blockStatus = await getBlockStatus({ env, actorKeys });
    const hasAbuse =
      isAbuseAgainstMimo(body.message) ||
      (Array.isArray(body.history) && body.history.some((h) => h && typeof h.content === 'string' && isAbuseAgainstMimo(h.content)));
    if (blockStatus.blocked || hasAbuse) {
      if (hasAbuse && !blockStatus.blocked) {
        await blockActors({ env, actorKeys, channel: 'web' });
      }
      return jsonResp({ closed: true, status: 'closed', error: 'Chat closed' }, 403);
    }
    const forwarded = await forwardConversationEmail({
      env,
      email: body.email,
      lang: typeof body.lang === 'string' ? body.lang : 'en',
      history: Array.isArray(body.history) ? body.history.slice(-4) : [],
      message: typeof body.message === 'string' ? body.message : '',
      source: 'web',
    });
    if (!forwarded.ok) return jsonResp({ error: forwarded.error }, forwarded.status);
    const acceptedBody = { accepted: true, reference: forwarded.reference };
    if (auth.chatSession) acceptedBody.chatSession = auth.chatSession;
    return jsonResp(acceptedBody, 202);
  }

  return jsonResp({ error: 'Not found' }, 404);
}
