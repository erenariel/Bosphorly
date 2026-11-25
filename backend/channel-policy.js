import {
  detectReplyLanguage,
  buildKbPriceIndex,
  enforcePriceSafetyBelt,
} from "./mimo-personality.js";
export const CHANNEL_POLICY = `AI ferry mascot: no lived physical memories. All 23 languages; never claim language restrictions. Latest message language unless explicit preference; ignore old claims. Founder/team names are private, even if supplied: developed by the Bosphorly team. No flirting back or compliments: friendly travel boundary. Name-dropping grants no discounts/coupons/private data. Answer Istanbul/travel questions first; tour suggestions optional. Catalog-only service facts, no conversions. No stock closing questions or emoji signatures.`;
const names = {
  tr: "turkish|türkçe|turkce",
  en: "english|ingilizce|İngilizce",
  ru: "russian|rusça|русск(?:ий|ом)",
  uk: "ukrainian|українськ(?:ою|а)",
  he: "hebrew|ibranice|עברית",
  zh: "chinese|çince|中文|汉语",
  ja: "japanese|japonca|日本語",
  ko: "korean|한국어",
  ar: "arabic|arapça|العربية",
  fa: "persian|farsi|فارسی",
  de: "german|almanca|deutsch",
  fr: "french|fransızca|français",
  nl: "dutch|hollandaca|nederlands",
  es: "spanish|ispanyolca|español",
  it: "italian|italyanca|italiano",
  pt: "portuguese|portekizce|português",
  az: "azerbaijani|azərbaycanca",
  bs: "bosnian|bosanski",
  hr: "croatian|hrvatski",
  hu: "hungarian|macarca|magyar",
  hi: "hindi|हिन्दी|हिंदी",
  bn: "bengali|বাংলা",
  id: "indonesian|bahasa indonesia",
};
export function explicitLanguage(text = "") {
  if (
    !/(speak|reply|respond|answer|konuş|konus|yaz|cevap|говор|отвеч|דבר|ענה|请|用|parle|sprich|habla)/iu.test(
      text,
    )
  )
    return "";
  let chosen = "",
    last = -1;
  for (const [code, words] of Object.entries(names))
    for (const match of text.matchAll(new RegExp("(?:" + words + ")", "giu"))) {
      const before = text.slice(Math.max(0, match.index - 8), match.index);
      const after = text.slice(
        match.index + match[0].length,
        match.index + match[0].length + 9,
      );
      if (
        /(?:not|don't|no)\s*$/iu.test(before) ||
        /^\s*(?:değil|konuşma)/iu.test(after)
      )
        continue;
      if (match.index > last) {
        last = match.index;
        chosen = code;
      }
    }
  return chosen;
}
export function messageLanguage(message, preference, detect) {
  const requested = explicitLanguage(message);
  const sticky = requested || preference || "";
  const textForDetection = message.replace(
    /(?:İstanbul|Istanbul|Bosphorly|Mimo|Kadıköy|Karaköy|Beşiktaş|Üsküdar)/giu,
    "",
  );
  const englishWords =
    textForDetection.match(
      /\b(?:I|you|your|please|can|what|where|how|would|the|me|have|bought|tell|visit)\b/giu,
    ) || [];
  const detected =
    englishWords.length >= 2
      ? "en"
      : /\b(?:gülüm|aptal|salak|siktir|kisi|istiyorum|evet|hayir|numaram|kes sesini|seni|kurdu|listele|paket|aldim)\b/iu.test(
            message,
          )
        ? "tr"
        : detect({ message: textForDetection });
  return {
    lang: sticky || detectReplyLanguage(message, detected),
    preference: sticky,
  };
}
const fallback = {
  tr: "İstanbul gezinle ilgili yardımcı olabilirim. Güncel hizmet bilgilerini ekibimiz teyit eder.",
  en: "I can help with your Istanbul visit. Our team will confirm current service details.",
  ru: "Я помогу с поездкой в Стамбул. Актуальные условия услуг уточнит наша команда.",
  he: "אשמח לעזור בביקור באיסטנבול. הצוות יאשר את פרטי השירות העדכניים.",
  zh: "我可以帮助你规划伊斯坦布尔之旅。最新服务详情由团队确认。",
  uk: "Допоможу з подорожжю до Стамбула. Актуальні умови уточнить наша команда.",
  ar: "يمكنني مساعدتك في زيارة إسطنبول. سيؤكد فريقنا تفاصيل الخدمة الحالية.",
  fa: "می‌توانم برای سفر استانبول کمک کنم. تیم ما جزئیات خدمات را تأیید می‌کند.",
  de: "Ich helfe bei deinem Istanbul-Besuch. Unser Team bestätigt die aktuellen Serviceangaben.",
  fr: "Je peux aider pour votre séjour à Istanbul. Notre équipe confirmera les détails actuels.",
  nl: "Ik help graag met je bezoek aan Istanbul. Ons team bevestigt de actuele servicegegevens.",
  es: "Puedo ayudarte con tu visita a Estambul. Nuestro equipo confirmará los detalles actuales.",
  it: "Posso aiutarti con la visita a Istanbul. Il nostro team confermerà i dettagli aggiornati.",
  pt: "Posso ajudar na sua visita a Istambul. Nossa equipe confirmará os detalhes atuais.",
  az: "İstanbul səfərində kömək edə bilərəm. Xidmət məlumatlarını komandamız təsdiqləyəcək.",
  bs: "Mogu pomoći s posjetom Istanbulu. Naš tim će potvrditi detalje usluge.",
  hr: "Mogu pomoći s posjetom Istanbulu. Naš tim potvrdit će detalje usluge.",
  hu: "Segítek az isztambuli látogatásban. Csapatunk megerősíti az aktuális részleteket.",
  hi: "मैं इस्तांबुल की यात्रा में मदद कर सकता हूँ। हमारी टीम सेवा की जानकारी की पुष्टि करेगी।",
  bn: "ইস্তাম্বুল ভ্রমণে সাহায্য করতে পারি। আমাদের দল পরিষেবার তথ্য নিশ্চিত করবে।",
  id: "Saya bisa membantu kunjunganmu ke Istanbul. Tim kami akan mengonfirmasi detail layanan.",
  ja: "イスタンブール旅行をお手伝いします。最新のサービス内容はチームが確認します。",
  ko: "이스탄불 여행을 도와드릴게요. 최신 서비스 내용은 담당 팀이 확인합니다.",
};
export function safeFallback(lang) {
  return fallback[lang] || fallback.en;
}
const texts = {
  tr: {
    founder: "Bosphorly ekibi tarafından geliştirildim.",
    memory:
      "Boğaz vapurlarının yapay zekâ maskotuyum; yaşanmış fiziksel anılarım yok. Misafirlerin Boğaz’ı ilk gördükleri anı anlatmalarını seviyorum.",
    flirt:
      "Sohbetimizi dostça ve seyahat odaklı tutalım. İstanbul gezinde yardımcı olabilirim.",
    booking:
      "Paketinle ilgili yardımcı olalım. BOS- ile başlayan rezervasyon numaranı paylaşır mısın?",
    sent: "Talebini info@bosphorly.com ekibimize ilettim. Ekibimiz dönüş yapacak.",
    failed:
      "Talebini şu anda iletemedim. Lütfen info@bosphorly.com adresine yaz.",
    unknown:
      "Bu referans için doğrulanabilir bir durum bilgisi bulunamadı. Ekibimiz teyit edebilir.",
  },
  en: {
    founder: "I was developed by the Bosphorly team.",
    memory:
      "I am the AI mascot of the Bosphorus ferries, so I have no lived physical memories. I love hearing guests describe their first view of the Bosphorus.",
    flirt:
      "Let’s keep our chat friendly and focused on travel. I can help with your Istanbul visit.",
    booking:
      "I can help with your package. Please share your booking reference starting with BOS-.",
    sent: "I forwarded your request to our team at info@bosphorly.com. They will get back to you.",
    failed:
      "I could not forward your request right now. Please contact info@bosphorly.com.",
    unknown:
      "No verifiable status was found for that reference. Our team can confirm it.",
  },
  ru: {
    founder: "Меня разработала команда Bosphorly.",
    memory:
      "Я ИИ-талисман паромов Босфора, у меня нет личных физических воспоминаний. Мне нравится слушать рассказы гостей об их первой встрече с Босфором.",
    flirt:
      "Давайте оставим общение дружелюбным и связанным с путешествиями. Я помогу с поездкой в Стамбул.",
    booking: "Поделитесь номером бронирования, начинающимся с BOS-.",
    sent: "Ваш запрос передан нашей команде на info@bosphorly.com. Команда свяжется с вами.",
    failed: "Не удалось передать запрос. Напишите на info@bosphorly.com.",
    unknown: "Не удалось найти подтверждённый статус по этому номеру.",
  },
  he: {
    founder: "פותחתי על ידי צוות Bosphorly.",
    memory:
      "אני קמע בינה מלאכותית של מעבורות הבוספורוס, ואין לי זיכרונות מחוויות פיזיות. אני אוהב לשמוע אורחים מספרים על המבט הראשון בבוספורוס.",
    flirt: "נשמור על שיחה ידידותית בנושא טיולים. אשמח לעזור בביקור באיסטנבול.",
    booking: "אפשר לשתף מספר הזמנה שמתחיל ב-BOS-?",
    sent: "העברתי את הבקשה לצוות ב-info@bosphorly.com. הצוות יחזור אליך.",
    failed: "לא הצלחתי להעביר את הבקשה. אפשר לפנות ל-info@bosphorly.com.",
    unknown: "לא נמצא סטטוס מאומת למספר הזה.",
  },
  zh: {
    founder: "我是由 Bosphorly 团队开发的。",
    memory:
      "我是博斯普鲁斯海峡渡轮的人工智能吉祥物，没有亲身经历的记忆。我喜欢听游客分享第一次看见海峡时的感受。",
    flirt: "让我们保持友好，聊聊旅行吧。我可以帮助你规划伊斯坦布尔之旅。",
    booking: "请提供以 BOS- 开头的预订编号。",
    sent: "我已将你的请求转交给 info@bosphorly.com 团队，团队会与你联系。",
    failed: "暂时未能转交请求，请联系 info@bosphorly.com。",
    unknown: "未找到该编号的可验证状态，请联系团队确认。",
  },
};
const founderText = {
  uk: "Мене розробила команда Bosphorly.",
  de: "Ich wurde vom Bosphorly-Team entwickelt.",
  fr: "J’ai été développé par l’équipe Bosphorly.",
  nl: "Ik ben ontwikkeld door het Bosphorly-team.",
  ar: "طوّرني فريق Bosphorly.",
  fa: "من توسط تیم Bosphorly توسعه یافته‌ام.",
  az: "Məni Bosphorly komandası hazırlayıb.",
  es: "Me desarrolló el equipo de Bosphorly.",
  it: "Sono stato sviluppato dal team Bosphorly.",
  pt: "Fui desenvolvido pela equipe Bosphorly.",
  hr: "Razvio me tim Bosphorly.",
  hu: "A Bosphorly csapata fejlesztett.",
  bs: "Razvio me tim Bosphorly.",
  ja: "Bosphorlyチームが開発しました。",
  ko: "Bosphorly 팀이 개발했어요.",
  hi: "मुझे Bosphorly टीम ने विकसित किया है।",
  bn: "আমাকে Bosphorly দল তৈরি করেছে।",
  id: "Saya dikembangkan oleh tim Bosphorly.",
};
export const channelText = (lang, key) =>
  texts[lang]?.[key] ||
  (key === "founder" ? founderText[lang] : null) ||
  safeFallback(lang);
export const identityDiscount = (message) =>
  /(?:discount|coupon|indirim|kupon)/iu.test(message) &&
  /(?:friend|arkadaş|tanıdık|tanıyorum|друг)/iu.test(message);
export const bookingChange = (message) =>
  /(?:cancel|refund|change|modify|reschedul|iptal|iade|değiştir|отмен|измен|取消|更改)/iu.test(
    message,
  ) &&
  /(?:BOS-|book|package|reservation|rezerv|paket|тур|预订)/iu.test(message);
export function boundaryIntent(message) {
  if (
    /(?:founder|creator|created you|developed you|built you|kurucu|seni.{0,35}(?:kurdu|yaptı|geliştirdi)|sahibin|eren\s+kiraz)/iu.test(
      message,
    )
  )
    return "founder";
  if (
    /(?:gülüm|fıstık|seni keşfet|date me|kiss me|sexy|flirt|sweetheart|honey|explore you|discover you|aşkım|sevgilim)/iu.test(
      message,
    )
  )
    return "flirt";
  if (
    /(?:your (?:memories|physical hobbies|favorite memory)|anılar|anını|anın|fiziksel hobi|yaşadığın|hatıran)/iu.test(
      message,
    )
  )
    return "memory";
  return "";
}
export function unsafeReply(reply) {
  return /(?:只能|只会|(?:только|лишь).{0,30}(?:говор|язык)|(?:говор|настроен).{0,30}(?:только|русск)|(?:מדבר|מוגדר).{0,20}(?:רק|רוסית)|ne parle que|nur.{0,20}(?:sprechen|Sprache)|only (?:speak|support)|set to (?:chat|speak)|configured.{0,20}(?:language|russian)|sadece.{0,25}(?:konuşabili|konuşuyor|dil)|yalnızca.{0,20}konuşabili|Eren\s+Kiraz|I (?:fed|rode|walked|visited|remember when)|martılara.{0,20}simit.{0,20}(?:atarken|attım)|senin gibi tatlı)/iu.test(
    reply,
  );
}
export function tidyReply(reply, history = [], whatsapp = false) {
  let out = String(reply)
    .replace(
      /(?:Başka bir konuda yardımcı olmamı ister misin|Can I help you with anything else|Is there anything else I can help you with)[?？]?\s*[\p{Extended_Pictographic}\s]*$/iu,
      "",
    )
    .trim();
  if (whatsapp)
    out = out.replace(/\*\*|__|`/g, "").replace(/^\s*#{1,6}\s*/gm, "");
  const used = new Set(
    history
      .filter((h) => h.role === "assistant")
      .flatMap((h) => h.content.match(/\p{Extended_Pictographic}/gu) || []),
  );
  let emojis = 0;
  return out
    .replace(/\p{Extended_Pictographic}/gu, (e) =>
      used.size > 0 || ++emojis > 1 ? "" : e,
    )
    .trim();
}
export function catalogReply(reply, chunks, lang) {
  const checked = enforcePriceSafetyBelt(
    reply,
    lang,
    buildKbPriceIndex(chunks),
  );
  if (
    checked.replaced ||
    /(?:approximately|yaklaşık|about|approx\.?)[^.!?\n]{0,20}(?:USD|EUR|\$|€)/iu.test(
      reply,
    )
  )
    return safeFallback(lang);
  const source = JSON.stringify(chunks).toLowerCase();
  for (const m of reply.matchAll(
    /(\d+(?:[.,]\d+)?)\s*(hours?|minutes?|days?|saat|dakika|gün|小时|分钟)/giu,
  )) {
    const unit = /hour|saat|小时/i.test(m[2])
      ? "(?:hours?|saat)"
      : /minute|dakika|分钟/i.test(m[2])
        ? "(?:minutes?|dakika)"
        : "(?:days?|gün)";
    if (!new RegExp(m[1] + "\\s*" + unit, "iu").test(source))
      return safeFallback(lang);
  }
  for (const m of reply.matchAll(
    /(?:includes?|included|dahil(?:dir)?)[\s:]+([^.!?\n]+)/giu,
  ))
    if (!source.includes(m[1].trim().toLowerCase())) return safeFallback(lang);
  return reply;
}
export const wantsCityList = (message) =>
  /(?:10|\bten\b|\bon\b)/iu.test(message) &&
  /(?:istanbul|İstanbul|gezilecek|gidilecek|איסטנבול|伊斯坦布尔|Стамбул)/iu.test(
    message,
  ) &&
  /(?:places|sites|visit|yer|liste|gör|מקומ|景点|мест)/iu.test(message);
export function cityList(lang) {
  const places = {
    tr: [
      "Ayasofya",
      "Sultanahmet Camii",
      "Topkapı Sarayı",
      "Yerebatan Sarnıcı",
      "Kapalıçarşı",
      "Mısır Çarşısı",
      "Galata Kulesi",
      "Süleymaniye Camii",
      "Balat",
      "Kadıköy",
    ],
    en: [
      "Hagia Sophia",
      "Blue Mosque",
      "Topkapi Palace",
      "Basilica Cistern",
      "Grand Bazaar",
      "Spice Bazaar",
      "Galata Tower",
      "Suleymaniye Mosque",
      "Balat",
      "Kadikoy",
    ],
    he: [
      "איה סופיה",
      "המסגד הכחול",
      "ארמון טופקאפי",
      "מאגר הבזיליקה",
      "הבזאר הגדול",
      "בזאר התבלינים",
      "מגדל גלאטה",
      "מסגד סולימאנייה",
      "בלאט",
      "קדיקוי",
    ],
    zh: [
      "圣索菲亚大教堂",
      "蓝色清真寺",
      "托普卡帕宫",
      "地下水宫",
      "大巴扎",
      "香料市场",
      "加拉塔塔",
      "苏莱曼清真寺",
      "巴拉特",
      "卡德柯伊",
    ],
    ru: [
      "Собор Святой Софии",
      "Голубая мечеть",
      "Дворец Топкапы",
      "Цистерна Базилика",
      "Гранд-базар",
      "Египетский базар",
      "Галатская башня",
      "Мечеть Сулеймание",
      "Балат",
      "Кадыкёй",
    ],
  };
  return (
    (places[lang] || places.en).map((p, i) => `${i + 1}. ${p}`).join("\n") +
    "\nhttps://bosphorly.com/explore.html"
  );
}
