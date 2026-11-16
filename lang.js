// Shared language choice for all pages: ?lang= in the URL, then the visitor's saved choice,
// then the device/browser languages, then English. Pages fall back to English for any
// language they do not translate yet.
(() => {
  const supported = ['tr', 'en', 'ru', 'uk', 'de', 'fr', 'nl', 'ar', 'he', 'az', 'fa', 'es'];
  function pick() {
    const fromUrl = new URLSearchParams(location.search).get('lang');
    if (fromUrl && supported.includes(fromUrl)) return fromUrl;
    let saved = null;
    try { saved = localStorage.getItem('bosphorly.language'); } catch {}
    if (saved && supported.includes(saved)) return saved;
    for (const loc of [...(navigator.languages || []), navigator.language].filter(Boolean)) {
      const short = loc.toLowerCase().split('-')[0];
      if (supported.includes(short)) return short;
    }
    return 'en';
  }
  window.BosphorlyLang = Object.freeze({ supported, pick, rtl: l => ['ar', 'he', 'fa'].includes(l) });
})();
