// Membership, sign-in by e-mailed one-time code, campaigns and coupons.
// Discounts are funded from Bosphorly's commission; MAX_DISCOUNT_BPS (default 10 %) caps every coupon
// so a discount can never exceed what the commission can carry.
//
// Coupon life cycle: issued -> held (attached to one WhatsApp request) -> redeemed (request fulfilled)
//                    held -> issued again if the request is cancelled. One coupon per request.
// Rewards follow completed tours, not sign-ups: the referral, second-tour and loyalty coupons are issued
// only when a partner marks a member's request as fulfilled.

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} from '@simplewebauthn/server';

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

function b64ToUint8Array(b64) {
  const pad = b64.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(pad + '='.repeat((4 - (pad.length % 4)) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function uint8ArrayToB64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
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

async function readJson(request, maxBytes = 4096) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) fail(415, 'JSON required');
  const text = await request.text();
  if (enc.encode(text).length > maxBytes) fail(413, 'Payload too large');
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

const ALLOWED_INTERESTS = new Set(['cruise', 'transfer', 'oldcity', 'hammam', 'private']);
function sanitizeInterests(val) {
  if (!Array.isArray(val)) return [];
  const out = [];
  for (const x of val) {
    if (typeof x === 'string' && ALLOWED_INTERESTS.has(x) && !out.includes(x)) out.push(x);
    if (out.length >= 5) break;
  }
  return out;
}
function parseInterests(raw) {
  if (!raw) return [];
  try { return sanitizeInterests(JSON.parse(raw)); } catch { return []; }
}
function tierInfo(env, fulfilledCount) {
  const cap = maxBps(env);
  if (fulfilledCount >= 5) {
    return { tier: 'platinum', nextTier: null, toursToNextTier: 0, vipPriorityDiscountBps: cap, freeUpgrade: 'priority' };
  }
  if (fulfilledCount >= 2) {
    return { tier: 'gold', nextTier: 'platinum', toursToNextTier: 5 - fulfilledCount, vipPriorityDiscountBps: Math.min(500, cap), freeUpgrade: 'eligible' };
  }
  return { tier: 'silver', nextTier: 'gold', toursToNextTier: 2 - fulfilledCount, vipPriorityDiscountBps: 0, freeUpgrade: 'none' };
}

async function profile(env, m) {
  const now = sqlTime(new Date());
  const coupons = (await env.DB.prepare(
    `SELECT c.code, c.percent_bps, c.status, c.expires_at, c.held_ref, k.kind FROM coupons c JOIN campaigns k ON k.id=c.campaign_id
     WHERE c.member_id=? ORDER BY c.issued_at DESC, c.code`).bind(m.id).all()).results
    .map(c => ({ code: c.code, kind: c.kind, percentBps: c.percent_bps, expiresAt: c.expires_at, heldFor: c.held_ref,
      status: c.status === 'issued' && c.expires_at <= now ? 'expired' : c.status }));
  const requests = (await env.DB.prepare(
    `SELECT r.ref, r.service_id, r.service_date, r.guests, r.state, r.req_type, r.title, r.operator, r.service_time, r.total_text, r.notes, r.created_at, c.code AS coupon_code, c.percent_bps
     FROM member_requests r LEFT JOIN coupons c ON c.id=r.coupon_id
     WHERE r.member_id=? ORDER BY r.created_at DESC LIMIT 50`).bind(m.id).all()).results
    .map(r => ({
      ref: r.ref, serviceId: r.service_id, date: r.service_date, guests: r.guests, state: r.state,
      type: r.req_type || null, title: r.title || null, operator: r.operator || null,
      time: r.service_time || null, total: r.total_text || null, notes: r.notes || null,
      createdAt: r.created_at || null,
      couponCode: r.coupon_code || null, percentBps: r.percent_bps || null
    }));
  const doneRow = await env.DB.prepare(`SELECT COUNT(*) AS n FROM member_requests WHERE member_id=? AND state='fulfilled'`).bind(m.id).first();
  const fulfilledCount = Number(doneRow?.n || 0);
  const ti = tierInfo(env, fulfilledCount);
  let passkeys = [];
  try {
    passkeys = (await env.DB.prepare(
      `SELECT credential_id AS id, created_at AS createdAt, last_used_at AS lastUsedAt FROM passkeys WHERE member_id=? ORDER BY created_at DESC`).bind(m.id).all()).results;
  } catch {}
  return {
    email: m.email, name: m.name, phone: m.phone || null, hotel: m.hotel || null, room: m.room || null,
    lang: m.lang, country: m.country || null, interests: parseInterests(m.interests),
    referralCode: m.referral_code, marketing: !!m.marketing_consent,
    stamps: m.stamps, stampsGoal: STAMPS_GOAL, fulfilledCount, ...ti, coupons, requests, passkeys
  };
}

// --- routes -------------------------------------------------------------------------------------------
const ROUTES = new Set(['/v1/auth/start', '/v1/auth/verify', '/v1/auth/logout', '/v1/auth/providers', '/v1/me', '/v1/me/requests', '/v1/me/requests/delete', '/v1/me/delete',
  '/v1/newsletter/subscribe', '/v1/newsletter/unsubscribe', '/v1/admin/newsletter/send',
  '/v1/partner/lookup', '/v1/partner/fulfil', '/v1/partner/cancel', '/v1/admin/campaigns',
  '/v1/passkeys', '/v1/passkeys/register/options', '/v1/passkeys/register/verify',
  '/v1/passkeys/login/options', '/v1/passkeys/login/verify', '/v1/passkeys/delete']);
const OAUTH_PROVIDERS = new Set(['google', 'yandex', 'facebook', 'apple', 'microsoft', 'telegram']);
export const isMemberRoute = path => ROUTES.has(path) || path.startsWith('/v1/auth/oauth/') || path.startsWith('/v1/passkeys');

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
    apple: !!env.APPLE_CLIENT_ID,
    microsoft: !!(env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET),
    telegram: !!env.TELEGRAM_BOT_TOKEN
  };
}

export async function signState(pepper, obj) {
  const payload = b64urlEncode(JSON.stringify(obj));
  const sig = await hmac(pepper, payload);
  return payload + '.' + sig;
}

export async function verifyState(pepper, stateStr) {
  if (typeof stateStr !== 'string' || !stateStr.includes('.')) return null;
  const [payload, sig] = stateStr.split('.');
  if (!payload || !sig || !equal(sig, await hmac(pepper, payload))) return null;
  try {
    const data = JSON.parse(b64urlDecode(payload));
    if (!data || typeof data.t !== 'number' || Math.abs(Date.now() - data.t) > 15 * 60 * 1000) return null;
    return data;
  } catch { return null; }
}

async function syncNewsletterRow(env, email, lang, interestsArr, active, source = 'member') {
  const now = sqlTime(new Date());
  const interestsJson = interestsArr && interestsArr.length ? JSON.stringify(interestsArr) : null;
  if (active) {
    await env.DB.prepare(
      `INSERT INTO newsletter_subscribers (email, lang, interests, source, active, subscribed_at, unsubscribed_at) VALUES (?,?,?,?,1,?,NULL)
       ON CONFLICT(email) DO UPDATE SET lang=excluded.lang, interests=COALESCE(excluded.interests, newsletter_subscribers.interests), active=1, subscribed_at=excluded.subscribed_at, unsubscribed_at=NULL`)
      .bind(email, lang, interestsJson, source, now).run();
  } else {
    await env.DB.prepare(`UPDATE newsletter_subscribers SET active=0, unsubscribed_at=? WHERE email=?`).bind(now, email).run();
  }
}

async function createOrLoadMemberSession(env, rawEmail, body = {}) {
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
  if (!validEmail(email)) fail(400, 'Invalid e-mail');
  const now = sqlTime(new Date());
  let m = await env.DB.prepare(`SELECT * FROM members WHERE email=?`).bind(email).first();
  const created = !m;
  const cleanInterests = sanitizeInterests(body.interests);
  const cleanCountry = str(body.country, 80);
  const cleanName = str(body.name, 100);
  const cleanPhone = str(body.phone, 40);
  const cleanHotelName = str(body.hotelName, 140);
  const cleanRoom = str(body.room, 24);
  const lang = LANGS.includes(body.lang) ? body.lang : 'en';
  if (!m) {
    const referrer = str(body.ref, 20) ? await env.DB.prepare(`SELECT id FROM members WHERE referral_code=?`).bind(body.ref.trim().toUpperCase()).first() : null;
    const hotel = str(body.hotel, 60) ? await env.DB.prepare(`SELECT id FROM hotels WHERE id=? AND status='verified'`).bind(body.hotel.trim()).first() : null;
    const marketing = body.marketing === true;
    const mid = id();
    let code = randomString(8);
    for (let i = 0; i < 3 && await env.DB.prepare(`SELECT 1 AS x FROM members WHERE referral_code=?`).bind(code).first(); i++) code = randomString(8);
    await env.DB.prepare(`INSERT INTO members (id, email, name, phone, hotel, room, lang, country, interests, referral_code, referred_by, hotel_id, marketing_consent, marketing_consent_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(mid, email, cleanName, cleanPhone, cleanHotelName, cleanRoom, lang, cleanCountry, cleanInterests.length ? JSON.stringify(cleanInterests) : null, code, referrer ? referrer.id : null, hotel ? hotel.id : null, marketing ? 1 : 0, marketing ? now : null).run();
    if (marketing) await syncNewsletterRow(env, email, lang, cleanInterests, true, 'signup');
    await issue(env, mid, 'welcome');
    if (hotel) await issue(env, mid, 'hotel', hotel.id);
    m = await env.DB.prepare(`SELECT * FROM members WHERE id=?`).bind(mid).first();
  } else {
    const nextName = !m.name && cleanName ? cleanName : m.name;
    const nextPhone = !m.phone && cleanPhone ? cleanPhone : m.phone;
    const nextHotel = !m.hotel && cleanHotelName ? cleanHotelName : m.hotel;
    const nextRoom = !m.room && cleanRoom ? cleanRoom : m.room;
    const nextCountry = !m.country && cleanCountry ? cleanCountry : m.country;
    const nextInterests = !m.interests && cleanInterests.length ? JSON.stringify(cleanInterests) : m.interests;
    if (nextName !== m.name || nextPhone !== m.phone || nextHotel !== m.hotel || nextRoom !== m.room || nextCountry !== m.country || nextInterests !== m.interests) {
      await env.DB.prepare(`UPDATE members SET name=?, phone=?, hotel=?, room=?, country=?, interests=? WHERE id=?`)
        .bind(nextName, nextPhone, nextHotel, nextRoom, nextCountry, nextInterests, m.id).run();
      m = { ...m, name: nextName, phone: nextPhone, hotel: nextHotel, room: nextRoom, country: nextCountry, interests: nextInterests };
    }
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

export async function verifyMicrosoftIdToken(idToken, clientId, expectedNonce) {
  const parts = String(idToken || '').split('.');
  if (parts.length !== 3) return null;
  let header, claims;
  try { header = JSON.parse(b64urlDecode(parts[0])); claims = JSON.parse(b64urlDecode(parts[1])); } catch { return null; }
  if (!header.kid || claims.aud !== clientId) return null;
  if (!claims.exp || claims.exp * 1000 < Date.now()) return null;
  if (expectedNonce && claims.nonce !== expectedNonce) return null;
  if (!claims.tid || typeof claims.iss !== 'string' || claims.iss !== `https://login.microsoftonline.com/${claims.tid}/v2.0`) return null;
  const jwksRes = await fetch('https://login.microsoftonline.com/common/discovery/v2.0/keys');
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
    const phone = str(url.searchParams.get('phone'), 40);
    const hotelName = str(url.searchParams.get('hotelName'), 140);
    const country = str(url.searchParams.get('country'), 80);
    const interests = sanitizeInterests((url.searchParams.get('interests') || '').split(',').map(x => x.trim()).filter(Boolean));
    const marketing = url.searchParams.get('marketing') === '1';
    if (!avail[provider] || !env.CODE_PEPPER) {
      return redirect(`${pubOrigin}/account.html?oauth_error=${encodeURIComponent(provider)}#signup`);
    }
    const nonce = randomString(16);
    const state = await signState(env.CODE_PEPPER, { p: provider, t: Date.now(), lang, ref, hotel, phone, hotelName, country, interests, marketing, nonce });
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
    if (provider === 'microsoft') {
      const q = new URLSearchParams({ client_id: env.MICROSOFT_CLIENT_ID, redirect_uri: callbackUrl, response_type: 'code', scope: 'openid email profile', state, nonce });
      return redirect('https://login.microsoftonline.com/common/oauth2/v2.0/authorize?' + q);
    }
    if (provider === 'telegram') {
      return redirect(`${pubOrigin}/account.html?oauth_error=telegram#signup`);
    }
  }

  // OAuth callback: exchange authorization code (or verify Apple/Microsoft id_token / Telegram HMAC) and create a session.
  let params = url.searchParams;
  if (request.method === 'POST') {
    const formText = await request.text();
    params = new URLSearchParams(formText);
  }

  if (provider === 'telegram') {
    if (!isCallback || request.method !== 'GET') fail(405, 'Method not allowed');
    if (!env.TELEGRAM_BOT_TOKEN) return redirect(`${pubOrigin}/account.html?oauth_error=telegram#signup`);
    const authDate = parseInt(params.get('auth_date') || '0', 10);
    const nowSec = Math.floor(Date.now() / 1000);
    if (!authDate || Math.abs(nowSec - authDate) > 600) {
      return redirect(`${pubOrigin}/account.html?oauth_error=telegram#signup`);
    }
    const checkKeys = [...params.keys()].filter(k => k !== 'hash').sort();
    const dataCheckString = checkKeys.map(k => `${k}=${params.get(k)}`).join('\n');
    const secretKey = await crypto.subtle.digest('SHA-256', enc.encode(env.TELEGRAM_BOT_TOKEN));
    const hmacKey = await crypto.subtle.importKey('raw', secretKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = hex(await crypto.subtle.sign('HMAC', hmacKey, enc.encode(dataCheckString)));
    if (!equal(sig, params.get('hash') || '')) {
      return redirect(`${pubOrigin}/account.html?oauth_error=telegram#signup`);
    }
    const telegramId = String(params.get('id') || '');
    if (!telegramId) return redirect(`${pubOrigin}/account.html?oauth_error=telegram#signup`);
    const ident = await env.DB.prepare(`SELECT member_id FROM member_identities WHERE provider='telegram' AND subject=?`).bind(telegramId).first();
    if (ident) {
      const m = await env.DB.prepare(`SELECT * FROM members WHERE id=?`).bind(ident.member_id).first();
      if (m) {
        const t = token();
        await env.DB.prepare(`INSERT INTO sessions (token_hash, member_id, expires_at) VALUES (?,?,?)`).bind(await sha256(t), m.id, later(SESSION_DAYS * 864e5)).run();
        return redirect(`${pubOrigin}/account.html#oauth_token=${encodeURIComponent(t)}&oauth_provider=telegram`);
      }
    }
    const linkState = await signState(env.CODE_PEPPER, { p: 'telegram_link', sub: telegramId, t: Date.now() });
    return redirect(`${pubOrigin}/account.html#link-telegram&state=${encodeURIComponent(linkState)}`);
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
      if (u.email_verified !== true) throw 0;
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
    } else if (provider === 'microsoft') {
      const tokRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code: params.get('code') || '', client_id: env.MICROSOFT_CLIENT_ID, client_secret: env.MICROSOFT_CLIENT_SECRET, redirect_uri: callbackUrl, grant_type: 'authorization_code' })
      });
      if (!tokRes.ok) throw 0;
      const tok = await tokRes.json();
      const claims = await verifyMicrosoftIdToken(tok.id_token, env.MICROSOFT_CLIENT_ID, st.nonce);
      if (!claims) throw 0;
      if (claims.email_verified !== undefined && claims.email_verified !== true) throw 0;
      if (typeof claims.email === 'string' && claims.email.trim()) {
        email = claims.email.trim();
      } else if (typeof claims.preferred_username === 'string' && claims.preferred_username.includes('@')) {
        email = claims.preferred_username.trim();
      } else {
        throw 0;
      }
      name = claims.name || '';
    }
    if (!validEmail(email)) throw 0;
    const session = await createOrLoadMemberSession(env, email, {
      name, lang: st.lang, ref: st.ref, hotel: st.hotel,
      phone: st.phone, hotelName: st.hotelName,
      country: st.country, interests: st.interests, marketing: !!st.marketing
    });
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
    if (request.method === 'GET' && p === '/v1/passkeys') {
      const m = await memberFromSession(request, env);
      const list = (await env.DB.prepare(`SELECT credential_id AS id, created_at AS createdAt, last_used_at AS lastUsedAt, transports FROM passkeys WHERE member_id=? ORDER BY created_at DESC`).bind(m.id).all()).results;
      return json({ passkeys: list });
    }
    if (request.method === 'GET' && p === '/v1/newsletter/unsubscribe') {
      const email = (url.searchParams.get('email') || '').trim().toLowerCase();
      const sig = url.searchParams.get('sig') || '';
      if (!validEmail(email) || !env.CODE_PEPPER || !equal(sig, await hmac(env.CODE_PEPPER, 'unsub:' + email))) fail(400, 'Invalid unsubscribe link');
      await env.DB.batch([
        env.DB.prepare(`UPDATE newsletter_subscribers SET active=0, unsubscribed_at=? WHERE email=?`).bind(sqlTime(new Date()), email),
        env.DB.prepare(`UPDATE members SET marketing_consent=0, marketing_consent_at=NULL WHERE email=?`).bind(email)
      ]);
      return new Response('<!doctype html><meta charset="utf-8"><title>Bosphorly</title><body style="font-family:system-ui,sans-serif;max-width:520px;margin:60px auto;padding:24px;color:#111"><h1>Newsletter unsubscribed</h1><p>You have been unsubscribed from Bosphorly newsletter updates.</p></body>', { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
    }
    if (request.method !== 'POST') fail(405, 'Method not allowed');
    const body = await readJson(request, p === '/v1/admin/newsletter/send' ? 65536 : 4096);

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
      const sessionResult = await createOrLoadMemberSession(env, email, body);
      const linkTok = body.linkToken || body.linkState || body.telegramLinkToken;
      if (linkTok && env.CODE_PEPPER) {
        const st = await verifyState(env.CODE_PEPPER, linkTok);
        if (st && st.p === 'telegram_link' && st.sub && Math.abs(Date.now() - st.t) <= 10 * 60 * 1000) {
          const mid = (await env.DB.prepare(`SELECT id FROM members WHERE email=?`).bind(email).first())?.id;
          if (mid) {
            await env.DB.prepare(`INSERT OR REPLACE INTO member_identities (provider, subject, member_id, created_at) VALUES (?,?,?,?)`)
              .bind('telegram', String(st.sub), mid, sqlTime(new Date())).run();
          }
        }
      }
      return json(sessionResult);
    }

    if (p === '/v1/passkeys/register/options') {
      const m = await memberFromSession(request, env);
      const rpID = env.PASSKEY_RP_ID || 'bosphorly.com';
      const existing = (await env.DB.prepare(`SELECT credential_id, transports FROM passkeys WHERE member_id=?`).bind(m.id).all()).results;
      const excludeCredentials = existing.map(k => ({
        id: k.credential_id,
        transports: k.transports ? JSON.parse(k.transports) : undefined
      }));
      const options = await generateRegistrationOptions({
        rpName: 'Bosphorly',
        rpID,
        userName: m.email,
        userID: new TextEncoder().encode(m.id),
        excludeCredentials,
        timeout: 60000,
        attestationType: 'none',
        authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' }
      });
      await env.DB.prepare(`INSERT OR REPLACE INTO passkey_challenges (id, challenge, member_id, purpose, expires_at, created_at) VALUES (?,?,?,?,?,?)`)
        .bind(id(), options.challenge, m.id, 'registration', later(5 * 60 * 1000), sqlTime(new Date())).run();
      return json(options);
    }

    if (p === '/v1/passkeys/register/verify') {
      const m = await memberFromSession(request, env);
      const pubOrigin = (env.PUBLIC_ORIGIN || 'https://bosphorly.com').replace(/\/+$/, '');
      const rpID = Array.from(new Set([env.PASSKEY_RP_ID || 'bosphorly.com', 'bosphorly.com', url.hostname]));
      const originList = Array.from(new Set(['https://bosphorly.com', 'https://www.bosphorly.com', pubOrigin, url.origin].filter(Boolean)));

      const clientDataRaw = body?.response?.clientDataJSON;
      if (!clientDataRaw) fail(400, 'Invalid passkey response');
      let clientData;
      try { clientData = JSON.parse(b64urlDecode(clientDataRaw)); } catch { fail(400, 'Invalid clientDataJSON'); }
      const ch = clientData.challenge;
      if (!ch) fail(400, 'Challenge missing');

      const chRow = await env.DB.prepare(`SELECT * FROM passkey_challenges WHERE challenge=? AND member_id=? AND purpose='registration' AND expires_at>?`).bind(ch, m.id, sqlTime(new Date())).first();
      if (!chRow) fail(400, 'Invalid or expired challenge');
      await env.DB.prepare(`DELETE FROM passkey_challenges WHERE id=?`).bind(chRow.id).run();

      const verification = await verifyRegistrationResponse({
        response: body,
        expectedChallenge: ch,
        expectedOrigin: originList,
        expectedRPID: rpID
      });
      if (!verification.verified || !verification.registrationInfo) fail(400, 'Registration verification failed');
      const { credential } = verification.registrationInfo;
      const credentialID = credential.id;
      const publicKey = uint8ArrayToB64(credential.publicKey);
      const counter = credential.counter || 0;
      const now = sqlTime(new Date());
      await env.DB.prepare(`INSERT OR REPLACE INTO passkeys (credential_id, member_id, public_key, counter, transports, created_at) VALUES (?,?,?,?,?,?)`)
        .bind(credentialID, m.id, publicKey, counter, transports, now).run();
      return json({ verified: true, passkey: { id: credentialID, createdAt: now, lastUsedAt: null } });
    }

    if (p === '/v1/passkeys/login/options') {
      const rpID = env.PASSKEY_RP_ID || 'bosphorly.com';
      const options = await generateAuthenticationOptions({
        rpID,
        timeout: 60000,
        userVerification: 'preferred'
      });
      await env.DB.prepare(`INSERT OR REPLACE INTO passkey_challenges (id, challenge, member_id, purpose, expires_at, created_at) VALUES (?,?,NULL,'authentication',?,?)`)
        .bind(id(), options.challenge, later(5 * 60 * 1000), sqlTime(new Date())).run();
      return json(options);
    }

    if (p === '/v1/passkeys/login/verify') {
      const pubOrigin = (env.PUBLIC_ORIGIN || 'https://bosphorly.com').replace(/\/+$/, '');
      const rpID = Array.from(new Set([env.PASSKEY_RP_ID || 'bosphorly.com', 'bosphorly.com', url.hostname]));
      const originList = Array.from(new Set(['https://bosphorly.com', 'https://www.bosphorly.com', pubOrigin, url.origin].filter(Boolean)));

      const clientDataRaw = body?.response?.clientDataJSON;
      if (!clientDataRaw) fail(400, 'Invalid passkey response');
      let clientData;
      try { clientData = JSON.parse(b64urlDecode(clientDataRaw)); } catch { fail(400, 'Invalid clientDataJSON'); }
      const ch = clientData.challenge;
      if (!ch) fail(400, 'Challenge missing');

      const chRow = await env.DB.prepare(`SELECT * FROM passkey_challenges WHERE challenge=? AND purpose='authentication' AND expires_at>?`).bind(ch, sqlTime(new Date())).first();
      if (!chRow) fail(400, 'Invalid or expired challenge');
      await env.DB.prepare(`DELETE FROM passkey_challenges WHERE id=?`).bind(chRow.id).run();

      const credId = body.id || body.rawId;
      if (!credId) fail(400, 'Missing credential id');
      const passkey = await env.DB.prepare(`SELECT * FROM passkeys WHERE credential_id=?`).bind(credId).first();
      if (!passkey) fail(400, 'Passkey not recognized');

      const m = await env.DB.prepare(`SELECT * FROM members WHERE id=?`).bind(passkey.member_id).first();
      if (!m) fail(400, 'Member not found');

      const verification = await verifyAuthenticationResponse({
        response: body,
        expectedChallenge: ch,
        expectedOrigin: originList,
        expectedRPID: rpID,
        credential: {
          id: passkey.credential_id,
          publicKey: b64ToUint8Array(passkey.public_key),
          counter: passkey.counter || 0,
          transports: passkey.transports ? JSON.parse(passkey.transports) : undefined
        }
      });
      if (!verification.verified) fail(400, 'Authentication verification failed');
      await env.DB.prepare(`UPDATE passkeys SET counter=?, last_used_at=? WHERE credential_id=?`)
        .bind(verification.authenticationInfo.newCounter, sqlTime(new Date()), passkey.credential_id).run();

      const t = token();
      await env.DB.prepare(`INSERT INTO sessions (token_hash, member_id, expires_at) VALUES (?,?,?)`).bind(await sha256(t), m.id, later(SESSION_DAYS * 864e5)).run();
      return json({ token: t, member: await profile(env, m) });
    }

    if (p === '/v1/passkeys/delete') {
      const m = await memberFromSession(request, env);
      const credId = str(body?.id, 255);
      if (!credId) fail(400, 'Invalid credential id');
      await env.DB.prepare(`DELETE FROM passkeys WHERE credential_id=? AND member_id=?`).bind(credId, m.id).run();
      return json({ deleted: true });
    }

    if (p === '/v1/auth/logout') {
      const t = bearer(request);
      if (t) await env.DB.prepare(`DELETE FROM sessions WHERE token_hash=?`).bind(await sha256(t)).run();
      return json({ signedOut: true });
    }

    if (p === '/v1/me') {
      const m = await memberFromSession(request, env);
      const name = body.name === undefined ? m.name : str(body.name, 100);
      const phone = body.phone === undefined ? m.phone : str(body.phone, 40);
      const hotel = (body.hotel === undefined && body.hotelName === undefined) ? m.hotel : str(body.hotel !== undefined ? body.hotel : body.hotelName, 140);
      const room = body.room === undefined ? m.room : str(body.room, 24);
      const lang = LANGS.includes(body.lang) ? body.lang : m.lang;
      const country = body.country === undefined ? m.country : str(body.country, 80);
      const nextInterestsArr = body.interests === undefined ? parseInterests(m.interests) : sanitizeInterests(body.interests);
      const interests = nextInterestsArr.length ? JSON.stringify(nextInterestsArr) : null;
      const marketing = body.marketing === undefined ? m.marketing_consent : (body.marketing === true ? 1 : 0);
      const consentAt = marketing ? (m.marketing_consent ? m.marketing_consent_at : sqlTime(new Date())) : null;
      await env.DB.prepare(`UPDATE members SET name=?, phone=?, hotel=?, room=?, lang=?, country=?, interests=?, marketing_consent=?, marketing_consent_at=? WHERE id=?`)
        .bind(name, phone, hotel, room, lang, country, interests, marketing, consentAt, m.id).run();
      if (marketing) await syncNewsletterRow(env, m.email, lang, nextInterestsArr, true, 'member');
      else if (body.marketing === false) await syncNewsletterRow(env, m.email, lang, [], false);
      return json(await profile(env, { ...m, name, phone, hotel, room, lang, country, interests, marketing_consent: marketing, marketing_consent_at: consentAt }));
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
      const reqType = str(body.type, 24), title = str(body.title, 160), operator = str(body.operator, 120);
      const serviceTime = str(body.time, 24), totalText = str(body.total, 80), notes = str(body.notes, 500);
      const stmts = [env.DB.prepare(
        `INSERT INTO member_requests (ref, member_id, service_id, service_date, guests, coupon_id, req_type, title, operator, service_time, total_text, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
      ).bind(ref, m.id, serviceId, body.date, body.guests, coupon ? coupon.id : null, reqType, title, operator, serviceTime, totalText, notes)];
      if (coupon) stmts.push(env.DB.prepare(`UPDATE coupons SET status='held', held_ref=? WHERE id=? AND status='issued'`).bind(ref, coupon.id));
      try { await env.DB.batch(stmts); } catch { fail(409, 'Request already registered'); }
      return json({ ref, coupon: coupon ? { code: coupon.code, percentBps: coupon.percent_bps } : null });
    }

    if (p === '/v1/me/requests/delete') {
      const m = await memberFromSession(request, env);
      const ref = str(body.ref, 40);
      if (!ref || !/^[A-Z0-9-]{6,40}$/.test(ref)) fail(400, 'Invalid reference');
      const existing = await env.DB.prepare(`SELECT ref, state FROM member_requests WHERE ref=? AND member_id=?`).bind(ref, m.id).first();
      if (existing && existing.state === 'fulfilled') fail(409, 'Completed request cannot be removed');
      if (existing) {
        await env.DB.batch([
          env.DB.prepare(`UPDATE coupons SET status='issued', held_ref=NULL WHERE held_ref=? AND member_id=? AND status='held'`).bind(ref, m.id),
          env.DB.prepare(`DELETE FROM member_requests WHERE ref=? AND member_id=? AND state!='fulfilled'`).bind(ref, m.id)
        ]);
      }
      return json({ removed: true, member: await profile(env, m) });
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
        env.DB.prepare(`DELETE FROM newsletter_subscribers WHERE email=?`).bind(m.email),
        env.DB.prepare(`DELETE FROM passkeys WHERE member_id=?`).bind(m.id),
        env.DB.prepare(`DELETE FROM passkey_challenges WHERE member_id=?`).bind(m.id),
        env.DB.prepare(`DELETE FROM member_identities WHERE member_id=?`).bind(m.id),
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
        `SELECT r.*, c.code AS coupon_code, c.percent_bps, c.status AS coupon_status, m.name AS member_name,
                (SELECT COUNT(*) FROM member_requests x WHERE x.member_id=m.id AND x.state='fulfilled') AS fulfilled_count
         FROM member_requests r JOIN members m ON m.id=r.member_id LEFT JOIN coupons c ON c.id=r.coupon_id WHERE r.ref=?`).bind(ref).first();
      if (!r) fail(404, 'Unknown reference');
      const ti = tierInfo(env, Number(r.fulfilled_count || 0));
      const view = { ref: r.ref, serviceId: r.service_id, date: r.service_date, guests: r.guests, state: r.state,
        firstName: r.member_name ? r.member_name.split(/\s+/)[0] : null,
        tier: ti.tier, freeUpgrade: ti.freeUpgrade, vipPriorityDiscountBps: ti.vipPriorityDiscountBps,
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
        const nextTier = tierInfo(env, Number(done.n || 0));
        return json({ ...view, state: 'fulfilled', tier: nextTier.tier, freeUpgrade: nextTier.freeUpgrade, vipPriorityDiscountBps: nextTier.vipPriorityDiscountBps,
          coupon: view.coupon ? { ...view.coupon, status: 'redeemed' } : null, issued });
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

    if (p === '/v1/newsletter/subscribe') {
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      if (!validEmail(email)) fail(400, 'Invalid e-mail');
      const lang = LANGS.includes(body.lang) ? body.lang : 'en';
      const interests = sanitizeInterests(body.interests);
      const source = str(body.source, 40) || 'site';
      await syncNewsletterRow(env, email, lang, interests, true, source);
      return json({ subscribed: true, email, lang, interests });
    }

    if (p === '/v1/newsletter/unsubscribe') {
      const tok = bearer(request);
      let email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      if (tok) {
        const m = await memberFromSession(request, env);
        email = m.email;
        await env.DB.prepare(`UPDATE members SET marketing_consent=0, marketing_consent_at=NULL WHERE id=?`).bind(m.id).run();
      } else {
        if (!validEmail(email) || !env.CODE_PEPPER || !equal(str(body.sig, 128) || '', await hmac(env.CODE_PEPPER, 'unsub:' + email))) {
          fail(400, 'Invalid unsubscribe request');
        }
        await env.DB.prepare(`UPDATE members SET marketing_consent=0, marketing_consent_at=NULL WHERE email=?`).bind(email).run();
      }
      await syncNewsletterRow(env, email, 'en', [], false);
      return json({ unsubscribed: true, email });
    }

    if (p === '/v1/admin/newsletter/send') {
      if (!env.ADMIN_TOKEN || !equal(bearer(request), env.ADMIN_TOKEN)) fail(401, 'Unauthorized');
      const subject = str(body.subject, 200);
      const textBody = typeof body.text === 'string' && body.text.trim() && body.text.length <= 20000 ? body.text.trim() : null;
      const htmlBody = typeof body.html === 'string' && body.html.trim() && body.html.length <= 40000 ? body.html.trim() : null;
      if (!subject || (!textBody && !htmlBody)) fail(400, 'Subject and body required');
      const targetLang = LANGS.includes(body.lang) ? body.lang : null;
      const targetInterest = typeof body.interest === 'string' && ALLOWED_INTERESTS.has(body.interest) ? body.interest : null;
      const targetTier = ['silver', 'gold', 'platinum'].includes(body.tier) ? body.tier : null;
      const rows = (await env.DB.prepare(
        `SELECT ns.email, ns.lang, ns.interests, m.id AS member_id, m.name AS member_name,
                (SELECT COUNT(*) FROM member_requests r WHERE r.member_id=m.id AND r.state='fulfilled') AS fulfilled_count
         FROM newsletter_subscribers ns LEFT JOIN members m ON m.email=ns.email
         WHERE ns.active=1`).all()).results;
      const recipients = rows.filter(r => {
        if (targetLang && r.lang !== targetLang) return false;
        if (targetInterest && !parseInterests(r.interests).includes(targetInterest)) return false;
        if (targetTier) {
          if (!r.member_id) return false;
          if (tierInfo(env, Number(r.fulfilled_count || 0)).tier !== targetTier) return false;
        }
        return true;
      });
      if (body.dryRun === true) {
        return json({ dryRun: true, count: recipients.length, recipients: recipients.slice(0, 100).map(r => r.email) });
      }
      if (!env.RESEND_API_KEY && env.DEV_RETURN_CODE !== '1') fail(503, 'E-mail provider not configured');
      const escHtml = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
      let sent = 0, failed = 0;
      const from = env.MAIL_FROM || 'Bosphorly <no-reply@bosphorly.com>';
      for (const r of recipients) {
        const tierLabel = r.member_id ? tierInfo(env, Number(r.fulfilled_count || 0)).tier : 'guest';
        const firstName = r.member_name ? r.member_name.split(/\s+/)[0] : '';
        const personalText = (textBody || '').replace(/\{name\}/g, firstName || 'Guest').replace(/\{tier\}/g, tierLabel.toUpperCase());
        const personalHtml = (htmlBody || '').replace(/\{name\}/g, escHtml(firstName || 'Guest')).replace(/\{tier\}/g, tierLabel.toUpperCase());
        let unsubUrl = '';
        if (env.CODE_PEPPER) {
          const sig = await hmac(env.CODE_PEPPER, 'unsub:' + r.email);
          unsubUrl = `${url.origin}/v1/newsletter/unsubscribe?email=${encodeURIComponent(r.email)}&sig=${encodeURIComponent(sig)}`;
        }
        if (!env.RESEND_API_KEY) { sent++; continue; }
        const payload = { from, to: [r.email], subject };
        if (personalText) payload.text = unsubUrl ? `${personalText}\n\n---\nUnsubscribe: ${unsubUrl}` : personalText;
        if (personalHtml) payload.html = unsubUrl ? `${personalHtml}<hr><p style="font-size:12px;color:#666"><a href="${unsubUrl}">Unsubscribe</a></p>` : personalHtml;
        if (unsubUrl) payload.headers = { 'List-Unsubscribe': `<${unsubUrl}>` };
        try {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (res.ok) sent++; else failed++;
        } catch { failed++; }
      }
      return json({ sent, failed, total: recipients.length });
    }
    fail(404, 'Not found');
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    return json({ error: 'Invalid request or unavailable service' }, 400);
  }
}
