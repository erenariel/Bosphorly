// Shared language choice for all pages: ?lang= in the URL, then the visitor's saved choice,
// then the device/browser languages, then English. Pages fall back to English for any
// language they do not translate yet.
(() => {
  const supported = ['tr', 'en', 'ru', 'uk', 'de', 'fr', 'nl', 'ar', 'he', 'az', 'fa', 'es', 'it', 'pt', 'hr', 'hu', 'bs', 'zh', 'ja', 'ko', 'hi', 'bn', 'id'];
  function pick() {
    const fromUrl = new URLSearchParams(location.search).get('lang');
    if (fromUrl && supported.includes(fromUrl)) return fromUrl;
    let saved = null;
    try { saved = localStorage.getItem('bosphorly.language'); } catch {}
    if (saved && supported.includes(saved)) return saved;
    for (const loc of [...(navigator.languages || []), navigator.language].filter(Boolean)) {
      let short = loc.toLowerCase().split('-')[0];
      if (short === 'in') short = 'id'; // older Android reports Indonesian as "in"
      if (supported.includes(short)) return short;
    }
    return 'en';
  }
  const NAMES = { tr: 'Türkçe', en: 'English', ru: 'Русский', uk: 'Українська', de: 'Deutsch', fr: 'Français', nl: 'Nederlands', ar: 'العربية', he: 'עברית', az: 'Azərbaycanca', fa: 'فارسی', es: 'Español', it: "Italiano", pt: "Português", hr: "Hrvatski", hu: "Magyar", bs: "Bosanski", zh: "中文", ja: "日本語", ko: "한국어", hi: "हिन्दी", bn: "বাংলা", id: "Bahasa Indonesia" };
  // A language menu for pages other than the home page: saves the choice and reopens the page in it.
  function mount() {
    document.querySelectorAll('[data-lang-mount]').forEach(el => {
      if (el.querySelector('select')) return;
      const s = document.createElement('select');
      s.className = 'lang-select';
      s.setAttribute('aria-label', 'Language');
      for (const code of supported) { const o = document.createElement('option'); o.value = code; o.textContent = NAMES[code]; s.append(o); }
      // Articles that exist in one language show that language, not the visitor's saved choice.
      s.value = window.BOSPHORLY_LANG_ALT ? (document.documentElement.lang || 'en').slice(0, 2) : pick();
      s.addEventListener('change', () => {
        try { localStorage.setItem('bosphorly.language', s.value); } catch {}
        const alt = window.BOSPHORLY_LANG_ALT; // e.g. guide articles that exist only in TR and EN
        if (alt) { location.href = alt[s.value] || alt.en; return; }
        const u = new URL(location.href); u.searchParams.set('lang', s.value); location.href = u.toString();
      });
      el.append(s);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
  window.BosphorlyLang = Object.freeze({ supported, pick, rtl: l => ['ar', 'he', 'fa'].includes(l) });
})();
