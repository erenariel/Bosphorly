// Bosphorly's public social channels (corporate WhatsApp Business and Instagram).
// Booking requests still go by email; these links are for quick questions only.
// Only this WhatsApp number may be published; the old line stays retired.
(() => {
  const scriptBase = document.currentScript && document.currentScript.src ? new URL('.', document.currentScript.src).href : '';
  const WHATSAPP_NUMBER = '16197386408';
  const WHATSAPP_DISPLAY = '+1 (619) 738-6408';
  const INSTAGRAM_HANDLE = 'bosphorly';
  const SUPPORTED = ['tr', 'en', 'ru', 'uk', 'de', 'fr', 'nl', 'ar', 'he', 'az', 'fa', 'es', 'it', 'pt', 'hr', 'hu', 'bs', 'zh', 'ja', 'ko', 'hi', 'bn', 'id'];
  const ASK_WA = {
    tr: "WhatsApp'ta sor",
    en: 'Ask on WhatsApp',
    ru: 'Спросить в WhatsApp',
    uk: 'Запитати у WhatsApp',
    de: 'Auf WhatsApp fragen',
    fr: 'Demander sur WhatsApp',
    nl: 'Vraag op WhatsApp',
    ar: 'اسأل على واتساب',
    he: 'שאלו בוואטסאפ',
    az: 'WhatsApp-da soruş',
    fa: 'در واتساپ بپرسید',
    es: 'Preguntar en WhatsApp',
    it: 'Chiedi su WhatsApp',
    pt: 'Perguntar no WhatsApp',
    hr: 'Pitajte na WhatsAppu',
    hu: 'Kérdezzen WhatsAppon',
    bs: 'Pitajte na WhatsAppu',
    zh: '在 WhatsApp 咨询',
    ja: 'WhatsAppで質問',
    ko: 'WhatsApp으로 문의',
    hi: 'WhatsApp पर पूछें',
    bn: 'WhatsApp-এ জিজ্ঞাসা করুন',
    id: 'Tanya di WhatsApp',
  };
  const CHANNELS = Object.freeze([
    Object.freeze({ id: 'whatsapp', label: 'WhatsApp', href: 'https://wa.me/' + WHATSAPP_NUMBER, icon: 'assets/brand/whatsapp.svg', aria: 'WhatsApp ' + WHATSAPP_DISPLAY }),
    Object.freeze({ id: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/' + INSTAGRAM_HANDLE + '/', icon: 'assets/brand/instagram.svg', aria: 'Instagram @' + INSTAGRAM_HANDLE }),
  ]);

  function normalizeLang(lang) {
    if (typeof lang !== 'string' || !lang.trim()) return 'en';
    let code = lang.trim().toLowerCase().split(/[-_]/)[0];
    if (code === 'in') code = 'id';
    return SUPPORTED.includes(code) ? code : 'en';
  }

  function askText(lang) {
    return ASK_WA[normalizeLang(lang)] || ASK_WA.en;
  }

  function currentLang() {
    if (document.documentElement && document.documentElement.lang) return normalizeLang(document.documentElement.lang);
    if (window.BosphorlyLang && window.BosphorlyLang.pick) return normalizeLang(window.BosphorlyLang.pick());
    return 'en';
  }

  function createLink(channel, base, opts) {
    const options = opts && typeof opts === 'object' ? opts : {};
    const a = document.createElement('a');
    a.className = 'social-btn social-' + channel.id + (options.className ? ' ' + options.className : '');
    a.dataset.channelItem = channel.id;
    a.href = channel.href;
    a.target = '_blank';
    a.rel = 'noopener';
    a.setAttribute('aria-label', channel.aria);
    a.title = channel.aria;
    const img = document.createElement('img');
    img.className = 'social-ico';
    img.src = (base || scriptBase) + channel.icon;
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    img.width = 18;
    img.height = 18;
    img.decoding = 'async';
    const label = document.createElement('span');
    label.textContent = options.label || channel.label;
    a.append(img, label);
    return a;
  }

  function mountHero() {
    const host = document.querySelector('.hero .hero-links-chat') || document.querySelector('.hero .hero-links');
    if (!host) return;
    let wa = host.querySelector('.social-hero');
    if (!wa) {
      wa = createLink(CHANNELS[0], '', { className: 'social-hero', label: askText(currentLang()) });
      host.append(wa);
    }
    syncHero();
  }

  function syncHero(lang) {
    const wa = document.querySelector('.hero .social-hero');
    if (!wa) return;
    const span = wa.querySelector('span');
    if (span) span.textContent = askText(lang || currentLang());
  }

  function mountFooter() {
    const footer = document.querySelector('footer.footer, body > footer, main > footer');
    if (!footer || footer.querySelector('.social-links')) return;
    const wrap = document.createElement('span');
    wrap.className = 'social-links';
    for (const channel of CHANNELS) wrap.append(createLink(channel));
    const channelsHost = footer.querySelector('.footer-channels');
    if (channelsHost) {
      channelsHost.append(wrap);
      return;
    }
    const tgFoot = footer.querySelector('a.tg-foot');
    const mail = footer.querySelector('a.mail-link') || footer.querySelector('a.privacy-link');
    if (tgFoot) tgFoot.after(wrap);
    else if (mail) mail.after(' ', wrap);
    else footer.append(wrap);
  }

  function init() {
    mountHero();
    mountFooter();
  }

  window.BosphorlySocial = Object.freeze({ CHANNELS, WHATSAPP_NUMBER, INSTAGRAM_HANDLE, ASK_WA, askText, createLink, syncHero });
  document.addEventListener('bosphorly:lang', () => syncHero());
  if (typeof MutationObserver === 'function' && document.documentElement) {
    new MutationObserver(() => syncHero()).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }
  if (document.readyState === 'complete') init();
  else {
    if (document.readyState === 'interactive') mountHero();
    document.addEventListener('DOMContentLoaded', init);
  }
})();
