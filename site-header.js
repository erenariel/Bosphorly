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
    faq: {"tr": "SSS", "en": "FAQ", "ru": "Вопросы", "uk": "Питання", "de": "FAQ", "fr": "FAQ", "nl": "FAQ", "ar": "الأسئلة الشائعة", "he": "שאלות נפוצות", "az": "Suallar", "fa": "پرسش‌ها", "es": "Preguntas", "it": "FAQ", "pt": "Perguntas", "hr": "Pitanja", "hu": "GYIK", "bs": "Pitanja", "zh": "常见问题", "ja": "よくある質問", "ko": "자주 묻는 질문", "hi": "सवाल-जवाब", "bn": "প্রশ্নোত্তর", "id": "Tanya jawab"},
    account: { en: 'My account', tr: 'Hesabım', ru: 'Мой аккаунт', uk: 'Мій акаунт', de: 'Mein Konto', fr: 'Mon compte', nl: 'Mijn account', ar: 'حسابي', he: 'החשבון שלי', az: 'Hesabım', fa: 'حساب من', es: 'Mi cuenta', it: "Il mio account", pt: "Minha conta", hr: "Moj račun", hu: "Fiókom", bs: "Moj račun", zh: "我的账户", ja: "マイアカウント", ko: "내 계정", hi: "मेरा खाता", bn: "আমার অ্যাকাউন্ট", id: "Akun saya" },
    signin: { en: 'Sign in', tr: 'Giriş yap', ru: 'Войти', uk: 'Увійти', de: 'Anmelden', fr: 'Connexion', nl: 'Inloggen', ar: 'تسجيل الدخول', he: 'התחברות', az: 'Daxil ol', fa: 'ورود', es: 'Iniciar sesión', it: 'Accedi', pt: 'Entrar', hr: 'Prijava', hu: 'Belépés', bs: 'Prijava', zh: '登录', ja: 'ログイン', ko: '로그인', hi: 'साइन इन', bn: 'সাইন ইন', id: 'Masuk' },
    signup: { en: 'Create account', tr: 'Hesap oluştur', ru: 'Создать аккаунт', uk: 'Створити акаунт', de: 'Konto erstellen', fr: 'Créer un compte', nl: 'Account aanmaken', ar: 'إنشاء حساب', he: 'יצירת חשבון', az: 'Hesab yarat', fa: 'ایجاد حساب', es: 'Crear cuenta', it: 'Crea account', pt: 'Criar conta', hr: 'Izradi račun', hu: 'Fiók létrehozása', bs: 'Kreiraj račun', zh: '创建账户', ja: 'アカウント作成', ko: '계정 만들기', hi: 'खाता बनाएँ', bn: 'অ্যাকাউন্ট খুলুন', id: 'Buat akun' },
    signout: { en: 'Sign out', tr: 'Çıkış', ru: 'Выйти', uk: 'Вийти', de: 'Abmelden', fr: 'Déconnexion', nl: 'Uitloggen', ar: 'خروج', he: 'יציאה', az: 'Çıxış', fa: 'خروج', es: 'Salir', it: 'Esci', pt: 'Sair', hr: 'Odjava', hu: 'Kilépés', bs: 'Odjava', zh: '退出', ja: 'ログアウト', ko: '로그아웃', hi: 'साइन आउट', bn: 'সাইন আউট', id: 'Keluar' },
    coupons: { en: 'coupons', tr: 'kupon', ru: 'купон.', uk: 'купон.', de: 'Gutscheine', fr: 'coupons', nl: 'coupons', ar: 'قسائم', he: 'קופונים', az: 'kupon', fa: 'کوپن', es: 'cupones', it: 'coupon', pt: 'cupons', hr: 'kupona', hu: 'kupon', bs: 'kupona', zh: '优惠券', ja: 'クーポン', ko: '쿠폰', hi: 'कूपन', bn: 'কুপন', id: 'kupon' },
    perk: { en: '🎁 Free membership · 5% welcome coupon', tr: '🎁 Ücretsiz üyelik · %5 hoş geldin kuponu', ru: '🎁 Бесплатно · купон −5% при регистрации', uk: '🎁 Безкоштовно · купон −5% за реєстрацію', de: '🎁 Kostenlos · 5 % Willkommensgutschein', fr: '🎁 Gratuit · coupon de bienvenue −5 %', nl: '🎁 Gratis · 5% welkomstcoupon', ar: '🎁 عضوية مجانية · قسيمة ترحيب 5%', he: '🎁 חברות חינם · קופון 5% מתנה', az: '🎁 Pulsuz üzvlük · 5% xoş gəldin kuponu', fa: '🎁 عضویت رایگان · ۵٪ کوپن خوش‌آمد', es: '🎁 Gratis · cupón de bienvenida del 5 %', it: '🎁 Gratis · coupon di benvenuto del 5%', pt: '🎁 Grátis · cupom de boas-vindas de 5%', hr: '🎁 Besplatno · 5% kupon dobrodošlice', hu: '🎁 Ingyenes · 5% üdvözlő kupon', bs: '🎁 Besplatno · 5% kupon dobrodošlice', zh: '🎁 免费注册 · 享 95 折迎新优惠券', ja: '🎁 無料会員登録 · 5%OFFウェルカムクーポン', ko: '🎁 무료 회원가입 · 5% 웰컴 쿠폰', hi: '🎁 मुफ़्त सदस्यता · 5% वेलकम कूपन', bn: '🎁 বিনামূল্যে সদস্যপদ · ৫% স্বাগত কুপন', id: '🎁 Gratis · kupon selamat datang 5%' }
  };
  const TIERS = {
    silver: ['🥈', 'Silver'],
    gold: ['🥇', 'Gold'],
    platinum: ['💎', 'Platinum']
  };
  const page = host.dataset.page || '';
  const base = host.dataset.base || ''; // '../' on pages inside a sub-folder
  const withCurrency = host.dataset.currency !== 'off';
  const links = [['home', 'index.html'], ['transfer', 'index.html#booking'], ['prices', 'prices.html'], ['tours', 'tours.html'], ['discover', 'explore.html'], ['faq', 'faq.html'], ['account', 'account.html']];
  const header = document.createElement('header');
  header.className = 'site-header';
  header.innerHTML = '<div class="sh-inner"><a class="sh-brand" aria-label="Bosphorly" href="' + base + 'index.html"><img src="' + base + 'assets/brand/approved-icon.webp" alt="Bosphorly logo" width="38" height="38" loading="lazy" decoding="async"><span>Bosphorly<small>ISTANBUL · MADE SIMPLE</small></span></a>' +
    '<nav class="sh-nav" aria-label="Main navigation"></nav><div class="sh-tools"><a class="sh-search" href="' + base + 'search.html" aria-label="' + (L.search[lang] || L.search.en) + '" title="' + (L.search[lang] || L.search.en) + '"' + (page === 'search' ? ' aria-current="page"' : '') + '><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2.4" fill="none"/><path d="M16.5 16.5L21 21" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></a><span data-lang-mount></span>' + (withCurrency ? '<span data-currency-mount></span>' : '') + '</div>' +
    '<div class="sh-auth" hidden><span class="sh-auth-perk">' + (L.perk[lang] || L.perk.en) + '</span><a class="sh-auth-btn in" href="' + base + 'account.html">👤 ' + (L.signin[lang] || L.signin.en) + '</a><a class="sh-auth-btn up" href="' + base + 'account.html#signup">🎁 ' + (L.signup[lang] || L.signup.en) + '</a></div>' +
    '<div class="sh-member" hidden><a class="sh-member-pill" href="' + base + 'account.html"><span class="sh-member-name"></span><span class="sh-member-tier" data-tier="silver"></span><span class="sh-member-coupons" hidden></span></a><button class="sh-member-out" type="button">' + (L.signout[lang] || L.signout.en) + '</button></div></div>';
  const nav = header.querySelector('nav');
  for (const [key, href] of links) {
    const a = document.createElement('a');
    a.href = base + href; a.textContent = L[key][lang] || L[key].en;
    if (key === page) a.setAttribute('aria-current', 'page');
    nav.append(a);
  }
  const authBar = header.querySelector('.sh-auth');
  const memberBar = header.querySelector('.sh-member');
  const nameEl = memberBar.querySelector('.sh-member-name');
  const tierEl = memberBar.querySelector('.sh-member-tier');
  const couponsEl = memberBar.querySelector('.sh-member-coupons');
  const outBtn = memberBar.querySelector('.sh-member-out');

  const readCache = () => {
    try { const raw = localStorage.getItem('bosphorly.member_cache'); return raw ? JSON.parse(raw) : null; } catch { return null; }
  };
  const syncMemberBar = () => {
    const apiLive = !!(window.BOSPHORLY_API && window.BOSPHORLY_API.base);
    let session = null;
    try { session = localStorage.getItem('bosphorly.session'); } catch {}
    if (!session && location.hash && location.hash.includes('oauth_token=')) {
      const ot = new URLSearchParams(location.hash.replace(/^#/, '')).get('oauth_token');
      if (ot) session = ot;
    }
    const M = window.BosphorlyMember;
    const signedIn = M ? M.signedIn() : !!(apiLive && session);
    if (signedIn) {
      authBar.hidden = true;
      memberBar.hidden = false;
      const prof = (M && M.cachedProfile()) || readCache();
      const localAcct = window.BosphorlyAccount && window.BosphorlyAccount.profile();
      const displayName = (prof && (prof.name || prof.email)) || (localAcct && (localAcct.name || localAcct.email)) || (L.account[lang] || L.account.en);
      nameEl.textContent = '👤 ' + displayName;
      const tKey = (prof && TIERS[prof.tier]) ? prof.tier : 'silver';
      const [icon, tName] = TIERS[tKey];
      tierEl.dataset.tier = tKey;
      tierEl.textContent = icon + ' ' + tName;
      const count = prof && typeof prof.usableCouponCount === 'number' ? prof.usableCouponCount : 0;
      if (count > 0) {
        couponsEl.textContent = '🎟️ ' + count + ' ' + (L.coupons[lang] || L.coupons.en);
        couponsEl.hidden = false;
      } else {
        couponsEl.hidden = true;
      }
    } else {
      memberBar.hidden = true;
      authBar.hidden = !(apiLive && page !== 'account');
    }
  };

  outBtn.addEventListener('click', async () => {
    if (window.BosphorlyMember) {
      await window.BosphorlyMember.signOut();
    } else {
      try { localStorage.removeItem('bosphorly.session'); localStorage.removeItem('bosphorly.member_cache'); } catch {}
    }
    syncMemberBar();
  });

  syncMemberBar();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncMemberBar);
  window.addEventListener('bosphorly:member-changed', syncMemberBar);
  window.addEventListener('storage', e => { if (!e.key || e.key.startsWith('bosphorly.')) syncMemberBar(); });
  host.replaceWith(header);
})();

// Footer privacy link in the visitor's language, followed by the corporate email.
(() => {
  const lang = window.BOSPHORLY_LANG_ALT ? (document.documentElement.lang || 'en').slice(0, 2)
    : window.BosphorlyLang ? window.BosphorlyLang.pick() : 'en';
  const P = {"en": "Privacy", "tr": "Gizlilik", "ru": "Конфиденциальность", "uk": "Конфіденційність", "de": "Datenschutz", "fr": "Confidentialité", "nl": "Privacy", "ar": "الخصوصية", "he": "פרטיות", "az": "Məxfilik", "fa": "حریم خصوصی", "es": "Privacidad", "it": "Privacy", "pt": "Privacidade", "hr": "Privatnost", "hu": "Adatvédelem", "bs": "Privatnost", "zh": "隐私", "ja": "プライバシー", "ko": "개인정보", "hi": "गोपनीयता", "bn": "গোপনীয়তা", "id": "Privasi"};
  const run = () => document.querySelectorAll('a.privacy-link').forEach(a => {
    a.textContent = '🔒 ' + (P[lang] || P.en) + ' · KVKK';
    // Corporate email next to it, once.
    if (a.parentNode.querySelector('a.mail-link')) return;
    const m = document.createElement('a');
    m.className = 'mail-link'; m.href = 'mailto:info@bosphorly.com'; m.textContent = '✉ info@bosphorly.com';
    m.style.textDecoration = 'underline'; m.style.whiteSpace = 'nowrap';
    a.after(' · ', m);
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();
