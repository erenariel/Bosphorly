// Renders the shared header into <div id="siteHeader" data-page="..."></div>.
// Needs lang.js first. currency.js and lang.js fill the two menus.
(() => {
  const host = document.getElementById('siteHeader');
  if (!host) return;
  const lang = window.BOSPHORLY_LANG_ALT ? (document.documentElement.lang || 'en').slice(0, 2)
    : window.BosphorlyLang ? window.BosphorlyLang.pick() : 'en';
  const L = {
    transfer: { en: "Transfer", tr: "Transfer", ru: "Трансфер", uk: "Трансфер", de: "Transfer", fr: "Transfert", nl: "Transfer", ar: "النقل", he: "הסעות", az: "Transfer", fa: "ترانسفر", es: "Traslado", it: "Transfer", pt: "Traslado", hr: "Transfer", hu: "Transzfer", bs: "Transfer", zh: "接送", ja: "空港送迎", ko: "공항 픽업", hi: "ट्रांसफ़र", bn: "ট্রান্সফার", id: "Transfer" },
    tours: { en: "Special tours", tr: "Özel turlar", ru: "Особые туры", uk: "Особливі тури", de: "Besondere Touren", fr: "Visites spéciales", nl: "Speciale tours", ar: "جولات خاصة", he: "סיורים מיוחדים", az: "Xüsusi turlar", fa: "تورهای ویژه", es: "Tours especiales", it: "Tour speciali", pt: "Passeios especiais", hr: "Posebne ture", hu: "Különleges túrák", bs: "Posebne ture", zh: "特色游览", ja: "特別ツアー", ko: "특별 투어", hi: "ख़ास टूर", bn: "বিশেষ ট্যুর", id: "Tur spesial" },
    home: { en: 'Home', tr: 'Ana sayfa', ru: 'Главная', uk: 'Головна', de: 'Startseite', fr: 'Accueil', nl: 'Home', ar: 'الرئيسية', he: 'דף הבית', az: 'Ana səhifə', fa: 'خانه', es: 'Inicio', it: "Home", pt: "Início", hr: "Početna", hu: "Főoldal", bs: "Početna", zh: "首页", ja: "ホーム", ko: "홈", hi: "होम", bn: "হোম", id: "Beranda" },
    discover: { en: 'Discover', tr: 'Keşfet', ru: 'Что посмотреть', uk: 'Що подивитися', de: 'Entdecken', fr: 'Découvrir', nl: 'Ontdekken', ar: 'اكتشف', he: 'לגלות', az: 'Kəşf et', fa: 'کشف کنید', es: 'Descubrir', it: 'Scopri', pt: 'Descobrir', hr: "Otkrijte", hu: "Felfedezés", bs: "Otkrijte", zh: "发现", ja: "見どころ", ko: "명소", hi: "घूमने की जगहें", bn: "দর্শনীয় স্থান", id: "Jelajahi" },
    search: { en: 'Search', tr: 'Ara', ru: 'Поиск', uk: 'Пошук', de: 'Suche', fr: 'Rechercher', nl: 'Zoeken', ar: 'بحث', he: 'חיפוש', az: 'Axtar', fa: 'جست‌وجو', es: 'Buscar', it: 'Cerca', pt: 'Buscar', hr: "Traži", hu: "Keresés", bs: "Traži", zh: "搜索", ja: "検索", ko: "검색", hi: "खोजें", bn: "খুঁজুন", id: "Cari" },
    prices: { en: 'Compare tours', tr: 'Tur karşılaştır', ru: 'Сравнить туры', uk: 'Порівняти тури', de: 'Touren vergleichen', fr: 'Comparer les visites', nl: 'Tours vergelijken', ar: 'قارن الجولات', he: 'השוואת סיורים', az: 'Turları müqayisə et', fa: 'مقایسه تورها', es: 'Comparar tours', it: "Confronta i tour", pt: "Comparar passeios", hr: "Usporedite ture", hu: "Túrák összehasonlítása", bs: "Uporedite ture", zh: "比较游览", ja: "ツアー比較", ko: "투어 비교", hi: "टूर तुलना", bn: "ট্যুর তুলনা", id: "Bandingkan tur" },
    map: { en: 'City map', tr: 'Şehir haritası', ru: 'Карта города', uk: 'Мапа міста', de: 'Stadtplan', fr: 'Plan de la ville', nl: 'Stadskaart', ar: 'خريطة المدينة', he: 'מפת העיר', az: 'Şəhər xəritəsi', fa: 'نقشه شهر', es: 'Mapa de la ciudad', it: "Mappa della città", pt: "Mapa da cidade", hr: "Karta grada", hu: "Várostérkép", bs: "Karta grada", zh: "城市地图", ja: "市内地図", ko: "시내 지도", hi: "शहर का नक्शा", bn: "শহরের মানচিত্র", id: "Peta kota" },
    account: { en: 'My account', tr: 'Hesabım', ru: 'Мой аккаунт', uk: 'Мій акаунт', de: 'Mein Konto', fr: 'Mon compte', nl: 'Mijn account', ar: 'حسابي', he: 'החשבון שלי', az: 'Hesabım', fa: 'حساب من', es: 'Mi cuenta', it: "Il mio account", pt: "Minha conta", hr: "Moj račun", hu: "Fiókom", bs: "Moj račun", zh: "我的账户", ja: "マイアカウント", ko: "내 계정", hi: "मेरा खाता", bn: "আমার অ্যাকাউন্ট", id: "Akun saya" }
  };
  const page = host.dataset.page || '';
  const base = host.dataset.base || ''; // '../' on pages inside a sub-folder
  const withCurrency = host.dataset.currency !== 'off';
  const links = [['home', 'index.html'], ['transfer', 'index.html#booking'], ['prices', 'prices.html'], ['tours', 'tours.html'], ['discover', 'explore.html'], ['account', 'account.html']];
  const header = document.createElement('header');
  header.className = 'site-header';
  header.innerHTML = '<div class="sh-inner"><a class="sh-brand" aria-label="Bosphorly" href="' + base + 'index.html"><img src="' + base + 'assets/brand/approved-icon.webp" alt=""><span>Bosphorly<small>ISTANBUL · MADE SIMPLE</small></span></a>' +
    '<nav class="sh-nav" aria-label="Main navigation"></nav><div class="sh-tools"><a class="sh-search" href="' + base + 'search.html" aria-label="' + (L.search[lang] || L.search.en) + '" title="' + (L.search[lang] || L.search.en) + '"' + (page === 'search' ? ' aria-current="page"' : '') + '><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2.4" fill="none"/><path d="M16.5 16.5L21 21" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></a><span data-lang-mount></span>' + (withCurrency ? '<span data-currency-mount></span>' : '') + '</div></div>';
  const nav = header.querySelector('nav');
  for (const [key, href] of links) {
    const a = document.createElement('a');
    a.href = base + href; a.textContent = L[key][lang] || L[key].en;
    if (key === page) a.setAttribute('aria-current', 'page');
    nav.append(a);
  }
  host.replaceWith(header);
})();
