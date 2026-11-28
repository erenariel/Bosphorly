import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import worker from '../backend/worker.js';
import { EXTRANET_COOKIE_NAME, handleExtranetRoutes } from '../backend/extranet.js';
import { SUPPORTED_LANGS } from '../backend/assistant.js';
import {
  DEFAULT_TELNYX_MESSAGING_PROFILE_ID,
  handleWhatsApp,
  parseWhatsApp,
  processWhatsApp,
  whatsAppSkip,
} from '../backend/whatsapp.js';
import { computeTelegramWebhookSecret, handleTelegramWebhook } from '../backend/telegram.js';
import {
  EMERGENCY_OWNER_EMAIL,
  ENV_LOCK_WARNING,
  MIMO_MAINTENANCE_MESSAGES,
  OTP_COOLDOWN_MS,
  OTP_TTL_MS,
  allowWhatsAppWebhook,
  flushEmergencyNotifications,
  isChannelEnabled,
} from '../backend/emergency.js';

const MIGRATIONS_DIR = new URL('../backend/migrations/', import.meta.url).pathname;
const ORIGIN = 'https://bosphorly.com';
const VERIFY_GMAIL = 'personal-verify@gmail.example';
const COLLEAGUE_NOTIFY = 'colleague@bosphorly.example';
const WA_BUSINESS = '+16197386408';
const WA_GUEST = '+905551112233';

function createD1() {
  const db = new DatabaseSync(':memory:');
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
  }
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...args).changes) } }),
    _run: () => db.prepare(sql).run(...args),
  });
  return {
    raw: db,
    prepare: (sql) => stmt(sql),
    batch: async (list) => {
      db.exec('BEGIN');
      try {
        const res = list.map((s) => s._run());
        db.exec('COMMIT');
        return res;
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },
  };
}

function createKvStore(sharedMap = new Map()) {
  return {
    map: sharedMap,
    async get(key, type) {
      if (!sharedMap.has(key)) return null;
      const raw = sharedMap.get(key);
      if (type === 'json') {
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      }
      return raw;
    },
    async put(key, val, opts) {
      if (opts && opts.expirationTtl !== undefined) {
        assert.ok(opts.expirationTtl <= 2592000, 'KV expirationTtl must be <= 30 days');
      }
      sharedMap.set(key, String(val));
    },
  };
}

async function createTelnyxKeyPair() {
  const pair = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  const publicKeyB64 = Buffer.from(await crypto.subtle.exportKey('raw', pair.publicKey)).toString('base64');
  return { privateKey: pair.privateKey, publicKeyB64 };
}

async function signTelnyxRequest(rawBody, privateKey, url = 'https://api.bosphorly.com/webhooks/whatsapp/telnyx') {
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = Buffer.from(
    await crypto.subtle.sign('Ed25519', privateKey, new TextEncoder().encode(`${ts}|${rawBody}`))
  ).toString('base64');
  return new Request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'telnyx-timestamp': ts,
      'telnyx-signature-ed25519': sig,
    },
    body: rawBody,
  });
}

function buildWaInboundPayload(text = 'Boğaz turu hakkında bilgi alabilir miyim?', id = 'wa-msg-1', tsSec = Math.floor(Date.now() / 1000)) {
  return JSON.stringify({
    data: {
      event_type: 'message.received',
      payload: {
        id,
        type: 'WHATSAPP',
        direction: 'inbound',
        from: { phone_number: WA_GUEST },
        to: WA_BUSINESS,
        body: {
          type: 'text',
          timestamp: String(tsSec),
          text: { body: text },
        },
      },
    },
  });
}

function createEnv(overrides = {}) {
  const DB = createD1();
  const WHATSAPP_KV = createKvStore();
  DB.raw.exec(`
    INSERT INTO providers (id, status, currency, license_reference, source_reference, verified_by, verified_at)
    VALUES ('prov-bosphorus', 'verified', 'EUR', 'TURSAB-1001', 'contract-2026', 'admin', '2026-01-01');
    INSERT INTO experiences (id, provider_id, title, source_reference)
    VALUES ('bb-sunset', 'prov-bosphorus', 'Boğaz Gün Batımı Turu', 'catalog-2026');
    INSERT INTO approved_prices (id, experience_id, currency, unit_minor, valid_from, valid_until, approved_by, source_reference)
    VALUES ('price-sunset-eur', 'bb-sunset', 'EUR', 6000, '2026-01-01', '2099-12-31', 'admin', 'contract-2026');
    INSERT INTO availability (experience_id, service_date, remaining, verified_until, source_reference)
    VALUES ('bb-sunset', '2027-06-15', 10, '2099-12-31T23:59:59Z', 'contract-2026');
  `);

  return {
    DB,
    WHATSAPP_KV,
    PUBLIC_ORIGIN: ORIGIN,
    RATE_LIMITER: { limit: async () => ({ success: true }) },
    CODE_PEPPER: 'test-pepper-emergency-center',
    EMERGENCY_CODE_SECRET: 'test-hmac-secret-emergency-center',
    EMERGENCY_VERIFY_EMAIL: VERIFY_GMAIL,
    EMERGENCY_NOTIFY_EMAILS: `${EMERGENCY_OWNER_EMAIL},${COLLEAGUE_NOTIFY}`,
    ADMIN_OWNER_EMAIL: EMERGENCY_OWNER_EMAIL,
    OWNER_EMAILS: `${EMERGENCY_OWNER_EMAIL},second-owner@bosphorly.example`,
    DEV_RETURN_CODE: '1',
    RESEND_API_KEY: 're_test_key',
    REQUEST_FROM_EMAIL: 'noreply@bosphorly.com',
    WHATSAPP_PHONE_NUMBER: WA_BUSINESS,
    TELNYX_API_KEY: 'telnyx_test_key',
    TELEGRAM_BOT_TOKEN: 'tg_bot_test_token',
    TELEGRAM_ADMIN_CHAT_ID: '777888999',
    AI: {
      async run() {
        return {
          response: JSON.stringify({
            reply: 'Boğaz turumuz her akşam düzenlenmektedir.',
            handoff: false,
            abuse: false,
            proposal: null,
          }),
        };
      },
    },
    ...overrides,
  };
}

async function callExtranet(env, path, { method = 'GET', body, actor, nowMs = Date.now(), extraHeaders = {} } = {}) {
  const headers = {
    Origin: ORIGIN,
    'CF-Connecting-IP': '203.0.113.42',
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(actor?.cookie ? { Cookie: actor.cookie } : {}),
    ...(method !== 'GET' && actor?.csrf ? { 'X-CSRF-Token': actor.csrf } : {}),
    ...extraHeaders,
  };
  const req = new Request(`https://api.bosphorly.com${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const url = new URL(req.url);
  const res = await handleExtranetRoutes(req, env, url, nowMs);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, body: data, headers: res.headers };
}

function seedExtranetSession(env, email, role, nowMs = Date.now()) {
  const lower = email.trim().toLowerCase();
  const memberId = `mem-${crypto.randomUUID()}`;
  const refCode = `REF-${crypto.randomUUID().slice(0, 8)}`;
  env.DB.raw
    .prepare(`INSERT INTO members (id, email, name, lang, referral_code) VALUES (?, ?, ?, 'tr', ?)`)
    .run(memberId, lower, `Actor ${role}`, refCode);
  env.DB.raw
    .prepare(`INSERT OR REPLACE INTO extranet_users (member_id, role, active) VALUES (?, ?, 1)`)
    .run(memberId, role);
  env.DB.raw
    .prepare(`INSERT INTO passkeys (credential_id, member_id, public_key, counter, created_at) VALUES (?, ?, ?, 0, datetime('now'))`)
    .run(`pk-${memberId}`, memberId, Buffer.from('test-pk').toString('base64'));

  const rawSession = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(rawSession).digest('hex');
  const csrf = crypto.randomBytes(32).toString('base64url');
  env.DB.raw
    .prepare(
      `INSERT INTO extranet_sessions (token_hash, member_id, csrf_token, ip_address, user_agent, created_at, last_active_at, expires_at)
       VALUES (?, ?, ?, '203.0.113.42', 'node-test', ?, ?, ?)`
    )
    .run(tokenHash, memberId, csrf, nowMs, nowMs, nowMs + 12 * 3600 * 1000);

  return {
    memberId,
    email: lower,
    role,
    tokenHash,
    cookie: `${EXTRANET_COOKIE_NAME}=${rawSession}`,
    csrf,
  };
}

function extractSixDigitCodeFromEmails(emails, operationId) {
  const matchEmail = emails.find((e) => e.body.text.includes(operationId));
  assert.ok(matchEmail, `Expected OTP email for operation ${operationId}`);
  const m = /Tek Kullanımlık Doğrulama Kodunuz:\s*(\d{6})/.exec(matchEmail.body.text);
  assert.ok(m, 'Expected 6-digit code in email body');
  return m[1];
}

test('1. Default state: all 4 channels are OPEN, banner is CLOSED, and /v1/public/channels exposes zero PII with <=60s Cache-Control', async () => {
  const env = createEnv();
  const req = new Request('https://api.bosphorly.com/v1/public/channels', {
    method: 'GET',
    headers: { Origin: ORIGIN },
  });
  const res = await worker.fetch(req, env);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  const cc = res.headers.get('Cache-Control') || '';
  assert.match(cc, /max-age=30/);

  const rawText = await res.text();
  assert.ok(!rawText.includes(VERIFY_GMAIL), 'Secondary Gmail must never appear in public endpoint');
  assert.ok(!rawText.includes(COLLEAGUE_NOTIFY), 'Notification recipients must never appear in public endpoint');
  assert.ok(!rawText.includes('audit'), 'Audit info must never appear in public endpoint');

  const parsed = JSON.parse(rawText);
  assert.deepEqual(parsed, {
    channels: {
      whatsapp: true,
      telegram: true,
      instagram: true,
      mimo: true,
    },
    banner: {
      enabled: false,
      text: '',
    },
  });
});

test('2. Exclusive management authority: ONLY info@bosphorly.com owner is permitted; other owners in OWNER_EMAILS, admins, staff, partners, unauthenticated, expired sessions, and spoofed body fields are rejected and audited', async () => {
  const env = createEnv();
  const now = 1_770_000_000_000;

  const ownerInfo = seedExtranetSession(env, 'info@bosphorly.com', 'owner', now);
  const otherOwner = seedExtranetSession(env, 'second-owner@bosphorly.example', 'owner', now);
  const adminActor = seedExtranetSession(env, 'admin@bosphorly.example', 'admin', now);
  const staffActor = seedExtranetSession(env, 'staff@bosphorly.example', 'staff', now);
  const partnerActor = seedExtranetSession(env, 'partner@bosphorly.example', 'partner', now);

  // Unauthenticated
  const unauthRes = await callExtranet(env, '/v1/extranet/emergency/status', { nowMs: now });
  assert.equal(unauthRes.status, 401);

  // Every role other than info@bosphorly.com owner (including second owner in OWNER_EMAILS!) must be 403
  for (const forbiddenActor of [otherOwner, adminActor, staffActor, partnerActor]) {
    const st = await callExtranet(env, '/v1/extranet/emergency/status', { actor: forbiddenActor, nowMs: now });
    assert.equal(st.status, 403, `${forbiddenActor.email} (${forbiddenActor.role}) must be denied`);
    assert.equal(st.body.code, 'EMERGENCY_FORBIDDEN');
    assert.ok(!JSON.stringify(st.body).includes(VERIFY_GMAIL));

    const reqCode = await callExtranet(env, '/v1/extranet/emergency/request-code', {
      method: 'POST',
      actor: forbiddenActor,
      nowMs: now,
      body: { targetChannel: 'whatsapp', actionType: 'close', confirmAction: true },
    });
    assert.equal(reqCode.status, 403);
  }

  // info@bosphorly.com owner succeeds on status
  const okStatus = await callExtranet(env, '/v1/extranet/emergency/status', { actor: ownerInfo, nowMs: now });
  assert.equal(okStatus.status, 200);
  assert.equal(okStatus.body.channels.length, 4);
  assert.ok(!JSON.stringify(okStatus.body).includes(VERIFY_GMAIL), 'Even status masks secondary verification email');

  // Spoofed email/role fields in request body rejected
  const spoofed = await callExtranet(env, '/v1/extranet/emergency/request-code', {
    method: 'POST',
    actor: ownerInfo,
    nowMs: now,
    body: {
      targetChannel: 'whatsapp',
      actionType: 'close',
      confirmAction: true,
      verifyEmail: 'attacker@evil.example',
    },
  });
  assert.equal(spoofed.status, 400);
  assert.equal(spoofed.body.code, 'INVALID_PAYLOAD');

  // Missing CSRF rejected on state-changing POST
  const noCsrf = await callExtranet(env, '/v1/extranet/emergency/request-code', {
    method: 'POST',
    actor: { cookie: ownerInfo.cookie, csrf: '' },
    nowMs: now,
    body: { targetChannel: 'whatsapp', actionType: 'close', confirmAction: true },
  });
  assert.equal(noCsrf.status, 403);

  // Revoked session is denied immediately
  env.DB.raw.prepare(`DELETE FROM extranet_sessions WHERE token_hash = ?`).run(ownerInfo.tokenHash);
  const revokedRes = await callExtranet(env, '/v1/extranet/emergency/status', { actor: ownerInfo, nowMs: now });
  assert.equal(revokedRes.status, 401);
});

test('2b. Exclusive authority continued: expired or deleted session of info@bosphorly.com is rejected immediately', async () => {
  const env = createEnv();
  const now = 1_770_000_000_000;
  const ownerInfo = seedExtranetSession(env, 'info@bosphorly.com', 'owner', now);

  // Idle timeout exceeded (> 30m)
  const expiredRes = await callExtranet(env, '/v1/extranet/emergency/status', {
    actor: ownerInfo,
    nowMs: now + 31 * 60 * 1000,
  });
  assert.equal(expiredRes.status, 401);

  // Audit log captured unauthorized attempts
  const audits = env.DB.raw.prepare(`SELECT * FROM emergency_audit_log WHERE outcome = 'failed'`).all();
  assert.ok(audits.length >= 1);
});

test('3. Dual-account OTP security: HMAC-only storage, 5m TTL, 3-attempt lockout, 60s cooldown, supersede invalidation, cross-channel/action/session binding, atomic concurrent replay protection, and mandatory "AÇ" reopen confirmation', async () => {
  const env = createEnv();
  let now = 1_770_100_000_000;
  const ownerSessionA = seedExtranetSession(env, 'info@bosphorly.com', 'owner', now);

  // Create a second concurrent session for the same info@bosphorly.com member to test session binding
  const rawSessB = crypto.randomBytes(32).toString('base64url');
  const hashSessB = crypto.createHash('sha256').update(rawSessB).digest('hex');
  const csrfB = crypto.randomBytes(32).toString('base64url');
  env.DB.raw
    .prepare(
      `INSERT INTO extranet_sessions (token_hash, member_id, csrf_token, ip_address, user_agent, created_at, last_active_at, expires_at)
       VALUES (?, ?, ?, '203.0.113.42', 'node-test-b', ?, ?, ?)`
    )
    .run(hashSessB, ownerSessionA.memberId, csrfB, now, now, now + 12 * 3600 * 1000);
  const ownerSessionB = {
    ...ownerSessionA,
    tokenHash: hashSessB,
    cookie: `${EXTRANET_COOKIE_NAME}=${rawSessB}`,
    csrf: csrfB,
  };

  const sentEmails = [];
  let failResend = false;
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes('api.resend.com/emails')) {
      if (failResend) return new Response('Provider down', { status: 500 });
      const parsedBody = JSON.parse(opts.body);
      sentEmails.push({ url, body: parsedBody });
      return Response.json({ id: `mail_${sentEmails.length}` });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    // A) If OTP email fails to send, channel state MUST NOT change and cooldown is not burned
    failResend = true;
    const failedMailReq = await callExtranet(env, '/v1/extranet/emergency/request-code', {
      method: 'POST',
      actor: ownerSessionA,
      nowMs: now,
      body: { targetChannel: 'whatsapp', actionType: 'close', confirmAction: true },
    });
    assert.equal(failedMailReq.status, 502);
    assert.equal(await isChannelEnabled(env, 'whatsapp'), true);
    failResend = false;

    // B) Request OTP #1, then wait 61s and request OTP #2 -> OTP #1 must be invalidated!
    const r1 = await callExtranet(env, '/v1/extranet/emergency/request-code', {
      method: 'POST',
      actor: ownerSessionA,
      nowMs: now,
      body: { targetChannel: 'whatsapp', actionType: 'close', confirmAction: true },
    });
    assert.equal(r1.status, 200);
    const code1 = extractSixDigitCodeFromEmails(sentEmails, r1.body.operationId);

    // Verify plaintext OTP is NOT in DB, response, or audit log
    assert.ok(!JSON.stringify(r1.body).includes(code1));
    const dbVerifRow = env.DB.raw
      .prepare(`SELECT * FROM emergency_verifications WHERE operation_id = ?`)
      .get(r1.body.operationId);
    assert.ok(!JSON.stringify(dbVerifRow).includes(code1), 'OTP must never be stored in plaintext in D1');
    assert.match(dbVerifRow.code_hmac, /^[0-9a-f]{64}$/);

    // Cooldown enforced within 60 seconds
    const tooSoon = await callExtranet(env, '/v1/extranet/emergency/request-code', {
      method: 'POST',
      actor: ownerSessionA,
      nowMs: now + 25_000,
      body: { targetChannel: 'whatsapp', actionType: 'close', confirmAction: true },
    });
    assert.equal(tooSoon.status, 429);
    assert.equal(tooSoon.body.code, 'OTP_COOLDOWN');

    // Advance past 60s cooldown and request OTP #2 -> supersedes OTP #1
    now += OTP_COOLDOWN_MS + 1000;
    const r2 = await callExtranet(env, '/v1/extranet/emergency/request-code', {
      method: 'POST',
      actor: ownerSessionA,
      nowMs: now,
      body: { targetChannel: 'whatsapp', actionType: 'close', confirmAction: true },
    });
    assert.equal(r2.status, 200);
    const code2 = extractSixDigitCodeFromEmails(sentEmails, r2.body.operationId);

    const trySuperseded = await callExtranet(env, '/v1/extranet/emergency/verify', {
      method: 'POST',
      actor: ownerSessionA,
      nowMs: now + 1000,
      body: { operationId: r1.body.operationId, code: code1, targetChannel: 'whatsapp', actionType: 'close' },
    });
    assert.equal(trySuperseded.status, 409);
    assert.equal(trySuperseded.body.code, 'CODE_INVALIDATED');

    // C) Cross-session, cross-channel, and cross-action binding checks on OTP #2
    const wrongSession = await callExtranet(env, '/v1/extranet/emergency/verify', {
      method: 'POST',
      actor: ownerSessionB,
      nowMs: now + 2000,
      body: { operationId: r2.body.operationId, code: code2, targetChannel: 'whatsapp', actionType: 'close' },
    });
    assert.equal(wrongSession.status, 403);
    assert.equal(wrongSession.body.code, 'SESSION_MISMATCH');

    const wrongChannel = await callExtranet(env, '/v1/extranet/emergency/verify', {
      method: 'POST',
      actor: ownerSessionA,
      nowMs: now + 2000,
      body: { operationId: r2.body.operationId, code: code2, targetChannel: 'telegram', actionType: 'close' },
    });
    assert.equal(wrongChannel.status, 400);
    assert.equal(wrongChannel.body.code, 'BINDING_MISMATCH');

    const wrongAction = await callExtranet(env, '/v1/extranet/emergency/verify', {
      method: 'POST',
      actor: ownerSessionA,
      nowMs: now + 2000,
      body: {
        operationId: r2.body.operationId,
        code: code2,
        targetChannel: 'whatsapp',
        actionType: 'reopen',
        confirmReopenText: 'AÇ',
      },
    });
    assert.equal(wrongAction.status, 400);
    assert.equal(wrongAction.body.code, 'BINDING_MISMATCH');

    // D) 3 wrong attempts lock out OTP #2 permanently
    const badCode = code2 === '123456' ? '654321' : '123456';
    for (let i = 1; i <= 3; i++) {
      const badRes = await callExtranet(env, '/v1/extranet/emergency/verify', {
        method: 'POST',
        actor: ownerSessionA,
        nowMs: now + 3000 + i * 100,
        body: { operationId: r2.body.operationId, code: badCode, targetChannel: 'whatsapp', actionType: 'close' },
      });
      assert.equal(badRes.status, 400);
      assert.equal(badRes.body.code, 'INVALID_CODE');
    }
    // Even submitting the real code2 on attempt #4 is rejected!
    const afterLockout = await callExtranet(env, '/v1/extranet/emergency/verify', {
      method: 'POST',
      actor: ownerSessionA,
      nowMs: now + 4000,
      body: { operationId: r2.body.operationId, code: code2, targetChannel: 'whatsapp', actionType: 'close' },
    });
    assert.equal(afterLockout.status, 429);
    assert.equal(afterLockout.body.code, 'MAX_ATTEMPTS_EXCEEDED');
    assert.equal(await isChannelEnabled(env, 'whatsapp'), true);

    // Cooldown STILL applies immediately after 3-attempt lockout!
    const cooldownAfterLockout = await callExtranet(env, '/v1/extranet/emergency/request-code', {
      method: 'POST',
      actor: ownerSessionA,
      nowMs: now + 5000,
      body: { targetChannel: 'whatsapp', actionType: 'close', confirmAction: true },
    });
    assert.equal(cooldownAfterLockout.status, 429);

    // E) 5-minute TTL expiration check
    now += OTP_COOLDOWN_MS + 2000;
    const r3 = await callExtranet(env, '/v1/extranet/emergency/request-code', {
      method: 'POST',
      actor: ownerSessionA,
      nowMs: now,
      body: { targetChannel: 'whatsapp', actionType: 'close', confirmAction: true },
    });
    assert.equal(r3.status, 200);
    const code3 = extractSixDigitCodeFromEmails(sentEmails, r3.body.operationId);

    const expiredVerify = await callExtranet(env, '/v1/extranet/emergency/verify', {
      method: 'POST',
      actor: ownerSessionA,
      nowMs: now + OTP_TTL_MS + 1,
      body: { operationId: r3.body.operationId, code: code3, targetChannel: 'whatsapp', actionType: 'close' },
    });
    assert.equal(expiredVerify.status, 410);
    assert.equal(expiredVerify.body.code, 'CODE_EXPIRED');
    assert.equal(await isChannelEnabled(env, 'whatsapp'), true);

    // F) Valid close + Atomic concurrent replay check + Post-operation notifications
    now += OTP_TTL_MS + OTP_COOLDOWN_MS;
    const r4 = await callExtranet(env, '/v1/extranet/emergency/request-code', {
      method: 'POST',
      actor: ownerSessionA,
      nowMs: now,
      body: { targetChannel: 'whatsapp', actionType: 'close', confirmAction: true },
    });
    assert.equal(r4.status, 200);
    const code4 = extractSixDigitCodeFromEmails(sentEmails, r4.body.operationId);

    const [cA, cB] = await Promise.all([
      callExtranet(env, '/v1/extranet/emergency/verify', {
        method: 'POST',
        actor: ownerSessionA,
        nowMs: now + 1000,
        body: { operationId: r4.body.operationId, code: code4, targetChannel: 'whatsapp', actionType: 'close' },
      }),
      callExtranet(env, '/v1/extranet/emergency/verify', {
        method: 'POST',
        actor: ownerSessionA,
        nowMs: now + 1000,
        body: { operationId: r4.body.operationId, code: code4, targetChannel: 'whatsapp', actionType: 'close' },
      }),
    ]);
    const statuses = [cA.status, cB.status].sort();
    assert.deepEqual(statuses, [200, 409], 'Exactly one concurrent verify succeeds and the replay fails with 409');
    assert.equal(await isChannelEnabled(env, 'whatsapp'), false);
    assert.equal(await isChannelEnabled(env, 'telegram'), true);
    assert.equal(await isChannelEnabled(env, 'instagram'), true);
    assert.equal(await isChannelEnabled(env, 'mimo'), true);

    // Single-use replay after consumption also fails with 409
    const replay = await callExtranet(env, '/v1/extranet/emergency/verify', {
      method: 'POST',
      actor: ownerSessionA,
      nowMs: now + 2000,
      body: { operationId: r4.body.operationId, code: code4, targetChannel: 'whatsapp', actionType: 'close' },
    });
    assert.equal(replay.status, 409);

    // Check notification emails went to info@bosphorly.com, secondary Gmail, and colleague address
    const notifEmails = sentEmails.filter((e) => e.body.subject.includes('Güvenlik Bildirimi'));
    const rcptSet = new Set(notifEmails.flatMap((e) => e.body.to));
    assert.ok(rcptSet.has(EMERGENCY_OWNER_EMAIL));
    assert.ok(rcptSet.has(VERIFY_GMAIL));
    assert.ok(rcptSet.has(COLLEAGUE_NOTIFY));

    // G) Reopen requires exact "AÇ" confirmation + fresh OTP (close code4 cannot reopen!)
    now += OTP_COOLDOWN_MS + 5000;
    for (const badConfirm of ['', 'ac', 'AC', 'aç', 'EVET']) {
      const badReopen = await callExtranet(env, '/v1/extranet/emergency/request-code', {
        method: 'POST',
        actor: ownerSessionA,
        nowMs: now,
        body: { targetChannel: 'whatsapp', actionType: 'reopen', confirmReopenText: badConfirm },
      });
      assert.equal(badReopen.status, 400);
      assert.equal(badReopen.body.code, 'REOPEN_CONFIRM_REQUIRED');
    }

    const r5 = await callExtranet(env, '/v1/extranet/emergency/request-code', {
      method: 'POST',
      actor: ownerSessionA,
      nowMs: now,
      body: { targetChannel: 'whatsapp', actionType: 'reopen', confirmReopenText: 'AÇ' },
    });
    assert.equal(r5.status, 200);
    const code5 = extractSixDigitCodeFromEmails(sentEmails, r5.body.operationId);

    // Missing "AÇ" on /verify step also rejected
    const reopenMissingAcOnVerify = await callExtranet(env, '/v1/extranet/emergency/verify', {
      method: 'POST',
      actor: ownerSessionA,
      nowMs: now + 1000,
      body: { operationId: r5.body.operationId, code: code5, targetChannel: 'whatsapp', actionType: 'reopen' },
    });
    assert.equal(reopenMissingAcOnVerify.status, 400);
    assert.equal(await isChannelEnabled(env, 'whatsapp'), false);

    // Valid reopen with "AÇ" + code5 succeeds!
    const reopenOk = await callExtranet(env, '/v1/extranet/emergency/verify', {
      method: 'POST',
      actor: ownerSessionA,
      nowMs: now + 2000,
      body: {
        operationId: r5.body.operationId,
        code: code5,
        targetChannel: 'whatsapp',
        actionType: 'reopen',
        confirmReopenText: 'AÇ',
      },
    });
    assert.equal(reopenOk.status, 200);
    assert.equal(await isChannelEnabled(env, 'whatsapp'), true);

    // H) Verify no OTP code ever leaked into emergency_audit_log
    const allAuditJson = JSON.stringify(env.DB.raw.prepare(`SELECT * FROM emergency_audit_log`).all());
    for (const c of [code1, code2, code3, code4, code5]) {
      assert.ok(!allAuditJson.includes(c), 'Audit log must never contain OTP codes');
    }
  } finally {
    globalThis.fetch = origFetch;
  }
});

async function setChannelDirectlyViaDualAuth(env, owner, targetChannel, actionType, nowMs, extra = {}) {
  const sent = [];
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes('api.resend.com/emails')) {
      sent.push({ url, body: JSON.parse(opts.body) });
      return Response.json({ id: 'ok' });
    }
    return origFetch(url, opts);
  };
  try {
    const reqRes = await callExtranet(env, '/v1/extranet/emergency/request-code', {
      method: 'POST',
      actor: owner,
      nowMs,
      body: {
        targetChannel,
        actionType,
        confirmAction: true,
        ...(actionType === 'reopen' || actionType === 'reopen_all' ? { confirmReopenText: 'AÇ' } : {}),
        ...extra,
      },
    });
    assert.equal(reqRes.status, 200);
    const code = extractSixDigitCodeFromEmails(sent, reqRes.body.operationId);
    const verRes = await callExtranet(env, '/v1/extranet/emergency/verify', {
      method: 'POST',
      actor: owner,
      nowMs: nowMs + 1000,
      body: {
        operationId: reqRes.body.operationId,
        code,
        targetChannel,
        actionType,
        ...(actionType === 'reopen' || actionType === 'reopen_all' ? { confirmReopenText: 'AÇ' } : {}),
      },
    });
    assert.equal(verRes.status, 200);
    return verRes;
  } finally {
    globalThis.fetch = origFetch;
  }
}

test('4. WhatsApp emergency close, mid-AI-generation closure blocking outbound send, closed-window message suppression after reopen, and intact Telnyx payload after reopen', async () => {
  const { privateKey, publicKeyB64 } = await createTelnyxKeyPair();
  const env = createEnv({ TELNYX_PUBLIC_KEY: publicKeyB64 });
  let now = 1_770_200_000_000;
  const owner = seedExtranetSession(env, 'info@bosphorly.com', 'owner', now);

  // 1) Mid-AI-generation close: message arrives while WhatsApp is OPEN, AI runs for 120ms, owner closes WhatsApp at 30ms -> 0 Telnyx sends!
  let telnyxCalls = [];
  const origFetch = globalThis.fetch;
  let resolveAi;
  env.AI.run = () =>
    new Promise((resolve) => {
      resolveAi = resolve;
    });

  try {
    globalThis.fetch = async (url, opts) => {
      if (String(url).includes('api.telnyx.com')) {
        telnyxCalls.push({ url, body: JSON.parse(opts.body) });
        return Response.json({ data: { id: 'out-1' } });
      }
      if (String(url).includes('api.resend.com/emails')) {
        return Response.json({ id: 'mail-1' });
      }
      if (String(url).includes('api.telegram.org')) {
        return Response.json({ ok: true });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    };

    const inFlightMsg = parseWhatsApp(JSON.parse(buildWaInboundPayload('Merhaba fiyat nedir?', 'wa-inflight-1')), WA_BUSINESS);
    const processingPromise = processWhatsApp(env, inFlightMsg);

    // Wait a tick so processWhatsApp reaches env.AI.run while WhatsApp is still open
    await new Promise((r) => setTimeout(r, 20));

    // Close WhatsApp via dual-account OTP while AI generation is in progress!
    globalThis.fetch = origFetch;
    await setChannelDirectlyViaDualAuth(env, owner, 'whatsapp', 'close', now);

    // Restore mock fetch and resolve the AI model reply
    globalThis.fetch = async (url, opts) => {
      if (String(url).includes('api.telnyx.com')) {
        telnyxCalls.push({ url, body: JSON.parse(opts.body) });
        return Response.json({ data: { id: 'out-1' } });
      }
      return Response.json({ ok: true });
    };
    resolveAi({
      response: JSON.stringify({
        reply: 'Bu yanıt kanal kapandığı için gönderilmemelidir!',
        handoff: false,
        abuse: false,
        proposal: null,
      }),
    });

    const sentInFlight = await processingPromise;
    assert.equal(sentInFlight, false, 'Pre-send guard must abort sending reply generated while channel closed');
    assert.equal(telnyxCalls.length, 0, 'Zero Telnyx API calls allowed once WhatsApp is closed');

    // 2) While WhatsApp is CLOSED:
    // - Invalid signature STILL returns 401!
    const badSigReq = new Request('https://api.bosphorly.com/webhooks/whatsapp/telnyx', {
      method: 'POST',
      headers: { 'telnyx-timestamp': String(Math.floor(Date.now() / 1000)), 'telnyx-signature-ed25519': 'aW52YWxpZA==' },
      body: buildWaInboundPayload('Bad sig', 'wa-bad-sig'),
    });
    assert.equal((await handleWhatsApp(badSigReq, env, { waitUntil() {} })).status, 401);

    // - Valid signed Telnyx webhook returns HTTP 200 OK without calling AI or Telnyx!
    let aiCallsWhileClosed = 0;
    env.AI.run = async () => {
      aiCallsWhileClosed++;
      return { response: JSON.stringify({ reply: 'Should not run', handoff: false, abuse: false, proposal: null }) };
    };
    const closedMsgTsSec = Math.floor(now / 1000) + 2;
    const closedRaw = buildWaInboundPayload('Kapalı dönemde gelen mesaj', 'wa-closed-msg-99', closedMsgTsSec);
    const validSignedClosedReq = await signTelnyxRequest(closedRaw, privateKey);
    const bgJobs = [];
    const closedHookRes = await handleWhatsApp(validSignedClosedReq, env, { waitUntil: (p) => bgJobs.push(p) });
    assert.equal(closedHookRes.status, 200);
    assert.equal(await closedHookRes.text(), 'OK');
    assert.equal(bgJobs.length, 0);
    assert.equal(aiCallsWhileClosed, 0);
    assert.equal(telnyxCalls.length, 0);

    // - Meanwhile booking quote endpoint (/v1/quotes) and catalog (/v1/catalog) still work normally!
    const quoteRes = await worker.fetch(
      new Request('https://api.bosphorly.com/v1/quotes', {
        method: 'POST',
        headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.10' },
        body: JSON.stringify({ experienceId: 'bb-sunset', date: '2027-06-15', guests: 2 }),
      }),
      env
    );
    assert.equal(quoteRes.status, 200);

    // 3) Reopen WhatsApp after cooldown:
    globalThis.fetch = origFetch;
    now += OTP_COOLDOWN_MS + 10_000;
    await setChannelDirectlyViaDualAuth(env, owner, 'whatsapp', 'reopen', now);
    assert.equal(await isChannelEnabled(env, 'whatsapp'), true);

    // - Closed-period message (re-delivered by webhook or timestamped inside closed window) MUST NOT be processed!
    globalThis.fetch = async (url, opts) => {
      if (String(url).includes('api.telnyx.com')) {
        telnyxCalls.push({ url, body: JSON.parse(opts.body) });
        return Response.json({ data: { id: 'out-ok' } });
      }
      return Response.json({ ok: true });
    };
    const replayClosedReq = await signTelnyxRequest(closedRaw, privateKey);
    const replayJobs = [];
    const replayClosedRes = await handleWhatsApp(replayClosedReq, env, { waitUntil: (p) => replayJobs.push(p) });
    assert.equal(replayClosedRes.status, 200);
    assert.equal(replayJobs.length, 0, 'Messages from closed window must not be auto-processed upon reopen');
    assert.equal(telnyxCalls.length, 0);

    // - Fresh post-reopen message processes and preserves exact Telnyx WhatsApp payload!
    env.AI.run = async () => ({
      response: JSON.stringify({
        reply: 'Merhaba! Boğaz turu için hangi tarihi düşünüyorsunuz?',
        handoff: false,
        abuse: false,
        proposal: null,
      }),
    });
    const freshTsSec = Math.floor(Date.now() / 1000);
    const freshRaw = buildWaInboundPayload('Boğaz turu istiyorum', 'wa-fresh-after-reopen', freshTsSec);
    const freshSignedReq = await signTelnyxRequest(freshRaw, privateKey);
    const freshJobs = [];
    const freshRes = await handleWhatsApp(freshSignedReq, env, { waitUntil: (p) => freshJobs.push(p) });
    assert.equal(freshRes.status, 200);
    await Promise.all(freshJobs);
    assert.equal(telnyxCalls.length, 1);
    assert.equal(telnyxCalls[0].url, 'https://api.telnyx.com/v2/messages/whatsapp');
    assert.deepEqual(telnyxCalls[0].body, {
      type: 'WHATSAPP',
      from: WA_BUSINESS,
      to: WA_GUEST,
      messaging_profile_id: DEFAULT_TELNYX_MESSAGING_PROFILE_ID,
      whatsapp_message: {
        type: 'text',
        text: {
          body: 'Merhaba! Boğaz turu için hangi tarihi düşünüyorsunuz?',
          preview_url: false,
        },
      },
    });
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('5. Telegram emergency close, mid-AI-generation closure blocking bot reply, /acil_kapat backup command isolation, and forbidden /acil_ac', async () => {
  const env = createEnv();
  let now = 1_770_300_000_000;
  const owner = seedExtranetSession(env, 'info@bosphorly.com', 'owner', now);
  const tgSecret = await computeTelegramWebhookSecret(env.CODE_PEPPER);

  const sendTgWebhook = (message, secretHeader = tgSecret, tsMs = now) =>
    handleTelegramWebhook(
      new Request('https://api.bosphorly.com/v1/telegram/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Bot-Api-Secret-Token': secretHeader,
        },
        body: JSON.stringify({ update_id: 1, message }),
      }),
      env,
      tsMs,
      { waitUntil() {} }
    );

  const origFetch = globalThis.fetch;
  const tgOutbox = [];

  try {
    // 1) Mid-AI-generation close on Telegram: AI takes time while owner closes Telegram -> bot reply suppressed!
    let resolveTgAi;
    env.AI.run = () =>
      new Promise((resolve) => {
        resolveTgAi = resolve;
      });
    globalThis.fetch = async (url, opts) => {
      if (String(url).includes('api.telegram.org')) {
        tgOutbox.push(JSON.parse(opts.body));
        return Response.json({ ok: true });
      }
      return Response.json({ id: 'mail-tg' });
    };

    const guestHookPromise = sendTgWebhook(
      {
        message_id: 101,
        date: Math.floor(now / 1000),
        chat: { id: 555001, type: 'private' },
        from: { id: 555001, language_code: 'tr' },
        text: 'Boğaz turu saat kaçta?',
      },
      tgSecret,
      now
    );

    await new Promise((r) => setTimeout(r, 20));
    globalThis.fetch = origFetch;
    await setChannelDirectlyViaDualAuth(env, owner, 'telegram', 'close', now);

    globalThis.fetch = async (url, opts) => {
      if (String(url).includes('api.telegram.org')) {
        tgOutbox.push(JSON.parse(opts.body));
        return Response.json({ ok: true });
      }
      return Response.json({ ok: true });
    };
    resolveTgAi({ response: 'Turumuz 18:30’da kalkıyor [[flags:abuse=0;handoff=0]]' });

    const inFlightRes = await guestHookPromise;
    assert.equal(inFlightRes.status, 200);
    assert.equal(tgOutbox.length, 0, 'Pre-send Telegram guard must block bot reply when Telegram closed mid-generation');

    // 2) While Telegram is CLOSED:
    // - Invalid webhook secret STILL returns 401
    const unauthTg = await sendTgWebhook(
      { message_id: 102, date: Math.floor(now / 1000), chat: { id: 555001, type: 'private' }, text: 'Hi' },
      'wrong-secret',
      now + 2000
    );
    assert.equal(unauthTg.status, 401);

    // - Normal guest message returns 200 OK without running AI or sending bot message
    let tgAiCalled = 0;
    env.AI.run = async () => {
      tgAiCalled++;
      return { response: 'Should not run' };
    };
    const closedGuestRes = await sendTgWebhook(
      {
        message_id: 103,
        date: Math.floor((now + 3000) / 1000),
        chat: { id: 555001, type: 'private' },
        from: { id: 555001, language_code: 'tr' },
        text: 'Kapalı dönemde yazıyorum',
      },
      tgSecret,
      now + 3000
    );
    assert.equal(closedGuestRes.status, 200);
    assert.equal(tgAiCalled, 0);
    assert.equal(tgOutbox.length, 0);

    // 3) Backup command /acil_kapat works even while Telegram is CLOSED, ONLY for authorized admin chat + owner!
    // - Unauthorized chat/user cannot create a pending request
    await sendTgWebhook(
      {
        message_id: 201,
        date: Math.floor((now + 4000) / 1000),
        chat: { id: 999999, type: 'private' },
        from: { id: 999999 },
        text: '/acil_kapat instagram',
      },
      tgSecret,
      now + 4000
    );
    assert.equal(env.DB.raw.prepare(`SELECT COUNT(*) AS n FROM emergency_telegram_requests`).get().n, 0);

    // - Authorized admin chat sends /acil_kapat instagram -> creates pending request WITHOUT closing instagram directly!
    const acilRes = await sendTgWebhook(
      {
        message_id: 202,
        date: Math.floor((now + 5000) / 1000),
        chat: { id: Number(env.TELEGRAM_ADMIN_CHAT_ID), type: 'private' },
        from: { id: Number(env.TELEGRAM_ADMIN_CHAT_ID) },
        text: '/acil_kapat instagram',
      },
      tgSecret,
      now + 5000
    );
    assert.equal(acilRes.status, 200);
    const acilJson = await acilRes.json();
    assert.equal(acilJson.emergencyRequestCreated, true);
    assert.equal(await isChannelEnabled(env, 'instagram'), true, '/acil_kapat must NOT close channel without Extranet + Gmail OTP');

    // - /acil_ac or /acil_aç via Telegram is strictly forbidden!
    const acilOpenRes = await sendTgWebhook(
      {
        message_id: 203,
        date: Math.floor((now + 6000) / 1000),
        chat: { id: Number(env.TELEGRAM_ADMIN_CHAT_ID), type: 'private' },
        from: { id: Number(env.TELEGRAM_ADMIN_CHAT_ID) },
        text: '/acil_ac telegram',
      },
      tgSecret,
      now + 6000
    );
    assert.equal(acilOpenRes.status, 200);
    assert.equal((await acilOpenRes.json()).denied, 'reopen_forbidden');
    assert.equal(await isChannelEnabled(env, 'telegram'), false);

    // - Completing the pending Telegram request in Extranet via Gmail OTP closes Instagram and marks request 'completed'
    globalThis.fetch = origFetch;
    now += OTP_COOLDOWN_MS + 10_000;
    await setChannelDirectlyViaDualAuth(env, owner, 'instagram', 'close', now, {
      telegramRequestId: acilJson.requestId,
    });
    assert.equal(await isChannelEnabled(env, 'instagram'), false);
    const tgReqRow = env.DB.raw
      .prepare(`SELECT status FROM emergency_telegram_requests WHERE id = ?`)
      .get(acilJson.requestId);
    assert.equal(tgReqRow.status, 'completed');
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('6. Mimo Web AI closure returns localized maintenance messages across all 23 languages on /v1/assistant* without closing WhatsApp or Telegram Mimo', async () => {
  const { privateKey, publicKeyB64 } = await createTelnyxKeyPair();
  const env = createEnv({ TELNYX_PUBLIC_KEY: publicKeyB64 });
  const now = 1_770_400_000_000;
  const owner = seedExtranetSession(env, 'info@bosphorly.com', 'owner', now);

  await setChannelDirectlyViaDualAuth(env, owner, 'mimo', 'close', now);
  assert.equal(await isChannelEnabled(env, 'mimo'), false);
  assert.equal(await isChannelEnabled(env, 'whatsapp'), true);
  assert.equal(await isChannelEnabled(env, 'telegram'), true);

  // Check all 23 languages on POST /v1/assistant
  for (const lang of SUPPORTED_LANGS) {
    const res = await worker.fetch(
      new Request('https://api.bosphorly.com/v1/assistant', {
        method: 'POST',
        headers: {
          Origin: ORIGIN,
          'Content-Type': 'application/json',
          'CF-Connecting-IP': '203.0.113.55',
        },
        body: JSON.stringify({ message: 'Hello', lang }),
      }),
      env
    );
    assert.equal(res.status, 503, `Expected 503 for Mimo Web AI when closed (${lang})`);
    const body = await res.json();
    assert.equal(body.maintenance, true);
    assert.equal(body.reply, MIMO_MAINTENANCE_MESSAGES[lang]);
  }
  assert.equal(
    MIMO_MAINTENANCE_MESSAGES.tr,
    'Şu anda bakımdayız. Bize info@bosphorly.com adresinden ulaşabilirsiniz.'
  );

  // Meanwhile WhatsApp Mimo AND Telegram Mimo still respond normally!
  const origFetch = globalThis.fetch;
  let waSent = 0;
  let tgSent = 0;
  globalThis.fetch = async (url) => {
    if (String(url).includes('api.telnyx.com')) waSent++;
    if (String(url).includes('api.telegram.org')) tgSent++;
    return Response.json({ ok: true, data: { id: '1' } });
  };
  try {
    const waRaw = buildWaInboundPayload('Merhaba', 'wa-while-mimo-web-closed');
    const waReq = await signTelnyxRequest(waRaw, privateKey);
    const jobs = [];
    await handleWhatsApp(waReq, env, { waitUntil: (p) => jobs.push(p) });
    await Promise.all(jobs);
    assert.equal(waSent, 1, 'WhatsApp Mimo must stay active when Mimo Web AI is closed');

    const tgSecret = await computeTelegramWebhookSecret(env.CODE_PEPPER);
    await handleTelegramWebhook(
      new Request('https://api.bosphorly.com/v1/telegram/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': tgSecret },
        body: JSON.stringify({
          update_id: 99,
          message: {
            message_id: 500,
            date: Math.floor(Date.now() / 1000),
            chat: { id: 888111, type: 'private' },
            from: { id: 888111, language_code: 'tr' },
            text: 'Merhaba',
          },
        }),
      }),
      env,
      Date.now(),
      { waitUntil() {} }
    );
    assert.equal(tgSent, 1, 'Telegram Mimo must stay active when Mimo Web AI is closed');
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('7. Cloudflare environment locks (*_DISABLED=1), D1 transient failure continuity via WHATSAPP_KV,XSS-safe banner, immutable audit triggers, and notification retry queue', async () => {
  const sharedKvMap = new Map();
  const env = createEnv({ WHATSAPP_KV: createKvStore(sharedKvMap) });
  let now = 1_770_500_000_000;
  const owner = seedExtranetSession(env, 'info@bosphorly.com', 'owner', now);

  // A) XSS-safe banner enable via dual-account OTP
  await setChannelDirectlyViaDualAuth(env, owner, 'banner', 'banner_enable', now, {
    bannerPreset: 'whatsapp_closed',
    bannerText: '<script>alert(1)</script><img src=x onerror=alert(2)>WhatsApp geçici olarak kapalıdır. javascript:evil()',
  });
  const pubRes = await worker.fetch(
    new Request('https://api.bosphorly.com/v1/public/channels', { headers: { Origin: ORIGIN } }),
    env
  );
  const pubJson = await pubRes.json();
  assert.equal(pubJson.banner.enabled, true);
  assert.ok(!pubJson.banner.text.includes('<script>'));
  assert.ok(!pubJson.banner.text.includes('<img'));
  assert.ok(!pubJson.banner.text.includes('javascript:'));
  assert.ok(pubJson.banner.translations && pubJson.banner.translations.tr);

  // B) Close WhatsApp via dual-account OTP, then simulate D1 outage on a brand-new Worker isolate!
  now += OTP_COOLDOWN_MS + 5000;
  await setChannelDirectlyViaDualAuth(env, owner, 'whatsapp', 'close', now);

  const brokenDbEnv = {
    ...env,
    WHATSAPP_KV: createKvStore(sharedKvMap), // Same persistent KV namespace, brand-new broken DB object (no isolate cache!)
    DB: {
      prepare() {
        return {
          bind() {
            return this;
          },
          async first() {
            throw new Error('D1_TRANSIENT_READ_FAILURE');
          },
        };
      },
    },
  };
  assert.equal(
    await isChannelEnabled(brokenDbEnv, 'whatsapp'),
    false,
    'Previously closed channel MUST remain closed during D1 transient error across isolates via KV mirror'
  );
  assert.equal(
    await isChannelEnabled(brokenDbEnv, 'telegram'),
    true,
    'Previously open channel MUST keep running during transient D1 read error'
  );

  // Cold D1 outage (empty KV + broken D1) -> /v1/public/channels returns 503 with no-store so frontend hides buttons safely
  const coldBrokenEnv = {
    ...brokenDbEnv,
    WHATSAPP_KV: createKvStore(new Map()),
  };
  const coldPubRes = await worker.fetch(
    new Request('https://api.bosphorly.com/v1/public/channels', { headers: { Origin: ORIGIN } }),
    coldBrokenEnv
  );
  assert.equal(coldPubRes.status, 503);
  assert.equal(coldPubRes.headers.get('Cache-Control'), 'no-store');

  // C) Cloudflare environment lock (TELEGRAM_DISABLED=1) overrides D1 OPEN state and blocks panel reopen
  const lockedEnv = { ...env, TELEGRAM_DISABLED: '1' };
  assert.equal(await isChannelEnabled(lockedEnv, 'telegram'), false);
  const stLocked = await callExtranet(lockedEnv, '/v1/extranet/emergency/status', { actor: owner, nowMs: now + 10_000 });
  const tgCard = stLocked.body.channels.find((c) => c.id === 'telegram');
  assert.equal(tgCard.enabled, false);
  assert.equal(tgCard.envLocked, true);
  assert.equal(tgCard.lockWarning, ENV_LOCK_WARNING);

  const unlockAttempt = await callExtranet(lockedEnv, '/v1/extranet/emergency/request-code', {
    method: 'POST',
    actor: owner,
    nowMs: now + OTP_COOLDOWN_MS + 10_000,
    body: { targetChannel: 'telegram', actionType: 'reopen', confirmReopenText: 'AÇ' },
  });
  assert.equal(unlockAttempt.status, 409);
  assert.equal(unlockAttempt.body.code, 'ENV_LOCKED');

  // D) Notification failure NEVER rolls back channel closure, and retry queue delivers when Resend recovers!
  now += 2 * OTP_COOLDOWN_MS + 20_000;
  const origFetch = globalThis.fetch;
  let resendCallIndex = 0;
  let deliveredAfterRecovery = [];
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes('api.resend.com/emails')) {
      resendCallIndex++;
      const parsed = JSON.parse(opts.body);
      // Allow OTP email (#1), fail notification emails (#2..#4)!
      if (parsed.subject.includes('Güvenlik Bildirimi')) {
        return new Response('Resend temporary outage', { status: 503 });
      }
      return Response.json({ id: `otp_${resendCallIndex}` });
    }
    return origFetch(url, opts);
  };
  try {
    const rCloseIg = await callExtranet(env, '/v1/extranet/emergency/request-code', {
      method: 'POST',
      actor: owner,
      nowMs: now,
      body: { targetChannel: 'instagram', actionType: 'close', confirmAction: true },
    });
    assert.equal(rCloseIg.status, 200);
    // Grab OTP by intercepting or reading? Let's re-run with captured OTP!
  } finally {
    globalThis.fetch = origFetch;
  }

  // Capture OTP and fail only post-verify notifications:
  now += OTP_COOLDOWN_MS + 5000;
  const otpCaptured = [];
  globalThis.fetch = async (url, opts) => {
    const parsed = JSON.parse(opts.body);
    if (parsed.subject.includes('Doğrulama Kodu')) {
      otpCaptured.push({ url, body: parsed });
      return Response.json({ id: 'otp_ok' });
    }
    return new Response('Notification outage', { status: 503 });
  };
  try {
    const reqIg = await callExtranet(env, '/v1/extranet/emergency/request-code', {
      method: 'POST',
      actor: owner,
      nowMs: now,
      body: { targetChannel: 'instagram', actionType: 'close', confirmAction: true },
    });
    const codeIg = extractSixDigitCodeFromEmails(otpCaptured, reqIg.body.operationId);
    const verIg = await callExtranet(env, '/v1/extranet/emergency/verify', {
      method: 'POST',
      actor: owner,
      nowMs: now + 1000,
      body: { operationId: reqIg.body.operationId, code: codeIg, targetChannel: 'instagram', actionType: 'close' },
    });
    assert.equal(verIg.status, 200, 'Notification failure must NEVER roll back channel closure');
    assert.equal(await isChannelEnabled(env, 'instagram'), false);
    assert.equal(verIg.body.notificationDeliveredImmediately, false);

    const queued = env.DB.raw
      .prepare(`SELECT status, attempts FROM emergency_notification_queue WHERE operation_id = ?`)
      .get(reqIg.body.operationId);
    assert.equal(queued.status, 'pending');
    assert.equal(queued.attempts, 1);

    // Resend recovers -> flushEmergencyNotifications delivers all 3 recipients!
    globalThis.fetch = async (_url, opts) => {
      deliveredAfterRecovery.push(JSON.parse(opts.body));
      return Response.json({ id: 'recovered_ok' });
    };
    const flushed = await flushEmergencyNotifications(env, now + 120_000);
    assert.equal(flushed.sent, 1);
    assert.equal(deliveredAfterRecovery.length, 3);
  } finally {
    globalThis.fetch = origFetch;
  }

  // E) Immutable emergency_audit_log triggers block UPDATE and DELETE
  assert.throws(() => {
    env.DB.raw.exec(`UPDATE emergency_audit_log SET outcome = 'success'`);
  }, /emergency audit log is immutable/);
  assert.throws(() => {
    env.DB.raw.exec(`DELETE FROM emergency_audit_log`);
  }, /emergency audit log is immutable/);
});

test('8. Bulk reactivation (reopen_all): "AÇ" + fresh Gmail OTP, no OTP reuse from close_all/reopen, env-locked channels stay locked, atomic audit + notification, Telegram /acil_ac hepsi forbidden', async () => {
  const env = createEnv({ INSTAGRAM_DISABLED: '1' });
  let now = 1_770_500_000_000;
  const owner = seedExtranetSession(env, 'info@bosphorly.com', 'owner', now);
  const otherOwner = seedExtranetSession(env, 'second-owner@bosphorly.example', 'owner', now);
  const sent = [];
  const tgOutbox = [];
  const origFetch = globalThis.fetch;
  const installFetch = () => {
    globalThis.fetch = async (url, opts) => {
      if (String(url).includes('api.resend.com/emails')) {
        sent.push({ url, body: JSON.parse(opts.body) });
        return Response.json({ id: `mail_${sent.length}` });
      }
      if (String(url).includes('api.telegram.org')) {
        tgOutbox.push(JSON.parse(opts.body));
        return Response.json({ ok: true });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    };
  };
  const post = (path, body, nowMs, actor = owner) => callExtranet(env, path, { method: 'POST', actor, nowMs, body });

  try {
    installFetch();
    // A) Nothing panel-closed yet (only Instagram env-locked) -> reopen_all refused, env lock never lifted.
    const early = await post('/v1/extranet/emergency/request-code', { targetChannel: 'all', actionType: 'reopen_all', confirmReopenText: 'AÇ' }, now);
    assert.equal(early.status, 409);
    assert.equal(early.body.code, 'ENV_LOCKED');

    // B) Close all channels with dual-account verification.
    globalThis.fetch = origFetch;
    const closeAll = await setChannelDirectlyViaDualAuth(env, owner, 'all', 'close_all', now);
    const closeAllOpId = closeAll.body.operationId || env.DB.raw
      .prepare(`SELECT operation_id FROM emergency_verifications WHERE action_type = 'close_all' AND status = 'consumed'`)
      .get().operation_id;
    installFetch();
    for (const ch of ['whatsapp', 'telegram', 'instagram', 'mimo']) {
      assert.equal(await isChannelEnabled(env, ch), false, `${ch} closed after close_all`);
    }

    // C) Only info@bosphorly.com may request reopen_all.
    now += OTP_COOLDOWN_MS + 5000;
    const forbidden = await post('/v1/extranet/emergency/request-code', { targetChannel: 'all', actionType: 'reopen_all', confirmReopenText: 'AÇ' }, now, otherOwner);
    assert.equal(forbidden.status, 403);

    // D) "AÇ" is mandatory and target must be 'all'.
    const noAc = await post('/v1/extranet/emergency/request-code', { targetChannel: 'all', actionType: 'reopen_all', confirmAction: true }, now);
    assert.equal(noAc.status, 400);
    assert.equal(noAc.body.code, 'REOPEN_CONFIRM_REQUIRED');
    const wrongTarget = await post('/v1/extranet/emergency/request-code', { targetChannel: 'whatsapp', actionType: 'reopen_all', confirmReopenText: 'AÇ' }, now);
    assert.equal(wrongTarget.status, 400);
    assert.equal(wrongTarget.body.code, 'INVALID_CHANNEL');

    // E) Telegram /acil_ac hepsi is forbidden and changes nothing.
    const tgSecret = await computeTelegramWebhookSecret(env.CODE_PEPPER);
    const tgRes = await handleTelegramWebhook(
      new Request('https://api.bosphorly.com/v1/telegram/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': tgSecret },
        body: JSON.stringify({
          update_id: 9,
          message: {
            message_id: 901,
            date: Math.floor(now / 1000),
            chat: { id: Number(env.TELEGRAM_ADMIN_CHAT_ID), type: 'private' },
            from: { id: Number(env.TELEGRAM_ADMIN_CHAT_ID) },
            text: '/acil_ac hepsi',
          },
        }),
      }),
      env,
      now,
      { waitUntil() {} }
    );
    assert.equal(tgRes.status, 200);
    assert.equal((await tgRes.json()).denied, 'reopen_forbidden');
    assert.equal(await isChannelEnabled(env, 'whatsapp'), false);

    // F) A single-channel reopen OTP cannot be used for reopen_all (and vice versa).
    const single = await post('/v1/extranet/emergency/request-code', { targetChannel: 'whatsapp', actionType: 'reopen', confirmReopenText: 'AÇ' }, now);
    assert.equal(single.status, 200);
    const singleCode = extractSixDigitCodeFromEmails(sent.map((m) => ({ body: { text: m.body.text } })), single.body.operationId);
    const crossSingle = await post('/v1/extranet/emergency/verify', { operationId: single.body.operationId, code: singleCode, targetChannel: 'all', actionType: 'reopen_all', confirmReopenText: 'AÇ' }, now + 1000);
    assert.equal(crossSingle.status, 400);
    assert.equal(crossSingle.body.code, 'BINDING_MISMATCH');

    // G) The consumed close_all operation cannot be replayed as reopen_all.
    const crossCloseAll = await post('/v1/extranet/emergency/verify', { operationId: closeAllOpId, code: '000000', targetChannel: 'all', actionType: 'reopen_all', confirmReopenText: 'AÇ' }, now + 1500);
    assert.equal(crossCloseAll.status, 400);
    assert.equal(crossCloseAll.body.code, 'BINDING_MISMATCH');

    // H) Fresh reopen_all OTP supersedes the pending single reopen OTP.
    now += OTP_COOLDOWN_MS + 5000;
    const bulk = await post('/v1/extranet/emergency/request-code', { targetChannel: 'all', actionType: 'reopen_all', confirmReopenText: 'AÇ', confirmAction: true }, now);
    assert.equal(bulk.status, 200);
    const bulkCode = extractSixDigitCodeFromEmails(sent.map((m) => ({ body: { text: m.body.text } })), bulk.body.operationId);
    assert.ok(!JSON.stringify(bulk.body).includes(bulkCode));
    const otpMail = sent.find((m) => m.body.text.includes(bulk.body.operationId));
    assert.deepEqual([].concat(otpMail.body.to), [VERIFY_GMAIL]);
    const pendingSt = await callExtranet(env, '/v1/extranet/emergency/status', { actor: owner, nowMs: now + 200 });
    assert.equal(pendingSt.body.channels.find((c) => c.id === 'whatsapp').pendingVerification, true);
    assert.equal(pendingSt.body.channels.find((c) => c.id === 'instagram').pendingVerification, false, 'env-locked channel is not marked pending during reopen_all');
    const superseded = await post('/v1/extranet/emergency/verify', { operationId: single.body.operationId, code: singleCode, targetChannel: 'whatsapp', actionType: 'reopen', confirmReopenText: 'AÇ' }, now + 500);
    assert.equal(superseded.status, 409);
    assert.equal(superseded.body.code, 'CODE_INVALIDATED');

    // I) Verify without "AÇ" is refused and leaves every channel closed.
    const verifyNoAc = await post('/v1/extranet/emergency/verify', { operationId: bulk.body.operationId, code: bulkCode, targetChannel: 'all', actionType: 'reopen_all' }, now + 1000);
    assert.equal(verifyNoAc.status, 400);
    assert.equal(verifyNoAc.body.code, 'REOPEN_CONFIRM_REQUIRED');
    assert.equal(await isChannelEnabled(env, 'whatsapp'), false);

    // J) Successful bulk reactivation.
    const ok = await post('/v1/extranet/emergency/verify', { operationId: bulk.body.operationId, code: bulkCode, targetChannel: 'all', actionType: 'reopen_all', confirmReopenText: 'AÇ' }, now + 2000);
    assert.equal(ok.status, 200);
    assert.equal(await isChannelEnabled(env, 'whatsapp'), true);
    assert.equal(await isChannelEnabled(env, 'telegram'), true);
    assert.equal(await isChannelEnabled(env, 'mimo'), true);
    assert.equal(await isChannelEnabled(env, 'instagram'), false, 'INSTAGRAM_DISABLED=1 env lock must never be lifted from the panel');

    const st = await callExtranet(env, '/v1/extranet/emergency/status', { actor: owner, nowMs: now + 3000 });
    const ig = st.body.channels.find((c) => c.id === 'instagram');
    assert.equal(ig.enabled, false);
    assert.equal(ig.envLocked, true);
    assert.equal(ig.d1Enabled, false, 'D1 row of env-locked channel is not touched by reopen_all');

    const audit = env.DB.raw
      .prepare(`SELECT * FROM emergency_audit_log WHERE operation_id = ? AND outcome = 'success'`)
      .get(bulk.body.operationId);
    assert.equal(audit.action_type, 'reopen_all');
    assert.equal(audit.channel, 'all');
    assert.deepEqual(JSON.parse(audit.previous_state), { whatsapp: 'closed', telegram: 'closed', instagram: 'closed_env_locked', mimo: 'closed' });
    assert.deepEqual(JSON.parse(audit.new_state), { whatsapp: 'open', telegram: 'open', instagram: 'closed_env_locked', mimo: 'open' });
    assert.ok(!JSON.stringify(audit).includes(bulkCode));
    const exAudit = env.DB.raw.prepare(`SELECT COUNT(*) AS n FROM extranet_audit WHERE action = 'emergency_reopen_all'`).get();
    assert.equal(exAudit.n, 1);
    const notif = env.DB.raw.prepare(`SELECT COUNT(*) AS n FROM emergency_notification_queue WHERE operation_id = ?`).get(bulk.body.operationId);
    assert.equal(notif.n, 1);
    const openWindows = env.DB.raw.prepare(`SELECT COUNT(*) AS n FROM emergency_closed_windows WHERE reopened_at_ms IS NULL`).get();
    assert.equal(openWindows.n, 0, 'WhatsApp/Telegram closed windows are closed atomically');
    assert.equal(JSON.parse(env.WHATSAPP_KV.map.get('emergency:ch:whatsapp')).enabled, true);
    assert.equal(JSON.parse(env.WHATSAPP_KV.map.get('emergency:ch:instagram')).enabled, false);

    // K) Replay is rejected; another reopen_all has nothing to reopen except env-locked Instagram.
    const replay = await post('/v1/extranet/emergency/verify', { operationId: bulk.body.operationId, code: bulkCode, targetChannel: 'all', actionType: 'reopen_all', confirmReopenText: 'AÇ' }, now + 4000);
    assert.equal(replay.status, 409);
    assert.equal(replay.body.code, 'CODE_ALREADY_USED');
    now += OTP_COOLDOWN_MS + 5000;
    const again = await post('/v1/extranet/emergency/request-code', { targetChannel: 'all', actionType: 'reopen_all', confirmReopenText: 'AÇ' }, now);
    assert.equal(again.status, 409);
    assert.equal(again.body.code, 'ENV_LOCKED');
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('9. KV mirror writes ONLY when updatedAtMs changes; repeated reads do zero KV writes while fail-open and closed-channel continuity stay intact', async () => {
  const sharedKvMap = new Map();
  let kvPutCalls = 0;
  const makeTrackedKv = () => {
    const base = createKvStore(sharedKvMap);
    return {
      ...base,
      async put(key, val, opts) {
        if (String(key).startsWith('emergency:ch:')) kvPutCalls += 1;
        return base.put(key, val, opts);
      },
    };
  };

  const env = createEnv({ WHATSAPP_KV: makeTrackedKv() });
  let now = 1_770_600_000_000;
  const owner = seedExtranetSession(env, 'info@bosphorly.com', 'owner', now);

  // 1) Default state (no D1 rows): repeated reads perform 0 KV writes.
  for (let i = 0; i < 4; i++) {
    assert.equal(await isChannelEnabled(env, 'whatsapp'), true);
    const pub = await worker.fetch(new Request('https://api.bosphorly.com/v1/public/channels', { headers: { Origin: ORIGIN } }), env);
    assert.equal(pub.status, 200);
  }
  assert.equal(kvPutCalls, 0);

  // 2) Close WhatsApp -> verify writes KV once; subsequent reads in same isolate AND cold isolate do 0 KV writes.
  await setChannelDirectlyViaDualAuth(env, owner, 'whatsapp', 'close', now);
  const putsAfterClose = kvPutCalls;
  assert.equal(putsAfterClose, 1);

  for (let i = 0; i < 5; i++) {
    assert.equal(await isChannelEnabled(env, 'whatsapp'), false);
    const pub = await worker.fetch(new Request('https://api.bosphorly.com/v1/public/channels', { headers: { Origin: ORIGIN } }), env);
    assert.equal((await pub.json()).channels.whatsapp, false);
  }
  assert.equal(kvPutCalls, putsAfterClose, 'Warm isolate reads must not write KV when updatedAtMs is unchanged');

  // Fresh isolate (distinct DB wrapper object -> empty WeakMap isolate cache) sharing D1 SQLite + KV:
  const wrapSameSqliteNewIsolate = () => ({
    ...env,
    WHATSAPP_KV: makeTrackedKv(),
    DB: {
      prepare: (sql) => env.DB.prepare(sql),
      batch: (list) => env.DB.batch(list),
    },
  });
  const coldIsolateEnv = wrapSameSqliteNewIsolate();
  for (let i = 0; i < 5; i++) {
    assert.equal(await isChannelEnabled(coldIsolateEnv, 'whatsapp'), false);
  }
  assert.equal(kvPutCalls, putsAfterClose, 'Cold isolate reads must not write KV when KV already has matching updatedAtMs');

  // 3) If D1 updated_at_ms advances (e.g., KV missed a write or expired), first read syncs KV once, next reads do 0 writes.
  const nextUpdatedAtMs = now + 90_000;
  env.DB.raw
    .prepare(`UPDATE emergency_channel_states SET updated_at_ms = ? WHERE channel = 'whatsapp'`)
    .run(nextUpdatedAtMs);
  assert.equal(await isChannelEnabled(env, 'whatsapp'), false);
  assert.equal(kvPutCalls, putsAfterClose + 1, 'Changed updatedAtMs triggers exactly one KV sync write');
  for (let i = 0; i < 5; i++) {
    assert.equal(await isChannelEnabled(env, 'whatsapp'), false);
    assert.equal(await isChannelEnabled(coldIsolateEnv, 'whatsapp'), false);
  }
  assert.equal(kvPutCalls, putsAfterClose + 1, 'Subsequent reads after sync do zero KV writes');

  // 4) Transient D1 read outage on a brand-new isolate: closed WhatsApp stays closed, open Telegram stays fail-open.
  const outageEnv = {
    ...env,
    WHATSAPP_KV: makeTrackedKv(),
    DB: {
      prepare() {
        return {
          bind() {
            return this;
          },
          async first() {
            throw new Error('D1_READ_OUTAGE');
          },
        };
      },
    },
  };
  assert.equal(await isChannelEnabled(outageEnv, 'whatsapp'), false, 'Closed channel stays closed during D1 outage');
  assert.equal(await isChannelEnabled(outageEnv, 'telegram'), true, 'Open channel fails open during D1 outage');
  assert.equal(kvPutCalls, putsAfterClose + 1);
});

test('10. WhatsApp guard path: non-message webhook fast-path, stalled D1 fail-open (<2s ACK), closed-stays-closed on hang, and same-second reopen reply', async () => {
  const { publicKeyB64, privateKey } = await createTelnyxKeyPair();
  const env = createEnv({ TELNYX_PUBLIC_KEY: publicKeyB64 });

  // (a) Delivery status webhook (message.sent) performs 0 emergency D1 reads when not env-locked
  let emergencyStateReads = 0;
  const origPrepare = env.DB.prepare.bind(env.DB);
  env.DB.prepare = (sql) => {
    if (sql.includes('emergency_channel_states')) emergencyStateReads++;
    return origPrepare(sql);
  };
  const deliveryRaw = JSON.stringify({
    data: {
      event_type: 'message.sent',
      payload: { id: 'wa-deliv-1', type: 'WHATSAPP', to: [{ status: 'sent' }] },
    },
  });
  assert.equal(await allowWhatsAppWebhook(env, deliveryRaw), true);
  assert.equal(emergencyStateReads, 0, 'Delivery receipts must not query emergency_channel_states');

  // (b) Stalled/hanging emergency_channel_states D1 query when WhatsApp is OPEN:
  // handleWhatsApp must ACK 200 OK in < 1.8s (within Telnyx 2s budget) and sendWhatsApp must fail-open and send!
  const telnyxCalls = [];
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes('api.telnyx.com')) {
      telnyxCalls.push({ url, body: JSON.parse(opts.body) });
      return Response.json({ data: { id: 'out-stalled-open' } });
    }
    return Response.json({ ok: true, id: 'email-1' });
  };

  try {
    const stalledOpenEnv = {
      ...env,
      DB: {
        prepare(sql) {
          if (sql.includes('emergency_channel_states')) {
            return {
              bind() {
                return this;
              },
              first() {
                return new Promise((resolve) => {
                  const t = setTimeout(() => resolve(null), 5000);
                  t.unref?.();
                });
              },
            };
          }
          return origPrepare(sql);
        },
        batch: (list) => env.DB.batch(list),
      },
    };

    const rawOpen = buildWaInboundPayload('Merhaba Boğaz turu', 'wa-stalled-open-1');
    const signedOpenReq = await signTelnyxRequest(rawOpen, privateKey);
    const jobs = [];
    const t0 = Date.now();
    const ackRes = await handleWhatsApp(signedOpenReq, stalledOpenEnv, { waitUntil: (p) => jobs.push(p) });
    const ackMs = Date.now() - t0;
    assert.equal(ackRes.status, 200);
    assert.ok(ackMs < 1800, `Webhook ACK took ${ackMs}ms; must stay within Telnyx 2s budget even when D1 stalls`);
    await Promise.all(jobs);
    assert.equal(telnyxCalls.length, 1, 'Open WhatsApp must still send reply when emergency D1 query stalls');

    // (c) Close WhatsApp -> if D1 subsequently stalls on a cold isolate, KV mirror keeps WhatsApp CLOSED!
    env.DB.prepare = origPrepare;
    const reopenSec = Math.floor(Date.now() / 1000);
    const closeAtMs = (reopenSec - 120) * 1000 + 100;
    const owner = seedExtranetSession(env, 'info@bosphorly.com', 'owner', closeAtMs);
    await setChannelDirectlyViaDualAuth(env, owner, 'whatsapp', 'close', closeAtMs);

    const stalledClosedColdEnv = {
      ...env,
      DB: {
        prepare(sql) {
          if (sql.includes('emergency_channel_states') || sql.includes('emergency_dropped_messages')) {
            return {
              bind() {
                return this;
              },
              first() {
                return new Promise((resolve) => {
                  const t = setTimeout(() => resolve(null), 5000);
                  t.unref?.();
                });
              },
              run() {
                return new Promise((resolve) => {
                  const t = setTimeout(() => resolve({ success: true }), 5000);
                  t.unref?.();
                });
              },
            };
          }
          return origPrepare(sql);
        },
        batch: (list) => env.DB.batch(list),
      },
    };

    const closedJobs = [];
    const closedReq = await signTelnyxRequest(buildWaInboundPayload('Kapalıyken deneme', 'wa-stalled-closed-1'), privateKey);
    const closedRes = await handleWhatsApp(closedReq, stalledClosedColdEnv, { waitUntil: (p) => closedJobs.push(p) });
    assert.equal(closedRes.status, 200);
    assert.equal(closedJobs.length, 0, 'Closed WhatsApp must stay closed via KV mirror even when D1 hangs');
    assert.equal(telnyxCalls.length, 1);

    // (d) Same-second post-reopen message: /verify commits reopen at reopenSec*1000 + 850ms, message sent at reopenSec*1000 + 920ms (Telnyx timestamp = reopenSec)
    const reopenCommitMs = reopenSec * 1000 + 850;
    await setChannelDirectlyViaDualAuth(env, owner, 'whatsapp', 'reopen', reopenCommitMs - 1000);

    const sameSecRaw = buildWaInboundPayload('Tekrar açıldıktan hemen sonra selam', 'wa-same-sec-after-reopen', reopenSec);
    const sameSecReq = await signTelnyxRequest(sameSecRaw, privateKey);
    const sameSecJobs = [];
    const sameSecRes = await handleWhatsApp(sameSecReq, env, { waitUntil: (p) => sameSecJobs.push(p) });
    assert.equal(sameSecRes.status, 200);
    await Promise.all(sameSecJobs);
    assert.equal(telnyxCalls.length, 2, 'Post-reopen message in the same whole second must be answered');
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('11. BSUID ("TR.xxx") hidden sender + array recipient ([{phone_number}]): replies to BSUID with identical Telnyx payload when open, suppresses when closed, and resumes after reopen', async () => {
  const { publicKeyB64, privateKey } = await createTelnyxKeyPair();
  const env = createEnv({ TELNYX_PUBLIC_KEY: publicKeyB64 });
  const bsuid = 'TR.2239592296598770';
  const buildBsuidArrayPayload = (text, id, tsSec) =>
    JSON.stringify({
      data: {
        event_type: 'message.received',
        payload: {
          id,
          type: 'WHATSAPP',
          direction: 'inbound',
          from: { phone_number: '' },
          to: [{ phone_number: WA_BUSINESS, status: 'webhook_delivered' }],
          body: {
            type: 'text',
            from: '',
            from_user_id: bsuid,
            timestamp: String(tsSec),
            text: { body: text },
          },
        },
      },
    });

  const telnyxCalls = [];
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes('api.telnyx.com')) {
      telnyxCalls.push({ url, body: JSON.parse(opts.body) });
      return Response.json({ data: { id: 'out-bsuid' } });
    }
    return Response.json({ ok: true, id: 'email-bsuid' });
  };

  try {
    // 1) Channel OPEN: BSUID + [{phone_number}] -> reply goes to BSUID with identical Telnyx payload
    const baseSec = Math.floor(Date.now() / 1000);
    const openRaw = buildBsuidArrayPayload('selam', 'wa-bsuid-open-1', baseSec);
    const openJobs = [];
    const openRes = await handleWhatsApp(await signTelnyxRequest(openRaw, privateKey), env, {
      waitUntil: (p) => openJobs.push(p),
    });
    assert.equal(openRes.status, 200);
    await Promise.all(openJobs);
    assert.equal(telnyxCalls.length, 1);
    assert.equal(telnyxCalls[0].url, 'https://api.telnyx.com/v2/messages/whatsapp');
    assert.deepEqual(telnyxCalls[0].body, {
      type: 'WHATSAPP',
      from: WA_BUSINESS,
      to: bsuid,
      messaging_profile_id: DEFAULT_TELNYX_MESSAGING_PROFILE_ID,
      whatsapp_message: {
        type: 'text',
        text: {
          body: 'Boğaz turumuz her akşam düzenlenmektedir.',
          preview_url: false,
        },
      },
    });

    // 2) Channel CLOSED: BSUID + [{phone_number}] -> 200 OK, zero background jobs, zero Telnyx calls
    let nowMs = (baseSec - 120) * 1000;
    const owner = seedExtranetSession(env, 'info@bosphorly.com', 'owner', nowMs);
    await setChannelDirectlyViaDualAuth(env, owner, 'whatsapp', 'close', nowMs);
    assert.equal(await isChannelEnabled(env, 'whatsapp'), false);

    const closedRaw = buildBsuidArrayPayload('kapalıyken selam', 'wa-bsuid-closed-1', baseSec - 60);
    const closedJobs = [];
    const closedRes = await handleWhatsApp(await signTelnyxRequest(closedRaw, privateKey), env, {
      waitUntil: (p) => closedJobs.push(p),
    });
    assert.equal(closedRes.status, 200);
    assert.equal(closedJobs.length, 0);
    assert.equal(telnyxCalls.length, 1);

    // 3) Channel REOPENED ("AÇ"): closed-window BSUID replay stays dropped; fresh BSUID + [{phone_number}] sends to BSUID!
    const reopenAtMs = baseSec * 1000 + 200;
    await setChannelDirectlyViaDualAuth(env, owner, 'whatsapp', 'reopen', reopenAtMs - 1000);
    assert.equal(await isChannelEnabled(env, 'whatsapp'), true);

    const replayJobs = [];
    const replayRes = await handleWhatsApp(await signTelnyxRequest(closedRaw, privateKey), env, {
      waitUntil: (p) => replayJobs.push(p),
    });
    assert.equal(replayRes.status, 200);
    assert.equal(replayJobs.length, 0);
    assert.equal(telnyxCalls.length, 1);

    const reopenedRaw = buildBsuidArrayPayload('tekrar açıldı selam', 'wa-bsuid-reopen-1', baseSec + 1);
    const reopenedJobs = [];
    const reopenedRes = await handleWhatsApp(await signTelnyxRequest(reopenedRaw, privateKey), env, {
      waitUntil: (p) => reopenedJobs.push(p),
    });
    assert.equal(reopenedRes.status, 200);
    await Promise.all(reopenedJobs);
    assert.equal(telnyxCalls.length, 2);
    assert.deepEqual(telnyxCalls[1].body, {
      type: 'WHATSAPP',
      from: WA_BUSINESS,
      to: bsuid,
      messaging_profile_id: DEFAULT_TELNYX_MESSAGING_PROFILE_ID,
      whatsapp_message: {
        type: 'text',
        text: {
          body: 'Boğaz turumuz her akşam düzenlenmektedir.',
          preview_url: false,
        },
      },
    });
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('12. WhatsApp #137 BSUID sender + array recipient path is preserved end-to-end with Emergency Center guards', async () => {
  const { privateKey, publicKeyB64 } = await createTelnyxKeyPair();
  const env = createEnv({ TELNYX_PUBLIC_KEY: publicKeyB64 });
  let now = 1_770_700_000_000;
  const owner = seedExtranetSession(env, 'info@bosphorly.com', 'owner', now);

  const BSUID = 'US.13491208655302741918';
  const ENT_BSUID = 'TR.ENT.9876543210';

  const buildBsuidArrayToPayload = ({
    id,
    text = 'Merhaba, Boğaz turu fiyatınız nedir?',
    bsuid = BSUID,
    fromPhone = '',
    to = [{ phone_number: WA_BUSINESS }],
    tsSec = Math.floor(Date.now() / 1000),
  }) =>
    JSON.stringify({
      data: {
        event_type: 'message.received',
        payload: {
          id,
          type: 'WHATSAPP',
          direction: 'inbound',
          from: { phone_number: fromPhone },
          to,
          body: {
            type: 'text',
            from: '',
            from_user_id: bsuid,
            timestamp: String(tsSec),
            text: { body: text },
          },
        },
      },
    });

  const origFetch = globalThis.fetch;
  const telnyxCalls = [];

  try {
    // 1) Open state: BSUID hidden-number sender + array recipient routes through worker.fetch -> handleWhatsApp -> allowWhatsAppWebhook -> parseWhatsApp -> sendWhatsApp
    env.AI.run = async () => ({
      response: JSON.stringify({
        reply: 'Merhaba! Boğaz turu için hangi tarihi düşünüyorsunuz?',
        handoff: false,
        abuse: false,
        proposal: null,
      }),
    });
    globalThis.fetch = async (url, opts) => {
      if (String(url).includes('api.telnyx.com')) {
        telnyxCalls.push({ url, body: JSON.parse(opts.body) });
        return Response.json({ data: { id: 'out-bsuid-1' } });
      }
      return Response.json({ ok: true });
    };

    const rawOpen = buildBsuidArrayToPayload({ id: 'wa-bsuid-open-1' });
    const parsedOpen = parseWhatsApp(JSON.parse(rawOpen), WA_BUSINESS);
    assert.ok(parsedOpen, 'parseWhatsApp must accept BSUID sender + array recipient');
    assert.equal(parsedOpen.phone, BSUID);

    const openJobs = [];
    const openRes = await worker.fetch(await signTelnyxRequest(rawOpen, privateKey), env, {
      waitUntil: (p) => openJobs.push(p),
    });
    assert.equal(openRes.status, 200);
    assert.equal(openJobs.length, 1, 'Open channel must schedule processWhatsApp for BSUID + array recipient');
    await Promise.all(openJobs);

    assert.equal(telnyxCalls.length, 1);
    assert.equal(telnyxCalls[0].url, 'https://api.telnyx.com/v2/messages/whatsapp');
    assert.deepEqual(telnyxCalls[0].body, {
      type: 'WHATSAPP',
      from: WA_BUSINESS,
      to: BSUID,
      messaging_profile_id: DEFAULT_TELNYX_MESSAGING_PROFILE_ID,
      whatsapp_message: {
        type: 'text',
        text: {
          body: 'Merhaba! Boğaz turu için hangi tarihi düşünüyorsunuz?',
          preview_url: false,
        },
      },
    });

    // Enterprise BSUID in from.phone_number + multi-entry array recipient also matches business and replies to ENT_BSUID
    const rawEnt = buildBsuidArrayToPayload({
      id: 'wa-bsuid-ent-1',
      bsuid: ENT_BSUID,
      fromPhone: ENT_BSUID,
      to: ['+19990001111', { phone_number: WA_BUSINESS }],
    });
    const entJobs = [];
    const entRes = await worker.fetch(await signTelnyxRequest(rawEnt, privateKey), env, {
      waitUntil: (p) => entJobs.push(p),
    });
    assert.equal(entRes.status, 200);
    await Promise.all(entJobs);
    assert.equal(telnyxCalls.length, 2);
    assert.equal(telnyxCalls[1].body.to, ENT_BSUID);

    // Non-matching array recipient is ignored without leaking BSUID or text in whatsAppSkip
    const rawOtherBiz = buildBsuidArrayToPayload({
      id: 'wa-bsuid-other-biz',
      to: [{ phone_number: '+19998887777' }],
    });
    const skipShape = whatsAppSkip(JSON.parse(rawOtherBiz), WA_BUSINESS);
    assert.equal(skipShape.to_match, false);
    assert.equal(skipShape.to_kind, 'array');
    assert.equal(skipShape.user_id, 'bsuid');
    assert.equal(JSON.stringify(skipShape).includes(BSUID), false);

    // 2) Close WhatsApp via Emergency Center: BSUID + array recipient is dropped cleanly at allowWhatsAppWebhook (200 OK, 0 AI/Telnyx)
    globalThis.fetch = origFetch;
    await setChannelDirectlyViaDualAuth(env, owner, 'whatsapp', 'close', now);

    let closedAiCalls = 0;
    env.AI.run = async () => {
      closedAiCalls++;
      return { response: JSON.stringify({ reply: 'Should not run', handoff: false, abuse: false, proposal: null }) };
    };
    globalThis.fetch = async (url, opts) => {
      if (String(url).includes('api.telnyx.com')) {
        telnyxCalls.push({ url, body: JSON.parse(opts.body) });
        return Response.json({ data: { id: 'out-closed' } });
      }
      return Response.json({ ok: true });
    };

    const closedTsSec = Math.floor(now / 1000) + 2;
    const rawClosedBsuid = buildBsuidArrayToPayload({
      id: 'wa-bsuid-closed-1',
      tsSec: closedTsSec,
    });
    const closedJobs = [];
    const closedRes = await worker.fetch(await signTelnyxRequest(rawClosedBsuid, privateKey), env, {
      waitUntil: (p) => closedJobs.push(p),
    });
    assert.equal(closedRes.status, 200);
    assert.equal(closedJobs.length, 0);
    assert.equal(closedAiCalls, 0);
    assert.equal(telnyxCalls.length, 2);

    // 3) Reopen WhatsApp: closed-window BSUID message is NOT replayed; fresh BSUID + array recipient replies at BSUID; outbound echo mutes BSUID
    globalThis.fetch = origFetch;
    now += OTP_COOLDOWN_MS + 10_000;
    await setChannelDirectlyViaDualAuth(env, owner, 'whatsapp', 'reopen', now);

    env.AI.run = async () => ({
      response: JSON.stringify({
        reply: 'Kanal yeniden açıldı, size yardımcı olabilirim.',
        handoff: false,
        abuse: false,
        proposal: null,
      }),
    });
    globalThis.fetch = async (url, opts) => {
      if (String(url).includes('api.telnyx.com')) {
        telnyxCalls.push({ url, body: JSON.parse(opts.body) });
        return Response.json({ data: { id: 'out-reopen-bsuid' } });
      }
      return Response.json({ ok: true });
    };

    const replayJobs = [];
    const replayRes = await worker.fetch(await signTelnyxRequest(rawClosedBsuid, privateKey), env, {
      waitUntil: (p) => replayJobs.push(p),
    });
    assert.equal(replayRes.status, 200);
    assert.equal(replayJobs.length, 0, 'Closed-window BSUID message must not replay after reopen');
    assert.equal(telnyxCalls.length, 2);

    const rawFreshBsuid = buildBsuidArrayToPayload({
      id: 'wa-bsuid-fresh-after-reopen',
      tsSec: Math.floor(Date.now() / 1000),
    });
    const freshJobs = [];
    const freshRes = await worker.fetch(await signTelnyxRequest(rawFreshBsuid, privateKey), env, {
      waitUntil: (p) => freshJobs.push(p),
    });
    assert.equal(freshRes.status, 200);
    await Promise.all(freshJobs);
    assert.equal(telnyxCalls.length, 3);
    assert.equal(telnyxCalls[2].body.to, BSUID);
    assert.equal(telnyxCalls[2].body.from, WA_BUSINESS);
    assert.equal(telnyxCalls[2].body.messaging_profile_id, DEFAULT_TELNYX_MESSAGING_PROFILE_ID);

    // Outbound Business App echo to BSUID mutes Mimo for that BSUID
    const echoRaw = JSON.stringify({
      data: {
        event_type: 'message.echo',
        payload: {
          id: 'wa-bsuid-echo-1',
          type: 'WHATSAPP',
          origin: 'whatsapp_business_app',
          direction: 'outbound',
          from: { phone_number: WA_BUSINESS },
          to: BSUID,
          body: { type: 'text', timestamp: String(Math.floor(Date.now() / 1000)), text: { body: 'Ekip yanıtı' } },
        },
      },
    });
    const echoJobs = [];
    const echoRes = await worker.fetch(await signTelnyxRequest(echoRaw, privateKey), env, {
      waitUntil: (p) => echoJobs.push(p),
    });
    assert.equal(echoRes.status, 200);
    await Promise.all(echoJobs);

    const mutedFollowupRaw = buildBsuidArrayToPayload({
      id: 'wa-bsuid-after-echo',
      tsSec: Math.floor(Date.now() / 1000),
    });
    const mutedJobs = [];
    await worker.fetch(await signTelnyxRequest(mutedFollowupRaw, privateKey), env, {
      waitUntil: (p) => mutedJobs.push(p),
    });
    await Promise.all(mutedJobs);
    assert.equal(telnyxCalls.length, 3, 'Muted BSUID after outbound echo must not receive automated reply');
  } finally {
    globalThis.fetch = origFetch;
  }
});
