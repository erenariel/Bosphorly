import { commissionAmounts } from './commission.js';
import {catalogRoutes} from './extranet-catalog.js';
import {partnerRoutes} from './extranet-partners.js';
import {campaignRoutes} from './extranet-campaigns.js';
import {operationsRoutes} from './extranet-operations.js';
import {stage2Routes} from './extranet-stage2.js';
import {MemberSuspendedError,assertMemberActive,recordMemberLogin} from './member-controls.js';
import {membershipTier, MEMBER_TIERS} from './membership-tier.js';
// Bosphorly Extranet API (/v1/extranet/*) — Stage 1: Authentication, RBAC (owner/admin/staff),
// Fresh email OTP or optional Passkey (WebAuthn), HttpOnly+Secure+SameSite=Strict Session with 30m Idle Timeout,
// CSRF Protection, Immutable Audit Log, Dashboard KPIs, and Reservations Management.

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { transition } from './domain.js';
import { awardFulfilledMemberRewards, sqlTime, validEmail, verifyState } from './members.js';
import { computeMemberTier, isOwnerEmail } from './mimo.js';

export const EXTRANET_COOKIE_NAME = '__Host-bosphorly_extranet';
export const EXTRANET_IDLE_MS = 30 * 60 * 1000; // 30 minutes inactivity timeout
export const EXTRANET_MAX_SESSION_MS = 12 * 60 * 60 * 1000; // 12 hours absolute cap

const ROLES = new Set(['owner', 'admin', 'staff', 'partner']);
const WORKFLOW_STATUSES = ['new', 'in_progress', 'confirmed', 'completed', 'cancelled'];
const PAYMENT_STATUSES = ['pending', 'paid', 'refunded'];
const SUPPORTED_LANGS = new Set([
  'tr', 'en', 'ru', 'uk', 'de', 'fr', 'nl', 'ar', 'he', 'az', 'fa',
  'es', 'it', 'pt', 'hr', 'hu', 'bs', 'zh', 'ja', 'ko', 'hi', 'bn', 'id',
]);

export const ALLOWED_STATUS_TRANSITIONS = Object.freeze({
  new: ['in_progress', 'cancelled'],
  in_progress: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
});

const STATUS_TO_BOOKING_STATE = Object.freeze({
  new: 'requested',
  in_progress: 'supplier_pending',
  confirmed: 'confirmed',
  completed: 'fulfilled',
  cancelled: 'cancelled',
});

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha256 = async (s) => hex(await crypto.subtle.digest('SHA-256', enc.encode(String(s))));
const uuid = () => crypto.randomUUID();

function randomToken(bytesLen = 32) {
  const b = new Uint8Array(bytesLen);
  crypto.getRandomValues(b);
  let bin = '';
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64ToUint8Array(b64) {
  const pad = String(b64).replace(/-/g, '+').replace(/_/g, '/');
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

function b64urlDecode(s) {
  const pad = String(s).replace(/-/g, '+').replace(/_/g, '/');
  return decodeURIComponent(escape(atob(pad + '='.repeat((4 - (pad.length % 4)) % 4))));
}

function equal(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

class ExtranetError extends Error {
  constructor(status, message, code = null, clearCookie = false) {
    super(message);
    this.status = status;
    this.code = code;
    this.clearCookie = clearCookie;
  }
}

function fail(status, message, code = null, clearCookie = false) {
  throw new ExtranetError(status, message, code, clearCookie);
}

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      ...extraHeaders,
    },
  });
}

export function buildSessionCookie(rawToken) {
  return `${EXTRANET_COOKIE_NAME}=${rawToken}; Path=/; Max-Age=1800; HttpOnly; Secure; SameSite=Strict`;
}

export function buildClearSessionCookie() {
  return `${EXTRANET_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

function readCookie(request, cookieName) {
  const raw = request.headers.get('Cookie') || '';
  if (!raw) return '';
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const k = part.slice(0, idx).trim();
    if (k === cookieName) return part.slice(idx + 1).trim();
  }
  return '';
}

function clientIp(request) {
  const ip = (request.headers.get('CF-Connecting-IP') || '').trim();
  return ip && ip.length <= 80 ? ip : 'unknown';
}

function bearerToken(request) {
  const h = request.headers.get('Authorization') || '';
  const m = /^Bearer\s+(\S+)$/i.exec(h.trim());
  return m ? m[1] : '';
}

const str = (v, max) => (typeof v === 'string' && v.trim() && v.trim().length <= max ? v.trim() : null);
const isoDate = (v) =>
  typeof v === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  Number.isFinite(Date.parse(v + 'T00:00:00Z')) &&
  new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) === v;

async function readJsonBody(request, maxBytes = 8192) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) {
    fail(415, 'JSON içerik türü gerekli.');
  }
  const reader=request.body?.getReader();let size=0;const chunks=[];
  if(reader)try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();fail(413,'İstek gövdesi çok büyük.');}chunks.push(value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  const text=new TextDecoder().decode(bytes);
  try {
    const parsed = JSON.parse(text || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw 0;
    return parsed;
  } catch {
    fail(400, 'Geçersiz JSON verisi.');
  }
}

export function maskEmail(rawEmail) {
  const e = String(rawEmail || '').trim();
  if (!e || !e.includes('@')) return null;
  const [local, domain] = e.split('@');
  if (!local || !domain) return '***';
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

export function maskPhone(rawPhone) {
  const p = String(rawPhone || '').trim();
  if (!p) return null;
  const digits = p.replace(/\D/g, '');
  if (digits.length < 5) return '***';
  const prefix = p.startsWith('+') ? '+' + digits.slice(0, 2) : digits.slice(0, 2);
  const tail = digits.slice(-2);
  return `${prefix} *** ** ${tail}`;
}

function passesLuhn(digits) {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export function containsCardNumber(text) {
  const s = String(text || '');
  if (!s) return false;
  const candidates = s.match(/(?<!\d)(?:\d[ -]*?){13,19}(?!\d)/g);
  if (!candidates) return false;
  for (const c of candidates) {
    const digits = c.replace(/\D/g, '');
    if (digits.length >= 13 && digits.length <= 19 && passesLuhn(digits)) return true;
  }
  return false;
}

export function escapeCsvCell(value) {
  if (value === null || value === undefined) return '';
  let s = String(value).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (/^[=+\-@\t]/.test(s)) s = "'" + s;
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function isExtranetRoute(pathname) {
  return pathname === '/v1/extranet' || pathname.startsWith('/v1/extranet/');
}

export function isAdminOwnerEmail(env, email) {
  const target = typeof env?.ADMIN_OWNER_EMAIL === 'string' ? env.ADMIN_OWNER_EMAIL.trim().toLowerCase() : '';
  const candidate = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!target || !candidate || !validEmail(target)) return false;
  return equal(candidate, target);
}

function resolveWebAuthnConfig(env) {
  const pubOrigin = (env.PUBLIC_ORIGIN || 'https://bosphorly.com').replace(/\/+$/, '');
  let rpID = 'bosphorly.com';
  const expectedOrigins = new Set([pubOrigin]);
  try {
    const u = new URL(pubOrigin);
    rpID = u.hostname.replace(/^www\./, '');
    if (rpID === 'bosphorly.com') {
      expectedOrigins.add('https://bosphorly.com');
      expectedOrigins.add('https://www.bosphorly.com');
    }
  } catch {
    expectedOrigins.add('https://bosphorly.com');
  }
  return { rpID, expectedOrigin: [...expectedOrigins] };
}

async function checkD1RateLimit(env, key, maxPerMinute, nowMs = Date.now()) {
  const minBucket = Math.floor(nowMs / 60000);
  const dayBucket = new Date(nowMs).toISOString().slice(0, 10);
  const row = await env.DB.prepare(`INSERT INTO assistant_rate_limits(key,min_bucket,min_count,day_bucket,day_count)
    VALUES(?,?,1,?,1) ON CONFLICT(key) DO UPDATE SET
    min_count=CASE WHEN min_bucket=excluded.min_bucket THEN min_count+1 ELSE 1 END,
    min_bucket=excluded.min_bucket,day_bucket=excluded.day_bucket RETURNING min_count`)
    .bind(key,minBucket,dayBucket).first();
  if(Number(row.min_count)>maxPerMinute)fail(429,'Çok fazla istek gönderildi. Lütfen biraz bekleyin.','RATE_LIMITED');
}

function buildAuditStatement(env, { actorMemberId, actorRole, action, targetType, targetId = null, oldValue = null, newValue = null, ipAddress, nowSql }) {
  const serialize = (v) => {
    if (v === null || v === undefined) return null;
    const raw = typeof v === 'string' ? v : JSON.stringify(v);
    return raw.length > 4000 ? raw.slice(0, 4000) : raw;
  };
  return env.DB.prepare(
    `INSERT INTO extranet_audit (id, actor_member_id, actor_role, action, target_type, target_id, old_value, new_value, ip_address, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    uuid(),
    String(actorMemberId || 'anonymous'),
    ROLES.has(actorRole) ? actorRole : 'unauthorized',
    String(action).slice(0, 80),
    String(targetType).slice(0, 60),
    targetId ? String(targetId).slice(0, 120) : null,
    serialize(oldValue),
    serialize(newValue),
    String(ipAddress || 'unknown').slice(0, 80),
    nowSql || sqlTime(new Date())
  );
}

async function writeAudit(env, entry) {
  await buildAuditStatement(env, entry).run();
}

async function resolveMemberFromBearer(request, env, nowMs = Date.now()) {
  const tok = bearerToken(request);
  if (!tok || tok.length > 100) fail(401, 'Üye oturumu gerekli.', 'MEMBER_AUTH_REQUIRED');
  const m = await env.DB.prepare(
    `SELECT m.* FROM sessions s JOIN members m ON m.id=s.member_id WHERE s.token_hash=? AND s.expires_at>?`
  ).bind(await sha256(tok), sqlTime(new Date(nowMs))).first();
  if (!m) fail(401, 'Geçersiz veya süresi dolmuş üye oturumu.', 'MEMBER_AUTH_REQUIRED');
  return m;
}

async function ensureExtranetRoleForMember(env, member, ipAddress, nowMs = Date.now()) {
  const nowSql = sqlTime(new Date(nowMs));
  if (isOwnerEmail(env, member.email)) {
    const existing = await env.DB.prepare(`SELECT role, active FROM extranet_users WHERE member_id=?`).bind(member.id).first();
    if (!existing || existing.role !== 'owner' || Number(existing.active) !== 1) {
      await env.DB.prepare(
        `INSERT INTO extranet_users (member_id, role, active, created_at, updated_at) VALUES (?, 'owner', 1, ?, ?)
         ON CONFLICT(member_id) DO UPDATE SET role='owner', active=1, updated_at=excluded.updated_at`
      ).bind(member.id, nowSql, nowSql).run();
      await writeAudit(env, {
        actorMemberId: member.id,
        actorRole: 'owner',
        action: 'owner_bootstrap',
        targetType: 'extranet_user',
        targetId: member.id,
        oldValue: existing ? { role: existing.role, active: existing.active } : null,
        newValue: { role: 'owner', active: 1 },
        ipAddress,
        nowSql,
      });
    }
    return 'owner';
  }
  let row = await env.DB.prepare(`SELECT role, active FROM extranet_users WHERE member_id=?`).bind(member.id).first();
  const adminEmails=[...String(env.EXTRANET_ADMIN_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean),'cafer@bosphorly.com'];
  if(!row && adminEmails.includes(String(member.email||'').toLowerCase())) {
    await env.DB.batch([
      env.DB.prepare("INSERT OR IGNORE INTO extranet_users(member_id,role,active,created_at,updated_at) VALUES(?,'admin',1,?,?)").bind(member.id,nowSql,nowSql),
      buildAuditStatement(env,{actorMemberId:member.id,actorRole:'admin',action:'admin_bootstrap',targetType:'extranet_user',targetId:member.id,newValue:{role:'admin',active:1},ipAddress,nowSql})
    ]);
    row=await env.DB.prepare(`SELECT role,active FROM extranet_users WHERE member_id=?`).bind(member.id).first();
  }
  if (!row || Number(row.active) !== 1 || !ROLES.has(row.role) || row.role === 'owner') {
    await writeAudit(env, {
      actorMemberId: member.id,
      actorRole: 'unauthorized',
      action: 'access_denied',
      targetType: 'auth',
      targetId: member.id,
      newValue: { reason: 'not_extranet_user' },
      ipAddress,
      nowSql,
    });
    fail(403, 'Bu üye hesabının Extranet erişim yetkisi bulunmuyor.', 'FORBIDDEN');
  }
  return row.role;
}

async function requireFreshEnrollment(request,env,member,ticketValue,nowMs) {
  const ticket=await verifyState(env.CODE_PEPPER,ticketValue);
  if(!ticket||ticket.p!=='extranet_email'||ticket.memberId!==member.id||ticket.tokenHash!==await sha256(bearerToken(request))||Math.abs(nowMs-ticket.t)>5*60000)
    fail(401,'İlk passkey kurulumu için yeni e-posta koduyla doğrulayın.','FRESH_OTP_REQUIRED');
  const proof=await env.DB.prepare('SELECT id FROM login_codes WHERE id=? AND email=? AND used=1').bind(ticket.codeId,member.email).first();
  if(!proof)fail(401,'Yeni e-posta doğrulaması gerekli.','FRESH_OTP_REQUIRED');
}

async function createExtranetSession(env, request, member, role, nowMs = Date.now()) {
  await recordMemberLogin(env,member);
  const rawToken = randomToken(32);
  const tokenHash = await sha256(rawToken);
  const csrfToken = randomToken(32);
  const ip = clientIp(request);
  const ua = str(request.headers.get('User-Agent') || '', 240);
  await env.DB.prepare(
    `INSERT INTO extranet_sessions (token_hash, member_id, csrf_token, ip_address, user_agent, created_at, last_active_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(tokenHash, member.id, csrfToken, ip, ua, nowMs, nowMs, nowMs + EXTRANET_MAX_SESSION_MS).run();
  return { rawToken, csrfToken, ip };
}

async function requireExtranetAuth(request, env, allowedRoles, nowMs = Date.now()) {
  const rawCookie = readCookie(request, EXTRANET_COOKIE_NAME);
  if (!rawCookie || rawCookie.length > 120) {
    fail(401, 'Extranet oturumu gerekli.', 'UNAUTHENTICATED');
  }
  const tokenHash = await sha256(rawCookie);
  const row = await env.DB.prepare(
    `SELECT s.token_hash, s.member_id, s.csrf_token, s.created_at, s.last_active_at, s.expires_at,
            m.email, m.name, u.role, u.active
     FROM extranet_sessions s
     JOIN members m ON m.id = s.member_id
     LEFT JOIN extranet_users u ON u.member_id = s.member_id
     WHERE s.token_hash = ?`
  ).bind(tokenHash).first();

  if (!row) {
    fail(401, 'Geçersiz Extranet oturumu.', 'UNAUTHENTICATED', true);
  }

  await assertMemberActive(env,{id:row.member_id,email:row.email});
  const idleElapsed = nowMs - Number(row.last_active_at || 0);
  if (nowMs > Number(row.expires_at || 0) || idleElapsed > EXTRANET_IDLE_MS) {
    await env.DB.prepare(`DELETE FROM extranet_sessions WHERE token_hash=?`).bind(tokenHash).run();
    fail(401, 'Oturum 30 dakika hareketsizlik nedeniyle sonlandırıldı.', 'SESSION_IDLE_EXPIRED', true);
  }

  let effectiveRole = row.role;
  if (isOwnerEmail(env, row.email)) {
    effectiveRole = 'owner';
  } else if (!effectiveRole || Number(row.active) !== 1 || !ROLES.has(effectiveRole) || effectiveRole === 'owner') {
    await env.DB.prepare(`DELETE FROM extranet_sessions WHERE token_hash=?`).bind(tokenHash).run();
    fail(403, 'Extranet erişim yetkiniz kaldırılmış.', 'FORBIDDEN', true);
  }

  if (request.method !== 'GET') {
    const sentCsrf = request.headers.get('X-CSRF-Token') || '';
    if (!sentCsrf || !equal(sentCsrf, row.csrf_token)) {
      fail(403, 'CSRF doğrulaması başarısız.', 'CSRF_INVALID');
    }
  }

  const ip = clientIp(request);
  await checkD1RateLimit(env, `extranet:api:${row.member_id}`, 120, nowMs);

  if (allowedRoles && !allowedRoles.includes(effectiveRole)) {
    await writeAudit(env, {
      actorMemberId: row.member_id,
      actorRole: effectiveRole,
      action: 'access_denied',
      targetType: 'endpoint',
      targetId: new URL(request.url).pathname,
      newValue: { requiredRoles: allowedRoles },
      ipAddress: ip,
      nowSql: sqlTime(new Date(nowMs)),
    });
    fail(403, 'Bu işlem için rol yetkiniz bulunmuyor.', 'ROLE_FORBIDDEN');
  }

  await env.DB.prepare(`UPDATE extranet_sessions SET last_active_at=? WHERE token_hash=?`).bind(nowMs, tokenHash).run();

  return {
    memberId: row.member_id,
    email: row.email,
    name: row.name || null,
    role: effectiveRole,
    csrfToken: row.csrf_token,
    rawCookie,
    tokenHash,
    ipAddress: ip,
  };
}

// --- Reservation Normalization & Queries ------------------------------------------------------------

function mapBookingDbStateToWorkflow(dbState, metaStatus) {
  if (metaStatus && WORKFLOW_STATUSES.includes(metaStatus)) {
    if (dbState === 'fulfilled') return 'completed';
    if (['cancelled', 'rejected', 'refund_pending', 'refunded'].includes(dbState)) return 'cancelled';
    if (dbState === 'confirmed') return 'confirmed';
    if (dbState === 'supplier_pending') return 'in_progress';
    return metaStatus;
  }
  if (dbState === 'fulfilled') return 'completed';
  if (['cancelled', 'rejected', 'refund_pending', 'refunded'].includes(dbState)) return 'cancelled';
  if (dbState === 'confirmed') return 'confirmed';
  if (dbState === 'supplier_pending') return 'in_progress';
  return 'new';
}

function mapMemberRequestStateToWorkflow(dbState, metaStatus) {
  if (dbState === 'fulfilled') return 'completed';
  if (dbState === 'cancelled') return 'cancelled';
  if (metaStatus && ['new', 'in_progress', 'confirmed'].includes(metaStatus)) return metaStatus;
  return 'new';
}

export function parseTotalText(totalText) {
  const raw = String(totalText || '').trim();
  if (!raw) return { currency: null, totalMinor: null };
  let currency = null;
  if (raw.includes('€') || /\bEUR\b/i.test(raw)) currency = 'EUR';
  else if (raw.includes('₺') || /\b(?:TRY|TL)\b/i.test(raw)) currency = 'TRY';
  else if (raw.includes('$') || /\bUSD\b/i.test(raw)) currency = 'USD';
  else if (raw.includes('£') || /\bGBP\b/i.test(raw)) currency = 'GBP';
  if (!currency) return { currency: null, totalMinor: null };
  const numMatch = raw.match(/(\d+(?:[.,]\d{1,2})?)/);
  if (!numMatch) return { currency, totalMinor: null };
  const val = Number(numMatch[1].replace(',', '.'));
  if (!Number.isFinite(val) || val < 0) return { currency, totalMinor: null };
  return { currency, totalMinor: Math.round(val * 100) };
}

function formatMinorPrice(totalMinor, currency) {
  if (!Number.isFinite(totalMinor) || !currency) return null;
  const symbols = { EUR: '€', TRY: '₺', USD: '$', GBP: '£' };
  const sym = symbols[currency] || (currency + ' ');
  const major = (totalMinor / 100).toFixed(totalMinor % 100 === 0 ? 0 : 2);
  return `${sym}${major}`;
}

function computeEffectiveTier(env, memberId, email, fulfilledCount, override) {
  if (!memberId) return 'guest';
  if (email && isOwnerEmail(env, email)) return 'platinum';
  return MEMBER_TIERS.has(override) ? override : computeMemberTier(Number(fulfilledCount || 0));
}

function defaultCommissionBps(env) {
  const n = parseInt(env.DEFAULT_COMMISSION_BPS || '1000', 10);
  return Number.isFinite(n) && n >= 0 && n <= 10000 ? n : 1000;
}

function normalizeBookingRow(env, b) {
  const status = mapBookingDbStateToWorkflow(b.db_state, b.workflow_status);
  const paymentStatus = PAYMENT_STATUSES.includes(b.payment_status) ? b.payment_status : (b.db_state === 'refunded' ? 'refunded' : 'pending');
  const rawEmail = b.guest_email || b.mem_email || null;
  const rawPhone = b.guest_phone || b.mem_phone || null;
  const guestName = b.guest_name || b.mem_name || null;
  const guestHotel = b.guest_hotel || b.mem_hotel || b.mem_hotel_id || null;
  const guestRoom = b.guest_room || b.mem_room || null;
  const lang = b.meta_lang || b.mem_lang || 'en';
  const source = b.meta_source || (b.referral_hash ? 'hotel_qr' : (b.meta_member_id ? 'member' : 'web'));
  const memberTier = computeEffectiveTier(env, b.meta_member_id, b.mem_email, b.mem_fulfilled_count,b.mem_manual_tier);
  const providerId = b.assigned_provider_id || b.exp_provider_id || null;
  const commBps = Number.isInteger(b.commission_bps) ? b.commission_bps : defaultCommissionBps(env);
  const couponBps = b.coupon_code && b.coupon_status !== 'void' ? Number(b.coupon_bps || 0) : 0;
  const grossCommMinor = Math.floor((Number(b.total_minor || 0) * commBps) / 10000);
  const estimatedCommMinor =
    b.accrued_commission_status && b.accrued_commission_status !== 'reversed' && Number.isFinite(b.accrued_commission_minor)
      ? Number(b.accrued_commission_minor)
      : Math.floor((Number(b.total_minor || 0) * Math.max(0, commBps - couponBps)) / 10000);

  return {
    uid: `bk:${b.id}`,
    recordType: 'booking',
    isTest: b.is_test === 1,
    refundedMinor: Number(b.refunded_minor || 0),
    recordId: b.id,
    displayRef: b.id,
    productId: b.experience_id,
    productTitle: b.exp_title || b.experience_id,
    serviceDate: b.service_date,
    serviceTime: null,
    guests: Number(b.guests),
    totalMinor: Number(b.total_minor),
    currency: b.currency,
    priceDisplay: `${formatMinorPrice(Number(b.total_minor), b.currency)} (${b.currency})`,
    status,
    dbState: b.db_state,
    allowedNextStatuses: ALLOWED_STATUS_TRANSITIONS[status] || [],
    paymentStatus,
    providerId,
    source,
    lang,
    memberId: b.meta_member_id || null,
    memberTier,
    guestName,
    guestEmailMasked: maskEmail(rawEmail),
    guestPhoneMasked: maskPhone(rawPhone),
    hasEmail: !!rawEmail,
    hasPhone: !!rawPhone,
    guestHotel,
    guestRoom,
    guestCountry: b.mem_country || null,
    guestNotes: null,
    coupon: b.coupon_code
      ? {
          code: b.coupon_code,
          percentBps: Number(b.coupon_bps),
          status: b.coupon_status,
          kind: b.campaign_id === 'platinum-2026' ? 'platinum' : b.campaign_kind,
        }
      : null,
    estimatedCommissionMinor: estimatedCommMinor,
    grossCommissionMinor: grossCommMinor,
    createdAt: b.created_at,
    updatedAt: b.meta_updated_at || b.created_at,
    _rawEmail: rawEmail,
    _rawPhone: rawPhone,
  };
}

function normalizeMemberRequestRow(env, r) {
  const status = mapMemberRequestStateToWorkflow(r.db_state, r.workflow_status);
  const paymentStatus = PAYMENT_STATUSES.includes(r.payment_status) ? r.payment_status : 'pending';
  const rawEmail = r.mem_email || null;
  const rawPhone = r.mem_phone || null;
  const parsedPrice = parseTotalText(r.total_text);
  const lang = r.meta_lang || r.mem_lang || 'en';
  const source = r.meta_source || (r.mem_hotel_id ? 'hotel_qr' : 'member');
  const memberTier = computeEffectiveTier(env, r.member_id, r.mem_email, r.mem_fulfilled_count,r.mem_manual_tier);
  const commBps = defaultCommissionBps(env);
  const couponBps = r.coupon_code && r.coupon_status !== 'void' ? Number(r.coupon_bps || 0) : 0;
  const grossCommMinor =
    parsedPrice.totalMinor !== null ? Math.floor((parsedPrice.totalMinor * commBps) / 10000) : 0;
  const estimatedCommMinor =
    parsedPrice.totalMinor !== null
      ? Math.floor((parsedPrice.totalMinor * Math.max(0, commBps - couponBps)) / 10000)
      : 0;

  return {
    uid: `mr:${r.ref}`,
    recordType: 'member_request',
    isTest: r.is_test === 1,
    refundedMinor: Number(r.refunded_minor || 0),
    recordId: r.ref,
    displayRef: r.ref,
    productId: r.service_id,
    productTitle: r.title || r.service_id,
    serviceDate: r.service_date,
    serviceTime: r.service_time || null,
    guests: Number(r.guests),
    totalMinor: parsedPrice.totalMinor,
    currency: parsedPrice.currency,
    priceDisplay: r.total_text || (parsedPrice.totalMinor !== null ? formatMinorPrice(parsedPrice.totalMinor, parsedPrice.currency) : 'Fiyat teyit edilecek'),
    status,
    dbState: r.db_state,
    allowedNextStatuses: ALLOWED_STATUS_TRANSITIONS[status] || [],
    paymentStatus,
    providerId: r.assigned_provider_id || null,
    source,
    lang,
    memberId: r.member_id,
    memberTier,
    guestName: r.mem_name || null,
    guestEmailMasked: maskEmail(rawEmail),
    guestPhoneMasked: maskPhone(rawPhone),
    hasEmail: !!rawEmail,
    hasPhone: !!rawPhone,
    guestHotel: r.mem_hotel || r.mem_hotel_id || null,
    guestRoom: r.mem_room || null,
    guestCountry: r.mem_country || null,
    guestNotes: r.notes || null,
    coupon: r.coupon_code
      ? {
          code: r.coupon_code,
          percentBps: Number(r.coupon_bps),
          status: r.coupon_status,
          kind: r.campaign_id === 'platinum-2026' ? 'platinum' : r.campaign_kind,
        }
      : null,
    estimatedCommissionMinor: estimatedCommMinor,
    grossCommissionMinor: grossCommMinor,
    createdAt: r.created_at,
    updatedAt: r.closed_at || r.meta_updated_at || r.created_at,
    _rawEmail: rawEmail,
    _rawPhone: rawPhone,
  };
}

function stripInternalFields(item) {
  const { _rawEmail, _rawPhone, ...publicView } = item;
  return publicView;
}

async function loadAllReservations(env, sqlDateFilter = null) {
  const bkConds = [];
  const bkArgs = [];
  const mrConds = [];
  const mrArgs = [];

  if (sqlDateFilter) {
    const { dateFrom, dateTo, dateType } = sqlDateFilter;
    if (dateType === 'created') {
      if (dateFrom) {
        bkConds.push(`b.created_at >= ?`);
        bkArgs.push(`${dateFrom} 00:00:00`);
        mrConds.push(`r.created_at >= ?`);
        mrArgs.push(`${dateFrom} 00:00:00`);
      }
      if (dateTo) {
        bkConds.push(`b.created_at <= ?`);
        bkArgs.push(`${dateTo} 23:59:59`);
        mrConds.push(`r.created_at <= ?`);
        mrArgs.push(`${dateTo} 23:59:59`);
      }
    } else {
      if (dateFrom) {
        bkConds.push(`b.service_date >= ?`);
        bkArgs.push(dateFrom);
        mrConds.push(`r.service_date >= ?`);
        mrArgs.push(dateFrom);
      }
      if (dateTo) {
        bkConds.push(`b.service_date <= ?`);
        bkArgs.push(dateTo);
        mrConds.push(`r.service_date <= ?`);
        mrArgs.push(dateTo);
      }
    }
  }

  const bkWhere = bkConds.length ? `WHERE ${bkConds.join(' AND ')}` : '';
  const mrWhere = mrConds.length ? `WHERE ${mrConds.join(' AND ')}` : '';

  const bkRes = await env.DB.prepare(
    `SELECT b.id, b.experience_id, b.price_id, b.service_date, b.guests, b.total_minor, b.currency,
            b.is_test, b.referral_hash, b.commission_bps, b.state AS db_state, b.created_at,
            e.title AS exp_title, e.provider_id AS exp_provider_id,
            meta.workflow_status, meta.payment_status, meta.refunded_minor, meta.assigned_provider_id,
            meta.member_id AS meta_member_id, meta.guest_name, meta.guest_email, meta.guest_phone,
            meta.guest_hotel, meta.guest_room, meta.source AS meta_source, meta.lang AS meta_lang,
            meta.coupon_id AS meta_coupon_id, meta.updated_at AS meta_updated_at,
            m.email AS mem_email, m.name AS mem_name, m.phone AS mem_phone, m.hotel AS mem_hotel,
            m.room AS mem_room, m.lang AS mem_lang, m.country AS mem_country, m.hotel_id AS mem_hotel_id,
            (SELECT COUNT(*) FROM member_requests x WHERE x.member_id=m.id AND x.state='fulfilled') AS mem_fulfilled_count,
            COALESCE((SELECT CASE WHEN expires_at IS NOT NULL AND datetime(expires_at)<=datetime('now') THEN previous_tier ELSE tier END FROM member_tier_overrides WHERE member_id=m.id),(SELECT CASE WHEN automatic_disabled=1 THEN frozen_tier END FROM member_controls WHERE member_id=m.id)) AS mem_manual_tier,
            c.code AS coupon_code, c.percent_bps AS coupon_bps, c.status AS coupon_status, k.kind AS campaign_kind, k.id AS campaign_id,
            cm.amount_minor AS accrued_commission_minor, cm.status AS accrued_commission_status
     FROM booking_requests b
     LEFT JOIN experiences e ON e.id = b.experience_id
     LEFT JOIN extranet_booking_meta meta ON meta.record_type = 'booking' AND meta.record_id = b.id
     LEFT JOIN members m ON m.id = meta.member_id
     LEFT JOIN coupons c ON c.id = meta.coupon_id
     LEFT JOIN campaigns k ON k.id = c.campaign_id
     LEFT JOIN commissions cm ON cm.booking_id = b.id
     ${bkWhere}
     ORDER BY b.created_at DESC, b.id DESC`
  ).bind(...bkArgs).all();

  const mrRes = await env.DB.prepare(
    `SELECT r.ref, r.member_id, r.service_id, r.service_date, r.guests, r.coupon_id,
            r.is_test, r.state AS db_state, r.created_at, r.closed_at, r.req_type, r.title, r.operator,
            r.service_time, r.total_text, r.notes,
            meta.workflow_status, meta.payment_status, meta.refunded_minor, meta.assigned_provider_id,
            meta.source AS meta_source, meta.lang AS meta_lang, meta.updated_at AS meta_updated_at,
            m.email AS mem_email, m.name AS mem_name, m.phone AS mem_phone, m.hotel AS mem_hotel,
            m.room AS mem_room, m.lang AS mem_lang, m.country AS mem_country, m.hotel_id AS mem_hotel_id,
            (SELECT COUNT(*) FROM member_requests x WHERE x.member_id=m.id AND x.state='fulfilled') AS mem_fulfilled_count,
            COALESCE((SELECT CASE WHEN expires_at IS NOT NULL AND datetime(expires_at)<=datetime('now') THEN previous_tier ELSE tier END FROM member_tier_overrides WHERE member_id=m.id),(SELECT CASE WHEN automatic_disabled=1 THEN frozen_tier END FROM member_controls WHERE member_id=m.id)) AS mem_manual_tier,
            c.code AS coupon_code, c.percent_bps AS coupon_bps, c.status AS coupon_status, k.kind AS campaign_kind, k.id AS campaign_id
     FROM member_requests r
     JOIN members m ON m.id = r.member_id
     LEFT JOIN extranet_booking_meta meta ON meta.record_type = 'member_request' AND meta.record_id = r.ref
     LEFT JOIN coupons c ON c.id = r.coupon_id
     LEFT JOIN campaigns k ON k.id = c.campaign_id
     ${mrWhere}
     ORDER BY r.created_at DESC, r.ref DESC`
  ).bind(...mrArgs).all();

  const bookings = (bkRes.results || []).map((row) => normalizeBookingRow(env, row));
  const bookingIds = new Set(bookings.map((b) => b.recordId));
  const memberReqs = (mrRes.results || [])
    .filter((row) => !bookingIds.has(row.ref))
    .map((row) => normalizeMemberRequestRow(env, row));

  const combined = [...bookings, ...memberReqs];
  combined.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')) || String(b.displayRef).localeCompare(String(a.displayRef)));
  return combined;
}

function parseReservationIdentifier(rawId) {
  const clean = decodeURIComponent(String(rawId || '')).trim();
  if (!clean || clean.length > 90 || !/^(?:(?:bk|mr):)?[A-Za-z0-9_-]{1,80}$/.test(clean)) {
    fail(400, 'Geçersiz rezervasyon kimliği.');
  }
  if (clean.startsWith('bk:')) return { prefType: 'booking', id: clean.slice(3) };
  if (clean.startsWith('mr:')) return { prefType: 'member_request', id: clean.slice(3) };
  return { prefType: null, id: clean };
}

async function loadSingleReservation(env, rawId) {
  const { prefType, id } = parseReservationIdentifier(rawId);

  if (prefType !== 'member_request') {
    const b = await env.DB.prepare(
      `SELECT b.id, b.experience_id, b.price_id, b.service_date, b.guests, b.total_minor, b.currency,
              b.is_test, b.referral_hash, b.commission_bps, b.state AS db_state, b.created_at,
              e.title AS exp_title, e.provider_id AS exp_provider_id,
              meta.workflow_status, meta.payment_status, meta.refunded_minor, meta.assigned_provider_id,
              meta.member_id AS meta_member_id, meta.guest_name, meta.guest_email, meta.guest_phone,
              meta.guest_hotel, meta.guest_room, meta.source AS meta_source, meta.lang AS meta_lang,
              meta.coupon_id AS meta_coupon_id, meta.updated_at AS meta_updated_at,
              m.email AS mem_email, m.name AS mem_name, m.phone AS mem_phone, m.hotel AS mem_hotel,
              m.room AS mem_room, m.lang AS mem_lang, m.country AS mem_country, m.hotel_id AS mem_hotel_id,
              (SELECT COUNT(*) FROM member_requests x WHERE x.member_id=m.id AND x.state='fulfilled') AS mem_fulfilled_count,
            COALESCE((SELECT CASE WHEN expires_at IS NOT NULL AND datetime(expires_at)<=datetime('now') THEN previous_tier ELSE tier END FROM member_tier_overrides WHERE member_id=m.id),(SELECT CASE WHEN automatic_disabled=1 THEN frozen_tier END FROM member_controls WHERE member_id=m.id)) AS mem_manual_tier,
              c.code AS coupon_code, c.percent_bps AS coupon_bps, c.status AS coupon_status, k.kind AS campaign_kind, k.id AS campaign_id,
              cm.amount_minor AS accrued_commission_minor, cm.status AS accrued_commission_status
       FROM booking_requests b
       LEFT JOIN experiences e ON e.id = b.experience_id
       LEFT JOIN extranet_booking_meta meta ON meta.record_type = 'booking' AND meta.record_id = b.id
       LEFT JOIN members m ON m.id = meta.member_id
       LEFT JOIN coupons c ON c.id = meta.coupon_id
       LEFT JOIN campaigns k ON k.id = c.campaign_id
       LEFT JOIN commissions cm ON cm.booking_id = b.id
       WHERE b.id = ?`
    ).bind(id).first();
    if (b) return normalizeBookingRow(env, b);
    if (prefType === 'booking') fail(404, 'Rezervasyon bulunamadı.');
  }

  const r = await env.DB.prepare(
    `SELECT r.ref, r.member_id, r.service_id, r.service_date, r.guests, r.coupon_id,
            r.is_test, r.state AS db_state, r.created_at, r.closed_at, r.req_type, r.title, r.operator,
            r.service_time, r.total_text, r.notes,
            meta.workflow_status, meta.payment_status, meta.refunded_minor, meta.assigned_provider_id,
            meta.source AS meta_source, meta.lang AS meta_lang, meta.updated_at AS meta_updated_at,
            m.email AS mem_email, m.name AS mem_name, m.phone AS mem_phone, m.hotel AS mem_hotel,
            m.room AS mem_room, m.lang AS mem_lang, m.country AS mem_country, m.hotel_id AS mem_hotel_id,
            (SELECT COUNT(*) FROM member_requests x WHERE x.member_id=m.id AND x.state='fulfilled') AS mem_fulfilled_count,
            COALESCE((SELECT CASE WHEN expires_at IS NOT NULL AND datetime(expires_at)<=datetime('now') THEN previous_tier ELSE tier END FROM member_tier_overrides WHERE member_id=m.id),(SELECT CASE WHEN automatic_disabled=1 THEN frozen_tier END FROM member_controls WHERE member_id=m.id)) AS mem_manual_tier,
            c.code AS coupon_code, c.percent_bps AS coupon_bps, c.status AS coupon_status, k.kind AS campaign_kind, k.id AS campaign_id
     FROM member_requests r
     JOIN members m ON m.id = r.member_id
     LEFT JOIN extranet_booking_meta meta ON meta.record_type = 'member_request' AND meta.record_id = r.ref
     LEFT JOIN coupons c ON c.id = r.coupon_id
     LEFT JOIN campaigns k ON k.id = c.campaign_id
     WHERE r.ref = ?`
  ).bind(id).first();
  if (r) return normalizeMemberRequestRow(env, r);
  fail(404, 'Rezervasyon bulunamadı.');
}

function parseBookingFilters(searchParams) {
  const rawDateFrom = searchParams.get('dateFrom') || '';
  const rawDateTo = searchParams.get('dateTo') || '';
  if (rawDateFrom && !isoDate(rawDateFrom)) fail(400, 'Geçersiz başlangıç tarihi (YYYY-AA-GG olmalı).');
  if (rawDateTo && !isoDate(rawDateTo)) fail(400, 'Geçersiz bitiş tarihi (YYYY-AA-GG olmalı).');
  if (rawDateFrom && rawDateTo && rawDateFrom > rawDateTo) fail(400, 'Başlangıç tarihi bitiş tarihinden sonra olamaz.');

  const dateType = searchParams.get('dateType') === 'created' ? 'created' : 'service';
  const product = str(searchParams.get('product') || '', 80);
  const status = str(searchParams.get('status') || '', 24);
  if (status && !WORKFLOW_STATUSES.includes(status)) fail(400, 'Geçersiz durum filtresi.');

  const source = str(searchParams.get('source') || '', 40);
  const lang = str(searchParams.get('lang') || '', 8);
  if (lang && !SUPPORTED_LANGS.has(lang)) fail(400, 'Geçersiz dil filtresi.');

  const tier = str(searchParams.get('tier') || '', 16);
  if (tier && !['guest', 'silver', 'gold', 'platinum'].includes(tier)) fail(400, 'Geçersiz üye seviyesi filtresi.');

  const q = str(searchParams.get('q') || '', 120);

  const pageRaw = parseInt(searchParams.get('page') || '1', 10);
  const pageSizeRaw = parseInt(searchParams.get('pageSize') || '20', 10);
  const page = Number.isInteger(pageRaw) && pageRaw >= 1 && pageRaw <= 10000 ? pageRaw : 1;
  const pageSize = Number.isInteger(pageSizeRaw) && pageSizeRaw >= 1 && pageSizeRaw <= 100 ? pageSizeRaw : 20;

  return {
    dateFrom: rawDateFrom || null,
    dateTo: rawDateTo || null,
    dateType,
    product,
    status,
    source,
    lang,
    tier,
    q,
    page,
    pageSize,
  };
}

function applyReservationFilters(items, filters) {
  const qFold = filters.q ? filters.q.toLocaleLowerCase('tr-TR') : null;
  return items.filter((item) => {
    if (filters.product && item.productId !== filters.product) return false;
    if (filters.status && item.status !== filters.status) return false;
    if (filters.source && item.source !== filters.source) return false;
    if (filters.lang && item.lang !== filters.lang) return false;
    if (filters.tier && item.memberTier !== filters.tier) return false;
    if (qFold) {
      const hay = [
        item.displayRef,
        item.productId,
        item.productTitle,
        item.guestName || '',
        item.guestHotel || '',
        item.coupon?.code || '',
        item.providerId || '',
        item._rawEmail || '',
        item._rawPhone || '',
      ]
        .join(' ')
        .toLocaleLowerCase('tr-TR');
      if (!hay.includes(qFold)) return false;
    }
    return true;
  });
}

const ISTANBUL_DATE_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Istanbul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const ISTANBUL_PARTS_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Istanbul',
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function formatIstanbulTimestamp(ms) {
  const parts = {};
  for (const p of ISTANBUL_PARTS_FMT.formatToParts(new Date(ms))) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function istanbulMidnightToUtcSql(yyyyMmDd) {
  const probeUtc = Date.parse(`${yyyyMmDd}T00:00:00Z`);
  const localStr = formatIstanbulTimestamp(probeUtc).replace(' ', 'T') + 'Z';
  const localAsUtc = Date.parse(localStr);
  const offsetMs = Number.isFinite(localAsUtc) ? localAsUtc - probeUtc : 3 * 3600 * 1000;
  return sqlTime(new Date(probeUtc - offsetMs));
}

export function computePeriodBoundaries(nowMs = Date.now()) {
  const localDate = ISTANBUL_DATE_FMT.format(new Date(nowMs)); // YYYY-MM-DD in Europe/Istanbul
  const [y, m, d] = localDate.split('-').map(Number);

  const calUtc = new Date(Date.UTC(y, m - 1, d));
  const dayOfWeek = calUtc.getUTCDay() || 7; // Monday = 1 .. Sunday = 7
  calUtc.setUTCDate(calUtc.getUTCDate() - (dayOfWeek - 1));
  const weekLocalDate = calUtc.toISOString().slice(0, 10);
  const monthLocalDate = `${localDate.slice(0, 7)}-01`;

  return {
    timezone: 'Europe/Istanbul',
    localDate,
    todayStart: istanbulMidnightToUtcSql(localDate),
    weekStart: istanbulMidnightToUtcSql(weekLocalDate),
    monthStart: istanbulMidnightToUtcSql(monthLocalDate),
  };
}

async function computeDashboardMetrics(env, nowMs = Date.now()) {
  const { timezone, localDate, todayStart, weekStart, monthStart } = computePeriodBoundaries(nowMs);
  const earliest = weekStart < monthStart ? weekStart : monthStart;
  const allRecent = await loadAllReservations(env, {
    dateFrom: earliest.slice(0, 10),
    dateTo: null,
    dateType: 'created',
  });
  const allItems = await loadAllReservations(env, null);
  const byUid = new Map();
  for (const x of [...allRecent, ...allItems]) byUid.set(x.uid, x);
  const merged = [...byUid.values()];

  const summarizePeriod = async (startSql) => {
    let newRequests = 0;
    let confirmed = 0;
    let cancelled = 0;
    let completed=0,cohortConfirmed=0,cohortCompleted=0;
    const estimatedCommission = { EUR: 0, TRY: 0, USD: 0, GBP: 0 };
    const grossCommission = { EUR: 0, TRY: 0, USD: 0, GBP: 0 };
    const expectedCommission = { EUR: 0, TRY: 0, USD: 0, GBP: 0 };

    for (const item of merged) {
      if (item.isTest) continue;
      const createdInPeriod = String(item.createdAt || '') >= startSql;
      const updatedInPeriod = String(item.updatedAt || item.createdAt || '') >= startSql;
      if (createdInPeriod) {
        newRequests++;
        if(['confirmed','completed'].includes(item.status))cohortConfirmed++;
        if(item.status==='completed')cohortCompleted++;
      }
      if ((item.status === 'confirmed' || item.status === 'completed') && updatedInPeriod) {
        confirmed++;
        if (item.currency && Object.prototype.hasOwnProperty.call(estimatedCommission, item.currency)) {
          const amounts = commissionAmounts(item);
          estimatedCommission[item.currency] += amounts.finalizedNet;
          grossCommission[item.currency] += amounts.finalizedGross;
          expectedCommission[item.currency] += amounts.expectedNet;
        }
      }
      if(item.status==='completed'&&updatedInPeriod)completed++;
      if (item.status === 'cancelled' && updatedInPeriod) {
        cancelled++;
      }
    }

    const memRow = await env.DB.prepare(`SELECT COUNT(*) AS n FROM members WHERE created_at >= ?`).bind(startSql).first();
    return {
      startAt: startSql,
      newRequests,
      completed,
      conversion:{requests:newRequests,confirmed:cohortConfirmed,completed:cohortCompleted,confirmationRate:newRequests?cohortConfirmed/newRequests:0,completionRate:newRequests?cohortCompleted/newRequests:0},
      confirmed,
      cancelled,
      newMembers: Number(memRow?.n || 0),
      estimatedCommission, // compatibility: now finalized only
      finalizedCommission: estimatedCommission,
      expectedCommission,
      grossCommission,
    };
  };

  const [today, week, month] = await Promise.all([
    summarizePeriod(todayStart),
    summarizePeriod(weekStart),
    summarizePeriod(monthStart),
  ]);

  const statusBreakdown = { new: 0, in_progress: 0, confirmed: 0, completed: 0, cancelled: 0 };
  for (const item of allItems) {
    if (Object.prototype.hasOwnProperty.call(statusBreakdown, item.status)) {
      statusBreakdown[item.status]++;
    }
  }

  const tierDistribution={silver:0,gold:0,platinum:0};
  const memberRows=(await env.DB.prepare("SELECT m.id,m.email,(SELECT COUNT(*) FROM member_requests r WHERE r.member_id=m.id AND r.state='fulfilled') AS n FROM members m").all()).results||[];
  for(const m of memberRows){const level=isOwnerEmail(env,m.email)?'platinum':(await membershipTier(env,m.id,m.n,nowMs)).tier;tierDistribution[level]=(tierDistribution[level]||0)+1;}
  const languageDistribution={},tourCounts=new Map();
  for(const item of allItems){languageDistribution[item.lang]=(languageDistribution[item.lang]||0)+1;const old=tourCounts.get(item.productId)||{id:item.productId,title:item.productTitle,count:0};old.count++;tourCounts.set(item.productId,old);}
  return {
    generatedAt: sqlTime(new Date(nowMs)),
    timezone,
    localDate,
    periods: { today, week, month },
    statusBreakdown,
    tierDistribution,languageDistribution,topTours:[...tourCounts.values()].sort((a,b)=>b.count-a.count).slice(0,10),
    recentBookings: allItems.slice(0, 6).map(stripInternalFields),
  };
}

async function sendOwnerPasskeyNotification(env, { memberEmail, role, credentialId, flow, ipAddress, nowMs }) {
  const ownerEmail = typeof env?.ADMIN_OWNER_EMAIL === 'string' ? env.ADMIN_OWNER_EMAIL.trim().toLowerCase() : '';
  if (!ownerEmail || !validEmail(ownerEmail) || !env?.RESEND_API_KEY) {
    return { sent: false, reason: 'not_configured' };
  }
  const fromAddr = env.MAIL_FROM || env.REQUEST_FROM_EMAIL || 'Bosphorly <no-reply@notify.bosphorly.com>';
  const flowLabel =
    flow === 'initial_enroll'
      ? 'İlk Giriş Zorunlu Passkey Kurulumu'
      : 'Açık Extranet Oturumu Üzerinden Ek Passkey Kaydı';
  const istTime = formatIstanbulTimestamp(nowMs);
  const utcTime = sqlTime(new Date(nowMs));
  const shortCred = String(credentialId || '').slice(0, 20);
  const subject = '[Bosphorly Extranet Güvenlik] Yeni Passkey Kaydedildi';
  const text = [
    'Bosphorly Extranet üzerinde yeni bir Passkey (WebAuthn anahtarı) kaydedildi.',
    '',
    `Hesap: ${memberEmail} (${role})`,
    `İşlem Türü: ${flowLabel}`,
    `Passkey Özeti: ${shortCred}...`,
    `Zaman (İstanbul): ${istTime} (Europe/Istanbul)`,
    `Zaman (UTC): ${utcTime} UTC`,
    `IP Adresi: ${ipAddress || 'unknown'}`,
    '',
    'Bu işlemi siz veya yetkili ekip üyesi gerçekleştirmediyse derhal Extranet üzerinden hesap yetkilerini ve oturumları kontrol edin.',
  ].join('\n');

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddr,
        to: [ownerEmail],
        subject,
        text,
      }),
    });
    return { sent: !!res.ok, reason: res.ok ? null : 'provider_rejected' };
  } catch {
    return { sent: false, reason: 'network_error' };
  }
}

async function loadReservationDetailBundle(env, rawId) {
  const item = await loadSingleReservation(env, rawId);
  let events = [];
  if (item.recordType === 'booking') {
    const evRes = await env.DB.prepare(
      `SELECT id, booking_id, from_state, to_state, actor_id, evidence_reference, created_at
       FROM booking_events
       WHERE booking_id = ? OR evidence_reference LIKE ?
       ORDER BY created_at DESC, id DESC`
    ).bind(item.recordId, `extranet:bk:${item.recordId}:%`).all();
    events = evRes.results || [];
  } else {
    const evRes = await env.DB.prepare(
      `SELECT id, booking_id, from_state, to_state, actor_id, evidence_reference, created_at
       FROM booking_events
       WHERE evidence_reference LIKE ?
       ORDER BY created_at DESC, id DESC`
    ).bind(`extranet:mr:${item.recordId}:%`).all();
    events = evRes.results || [];
  }

  const notesRes = await env.DB.prepare(
    `SELECT n.id, n.author_member_id, n.author_role, n.note, n.created_at, m.name AS author_name
     FROM extranet_booking_notes n
     LEFT JOIN members m ON m.id = n.author_member_id
     WHERE n.record_type = ? AND n.record_id = ?
     ORDER BY n.created_at DESC, n.id DESC`
  ).bind(item.recordType, item.recordId).all();

  let provider = null;
  if (item.providerId) {
    const pRow = await env.DB.prepare(
      `SELECT id, status, currency, license_reference, verified_at FROM providers WHERE id = ?`
    ).bind(item.providerId).first();
    if (pRow) {
      provider = {
        id: pRow.id,
        status: pRow.status,
        currency: pRow.currency,
        licenseReference: pRow.license_reference || null,
        verifiedAt: pRow.verified_at || null,
      };
    } else {
      provider = { id: item.providerId, status: 'unknown', currency: null, licenseReference: null, verifiedAt: null };
    }
  }

  const providersListRes = await env.DB.prepare(
    `SELECT id, status, currency, license_reference FROM providers WHERE status != 'suspended' ORDER BY status DESC, id ASC`
  ).all();

  return {
    booking: {
      ...stripInternalFields(item),
      provider,
      events: events.map((e) => ({
        id: e.id,
        fromState: e.from_state || null,
        toState: e.to_state || null,
        actorId: e.actor_id,
        evidenceReference: e.evidence_reference,
        createdAt: e.created_at,
      })),
      internalNotes: (notesRes.results || []).map((n) => ({
        id: n.id,
        authorMemberId: n.author_member_id,
        authorName: n.author_name || null,
        authorRole: n.author_role,
        note: n.note,
        createdAt: n.created_at,
      })),
    },
    availableProviders: (providersListRes.results || []).map((p) => ({
      id: p.id,
      status: p.status,
      currency: p.currency,
      licenseReference: p.license_reference || null,
    })),
    _rawEmail: item._rawEmail,
    _rawPhone: item._rawPhone,
  };
}

function upsertMetaStatement(env, item, patch, nowSql) {
  const nextWorkflow = patch.workflowStatus ?? item.status;
  const nextPayment = patch.paymentStatus ?? item.paymentStatus;
  const nextProvider = patch.assignedProviderId !== undefined ? patch.assignedProviderId : item.providerId;
  return env.DB.prepare(
    `INSERT INTO extranet_booking_meta (record_type, record_id, workflow_status, payment_status, assigned_provider_id, refunded_minor, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(record_type, record_id) DO UPDATE SET
       workflow_status = excluded.workflow_status,
       payment_status = excluded.payment_status,
       assigned_provider_id = excluded.assigned_provider_id,
       refunded_minor = excluded.refunded_minor,
       updated_at = excluded.updated_at`
  ).bind(item.recordType, item.recordId, nextWorkflow, nextPayment, nextProvider, patch.refundedMinor ?? item.refundedMinor ?? 0, nowSql);
}

async function changeReservationStatus(request,env,auth,rawBookingId,nowSql) {
        const body = await readJsonBody(request, 4096);
        const toStatus = str(body.toStatus, 24);
        const reasonNote = body.note !== undefined && body.note !== null ? str(String(body.note), 500) : null;
        if (!toStatus || !WORKFLOW_STATUSES.includes(toStatus)) {
          fail(400, 'Geçersiz hedef durum.');
        }
        if (reasonNote && containsCardNumber(reasonNote)) {
          fail(400, 'Güvenlik kuralı: Kart numarası hiçbir alana girilemez ve kaydedilemez.');
        }

        const item = await loadSingleReservation(env, rawBookingId);
        const fromStatus = item.status;
        if (!ALLOWED_STATUS_TRANSITIONS[fromStatus]?.includes(toStatus)) {
          fail(409, `Geçersiz durum geçişi: ${fromStatus} → ${toStatus}`);
        }

        const stmts = [];
        const toDbState = STATUS_TO_BOOKING_STATE[toStatus];

        if (item.recordType === 'booking') {
          const currentDbState = item.dbState === 'draft' && toStatus !== 'cancelled' ? 'requested' : item.dbState;
          if (item.dbState === 'draft' && toStatus === 'in_progress') {
            stmts.push(env.DB.prepare(`UPDATE booking_requests SET state='supplier_pending' WHERE id=? AND state='draft'`).bind(item.recordId));
          } else {
            transition(currentDbState, toDbState, 'admin', `extranet:${auth.role}:${toStatus}`);
            stmts.push(
              env.DB.prepare(`UPDATE booking_requests SET state=? WHERE id=? AND state=?`).bind(toDbState, item.recordId, item.dbState)
            );
          }
          stmts.push(upsertMetaStatement(env, item, { workflowStatus: toStatus }, nowSql));
          stmts.push(
            env.DB.prepare(
              `INSERT INTO booking_events (id, booking_id, idempotency_key, from_state, to_state, actor_id, evidence_reference, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              uuid(),
              item.recordId,
              `extranet-status:${item.uid}:${fromStatus}:${toStatus}`,
              fromStatus,
              toStatus,
              auth.memberId,
              `extranet:bk:${item.recordId}:status:${fromStatus}->${toStatus}`,
              nowSql
            )
          );
        } else {
          stmts.push(upsertMetaStatement(env, item, { workflowStatus: toStatus }, nowSql));
          if (toStatus === 'completed' && item.dbState === 'requested') {
            stmts.push(
              env.DB.prepare(`UPDATE member_requests SET state='fulfilled', closed_at=? WHERE ref=? AND state='requested'`).bind(nowSql, item.recordId),
              env.DB.prepare(`UPDATE coupons SET status='redeemed', redeemed_at=? WHERE held_ref=? AND status='held'`).bind(nowSql, item.recordId),
              env.DB.prepare(`UPDATE members SET stamps=stamps+1 WHERE id=?`).bind(item.memberId)
            );
          } else if (toStatus === 'cancelled' && item.dbState === 'requested') {
            stmts.push(
              env.DB.prepare(`UPDATE member_requests SET state='cancelled', closed_at=? WHERE ref=? AND state='requested'`).bind(nowSql, item.recordId),
              env.DB.prepare(`UPDATE coupons SET status='issued', held_ref=NULL WHERE held_ref=? AND status='held'`).bind(item.recordId)
            );
          }
          stmts.push(
            env.DB.prepare(
              `INSERT INTO booking_events (id, booking_id, idempotency_key, from_state, to_state, actor_id, evidence_reference, created_at)
               VALUES (?, NULL, ?, ?, ?, ?, ?, ?)`
            ).bind(
              uuid(),
              `extranet-status:${item.uid}:${fromStatus}:${toStatus}`,
              fromStatus,
              toStatus,
              auth.memberId,
              `extranet:mr:${item.recordId}:status:${fromStatus}->${toStatus}`,
              nowSql
            )
          );
        }

        if (reasonNote) {
          stmts.push(
            env.DB.prepare(
              `INSERT INTO extranet_booking_notes (id, record_type, record_id, author_member_id, author_role, note, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).bind(uuid(), item.recordType, item.recordId, auth.memberId, auth.role, `[Durum: ${fromStatus} → ${toStatus}] ${reasonNote}`, nowSql)
          );
        }

        stmts.push(
          buildAuditStatement(env, {
            actorMemberId: auth.memberId,
            actorRole: auth.role,
            action: 'update_booking_status',
            targetType: 'booking',
            targetId: item.uid,
            oldValue: { status: fromStatus },
            newValue: { status: toStatus, hasNote: !!reasonNote },
            ipAddress: auth.ipAddress,
            nowSql,
          })
        );

        await env.DB.batch(stmts);

        if (item.recordType === 'member_request' && toStatus === 'completed' && item.dbState === 'requested' && item.memberId) {
          await awardFulfilledMemberRewards(env, item.memberId);
        }

        const updated = await loadReservationDetailBundle(env, item.uid);
        return jsonResponse(
          { booking: updated.booking, availableProviders: updated.availableProviders },
          200,
          { 'Set-Cookie': buildSessionCookie(auth.rawCookie) }
        );
}

// --- Main Route Handler -----------------------------------------------------------------------------

export async function handleExtranetRoutes(request, env, url, nowMs = Date.now()) {
  try {
    if (!env.DB) fail(503, 'Veritabanı kullanılamıyor.');
    const path = url.pathname;
    const method = request.method;
    const ip = clientIp(request);
    const nowSql = sqlTime(new Date(nowMs));

    // 1. Session check (GET /v1/extranet/session)
    if (method === 'GET' && path === '/v1/extranet/session') {
      const auth = await requireExtranetAuth(request, env, ['owner', 'admin', 'staff', 'partner'], nowMs);
      return jsonResponse(
        {
          authenticated: true,
          csrfToken: auth.csrfToken,
          idleTimeoutSeconds: Math.floor(EXTRANET_IDLE_MS / 1000),
          user: { id: auth.memberId, email: auth.email, name: auth.name, role: auth.role },
        },
        200,
        { 'Set-Cookie': buildSessionCookie(auth.rawCookie) }
      );
    }

    // 2. Pre-session member status & passkey check (POST /v1/extranet/auth/status)
    if (method === 'POST' && path === '/v1/extranet/auth/status') {
      await checkD1RateLimit(env, `extranet:auth:${ip}`, 15, nowMs);
      const m = await resolveMemberFromBearer(request, env, nowMs);
      const role = await ensureExtranetRoleForMember(env, m, ip, nowMs);
      const pkRow = await env.DB.prepare(`SELECT COUNT(*) AS n FROM passkeys WHERE member_id=?`).bind(m.id).first();
      const hasPasskey = Number(pkRow?.n || 0) > 0;
      return jsonResponse({
        authorized: true,
        hasPasskey,
        passkeyRequired: false,
        step: hasPasskey ? 'verify_passkey' : 'setup_passkey',
        user: { id: m.id, email: m.email, name: m.name || null, role },
      });
    }

    // Email login requires a fresh, single-use OTP proof bound to this exact member token.
    if(method==='POST' && path==='/v1/extranet/auth/email'){
      await checkD1RateLimit(env,`extranet:email:${ip}`,15,nowMs);
      const body=await readJsonBody(request,8192);
      const m=await resolveMemberFromBearer(request,env,nowMs);
      const ticket=await verifyState(env.CODE_PEPPER,body.ticket);
      if(!ticket||ticket.p!=='extranet_email'||ticket.memberId!==m.id||ticket.tokenHash!==await sha256(bearerToken(request))||Math.abs(nowMs-ticket.t)>5*60000)fail(401,'Yeni bir e-posta giriş kodu ile doğrulayın.');
      const role=await ensureExtranetRoleForMember(env,m,ip,nowMs);
      const consumed=await env.DB.prepare('DELETE FROM login_codes WHERE id=? AND email=? AND used=1 RETURNING id').bind(ticket.codeId,m.email).first();
      if(!consumed)fail(401,'Bu giriş doğrulaması kullanılmış. Yeni kod isteyin.');
      const session=await createExtranetSession(env,request,m,role,nowMs);
      await writeAudit(env,{actorMemberId:m.id,actorRole:role,action:'login_email',targetType:'session',targetId:m.id,newValue:{method:'email_otp',role},ipAddress:ip,nowSql});
      return jsonResponse({authenticated:true,csrfToken:session.csrfToken,idleTimeoutSeconds:Math.floor(EXTRANET_IDLE_MS/1000),user:{id:m.id,email:m.email,name:m.name,role}},200,{'Set-Cookie':buildSessionCookie(session.rawToken)});
    }

    // 3. Initial Passkey enrollment ONLY when the Extranet user has 0 passkeys.
    //    If the member already has >= 1 passkey, bearer-only enrollment MUST return 403.
    if (method === 'POST' && path === '/v1/extranet/passkey/register/options') {
      await checkD1RateLimit(env, `extranet:auth:${ip}`, 10, nowMs);
      const m = await resolveMemberFromBearer(request, env, nowMs);
      const role = await ensureExtranetRoleForMember(env, m, ip, nowMs);
      const pkCountRow = await env.DB.prepare(`SELECT COUNT(*) AS n FROM passkeys WHERE member_id=?`).bind(m.id).first();
      if (Number(pkCountRow?.n || 0) >= 1) {
        await writeAudit(env, {
          actorMemberId: m.id,
          actorRole: role,
          action: 'access_denied',
          targetType: 'passkey',
          targetId: m.id,
          newValue: { reason: 'passkey_already_exists_bearer_rejected', endpoint: path },
          ipAddress: ip,
          nowSql,
        });
        fail(
          403,
          'Bu hesapta zaten kayıtlı bir passkey bulunuyor. Yeni passkey yalnızca mevcut passkey ile açılmış Extranet oturumu üzerinden eklenebilir.',
          'PASSKEY_ALREADY_EXISTS'
        );
      }
      const enrollmentBody=await readJsonBody(request);
      await requireFreshEnrollment(request,env,m,enrollmentBody.ticket,nowMs);
      const { rpID } = resolveWebAuthnConfig(env);
      const options = await generateRegistrationOptions({
        rpName: 'Bosphorly Extranet',
        rpID,
        userName: m.email,
        userID: enc.encode(m.id),
        excludeCredentials: [],
        timeout: 60000,
        attestationType: 'none',
        authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
      });
      const expSql = sqlTime(new Date(nowMs + 5 * 60 * 1000));
      await env.DB.prepare(
        `INSERT OR REPLACE INTO passkey_challenges (id, challenge, member_id, purpose, expires_at, created_at)
         VALUES (?, ?, ?, 'registration', ?, ?)`
      ).bind(`ex-init:${uuid()}`, options.challenge, m.id, expSql, nowSql).run();
      return jsonResponse(options);
    }

    if (method === 'POST' && path === '/v1/extranet/passkey/register/verify') {
      await checkD1RateLimit(env, `extranet:auth:${ip}`, 10, nowMs);
      const m = await resolveMemberFromBearer(request, env, nowMs);
      const role = await ensureExtranetRoleForMember(env, m, ip, nowMs);
      const pkCountRow = await env.DB.prepare(`SELECT COUNT(*) AS n FROM passkeys WHERE member_id=?`).bind(m.id).first();
      if (Number(pkCountRow?.n || 0) >= 1) {
        await writeAudit(env, {
          actorMemberId: m.id,
          actorRole: role,
          action: 'access_denied',
          targetType: 'passkey',
          targetId: m.id,
          newValue: { reason: 'passkey_already_exists_bearer_rejected', endpoint: path },
          ipAddress: ip,
          nowSql,
        });
        fail(
          403,
          'Bu hesapta zaten kayıtlı bir passkey bulunuyor. Yeni passkey yalnızca mevcut passkey ile açılmış Extranet oturumu üzerinden eklenebilir.',
          'PASSKEY_ALREADY_EXISTS'
        );
      }
      const body = await readJsonBody(request, 16384);
      await requireFreshEnrollment(request,env,m,body.ticket,nowMs);
      const { rpID, expectedOrigin } = resolveWebAuthnConfig(env);

      const clientDataRaw = body?.response?.clientDataJSON;
      if (!clientDataRaw) fail(400, 'Geçersiz passkey yanıtı.');
      let clientData;
      try {
        clientData = JSON.parse(b64urlDecode(clientDataRaw));
      } catch {
        fail(400, 'Geçersiz clientDataJSON.');
      }
      const ch = clientData?.challenge;
      if (!ch) fail(400, 'Passkey doğrulama kodu eksik.');

      const chRow = await env.DB.prepare(
        `SELECT * FROM passkey_challenges WHERE challenge=? AND member_id=? AND purpose='registration' AND expires_at>?`
      ).bind(ch, m.id, nowSql).first();
      if (!chRow || !String(chRow.id || '').startsWith('ex-init:')) {
        fail(400, 'Geçersiz veya süresi dolmuş passkey isteği.');
      }
      await env.DB.prepare(`DELETE FROM passkey_challenges WHERE id=?`).bind(chRow.id).run();

      const verification = await verifyRegistrationResponse({
        response: body,
        expectedChallenge: ch,
        expectedOrigin,
        expectedRPID: rpID,
      });
      if (!verification.verified || !verification.registrationInfo) {
        fail(400, 'Passkey doğrulaması başarısız.');
      }

      const { credential } = verification.registrationInfo;
      const credentialID = credential.id;
      const dup = await env.DB.prepare(`SELECT 1 AS x FROM passkeys WHERE credential_id=?`).bind(credentialID).first();
      if (dup) fail(409, 'Bu passkey zaten kayıtlı.');

      const proof=await verifyState(env.CODE_PEPPER,body.ticket);
      const consumed=await env.DB.prepare('DELETE FROM login_codes WHERE id=? AND email=? AND used=1 RETURNING id').bind(proof.codeId,m.email).first();
      if(!consumed)fail(401,'E-posta doğrulaması kullanılmış.');
      const publicKey = uint8ArrayToB64(credential.publicKey);
      const counter = credential.counter || 0;
      const rawTransports = Array.isArray(body?.response?.transports)
        ? body.response.transports
        : Array.isArray(credential.transports)
        ? credential.transports
        : null;
      const transports = rawTransports ? JSON.stringify(rawTransports.filter((t) => typeof t === 'string').slice(0, 8)) : null;

      await env.DB.prepare(
        `INSERT INTO passkeys (credential_id, member_id, public_key, counter, transports, created_at, last_used_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(credentialID, m.id, publicKey, counter, transports, nowSql, nowSql).run();

      const session = await createExtranetSession(env, request, m, role, nowMs);
      const mailAlert = await sendOwnerPasskeyNotification(env, {
        memberEmail: m.email,
        role,
        credentialId: credentialID,
        flow: 'initial_enroll',
        ipAddress: session.ip,
        nowMs,
      });

      await writeAudit(env, {
        actorMemberId: m.id,
        actorRole: role,
        action: 'passkey_register',
        targetType: 'passkey',
        targetId: credentialID,
        newValue: {
          flow: 'initial_enroll',
          role,
          ownerNotified: mailAlert.sent,
          ...(mailAlert.reason ? { notifyStatus: mailAlert.reason } : {}),
        },
        ipAddress: session.ip,
        nowSql,
      });

      return jsonResponse(
        {
          authenticated: true,
          csrfToken: session.csrfToken,
          idleTimeoutSeconds: Math.floor(EXTRANET_IDLE_MS / 1000),
          user: { id: m.id, email: m.email, name: m.name || null, role },
        },
        200,
        { 'Set-Cookie': buildSessionCookie(session.rawToken) }
      );
    }

    // 3b. Separate endpoint to add a new passkey when the user ALREADY has >= 1 passkey:
    //     Requires an active passkey-verified Extranet cookie session + valid X-CSRF-Token!
    if (method === 'POST' && path === '/v1/extranet/passkeys/add/options') {
      const auth = await requireExtranetAuth(request, env, ['owner', 'admin', 'staff', 'partner'], nowMs);
      await checkD1RateLimit(env, `extranet:pkadd:${auth.memberId}`, 10, nowMs);
      const { rpID } = resolveWebAuthnConfig(env);
      const existing = (await env.DB.prepare(`SELECT credential_id, transports FROM passkeys WHERE member_id=?`).bind(auth.memberId).all()).results || [];
      const excludeCredentials = existing.map((k) => ({
        id: k.credential_id,
        transports: k.transports ? JSON.parse(k.transports) : undefined,
      }));
      const options = await generateRegistrationOptions({
        rpName: 'Bosphorly Extranet',
        rpID,
        userName: auth.email,
        userID: enc.encode(auth.memberId),
        excludeCredentials,
        timeout: 60000,
        attestationType: 'none',
        authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
      });
      const expSql = sqlTime(new Date(nowMs + 5 * 60 * 1000));
      await env.DB.prepare(
        `INSERT OR REPLACE INTO passkey_challenges (id, challenge, member_id, purpose, expires_at, created_at)
         VALUES (?, ?, ?, 'registration', ?, ?)`
      ).bind(`ex-add:${uuid()}`, options.challenge, auth.memberId, expSql, nowSql).run();
      return jsonResponse(options, 200, { 'Set-Cookie': buildSessionCookie(auth.rawCookie) });
    }

    if (method === 'POST' && path === '/v1/extranet/passkeys/add/verify') {
      const auth = await requireExtranetAuth(request, env, ['owner', 'admin', 'staff', 'partner'], nowMs);
      await checkD1RateLimit(env, `extranet:pkadd:${auth.memberId}`, 10, nowMs);
      const body = await readJsonBody(request, 16384);
      const { rpID, expectedOrigin } = resolveWebAuthnConfig(env);

      const clientDataRaw = body?.response?.clientDataJSON;
      if (!clientDataRaw) fail(400, 'Geçersiz passkey yanıtı.');
      let clientData;
      try {
        clientData = JSON.parse(b64urlDecode(clientDataRaw));
      } catch {
        fail(400, 'Geçersiz clientDataJSON.');
      }
      const ch = clientData?.challenge;
      if (!ch) fail(400, 'Passkey doğrulama kodu eksik.');

      const chRow = await env.DB.prepare(
        `SELECT * FROM passkey_challenges WHERE challenge=? AND member_id=? AND purpose='registration' AND expires_at>?`
      ).bind(ch, auth.memberId, nowSql).first();
      if (!chRow || !String(chRow.id || '').startsWith('ex-add:')) {
        fail(400, 'Geçersiz veya süresi dolmuş passkey ekleme isteği.');
      }
      await env.DB.prepare(`DELETE FROM passkey_challenges WHERE id=?`).bind(chRow.id).run();

      const verification = await verifyRegistrationResponse({
        response: body,
        expectedChallenge: ch,
        expectedOrigin,
        expectedRPID: rpID,
      });
      if (!verification.verified || !verification.registrationInfo) {
        fail(400, 'Passkey doğrulaması başarısız.');
      }

      const { credential } = verification.registrationInfo;
      const credentialID = credential.id;
      const dup = await env.DB.prepare(`SELECT 1 AS x FROM passkeys WHERE credential_id=?`).bind(credentialID).first();
      if (dup) fail(409, 'Bu passkey zaten kayıtlı.');

      const publicKey = uint8ArrayToB64(credential.publicKey);
      const counter = credential.counter || 0;
      const rawTransports = Array.isArray(body?.response?.transports)
        ? body.response.transports
        : Array.isArray(credential.transports)
        ? credential.transports
        : null;
      const transports = rawTransports ? JSON.stringify(rawTransports.filter((t) => typeof t === 'string').slice(0, 8)) : null;

      await env.DB.prepare(
        `INSERT INTO passkeys (credential_id, member_id, public_key, counter, transports, created_at, last_used_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(credentialID, auth.memberId, publicKey, counter, transports, nowSql, nowSql).run();

      const mailAlert = await sendOwnerPasskeyNotification(env, {
        memberEmail: auth.email,
        role: auth.role,
        credentialId: credentialID,
        flow: 'extranet_session_add',
        ipAddress: auth.ipAddress,
        nowMs,
      });

      await writeAudit(env, {
        actorMemberId: auth.memberId,
        actorRole: auth.role,
        action: 'passkey_register',
        targetType: 'passkey',
        targetId: credentialID,
        newValue: {
          flow: 'extranet_session_add',
          role: auth.role,
          ownerNotified: mailAlert.sent,
          ...(mailAlert.reason ? { notifyStatus: mailAlert.reason } : {}),
        },
        ipAddress: auth.ipAddress,
        nowSql,
      });

      return jsonResponse(
        {
          verified: true,
          ownerNotified: mailAlert.sent,
          passkey: { id: credentialID, createdAt: nowSql },
        },
        200,
        { 'Set-Cookie': buildSessionCookie(auth.rawCookie) }
      );
    }

    // 4. Passkey Login / Step-Up Verification for Extranet
    if (method === 'POST' && path === '/v1/extranet/passkey/login/options') {
      await checkD1RateLimit(env, `extranet:auth:${ip}`, 15, nowMs);
      const { rpID } = resolveWebAuthnConfig(env);
      let allowCredentials;
      let memberId = null;
      if (bearerToken(request)) {
        const m = await resolveMemberFromBearer(request, env, nowMs);
        await ensureExtranetRoleForMember(env, m, ip, nowMs);
        memberId = m.id;
        const pks = (await env.DB.prepare(`SELECT credential_id, transports FROM passkeys WHERE member_id=?`).bind(m.id).all()).results || [];
        if (!pks.length) fail(409, 'Önce passkey kurulumu yapılmalıdır.', 'PASSKEY_SETUP_NEEDED');
        allowCredentials = pks.map((k) => ({
          id: k.credential_id,
          transports: k.transports ? JSON.parse(k.transports) : undefined,
        }));
      }
      const options = await generateAuthenticationOptions({
        rpID,
        allowCredentials,
        timeout: 60000,
        userVerification: 'required',
      });
      const expSql = sqlTime(new Date(nowMs + 5 * 60 * 1000));
      await env.DB.prepare(
        `INSERT OR REPLACE INTO passkey_challenges (id, challenge, member_id, purpose, expires_at, created_at)
         VALUES (?, ?, ?, 'authentication', ?, ?)`
      ).bind(uuid(), options.challenge, memberId, expSql, nowSql).run();
      return jsonResponse(options);
    }

    if (method === 'POST' && path === '/v1/extranet/passkey/login/verify') {
      await checkD1RateLimit(env, `extranet:auth:${ip}`, 15, nowMs);
      const body = await readJsonBody(request, 16384);
      const { rpID, expectedOrigin } = resolveWebAuthnConfig(env);

      const clientDataRaw = body?.response?.clientDataJSON;
      if (!clientDataRaw) fail(400, 'Geçersiz passkey yanıtı.');
      let clientData;
      try {
        clientData = JSON.parse(b64urlDecode(clientDataRaw));
      } catch {
        fail(400, 'Geçersiz clientDataJSON.');
      }
      const ch = clientData?.challenge;
      if (!ch) fail(400, 'Passkey doğrulama kodu eksik.');

      const chRow = await env.DB.prepare(
        `SELECT * FROM passkey_challenges WHERE challenge=? AND purpose='authentication' AND expires_at>?`
      ).bind(ch, nowSql).first();
      if (!chRow) fail(400, 'Geçersiz veya süresi dolmuş passkey isteği.');
      await env.DB.prepare(`DELETE FROM passkey_challenges WHERE id=?`).bind(chRow.id).run();

      const credId = str(body.id || body.rawId || '', 512);
      if (!credId) fail(400, 'Passkey kimliği eksik.');
      const passkey = await env.DB.prepare(`SELECT * FROM passkeys WHERE credential_id=?`).bind(credId).first();
      if (!passkey) fail(400, 'Tanınmayan passkey.');
      if (chRow.member_id && passkey.member_id !== chRow.member_id) {
        fail(403, 'Passkey aktif üye hesabıyla eşleşmiyor.');
      }

      const m = await env.DB.prepare(`SELECT * FROM members WHERE id=?`).bind(passkey.member_id).first();
      if (!m) fail(400, 'Üye kaydı bulunamadı.');

      const verification = await verifyAuthenticationResponse({
        response: body,
        expectedChallenge: ch,
        expectedOrigin,
        expectedRPID: rpID,
        credential: {
          id: passkey.credential_id,
          publicKey: b64ToUint8Array(passkey.public_key),
          counter: passkey.counter || 0,
          transports: passkey.transports ? JSON.parse(passkey.transports) : undefined,
        },
      });
      if (!verification.verified) fail(400, 'Passkey imzası doğrulanamadı.');

      // Enforce Extranet role on server before issuing Extranet cookie
      const role = await ensureExtranetRoleForMember(env, m, ip, nowMs);

      await env.DB.prepare(`UPDATE passkeys SET counter=?, last_used_at=? WHERE credential_id=?`)
        .bind(verification.authenticationInfo.newCounter, nowSql, passkey.credential_id)
        .run();

      const session = await createExtranetSession(env, request, m, role, nowMs);
      await writeAudit(env, {
        actorMemberId: m.id,
        actorRole: role,
        action: 'login',
        targetType: 'session',
        targetId: passkey.credential_id,
        newValue: { method: 'passkey', role },
        ipAddress: session.ip,
        nowSql,
      });

      return jsonResponse(
        {
          authenticated: true,
          csrfToken: session.csrfToken,
          idleTimeoutSeconds: Math.floor(EXTRANET_IDLE_MS / 1000),
          user: { id: m.id, email: m.email, name: m.name || null, role },
        },
        200,
        { 'Set-Cookie': buildSessionCookie(session.rawToken) }
      );
    }

    // 5. Logout (POST /v1/extranet/logout)
    if (method === 'POST' && path === '/v1/extranet/logout') {
      const auth = await requireExtranetAuth(request, env, ['owner', 'admin', 'staff', 'partner'], nowMs);
      await env.DB.batch([
        env.DB.prepare(`DELETE FROM extranet_sessions WHERE token_hash=?`).bind(auth.tokenHash),
        buildAuditStatement(env, {
          actorMemberId: auth.memberId,
          actorRole: auth.role,
          action: 'logout',
          targetType: 'session',
          targetId: auth.memberId,
          ipAddress: auth.ipAddress,
          nowSql,
        }),
      ]);
      return jsonResponse({ signedOut: true }, 200, { 'Set-Cookie': buildClearSessionCookie() });
    }

    // --- Authenticated Extranet Endpoints (sliding cookie refreshed on every valid call) ---

    const catalog=await catalogRoutes(request,env,url,nowMs,{auth:requireExtranetAuth,fail,json:jsonResponse,body:readJsonBody,audit:buildAuditStatement,cookie:buildSessionCookie,containsCard:containsCardNumber});
    if(catalog)return catalog;
    const partners=await partnerRoutes(request,env,url,nowMs,{auth:requireExtranetAuth,fail,json:jsonResponse,body:readJsonBody,audit:buildAuditStatement,maskEmail,cookie:buildSessionCookie,containsCard:containsCardNumber,reservation:loadSingleReservation,changeStatus:changeReservationStatus,ownerEmail:isOwnerEmail});
    if(partners)return partners;
    const campaigns=await campaignRoutes(request,env,url,nowMs,{auth:requireExtranetAuth,fail,json:jsonResponse,body:readJsonBody,audit:buildAuditStatement,maskEmail,cookie:buildSessionCookie,containsCard:containsCardNumber});
    if(campaigns)return campaigns;
    const operations=await operationsRoutes(request,env,url,nowMs,{auth:requireExtranetAuth,fail,json:jsonResponse,body:readJsonBody,audit:buildAuditStatement,maskEmail,cookie:buildSessionCookie,reservation:loadSingleReservation});
    if(operations)return operations;

    const stage2 = await stage2Routes(request,env,url,nowMs,{auth:requireExtranetAuth,fail,json:jsonResponse,body:readJsonBody,audit:buildAuditStatement,ownerEmail:isOwnerEmail,maskEmail,maskPhone,cookie:buildSessionCookie});
    if(stage2)return stage2;

    // 6. Dashboard (GET /v1/extranet/dashboard)
    if (method === 'GET' && path === '/v1/extranet/dashboard') {
      const auth = await requireExtranetAuth(request, env, ['owner', 'admin', 'staff'], nowMs);
      const data = await computeDashboardMetrics(env, nowMs);
      await writeAudit(env, {
        actorMemberId: auth.memberId,
        actorRole: auth.role,
        action: 'view_dashboard',
        targetType: 'dashboard',
        ipAddress: auth.ipAddress,
        nowSql,
      });
      return jsonResponse(data, 200, { 'Set-Cookie': buildSessionCookie(auth.rawCookie) });
    }

    // 7. Providers list (GET /v1/extranet/providers)
    if (method === 'GET' && path === '/v1/extranet/providers') {
      const auth = await requireExtranetAuth(request, env, ['owner', 'admin', 'staff'], nowMs);
      const rows = (await env.DB.prepare(
        `SELECT id, status, currency, license_reference, verified_at FROM providers ORDER BY status DESC, id ASC`
      ).all()).results || [];
      await writeAudit(env, {
        actorMemberId: auth.memberId,
        actorRole: auth.role,
        action: 'list_providers',
        targetType: 'provider',
        ipAddress: auth.ipAddress,
        nowSql,
      });
      return jsonResponse(
        {
          providers: rows.map((p) => ({
            id: p.id,
            status: p.status,
            currency: p.currency,
            licenseReference: p.license_reference || null,
            verifiedAt: p.verified_at || null,
          })),
        },
        200,
        { 'Set-Cookie': buildSessionCookie(auth.rawCookie) }
      );
    }

    // 8. Reservations list (GET /v1/extranet/bookings)
    if (method === 'GET' && path === '/v1/extranet/bookings') {
      const auth = await requireExtranetAuth(request, env, ['owner', 'admin', 'staff'], nowMs);
      const filters = parseBookingFilters(url.searchParams);
      const allLoaded = await loadAllReservations(env, {
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        dateType: filters.dateType,
      });

      const productMap = new Map();
      const sourcesSet = new Set(['web', 'member', 'hotel_qr', 'telegram', 'partner']);
      const langsSet = new Set(['tr', 'en', 'ru', 'de', 'ar']);
      for (const item of allLoaded) {
        if (item.productId && !productMap.has(item.productId)) {
          productMap.set(item.productId, item.productTitle || item.productId);
        }
        if (item.source) sourcesSet.add(item.source);
        if (item.lang) langsSet.add(item.lang);
      }
      const expRows = (await env.DB.prepare(`SELECT id, title FROM experiences ORDER BY title ASC`).all()).results || [];
      for (const e of expRows) {
        if (!productMap.has(e.id)) productMap.set(e.id, e.title);
      }

      const filtered = applyReservationFilters(allLoaded, filters);
      const total = filtered.length;
      const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));
      const safePage = Math.min(filters.page, totalPages);
      const start = (safePage - 1) * filters.pageSize;
      const items = filtered.slice(start, start + filters.pageSize).map(stripInternalFields);

      await writeAudit(env, {
        actorMemberId: auth.memberId,
        actorRole: auth.role,
        action: 'list_bookings',
        targetType: 'booking',
        newValue: {
          page: safePage,
          pageSize: filters.pageSize,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          product: filters.product,
          status: filters.status,
          source: filters.source,
          lang: filters.lang,
          tier: filters.tier,
          hasQuery: !!filters.q,
          resultCount: items.length,
        },
        ipAddress: auth.ipAddress,
        nowSql,
      });

      return jsonResponse(
        {
          items,
          total,
          page: safePage,
          pageSize: filters.pageSize,
          totalPages,
          filterOptions: {
            products: [...productMap.entries()].map(([id, title]) => ({ id, title })),
            sources: [...sourcesSet].sort(),
            languages: [...langsSet].sort(),
          },
        },
        200,
        { 'Set-Cookie': buildSessionCookie(auth.rawCookie) }
      );
    }

    // 9. CSV Export of Reservations — ONLY OWNER (POST /v1/extranet/bookings/export)
    if (method === 'POST' && path === '/v1/extranet/bookings/export') {
      const auth = await requireExtranetAuth(request, env, ['owner'], nowMs);
      const body = await readJsonBody(request, 4096);
      const sp = new URLSearchParams();
      for (const k of ['dateFrom', 'dateTo', 'dateType', 'product', 'status', 'source', 'lang', 'tier', 'q']) {
        if (typeof body[k] === 'string' && body[k].trim()) sp.set(k, body[k].trim());
      }
      const filters = parseBookingFilters(sp);
      const allLoaded = await loadAllReservations(env, {
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        dateType: filters.dateType,
      });
      const filtered = applyReservationFilters(allLoaded, filters);

      const header = [
        'Referans',
        'Kayit_Turu',
        'Urun_Kodu',
        'Urun_Adi',
        'Hizmet_Tarihi',
        'Kisi_Sayisi',
        'Fiyat',
        'Para_Birimi',
        'Kupon',
        'Durum',
        'Odeme_Durumu',
        'Tedarikci',
        'Kaynak',
        'Dil',
        'Uye_Seviyesi',
        'Misafir_Adi',
        'Misafir_Eposta_Maskeli',
        'Misafir_Telefon_Maskeli',
        'Olusturulma_Zamani',
      ];

      const lines = [header.join(',')];
      for (const row of filtered) {
        lines.push(
          [
            row.displayRef,
            row.recordType,
            row.productId,
            row.productTitle,
            row.serviceDate,
            row.guests,
            row.priceDisplay,
            row.currency || '',
            row.coupon ? row.coupon.code : '',
            row.status,
            row.paymentStatus,
            row.providerId || '',
            row.source,
            row.lang,
            row.memberTier,
            row.guestName || '',
            row.guestEmailMasked || '',
            row.guestPhoneMasked || '',
            row.createdAt || '',
          ]
            .map(escapeCsvCell)
            .join(',')
        );
      }

      await writeAudit(env, {
        actorMemberId: auth.memberId,
        actorRole: auth.role,
        action: 'export_bookings_csv',
        targetType: 'booking',
        newValue: {
          rowCount: filtered.length,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          product: filters.product,
          status: filters.status,
        },
        ipAddress: auth.ipAddress,
        nowSql,
      });

      const csvBody = '\uFEFF' + lines.join('\r\n');
      return new Response(csvBody, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="bosphorly-rezervasyonlar-${nowSql.slice(0, 10)}.csv"`,
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
          'Set-Cookie': buildSessionCookie(auth.rawCookie),
        },
      });
    }

    // 10. Dynamic single-booking routes (/v1/extranet/bookings/:id[/:subaction])
    const detailMatch = path.match(/^\/v1\/extranet\/bookings\/([^/]+)(?:\/(reveal-pii|status|payment|provider|notes))?$/);
    if (detailMatch) {
      const rawBookingId = detailMatch[1];
      const subAction = detailMatch[2] || null;

      // 10a. View Reservation Detail (GET /v1/extranet/bookings/:id)
      if (!subAction && method === 'GET') {
        const auth = await requireExtranetAuth(request, env, ['owner', 'admin', 'staff'], nowMs);
        const bundle = await loadReservationDetailBundle(env, rawBookingId);
        bundle.booking.emailHistory=(await env.DB.prepare("SELECT id,actor_id,subject,status,created_at FROM extranet_booking_emails WHERE record_type=? AND record_id=? ORDER BY created_at DESC").bind(bundle.booking.recordType,bundle.booking.recordId).all()).results||[];
        await writeAudit(env, {
          actorMemberId: auth.memberId,
          actorRole: auth.role,
          action: 'view_booking',
          targetType: 'booking',
          targetId: bundle.booking.uid,
          ipAddress: auth.ipAddress,
          nowSql,
        });
        return jsonResponse(
          { booking: bundle.booking, availableProviders: bundle.availableProviders },
          200,
          { 'Set-Cookie': buildSessionCookie(auth.rawCookie) }
        );
      }

      // 10b. Reveal Masked PII (POST /v1/extranet/bookings/:id/reveal-pii)
      if (subAction === 'reveal-pii' && method === 'POST') {
        const auth = await requireExtranetAuth(request, env, ['owner', 'admin', 'staff'], nowMs);
        await checkD1RateLimit(env, `extranet:pii:${auth.memberId}`, 20, nowMs);
        const body = await readJsonBody(request, 1024);
        const field = body.field;
        if (field !== 'email' && field !== 'phone') {
          fail(400, 'Yalnızca e-posta veya telefon alanı açılabilir.');
        }
        const item = await loadSingleReservation(env, rawBookingId);
        const revealed = field === 'email' ? item._rawEmail : item._rawPhone;
        await writeAudit(env, {
          actorMemberId: auth.memberId,
          actorRole: auth.role,
          action: 'reveal_pii',
          targetType: 'booking_pii',
          targetId: item.uid,
          oldValue: { field, masked: true },
          newValue: { field, revealed: !!revealed },
          ipAddress: auth.ipAddress,
          nowSql,
        });
        return jsonResponse(
          { field, value: revealed || null },
          200,
          { 'Set-Cookie': buildSessionCookie(auth.rawCookie) }
        );
      }

      // 10c. Update Reservation Workflow Status (POST /v1/extranet/bookings/:id/status)
      // Allowed roles: owner, admin, staff
      if (subAction === 'status' && method === 'POST') {
        const auth=await requireExtranetAuth(request,env,['owner','admin','staff'],nowMs);
        return await changeReservationStatus(request,env,auth,rawBookingId,nowSql);
      }

      // 10d. Manual Payment Status Record — owner & admin only (POST /v1/extranet/bookings/:id/payment)
      if (subAction === 'payment' && method === 'POST') {
        const auth = await requireExtranetAuth(request, env, ['owner', 'admin'], nowMs);
        const body = await readJsonBody(request, 2048);
        const allowedKeys = new Set(['paymentStatus', 'note', 'refundedMinor']);
        if (Object.keys(body).some((k) => !allowedKeys.has(k))) {
          fail(400, 'Yalnızca ödeme durumu (beklemede/ödendi/iade edildi) kaydedilebilir; kart veya ödeme aracı bilgisi gönderilemez.');
        }
        const nextPayment = str(body.paymentStatus, 24);
        if (!nextPayment || !PAYMENT_STATUSES.includes(nextPayment)) {
          fail(400, 'Geçersiz ödeme durumu.');
        }
        const note = body.note !== undefined && body.note !== null ? str(String(body.note), 400) : null;
        if (note && containsCardNumber(note)) {
          fail(400, 'Güvenlik kuralı: Kart numarası hiçbir alana girilemez ve kaydedilemez.');
        }

        const item = await loadSingleReservation(env, rawBookingId);
        const oldPayment = item.paymentStatus;
        const refundedMinor = body.refundedMinor ?? item.refundedMinor ?? 0;
        if (!Number.isSafeInteger(refundedMinor) || refundedMinor < 0 ||
            (refundedMinor > 0 && (!Number.isSafeInteger(item.totalMinor) || refundedMinor > item.totalMinor))) {
          fail(400, 'İade tutarı toplam tutarı aşmayan, kuruş cinsinden pozitif bir tam sayı olmalı.');
        }

        const stmts = [
          upsertMetaStatement(env, item, { paymentStatus: nextPayment, refundedMinor }, nowSql),
          env.DB.prepare(
            `INSERT INTO booking_events (id, booking_id, idempotency_key, from_state, to_state, actor_id, evidence_reference, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            uuid(),
            item.recordType === 'booking' ? item.recordId : null,
            uuid(),
            `payment:${oldPayment}`,
            `payment:${nextPayment}`,
            auth.memberId,
            `extranet:${item.recordType === 'booking' ? 'bk' : 'mr'}:${item.recordId}:payment:${oldPayment}->${nextPayment}`,
            nowSql
          ),
          buildAuditStatement(env, {
            actorMemberId: auth.memberId,
            actorRole: auth.role,
            action: 'update_payment_status',
            targetType: 'booking',
            targetId: item.uid,
            oldValue: { paymentStatus: oldPayment, refundedMinor: item.refundedMinor },
            newValue: { paymentStatus: nextPayment, refundedMinor },
            ipAddress: auth.ipAddress,
            nowSql,
          }),
        ];

        if (note) {
          stmts.push(
            env.DB.prepare(
              `INSERT INTO extranet_booking_notes (id, record_type, record_id, author_member_id, author_role, note, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).bind(uuid(), item.recordType, item.recordId, auth.memberId, auth.role, `[Ödeme kaydı: ${nextPayment}] ${note}`, nowSql)
          );
        }

        await env.DB.batch(stmts);
        const updated = await loadReservationDetailBundle(env, item.uid);
        return jsonResponse(
          { booking: updated.booking, availableProviders: updated.availableProviders },
          200,
          { 'Set-Cookie': buildSessionCookie(auth.rawCookie) }
        );
      }

      // 10e. Assign Provider to Reservation — owner & admin only (POST /v1/extranet/bookings/:id/provider)
      if (subAction === 'provider' && method === 'POST') {
        const auth = await requireExtranetAuth(request, env, ['owner', 'admin'], nowMs);
        const body = await readJsonBody(request, 2048);
        const providerId = body.providerId === null || body.providerId === '' ? null : str(body.providerId, 80);
        if (body.providerId !== null && body.providerId !== '' && !providerId) {
          fail(400, 'Geçersiz tedarikçi kimliği.');
        }

        if (providerId) {
          const prov = await env.DB.prepare(`SELECT id, status FROM providers WHERE id=?`).bind(providerId).first();
          if (!prov) fail(404, 'Seçilen tedarikçi bulunamadı.');
          if (prov.status === 'suspended') fail(400, 'Askıya alınmış tedarikçi atanamaz.');
        }

        const item = await loadSingleReservation(env, rawBookingId);
        const oldProviderId = item.providerId || null;

        await env.DB.batch([
          upsertMetaStatement(env, item, { assignedProviderId: providerId }, nowSql),
          env.DB.prepare(
            `INSERT INTO booking_events (id, booking_id, idempotency_key, from_state, to_state, actor_id, evidence_reference, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            uuid(),
            item.recordType === 'booking' ? item.recordId : null,
            uuid(),
            `provider:${oldProviderId || 'none'}`,
            `provider:${providerId || 'none'}`,
            auth.memberId,
            `extranet:${item.recordType === 'booking' ? 'bk' : 'mr'}:${item.recordId}:provider:${providerId || 'none'}`,
            nowSql
          ),
          buildAuditStatement(env, {
            actorMemberId: auth.memberId,
            actorRole: auth.role,
            action: 'assign_provider',
            targetType: 'booking',
            targetId: item.uid,
            oldValue: { providerId: oldProviderId },
            newValue: { providerId },
            ipAddress: auth.ipAddress,
            nowSql,
          }),
        ]);

        const updated = await loadReservationDetailBundle(env, item.uid);
        return jsonResponse(
          { booking: updated.booking, availableProviders: updated.availableProviders },
          200,
          { 'Set-Cookie': buildSessionCookie(auth.rawCookie) }
        );
      }

      // 10f. Add Internal Extranet Note (POST /v1/extranet/bookings/:id/notes)
      // Allowed roles: owner, admin, staff
      if (subAction === 'notes' && method === 'POST') {
        const auth = await requireExtranetAuth(request, env, ['owner', 'admin', 'staff'], nowMs);
        const body = await readJsonBody(request, 8192);
        const noteText = str(body.note, 2000);
        if (!noteText) fail(400, 'Not metni boş olamaz (en fazla 2000 karakter).');
        if (containsCardNumber(noteText)) {
          fail(400, 'Güvenlik kuralı: Kart numarası iç notlara yazılamaz ve kaydedilemez.');
        }

        const item = await loadSingleReservation(env, rawBookingId);
        const noteId = uuid();

        await env.DB.batch([
          env.DB.prepare(
            `INSERT INTO extranet_booking_notes (id, record_type, record_id, author_member_id, author_role, note, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).bind(noteId, item.recordType, item.recordId, auth.memberId, auth.role, noteText, nowSql),
          buildAuditStatement(env, {
            actorMemberId: auth.memberId,
            actorRole: auth.role,
            action: 'add_booking_note',
            targetType: 'booking_note',
            targetId: item.uid,
            newValue: { noteId, length: noteText.length },
            ipAddress: auth.ipAddress,
            nowSql,
          }),
        ]);

        const updated = await loadReservationDetailBundle(env, item.uid);
        return jsonResponse(
          { booking: updated.booking, availableProviders: updated.availableProviders },
          200,
          { 'Set-Cookie': buildSessionCookie(auth.rawCookie) }
        );
      }

      fail(405, 'Desteklenmeyen HTTP metodu.');
    }

    await requireExtranetAuth(request,env,[...ROLES],nowMs);
    fail(404, 'Extranet uç noktası bulunamadı.');
  } catch (e) {
    if(e instanceof MemberSuspendedError)return jsonResponse({error:e.message},403,{'Set-Cookie':buildClearSessionCookie()});
    if (e instanceof ExtranetError) {
      const extra = e.clearCookie ? { 'Set-Cookie': buildClearSessionCookie() } : {};
      return jsonResponse({ error: e.message, ...(e.code ? { code: e.code } : {}) }, e.status, extra);
    }
    return jsonResponse({ error: 'Geçersiz istek veya geçici sunucu hatası.' }, 400);
  }
}
