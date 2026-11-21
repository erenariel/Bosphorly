// Membership, sign-in by e-mailed one-time code, campaigns and coupons.
// Discounts are funded from Bosphorly's commission; MAX_DISCOUNT_BPS (default 10 %) caps every coupon
// so a discount can never exceed what the commission can carry.
//
// Coupon life cycle: issued -> held (attached to one WhatsApp request) -> redeemed (request fulfilled)
//                    held -> issued again if the request is cancelled. One coupon per request.
// Rewards follow completed tours, not sign-ups: the referral, second-tour and loyalty coupons are issued
// only when a partner marks a member's request as fulfilled.

export const STAMPS_GOAL = 5;
const SESSION_DAYS = 90;
const CODE_MINUTES = 10;
const CODE_MAX_TRIES = 5;
const CODES_PER_15_MIN = 3;
const ONCE = new Set(['welcome', 'hotel', 'second_tour']);
const LANGS = ['tr', 'en', 'ru', 'uk', 'de', 'fr', 'nl', 'ar', 'he', 'az', 'fa', 'es', 'it', 'pt', 'hr', 'hu', 'bs', 'zh', 'ja', 'ko', 'hi', 'bn', 'id'];
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I

const enc = new TextEncoder();
export const sqlTime = d => d.toISOString().replace('T', ' ').slice(0, 19); // same format as CURRENT_TIMESTAMP
const later = (ms, from = new Date()) => sqlTime(new Date(from.getTime() + ms));
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const sha256 = async s => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
async function hmac(secret, s) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(s)));
}
function randomString(n, alphabet = ALPHABET) {
  const out = []; const max = 256 - (256 % alphabet.length); const buf = new Uint8Array(1);
  while (out.length < n) { crypto.getRandomValues(buf); if (buf[0] < max) out.push(alphabet[buf[0] % alphabet.length]); }
  return out.join('');
}
export function sixDigits() { return randomString(6, '0123456789'); }
const token = () => { const b = new Uint8Array(32); crypto.getRandomValues(b); return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const couponCode = () => 'BOS-' + randomString(4) + '-' + randomString(4);
const id = () => crypto.randomUUID();
const equal = (a, b) => { if (a.length !== b.length) return false; let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i); return x === 0; };

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const fail = (status, msg) => { throw new HttpError(status, msg); };

export const validEmail = e => typeof e === 'string' && e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
const str = (v, max) => (typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : null);
const isoDate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) === v;
const maxBps = env => Math.min(5000, Math.max(1, parseInt(env.MAX_DISCOUNT_BPS || '1000', 10) || 1000));

async function readJson(request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) fail(415, 'JSON required');
  const text = await request.text();
  if (enc.encode(text).length > 4096) fail(413, 'Payload too large');
  try { const v = JSON.parse(text || '{}'); if (!v || typeof v !== 'object' || Array.isArray(v)) throw 0; return v; } catch { fail(400, 'Invalid JSON'); }
}
const bearer = request => (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');

// --- e-mail -----------------------------------------------------------------------------------------
const MAIL = {
  en: ['Your Bosphorly sign-in code', 'Your code is {code}. It is valid for 10 minutes. If you did not ask for it, ignore this e-mail.'],
  tr: ['Bosphorly giriş kodun', 'Kodun: {code}. 10 dakika geçerlidir. Bu kodu sen istemediysen bu e-postayı yok say.'],
  ru: ['Ваш код входа в Bosphorly', 'Ваш код: {code}. Он действует 10 минут. Если вы его не запрашивали, проигнорируйте письмо.'],
  de: ['Ihr Bosphorly-Anmeldecode', 'Ihr Code lautet {code}. Er ist 10 Minuten gültig. Falls Sie ihn nicht angefordert haben, ignorieren Sie diese E-Mail.'],
  ar: ['رمز الدخول إلى Bosphorly', 'رمزك هو {code}. صالح لمدة 10 دقائق. إذا لم تطلبه فتجاهل هذه الرسالة.']
};
async function sendCode(env, email, code, lang) {
  const [subject, body] = MAIL[lang] || MAIL.en;
  if (env.RESEND_API_KEY) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.MAIL_FROM || 'Bosphorly <no-reply@bosphorly.com>', to: [email], subject, text: body.replace('{code}', code) })
    });
    if (!r.ok) fail(502, 'E-mail could not be sent');
    return;
  }
  if (env.DEV_RETURN_CODE !== '1') fail(503, 'Sign-in e-mail is not configured');
}

// --- campaigns and coupons ----------------------------------------------------------------------------
async function issue(env, memberId, kind, hotelId = null) {
  const now = sqlTime(new Date());
  const c = await env.DB.prepare(
    `SELECT id, percent_bps, valid_days FROM campaigns WHERE kind=? AND active=1 AND starts_at<=? AND (ends_at IS NULL OR ends_at>?)
     AND (hotel_id IS ? OR hotel_id=?) ORDER BY starts_at DESC, id LIMIT 1`).bind(kind, now, now, hotelId, hotelId).first();
  if (!c) return null;
  const code = couponCode();
  const res = await env.DB.prepare(
    `INSERT OR IGNORE INTO coupons (id, code, member_id, campaign_id, percent_bps, expires_at, once_key) VALUES (?,?,?,?,?,?,?)`)
    .bind(id(), code, memberId, c.id, Math.min(c.percent_bps, maxBps(env)), later(c.valid_days * 864e5), ONCE.has(kind) ? memberId + ':' + c.id : null).run();
  return res.meta.changes ? code : null;
}

async function memberFromSession(request, env) {
  const t = bearer(request);
  if (!t || t.length > 100) fail(401, 'Sign in required');
  const m = await env.DB.prepare(
    `SELECT m.* FROM sessions s JOIN members m ON m.id=s.member_id WHERE s.token_hash=? AND s.expires_at>?`).bind(await sha256(t), sqlTime(new Date())).first();
  if (!m) fail(401, 'Sign in required');
  return m;
}

async function profile(env, m) {
  const now = sqlTime(new Date());
  const coupons = (await env.DB.prepare(
    `SELECT c.code, c.percent_bps, c.status, c.expires_at, c.held_ref, k.kind FROM coupons c JOIN campaigns k ON k.id=c.campaign_id
     WHERE c.member_id=? ORDER BY c.issued_at DESC, c.code`).bind(m.id).all()).results
    .map(c => ({ code: c.code, kind: c.kind, percentBps: c.percent_bps, expiresAt: c.expires_at, heldFor: c.held_ref,
      status: c.status === 'issued' && c.expires_at <= now ? 'expired' : c.status }));
  const requests = (await env.DB.prepare(
    `SELECT ref, service_id, service_date, guests, state FROM member_requests WHERE member_id=? ORDER BY created_at DESC LIMIT 50`).bind(m.id).all()).results
    .map(r => ({ ref: r.ref, serviceId: r.service_id, date: r.service_date, guests: r.guests, state: r.state }));
  return { email: m.email, name: m.name, lang: m.lang, referralCode: m.referral_code, marketing: !!m.marketing_consent,
    stamps: m.stamps, stampsGoal: STAMPS_GOAL, coupons, requests };
}

// --- routes -------------------------------------------------------------------------------------------
const ROUTES = new Set(['/v1/auth/start', '/v1/auth/verify', '/v1/auth/logout', '/v1/auth/providers', '/v1/me', '/v1/me/requests', '/v1/me/delete',
  '/v1/partner/lookup', '/v1/partner/fulfil', '/v1/partner/cancel', '/v1/admin/campaigns']);
const OAUTH_PROVIDERS = new Set(['google', 'yandex', 'facebook', 'apple']);
export const isMemberRoute = path => ROUTES.has(path) || path.startsWith('/v1/auth/oauth/');

const redirect = location => new Response(null, { status: 302, headers: { Location: location, 'Cache-Control': 'no-store' } });
const b64urlEncode = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlDecode = s => {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/');
  return decodeURIComponent(escape(atob(pad + '='.repeat((4 - (pad.length % 4)) % 4))));
};

function enabledProviders(env) {
  return {
    google: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    yandex: !!(env.YANDEX_CLIENT_ID && env.YANDEX_CLIENT_SECRET),
    facebook: !!(env.FACEBOOK_CLIENT_ID && env.FACEBOOK_CLIENT_SECRET),
    apple: !!env.APPLE_CLIENT_ID
  };
}

async function signState(pepper, obj) {
  const payload = b64urlEncode(JSON.stringify(obj));
  const sig = await hmac(pepper, payload);
  return payload + '.' + sig;
}

async function verifyState(pepper, stateStr) {
  if (typeof stateStr !== 'string' || !stateStr.includes('.')) return null;
  const [payload, sig] = stateStr.split('.');
  if (!payload || !sig || !equal(sig, await hmac(pepper, payload))) return null;
  try {
    const data = JSON.parse(b64urlDecode(payload));
    if (!data || typeof data.t !== 'number' || Math.abs(Date.now() - data.t) > 15 * 60 * 1000) return null;
    return data;
  } catch { return null; }
}

async function createOrLoadMemberSession(env, rawEmail, body = {}) {
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
  if (!validEmail(email)) fail(400, 'Invalid e-mail');
  const now = sqlTime(new Date());
  let m = await env.DB.prepare(`SELECT * FROM members WHERE email=?`).bind(email).first();
  const created = !m;
  if (!m) {
    const referrer = str(body.ref, 20) ? await env.DB.prepare(`SELECT id FROM members WHERE referral_code=?`).bind(body.ref.trim().toUpperCase()).first() : null;
    const hotel = str(body.hotel, 60) ? await env.DB.prepare(`SELECT id FROM hotels WHERE id=? AND status='verified'`).bind(body.hotel.trim()).first() : null;
    const marketing = body.marketing === true;
    const mid = id();
    let code = randomString(8);
    for (let i = 0; i < 3 && await env.DB.prepare(`SELECT 1 AS x FROM members WHERE referral_code=?`).bind(code).first(); i++) code = randomString(8);
    await env.DB.prepare(`INSERT INTO members (id, email, name, lang, referral_code, referred_by, hotel_id, marketing_consent, marketing_consent_at) VALUES (?,?,?,?,?,?,?,?,?)`)
      .bind(mid, email, str(body.name, 100), LANGS.includes(body.lang) ? body.lang : 'en', code, referrer ? referrer.id : null, hotel ? hotel.id : null, marketing ? 1 : 0, marketing ? now : null).run();
    await issue(env, mid, 'welcome');
    if (hotel) await issue(env, mid, 'hotel', hotel.id);
    m = await env.DB.prepare(`SELECT * FROM members WHERE id=?`).bind(mid).first();
  } else if (!m.name && str(body.name, 100)) {
    const cleanName = str(body.name, 100);
    await env.DB.prepare(`UPDATE members SET name=? WHERE id=?`).bind(cleanName, m.id).run();
    m = { ...m, name: cleanName };
  }
  const t = token();
  await env.DB.prepare(`INSERT INTO sessions (token_hash, member_id, expires_at) VALUES (?,?,?)`).bind(await sha256(t), m.id, later(SESSION_DAYS * 864e5)).run();
  return { token: t, created, member: await profile(env, m) };
}

async function verifyAppleIdToken(idToken, clientId, expectedNonce) {
  const parts = String(idToken || '').split('.');
  if (parts.length !== 3) return null;
  let header, claims;
  try { header = JSON.parse(b64urlDecode(parts[0])); claims = JSON.parse(b64urlDecode(parts[1])); } catch { return null; }
  if (!header.kid || claims.iss !== 'https://appleid.apple.com' || claims.aud !== clientId) return null;
  if (claims.exp && claims.exp * 1000 < Date.now()) return null;
  if (expectedNonce && claims.nonce && claims.nonce !== expectedNonce) return null;
  const jwksRes = await fetch('https://appleid.apple.com/auth/keys');
  if (!jwksRes.ok) return null;
  const { keys } = await jwksRes.json();
  const jwk = (keys || []).find(k => k.kid === header.kid);
  if (!jwk) return null;
  const pubKey = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const sigStr = parts[2].replace(/-/g, '+').replace(/_/g, '/');
  const sigBin = atob(sigStr + '='.repeat((4 - (sigStr.length % 4)) % 4));
  const sigBytes = new Uint8Array(sigBin.length);
  for (let i = 0; i < sigBin.length; i++) sigBytes[i] = sigBin.charCodeAt(i);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', pubKey, sigBytes, enc.encode(parts[0] + '.' + parts[1]));
  return valid ? claims : null;
}

async function handleOAuth(request, env, url) {
  const pubOrigin = (env.PUBLIC_ORIGIN || 'https://bosphorly.com').replace(/\/+$/, '');
  const m = url.pathname.match(/^\/v1\/auth\/oauth\/([a-z]+)(\/callback)?$/);
  if (!m || !OAUTH_PROVIDERS.has(m[1])) fail(404, 'Not found');
  const provider = m[1], isCallback = !!m[2];
  const callbackUrl = url.origin + `/v1/auth/oauth/${provider}/callback`;
  const avail = enabledProviders(env);

  if (!isCallback) {
    if (request.method !== 'GET') fail(405, 'Method not allowed');
    const lang = LANGS.includes(url.searchParams.get('lang')) ? url.searchParams.get('lang') : 'en';
    const ref = str(url.searchParams.get('ref'), 20);
    const hotel = str(url.searchParams.get('hotel'), 60);
    if (!avail[provider] || !env.CODE_PEPPER) {
      return redirect(`${pubOrigin}/account.html?lang=${encodeURIComponent(lang)}&oauth_modal=${encodeURIComponent(provider)}#signup`);
    }
    const nonce = randomString(16);
    const state = await signState(env.CODE_PEPPER, { p: provider, t: Date.now(), lang, ref, hotel, nonce });
    if (provider === 'google') {
      const q = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: callbackUrl, response_type: 'code', scope: 'openid email profile', state, prompt: 'select_account' });
      return redirect('https://accounts.google.com/o/oauth2/v2/auth?' + q);
    }
    if (provider === 'yandex') {
      const q = new URLSearchParams({ client_id: env.YANDEX_CLIENT_ID, redirect_uri: callbackUrl, response_type: 'code', state, force_confirm: 'yes' });
      return redirect('https://oauth.yandex.com/authorize?' + q);
    }
    if (provider === 'facebook') {
      const q = new URLSearchParams({ client_id: env.FACEBOOK_CLIENT_ID, redirect_uri: callbackUrl, response_type: 'code', scope: 'email,public_profile', state });
      return redirect('https://www.facebook.com/v19.0/dialog/oauth?' + q);
    }
    if (provider === 'apple') {
      const q = new URLSearchParams({ client_id: env.APPLE_CLIENT_ID, redirect_uri: callbackUrl, response_type: 'code id_token', response_mode: 'form_post', scope: 'name email', state, nonce });
      return redirect('https://appleid.apple.com/auth/authorize?' + q);
    }
  }

  // OAuth callback: exchange authorization code (or verify Apple id_token) and create a session.
  let params = url.searchParams;
  if (request.method === 'POST') {
    const formText = await request.text();
    params = new URLSearchParams(formText);
  }
  const st = env.CODE_PEPPER ? await verifyState(env.CODE_PEPPER, params.get('state') || '') : null;
  if (!st || st.p !== provider || params.get('error')) {
    return redirect(`${pubOrigin}/account.html?oauth_error=${encodeURIComponent(provider)}#signup`);
  }
  try {
    let email = '', name = '';
    if (provider === 'google') {
      const tokRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code: params.get('code') || '', client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: callbackUrl, grant_type: 'authorization_code' })
      });
      if (!tokRes.ok) throw 0;
      const tok = await tokRes.json();
      const uRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: 'Bearer ' + tok.access_token } });
      if (!uRes.ok) throw 0;
      const u = await uRes.json();
      email = u.email || ''; name = u.name || '';
    } else if (provider === 'yandex') {
      const tokRes = await fetch('https://oauth.yandex.com/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code: params.get('code') || '', client_id: env.YANDEX_CLIENT_ID, client_secret: env.YANDEX_CLIENT_SECRET, grant_type: 'authorization_code' })
      });
      if (!tokRes.ok) throw 0;
      const tok = await tokRes.json();
      const uRes = await fetch('https://login.yandex.ru/info?format=json', { headers: { Authorization: 'OAuth ' + tok.access_token } });
      if (!uRes.ok) throw 0;
      const u = await uRes.json();
      email = u.default_email || (Array.isArray(u.emails) && u.emails[0]) || '';
      name = u.real_name || u.display_name || '';
    } else if (provider === 'facebook') {
      const tUrl = 'https://graph.facebook.com/v19.0/oauth/access_token?' + new URLSearchParams({ client_id: env.FACEBOOK_CLIENT_ID, client_secret: env.FACEBOOK_CLIENT_SECRET, redirect_uri: callbackUrl, code: params.get('code') || '' });
      const tokRes = await fetch(tUrl);
      if (!tokRes.ok) throw 0;
      const tok = await tokRes.json();
      const uRes = await fetch('https://graph.facebook.com/me?fields=id,name,email&access_token=' + encodeURIComponent(tok.access_token));
      if (!uRes.ok) throw 0;
      const u = await uRes.json();
      email = u.email || ''; name = u.name || '';
    } else if (provider === 'apple') {
      const claims = await verifyAppleIdToken(params.get('id_token'), env.APPLE_CLIENT_ID, st.nonce);
      if (!claims || !claims.email) throw 0;
      email = claims.email;
      if (params.get('user')) {
        try {
          const u = JSON.parse(params.get('user'));
          name = [u?.name?.firstName, u?.name?.lastName].filter(Boolean).join(' ');
        } catch {}
      }
    }
    if (!validEmail(email)) throw 0;
    const session = await createOrLoadMemberSession(env, email, { name, lang: st.lang, ref: st.ref, hotel: st.hotel });
    return redirect(`${pubOrigin}/account.html#oauth_token=${encodeURIComponent(session.token)}&oauth_provider=${encodeURIComponent(provider)}`);
  } catch {
    return redirect(`${pubOrigin}/account.html?oauth_error=${encodeURIComponent(provider)}#signup`);
  }
}

export async function handleMembers(request, env, url) {
  try {
    if (!env.DB) fail(503, 'Service unavailable');
    const p = url.pathname;
    if (p === '/v1/auth/providers' && request.method === 'GET') return json(enabledProviders(env));
    if (p.startsWith('/v1/auth/oauth/')) return await handleOAuth(request, env, url);
    if (request.method === 'GET' && p === '/v1/me') return json(await profile(env, await memberFromSession(request, env)));
    if (request.method !== 'POST') fail(405, 'Method not allowed');
    const body = await readJson(request);

    if (p === '/v1/auth/start') {
      if (!env.CODE_PEPPER) fail(503, 'Service unavailable');
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      if (!validEmail(email)) fail(400, 'Invalid e-mail');
      const lang = LANGS.includes(body.lang) ? body.lang : 'en';
      const recent = await env.DB.prepare(`SELECT COUNT(*) AS n FROM login_codes WHERE email=? AND created_at>?`).bind(email, sqlTime(new Date(Date.now() - 15 * 6e4))).first();
      if (recent.n >= CODES_PER_15_MIN) fail(429, 'Too many codes; try again later');
      const code = sixDigits();
      await env.DB.prepare(`INSERT INTO login_codes (id, email, code_hash, expires_at, created_at) VALUES (?,?,?,?,?)`)
        .bind(id(), email, await hmac(env.CODE_PEPPER, email + ':' + code), later(CODE_MINUTES * 6e4), sqlTime(new Date())).run();
      await sendCode(env, email, code, lang);
      // The same answer whether or not an account exists, so addresses cannot be probed.
      return json(env.DEV_RETURN_CODE === '1' && !env.RESEND_API_KEY ? { sent: true, devCode: code } : { sent: true });
    }

    if (p === '/v1/auth/verify') {
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      if (!validEmail(email) || typeof body.code !== 'string' || !/^\d{6}$/.test(body.code)) fail(400, 'Invalid code');
      const now = sqlTime(new Date());
      const row = await env.DB.prepare(`SELECT * FROM login_codes WHERE email=? AND used=0 AND expires_at>? ORDER BY created_at DESC LIMIT 1`).bind(email, now).first();
      if (!row) fail(400, 'Invalid or expired code');
      if (row.attempts >= CODE_MAX_TRIES) fail(429, 'Too many attempts; ask for a new code');
      if (!equal(row.code_hash, await hmac(env.CODE_PEPPER, email + ':' + body.code))) {
        await env.DB.prepare(`UPDATE login_codes SET attempts=attempts+1 WHERE id=?`).bind(row.id).run();
        fail(400, 'Invalid or expired code');
      }
      await env.DB.prepare(`UPDATE login_codes SET used=1 WHERE id=?`).bind(row.id).run();
      return json(await createOrLoadMemberSession(env, email, body));
    }

    if (p === '/v1/auth/logout') {
      const t = bearer(request);
      if (t) await env.DB.prepare(`DELETE FROM sessions WHERE token_hash=?`).bind(await sha256(t)).run();
      return json({ signedOut: true });
    }

    if (p === '/v1/me') {
      const m = await memberFromSession(request, env);
      const name = body.name === undefined ? m.name : str(body.name, 100);
      const lang = LANGS.includes(body.lang) ? body.lang : m.lang;
      const marketing = body.marketing === undefined ? m.marketing_consent : (body.marketing === true ? 1 : 0);
      await env.DB.prepare(`UPDATE members SET name=?, lang=?, marketing_consent=?, marketing_consent_at=? WHERE id=?`)
        .bind(name, lang, marketing, marketing ? (m.marketing_consent ? m.marketing_consent_at : sqlTime(new Date())) : null, m.id).run();
      return json(await profile(env, { ...m, name, lang, marketing_consent: marketing }));
    }

    if (p === '/v1/me/requests') {
      const m = await memberFromSession(request, env);
      const ref = str(body.ref, 40), serviceId = str(body.serviceId, 80);
      if (!ref || !/^[A-Z0-9-]{6,40}$/.test(ref) || !serviceId || !/^[a-z0-9-]+$/.test(serviceId) || !isoDate(body.date) || !Number.isInteger(body.guests) || body.guests < 1 || body.guests > 16) fail(400, 'Invalid request');
      let coupon = null;
      if (body.couponCode !== undefined && body.couponCode !== null && body.couponCode !== '') {
        coupon = await env.DB.prepare(`SELECT * FROM coupons WHERE code=? AND member_id=?`).bind(String(body.couponCode).toUpperCase(), m.id).first();
        if (!coupon || coupon.status !== 'issued' || coupon.expires_at <= sqlTime(new Date())) fail(409, 'Coupon not usable');
      }
      const stmts = [env.DB.prepare(`INSERT INTO member_requests (ref, member_id, service_id, service_date, guests, coupon_id) VALUES (?,?,?,?,?,?)`).bind(ref, m.id, serviceId, body.date, body.guests, coupon ? coupon.id : null)];
      if (coupon) stmts.push(env.DB.prepare(`UPDATE coupons SET status='held', held_ref=? WHERE id=? AND status='issued'`).bind(ref, coupon.id));
      try { await env.DB.batch(stmts); } catch { fail(409, 'Request already registered'); }
      return json({ ref, coupon: coupon ? { code: coupon.code, percentBps: coupon.percent_bps } : null });
    }

    if (p === '/v1/me/delete') {
      const m = await memberFromSession(request, env);
      // Requests and coupons go with the member (ON DELETE CASCADE); referrals by others are kept anonymous.
      await env.DB.batch([
        env.DB.prepare(`UPDATE members SET referred_by=NULL WHERE referred_by=?`).bind(m.id),
        env.DB.prepare(`DELETE FROM member_requests WHERE member_id=?`).bind(m.id),
        env.DB.prepare(`DELETE FROM coupons WHERE member_id=?`).bind(m.id),
        env.DB.prepare(`DELETE FROM sessions WHERE member_id=?`).bind(m.id),
        env.DB.prepare(`DELETE FROM login_codes WHERE email=?`).bind(m.email),
        env.DB.prepare(`DELETE FROM members WHERE id=?`).bind(m.id)
      ]);
      return json({ deleted: true });
    }

    if (p.startsWith('/v1/partner/')) {
      // Tour companies and hotel reception: look up a request by reference, apply the coupon, close it.
      if (!env.PARTNER_TOKEN || !equal(bearer(request), env.PARTNER_TOKEN)) fail(401, 'Unauthorized');
      const ref = str(body.ref, 40);
      if (!ref) fail(400, 'Invalid reference');
      const r = await env.DB.prepare(
        `SELECT r.*, c.code AS coupon_code, c.percent_bps, c.status AS coupon_status, m.name AS member_name
         FROM member_requests r JOIN members m ON m.id=r.member_id LEFT JOIN coupons c ON c.id=r.coupon_id WHERE r.ref=?`).bind(ref).first();
      if (!r) fail(404, 'Unknown reference');
      const view = { ref: r.ref, serviceId: r.service_id, date: r.service_date, guests: r.guests, state: r.state,
        firstName: r.member_name ? r.member_name.split(/\s+/)[0] : null,
        coupon: r.coupon_code ? { code: r.coupon_code, percentBps: r.percent_bps, status: r.coupon_status } : null };
      if (p === '/v1/partner/lookup') return json(view);
      if (r.state !== 'requested') fail(409, 'Request already closed');
      const now = sqlTime(new Date());
      if (p === '/v1/partner/cancel') {
        await env.DB.batch([
          env.DB.prepare(`UPDATE member_requests SET state='cancelled', closed_at=? WHERE ref=? AND state='requested'`).bind(now, ref),
          env.DB.prepare(`UPDATE coupons SET status='issued', held_ref=NULL WHERE held_ref=? AND status='held'`).bind(ref)
        ]);
        return json({ ...view, state: 'cancelled', coupon: view.coupon ? { ...view.coupon, status: 'issued' } : null });
      }
      if (p === '/v1/partner/fulfil') {
        await env.DB.batch([
          env.DB.prepare(`UPDATE member_requests SET state='fulfilled', closed_at=? WHERE ref=? AND state='requested'`).bind(now, ref),
          env.DB.prepare(`UPDATE coupons SET status='redeemed', redeemed_at=? WHERE held_ref=? AND status='held'`).bind(now, ref),
          env.DB.prepare(`UPDATE members SET stamps=stamps+1 WHERE id=?`).bind(r.member_id)
        ]);
        const issued = [];
        const m = await env.DB.prepare(`SELECT * FROM members WHERE id=?`).bind(r.member_id).first();
        const done = await env.DB.prepare(`SELECT COUNT(*) AS n FROM member_requests WHERE member_id=? AND state='fulfilled'`).bind(m.id).first();
        if (done.n === 1 && await issue(env, m.id, 'second_tour')) issued.push('second_tour');
        if (m.stamps >= STAMPS_GOAL && await issue(env, m.id, 'loyalty')) {
          await env.DB.prepare(`UPDATE members SET stamps=stamps-? WHERE id=?`).bind(STAMPS_GOAL, m.id).run();
          issued.push('loyalty');
        }
        if (m.referred_by && !m.referral_rewarded) {
          const ok = await env.DB.prepare(`UPDATE members SET referral_rewarded=1 WHERE id=? AND referral_rewarded=0`).bind(m.id).run();
          if (ok.meta.changes && await issue(env, m.referred_by, 'referral')) issued.push('referral');
        }
        return json({ ...view, state: 'fulfilled', coupon: view.coupon ? { ...view.coupon, status: 'redeemed' } : null, issued });
      }
    }

    if (p === '/v1/admin/campaigns') {
      if (!env.ADMIN_TOKEN || !equal(bearer(request), env.ADMIN_TOKEN)) fail(401, 'Unauthorized');
      const cid = str(body.id, 60);
      const kinds = ['welcome', 'referral', 'hotel', 'second_tour', 'loyalty'];
      if (!cid || !kinds.includes(body.kind) || !Number.isInteger(body.percentBps) || body.percentBps < 1 || !Number.isInteger(body.validDays) || body.validDays < 1 || body.validDays > 730) fail(400, 'Invalid campaign');
      if (body.percentBps > maxBps(env)) fail(400, 'Discount above the commission cap (MAX_DISCOUNT_BPS)');
      if (body.kind === 'hotel' && !str(body.hotelId, 60)) fail(400, 'Hotel campaign needs hotelId');
      await env.DB.prepare(
        `INSERT INTO campaigns (id, kind, percent_bps, valid_days, hotel_id, active, ends_at) VALUES (?,?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET percent_bps=excluded.percent_bps, valid_days=excluded.valid_days, active=excluded.active, ends_at=excluded.ends_at`)
        .bind(cid, body.kind, body.percentBps, body.validDays, body.kind === 'hotel' ? body.hotelId.trim() : null, body.active === false ? 0 : 1, str(body.endsAt, 19)).run();
      return json({ saved: cid });
    }
    fail(404, 'Not found');
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    return json({ error: 'Invalid request or unavailable service' }, 400);
  }
}
