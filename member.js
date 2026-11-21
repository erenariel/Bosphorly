'use strict';
/* Bosphorly membership client: sign-in by e-mailed code, profile, coupons, request registration.
   - Talks to the API in config/api.js; when no API is configured, enabled() is false and pages show
     membership as "coming soon".
   - Remembers an invite (?ref=CODE) and a partner hotel (?h=hotel-id) from any page for sign-up.
   - The session token is kept on this device only and sent as a Bearer token. */
(() => {
  const SESSION = 'bosphorly.session', REF = 'bosphorly.ref', HOTEL = 'bosphorly.hotel';
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
    }
    try { history.replaceState(null, '', location.pathname + location.search); } catch {}
  }

  const base = ((window.BOSPHORLY_API && window.BOSPHORLY_API.base) || '').replace(/\/+$/, '');
  const lang = () => (window.BosphorlyLang ? window.BosphorlyLang.pick() : (document.documentElement.lang || 'en').slice(0, 2));

  class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }
  async function api(path, body, method = body === undefined ? 'GET' : 'POST') {
    const token = store.get(SESSION);
    const r = await fetch(base + path, {
      method, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    const data = await r.json().catch(() => ({}));
    if (r.status === 401 && token) store.set(SESSION, null);
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
  window.BosphorlyMember = Object.freeze({
    enabled: () => !!base,
    signedIn: () => !!(base && store.get(SESSION)),
    texts: t, fill,
    pending: () => ({ ref: store.get(REF), hotel: store.get(HOTEL) }),
    providers: () => api('/v1/auth/providers').catch(() => ({})),
    oauthUrl(provider) {
      const p = { ref: store.get(REF), hotel: store.get(HOTEL) };
      const qs = new URLSearchParams({ lang: lang(), ...(p.ref ? { ref: p.ref } : {}), ...(p.hotel ? { hotel: p.hotel } : {}) });
      return base + '/v1/auth/oauth/' + encodeURIComponent(provider) + '?' + qs;
    },
    start: email => api('/v1/auth/start', { email, lang: lang() }),
    async verify(email, code, extra = {}) {
      const p = { ref: store.get(REF), hotel: store.get(HOTEL) };
      const r = await api('/v1/auth/verify', { email, code, lang: lang(), ...(p.ref ? { ref: p.ref } : {}), ...(p.hotel ? { hotel: p.hotel } : {}), ...extra });
      store.set(SESSION, r.token); store.set(REF, null);
      me = r.member; return r;
    },
    async profile(force) { if (!me || force) me = await api('/v1/me'); return me; },
    async update(fields) { me = await api('/v1/me', fields); return me; },
    async signOut() { try { await api('/v1/auth/logout', {}); } catch {} store.set(SESSION, null); me = null; },
    async remove() { await api('/v1/me/delete', {}); store.set(SESSION, null); me = null; },
    registerRequest: data => api('/v1/me/requests', data),
    // Coupons the member can still use, best first.
    async usableCoupons() {
      if (!this.signedIn()) return [];
      try { const p = await this.profile(); return p.coupons.filter(c => c.status === 'issued').sort((a, b) => b.percentBps - a.percentBps || a.expiresAt.localeCompare(b.expiresAt)); }
      catch { return []; }
    },
    ApiError
  });
})();
