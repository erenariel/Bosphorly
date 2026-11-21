'use strict';
/* Membership card on My account: "coming soon" without an API, sign-in / create account by OAuth
   (Google, Apple, Facebook, Yandex) or e-mailed code, traveler preferences, coupons, stamps,
   invite link, offers consent, sign-out and account deletion. */
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
    openInbox: tr ? '✉ {p} gelen kutusunu aç ↗' : '✉ Open {p} inbox ↗'
  };

  const PROVIDERS = [
    {
      id: 'google', name: 'Google', domain: '@gmail.com', inbox: 'https://mail.google.com/',
      svg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3 14.7 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4.1 9.6-9.8 0-.7-.1-1.2-.2-1.8H12z"/><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.2-.2-1.8H12v3.9h5.5c-.3 1.4-1.6 3.8-5.5 3.8v4c5.8 0 9.6-4.1 9.6-9.9z"/><path fill="#FBBC05" d="M6 11.8c0-.7.1-1.4.4-2L3 7.2C2.3 8.6 2 10.3 2 12s.3 3.4 1 4.8l3.4-2.6c-.3-.7-.4-1.4-.4-2.4z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.2L3 16.5C4.7 19.8 8.1 22 12 22z"/></svg>'
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

  function openOAuthModal(p, initialEmail = '', initialName = '') {
    const existing = document.getElementById('oauthBackdrop');
    if (existing) existing.remove();
    const localProf = (window.BosphorlyAccount && window.BosphorlyAccount.profile && window.BosphorlyAccount.profile()) || {};
    const backdrop = el('div', 'm-oauth-backdrop');
    backdrop.id = 'oauthBackdrop';
    const modal = el('div', 'm-oauth-modal');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    const headRow = el('div', 'm-oauth-head');
    const iconWrap = el('span'); iconWrap.innerHTML = p.svg;
    const titleWrap = el('div');
    const h3 = el('h3', null, f(UI.oauthTitle, { p: p.name }));
    h3.append(el('small', null, UI.oauthSub));
    titleWrap.append(h3);
    headRow.append(iconWrap, titleWrap);

    const perms = el('ul', 'm-oauth-perms');
    [UI.oauthPerm1, UI.oauthPerm2].forEach(txt => {
      const li = el('li');
      li.append(el('b', null, '✓'), el('span', null, txt));
      perms.append(li);
    });

    const form = el('form', 'm-form'); form.noValidate = true;
    const emailInput = el('input'); emailInput.type = 'email'; emailInput.required = true; emailInput.autocomplete = 'email';
    emailInput.placeholder = 'name' + p.domain;
    const seedEmail = initialEmail || localProf.email || '';
    if (seedEmail) emailInput.value = seedEmail.includes('@') ? seedEmail : seedEmail + p.domain;
    const labEmail = el('label'); labEmail.append(el('span', null, f(UI.oauthEmailLabel, { p: p.name })), emailInput);

    const nameInput = el('input'); nameInput.autocomplete = 'name'; nameInput.maxLength = 100;
    nameInput.value = initialName || localProf.name || '';
    const labName = el('label'); labName.append(el('span', null, T.mName), nameInput);

    const consentInput = el('input'); consentInput.type = 'checkbox';
    const cl = el('label', 'm-check'); cl.append(consentInput, el('span', null, T.mMarketing));

    const actions = el('div', 'actions');
    const allowBtn = el('button', 'btn primary', UI.oauthAllow); allowBtn.type = 'submit';
    const cancelBtn = el('button', 'btn ghost', UI.oauthCancel); cancelBtn.type = 'button';
    const close = () => backdrop.remove();
    cancelBtn.addEventListener('click', close);
    backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
    actions.append(allowBtn, cancelBtn);

    const msg = el('p', 'm-msg'); msg.setAttribute('role', 'status');
    form.append(labEmail, labName, cl, actions, msg);

    form.addEventListener('submit', async e => {
      e.preventDefault();
      let addr = emailInput.value.trim();
      if (addr && !addr.includes('@')) { addr += p.domain; emailInput.value = addr; }
      if (!addr || !emailInput.checkValidity()) { msg.textContent = T.mError; emailInput.focus(); return; }
      allowBtn.disabled = true;
      const prefill = { mode: 'signup', name: nameInput.value.trim(), marketing: consentInput.checked };
      try {
        const r = await M.start(addr);
        close();
        codeForm(addr, r.devCode, prefill);
      } catch (err) {
        msg.textContent = errorText(err);
        allowBtn.disabled = false;
      }
    });

    modal.append(headRow, perms, form);
    backdrop.append(modal);
    document.body.append(backdrop);
    emailInput.focus();
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
    const localProf = (window.BosphorlyAccount && window.BosphorlyAccount.profile && window.BosphorlyAccount.profile()) || {};
    const shell = el('div', 'm-auth-shell');

    const email = el('input'); email.type = 'email'; email.autocomplete = 'email'; email.required = true; email.id = 'mEmail';
    email.placeholder = 'name@gmail.com';
    if (localProf.email) email.value = localProf.email;

    let nameInput = null, phoneInput = null, countryInput = null, hotelInput = null, consentInput = null;
    const selectedInterests = new Set(Array.isArray(localProf.interests) ? localProf.interests : []);

    // Quick provider buttons (Google, Apple, Facebook, Yandex) like Hotels.com.
    const provWrap = el('div', 'm-providers');
    const form = el('form', 'm-form'); form.noValidate = true;

    PROVIDERS.forEach(p => {
      const btn = el('button', 'm-provider');
      btn.type = 'button';
      btn.dataset.provider = p.id;
      btn.setAttribute('aria-pressed', 'false');
      btn.innerHTML = p.svg;
      btn.append(el('span', null, f(UI.continueWith, { p: p.name })));
      btn.addEventListener('click', async () => {
        const avail = await getRemoteProviders();
        if (avail && avail[p.id] && M.oauthUrl) {
          location.href = M.oauthUrl(p.id);
          return;
        }
        openOAuthModal(p, email.value.trim(), nameInput ? nameInput.value.trim() : '');
      });
      provWrap.append(btn);
    });

    const divider = el('div', 'm-divider', UI.orEmail);

    const labEmail = el('label'); labEmail.append(el('span', null, T.mEmail), email);
    const domainRow = el('div', 'm-domains');
    ['@gmail.com', '@yandex.com', '@icloud.com', '@outlook.com'].forEach(dom => {
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

      const intWrap = el('div', 'm-interests-wrap');
      intWrap.append(el('span', 'm-interests-title', UI.interests));
      const intList = el('div', 'm-interests');
      [
        ['cruise', UI.intCruise],
        ['transfer', UI.intTransfer],
        ['oldcity', UI.intOldCity],
        ['hammam', UI.intHammam],
        ['private', UI.intPrivate]
      ].forEach(([key, label]) => {
        const chip = el('button', 'm-chip', label);
        chip.type = 'button';
        chip.dataset.interest = key;
        chip.setAttribute('aria-pressed', String(selectedInterests.has(key)));
        chip.addEventListener('click', () => {
          if (selectedInterests.has(key)) selectedInterests.delete(key);
          else selectedInterests.add(key);
          chip.setAttribute('aria-pressed', String(selectedInterests.has(key)));
        });
        intList.append(chip);
      });
      intWrap.append(intList);

      consentInput = el('input'); consentInput.type = 'checkbox'; consentInput.id = 'mMarketing'; // never pre-ticked
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
        marketing: consentInput ? consentInput.checked : false
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

    shell.append(authTabs(mode), provWrap, divider, form);
    box.replaceChildren(head(mode), perks(), shell, privacy());

    const modalParam = new URLSearchParams(location.search).get('oauth_modal');
    if (modalParam) {
      const found = PROVIDERS.find(x => x.id === modalParam);
      if (found) {
        const cleanSearch = new URLSearchParams(location.search);
        cleanSearch.delete('oauth_modal');
        const qs = cleanSearch.toString();
        history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
        openOAuthModal(found);
      }
    }
  }

  function codeForm(address, devCode, prefill = {}) {
    const form = el('form', 'm-form'); form.noValidate = true;
    const code = el('input'); code.inputMode = 'numeric'; code.autocomplete = 'one-time-code'; code.maxLength = 6; code.pattern = '\\d{6}'; code.id = 'mCode';
    if (devCode) code.value = devCode; // development API only
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
        await M.verify(address, code.value.trim(), { ...(cleanName ? { name: cleanName } : {}), marketing: consent.checked });
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
        if (location.hash === '#signup') history.replaceState(null, '', location.pathname + location.search);
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
    const code = el('code', 'm-code', c.code);
    const state = c.status === 'issued' ? f(T.mValidUntil, { d: day(c.expiresAt) }) : c.status === 'held' ? f(T.mHeld, { ref: c.heldFor }) : c.status === 'redeemed' ? T.mRedeemed : T.mExpired;
    card.append(top, code, el('span', 'm-state', state));
    return card;
  }

  async function member() {
    let p;
    try { p = await M.profile(true); } catch { return M.signedIn() ? box.replaceChildren(head(), el('p', 'm-msg', T.mError)) : signInForm(); }
    const hello = el('h2', null, p.name ? f(T.mHello, { name: p.name.split(/\s+/)[0] }) : T.mHelloNoName);
    const sub = el('p', 'm-lead', p.email);
    // Coupons: usable ones first.
    const order = { issued: 0, held: 1, redeemed: 2, expired: 3, void: 4 };
    const list = el('div', 'm-coupons');
    const cs = [...p.coupons].sort((a, b) => order[a.status] - order[b.status]);
    if (cs.length) cs.forEach(c => list.append(couponCard(c))); else list.append(el('p', 'm-fine', T.mNoCoupons));
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
    // Settings.
    const set = el('div', 'm-settings');
    const offers = el('input'); offers.type = 'checkbox'; offers.checked = p.marketing; offers.id = 'mOffers';
    const ol = el('label', 'm-check'); ol.append(offers, el('span', null, T.mOffersToggle));
    offers.addEventListener('change', async () => { try { await M.update({ marketing: offers.checked }); } catch { offers.checked = !offers.checked; } });
    const out = el('button', 'btn ghost', T.mSignOut); out.type = 'button';
    out.addEventListener('click', async () => { await M.signOut(); signInForm(); });
    const del = el('button', 'btn danger', T.mDelete); del.type = 'button';
    del.addEventListener('click', async () => { if (!confirm(T.mConfirmDelete)) return; try { await M.remove(); signInForm(); } catch { alert(T.mError); } });
    const acts = el('div', 'actions'); acts.append(out, del);
    set.append(ol, acts);
    const h3 = el('h3', null, T.mCoupons);
    box.replaceChildren(hello, sub, h3, list, st, inv, set);
  }

  addEventListener('hashchange', () => {
    if (M.enabled() && !M.signedIn()) signInForm(location.hash === '#signup' ? 'signup' : 'signin');
  });
  if (!M.enabled()) soon();
  else if (M.signedIn()) member();
  else signInForm();
})();
