'use strict';
/* Membership card on My account: "coming soon" without an API, sign-in by e-mailed code, then the member's
   coupons, stamps, invite link, offers consent, sign-out and account deletion. */
(async () => {
  const M = window.BosphorlyMember, box = document.getElementById('member');
  if (!M || !box) return;
  const T = await M.texts(); const f = M.fill;
  const lang = window.BosphorlyLang ? window.BosphorlyLang.pick() : 'en';
  const loc = lang === 'ar' ? 'ar-u-nu-latn' : lang;
  const pct = bps => new Intl.NumberFormat(loc, { style: 'percent', maximumFractionDigits: 1 }).format(bps / 10000);
  const day = s => { try { return new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(s.replace(' ', 'T') + 'Z')); } catch { return s; } };
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const KIND = { welcome: T.kWelcome, referral: T.kReferral, hotel: T.kHotel, second_tour: T.kSecond, loyalty: T.kLoyalty };
  const SIGNUP = { en: 'Create account', tr: 'Hesap oluştur', ru: 'Создать аккаунт', uk: 'Створити акаунт', de: 'Konto erstellen', fr: 'Créer un compte', nl: 'Account aanmaken', ar: 'إنشاء حساب', he: 'יצירת חשבון', az: 'Hesab yarat', fa: 'ایجاد حساب', es: 'Crear cuenta', it: 'Crea account', pt: 'Criar conta', hr: 'Izradi račun', hu: 'Fiók létrehozása', bs: 'Kreiraj račun', zh: '创建账户', ja: 'アカウント作成', ko: '계정 만들기', hi: 'खाता बनाएँ', bn: 'অ্যাকাউন্ট খুলুন', id: 'Buat akun' };
  const signupLabel = SIGNUP[lang] || SIGNUP.en;
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

  function authTabs(activeMode) {
    const tabs = el('div', 'tabs m-tabs');
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
    const form = el('form', 'm-form'); form.noValidate = true;
    const email = el('input'); email.type = 'email'; email.autocomplete = 'email'; email.required = true; email.id = 'mEmail';
    if (localProf.email) email.value = localProf.email;
    const labEmail = el('label'); labEmail.append(el('span', null, T.mEmail), email);

    let nameInput = null, consentInput = null;
    if (isSignup) {
      nameInput = el('input'); nameInput.autocomplete = 'name'; nameInput.maxLength = 100; nameInput.id = 'mName';
      if (localProf.name) nameInput.value = localProf.name;
      const labName = el('label'); labName.append(el('span', null, T.mName), nameInput);
      consentInput = el('input'); consentInput.type = 'checkbox'; consentInput.id = 'mMarketing'; // never pre-ticked
      const cl = el('label', 'm-check'); cl.append(consentInput, el('span', null, T.mMarketing));
      form.append(labName, labEmail, cl);
    } else {
      form.append(labEmail);
    }

    const send = el('button', 'btn primary', T.mSend); send.type = 'submit';
    const msg = el('p', 'm-msg'); msg.setAttribute('role', 'status');
    form.append(send, msg);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (!email.checkValidity() || !email.value.trim()) { msg.textContent = T.mError; return; }
      send.disabled = true;
      const prefill = {
        mode,
        name: nameInput ? nameInput.value.trim() : (localProf.name || ''),
        marketing: consentInput ? consentInput.checked : false
      };
      try { const r = await M.start(email.value.trim()); codeForm(email.value.trim(), r.devCode, prefill); }
      catch (err) { msg.textContent = errorText(err); send.disabled = false; }
    });
    box.replaceChildren(head(mode), perks(), authTabs(mode), form, privacy());
  }

  function codeForm(address, devCode, prefill = {}) {
    const form = el('form', 'm-form'); form.noValidate = true;
    const code = el('input'); code.inputMode = 'numeric'; code.autocomplete = 'one-time-code'; code.maxLength = 6; code.pattern = '\\d{6}'; code.id = 'mCode';
    if (devCode) code.value = devCode; // development API only
    const name = el('input'); name.autocomplete = 'name'; name.maxLength = 100; name.id = 'mName';
    if (prefill.name) name.value = prefill.name;
    const consent = el('input'); consent.type = 'checkbox'; consent.id = 'mMarketing'; // never pre-ticked unless chosen in signup step
    consent.checked = !!prefill.marketing;
    const cl = el('label', 'm-check'); cl.append(consent, el('span', null, T.mMarketing));
    const l1 = el('label'); l1.append(el('span', null, T.mCode), code);
    const l2 = el('label'); l2.append(el('span', null, T.mName), name);
    const go = el('button', 'btn primary', T.mSignIn); go.type = 'submit';
    const msg = el('p', 'm-msg'); msg.setAttribute('role', 'status');
    form.append(el('p', 'm-sent', f(T.mCodeSent, { email: address })), l1, l2, cl, go, msg);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (!/^\d{6}$/.test(code.value.trim())) { msg.textContent = T.mBadCode; return; }
      go.disabled = true;
      try {
        const cleanName = name.value.trim();
        await M.verify(address, code.value.trim(), { ...(cleanName ? { name: cleanName } : {}), marketing: consent.checked });
        if (window.BosphorlyAccount && window.BosphorlyAccount.saveProfile) {
          const cur = window.BosphorlyAccount.profile() || {};
          window.BosphorlyAccount.saveProfile({ ...cur, name: cleanName || cur.name || '', email: address });
          const pName = document.getElementById('pName'), pEmail = document.getElementById('pEmail');
          if (pName && !pName.value && cleanName) pName.value = cleanName;
          if (pEmail && !pEmail.value) pEmail.value = address;
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
