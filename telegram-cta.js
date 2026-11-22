(() => {
  const scriptBase = document.currentScript && document.currentScript.src ? new URL('.', document.currentScript.src).href : '';
  const SUPPORTED = ['tr', 'en', 'ru', 'uk', 'de', 'fr', 'nl', 'ar', 'he', 'az', 'fa', 'es', 'it', 'pt', 'hr', 'hu', 'bs', 'zh', 'ja', 'ko', 'hi', 'bn', 'id'];
  const TEXT = {
    ask: {
      tr: "Telegram'da sor",
      en: 'Ask on Telegram',
      ru: 'Спросить в Telegram',
      uk: 'Запитати в Telegram',
      de: 'Auf Telegram fragen',
      fr: 'Demander sur Telegram',
      nl: 'Vraag op Telegram',
      ar: 'اسأل على تيليجرام',
      he: 'שאלו בטלגרם',
      az: 'Telegram-da soruş',
      fa: 'در تلگرام بپرسید',
      es: 'Preguntar en Telegram',
      it: 'Chiedi su Telegram',
      pt: 'Perguntar no Telegram',
      hr: 'Pitajte na Telegramu',
      hu: 'Kérdezzen Telegramon',
      bs: 'Pitajte na Telegramu',
      zh: '在 Telegram 咨询',
      ja: 'Telegramで質問',
      ko: 'Telegram으로 문의',
      hi: 'Telegram पर पूछें',
      bn: 'Telegram-এ জিজ্ঞাসা করুন',
      id: 'Tanya di Telegram',
    },
    continueChat: {
      tr: "Telegram'dan devam et",
      en: 'Continue on Telegram',
      ru: 'Продолжить в Telegram',
      uk: 'Продовжити в Telegram',
      de: 'Auf Telegram fortsetzen',
      fr: 'Continuer sur Telegram',
      nl: 'Ga verder op Telegram',
      ar: 'تابع على تيليجرام',
      he: 'המשיכו בטלגרם',
      az: 'Telegram-da davam et',
      fa: 'در تلگرام ادامه دهید',
      es: 'Continuar en Telegram',
      it: 'Continua su Telegram',
      pt: 'Continuar no Telegram',
      hr: 'Nastavite na Telegramu',
      hu: 'Folytatás Telegramon',
      bs: 'Nastavite na Telegramu',
      zh: '在 Telegram 继续对话',
      ja: 'Telegramで続ける',
      ko: 'Telegram에서 계속하기',
      hi: 'Telegram पर जारी रखें',
      bn: 'Telegram-এ চালিয়ে যান',
      id: 'Lanjutkan di Telegram',
    },
    afterSubmit: {
      tr: "Sorun olursa Telegram'dan yaz",
      en: 'If anything comes up, message us on Telegram',
      ru: 'Если возникнут вопросы, напишите нам в Telegram',
      uk: 'Якщо виникнуть питання, напишіть нам у Telegram',
      de: 'Bei Fragen schreiben Sie uns auf Telegram',
      fr: 'En cas de besoin, écrivez-nous sur Telegram',
      nl: 'Stuur ons bij vragen een bericht op Telegram',
      ar: 'إذا واجهتك أي مشكلة، راسلنا على تيليجرام',
      he: 'אם יש בעיה או שאלה, כתבו לנו בטלגרם',
      az: 'Problem olarsa Telegram-dan yazın',
      fa: 'در صورت بروز هرگونه سوال، در تلگرام به ما پیام دهید',
      es: 'Si surge cualquier problema, escríbenos por Telegram',
      it: 'Per qualsiasi problema, scrivici su Telegram',
      pt: 'Se precisar de ajuda, fale conosco no Telegram',
      hr: 'Ako zatreba pomoć, javite nam se na Telegramu',
      hu: 'Ha bármi kérdése van, írjon nekünk Telegramon',
      bs: 'Ako zatreba pomoć, javite nam se na Telegramu',
      zh: '如有任何问题，请在 Telegram 联系我们',
      ja: 'お困りの際はTelegramでお問い合わせください',
      ko: '문제가 있으면 Telegram으로 연락해 주세요',
      hi: 'कोई समस्या हो तो Telegram पर लिखें',
      bn: 'কোনো সমস্যা হলে Telegram-এ লিখুন',
      id: 'Jika ada kendala, hubungi kami di Telegram',
    },
  };

  function normalizeLang(lang) {
    if (typeof lang !== 'string' || !lang.trim()) return 'en';
    let code = lang.trim().toLowerCase().split(/[-_]/)[0];
    if (code === 'in') code = 'id';
    return SUPPORTED.includes(code) ? code : 'en';
  }

  function botName() {
    const raw = window.BOSPHORLY_API && window.BOSPHORLY_API.telegramBot;
    if (typeof raw !== 'string') return '';
    return raw.trim().replace(/^@+/, '');
  }

  function url(lang) {
    const bot = botName();
    if (!bot) return '';
    return 'https://t.me/' + encodeURIComponent(bot) + '?start=' + encodeURIComponent(normalizeLang(lang));
  }

  function text(key, lang) {
    const dict = TEXT[key] || TEXT.ask;
    const code = normalizeLang(lang);
    return dict[code] || dict.en;
  }

  function iconSrc(base) {
    const b = typeof base === 'string' && base ? base : scriptBase;
    return b + 'assets/brand/telegram.svg';
  }

  function fillLink(el, { key = 'ask', lang, base = '' } = {}) {
    const href = url(lang);
    if (!href) {
      el.hidden = true;
      el.removeAttribute('href');
      return false;
    }
    el.href = href;
    el.target = '_blank';
    el.rel = 'noopener';
    let img = el.querySelector('img.tg-ico');
    if (!img) {
      img = document.createElement('img');
      img.className = 'tg-ico';
      img.alt = '';
      img.setAttribute('aria-hidden', 'true');
      img.width = 18;
      img.height = 18;
      img.loading = 'lazy';
      img.decoding = 'async';
    }
    img.src = iconSrc(base);
    let label = el.querySelector('span');
    if (!label) {
      label = document.createElement('span');
    }
    label.textContent = text(key, lang);
    el.replaceChildren(img, label);
    el.hidden = false;
    return true;
  }

  function createLink({ key = 'ask', lang, base = '', className = '' } = {}) {
    if (!url(lang)) return null;
    const a = document.createElement('a');
    a.className = className ? 'tg-btn ' + className : 'tg-btn';
    fillLink(a, { key, lang, base });
    return a;
  }

  window.BosphorlyTelegram = Object.freeze({
    SUPPORTED,
    TEXT,
    normalizeLang,
    botName,
    url,
    text,
    fillLink,
    createLink,
  });
})();
