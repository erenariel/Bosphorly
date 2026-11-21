'use strict';
/* Membership card on My account: sign-in / create account (Google, Apple, Facebook, Yandex OAuth or e-mailed code),
   loyalty tiers (Silver / Gold / Platinum), clear coupons grid, personalized package campaigns, stamps,
   referral invite, preferences & newsletter controls. */
(async () => {
  const M = window.BosphorlyMember, box = document.getElementById('member');
  if (!M || !box) return;
  const T = await M.texts(); const f = M.fill;
  const lang = window.BosphorlyLang ? window.BosphorlyLang.pick() : 'en';
  const tr = lang === 'tr';
  const loc = lang === 'ar' ? 'ar-u-nu-latn' : lang;
  const pct = bps => new Intl.NumberFormat(loc, { style: 'percent', maximumFractionDigits: 1 }).format(bps / 10000);
  const day = s => { try { return new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(s.replace(' ', 'T') + 'Z')); } catch { return s; } };
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const KIND = { welcome: T.kWelcome, referral: T.kReferral, hotel: T.kHotel, second_tour: T.kSecond, loyalty: T.kLoyalty };
  const SIGNUP = { en: 'Create account', tr: 'Hesap oluştur', ru: 'Создать аккаунт', uk: 'Створити акаунт', de: 'Konto erstellen', fr: 'Créer un compte', nl: 'Account aanmaken', ar: 'إنشاء حساب', he: 'יצירת חשבון', az: 'Hesab yarat', fa: 'ایجاد حساب', es: 'Crear cuenta', it: 'Crea account', pt: 'Criar conta', hr: 'Izradi račun', hu: 'Fiók létrehozása', bs: 'Kreiraj račun', zh: '创建账户', ja: 'アカウント作成', ko: '계정 만들기', hi: 'खाता बनाएँ', bn: 'অ্যাকাউন্ট খুলুন', id: 'Buat akun' };
  const signupLabel = SIGNUP[lang] || SIGNUP.en;

  const UI = {
    continueWith: tr ? '{p} ile devam et' : 'Continue with {p}',
    orEmail: tr ? 'veya e-posta ve seyahat bilgilerinle' : 'or with your email & travel details',
    oauthTitle: tr ? '{p} ile bağlan' : 'Connect with {p}',
    oauthSub: tr ? 'Bosphorly hesabınıza erişim izni istiyor' : 'Bosphorly is requesting access to your account',
    oauthPerm1: tr ? 'E-posta adresiniz ve adınız (üyelik hesabınızı oluşturmak ve %5 hoş geldin kuponunuzu tanımlamak için)' : 'Your email address and name (to create your membership account and issue your 5% welcome coupon)',
    oauthPerm2: tr ? 'Seyahat ve iletişim tercihleriniz (tur ve transfer taleplerinizi otomatik doldurmak için)' : 'Your travel and contact preferences (to pre-fill your tour and transfer requests)',
    oauthEmailLabel: tr ? '{p} e-posta adresiniz' : 'Your {p} email address',
    oauthAllow: tr ? 'İzin ver ve devam et' : 'Allow and continue',
    oauthCancel: tr ? 'İptal' : 'Cancel',
    phone: tr ? 'Cep telefonu / WhatsApp' : 'Mobile phone / WhatsApp',
    phonePh: tr ? '+90 555 000 00 00' : '+44 7700 900123',
    country: tr ? 'Ülke / Uyruk (isteğe bağlı)' : 'Country / Nationality (optional)',
    countryPh: tr ? 'Örn. Türkiye, Almanya, İngiltere' : 'e.g. United Kingdom, Germany',
    hotel: tr ? 'İstanbul’daki otelin (isteğe bağlı)' : 'Your hotel in Istanbul (optional)',
    hotelPh: tr ? 'Örn. Sultanahmet Palace' : 'e.g. Sultanahmet Palace',
    interests: tr ? 'İlgilendiğin turlar ve hizmetler (isteğe bağlı)' : 'Tours & services you are interested in (optional)',
    intCruise: tr ? '⛵ Boğaz turları' : '⛵ Bosphorus cruises',
    intTransfer: tr ? '✈️ Havalimanı transferi' : '✈️ Airport transfer',
    intOldCity: tr ? '🏛️ Tarihî Yarımada & kültür' : '🏛️ Old City & heritage',
    intHammam: tr ? '🫧 Türk hamamı & spa' : '🫧 Turkish hammam & spa',
    intPrivate: tr ? '🚐 Özel / VIP tur' : '🚐 Private & VIP tours',
    openInbox: tr ? '✉ {p} gelen kutusunu aç ↗' : '✉ Open {p} inbox ↗',
    tierNames: {
      silver: tr ? '🥈 Silver Üye' : '🥈 Silver Member',
      gold: tr ? '🥇 Gold Üye' : '🥇 Gold Member',
      platinum: tr ? '💎 Platinum VIP' : '💎 Platinum VIP'
    },
    completedCount: tr ? '{n} tamamlanan tur' : '{n} completed tours',
    toGold: tr ? 'Gold ayrıcalıkları (Free Upgrade & %5 VIP öncelik) için {n} tur kaldı' : '{n} more completed tour(s) to unlock Gold (Free Upgrade & 5% VIP priority)',
    toPlatinum: tr ? 'Platinum VIP (her zaman öncelikli VIP indirim & Free Upgrade) için {n} tur kaldı' : '{n} more completed tour(s) to unlock Platinum VIP (always-on VIP priority discount & Free Upgrade)',
    atPlatinum: tr ? 'En yüksek üye seviyesi! Tüm VIP servislerde öncelikli indirim ve Free Upgrade aktif.' : 'Highest tier unlocked! Always-on VIP priority discount & Free Upgrade active on all services.',
    tierPerkSilver: tr ? 'Silver: Hoş geldin kuponu (%5), damga kartı ve ilgi alanına özel paket kampanyaları' : 'Silver: 5% welcome coupon, stamp card & personalized package campaigns',
    tierPerkGold: tr ? 'Gold (2+ tur): Müsaitliğe göre Free Upgrade + VIP servislerde %5 öncelikli indirim' : 'Gold (2+ tours): Free Upgrade (subject to availability) + 5% VIP service priority',
    tierPerkPlatinum: tr ? 'Platinum (5+ tur): Öncelikli Free Upgrade + VIP servislerde her zaman maks. %10 öncelikli indirim' : 'Platinum (5+ tours): Priority Free Upgrade + always-on max 10% VIP service priority discount',
    usableBadge: tr ? '{n} kullanılabilir' : '{n} available',
    copyCode: tr ? 'Kopyala' : 'Copy',
    copiedCode: tr ? 'Kopyalandı ✓' : 'Copied ✓',
    useTransfer: tr ? 'Transferde kullan →' : 'Use on transfer →',
    useTours: tr ? 'Özel turlarda kullan →' : 'Use on special tours →',
    vipCardBadge: tr ? 'ÖNCELİKLİ VIP' : 'VIP PRIORITY',
    vipCardTitleGold: tr ? 'Free Upgrade · %5 VIP öncelik' : 'Free Upgrade · 5% VIP priority',
    vipCardTitlePlat: tr ? 'Öncelikli Free Upgrade + %10 VIP indirim' : 'Priority Free Upgrade + 10% VIP discount',
    vipCardDesc: tr ? 'VIP havalimanı transferi ve özel şoförlü / VIP turlarda geçerlidir.' : 'Automatically applies to VIP airport transfers and private VIP tours.',
    campaignsTitle: tr ? 'Sana özel paket kampanyaları' : 'Personalized package campaigns',
    campaignsSub: tr ? 'Seçtiğin ilgi alanlarına ve üyelik seviyene göre önerilen fırsatlar:' : 'Curated packages tailored to your selected interests and tier:',
    campaignsPickHint: tr ? 'İlgi alanlarını aşağıdan seç; seyahat tarzına özel kampanyalar hemen burada güncellensin.' : 'Select your interests below to tailor package campaigns to your trip.',
    prefsTitle: tr ? 'Kişisel tercihler & haber bülteni' : 'Personal preferences & newsletter',
    newsletterLabel: tr ? 'Bosphorly Haber Bülteni: Sezonluk turlar, özel VIP kampanyalar ve kupon hatırlatmaları e-postama gelsin.' : 'Bosphorly Newsletter: Send me seasonal tours, VIP offers and personalized campaign updates.',
    savePrefs: tr ? 'Tercihleri ve bülteni kaydet' : 'Save preferences & newsletter',
    savedPrefs: tr ? 'Tercihler ve haber bülteni güncellendi ✓' : 'Preferences and newsletter saved ✓',
    newsletterActive: tr ? 'Haber bülteni aktif ✓' : 'Newsletter active ✓',
    newsletterOff: tr ? 'Haber bülteni kapalı' : 'Newsletter off'
  };

  const INTEREST_OPTIONS = [
    ['cruise', UI.intCruise],
    ['transfer', UI.intTransfer],
    ['oldcity', UI.intOldCity],
    ['hammam', UI.intHammam],
    ['private', UI.intPrivate]
  ];

  const CAMPAIGNS = {
    cruise: {
      tag: tr ? 'BOĞAZ PAKETİ' : 'BOSPHORUS BUNDLE',
      title: tr ? 'Boğaz Gün Batımı + Akşam Yemeği Turu' : 'Bosphorus Sunset & Dinner Cruise Package',
      desc: tr ? 'Kuponunla birlikte grup veya özel yat seçeneğinde öncelikli rezervasyon.' : 'Combine your member coupon with priority seating on sunset or dinner yachts.',
      href: 'tours.html',
      cta: tr ? 'Boğaz turlarını incele →' : 'View Bosphorus tours →'
    },
    transfer: {
      tag: tr ? 'TRANSFER + VIP' : 'TRANSFER + VIP',
      title: tr ? 'IST / SAW Özel VIP Havalimanı Transferi' : 'IST / SAW Private VIP Airport Transfer',
      desc: tr ? 'Sabit fiyat garantisi + Gold/Platinum üyelerimize VIP araçta ücretsiz sınıf yükseltme önceliği.' : 'Fixed rate per vehicle plus Free Upgrade priority on VIP vehicles for Gold/Platinum.',
      href: 'index.html#booking',
      cta: tr ? 'Transfer talep et →' : 'Request transfer →'
    },
    oldcity: {
      tag: tr ? 'TARİH & KÜLTÜR' : 'HERITAGE PACKAGE',
      title: tr ? 'Sultanahmet & Boğaz Tam Gün Kombine Paketi' : 'Old City & Bosphorus Full-Day Combo',
      desc: tr ? 'Ayasofya, Topkapı ve Yerebatan rotasını öğleden sonra Boğaz turuyla birleştir.' : 'Combine Hagia Sophia & Topkapı guided walk with an afternoon Bosphorus cruise.',
      href: 'tours.html',
      cta: tr ? 'Özel turları gör →' : 'See special tours →'
    },
    hammam: {
      tag: tr ? 'HAMAM & SPA' : 'HAMMAM & SPA',
      title: tr ? 'Tarihî Türk Hamamı & Kese-Masaj Paketi' : 'Historic Turkish Hammam & Scrub-Massage',
      desc: tr ? 'Otelden çift yön transfer kolaylığı ile lisanslı tarihî hamam seçkileri.' : 'Licensed Ottoman hammam rituals with convenient pickup and member coupon savings.',
      href: 'prices.html',
      cta: tr ? 'Hamam ve turları karşılaştır →' : 'Compare hammam & tours →'
    },
    private: {
      tag: tr ? 'VIP ÖZEL SERVİS' : 'VIP PRIVATE SERVICE',
      title: tr ? 'Özel Şoförlü VIP Mercedes Vito & Rehber' : 'Private Chauffeur VIP Minivan & Licensed Guide',
      desc: tr ? 'Platinum üyelerde her zaman maks. %10 VIP öncelikli indirim ve ücretsiz sınıf yükseltme.' : 'Platinum members always enjoy up to 10% priority VIP discount and Free Upgrade priority.',
      href: 'tours.html',
      cta: tr ? 'VIP talep oluştur →' : 'Create VIP request →'
    }
  };

  const PROVIDERS = [
    {
      id: 'google', name: 'Google', domain: '@gmail.com', inbox: 'https://mail.google.com/',
      svg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3 14.7 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4.1 9.6-9.8 0-.7-.1-1.2-.2-1.8H12z"/><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.2-.2-1.8H12v3.9h5.5c-.3 1.4-1.6 3.8-5.5 3.8v4c5.8 0 9.6-4.1 9.6-9.9z"/><path fill="#FBBC05" d="M6 11.8c0-.7.1-1.4.4-2L3 7.2C2.3 8.6 2 10.3 2 12s.3 3.4 1 4.8l3.4-2.6c-.3-.7-.4-1.4-.4-2.4z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.2L3 16.5C4.7 19.8 8.1 22 12 22z"/></svg>'
    },
    {
      id: 'microsoft', name: 'Microsoft', domain: '@outlook.com', inbox: 'https://outlook.live.com/mail/',
      svg: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="1" y="1" width="10" height="10" fill="#f25022"/><rect x="13" y="1" width="10" height="10" fill="#7fba00"/><rect x="1" y="13" width="10" height="10" fill="#00a4ef"/><rect x="13" y="13" width="10" height="10" fill="#ffb900"/></svg>'
    },
    {
      id: 'apple', name: 'Apple', domain: '@icloud.com', inbox: 'https://www.icloud.com/mail/',
      svg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#111" d="M16.4 12.7c0-2.1 1.7-3.2 1.8-3.2-1-1.4-2.5-1.6-3.1-1.7-1.3-.1-2.6.8-3.2.8-.7 0-1.7-.8-2.8-.7-1.4 0-2.7.8-3.5 2.1-1.5 2.6-.4 6.4 1.1 8.5.7 1 1.6 2.2 2.7 2.1 1.1 0 1.5-.7 2.8-.7 1.3 0 1.7.7 2.8.7 1.2 0 1.9-1 2.6-2.1.8-1.2 1.2-2.4 1.2-2.4-.1 0-2.4-.9-2.4-3.4zm-2.1-6.2c.6-.7 1-1.7.9-2.7-.9 0-2 .6-2.6 1.3-.6.7-1.1 1.7-.9 2.7 1 .1 2-.5 2.6-1.3z"/></svg>'
    },
    {
      id: 'facebook', name: 'Facebook', domain: '@gmail.com', inbox: 'https://mail.google.com/',
      svg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#1877F2" d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12z"/></svg>'
    },
    {
      id: 'yandex', name: 'Yandex', domain: '@yandex.com', inbox: 'https://mail.yandex.com/',
      svg: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#FC3F1D"/><path fill="#fff" d="M13.5 18h2V6h-2.9C9.8 6 8.3 7.4 8.3 9.7c0 1.7.8 2.9 2.2 3.6L8 18h2.2l2.3-4.2h1V18zm0-5.8h-.8c-1.4 0-2.3-.8-2.3-2.4 0-1.5.8-2.3 2.2-2.3h.9v4.7z"/></svg>'
    }
  ];

  let remoteProviders = null;
  async function getRemoteProviders() {
    if (remoteProviders) return remoteProviders;
    remoteProviders = (M.providers ? await M.providers() : {}) || {};
    return remoteProviders;
  }

  const errorText = e => (e && e.status === 429 ? T.mTooMany : e && e.status === 400 ? T.mBadCode : T.mError);

  function perks(goal = 5) {
    const ul = el('ul', 'm-perks');
    [T.mPerk1, T.mPerk2, T.mPerk3, f(T.mPerk4, { goal })].forEach(x => ul.append(el('li', null, x)));
    return ul;
  }
  function head(mode) {
    const h = el('div', 'm-head');
    h.append(el('h2', null, '🎟️ ' + (mode === 'signup' ? signupLabel + ' · ' + T.mTitle : T.mTitle)), el('p', 'm-lead', T.mLead));
    return h;
  }
  const privacy = () => { const p = el('p', 'm-fine', T.mPrivacy + ' '); const a = el('a', null, T.mPrivacyLink); a.href = 'privacy.html'; p.append(a); return p; };

  function soon() { box.replaceChildren(head(), perks(), el('p', 'm-soon', T.mSoon)); }

  function inboxForEmail(address) {
    const d = (address.split('@')[1] || '').toLowerCase();
    if (d.includes('gmail') || d.includes('googlemail')) return { name: 'Gmail', url: 'https://mail.google.com/' };
    if (d.includes('yandex') || d === 'ya.ru') return { name: 'Yandex Mail', url: 'https://mail.yandex.com/' };
    if (d.includes('icloud') || d === 'me.com' || d === 'mac.com') return { name: 'iCloud Mail', url: 'https://www.icloud.com/mail/' };
    if (d.includes('outlook') || d.includes('hotmail') || d.includes('live.')) return { name: 'Outlook', url: 'https://outlook.live.com/mail/' };
    return null;
  }

  function applyDomain(emailInput, domain) {
    const val = emailInput.value.trim();
    if (!val) {
      emailInput.placeholder = 'name' + domain;
      emailInput.focus();
      return;
    }
    const local = val.split('@')[0];
    if (local) {
      emailInput.value = local + domain;
      emailInput.focus();
    }
  }

  function renderInterestChips(selectedSet) {
    const wrap = el('div', 'm-interests-wrap');
    wrap.append(el('span', 'm-interests-title', UI.interests));
    const list = el('div', 'm-interests');
    INTEREST_OPTIONS.forEach(([key, label]) => {
      const chip = el('button', 'm-chip', label);
      chip.type = 'button';
      chip.dataset.interest = key;
      chip.setAttribute('aria-pressed', String(selectedSet.has(key)));
      chip.addEventListener('click', () => {
        if (selectedSet.has(key)) selectedSet.delete(key); else selectedSet.add(key);
        chip.setAttribute('aria-pressed', String(selectedSet.has(key)));
      });
      list.append(chip);
    });
    wrap.append(list);
    return wrap;
  }

  function authTabs(activeMode) {
    const tabs = el('div', 'm-tabs');
    tabs.setAttribute('role', 'tablist');
    const bIn = el('button', null, T.mSignIn);
    bIn.type = 'button'; bIn.id = 'tabSignIn'; bIn.setAttribute('role', 'tab');
    bIn.setAttribute('aria-selected', String(activeMode !== 'signup'));
    const bUp = el('button', null, signupLabel);
    bUp.type = 'button'; bUp.id = 'tabSignUp'; bUp.setAttribute('role', 'tab');
    bUp.setAttribute('aria-selected', String(activeMode === 'signup'));
    bIn.addEventListener('click', () => {
      if (location.hash === '#signup') history.replaceState(null, '', location.pathname + location.search);
      signInForm('signin');
    });
    bUp.addEventListener('click', () => {
      if (location.hash !== '#signup') history.replaceState(null, '', location.pathname + location.search + '#signup');
      signInForm('signup');
    });
    tabs.append(bIn, bUp);
    return tabs;
  }

  function signInForm(mode = location.hash === '#signup' ? 'signup' : 'signin') {
    const isSignup = mode === 'signup';
    const localProf = (window.BOSPHORLY_API && window.BosphorlyAccount && window.BosphorlyAccount.profile && window.BosphorlyAccount.profile()) || (window.BosphorlyAccount && window.BosphorlyAccount.profile && window.BosphorlyAccount.profile()) || {};
    const shell = el('div', 'm-auth-shell');

    // Handle oauth_error redirect
    const urlParams = new URLSearchParams(location.search);
    const oauthError = urlParams.get('oauth_error');
    if (oauthError) {
      urlParams.delete('oauth_error');
      const qs = urlParams.toString();
      history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
      const alertBox = el('div', 'm-alert-box', T.mOAuthUnavailable || 'Bu giriş yöntemi şu an kullanılamıyor, e-posta koduyla devam edebilirsin.');
      shell.append(alertBox);
    }

    // Handle Telegram link flow
    const hashStr = (location.hash || '').replace(/^#/, '');
    const hashParams = new URLSearchParams(hashStr.includes('&') ? hashStr : hashStr + '&');
    const linkToken = hashParams.get('state') || urlParams.get('state') || urlParams.get('link_token');
    const isTelegramLink = location.hash.includes('link-telegram');
    if (isTelegramLink && linkToken) {
      const linkNote = el('div', 'm-alert-box', T.mTelegramLinkNote || 'Telegram hesabınızı bağlamak için lütfen e-posta adresinizi girin ve onay kodunu yazın.');
      shell.append(linkNote);
    }

    const email = el('input'); email.type = 'email'; email.autocomplete = 'email'; email.required = true; email.id = 'mEmail';
    email.placeholder = 'name@gmail.com';
    if (localProf.email) email.value = localProf.email;

    let nameInput = null, phoneInput = null, countryInput = null, hotelInput = null, consentInput = null;
    const selectedInterests = new Set(Array.isArray(localProf.interests) ? localProf.interests : []);

    // Passkey sign-in option for login mode
    let passkeyBtn = null;
    if (!isSignup && M.supportsPasskey && M.supportsPasskey()) {
      passkeyBtn = el('button', 'btn ghost m-passkey-btn');
      passkeyBtn.type = 'button';
      passkeyBtn.id = 'passkeySignInBtn';
      passkeyBtn.textContent = '🔑 ' + (T.mPasskeySignIn || 'Passkey ile giriş');
      passkeyBtn.addEventListener('click', async () => {
        passkeyBtn.disabled = true;
        msg.textContent = '';
        try {
          await M.passkeyLogin();
          await member();
        } catch (err) {
          msg.textContent = (err && err.message) || T.mError;
          passkeyBtn.disabled = false;
        }
      });
    }

    const provWrap = el('div', 'm-providers');
    provWrap.hidden = true;
    const divider = el('div', 'm-divider', UI.orEmail);
    divider.hidden = true;
    const form = el('form', 'm-form'); form.noValidate = true;

    getRemoteProviders().then(avail => {
      let activeCount = 0;
      PROVIDERS.forEach(p => {
        if (!avail || !avail[p.id]) return;
        activeCount++;
        const btn = el('button', 'm-provider');
        btn.type = 'button';
        btn.dataset.provider = p.id;
        btn.innerHTML = p.svg;
        btn.append(el('span', null, f(T.mContinueWith || UI.continueWith, { p: p.name })));
        btn.addEventListener('click', () => {
          const extra = {
            phone: phoneInput ? phoneInput.value.trim() : (localProf.phone || ''),
            country: countryInput ? countryInput.value.trim() : (localProf.country || ''),
            hotel: hotelInput ? hotelInput.value.trim() : (localProf.hotel || ''),
            hotelName: hotelInput ? hotelInput.value.trim() : (localProf.hotel || ''),
            interests: [...selectedInterests],
            marketing: consentInput ? consentInput.checked : false
          };
          location.href = M.oauthUrl(p.id, extra);
        });
        provWrap.append(btn);
      });

      if (avail && avail.telegram && window.BOSPHORLY_API && window.BOSPHORLY_API.telegramBot) {
        activeCount++;
        const tgBox = el('div', 'm-telegram-widget');
        const script = document.createElement('script');
        script.async = true;
        script.src = 'https://telegram.org/js/telegram-widget.js?22';
        script.setAttribute('data-telegram-login', window.BOSPHORLY_API.telegramBot);
        script.setAttribute('data-size', 'large');
        const callbackUrl = ((window.BOSPHORLY_API && window.BOSPHORLY_API.base) || '').replace(/\/+$/, '') + '/v1/auth/oauth/telegram/callback';
        script.setAttribute('data-auth-url', callbackUrl);
        script.setAttribute('data-request-access', 'write');
        tgBox.append(script);
        provWrap.append(tgBox);
      }

      if (activeCount > 0) {
        provWrap.hidden = false;
        divider.hidden = false;
      }
    }).catch(() => {});

    const labEmail = el('label'); labEmail.append(el('span', null, T.mEmail), email);
    const domainRow = el('div', 'm-domains');
    ['@gmail.com', '@outlook.com', '@yandex.com', '@icloud.com'].forEach(dom => {
      const chip = el('button', 'm-domain', dom);
      chip.type = 'button';
      chip.addEventListener('click', () => applyDomain(email, dom));
      domainRow.append(chip);
    });

    if (isSignup) {
      nameInput = el('input'); nameInput.autocomplete = 'name'; nameInput.maxLength = 100; nameInput.id = 'mName';
      if (localProf.name) nameInput.value = localProf.name;
      const labName = el('label'); labName.append(el('span', null, T.mName), nameInput);

      phoneInput = el('input'); phoneInput.type = 'tel'; phoneInput.autocomplete = 'tel'; phoneInput.maxLength = 32; phoneInput.id = 'mPhone';
      phoneInput.placeholder = UI.phonePh;
      if (localProf.phone) phoneInput.value = localProf.phone;
      const labPhone = el('label'); labPhone.append(el('span', null, UI.phone), phoneInput);

      const row1 = el('div', 'm-form-grid');
      row1.append(labName, labPhone);

      countryInput = el('input'); countryInput.autocomplete = 'country-name'; countryInput.maxLength = 80; countryInput.id = 'mCountry';
      countryInput.placeholder = UI.countryPh;
      if (localProf.country) countryInput.value = localProf.country;
      const labCountry = el('label'); labCountry.append(el('span', null, UI.country), countryInput);

      hotelInput = el('input'); hotelInput.autocomplete = 'organization'; hotelInput.maxLength = 120; hotelInput.id = 'mHotel';
      hotelInput.placeholder = UI.hotelPh;
      if (localProf.hotel) hotelInput.value = localProf.hotel;
      const labHotel = el('label'); labHotel.append(el('span', null, UI.hotel), hotelInput);

      const row2 = el('div', 'm-form-grid');
      row2.append(labCountry, labHotel);

      const intWrap = renderInterestChips(selectedInterests);

      consentInput = el('input'); consentInput.type = 'checkbox'; consentInput.id = 'mMarketing';
      const cl = el('label', 'm-check'); cl.append(consentInput, el('span', null, T.mMarketing));

      form.append(row1, labEmail, domainRow, row2, intWrap, cl);
    } else {
      form.append(labEmail, domainRow);
    }

    const send = el('button', 'btn primary', T.mSend); send.type = 'submit';
    const msg = el('p', 'm-msg'); msg.setAttribute('role', 'status');
    form.append(send, msg);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (!email.checkValidity() || !email.value.trim()) { msg.textContent = T.mError; email.focus(); return; }
      send.disabled = true;
      const prefill = {
        mode,
        name: nameInput ? nameInput.value.trim() : (localProf.name || ''),
        phone: phoneInput ? phoneInput.value.trim() : (localProf.phone || ''),
        country: countryInput ? countryInput.value.trim() : (localProf.country || ''),
        hotel: hotelInput ? hotelInput.value.trim() : (localProf.hotel || ''),
        interests: [...selectedInterests],
        marketing: consentInput ? consentInput.checked : false,
        ...(linkToken ? { linkToken } : {})
      };
      if (window.BosphorlyAccount && window.BosphorlyAccount.saveProfile) {
        const cur = window.BosphorlyAccount.profile() || {};
        window.BosphorlyAccount.saveProfile({
          ...cur,
          name: prefill.name || cur.name || '',
          phone: prefill.phone || cur.phone || '',
          email: email.value.trim(),
          hotel: prefill.hotel || cur.hotel || '',
          country: prefill.country || cur.country || '',
          interests: prefill.interests
        });
      }
      try { const r = await M.start(email.value.trim()); codeForm(email.value.trim(), r.devCode, prefill); }
      catch (err) { msg.textContent = errorText(err); send.disabled = false; }
    });

    shell.append(authTabs(mode));
    if (passkeyBtn) shell.append(passkeyBtn);
    shell.append(provWrap, divider, form);
    box.replaceChildren(head(mode), perks(), shell, privacy());
  }

  function codeForm(address, devCode, prefill = {}) {
    const form = el('form', 'm-form'); form.noValidate = true;
    const code = el('input'); code.inputMode = 'numeric'; code.autocomplete = 'one-time-code'; code.maxLength = 6; code.pattern = '\\d{6}'; code.id = 'mCode';
    if (devCode) code.value = devCode;
    const name = el('input'); name.autocomplete = 'name'; name.maxLength = 100; name.id = 'mName';
    if (prefill.name) name.value = prefill.name;
    const consent = el('input'); consent.type = 'checkbox'; consent.id = 'mMarketing';
    consent.checked = !!prefill.marketing;
    const cl = el('label', 'm-check'); cl.append(consent, el('span', null, T.mMarketing));
    const l1 = el('label'); l1.append(el('span', null, T.mCode), code);
    const l2 = el('label'); l2.append(el('span', null, T.mName), name);
    const go = el('button', 'btn primary', T.mSignIn); go.type = 'submit';
    const msg = el('p', 'm-msg'); msg.setAttribute('role', 'status');

    const sentMsg = el('p', 'm-sent', f(T.mCodeSent, { email: address }));
    form.append(sentMsg);
    const inbox = inboxForEmail(address);
    if (inbox) {
      const openBtn = el('a', 'm-inbox-btn', f(UI.openInbox, { p: inbox.name }));
      openBtn.href = inbox.url;
      openBtn.target = '_blank';
      openBtn.rel = 'noopener noreferrer';
      form.append(openBtn);
    }
    form.append(l1, l2, cl, go, msg);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (!/^\d{6}$/.test(code.value.trim())) { msg.textContent = T.mBadCode; return; }
      go.disabled = true;
      try {
        const cleanName = name.value.trim();
        await M.verify(address, code.value.trim(), {
          ...(cleanName ? { name: cleanName } : {}),
          ...(prefill.phone ? { phone: prefill.phone } : {}),
          ...(prefill.hotel ? { hotelName: prefill.hotel } : {}),
          ...(prefill.country ? { country: prefill.country } : {}),
          ...(Array.isArray(prefill.interests) && prefill.interests.length ? { interests: prefill.interests } : {}),
          ...(prefill.linkToken ? { linkToken: prefill.linkToken } : {}),
          marketing: consent.checked
        });
        if (window.BosphorlyAccount && window.BosphorlyAccount.saveProfile) {
          const cur = window.BosphorlyAccount.profile() || {};
          window.BosphorlyAccount.saveProfile({
            ...cur,
            name: cleanName || prefill.name || cur.name || '',
            phone: prefill.phone || cur.phone || '',
            email: address,
            hotel: prefill.hotel || cur.hotel || '',
            country: prefill.country || cur.country || '',
            interests: prefill.interests || cur.interests || []
          });
          const pName = document.getElementById('pName'), pPhone = document.getElementById('pPhone'), pEmail = document.getElementById('pEmail'), pHotel = document.getElementById('pHotel');
          if (pName && (cleanName || prefill.name)) pName.value = cleanName || prefill.name;
          if (pPhone && prefill.phone) pPhone.value = prefill.phone;
          if (pEmail) pEmail.value = address;
          if (pHotel && prefill.hotel) pHotel.value = prefill.hotel;
        }
        if (location.hash === '#signup' || location.hash.includes('link-telegram')) history.replaceState(null, '', location.pathname + location.search);
        await member();
      }
      catch (err) { msg.textContent = errorText(err); go.disabled = false; }
    });
    box.replaceChildren(head(prefill.mode), authTabs(prefill.mode || 'signin'), form, privacy());
    code.focus();
  }

  function couponCard(c) {
    const card = el('div', 'm-coupon ' + c.status);
    const top = el('div', 'm-ctop');
    top.append(el('strong', 'm-pct', f(T.mOff, { p: pct(c.percentBps) })), el('span', 'm-kind', KIND[c.kind] || c.kind));
    const codeRow = el('div', 'm-code-row');
    const codeEl = el('code', 'm-code', c.code);
    codeRow.append(codeEl);
    if (c.status === 'issued') {
      const cp = el('button', 'm-copy-mini', UI.copyCode);
      cp.type = 'button';
      cp.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(c.code); } catch {}
        cp.textContent = UI.copiedCode;
        setTimeout(() => { cp.textContent = UI.copyCode; }, 1600);
      });
      codeRow.append(cp);
    }
    const state = c.status === 'issued' ? f(T.mValidUntil, { d: day(c.expiresAt) }) : c.status === 'held' ? f(T.mHeld, { ref: c.heldFor }) : c.status === 'redeemed' ? T.mRedeemed : T.mExpired;
    card.append(top, codeRow, el('span', 'm-state', state));
    if (c.status === 'issued') {
      const links = el('div', 'm-coupon-links');
      const a1 = el('a', null, UI.useTransfer); a1.href = 'index.html#booking';
      const a2 = el('a', null, UI.useTours); a2.href = 'tours.html';
      links.append(a1, a2);
      card.append(links);
    }
    return card;
  }

  function vipCouponCard(p) {
    const card = el('div', 'm-coupon vip');
    const top = el('div', 'm-ctop');
    const pctStr = p.vipPriorityDiscountBps > 0 ? pct(p.vipPriorityDiscountBps) : '';
    top.append(el('strong', 'm-pct', p.tier === 'platinum' ? (pctStr + ' VIP') : pctStr), el('span', 'm-kind', UI.vipCardBadge));
    card.append(top, el('strong', null, p.tier === 'platinum' ? UI.vipCardTitlePlat : UI.vipCardTitleGold), el('span', 'm-state', UI.vipCardDesc));
    const links = el('div', 'm-coupon-links');
    const a1 = el('a', null, UI.useTransfer); a1.href = 'index.html#booking';
    const a2 = el('a', null, UI.useTours); a2.href = 'tours.html';
    links.append(a1, a2);
    card.append(links);
    return card;
  }

  function tierCard(p) {
    const tierKey = p.tier || 'silver';
    const card = el('div', 'm-tier-card');
    card.dataset.tier = tierKey;
    const top = el('div', 'm-tier-top');
    top.append(el('span', 'm-tier-badge', UI.tierNames[tierKey] || UI.tierNames.silver));
    top.append(el('span', 'm-fine', f(UI.completedCount, { n: p.fulfilledCount || 0 }) + ' · ' + (p.marketing ? UI.newsletterActive : UI.newsletterOff)));
    const bar = el('div', 'm-tier-bar');
    const fill = el('div', 'm-tier-fill');
    const ratio = Math.min(100, Math.round(((p.fulfilledCount || 0) / 5) * 100));
    fill.style.width = Math.max(12, ratio) + '%';
    bar.append(fill);

    let msgText = UI.atPlatinum;
    if (p.nextTier === 'gold') msgText = f(UI.toGold, { n: p.toursToNextTier || 2 });
    else if (p.nextTier === 'platinum') msgText = f(UI.toPlatinum, { n: p.toursToNextTier || 1 });

    const ul = el('ul', 'm-tier-perks');
    [UI.tierPerkSilver, UI.tierPerkGold, UI.tierPerkPlatinum].forEach(txt => ul.append(el('li', null, txt)));
    card.append(top, bar, el('p', 'm-fine', msgText), ul);
    return card;
  }

  async function member() {
    let p;
    try { p = await M.profile(true); } catch { return M.signedIn() ? box.replaceChildren(head(), el('p', 'm-msg', T.mError)) : signInForm(); }

    // Keep local device profile aligned with server member basics.
    if (window.BosphorlyAccount) {
      const cur = window.BosphorlyAccount.profile() || {};
      const next = {
        ...cur,
        name: p.name || cur.name || '',
        phone: p.phone || cur.phone || '',
        email: p.email || cur.email || '',
        hotel: p.hotel || cur.hotel || '',
        room: p.room || cur.room || '',
        country: p.country || cur.country || '',
        interests: Array.isArray(p.interests) && p.interests.length ? p.interests : (cur.interests || [])
      };
      window.BosphorlyAccount.saveProfile(next);
      const pName = document.getElementById('pName'), pPhone = document.getElementById('pPhone'), pEmail = document.getElementById('pEmail'), pHotel = document.getElementById('pHotel'), pRoom = document.getElementById('pRoom');
      if (pName && !pName.value && p.name) pName.value = p.name;
      if (pPhone && !pPhone.value && p.phone) pPhone.value = p.phone;
      if (pEmail && !pEmail.value && p.email) pEmail.value = p.email;
      if (pHotel && !pHotel.value && p.hotel) pHotel.value = p.hotel;
      if (pRoom && !pRoom.value && p.room) pRoom.value = p.room;
    }

    const hello = el('h2', null, p.name ? f(T.mHello, { name: p.name.split(/\s+/)[0] }) : T.mHelloNoName);
    const subParts = [p.email, p.country].filter(Boolean);
    const sub = el('p', 'm-lead', subParts.join(' · '));

    // Loyalty Tier Card.
    const tierEl = tierCard(p);

    // Coupons Grid (always clearly visible, usable first + VIP priority card for Gold/Platinum).
    const order = { issued: 0, held: 1, redeemed: 2, expired: 3, void: 4 };
    const cs = [...(p.coupons || [])].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
    const usableCount = cs.filter(c => c.status === 'issued').length;
    const h3 = el('h3', null, T.mCoupons);
    h3.append(el('span', 'm-count', f(UI.usableBadge, { n: usableCount })));
    const list = el('div', 'm-coupons');
    if (p.tier === 'gold' || p.tier === 'platinum') list.append(vipCouponCard(p));
    if (cs.length) cs.forEach(c => list.append(couponCard(c)));
    else if (p.tier === 'silver') list.append(el('p', 'm-fine', T.mNoCoupons));

    // Personalized Package Campaigns.
    const campHead = el('h3', null, UI.campaignsTitle);
    const selectedInts = new Set(Array.isArray(p.interests) ? p.interests : []);
    const orderedKeys = [...selectedInts, ...Object.keys(CAMPAIGNS).filter(k => !selectedInts.has(k))].slice(0, selectedInts.size ? Math.max(2, selectedInts.size) : 3);
    const campSub = el('p', 'm-fine', selectedInts.size ? UI.campaignsSub : UI.campaignsPickHint);
    const campGrid = el('div', 'm-offers-grid');
    orderedKeys.forEach(k => {
      const cfg = CAMPAIGNS[k];
      if (!cfg) return;
      const card = el('div', 'm-offer');
      const cta = el('a', null, cfg.cta); cta.href = cfg.href;
      card.append(el('span', 'm-offer-tag', cfg.tag), el('strong', null, cfg.title), el('p', null, cfg.desc), cta);
      campGrid.append(card);
    });

    // Personal Preferences & Newsletter editor.
    const prefs = el('form', 'm-prefs'); prefs.noValidate = true;
    const prefsHead = el('h3', null, UI.prefsTitle); prefsHead.style.margin = '0';
    const cInput = el('input'); cInput.maxLength = 80; cInput.placeholder = UI.countryPh; cInput.value = p.country || '';
    const labC = el('label'); labC.append(el('span', null, UI.country), cInput);
    const prefInts = new Set(Array.isArray(p.interests) ? p.interests : []);
    const intEditor = renderInterestChips(prefInts);
    const offers = el('input'); offers.type = 'checkbox'; offers.checked = !!p.marketing; offers.id = 'mOffers';
    const ol = el('label', 'm-check'); ol.append(offers, el('span', null, UI.newsletterLabel));
    const savePrefsBtn = el('button', 'btn primary', UI.savePrefs); savePrefsBtn.type = 'submit';
    const prefMsg = el('p', 'm-msg'); prefMsg.setAttribute('role', 'status');
    prefs.append(prefsHead, labC, intEditor, ol, savePrefsBtn, prefMsg);
    prefs.addEventListener('submit', async e => {
      e.preventDefault();
      savePrefsBtn.disabled = true;
      prefMsg.textContent = ''; prefMsg.classList.remove('ok');
      try {
        await M.update({ country: cInput.value.trim(), interests: [...prefInts], marketing: offers.checked });
        if (window.BosphorlyAccount) {
          const cur = window.BosphorlyAccount.profile() || {};
          window.BosphorlyAccount.saveProfile({ ...cur, country: cInput.value.trim(), interests: [...prefInts] });
        }
        prefMsg.classList.add('ok');
        prefMsg.textContent = UI.savedPrefs;
        setTimeout(() => { member(); }, 450);
      } catch (err) {
        prefMsg.textContent = errorText(err);
      } finally {
        savePrefsBtn.disabled = false;
      }
    });

    // Passkeys (parmak izi / Face ID)
    const passkeySec = el('div', 'm-prefs');
    passkeySec.style.marginTop = '14px';
    const pkHead = el('h3', null, '🔑 ' + (T.mPasskeys || 'Passkeys'));
    pkHead.style.margin = '0 0 8px';
    passkeySec.append(pkHead);
    const pkList = el('div', 'm-passkey-list');
    const renderPasskeys = (keys) => {
      pkList.replaceChildren();
      if (!keys || !keys.length) return;
      keys.forEach(k => {
        const row = el('div', 'm-passkey-row');
        const info = el('div');
        const title = el('strong', null, 'Passkey');
        const dateStr = el('small', 'm-fine', ' · ' + day(k.createdAt) + (k.lastUsedAt ? (' · ' + day(k.lastUsedAt)) : ''));
        info.append(title, dateStr);
        const delBtn = el('button', 'btn danger', T.mPasskeyDelete || 'Sil');
        delBtn.type = 'button';
        delBtn.style.padding = '5px 10px';
        delBtn.style.fontSize = '12px';
        delBtn.addEventListener('click', async () => {
          if (!confirm((T.mPasskeyDelete || 'Sil') + '?')) return;
          delBtn.disabled = true;
          try {
            await M.removePasskey(k.id);
            row.remove();
          } catch {
            delBtn.disabled = false;
            alert(T.mError);
          }
        });
        row.append(info, delBtn);
        pkList.append(row);
      });
    };
    renderPasskeys(p.passkeys);
    passkeySec.append(pkList);

    if (M.supportsPasskey && M.supportsPasskey()) {
      const addBtn = el('button', 'btn ghost', '➕ ' + (T.mPasskeyAdd || 'Bu cihaza passkey ekle'));
      addBtn.type = 'button';
      const pkMsg = el('p', 'm-msg');
      addBtn.addEventListener('click', async () => {
        addBtn.disabled = true;
        pkMsg.textContent = '';
        try {
          const r = await M.passkeyRegister();
          if (r && r.passkey) {
            p.passkeys = [r.passkey, ...(p.passkeys || []).filter(x => x.id !== r.passkey.id)];
            renderPasskeys(p.passkeys);
          } else {
            const updated = await M.passkeys();
            renderPasskeys(updated);
          }
        } catch (err) {
          pkMsg.textContent = (err && err.message) || T.mError;
        } finally {
          addBtn.disabled = false;
        }
      });
      passkeySec.append(addBtn, pkMsg);
    }

    // Stamps.
    const st = el('div', 'm-stamps');
    const dots = el('div', 'm-dots'); dots.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < p.stampsGoal; i++) dots.append(el('span', i < p.stamps ? 'on' : null, i < p.stamps ? '★' : '☆'));
    st.append(el('h3', null, T.mStamps), dots, el('p', 'm-fine', f(T.mStampsText, { n: p.stamps, goal: p.stampsGoal })));

    // Invite.
    const link = location.origin + location.pathname.replace(/[^/]*$/, '') + 'index.html?ref=' + p.referralCode;
    const inv = el('div', 'm-invite');
    const linkBox = el('input'); linkBox.readOnly = true; linkBox.value = link; linkBox.setAttribute('aria-label', T.mInvite);
    const copy = el('button', 'btn ghost', T.mCopy); copy.type = 'button';
    copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(link); } catch { linkBox.select(); document.execCommand('copy'); } copy.textContent = T.mCopied; setTimeout(() => { copy.textContent = T.mCopy; }, 1800); });
    const share = el('a', 'btn wa', T.mShareWa); share.href = 'mailto:?subject=' + encodeURIComponent('Bosphorly invitation') + '&body=' + encodeURIComponent(f(T.mShareMsg, { url: link })); share.target = '_blank'; share.rel = 'noopener';
    const row = el('div', 'actions'); row.append(copy, share);
    inv.append(el('h3', null, T.mInvite), el('p', 'm-fine', T.mInviteText), linkBox, row);

    // Account actions (Sign out + Delete).
    const set = el('div', 'm-settings');
    const out = el('button', 'btn ghost', T.mSignOut); out.type = 'button';
    out.addEventListener('click', async () => { await M.signOut(); signInForm(); });
    const del = el('button', 'btn danger', T.mDelete); del.type = 'button';
    del.addEventListener('click', async () => { if (!confirm(T.mConfirmDelete)) return; try { await M.remove(); signInForm(); } catch { alert(T.mError); } });
    const acts = el('div', 'actions'); acts.append(out, del);
    set.append(acts);

    box.replaceChildren(hello, sub, tierEl, h3, list, campHead, campSub, campGrid, prefs, passkeySec, st, inv, set);
  }

  window.addEventListener('bosphorly:member-changed', e => {
    if (!e.detail && M.enabled() && box.querySelector('.m-tier-card')) signInForm();
  });
  addEventListener('hashchange', () => {
    if (M.enabled() && !M.signedIn()) signInForm(location.hash === '#signup' ? 'signup' : 'signin');
  });
  if (!M.enabled()) soon();
  else if (M.signedIn()) member();
  else signInForm();
})();
