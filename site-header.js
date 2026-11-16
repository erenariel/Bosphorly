// Renders the shared header into <div id="siteHeader" data-page="..."></div>.
// Needs lang.js first. currency.js and lang.js fill the two menus.
(() => {
  const host = document.getElementById('siteHeader');
  if (!host) return;
  const lang = window.BOSPHORLY_LANG_ALT ? (document.documentElement.lang || 'en').slice(0, 2)
    : window.BosphorlyLang ? window.BosphorlyLang.pick() : 'en';
  const L = {
    home: { en: 'Home', tr: 'Ana sayfa', ru: 'Главная', uk: 'Головна', de: 'Startseite', fr: 'Accueil', nl: 'Home', ar: 'الرئيسية', he: 'דף הבית', az: 'Ana səhifə', fa: 'خانه', es: 'Inicio', it: "Home", pt: "Início" },
    prices: { en: 'Compare tours', tr: 'Tur karşılaştır', ru: 'Сравнить туры', uk: 'Порівняти тури', de: 'Touren vergleichen', fr: 'Comparer les visites', nl: 'Tours vergelijken', ar: 'قارن الجولات', he: 'השוואת סיורים', az: 'Turları müqayisə et', fa: 'مقایسه تورها', es: 'Comparar tours', it: "Confronta i tour", pt: "Comparar passeios" },
    map: { en: 'City map', tr: 'Şehir haritası', ru: 'Карта города', uk: 'Мапа міста', de: 'Stadtplan', fr: 'Plan de la ville', nl: 'Stadskaart', ar: 'خريطة المدينة', he: 'מפת העיר', az: 'Şəhər xəritəsi', fa: 'نقشه شهر', es: 'Mapa de la ciudad', it: "Mappa della città", pt: "Mapa da cidade" },
    account: { en: 'My account', tr: 'Hesabım', ru: 'Мой аккаунт', uk: 'Мій акаунт', de: 'Mein Konto', fr: 'Mon compte', nl: 'Mijn account', ar: 'حسابي', he: 'החשבון שלי', az: 'Hesabım', fa: 'حساب من', es: 'Mi cuenta', it: "Il mio account", pt: "Minha conta" }
  };
  const page = host.dataset.page || '';
  const base = host.dataset.base || ''; // '../' on pages inside a sub-folder
  const withCurrency = host.dataset.currency !== 'off';
  const links = [['home', 'index.html'], ['prices', 'prices.html'], ['map', 'map.html'], ['account', 'account.html']];
  const header = document.createElement('header');
  header.className = 'site-header';
  header.innerHTML = '<div class="sh-inner"><a class="sh-brand" href="' + base + 'index.html"><img src="' + base + 'assets/brand/approved-icon.webp" alt=""><span>Bosphorly<small>ISTANBUL · MADE SIMPLE</small></span></a>' +
    '<nav class="sh-nav" aria-label="Main navigation"></nav><div class="sh-tools"><span data-lang-mount></span>' + (withCurrency ? '<span data-currency-mount></span>' : '') + '</div></div>';
  const nav = header.querySelector('nav');
  for (const [key, href] of links) {
    const a = document.createElement('a');
    a.href = base + href; a.textContent = L[key][lang] || L[key].en;
    if (key === page) a.setAttribute('aria-current', 'page');
    nav.append(a);
  }
  host.replaceWith(header);
})();
