'use strict';
/* Bosphorly membership client: sign-in by e-mailed code / OAuth, cached header sync, tiers, coupons, requests & newsletter. */
(() => {
  const SESSION = 'bosphorly.session', REF = 'bosphorly.ref', HOTEL = 'bosphorly.hotel', CACHE = 'bosphorly.member_cache';
  const store = {
    get: k => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} }
  };
  const q = new URLSearchParams(location.search);
  if (/^[A-Za-z0-9]{6,12}$/.test(q.get('ref') || '')) store.set(REF, q.get('ref').toUpperCase());
  if (/^[a-z0-9-]{2,60}$/.test(q.get('h') || '')) store.set(HOTEL, q.get('h'));
  if (location.hash && location.hash.includes('oauth_token=')) {
    const hp = new URLSearchParams(location.hash.replace(/^#/, ''));
    const ot = hp.get('oauth_token');
    if (ot && ot.length <= 100) {
      store.set(SESSION, ot);
      store.set(REF, null);
      store.set(CACHE, null);
    }
    try { history.replaceState(null, '', location.pathname + location.search); } catch {}
  }

  const apiBase = () => ((window.BOSPHORLY_API && window.BOSPHORLY_API.base) || '').replace(/\/+$/, '');
  const lang = () => (window.BosphorlyLang ? window.BosphorlyLang.pick() : (document.documentElement.lang || 'en').slice(0, 2));

  function notify(detail) {
    try { window.dispatchEvent(new CustomEvent('bosphorly:member-changed', { detail: detail || null })); } catch {}
  }
  function summaryOf(m) {
    if (!m) return null;
    const coupons = Array.isArray(m.coupons) ? m.coupons : [];
    return {
      email: m.email || '',
      name: m.name || '',
      lang: m.lang || lang(),
      country: m.country || '',
      interests: Array.isArray(m.interests) ? m.interests : [],
      tier: m.tier || 'silver',
      nextTier: m.nextTier || null,
      toursToNextTier: m.toursToNextTier || 0,
      vipPriorityDiscountBps: m.vipPriorityDiscountBps || 0,
      freeUpgrade: m.freeUpgrade || 'none',
      fulfilledCount: m.fulfilledCount || 0,
      usableCouponCount: coupons.filter(c => c.status === 'issued').length,
      marketing: !!m.marketing
    };
  }
  function saveMember(m) {
    me = m || null;
    store.set(CACHE, m ? JSON.stringify(summaryOf(m)) : null);
    notify(m || null);
    return me;
  }
  function readCache() {
    if (!apiBase() || !store.get(SESSION)) return null;
    if (me) return summaryOf(me);
    try { const raw = store.get(CACHE); return raw ? JSON.parse(raw) : null; } catch { return null; }
  }

  class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }
  async function api(path, body, method = body === undefined ? 'GET' : 'POST') {
    const base = apiBase();
    if (!base) throw new ApiError(503, 'Service unavailable');
    const token = store.get(SESSION);
    const r = await fetch(base + path, {
      method, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    const data = await r.json().catch(() => ({}));
    if (r.status === 401 && token) {
      store.set(SESSION, null);
      saveMember(null);
    }
    if (!r.ok) throw new ApiError(r.status, data.error || 'error');
    return data;
  }

  let texts = null;
  async function t() {
    if (texts) return texts;
    const get = l => fetch((window.BOSPHORLY_BASE || '') + 'data/members/' + l + '.json').then(r => (r.ok ? r.json() : null)).catch(() => null);
    const [en, own] = await Promise.all([get('en'), lang() === 'en' ? null : get(lang())]);
    texts = Object.assign({}, en, own || {});
    return texts;
  }
  const fill = (s, vars) => String(s || '').replace(/\{(\w+)\}/g, (_, k) => (vars && vars[k] != null ? vars[k] : ''));

  let me = null;
  let inflightProfile = null;
  const Member = Object.freeze({
    enabled: () => !!apiBase(),
    signedIn: () => !!(apiBase() && store.get(SESSION)),
    cachedProfile: readCache,
    texts: t, fill,
    pending: () => ({ ref: store.get(REF), hotel: store.get(HOTEL) }),
    providers: () => (apiBase() ? api('/v1/auth/providers').catch(() => ({})) : Promise.resolve({})),
    oauthUrl(provider, extra = {}) {
      const p = { ref: store.get(REF), hotel: store.get(HOTEL) };
      const ints = Array.isArray(extra.interests) ? extra.interests.filter(Boolean).join(',') : '';
      const qs = new URLSearchParams({
        lang: lang(),
        ...(p.ref ? { ref: p.ref } : {}),
        ...(p.hotel ? { hotel: p.hotel } : {}),
        ...(extra.country ? { country: String(extra.country).trim().slice(0, 80) } : {}),
        ...(ints ? { interests: ints } : {}),
        ...(extra.marketing ? { marketing: '1' } : {})
      });
      return apiBase() + '/v1/auth/oauth/' + encodeURIComponent(provider) + '?' + qs;
    },
    start: email => api('/v1/auth/start', { email, lang: lang() }),
    async verify(email, code, extra = {}) {
      const p = { ref: store.get(REF), hotel: store.get(HOTEL) };
      const r = await api('/v1/auth/verify', { email, code, lang: lang(), ...(p.ref ? { ref: p.ref } : {}), ...(p.hotel ? { hotel: p.hotel } : {}), ...extra });
      store.set(SESSION, r.token); store.set(REF, null);
      saveMember(r.member);
      return r;
    },
    async profile(force) {
      if (me && !force) return me;
      if (inflightProfile && !force) return inflightProfile;
      inflightProfile = api('/v1/me').then(res => saveMember(res)).finally(() => { inflightProfile = null; });
      return inflightProfile;
    },
    async update(fields) { return saveMember(await api('/v1/me', fields)); },
    async signOut() { try { await api('/v1/auth/logout', {}); } catch {} store.set(SESSION, null); saveMember(null); },
    async remove() { await api('/v1/me/delete', {}); store.set(SESSION, null); saveMember(null); },
    registerRequest: data => api('/v1/me/requests', data),
    subscribeNewsletter: data => api('/v1/newsletter/subscribe', { lang: lang(), ...data }),
    unsubscribeNewsletter: email => api('/v1/newsletter/unsubscribe', email ? { email } : {}),
    // Coupons the member can still use, best first.
    async usableCoupons() {
      if (!this.signedIn()) return [];
      try { const p = await this.profile(); return (p.coupons || []).filter(c => c.status === 'issued').sort((a, b) => b.percentBps - a.percentBps || a.expiresAt.localeCompare(b.expiresAt)); }
      catch { return []; }
    },
    ApiError
  });
  window.BosphorlyMember = Member;

  if (Member.signedIn()) {
    // Refresh profile once in background when signed in so persistent headers stay synced across every page.
    Member.profile(true).catch(() => {});
  }
})();
