import knowledge from './knowledge.json' with { type: 'json' };

export const ASSISTANT_MODEL = '@cf/zai-org/glm-4.7-flash';
export const SUPPORTED_LANGS = new Set([
  'ar', 'az', 'bn', 'bs', 'de', 'en', 'es', 'fa', 'fr', 'he', 'hi', 'hr',
  'hu', 'id', 'it', 'ja', 'ko', 'nl', 'pt', 'ru', 'tr', 'uk', 'zh'
]);

const PER_MIN_LIMIT = 6;
const PER_DAY_LIMIT = 40;
const DEFAULT_GLOBAL_DAILY_LIMIT = 200;
const AI_TIMEOUT_MS = 15000;

const memoryLimits = new Map();
const memoryFeedback = new Map();

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
    ru: 'Здравствуйте! Я Mimo — ИИ-ассистент Bosphorly по Стамбулу 🌊 Помогу с трансферами из аэропорта, круизами по Босфору, хаммамом, турами и советами по городу. Когда вы приезжаете в Стамбул?',
    uk: 'Вітаю! Я Mimo — ШІ-асистент Bosphorly у Стамбулі 🌊 Допоможу з трансферами з аеропорту, круїзами Босфором, хамамом, турами та порадами щодо міста. Коли ви плануєте приїхати до Стамбула?',
    de: 'Hallo! Ich bin Mimo, der KI-Assistent von Bosphorly für Istanbul 🌊 Ich helfe gern bei Flughafentransfers, Bosporus-Fahrten, Hamam, Stadttouren und Istanbul-Tipps. Wann reisen Sie nach Istanbul?',
    fr: 'Bonjour ! Je suis Mimo, l’assistant IA de Bosphorly à Istanbul 🌊 Je peux vous aider pour les transferts aéroport, croisières sur le Bosphore, hammams, visites et conseils locaux. Quand venez-vous à Istanbul ?',
    nl: 'Hallo! Ik ben Mimo, de AI-assistent van Bosphorly voor Istanbul 🌊 Ik help je graag met luchthaventransfers, Bosporuscruises, hamam, stadstours en tips voor Istanbul. Wanneer kom je naar Istanbul?',
    ar: 'مرحبًا! أنا Mimo، مساعد الذكاء الاصطناعي من Bosphorly في إسطنبول 🌊 يمكنني مساعدتك في النقل من المطار، رحلات البوسفور، الحمّام التركي، جولات المدينة ونصائح السفر. متى ستزور إسطنبول؟',
    he: 'שלום! אני Mimo, עוזר הבינה המלאכותית של Bosphorly באיסטנבול 🌊 אשמח לעזור עם הסעות משדה התעופה, שייט בבוספורוס, חמאם, סיורים וטיפים מקומיים. מתי אתם מגיעים לאיסטנבול?',
    az: 'Salam! Mən Bosphorly-nin süni intellekt köməkçisi Mimo 🌊 Hava limanı transferləri, Boğaz turları, hamam, şəhər gəzintiləri və İstanbul tövsiyələri ilə kömək edə bilərəm. İstanbula nə vaxt gəlirsiniz?',
    fa: 'سلام! من Mimo، دستیار هوش مصنوعی Bosphorly در استانبول هستم 🌊 می‌توانم درباره ترانسفر فرودگاه، کروز بسفر، حمام ترکی، تورهای شهری و راهنمای استانبول کمکتان کنم. چه زمانی به استانبول می‌آیید؟',
    es: '¡Hola! Soy Mimo, el asistente de IA de Bosphorly en Estambul 🌊 Puedo ayudarte con traslados al aeropuerto, cruceros por el Bósforo, hammam, tours y consejos locales. ¿Cuándo viajas a Estambul?',
    it: 'Ciao! Sono Mimo, l’assistente IA di Bosphorly a Istanbul 🌊 Posso aiutarti con transfer aeroportuali, crociere sul Bosforo, hammam, tour e consigli su Istanbul. Quando arrivi a Istanbul?',
    pt: 'Olá! Sou Mimo, o assistente de IA da Bosphorly em Istambul 🌊 Posso ajudar com traslados do aeroporto, cruzeiros pelo Bósforo, hammam, passeios e dicas locais. Quando você vem a Istambul?',
    hr: 'Pozdrav! Ja sam Mimo, Bosphorlyjev AI asistent za Istanbul 🌊 Mogu vam pomoći oko transfera, krstarenja Bosporom, hamama, gradskih tura i lokalnih savjeta. Kada dolazite u Istanbul?',
    hu: 'Szia! Mimo vagyok, a Bosphorly mesterséges intelligencia asszisztense Isztambulban 🌊 Segítek reptéri transzferekben, boszporuszi hajóutakban, hamamban, túrákban és helyi tippekben. Mikor érkezel Isztambulba?',
    bs: 'Zdravo! Ja sam Mimo, Bosphorlyjev AI asistent za Istanbul 🌊 Mogu vam pomoći oko transfera, krstarenja Bosporom, hamama, gradskih tura i lokalnih savjeta. Kada dolazite u Istanbul?',
    zh: '您好！我是 Bosphorly 的人工智能助手 Mimo 🌊 我可以为您介绍机场接送、博斯普鲁斯游船、土耳其浴、城市观光以及伊斯坦布尔实用贴士。请问您计划什么时候来伊斯坦布尔？',
    ja: 'こんにちは！BosphorlyのAIアシスタント、Mimoです 🌊 空港送迎、ボスポラスクルーズ、ハマム、市内ツアーやイスタンブール観光のコツをご案内します。いつ頃お越しですか？',
    ko: '안녕하세요! Bosphorly의 AI 도우미 Mimo예요 🌊 공항 픽업, 보스포루스 크루즈, 하맘, 시티 투어와 이스탄불 여행 팁을 도와드릴게요. 이스탄불에는 언제 오시나요?',
    hi: 'नमस्ते! मैं Mimo हूँ, Bosphorly का AI सहायक 🌊 मैं एयरपोर्ट ट्रांसफ़र, बोस्फोरस क्रूज़, हम्माम, सिटी टूर और इस्तांबुल यात्रा सुझावों में मदद कर सकता हूँ। आप इस्तांबुल कब आ रहे हैं?',
    bn: 'হ্যালো! আমি Mimo, Bosphorly-এর এআই সহায়ক 🌊 এয়ারপোর্ট ট্রান্সফার, বসফরাস ক্রুজ, হামাম, সিটি ট্যুর এবং ইস্তাম্বুল ভ্রমণ টিপস দিয়ে সাহায্য করতে পারি। আপনি কবে ইস্তাম্বুলে আসছেন?',
    id: 'Halo! Saya Mimo, asisten AI Bosphorly untuk Istanbul 🌊 Saya siap membantu info transfer bandara, pelayaran Bosphorus, hamam, tur kota, dan tips lokal. Kapan Anda berkunjung ke Istanbul?',
  },
  aiIdentity: {
    tr: 'Hayır, insan değilim — ben Bosphorly’nin yapay zekâ asistanı Mimo 🌊 İstanbul transferleri, Boğaz turları, hamam ve gezi önerilerinde sana yardımcı olmak için buradayım!',
    en: 'No, I am not human—I am Mimo, Bosphorly’s AI assistant 🌊 I am here to help you with Istanbul airport transfers, Bosphorus cruises, hammam, and travel tips!',
    ru: 'Нет, я не человек — я Mimo, ИИ-ассистент Bosphorly 🌊 Я здесь, чтобы помочь вам с трансферами, круизами по Босфору, хаммамом и прогулками по Стамбулу!',
    uk: 'Ні, я не людина — я Mimo, ШІ-асистент Bosphorly 🌊 Я тут, щоб допомогти вам із трансферами, круїзами Босфором, хамамом і порадами щодо Стамбула!',
    de: 'Nein, ich bin kein Mensch — ich bin Mimo, der KI-Assistent von Bosphorly 🌊 Ich helfe Ihnen gern bei Flughafentransfers, Bosporus-Fahrten, Hamam und Istanbul-Tipps!',
    fr: 'Non, je ne suis pas humain — je suis Mimo, l’assistant IA de Bosphorly 🌊 Je suis là pour vous aider avec vos transferts, croisières, hammams et conseils à Istanbul !',
    nl: 'Nee, ik ben geen mens — ik ben Mimo, de AI-assistent van Bosphorly 🌊 Ik help je graag met luchthaventransfers, Bosporuscruises, hamam en tips voor Istanbul!',
    ar: 'لا، لست إنسانًا — أنا Mimo، مساعد الذكاء الاصطناعي من Bosphorly 🌊 أنا هنا لمساعدتك في النقل من المطار، رحلات البوسفور، الحمّام ونصائح إسطنبول!',
    he: 'לא, איני אדם — אני Mimo, עוזר הבינה המלאכותית של Bosphorly 🌊 אני כאן כדי לעזור לכם עם הסעות, שייט בבוספורוס, חמאם וטיפים לאיסטנבול!',
    az: 'Xeyr, insan deyiləm — mən Bosphorly-nin süni intellekt köməkçisi Mimo-yam 🌊 İstanbul transferləri, Boğaz turları, hamam və gəzinti məsləhətləri üçün buradayam!',
    fa: 'نه، من انسان نیستم — من Mimo، دستیار هوش مصنوعی Bosphorly هستم 🌊 اینجا هستم تا در ترانسفر فرودگاه، کروز بسفر، حمام و راهنمای استانبول کمکتان کنم!',
    es: 'No, no soy humano: soy Mimo, el asistente de IA de Bosphorly 🌊 ¡Estoy aquí para ayudarte con traslados, cruceros por el Bósforo, hammam y consejos sobre Estambul!',
    it: 'No, non sono umano: sono Mimo, l’assistente IA di Bosphorly 🌊 Sono qui per aiutarti con transfer, crociere sul Bosforo, hammam e consigli su Istanbul!',
    pt: 'Não, não sou humano — sou Mimo, o assistente de IA da Bosphorly 🌊 Estou aqui para ajudar com traslados, cruzeiros pelo Bósforo, hammam e dicas de Istambul!',
    hr: 'Ne, nisam čovjek — ja sam Mimo, Bosphorlyjev AI asistent 🌊 Tu sam da vam pomognem oko transfera, krstarenja Bosporom, hamama i savjeta za Istanbul!',
    hu: 'Nem, nem vagyok ember — Mimo vagyok, a Bosphorly mesterséges intelligencia asszisztense 🌊 Azért vagyok itt, hogy segítsek a transzferekben, hajóutakban, hamamban és isztambuli tippekben!',
    bs: 'Ne, nisam čovjek — ja sam Mimo, Bosphorlyjev AI asistent 🌊 Tu sam da vam pomognem oko transfera, krstarenja Bosporom, hamama i savjeta za Istanbul!',
    zh: '不，我不是人类——我是 Bosphorly 的人工智能助手 Mimo 🌊 我在这里为您解答伊斯坦布尔机场接送、博斯普鲁斯游船、土耳其浴和旅行建议！',
    ja: 'いいえ、人間ではありません。私はBosphorlyのAIアシスタント、Mimoです 🌊 空港送迎やボスポラスクルーズ、ハマム、イスタンブール観光のご案内をお手伝いします！',
    ko: '아니요, 저는 사람이 아니라 Bosphorly의 AI 도우미 Mimo예요 🌊 공항 픽업, 보스포루스 크루즈, 하맘과 이스탄불 여행 팁을 도와드리고 있어요!',
    hi: 'नहीं, मैं इंसान नहीं हूँ — मैं Mimo हूँ, Bosphorly का AI सहायक 🌊 मैं एयरपोर्ट ट्रांसफ़र, बोस्फोरस क्रूज़, हम्माम और इस्तांबुल यात्रा सुझावों के लिए यहाँ हूँ!',
    bn: 'না, আমি মানুষ নই — আমি Mimo, Bosphorly-এর এআই সহায়ক 🌊 ইস্তাম্বুল ট্রান্সফার, বসফরাস ক্রুজ, হামাম ও ভ্রমণ টিপস দিয়ে সাহায্য করতে আমি আছি!',
    id: 'Tidak, saya bukan manusia—saya Mimo, asisten AI Bosphorly 🌊 Saya di sini untuk membantu transfer bandara, pelayaran Bosphorus, hamam, dan tips wisata Istanbul!',
  },
  thanks: {
    tr: 'Rica ederim, ne demek! 🌊 Transfer, Boğaz turları, hamam veya İstanbul hakkında başka merak ettiğin bir şey var mı?',
    en: 'You are very welcome! 🌊 Is there anything else I can help you with—airport transfers, Bosphorus cruises, hammam, or city tours?',
    ru: 'Пожалуйста! 🌊 Подсказать ещё что-нибудь по трансферам, круизам по Босфору, хаммаму, турам или ценам в Стамбуле?',
    uk: 'Будь ласка! 🌊 Чи підказати ще щось щодо трансферів, круїзів Босфором, хамаму, турів або цін у Стамбулі?',
    de: 'Sehr gerne! 🌊 Kann ich Ihnen noch bei Flughafentransfers, Bosporus-Fahrten, Hamam, Stadttouren oder Preisen weiterhelfen?',
    fr: 'Avec plaisir ! 🌊 Souhaitez-vous d’autres infos sur les transferts, croisières sur le Bosphore, hammams, visites ou tarifs ?',
    nl: 'Graag gedaan! 🌊 Kan ik je nog helpen met transfers, Bosporuscruises, hamam, stadstours of prijzen?',
    ar: 'على الرحب والسعة! 🌊 هل تودّ الاستفسار عن النقل من المطار، رحلات البوسفور، الحمّام، جولات المدينة أو الأسعار؟',
    he: 'בשמחה! 🌊 האם תרצו עזרה נוספת לגבי הסעות, שייט בבוספורוס, חמאם, סיורים או מחירים?',
    az: 'Buyurun, xoşdur! 🌊 Transferlər, Boğaz turları, hamam, şəhər gəzintiləri və ya qiymətlər barədə başqa sualınız varmı?',
    fa: 'خواهش می‌کنم! 🌊 آیا درباره ترانسفر فرودگاه، کروز بسفر، حمام، تورهای شهری یا قیمت‌ها سوال دیگری دارید؟',
    es: '¡Con mucho gusto! 🌊 ¿Puedo ayudarte con algo más sobre traslados, cruceros por el Bósforo, hammam, tours o precios?',
    it: 'Prego, figurati! 🌊 Posso aiutarti con altro tra transfer, crociere sul Bosforo, hammam, tour o prezzi?',
    pt: 'De nada! 🌊 Posso ajudar com mais alguma coisa sobre traslados, cruzeiros pelo Bósforo, hammam, passeios ou preços?',
    hr: 'Nema na čemu! 🌊 Mogu li vam pomoći još oko transfera, krstarenja Bosporom, hamama, tura ili cijena?',
    hu: 'Szívesen! 🌊 Segíthetek még reptéri transzferrel, boszporuszi hajózással, hamammal, városnézéssel vagy árakkal kapcsolatban?',
    bs: 'Nema na čemu! 🌊 Mogu li vam još pomoći oko transfera, krstarenja Bosporom, hamama, tura ili cijena?',
    zh: '不客气！🌊 关于机场接送、博斯普鲁斯游船、土耳其浴、城市游览或参考价格，还有什么我可以帮您的吗？',
    ja: 'どういたしまして！🌊 空港送迎、ボスポラスクルーズ、ハマム、市内ツアーや料金について他に知りたいことはありますか？',
    ko: '천만에요! 🌊 공항 픽업, 보스포루스 크루즈, 하맘, 시티 투어나 요금에 대해 더 궁금한 점이 있으신가요?',
    hi: 'आपका स्वागत है! 🌊 क्या एयरपोर्ट ट्रांसफ़र, बोस्फोरस क्रूज़, हम्माम, सिटी टूर या कीमतों के बारे में कुछ और पूछना है?',
    bn: 'স্বাগতম! 🌊 এয়ারপোর্ট ট্রান্সফার, বসফরাস ক্রুজ, হামাম, সিটি ট্যুর বা খরচ নিয়ে আর কিছু জানতে চান?',
    id: 'Sama-sama! 🌊 Ada lagi yang bisa saya bantu seputar transfer bandara, pelayaran Bosphorus, hamam, tur kota, atau harga?',
  },
  goodbye: {
    tr: 'Görüşmek üzere! 🌊 İstanbul’da harika vakit geçirmeni dilerim. Transfer, Boğaz turu veya hamam için dilediğin zaman Mimo’ya yazabilirsin.',
    en: 'Goodbye and have a wonderful time in Istanbul! 🌊 Feel free to ask Mimo anytime for transfers, Bosphorus cruises, hammam, or tours.',
    ru: 'До свидания и прекрасного отдыха в Стамбуле! 🌊 Пишите Mimo в любое время, если понадобятся трансфер, круиз по Босфору, хаммам или экскурсии.',
    uk: 'До побачення і чудової подорожі до Стамбула! 🌊 Звертайтеся до Mimo будь-коли щодо трансферів, круїзів Босфором, хамаму чи екскурсій.',
    de: 'Auf Wiedersehen und eine wunderbare Zeit in Istanbul! 🌊 Schreiben Sie Mimo jederzeit gerne für Transfers, Bosporus-Fahrten, Hamam oder Touren.',
    fr: 'Au revoir et excellent séjour à Istanbul ! 🌊 N’hésitez pas à revenir vers Mimo pour vos transferts, croisières, hammams ou visites.',
    nl: 'Tot ziens en veel plezier in Istanbul! 🌊 Stuur Mimo gerust weer een bericht voor transfers, cruises, hamam of tours.',
    ar: 'إلى اللقاء ونتمنى لك وقتًا رائعًا في إسطنبول! 🌊 يمكنك مراسلة Mimo في أي وقت للنقل، رحلات البوسفور، الحمّام أو الجولات.',
    he: 'להתראות ותיהנו מאוד באיסטנבול! 🌊 מוזמנים לפנות אל Mimo בכל עת להסעות, שייט, חמאם או סיורים.',
    az: 'Görüşənədək, İstanbulda gözəl vaxt keçirin! 🌊 Transferlər, Boğaz turları, hamam və ya gəzintilər üçün istənilən vaxt Mimo-ya yaza bilərsiniz.',
    fa: 'خداحافظ و سفر خوشی در استانبول داشته باشید! 🌊 هر زمان برای ترانسفر، کروز بسفر، حمام یا تورهای شهری می‌توانید به Mimo پیام بدهید.',
    es: '¡Hasta luego y disfruta mucho de Estambul! 🌊 Escribe a Mimo cuando quieras para traslados, cruceros, hammam o tours.',
    it: 'Arrivederci e buon soggiorno a Istanbul! 🌊 Scrivi a Mimo quando vuoi per transfer, crociere sul Bosforo, hammam o tour.',
    pt: 'Até logo e aproveite muito Istambul! 🌊 Fale com Mimo quando precisar de traslados, cruzeiros, hammam ou passeios.',
    hr: 'Doviđenja i ugodan boravak u Istanbulu! 🌊 Javite se Mimu kad god trebate transfer, krstarenje, hamam ili turu.',
    hu: 'Viszlát, és érezd jól magad Isztambulban! 🌊 Bármikor írhatsz Mimónak transzfer, hajóút, hamam vagy városnézés ügyében.',
    bs: 'Doviđenja i ugodan boravak u Istanbulu! 🌊 Javite se Mimu kad god trebate transfer, krstarenje, hamam ili turu.',
    zh: '再见，祝您在伊斯坦布尔旅途愉快！🌊 如需了解接送、博斯普鲁斯游船、土耳其浴或城市游览，随时欢迎来找 Mimo。',
    ja: 'さようなら、イスタンブールで素敵な時間をお過ごしください！🌊 送迎、クルーズ、ハマム、ツアーのご相談はいつでもMimoへどうぞ。',
    ko: '안녕히 가세요, 이스탄불에서 즐거운 시간 보내세요! 🌊 픽업, 크루즈, 하맘, 투어가 필요하시면 언제든 Mimo를 찾아주세요.',
    hi: 'अलविदा और इस्तांबुल में आपका समय शानदार रहे! 🌊 ट्रांसफ़र, क्रूज़, हम्माम या टूर के लिए कभी भी Mimo से पूछें।',
    bn: 'বিদায়, ইস্তাম্বুলে আপনার সময় দারুণ কাটুক! 🌊 ট্রান্সফার, ক্রুজ, হামাম বা ট্যুরের জন্য যেকোনো সময় Mimo-কে লিখুন।',
    id: 'Sampai jumpa dan selamat menikmati Istanbul! 🌊 Hubungi Mimo kapan saja untuk transfer bandara, pelayaran, hamam, atau tur kota.',
  },
  handoffOffer: {
    tr: 'Bu konuda ekibimizin doğrudan ilgilenmesi daha sağlıklı olur. Ekibimize iletmemi ister misin?',
    en: 'Our team should look into this directly for you. Would you like me to forward this to our team?',
    ru: 'По этому вопросу лучше подключить нашу команду напрямую. Передать ваш запрос нашей команде?',
    uk: 'З цього питання краще звернутися до нашої команди напряму. Передати ваш запит нашій команді?',
    de: 'Unser Team schaut sich das am besten direkt an. Möchten Sie, dass ich Ihre Anfrage an unser Team weiterleite?',
    fr: 'Notre équipe pourra traiter cela directement. Souhaitez-vous que je transmette votre demande à notre équipe ?',
    nl: 'Ons team kan dit het beste direct voor je oppakken. Zal ik je bericht doorsturen naar ons team?',
    ar: 'من الأفضل أن يتولى فريقنا هذا الأمر مباشرة. هل تود أن أحيل رسالتك إلى فريقنا؟',
    he: 'כדאי שהצוות שלנו יטפל בכך ישירות. האם תרצו שאעביר את הפנייה לצוות שלנו?',
    az: 'Bu məsələyə komandamızın birbaşa baxması daha yaxşı olar. Sorğunuzu komandamıza yönləndirim?',
    fa: 'بهتر است تیم ما مستقیماً این موضوع را بررسی کند. آیا مایل هستید پیام شما را به تیم ما ارسال کنم؟',
    es: 'Es mejor que nuestro equipo lo revise directamente. ¿Quieres que envíe tu mensaje a nuestro equipo?',
    it: 'È meglio che il nostro team se ne occupi direttamente. Vuoi che inoltri la tua richiesta al nostro team?',
    pt: 'É melhor nossa equipe cuidar disso diretamente. Gostaria que eu encaminhasse sua mensagem para nossa equipe?',
    hr: 'Najbolje je da ovo izravno pogleda naš tim. Želite li da proslijedim vaš upit našem timu?',
    hu: 'Ebben az ügyben jobb, ha a csapatunk közvetlenül segít. Szeretnéd, hogy továbbítsam a kérésedet a csapatunknak?',
    bs: 'Najbolje je da ovo direktno pogleda naš tim. Želite li da proslijedim vaš upit našem timu?',
    zh: '此事由我们的团队直接为您处理会更稳妥。您希望我将此问题转交给我们团队吗？',
    ja: 'この件は担当チームが直接確認するのが安心です。チームへ引き継ぎましょうか？',
    ko: '이 부분은 저희 팀이 직접 확인해 드리는 것이 좋습니다. 팀에 전달해 드릴까요?',
    hi: 'इस मामले को हमारी टीम सीधे देखे तो बेहतर होगा। क्या मैं आपका संदेश हमारी टीम को भेज दूँ?',
    bn: 'এই বিষয়টি আমাদের টিম সরাসরি দেখলে ভালো হবে। আমি কি আপনার বার্তা আমাদের টিমের কাছে পাঠাব?',
    id: 'Sebaiknya tim kami menanganinya langsung. Apakah Anda ingin saya meneruskan pesan ini ke tim kami?',
  },
  handoffDeclined: {
    tr: 'Anladım, ekibimize iletmiyorum. İstanbul turları, transferler veya gezi önerileri hakkında başka nasıl yardımcı olabilirim?',
    en: 'Understood, I will not forward it. How else can I help you with Istanbul tours, transfers, or travel tips?',
    ru: 'Понял, не передаю. Чем ещё я могу помочь по турам, трансферам или прогулкам в Стамбуле?',
    uk: 'Зрозуміло, не передаю. Чим ще можу допомогти щодо турів, трансферів чи порад у Стамбулі?',
    de: 'Verstanden, ich leite es nicht weiter. Wie kann ich Ihnen sonst bei Touren, Transfers oder Tipps für Istanbul helfen?',
    fr: 'Compris, je ne transmets pas. Comment puis-je vous aider autrement pour vos visites ou transferts à Istanbul ?',
    nl: 'Begrepen, ik stuur het niet door. Waarmee kan ik je verder helpen voor Istanbul?',
    ar: 'تم، لن أقوم بتحويله. كيف يمكنني مساعدتك أيضًا بخصوص الجولات أو النقل أو النصائح في إسطنبول؟',
    he: 'הבנתי, לא אעביר זאת. איך עוד אוכל לעזור לגבי סיורים, הסעות או טיפים באיסטנבול?',
    az: 'Anladım, yönləndirmirəm. İstanbul turları, transferlər və ya gəzinti məsləhətləri ilə bağlı başqa necə kömək edə bilərəm?',
    fa: 'متوجه شدم، ارسال نمی‌کنم. در مورد تورهای استانبول، ترانسفر یا راهنمای سفر چطور می‌توانم کمکتان کنم؟',
    es: 'Entendido, no lo envío. ¿En qué más puedo ayudarte sobre tours, traslados o consejos en Estambul?',
    it: 'Capito, non lo inoltro. Come altro posso aiutarti per tour, transfer o consigli su Istanbul?',
    pt: 'Entendido, não vou encaminhar. Como mais posso ajudar com passeios, traslados ou dicas em Istambul?',
    hr: 'Razumijem, neću proslijediti. Kako vam još mogu pomoći oko tura, transfera ili savjeta za Istanbul?',
    hu: 'Rendben, nem továbbítom. Miben segíthetek még az isztambuli túrákkal vagy transzferekkel kapcsolatban?',
    bs: 'Razumijem, neću proslijediti. Kako vam još mogu pomoći oko tura, transfera ili savjeta za Istanbul?',
    zh: '好的，我暂不转交。关于伊斯坦布尔游览、接送或出行建议，还有什么我可以帮您的吗？',
    ja: '承知しました、転送は控えます。イスタンブールのツアーや送迎、観光案内で他に何かお手伝いできますか？',
    ko: '알겠습니다, 전달하지 않겠습니다. 이스탄불 투어, 픽업 또는 여행 팁과 관련해 다른 도움이 필요하신가요?',
    hi: 'समझ गया, मैं इसे आगे नहीं भेजूँगा। इस्तांबुल टूर, ट्रांसफ़र या यात्रा सुझावों में मैं और क्या मदद कर सकता हूँ?',
    bn: 'বুঝেছি, আমি এটি পাঠাব না। ইস্তাম্বুল ট্যুর, ট্রান্সফার বা ভ্রমণ টিপস নিয়ে আর কীভাবে সাহায্য করতে পারি?',
    id: 'Mengerti, saya tidak akan meneruskannya. Ada hal lain seputar tur, transfer, atau tips Istanbul yang bisa saya bantu?',
  },
  handoff: {
    tr: 'Memnuniyetle ekibimize iletiyorum. Size dönüş yapabilmemiz için e-posta adresinizi paylaşır mısınız?',
    en: 'I am happy to forward this to our team. Please share your email address so we can get back to you.',
    ru: 'С радостью передаю запрос нашей команде. Пожалуйста, укажите ваш e-mail для ответа.',
    uk: 'Із радістю передаю запит нашій команді. Будь ласка, вкажіть ваш e-mail для відповіді.',
    de: 'Gerne leite ich das an unser Team weiter. Bitte nennen Sie Ihre E-Mail-Adresse für unsere Antwort.',
    fr: 'Je transmets avec plaisir à notre équipe. Merci d’indiquer votre adresse e-mail pour que nous puissions vous répondre.',
    nl: 'Ik stuur dit graag door naar ons team. Deel je e-mailadres zodat we contact kunnen opnemen.',
    ar: 'يسعدني إحالة ذلك إلى فريقنا. يرجى مشاركة بريدك الإلكتروني لنتمكن من الرد عليك.',
    he: 'אשמח להעביר זאת לצוות שלנו. אנא שתפו את כתובת הדוא״ל שלכם כדי שנוכל לחזור אליכם.',
    az: 'Məmnuniyyətlə komandamıza yönləndirirəm. Sizə cavab verə bilməyimiz üçün e-poçt ünvanınızı paylaşın.',
    fa: 'با کمال میل به تیم ما ارسال می‌کنم. لطفاً ایمیل خود را بفرستید تا با شما تماس بگیریم.',
    es: 'Con gusto lo envío a nuestro equipo. Por favor, comparte tu correo electrónico para poder responderte.',
    it: 'Inoltro volentieri al nostro team. Condividi la tua e-mail così potremo risponderti.',
    pt: 'Encaminho com prazer para nossa equipe. Por favor, informe seu e-mail para podermos responder.',
    hr: 'Rado ću proslijediti našem timu. Molimo podijelite svoju e-mail adresu kako bismo vam odgovorili.',
    hu: 'Szívesen továbbítom a csapatunknak. Kérlek, add meg az e-mail címedet, hogy válaszolhassunk.',
    bs: 'Rado ću proslijediti našem timu. Molimo podijelite svoju e-mail adresu kako bismo vam odgovorili.',
    zh: '我很乐意为您转交给团队。请留下您的电子邮箱地址，方便我们尽快回复您。',
    ja: '担当チームへお繋ぎします。折り返しご連絡するため、メールアドレスをお知らせください。',
    ko: '저희 팀에 전달해 드리겠습니다. 회신받을 이메일 주소를 알려주시겠어요?',
    hi: 'मैं इसे हमारी टीम को भेज रहा हूँ। कृपया अपना ईमेल पता साझा करें ताकि हम आपको जवाब दे सकें।',
    bn: 'আমি এটি আমাদের টিমের কাছে পাঠাচ্ছি। অনুগ্রহ করে আপনার ইমেইল ঠিকানা দিন যাতে আমরা উত্তর দিতে পারি।',
    id: 'Dengan senang hati saya teruskan ke tim kami. Mohon bagikan alamat email Anda agar kami dapat membalas.',
  },
  unknownHandoff: {
    tr: 'Bunu Boğaz’ın martılarına bile sordum ama emin olamadım 🌊 Uydurmak istemem; sorunuzu ekibimize iletmem için e-posta adresinizi paylaşabilirsiniz.',
    en: 'I even asked the Bosphorus seagulls, but I am not completely sure 🌊 I never want to guess—please share your email address so our team can help you.',
    ru: 'Я даже спросил у босфорских чаек, но точно не уверен 🌊 Не хочу гадать — укажите ваш e-mail, чтобы наша команда помогла вам.',
    uk: 'Я навіть спитав у босфорських чайок, але точно не впевнений 🌊 Не хочу вигадувати — вкажіть ваш e-mail, щоб наша команда допомогла.',
    de: 'Ich habe sogar die Bosporus-Möwen gefragt, bin mir aber nicht sicher 🌊 Ich möchte nichts erfinden; bitte teilen Sie Ihre E-Mail-Adresse, damit unser Team hilft.',
    fr: 'J’ai même demandé aux mouettes du Bosphore, mais je n’en suis pas sûr 🌊 Je préfère ne rien inventer ; indiquez votre e-mail pour que notre équipe vous aide.',
    nl: 'Ik heb het zelfs aan de Bosporus-meeuwen gevraagd, maar ik weet het niet zeker 🌊 Ik verzin liever niets; deel je e-mailadres zodat ons team je helpt.',
    ar: 'حتى نوارس البوسفور لم تكن متأكدة تمامًا 🌊 لا أريد التخمين؛ يرجى مشاركة بريدك الإلكتروني ليساعدك فريقنا بدقة.',
    he: 'שאלתי אפילו את השחפים בבוספורוס, אבל איני בטוח 🌊 לא ארצה לנחש; אנא שתפו את כתובת הדוא״ל שלכם כדי שהצוות שלנו יעזור.',
    az: 'Bunu hətta Boğaz qağayılarından da soruşdum, amma əmin ola bilmədim 🌊 Uydurmaq istəmirəm; komandamızın kömək etməsi üçün e-poçt ünvanınızı paylaşın.',
    fa: 'حتی از مرغ‌های دریایی بسفر هم پرسیدم اما مطمئن نشدم 🌊 نمی‌خواهم حدس بزنم؛ لطفاً ایمیل خود را بفرستید تا تیم ما راهنماییتان کند.',
    es: 'Se lo pregunté hasta a las gaviotas del Bósforo, pero no estoy seguro 🌊 Prefiero no inventar; comparte tu correo electrónico para que nuestro equipo te ayude.',
    it: 'L’ho chiesto persino ai gabbiani del Bosforo, ma non ne sono sicuro 🌊 Non voglio tirare a indovinare; condividi la tua e-mail così il nostro team ti aiuterà.',
    pt: 'Perguntei até às gaivotas do Bósforo, mas não tenho certeza 🌊 Não quero inventar; compartilhe seu e-mail para que nossa equipe ajude você.',
    hr: 'Pitao sam čak i bosporske galebove, ali nisam siguran 🌊 Ne želim nagađati; podijelite svoju e-mail adresu kako bi vam naš tim pomogao.',
    hu: 'Még a boszporuszi sirályokat is megkérdeztem, de nem vagyok biztos benne 🌊 Nem szeretnék találgatni; kérlek, add meg az e-mail címedet, hogy a csapatunk segíthessen.',
    bs: 'Pitao sam čak i bosporske galebove, ali nisam siguran 🌊 Ne želim nagađati; podijelite svoju e-mail adresu kako bi vam naš tim pomogao.',
    zh: '我连博斯普鲁斯海峡的海鸥都问过了，但还是不太确定 🌊 我不想凭空猜测；请留下您的电子邮箱地址，让我们的团队为您提供准确帮助。',
    ja: 'ボスポラスのカモメにも聞いてみましたが、確信が持てませんでした 🌊 曖昧なことは言えませんので、メールアドレスをお知らせいただければチームが正確にご案内します。',
    ko: '보스포루스 갈매기에게도 물어봤지만 확실하지 않네요 🌊 추측해서 말씀드리고 싶지 않으니, 이메일 주소를 남겨주시면 팀에서 정확히 도와드릴게요.',
    hi: 'मैंने बोस्फोरस के सीगल से भी पूछा, पर पक्का नहीं कह सकता 🌊 मैं अंदाज़ा नहीं लगाना चाहता; कृपया अपना ईमेल साझा करें ताकि हमारी टीम आपकी मदद कर सके।',
    bn: 'বসফরাসের গাঙচিলদেরও জিজ্ঞেস করলাম, কিন্তু নিশ্চিত হতে পারিনি 🌊 অনুমান করতে চাই না; অনুগ্রহ করে আপনার ইমেইল দিন যাতে আমাদের টিম সাহায্য করতে পারে।',
    id: 'Saya bahkan bertanya pada burung camar Bosphorus, tapi belum yakin 🌊 Saya tidak ingin menebak-nebak; silakan bagikan email Anda agar tim kami dapat membantu.',
  },
  payment: {
    tr: 'Ödeme yöntemi talebinden sonra seninle iletişime geçtiğimizde paylaşılır.',
    en: 'The payment method is shared when we contact you after your request.',
    ru: 'Способ оплаты сообщается, когда мы связываемся с вами после вашей заявки.',
    uk: 'Спосіб оплати ми повідомимо, коли зв’яжемося з вами щодо запиту.',
    de: 'Die Zahlungsart teilen wir Ihnen mit, wenn wir uns wegen Ihrer Anfrage bei Ihnen melden.',
    fr: 'Nous vous indiquons le mode de paiement lorsque nous vous contactons au sujet de votre demande.',
    nl: 'We delen de betaalmethode wanneer we contact met je opnemen over je aanvraag.',
    ar: 'تتم مشاركة طريقة الدفع عندما نتواصل معك بعد تقديم طلبك.',
    he: 'את אמצעי התשלום נמסור כשניצור איתכם קשר לגבי הבקשה.',
    az: 'Ödəniş üsulunu sorğunuzla bağlı sizinlə əlaqə saxlayanda bildiririk.',
    fa: 'روش پرداخت را هنگامی که درباره درخواستتان با شما تماس می‌گیریم اعلام می‌کنیم.',
    es: 'Te indicamos el método de pago cuando nos pongamos en contacto contigo por tu solicitud.',
    it: 'Ti comunichiamo il metodo di pagamento quando ti contattiamo per la tua richiesta.',
    pt: 'Informamos a forma de pagamento quando entrarmos em contato sobre o seu pedido.',
    hr: 'Način plaćanja javljamo kada vas kontaktiramo u vezi s upitom.',
    hu: 'A fizetési módot akkor közöljük, amikor az ajánlatkérése ügyében felvessük Önnel a kapcsolatot.',
    bs: 'Način plaćanja javljamo kada vas kontaktiramo u vezi s upitom.',
    zh: '我们会在就你的申请与你联系时告知付款方式。',
    ja: 'お支払い方法は、リクエストについてご連絡する際にお知らせします。',
    ko: '결제 방법은 요청과 관련해 연락드릴 때 안내해 드립니다.',
    hi: 'आपके अनुरोध के बारे में संपर्क करते समय हम भुगतान का तरीका बताएँगे।',
    bn: 'আপনার অনুরোধ নিয়ে যোগাযোগ করার সময় আমরা পেমেন্টের পদ্ধতি জানাব।',
    id: 'Kami memberi tahu metode pembayaran saat menghubungi Anda terkait permintaan Anda.',
  },
  busy: {
    tr: 'Şu an yoğunuz, mesajını ekibe iletelim mi? E-posta adresini paylaşabilirsin.',
    en: 'We are currently busy—would you like us to forward your message to our team? Please share your email address.',
    ru: 'Сейчас мы заняты — передать ваше сообщение нашей команде? Укажите ваш e-mail.',
    uk: 'Зараз ми зайняті — передати ваше повідомлення команді? Вкажіть ваш e-mail.',
    de: 'Wir sind gerade ausgelastet — sollen wir Ihre Nachricht weiterleiten? Bitte geben Sie Ihre E-Mail-Adresse an.',
    fr: 'Nous sommes très sollicités — souhaitez-vous transmettre votre message ? Indiquez votre adresse e-mail.',
    nl: 'Het is momenteel erg druk — wil je dat we je bericht doorsturen? Deel je e-mailadres.',
    ar: 'نحن مشغولون حاليًا، هل نرسل رسالتك إلى فريقنا؟ يمكنك مشاركة بريدك الإلكتروني.',
    he: 'אנו עמוסים כרגע — תרצו שנעביר את הפנייה לצוות? שתפו את הדוא״ל שלכם.',
    az: 'Hazırda məşğuluq — mesajınızı komandamıza yönləndirək? E-poçt ünvanınızı paylaşa bilərsiniz.',
    fa: 'در حال حاضر مشغول هستیم — پیامتان را به تیم ارسال کنیم؟ ایمیل خود را بنویسید.',
    es: 'Estamos muy ocupados ahora — ¿reenviamos tu mensaje al equipo? Comparte tu correo electrónico.',
    it: 'Siamo molto impegnati al momento — vuoi che inoltriamo il messaggio al team? Condividi la tua e-mail.',
    pt: 'Estamos ocupados no momento — gostaria de encaminhar sua mensagem para a equipe? Informe seu e-mail.',
    hr: 'Trenutačno smo zauzeti — želite li da proslijedimo poruku timu? Podijelite svoju e-mail adresu.',
    hu: 'Jelenleg elfoglaltak vagyunk — továbbítsuk az üzenetedet a csapatnak? Add meg az e-mail címed.',
    bs: 'Trenutno smo zauzeti — želite li da proslijedimo poruku timu? Podijelite svoju e-mail adresu.',
    zh: '当前咨询较多，是否帮您转交给团队处理？请留下您的邮箱地址。',
    ja: 'ただいま混み合っております。チームへ引き継ぐためメールアドレスをご入力いただけますか？',
    ko: '현재 문의가 많습니다. 팀에 전달해 드릴 수 있도록 이메일 주소를 남겨주시겠어요?',
    hi: 'हम अभी व्यस्त हैं — क्या हम आपका संदेश टीम को भेज दें? कृपया अपना ईमेल साझा करें।',
    bn: 'আমরা এখন ব্যস্ত — আপনার বার্তাটি কি টিমের কাছে পাঠাব? অনুগ্রহ করে ইমেইল দিন।',
    id: 'Saat ini kami sedang sibuk — apakah pesan Anda ingin diteruskan ke tim? Silakan bagikan email Anda.',
  },
  sensitiveWarn: {
    tr: 'Güvenliğiniz için lütfen kart veya pasaport numarası paylaşmayın; bu bilgiler gizlendi.',
    en: 'For your security, please do not share card or passport numbers; they have been hidden.',
    ru: 'В целях безопасности не указывайте номера карт или паспортов; они были скрыты.',
    uk: 'Задля безпеки не надсилайте номери карток чи паспортів; їх приховано.',
    de: 'Zu Ihrer Sicherheit teilen Sie bitte keine Karten- oder Passnummern; diese wurden unkenntlich gemacht.',
    fr: 'Pour votre sécurité, ne partagez pas de numéros de carte ou de passeport ; ils ont été masqués.',
    nl: 'Deel voor je veiligheid geen kaart- of paspoortnummers; deze zijn verborgen.',
    ar: 'لحمايتك، يرجى عدم مشاركة أرقام البطاقات أو جوازات السفر؛ تم إخفاؤها.',
    he: 'למען ביטחונכם, אל תשתפו מספרי כרטיס או דרכון; פרטים אלה הוסתרו.',
    az: 'Təhlükəsizliyiniz üçün kart və ya pasport nömrələrini paylaşmayın; bu məlumatlar gizlədildi.',
    fa: 'برای امنیت شما، لطفاً شماره کارت یا گذرنامه را به اشتراک نگذارید؛ این اطلاعات پنهان شد.',
    es: 'Por tu seguridad, no compartas números de tarjeta o pasaporte; han sido ocultados.',
    it: 'Per la tua sicurezza, non condividere numeri di carta o passaporto; sono stati nascosti.',
    pt: 'Para sua segurança, não compartilhe números de cartão ou passaporte; eles foram ocultados.',
    hr: 'Radi vaše sigurnosti ne dijelite brojeve kartica ili putovnica; ti su podaci skriveni.',
    hu: 'Biztonsága érdekében ne osszon meg kártya- vagy útlevélszámot; ezeket elrejtettük.',
    bs: 'Radi vaše sigurnosti ne dijelite brojeve kartica ili pasoša; ti podaci su skriveni.',
    zh: '为了您的安全，请勿分享银行卡号或护照号；相关信息已被隐藏。',
    ja: '安全のため、カード番号やパスポート番号は共有しないでください（該当情報は非表示にしました）。',
    ko: '안전을 위해 카드 번호나 여권 번호를 공유하지 마세요. 해당 정보는 가려졌습니다.',
    hi: 'आपकी सुरक्षा के लिए, कृपया कार्ड या पासपोर्ट नंबर साझा न करें; इन्हें छिपा दिया गया है।',
    bn: 'আপনার নিরাপত্তার জন্য অনুগ্রহ করে কার্ড বা পাসপোর্ট নম্বর শেয়ার করবেন না; এগুলো গোপন করা হয়েছে।',
    id: 'Demi keamanan Anda, jangan bagikan nomor kartu atau paspor; informasi tersebut telah disembunyikan.',
  },
  rateLimit: {
    tr: 'Çok hızlı soru gönderdiniz. Kısa bir süre sonra tekrar deneyebilir veya mesajınızı ekibimize iletebilirsiniz.',
    en: 'You are sending messages too quickly. Please try again shortly or forward your message to our team.',
    ru: 'Слишком много сообщений. Попробуйте чуть позже или передайте вопрос нашей команде.',
    uk: 'Ви надсилаєте повідомлення надто швидко. Спробуйте трохи пізніше або передайте запит команді.',
    de: 'Sie senden Nachrichten zu schnell. Bitte versuchen Sie es gleich erneut oder leiten Sie Ihre Nachricht weiter.',
    fr: 'Vous envoyez des messages trop rapidement. Réessayez dans un instant ou transmettez votre message à notre équipe.',
    nl: 'Je verstuurt berichten te snel. Probeer het zo opnieuw of stuur je bericht door naar ons team.',
    ar: 'لقد أرسلت رسائل كثيرة بسرعة. يرجى المحاولة لاحقًا أو إرسال رسالتك إلى فريقنا.',
    he: 'אתם שולחים הודעות מהר מדי. נסו שוב בעוד רגע או העבירו את הפנייה לצוות.',
    az: 'Çox sürətlə mesaj göndərirsiniz. Bir az sonra yenidən yoxlayın və ya mesajınızı komandaya yönləndirin.',
    fa: 'پیام‌ها خیلی سریع ارسال شدند. لطفاً کمی بعد دوباره تلاش کنید یا به تیم ما ارسال کنید.',
    es: 'Estás enviando mensajes muy rápido. Inténtalo en breve o envía tu mensaje a nuestro equipo.',
    it: 'Stai inviando messaggi troppo velocemente. Riprova tra poco o inoltra la richiesta al nostro team.',
    pt: 'Você está enviando mensagens rápido demais. Tente novamente em instantes ou encaminhe para nossa equipe.',
    hr: 'Šaljete poruke prebrzo. Pokušajte uskoro ponovno ili proslijedite poruku našem timu.',
    hu: 'Túl gyorsan küldesz üzeneteket. Próbáld meg hamarosan újra, vagy továbbítsd a csapatunknak.',
    bs: 'Šaljete poruke prebrzo. Pokušajte uskoro ponovo ili proslijedite poruku našem timu.',
    zh: '您发送消息过于频繁，请稍后再试，或将问题转交给我们团队。',
    ja: '送信が速すぎます。少し時間をおいて再試行するか、チームへお問い合わせください。',
    ko: '메시지를 너무 빠르게 보내고 있습니다. 잠시 후 다시 시도하거나 팀에 전달해 주세요.',
    hi: 'आप बहुत तेज़ी से संदेश भेज रहे हैं। कृपया थोड़ी देर बाद प्रयास करें या हमारी टीम को भेजें।',
    bn: 'আপনি খুব দ্রুত বার্তা পাঠাচ্ছেন। একটু পরে আবার চেষ্টা করুন বা আমাদের টিমে পাঠান।',
    id: 'Anda mengirim pesan terlalu cepat. Coba lagi sebentar atau teruskan pesan ke tim kami.',
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
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh';
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

export function stripExternalLinks(input) {
  let text = String(input || '');
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/gi, (full, label, url) => {
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (host === 'bosphorly.com' || host === 'www.bosphorly.com') return full;
    } catch {}
    return label;
  });
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

export function stripFakeUrgency(input) {
  let text = String(input || '');
  const urgencyPatterns = [
    /(?:^|[^\p{L}])(?:son\s+(?:birkaç\s+|bir\s+)?(?:yer|koltuk|fırsat)\w*|sadece\s+bugün(?:e\s+özel)?|bugüne\s+özel|acele\s+ed\w*|hemen\s+yerinizi\s+ayırt\w*|kaçırmayın|tükenmek\s+üzere|sınırlı\s+kontenjan)/giu,
    /(?:^|[^\p{L}])(?:only\s+today|today\s+only|last\s+(?:few\s+)?(?:seat|spot)s?(?:\s+left)?|limited\s+seats?(?:\s+left)?|few\s+seats\s+left|selling\s+fast|almost\s+sold\s+out|hurry(?:\s+up)?|don'?t\s+miss\s+out|act\s+fast|limited\s+time\s+offer)/giu,
    /(?:^|[^\p{L}])(?:только\s+сегодня|последние\s+места|осталось\s+мало\s+мест|спешите)/giu,
    /(?:^|[^\p{L}])(?:فقط\s+اليوم|اليوم\s+فقط|المقاعد\s+الأخيرة|أماكن\s+محدودة|سارع\s+بالحجز)/giu,
    /(?:^|[^\p{L}])(?:nur\s+heute|letzte\s+plätze|seulement\s+aujourd'hui|dernières\s+places|solo\s+hoy|últimos\s+lugares|últimas\s+plazas)/giu,
  ];
  for (const re of urgencyPatterns) {
    text = text.replace(re, ' ');
  }
  return text
    .replace(/\s+([,.;!?])/g, '$1')
    .replace(/([,;])\s*([.!?]|$)/g, '$2')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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

export function isAiIdentityQuestion(message) {
  const t = String(message || '').trim();
  if (!t) return false;
  return /(?:^|[^\p{L}])(sen\s+insan\s+m[ıi]s[ıi]n|insan\s+m[ıi]s[ıi]n|gerçek\s+(?:bir\s+)?insan\s+m[ıi]s[ıi]n|yapay\s+zek[aâ]\s+m[ıi]s[ıi]n|robot\s+musun|bot\s+musun|sen\s+kimsin|kimsin\s+sen|are\s+you\s+(?:a\s+)?(?:human|real\s+person|person|bot|robot|ai|artificial\s+intelligence)|who\s+are\s+you|ты\s+(?:человек|бот|робот|ии)|ви\s+(?:людина|бот|робот)|bist\s+du\s+(?:ein\s+)?(?:mensch|bot|roboter|ki)|es[-\s]tu\s+(?:humain|un\s+humain|un\s+robot|un\s+bot|une\s+ia)|ben\s+je\s+(?:een\s+)?(?:mens|bot|robot)|هل\s+أنت\s+(?:إنسان|بشر|روبوت|بوت|ذكاء\s+اصطناعي)|האם\s+אתה\s+(?:אנושי|אדם|בוט|רובוט)|sən\s+insansan|آیا\s+(?:شما|تو)\s+انسان\s+هست|¿?eres\s+(?:humano|una\s+persona|un\s+bot|un\s+robot|una\s+ia)|sei\s+(?:umano|una\s+persona|un\s+bot|un\s+robot)|você\s+é\s+(?:humano|uma\s+pessoa|um\s+robô|um\s+bot)|jesi\s+li\s+(?:čovjek|covjek|robot|bot)|ember\s+vagy|你是(?:真人|人类|人|机器人|人工智能)吗|あなたは(?:人間|ロボット|ボット|ai)ですか|(?:\s|^)(?:사람|인간|로봇|봇|인공지능)(?:인가요|이니|입니까|이야)|क्या\s+(?:आप|तुम)\s+इंसान\s+हैं|আপনি\s+কি\s+মানুষ|apakah\s+(?:kamu|anda)\s+manusia)(?=$|[^\p{L}])/iu.test(t);
}

export function isHumanOrHandoffTopic(message) {
  const t = String(message || '').toLowerCase();
  if (isAiIdentityQuestion(t)) return false;
  return /(?:^|[^\p{L}])(insanla konuş\w*|müşteri hizmet\w*|yetkili\w*|canlı destek|temsilci\w*|şikayet\w*|şikâyet\w*|iade|para iade\w*|geri ödeme\w*|ödeme sorun\w*|ödeme hata\w*|ödeyemiyorum|iptal et\w*|rezervasyonumu|tarih değişikl\w*|talk to a human|speak to a human|speak to someone|human agent|real person|customer support|complaint|refund|money back|payment issue|payment problem|payment failed|billing issue|change my booking|cancel my booking|modify my booking|reschedule|человек|оператор|менеджер|жалоба|претензия|возврат|проблема с оплатой|ошибка оплаты|отменить бронирование|изменить бронирование|скарга|повернення|скасувати бронювання|تحدث مع|موظف|خدمة العملاء|شكوى|استرداد|مشكلة في الدفع|إلغاء الحجز|تعديل الحجز|נציג|תלונה|החזר כספי|شکایت|بازپرداخت|پشتیبانی)(?=$|[^\p{L}])/iu.test(t);
}

export function isPaymentQuestion(message) {
  const t = String(message || '').toLowerCase();
  if (isHumanOrHandoffTopic(t)) return false;
  return /(?:^|[^\p{L}])(ödeme\w*|nasıl öde\w*|neyle öde\w*|kredi kart\w*|havale|eft|kapıda ödeme|payment|how to pay|how do i pay|pay by|credit card|cash|оплат\w*|способ оплаты|як оплат\w*|دفع|طريقة الدفع)(?=$|[^\p{L}])/iu.test(t);
}

const DOMAIN_TOPIC_RE = /(?:^|[^\p{L}])(ayasofya|hagia|topkap|sultanahmet|yerebatan|galata|dolmabah|boğaz|bosphorus|босфор|بوسفور|transfer|havaliman|airport|аэропорт|مطار|ist|saw|hamam|hammam|хаммам|حمام|fiyat|price|cost|сколько|سعر|bilet|ticket|otel|hotel|rezervasyon|booking|tur|turlar|tour|cruise|круиз|جولة|vapur|ferry|metro|yemek|food|restoran|kebap|baklava|kumpir|taksim|kadıköy|balat|eminönü|adalar|princes|bursa|sapanca|kapadokya|cappadocia)(?=$|[^\p{L}])/iu;

const SMALL_TALK_THANK_RE = /(?:^|[^\p{L}])(teşekkür\w*|sağ ol\w*|eyvallah|thanks|thank you|thx|спасибо|благодарю|дякую|спасибі|danke|dankeschön|merci|bedankt|dank je|شكرا|شكراً|متشکرم|ممنون|תודה|təşəkkür\w*|gracias|grazie|obrigad[oa]|hvala|köszönöm|terima kasih|makasih|धन्यवाद|शुक्रिया|ধন্যবাদ|谢谢|感謝|ありがとう|ありがとうございます|감사합니다|고마워요)(?=$|[^\p{L}])/iu;

const SMALL_TALK_BYE_RE = /(?:^|[^\p{L}])(görüşürüz|hoşça kal\w*|güle güle|bye|goodbye|see you|farewell|пока|до свидания|бувай|до побачення|tschüss|auf wiedersehen|au revoir|à bientôt|tot ziens|doei|مع السلامة|إلى اللقاء|להתראות|ביי|görüşənədək|xudahafiz|خداحافظ|adiós|hasta luego|arrivederci|tchau|até logo|doviđenja|viszlát|sampai jumpa|अलविदा|বিদায়|再见|拜拜|さようなら|안녕히 가세요)(?=$|[^\p{L}])/iu;

const SMALL_TALK_GREET_RE = /(?:^|[^\p{L}])(merhaba|selam\w*|günaydın|iyi akşamlar|iyi günler|nasılsın\w*|kimsin\w*|ne yapabilirsin|hello|hi|hey|good morning|good afternoon|good evening|how are you|who are you|what can you do|привет|здравствуйте|добрый день|доброе утро|добрый вечер|как дела|кто ты|что ты умеешь|привіт|вітаю|добрий день|добрий ранок|hallo|guten tag|guten morgen|guten abend|wie geht es|wer bist du|bonjour|salut|bonsoir|comment ça va|hoi|goedemorgen|goedemiddag|goedenavond|مرحبا|أهلا|اهلا|السلام عليكم|صباح الخير|مساء الخير|كيف حالك|שלום|היי|בוקר טוב|ערב טוב|מה נשמע|salam|sabahınız xeyir|necəsən|سلام|درود|صبح بخیر|حالت چطوره|hola|buenos días|buenas tardes|buenas noches|ciao|buongiorno|buonasera|salve|olá|oi|bom dia|boa tarde|boa noite|bok|pozdrav|dobro jutro|dobar dan|zdravo|ćao|szia|helló|jó reggelt|jó napot|halo|hai|selamat pagi|selamat siang|selamat malam|apa kabar|नमस्ते|नमस्कार|হ্যালো|নমস্কার|সালাম|你好|您好|早上好|晚上好|こんにちは|こんばんは|おはよう|안녕하세요|안녕)(?=$|[^\p{L}])/iu;

export function classifySmallTalk(message) {
  const t = String(message || '').trim();
  if (!t) return null;
  if (isAiIdentityQuestion(t) || isHumanOrHandoffTopic(t) || isPaymentQuestion(t)) return null;
  if (DOMAIN_TOPIC_RE.test(t)) return null;
  const wordCount = t.split(/\s+/).filter(Boolean).length;
  if (wordCount > 8) return null;
  if (SMALL_TALK_THANK_RE.test(t)) return 'thanks';
  if (SMALL_TALK_BYE_RE.test(t)) return 'goodbye';
  if (SMALL_TALK_GREET_RE.test(t)) return 'greeting';
  return null;
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
  if (objCandidate && typeof objCandidate.reply === 'string') {
    return { handoff: Boolean(objCandidate.handoff), reply: objCandidate.reply.trim(), parseFailed: false };
  }

  const text = extractRawText(raw).replace(/<think>[\s\S]*?<\/think>/gi, '');
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const obj = JSON.parse(jsonMatch[0]);
      if (obj && typeof obj.reply === 'string') {
        return { handoff: Boolean(obj.handoff), reply: obj.reply.trim(), parseFailed: false };
      }
    } catch {
      return { handoff: true, reply: '', parseFailed: true };
    }
  }
  const handoff = /\[HANDOFF\]/i.test(trimmed);
  return { handoff, reply: trimmed.replace(/\[HANDOFF\]/gi, '').trim(), parseFailed: false };
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

  const safeHistory = (Array.isArray(history) ? history : [])
    .slice(-6)
    .filter((h) => h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string')
    .map((h) => ({ role: h.role, content: redactSensitive(h.content).text.slice(0, 600) }));

  const guestName = extractGuestName(safeHistory, cleanMsg);
  const timeGreet = getIstanbulGreeting(lang, now);

  if (isPreviousHandoffOffer(safeHistory)) {
    if (isAffirmative(cleanMsg)) {
      return { ok: true, handoff: true, lang, reply: `${warnPrefix}${msg('handoff', lang)}` };
    }
    if (isNegative(cleanMsg)) {
      return { ok: true, handoff: false, lang, reply: `${warnPrefix}${msg('handoffDeclined', lang)}` };
    }
  }

  if (isHumanOrHandoffTopic(cleanMsg)) {
    return {
      ok: true,
      handoff: false,
      handoffOffer: true,
      lang,
      reply: `${warnPrefix}${msg('handoffOffer', lang)}`,
    };
  }

  if (isPaymentQuestion(cleanMsg)) {
    return {
      ok: true,
      handoff: false,
      lang,
      reply: `${warnPrefix}${msg('payment', lang)} https://bosphorly.com/faq.html?lang=${lang}`,
    };
  }

  const aiIdentityAsked = isAiIdentityQuestion(cleanMsg);

  const smallTalkKind = classifySmallTalk(cleanMsg);
  if (smallTalkKind) {
    let baseReply = msg(smallTalkKind, lang);
    if (smallTalkKind === 'greeting') {
      baseReply = `${timeGreet}${guestName ? `, ${guestName}` : ''}! ${baseReply}`;
    } else if (guestName) {
      baseReply = attachGuestName(baseReply, guestName);
    }
    return {
      ok: true,
      handoff: false,
      lang,
      reply: `${warnPrefix}${capEmojis(baseReply, 2)}`,
    };
  }

  if (!env || !env.AI || typeof env.AI.run !== 'function') {
    if (aiIdentityAsked) {
      return {
        ok: true,
        handoff: false,
        lang,
        reply: `${warnPrefix}${capEmojis(attachGuestName(msg('aiIdentity', lang), guestName), 2)}`,
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

  const chunks = retrieveChunks(cleanMsg, 6);
  const contextBlock = chunks.length
    ? chunks.map((c, i) => `[${i + 1}] ${c.title}\nURL: ${c.url}\n${c.text}`).join('\n\n')
    : '(No specific Bosphorly catalog chunks matched this general query; answer from reliable general Istanbul knowledge and only mention Bosphorly services if genuinely relevant.)';

  const systemPrompt = [
    'You are Mimo ("Bosphorly\'nin yapay zekâ asistanı Mimo"), Bosphorly\'s cute, warm, and cheerful AI assistant for Istanbul.',
    `Reply strictly in language code "${lang}".`,
    `Current Istanbul time-of-day greeting for "${lang}": "${timeGreet}".`,
    guestName
      ? `The guest shared their name in this conversation: "${guestName}". Address them warmly by name ("${guestName}") in your reply (never store their name on the server).`
      : 'If the guest tells you their name during the chat, address them warmly by name.',
    'PERSONALITY & RULES:',
    '1. IDENTITY (MIMO): Your name is Mimo. Always introduce yourself as Mimo, Bosphorly\'s AI assistant ("Bosphorly\'nin yapay zekâ asistanı Mimo"). NEVER claim to be human; if asked whether you are human, a real person, a robot, or AI, state clearly and warmly that you are Mimo, an AI assistant.',
    '2. TONE & EMOJIS: Use warm, cheerful, short sentences. Use at most 1–2 emojis per reply (never more than 2 emojis).',
    '3. HONESTY WHEN UNSURE: If you do not know something, be witty/playful and honest—never invent facts or prices.',
    '4. NO PUSHY SALES: Help the guest first! Only mention or suggest a Bosphorly service (name + "approx." price if in context + bosphorly.com link) naturally when genuinely relevant. Never force a sales pitch.',
    '5. GENERAL ISTANBUL KNOWLEDGE & CHANGING INFO: For general Istanbul questions (history, neighbourhoods, food, local transit, tips), answer warmly. Never state opening hours, ticket fees, or closing days as guaranteed; always tell the guest to verify current info on the official website ("güncel bilgiyi resmî kaynaktan kontrol et" in Turkish, or equivalent).',
    '6. BOSPHORLY FACTS ONLY FROM CONTEXT: For Bosphorly prices, tours, operators, transfers, and payment policy, use ONLY the PROVIDED CONTEXT below. State tour prices as approximate and confirmed upon request (fixed Sultanahmet transfers: €60 IST, €65 SAW one-way per vehicle, also confirmed upon request).',
    `7. BOOKING INTEREST: If the guest expresses interest in a transfer, cruise, tour, or hammam, ask for their date, number of guests, and hotel area (if not already given), share the matching link with parameters — https://bosphorly.com/booking.html?service=<id>&lang=${lang} (ids: bb-morning, bb-sunset, bb-oldcity, orient-dinner, sea-land, alaturka, azure-islands, azure-bursa, azure-sapanca, sl-privateyacht), https://bosphorly.com/index.html?lang=${lang}#booking for transfers, or https://bosphorly.com/tours.html?lang=${lang} for custom/private/multi-day tours — and say that once they submit the form, our team will confirm ("formu doldurduğunda ekibimiz onaylar" in Turkish, or equivalent).`,
    '8. FORBIDDEN: Never use fake urgency ("last seats", "only today", "son yer", "sadece bugün"), never promise discounts, never confirm a booking yourself, never ask for payment/card/passport numbers, never badmouth competitors, never engage in political or religious debates.',
    '9. HANDOFF: Set handoff=true ONLY for complaints, refunds, payment issues, existing booking changes/cancellations, or explicit requests to speak with a human. Answer everything else yourself with handoff=false.',
    '10. FORMAT & LENGTH: Keep replies warm and concise (max ~120 words), ending with a helpful follow-up question when natural. Output ONLY valid JSON: {"handoff": boolean, "reply": "string"}',
    '',
    'PROVIDED CONTEXT:',
    contextBlock,
  ].join('\n');

  const messages = [
    { role: 'system', content: systemPrompt },
    ...safeHistory,
    { role: 'user', content: cleanMsg.slice(0, 1000) },
  ];

  try {
    const aiResult = await Promise.race([
      env.AI.run(ASSISTANT_MODEL, {
        messages,
        max_completion_tokens: 280,
        temperature: 0.2,
        chat_template_kwargs: { enable_thinking: false },
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('AI timeout')), AI_TIMEOUT_MS)),
    ]);
    const parsed = parseModelOutput(aiResult);
    let reply = stripFakeUrgency(stripExternalLinks(redactSensitive(parsed.reply).text));
    if (parsed.parseFailed || isNonsensicalReply(reply)) {
      if (aiIdentityAsked) {
        return {
          ok: true,
          handoff: false,
          lang,
          reply: `${warnPrefix}${capEmojis(attachGuestName(msg('aiIdentity', lang), guestName), 2)}`,
        };
      }
      console.warn('assistant_ai_invalid_output', {
        model: ASSISTANT_MODEL,
        reason: parsed.parseFailed ? 'json_parse_error' : 'empty_or_nonsensical',
      });
      return { ok: true, handoff: true, fallback: true, lang, reply: `${warnPrefix}${msg('unknownHandoff', lang)}` };
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
    if (guestName) reply = attachGuestName(reply, guestName);
    reply = capEmojis(capWords(reply, 120), 2);
    return { ok: true, handoff: false, lang, reply: `${warnPrefix}${reply}` };
  } catch (err) {
    if (aiIdentityAsked) {
      return {
        ok: true,
        handoff: false,
        lang,
        reply: `${warnPrefix}${capEmojis(attachGuestName(msg('aiIdentity', lang), guestName), 2)}`,
      };
    }
    console.error('assistant_ai_call_failed', {
      model: ASSISTANT_MODEL,
      errorType: err && err.name ? String(err.name) : 'Error',
    });
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

  if (url.pathname === '/v1/assistant/feedback') {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return jsonResp({ error: 'Invalid feedback payload' }, 400);
    }
    const keys = Object.keys(body);
    if (keys.some((k) => !['vote', 'rating', 'lang'].includes(k))) {
      return jsonResp({ error: 'Message content is not allowed in feedback' }, 400);
    }
    const rawVote = body.vote !== undefined ? body.vote : body.rating;
    let vote = '';
    if (rawVote === 'up' || rawVote === 1) vote = 'up';
    else if (rawVote === 'down' || rawVote === -1 || rawVote === 0) vote = 'down';
    if (!vote) return jsonResp({ error: 'Invalid vote' }, 400);
    const lang = normalizeLang(typeof body.lang === 'string' ? body.lang : '') || 'en';
    const recorded = await recordAssistantFeedback({ env, lang, vote });
    return jsonResp(recorded, 200);
  }

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
    return jsonResp({
      reply: result.reply,
      handoff: Boolean(result.handoff),
      handoffOffer: Boolean(result.handoffOffer),
      busy: Boolean(result.busy),
      lang: result.lang,
    }, 200);
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
