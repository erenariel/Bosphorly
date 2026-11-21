'use strict';
/* Bosphorly membership client: sign-in by e-mailed code / OAuth, cross-device profile & cart/request sync,
   tiers, coupons, and newsletter. */
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
    const requests = Array.isArray(m.requests) ? m.requests : [];
    return {
      email: m.email || '',
      name: m.name || '',
      phone: m.phone || '',
      hotel: m.hotel || '',
      room: m.room || '',
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
      marketing: !!m.marketing,
      requests: requests.slice(0, 50),
      passkeys: Array.isArray(m.passkeys) ? m.passkeys : []
    };
  }
  function mirrorToLocal(m) {
    const A = window.BosphorlyAccount;
    if (!m || !A || !A.saveProfile) return;
    const cur = A.profile() || {};
    A.saveProfile({
      name: m.name || cur.name || '',
      phone: m.phone || cur.phone || '',
      email: m.email || cur.email || '',
      hotel: m.hotel || cur.hotel || '',
      room: m.room || cur.room || '',
      country: m.country || cur.country || '',
      interests: Array.isArray(m.interests) && m.interests.length ? m.interests : (cur.interests || [])
    });
  }
  function saveMember(m) {
    me = m || null;
    store.set(CACHE, m ? JSON.stringify(summaryOf(m)) : null);
    if (m) mirrorToLocal(m);
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

  let syncedOnce = false;
  async function syncLocalToServer(m) {
    if (syncedOnce || !m || !window.BosphorlyAccount) return m;
    syncedOnce = true;
    const A = window.BosphorlyAccount;
    const cur = A.profile() || {};
    const patch = {};
    if (!m.name && cur.name) patch.name = cur.name;
    if (!m.phone && cur.phone) patch.phone = cur.phone;
    if (!m.hotel && cur.hotel) patch.hotel = cur.hotel;
    if (!m.room && cur.room) patch.room = cur.room;
    if (!m.country && cur.country) patch.country = cur.country;
    if ((!Array.isArray(m.interests) || !m.interests.length) && Array.isArray(cur.interests) && cur.interests.length) patch.interests = cur.interests;
    let updated = m;
    if (Object.keys(patch).length) {
      try { updated = saveMember(await api('/v1/me', patch)); } catch {}
    }
    const existingRefs = new Set((updated.requests || []).map(x => x.ref));
    const localReqs = (A.requests ? A.requests() : []).filter(r =>
      r && typeof r.ref === 'string' && /^[A-Z0-9-]{6,40}$/.test(r.ref) && !existingRefs.has(r.ref) && /^\d{4}-\d{2}-\d{2}$/.test(String(r.date || ''))
    ).slice(0, 15);
    let pushed = 0;
    for (const r of localReqs) {
      const sid = String(r.serviceId || (r.type === 'transfer' ? 'airport-transfer' : 'custom-tour')).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'tour';
      try {
        await api('/v1/me/requests', {
          ref: r.ref,
          serviceId: sid,
          date: r.date,
          guests: Math.min(16, Math.max(1, Number(r.guests) || 1)),
          ...(r.type ? { type: String(r.type).slice(0, 24) } : {}),
          ...(r.title ? { title: String(r.title).slice(0, 160) } : {}),
          ...(r.operator ? { operator: String(r.operator).slice(0, 120) } : {}),
          ...(r.time ? { time: String(r.time).slice(0, 24) } : {}),
          ...(r.total ? { total: String(r.total).slice(0, 80) } : {})
        });
        pushed++;
      } catch {}
    }
    if (pushed > 0) {
      try { updated = saveMember(await api('/v1/me')); } catch {}
    }
    return updated;
  }

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
        ...(extra.phone ? { phone: String(extra.phone).trim().slice(0, 40) } : {}),
        ...(extra.hotelName ? { hotelName: String(extra.hotelName).trim().slice(0, 140) } : {}),
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
      syncedOnce = false;
      saveMember(r.member);
      r.member = await syncLocalToServer(r.member);
      return r;
    },
    async profile(force) {
      if (me && !force) return me;
      if (inflightProfile && !force) return inflightProfile;
      inflightProfile = api('/v1/me').then(async res => {
        saveMember(res);
        return await syncLocalToServer(res);
      }).finally(() => { inflightProfile = null; });
      return inflightProfile;
    },
    async update(fields) { return saveMember(await api('/v1/me', fields)); },
    async signOut() { try { await api('/v1/auth/logout', {}); } catch {} store.set(SESSION, null); syncedOnce = false; saveMember(null); },
    async remove() { await api('/v1/me/delete', {}); store.set(SESSION, null); syncedOnce = false; saveMember(null); },
    async registerRequest(data) {
      const res = await api('/v1/me/requests', data);
      if (me) {
        const entry = {
          ref: data.ref, serviceId: data.serviceId, date: data.date, guests: data.guests,
          type: data.type || null, title: data.title || null, operator: data.operator || null,
          time: data.time || null, total: data.total || null, notes: data.notes || null,
          state: 'requested', couponCode: res.coupon ? res.coupon.code : null, percentBps: res.coupon ? res.coupon.percentBps : null
        };
        const nextReqs = [entry, ...(me.requests || []).filter(x => x.ref !== data.ref)];
        const nextCoupons = res.coupon
          ? (me.coupons || []).map(c => c.code === res.coupon.code ? { ...c, status: 'held', heldFor: data.ref } : c)
          : me.coupons;
        saveMember({ ...me, requests: nextReqs, coupons: nextCoupons });
      }
      return res;
    },
    async removeRequest(ref) {
      const res = await api('/v1/me/requests/delete', { ref });
      if (res && res.member) saveMember(res.member);
      return res;
    },
    subscribeNewsletter: data => api('/v1/newsletter/subscribe', { lang: lang(), ...data }),
    unsubscribeNewsletter: email => api('/v1/newsletter/unsubscribe', email ? { email } : {}),
    async usableCoupons() {
      if (!this.signedIn()) return [];
      try { const p = await this.profile(); return (p.coupons || []).filter(c => c.status === 'issued').sort((a, b) => b.percentBps - a.percentBps || a.expiresAt.localeCompare(b.expiresAt)); }
      catch { return []; }
    },
    supportsPasskey: () => {
      try {
        const s = window.SimpleWebAuthnBrowser;
        return !!(s && typeof s.browserSupportsWebAuthn === 'function' && s.browserSupportsWebAuthn());
      } catch {
        return false;
      }
    },
    async passkeyLogin() {
      const swa = window.SimpleWebAuthnBrowser;
      if (!swa || typeof swa.startAuthentication !== 'function') throw new ApiError(400, 'Passkey not supported');
      const options = await api('/v1/passkeys/login/options');
      const asseResp = await swa.startAuthentication({ optionsJSON: options });
      const r = await api('/v1/passkeys/login/verify', asseResp);
      store.set(SESSION, r.token);
      store.set(REF, null);
      syncedOnce = false;
      saveMember(r.member);
      r.member = await syncLocalToServer(r.member);
      return r;
    },
    async passkeyRegister() {
      const swa = window.SimpleWebAuthnBrowser;
      if (!swa || typeof swa.startRegistration !== 'function') throw new ApiError(400, 'Passkey not supported');
      const options = await api('/v1/passkeys/register/options');
      const attResp = await swa.startRegistration({ optionsJSON: options });
      const r = await api('/v1/passkeys/register/verify', attResp);
      if (me && r.passkey) {
        const cur = Array.isArray(me.passkeys) ? me.passkeys : [];
        saveMember({ ...me, passkeys: [r.passkey, ...cur.filter(x => x.id !== r.passkey.id)] });
      }
      return r;
    },
    async passkeys() {
      const r = await api('/v1/passkeys');
      return Array.isArray(r) ? r : (r.passkeys || []);
    },
    async removePasskey(id) {
      const res = await api('/v1/passkeys/delete', { id });
      if (me && Array.isArray(me.passkeys)) {
        saveMember({ ...me, passkeys: me.passkeys.filter(x => x.id !== id) });
      }
      return res;
    },
    ApiError
  });
  window.BosphorlyMember = Member;

  if (Member.signedIn()) {
    Member.profile(true).catch(() => {});
  }
})();
