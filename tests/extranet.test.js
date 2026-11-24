import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import worker from '../backend/worker.js';
import {
  EXTRANET_COOKIE_NAME,
  EXTRANET_IDLE_MS,
  containsCardNumber,
  escapeCsvCell,
  handleExtranetRoutes,
  maskEmail,
  maskPhone,
} from '../backend/extranet.js';

const MIGRATIONS_DIR = new URL('../backend/migrations/', import.meta.url).pathname;
const ORIGIN = 'https://example.com';

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

function createTestEnv(overrides = {}) {
  const DB = createD1();
  DB.raw.exec(`
    INSERT INTO providers (id, status, currency, license_reference, source_reference, verified_by, verified_at)
    VALUES
      ('prov-bosphorus', 'verified', 'EUR', 'TURSAB-1001', 'contract-2026', 'admin', '2026-01-01'),
      ('prov-transfer', 'verified', 'EUR', 'TURSAB-1002', 'contract-2026', 'admin', '2026-01-01'),
      ('prov-suspended', 'suspended', 'EUR', NULL, 'suspended-ref', NULL, NULL);

    INSERT INTO experiences (id, provider_id, title, source_reference)
    VALUES
      ('bb-sunset', 'prov-bosphorus', 'Boğaz Gün Batımı Turu', 'catalog-2026'),
      ('ist-transfer', 'prov-transfer', 'IST Havalimanı Transferi', 'catalog-2026');

    INSERT INTO approved_prices (id, experience_id, currency, unit_minor, valid_from, valid_until, approved_by, source_reference)
    VALUES
      ('price-sunset-eur', 'bb-sunset', 'EUR', 6000, '2026-01-01', '2099-12-31', 'admin', 'contract-2026'),
      ('price-ist-eur', 'ist-transfer', 'EUR', 6000, '2026-01-01', '2099-12-31', 'admin', 'contract-2026');

    INSERT INTO hotels (id, status, currency, commission_bps, source_reference)
    VALUES ('hotel-sultanahmet', 'verified', 'EUR', 1000, 'hotel-contract-2026');
  `);

  return {
    DB,
    PUBLIC_ORIGIN: ORIGIN,
    RATE_LIMITER: { limit: async () => ({ success: true }) },
    CODE_PEPPER: 'test-pepper-extranet',
    DEV_RETURN_CODE: '1',
    PARTNER_TOKEN: 'partner-secret-test',
    ADMIN_TOKEN: 'admin-secret-test',
    ADMIN_OWNER_EMAIL: 'owner@test.example',
    ...overrides,
  };
}

async function callWorker(env, path, { method = 'GET', body = undefined, bearer = '', cookie = '', csrf = '', origin = ORIGIN, ip = '203.0.113.10', extraHeaders = {} } = {}) {
  const headers = {
    ...(origin ? { Origin: origin } : {}),
    'CF-Connecting-IP': ip,
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    ...(cookie ? { Cookie: cookie } : {}),
    ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
    ...extraHeaders,
  };
  const req = new Request(`https://api.example${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const res = await worker.fetch(req, env);
  const ct = res.headers.get('Content-Type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();
  return { status: res.status, body: data, headers: res.headers };
}

async function signUpMember(env, email, extra = {}) {
  const s = await callWorker(env, '/v1/auth/start', { method: 'POST', body: { email, lang: 'tr' } });
  assert.equal(s.status, 200);
  const v = await callWorker(env, '/v1/auth/verify', {
    method: 'POST',
    body: { email, code: s.body.devCode, lang: 'tr', ...extra },
  });
  assert.equal(v.status, 200);
  const memberRow = env.DB.raw.prepare(`SELECT * FROM members WHERE email = ?`).get(email.toLowerCase());
  return { token: v.body.token, member: v.body.member, id: memberRow.id };
}

/**
 * Creates a verified Extranet session in D1 (with a registered passkey) for RBAC and workflow tests,
 * returning the cookie header and CSRF token.
 */
async function createExtranetActor(env, email, role, nowMs = Date.now()) {
  const u = await signUpMember(env, email, { name: `Test ${role}` });
  if (role !== 'owner' || email.toLowerCase() !== env.ADMIN_OWNER_EMAIL.toLowerCase()) {
    env.DB.raw
      .prepare(`INSERT OR REPLACE INTO extranet_users (member_id, role, active) VALUES (?, ?, 1)`)
      .run(u.id, role);
  } else {
    env.DB.raw
      .prepare(`INSERT OR REPLACE INTO extranet_users (member_id, role, active) VALUES (?, 'owner', 1)`)
      .run(u.id);
  }

  // Register a passkey record (mandatory for all Extranet users)
  env.DB.raw
    .prepare(`INSERT INTO passkeys (credential_id, member_id, public_key, counter, created_at) VALUES (?, ?, ?, 0, datetime('now'))`)
    .run(`pk-${u.id}`, u.id, Buffer.from('mock-public-key').toString('base64'));

  const rawSession = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(rawSession).digest('hex');
  const csrfToken = crypto.randomBytes(32).toString('base64url');

  env.DB.raw
    .prepare(
      `INSERT INTO extranet_sessions (token_hash, member_id, csrf_token, ip_address, user_agent, created_at, last_active_at, expires_at)
       VALUES (?, ?, ?, '203.0.113.10', 'node-test', ?, ?, ?)`
    )
    .run(tokenHash, u.id, csrfToken, nowMs, nowMs, nowMs + 12 * 3600 * 1000);

  return {
    memberId: u.id,
    memberBearer: u.token,
    email,
    role,
    rawSession,
    cookie: `${EXTRANET_COOKIE_NAME}=${rawSession}`,
    csrf: csrfToken,
  };
}

test('unauthenticated requests and non-extranet members are denied across all /v1/extranet/* endpoints', async () => {
  const env = createTestEnv();

  const protectedEndpoints = [
    ['GET', '/v1/extranet/session'],
    ['GET', '/v1/extranet/dashboard'],
    ['GET', '/v1/extranet/providers'],
    ['GET', '/v1/extranet/bookings'],
    ['GET', '/v1/extranet/bookings/bk:b-1'],
    ['POST', '/v1/extranet/bookings/export'],
    ['POST', '/v1/extranet/bookings/bk:b-1/reveal-pii'],
    ['POST', '/v1/extranet/bookings/bk:b-1/status'],
    ['POST', '/v1/extranet/bookings/bk:b-1/payment'],
    ['POST', '/v1/extranet/bookings/bk:b-1/provider'],
    ['POST', '/v1/extranet/bookings/bk:b-1/notes'],
    ['POST', '/v1/extranet/logout'],
  ];

  for (const [method, path] of protectedEndpoints) {
    const r = await callWorker(env, path, { method, body: method === 'POST' ? {} : undefined });
    assert.equal(r.status, 401, `Unauthenticated ${method} ${path} must return 401`);
  }

  // Sending raw ADMIN_TOKEN to Extranet is never accepted
  const withAdminToken = await callWorker(env, '/v1/extranet/dashboard', { bearer: env.ADMIN_TOKEN });
  assert.equal(withAdminToken.status, 401);

  // Regular signed-in member (not in extranet_users) is denied with 403 and audited
  const regularMember = await signUpMember(env, 'traveler@example.com');
  const statusRes = await callWorker(env, '/v1/extranet/auth/status', {
    method: 'POST',
    body: {},
    bearer: regularMember.token,
  });
  assert.equal(statusRes.status, 403);

  const regOptsDeny = await callWorker(env, '/v1/extranet/passkey/register/options', {
    method: 'POST',
    body: {},
    bearer: regularMember.token,
  });
  assert.equal(regOptsDeny.status, 403);

  const deniedAudits = env.DB.raw
    .prepare(`SELECT * FROM extranet_audit WHERE actor_member_id = ? AND action = 'access_denied'`)
    .all(regularMember.id);
  assert.equal(deniedAudits.length, 2);
});

test('ADMIN_OWNER_EMAIL bootstraps initial owner, enforces mandatory first-login passkey setup, and revokes session if passkey is removed', async () => {
  const env = createTestEnv({ ADMIN_OWNER_EMAIL: 'FirstOwner@Bosphorly.Example' });
  const ownerMember = await signUpMember(env, 'firstowner@bosphorly.example', { name: 'İlk Owner' });

  // 1. Before passkey enrollment, /v1/extranet/auth/status provisions owner in extranet_users and demands setup_passkey
  const st = await callWorker(env, '/v1/extranet/auth/status', {
    method: 'POST',
    body: {},
    bearer: ownerMember.token,
  });
  assert.equal(st.status, 200);
  assert.equal(st.body.authorized, true);
  assert.equal(st.body.hasPasskey, false);
  assert.equal(st.body.step, 'setup_passkey');
  assert.equal(st.body.user.role, 'owner');
  assert.equal(st.headers.get('Set-Cookie'), null, 'No session cookie before passkey setup');

  const userRow = env.DB.raw.prepare(`SELECT role, active FROM extranet_users WHERE member_id = ?`).get(ownerMember.id);
  assert.deepEqual({ ...userRow }, { role: 'owner', active: 1 });

  // 2. Owner can request passkey registration options (single-use challenge)
  const opts = await callWorker(env, '/v1/extranet/passkey/register/options', {
    method: 'POST',
    body: {},
    bearer: ownerMember.token,
  });
  assert.equal(opts.status, 200);
  assert.ok(opts.body.challenge);
  assert.equal(opts.body.authenticatorSelection.userVerification, 'required');

  // 3. Once a passkey exists, /v1/extranet/auth/status moves to verify_passkey
  env.DB.raw
    .prepare(`INSERT INTO passkeys (credential_id, member_id, public_key, counter) VALUES ('pk-owner-1', ?, 'cHVia2V5', 0)`)
    .run(ownerMember.id);
  const st2 = await callWorker(env, '/v1/extranet/auth/status', {
    method: 'POST',
    body: {},
    bearer: ownerMember.token,
  });
  assert.equal(st2.status, 200);
  assert.equal(st2.body.hasPasskey, true);
  assert.equal(st2.body.step, 'verify_passkey');

  // 4. If an active extranet user deletes their last passkey, their extranet session is terminated
  const actor = await createExtranetActor(env, 'admin-pk@example.com', 'admin');
  assert.equal((await callWorker(env, '/v1/extranet/dashboard', { cookie: actor.cookie })).status, 200);

  const delPk = await callWorker(env, '/v1/passkeys/delete', {
    method: 'POST',
    body: { id: `pk-${actor.memberId}` },
    bearer: actor.memberBearer,
  });
  assert.equal(delPk.status, 200);

  const afterDel = await callWorker(env, '/v1/extranet/dashboard', { cookie: actor.cookie });
  assert.equal(afterDel.status, 401);
});

test('cookie flags (HttpOnly + Secure + SameSite=Strict), CSRF protection, cross-origin rejection, and 30m idle session expiry', async () => {
  const env = createTestEnv();
  const baseTime = Date.UTC(2026, 10, 24, 12, 0, 0);
  const owner = await createExtranetActor(env, 'owner@test.example', 'owner');

  // 1. Cookie attributes check on /v1/extranet/session
  const sessRes = await callWorker(env, '/v1/extranet/session', { cookie: owner.cookie });
  assert.equal(sessRes.status, 200);
  const setCookie = sessRes.headers.get('Set-Cookie') || '';
  assert.match(setCookie, /^__Host-bosphorly_extranet=/);
  assert.match(setCookie, /\bHttpOnly\b/);
  assert.match(setCookie, /\bSecure\b/);
  assert.match(setCookie, /\bSameSite=Strict\b/);
  assert.match(setCookie, /\bMax-Age=1800\b/);
  assert.equal(sessRes.headers.get('Access-Control-Allow-Credentials'), 'true');
  assert.equal(sessRes.headers.get('Access-Control-Allow-Origin'), ORIGIN);

  // 2. Cross-origin and cross-site Fetch Metadata rejection
  const crossOrigin = await callWorker(env, '/v1/extranet/dashboard', {
    cookie: owner.cookie,
    origin: 'https://evil.example',
  });
  assert.equal(crossOrigin.status, 403);

  const crossSiteHeader = await callWorker(env, '/v1/extranet/dashboard', {
    cookie: owner.cookie,
    extraHeaders: { 'Sec-Fetch-Site': 'cross-site' },
  });
  assert.equal(crossSiteHeader.status, 403);

  // 3. CSRF token required on POST requests
  const noCsrf = await callWorker(env, '/v1/extranet/bookings/export', {
    method: 'POST',
    body: {},
    cookie: owner.cookie,
  });
  assert.equal(noCsrf.status, 403);
  assert.equal(noCsrf.body.code, 'CSRF_INVALID');

  const wrongCsrf = await callWorker(env, '/v1/extranet/bookings/export', {
    method: 'POST',
    body: {},
    cookie: owner.cookie,
    csrf: 'forged-csrf-token',
  });
  assert.equal(wrongCsrf.status, 403);

  // 4. Sliding 30-minute idle timeout verification
  const actorIdle = await createExtranetActor(env, 'idle-admin@example.com', 'admin', baseTime);
  const makeReq = () =>
    new Request('https://api.example/v1/extranet/session', {
      method: 'GET',
      headers: { Origin: ORIGIN, Cookie: actorIdle.cookie, 'CF-Connecting-IP': '203.0.113.11' },
    });

  // At +29 minutes: still active, slides last_active_at to baseTime + 29m
  const r29 = await handleExtranetRoutes(makeReq(), env, new URL('https://api.example/v1/extranet/session'), baseTime + 29 * 60 * 1000);
  assert.equal(r29.status, 200);

  // At +58 minutes (29m after previous activity): still active!
  const r58 = await handleExtranetRoutes(makeReq(), env, new URL('https://api.example/v1/extranet/session'), baseTime + 58 * 60 * 1000);
  assert.equal(r58.status, 200);

  // At +58m + 30m + 1ms (idle > 30m): expired & deleted!
  const rExpired = await handleExtranetRoutes(
    makeReq(),
    env,
    new URL('https://api.example/v1/extranet/session'),
    baseTime + 58 * 60 * 1000 + EXTRANET_IDLE_MS + 1
  );
  assert.equal(rExpired.status, 401);
  assert.match(rExpired.headers.get('Set-Cookie') || '', /Max-Age=0/);
  const expiredBody = await rExpired.json();
  assert.equal(expiredBody.code, 'SESSION_IDLE_EXPIRED');
});

test('strict RBAC: staff can view, add notes, and change status, while payment, provider assignment, and CSV export are blocked appropriately', async () => {
  const env = createTestEnv();
  const owner = await createExtranetActor(env, 'owner@test.example', 'owner');
  const admin = await createExtranetActor(env, 'admin@test.example', 'admin');
  const staff = await createExtranetActor(env, 'staff@test.example', 'staff');

  // Seed a structured booking
  env.DB.raw.exec(`
    INSERT INTO booking_requests (id, idempotency_key, payload_hash, experience_id, price_id, service_date, guests, total_minor, currency, commission_bps, state)
    VALUES ('bk-rbac-1', 'idem-rbac-1', 'hash-1', 'bb-sunset', 'price-sunset-eur', '2026-12-15', 2, 12000, 'EUR', 1000, 'requested');
  `);

  // Staff CAN view dashboard, bookings list, booking detail, add internal note, and transition status
  assert.equal((await callWorker(env, '/v1/extranet/dashboard', { cookie: staff.cookie })).status, 200);
  assert.equal((await callWorker(env, '/v1/extranet/bookings', { cookie: staff.cookie })).status, 200);
  assert.equal((await callWorker(env, '/v1/extranet/bookings/bk:bk-rbac-1', { cookie: staff.cookie })).status, 200);

  const staffNote = await callWorker(env, '/v1/extranet/bookings/bk:bk-rbac-1/notes', {
    method: 'POST',
    cookie: staff.cookie,
    csrf: staff.csrf,
    body: { note: 'Misafir bebek koltuğu sordu.' },
  });
  assert.equal(staffNote.status, 200);
  assert.equal(staffNote.body.booking.internalNotes.length, 1);

  const staffStatus = await callWorker(env, '/v1/extranet/bookings/bk:bk-rbac-1/status', {
    method: 'POST',
    cookie: staff.cookie,
    csrf: staff.csrf,
    body: { toStatus: 'in_progress' },
  });
  assert.equal(staffStatus.status, 200);
  assert.equal(staffStatus.body.booking.status, 'in_progress');

  // Staff CANNOT change payment status, assign provider, or export CSV (403 Forbidden)
  const staffPayDeny = await callWorker(env, '/v1/extranet/bookings/bk:bk-rbac-1/payment', {
    method: 'POST',
    cookie: staff.cookie,
    csrf: staff.csrf,
    body: { paymentStatus: 'paid' },
  });
  assert.equal(staffPayDeny.status, 403);

  const staffProvDeny = await callWorker(env, '/v1/extranet/bookings/bk:bk-rbac-1/provider', {
    method: 'POST',
    cookie: staff.cookie,
    csrf: staff.csrf,
    body: { providerId: 'prov-bosphorus' },
  });
  assert.equal(staffProvDeny.status, 403);

  const staffExportDeny = await callWorker(env, '/v1/extranet/bookings/export', {
    method: 'POST',
    cookie: staff.cookie,
    csrf: staff.csrf,
    body: {},
  });
  assert.equal(staffExportDeny.status, 403);

  // Staff cookie/token also cannot access legacy /v1/admin/* endpoints (price, campaign, provider verify)
  assert.equal((await callWorker(env, '/v1/admin/prices', { method: 'POST', cookie: staff.cookie, body: {} })).status, 401);
  assert.equal((await callWorker(env, '/v1/admin/campaigns', { method: 'POST', cookie: staff.cookie, body: {} })).status, 401);

  // Admin CAN update payment status and assign provider, CANNOT export CSV
  const adminPayOk = await callWorker(env, '/v1/extranet/bookings/bk:bk-rbac-1/payment', {
    method: 'POST',
    cookie: admin.cookie,
    csrf: admin.csrf,
    body: { paymentStatus: 'paid' },
  });
  assert.equal(adminPayOk.status, 200);
  assert.equal(adminPayOk.body.booking.paymentStatus, 'paid');

  const adminProvOk = await callWorker(env, '/v1/extranet/bookings/bk:bk-rbac-1/provider', {
    method: 'POST',
    cookie: admin.cookie,
    csrf: admin.csrf,
    body: { providerId: 'prov-transfer' },
  });
  assert.equal(adminProvOk.status, 200);
  assert.equal(adminProvOk.body.booking.providerId, 'prov-transfer');

  const adminExportDeny = await callWorker(env, '/v1/extranet/bookings/export', {
    method: 'POST',
    cookie: admin.cookie,
    csrf: admin.csrf,
    body: {},
  });
  assert.equal(adminExportDeny.status, 403);

  // Suspended provider cannot be assigned even by owner
  const suspendedDeny = await callWorker(env, '/v1/extranet/bookings/bk:bk-rbac-1/provider', {
    method: 'POST',
    cookie: owner.cookie,
    csrf: owner.csrf,
    body: { providerId: 'prov-suspended' },
  });
  assert.equal(suspendedDeny.status, 400);

  // Owner CAN export CSV and audit is written
  const ownerExportOk = await callWorker(env, '/v1/extranet/bookings/export', {
    method: 'POST',
    cookie: owner.cookie,
    csrf: owner.csrf,
    body: { status: 'in_progress' },
  });
  assert.equal(ownerExportOk.status, 200);
  assert.match(ownerExportOk.headers.get('Content-Type') || '', /^text\/csv/);
  assert.match(ownerExportOk.body, /bk-rbac-1/);

  const exportAudit = env.DB.raw
    .prepare(`SELECT * FROM extranet_audit WHERE action = 'export_bookings_csv' AND actor_member_id = ?`)
    .get(owner.memberId);
  assert.ok(exportAudit);
});

test('PII masking by default, audited reveal-pii, workflow state machine, booking_events, coupons sync, and card number rejection', async () => {
  const env = createTestEnv();
  const owner = await createExtranetActor(env, 'owner@test.example', 'owner');

  // Create a member with email, phone, hotel, and a held welcome coupon on a member_request
  const guest = await signUpMember(env, 'zeynep.kaya@guest.example', {
    name: 'Zeynep Kaya',
    phone: '+90 532 987 65 43',
    hotelName: 'Sultanahmet Konak',
    country: 'Türkiye',
  });
  const welcomeCode = guest.member.coupons[0].code;

  const reqCreate = await callWorker(env, '/v1/me/requests', {
    method: 'POST',
    bearer: guest.token,
    body: {
      ref: 'BOS-TEST9001',
      serviceId: 'bb-sunset',
      date: '2026-12-20',
      guests: 3,
      couponCode: welcomeCode,
      type: 'tour',
      title: 'Boğaz Gün Batımı Turu',
      total: '€180 (3 × €60)',
      notes: 'Vejetaryen menü tercihi',
    },
  });
  assert.equal(reqCreate.status, 200);

  // 1. List bookings: raw email and phone MUST NOT appear in JSON response
  const listRes = await callWorker(env, '/v1/extranet/bookings?q=BOS-TEST9001', { cookie: owner.cookie });
  assert.equal(listRes.status, 200);
  assert.equal(listRes.body.total, 1);
  const rawListJson = JSON.stringify(listRes.body);
  assert.doesNotMatch(rawListJson, /zeynep\.kaya@guest\.example/);
  assert.doesNotMatch(rawListJson, /532\s*987\s*65/);
  assert.equal(listRes.body.items[0].guestEmailMasked, 'z***a@guest.example');
  assert.equal(listRes.body.items[0].guestPhoneMasked, '+90 *** ** 43');
  assert.equal(listRes.body.items[0].coupon.code, welcomeCode);

  // 2. View detail: raw email and phone STILL masked until reveal-pii is called
  const detailRes = await callWorker(env, '/v1/extranet/bookings/mr:BOS-TEST9001', { cookie: owner.cookie });
  assert.equal(detailRes.status, 200);
  const rawDetailJson = JSON.stringify(detailRes.body);
  assert.doesNotMatch(rawDetailJson, /zeynep\.kaya@guest\.example/);
  assert.doesNotMatch(rawDetailJson, /532\s*987\s*65/);

  // 3. Reveal PII writes to extranet_audit and returns only the requested field
  const revEmail = await callWorker(env, '/v1/extranet/bookings/mr:BOS-TEST9001/reveal-pii', {
    method: 'POST',
    cookie: owner.cookie,
    csrf: owner.csrf,
    body: { field: 'email' },
  });
  assert.equal(revEmail.status, 200);
  assert.equal(revEmail.body.value, 'zeynep.kaya@guest.example');

  const revPhone = await callWorker(env, '/v1/extranet/bookings/mr:BOS-TEST9001/reveal-pii', {
    method: 'POST',
    cookie: owner.cookie,
    csrf: owner.csrf,
    body: { field: 'phone' },
  });
  assert.equal(revPhone.status, 200);
  assert.equal(revPhone.body.value, '+90 532 987 65 43');

  const piiAudits = env.DB.raw.prepare(`SELECT * FROM extranet_audit WHERE action = 'reveal_pii'`).all();
  assert.equal(piiAudits.length, 2);

  // 4. Workflow transitions enforce strict progression: new -> in_progress -> confirmed -> completed
  // Skipping directly from new -> completed must fail with 409
  const badJump = await callWorker(env, '/v1/extranet/bookings/mr:BOS-TEST9001/status', {
    method: 'POST',
    cookie: owner.cookie,
    csrf: owner.csrf,
    body: { toStatus: 'completed' },
  });
  assert.equal(badJump.status, 409);

  const step1 = await callWorker(env, '/v1/extranet/bookings/mr:BOS-TEST9001/status', {
    method: 'POST',
    cookie: owner.cookie,
    csrf: owner.csrf,
    body: { toStatus: 'in_progress', note: 'Tedarikçiye iletildi' },
  });
  assert.equal(step1.status, 200);
  assert.equal(step1.body.booking.status, 'in_progress');

  const step2 = await callWorker(env, '/v1/extranet/bookings/mr:BOS-TEST9001/status', {
    method: 'POST',
    cookie: owner.cookie,
    csrf: owner.csrf,
    body: { toStatus: 'confirmed', note: 'Tekne kontenjanı onaylandı' },
  });
  assert.equal(step2.status, 200);
  assert.equal(step2.body.booking.status, 'confirmed');

  const step3 = await callWorker(env, '/v1/extranet/bookings/mr:BOS-TEST9001/status', {
    method: 'POST',
    cookie: owner.cookie,
    csrf: owner.csrf,
    body: { toStatus: 'completed', note: 'Misafir tura katıldı' },
  });
  assert.equal(step3.status, 200);
  assert.equal(step3.body.booking.status, 'completed');
  assert.equal(step3.body.booking.events.length, 3);

  // Completed reservation cannot be cancelled afterwards
  const afterCompleteCancel = await callWorker(env, '/v1/extranet/bookings/mr:BOS-TEST9001/status', {
    method: 'POST',
    cookie: owner.cookie,
    csrf: owner.csrf,
    body: { toStatus: 'cancelled' },
  });
  assert.equal(afterCompleteCancel.status, 409);

  // Member profile reflects redeemed coupon, 1 stamp,second_tour reward, and does NOT leak internal extranet notes!
  const guestProfile = await callWorker(env, '/v1/me', { bearer: guest.token });
  assert.equal(guestProfile.status, 200);
  assert.equal(guestProfile.body.stamps, 1);
  assert.equal(guestProfile.body.coupons.find((c) => c.code === welcomeCode).status, 'redeemed');
  assert.ok(guestProfile.body.coupons.some((c) => c.kind === 'second_tour'));
  assert.doesNotMatch(JSON.stringify(guestProfile.body), /Tekne kontenjanı onaylandı/);

  // 5. Card number protection: attempting to store a Luhn-valid PAN in internal notes or payment notes is rejected with 400
  const cardNoteAttempt = await callWorker(env, '/v1/extranet/bookings/mr:BOS-TEST9001/notes', {
    method: 'POST',
    cookie: owner.cookie,
    csrf: owner.csrf,
    body: { note: 'Misafir kart bilgisi: 4532 0151 1283 0366' },
  });
  assert.equal(cardNoteAttempt.status, 400);

  const cardPayExtraField = await callWorker(env, '/v1/extranet/bookings/mr:BOS-TEST9001/payment', {
    method: 'POST',
    cookie: owner.cookie,
    csrf: owner.csrf,
    body: { paymentStatus: 'paid', cardNumber: '4532015112830366' },
  });
  assert.equal(cardPayExtraField.status, 400);
});

test('dashboard metrics (today/week/month), multi-criteria filters (date range, product, status, source, lang, tier), and pagination', async () => {
  const env = createTestEnv();
  const owner = await createExtranetActor(env, 'owner@test.example', 'owner');

  // Create Gold member (2 fulfilled requests) in German ('de') from hotel-sultanahmet
  const goldMember = await signUpMember(env, 'hans@guest.example', {
    name: 'Hans Müller',
    hotel: 'hotel-sultanahmet',
  });
  env.DB.raw.prepare(`UPDATE members SET lang = 'de' WHERE id = ?`).run(goldMember.id);
  env.DB.raw.exec(`
    INSERT INTO member_requests (ref, member_id, service_id, service_date, guests, state, total_text)
    VALUES
      ('BOS-GOLD01', '${goldMember.id}', 'bb-sunset', '2026-11-10', 2, 'fulfilled', '€120'),
      ('BOS-GOLD02', '${goldMember.id}', 'ist-transfer', '2026-11-12', 2, 'fulfilled', '€60'),
      ('BOS-GOLD03', '${goldMember.id}', 'ist-transfer', '2026-12-28', 4, 'requested', '€65');
  `);

  // Filter by tier=gold & lang=de & source=hotel_qr & product=ist-transfer
  const filtered = await callWorker(
    env,
    '/v1/extranet/bookings?tier=gold&lang=de&source=hotel_qr&product=ist-transfer&dateFrom=2026-12-01&dateTo=2026-12-31',
    { cookie: owner.cookie }
  );
  assert.equal(filtered.status, 200);
  assert.equal(filtered.body.total, 1);
  assert.equal(filtered.body.items[0].displayRef, 'BOS-GOLD03');
  assert.equal(filtered.body.items[0].memberTier, 'gold');

  // Pagination check (pageSize=2 across 3 total records)
  const page1 = await callWorker(env, '/v1/extranet/bookings?page=1&pageSize=2', { cookie: owner.cookie });
  assert.equal(page1.status, 200);
  assert.equal(page1.body.total, 3);
  assert.equal(page1.body.totalPages, 2);
  assert.equal(page1.body.items.length, 2);

  const page2 = await callWorker(env, '/v1/extranet/bookings?page=2&pageSize=2', { cookie: owner.cookie });
  assert.equal(page2.status, 200);
  assert.equal(page2.body.items.length, 1);

  // Dashboard check
  const dash = await callWorker(env, '/v1/extranet/dashboard', { cookie: owner.cookie });
  assert.equal(dash.status, 200);
  assert.ok(dash.body.periods.today.newRequests >= 3);
  assert.ok(dash.body.periods.today.confirmed >= 2);
  assert.ok(dash.body.periods.today.newMembers >= 2);
  assert.ok(dash.body.periods.today.estimatedCommission.EUR > 0);
});

test('unit helpers: maskEmail, maskPhone, containsCardNumber, escapeCsvCell, and SEO/static guards', () => {
  assert.equal(maskEmail('eren@bosphorly.com'), 'e***n@bosphorly.com');
  assert.equal(maskEmail('ab@bosphorly.com'), 'a***@bosphorly.com');
  assert.equal(maskPhone('+90 555 123 45 67'), '+90 *** ** 67');
  assert.equal(containsCardNumber('Ref BOS-123456'), false);
  assert.equal(containsCardNumber('Kart: 4532-0151-1283-0366'), true);
  assert.equal(escapeCsvCell('=CMD()'), "'=CMD()");

  const robots = readFileSync(new URL('../robots.txt', import.meta.url), 'utf8');
  const sitemap = readFileSync(new URL('../sitemap.xml', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../extranet/index.html', import.meta.url), 'utf8');
  const js = readFileSync(new URL('../extranet/extranet.js', import.meta.url), 'utf8');

  assert.match(robots, /Disallow:\s*\/extranet\//);
  assert.doesNotMatch(sitemap, /extranet/i);
  assert.match(html, /<meta name="robots" content="noindex,nofollow,noarchive">/);
  assert.doesNotMatch(html + js, /ADMIN_TOKEN|ADMIN_OWNER_EMAIL/);
});

test('every view and mutation writes complete extranet_audit records, structured booking_requests update booking_events, deactivated users lose access, and rate limits enforce 429', async () => {
  const env = createTestEnv();
  const owner = await createExtranetActor(env, 'owner@test.example', 'owner');
  const staff = await createExtranetActor(env, 'staff-audit@test.example', 'staff');

  env.DB.raw.exec(`
    INSERT INTO booking_requests (id, idempotency_key, payload_hash, experience_id, price_id, service_date, guests, total_minor, currency, commission_bps, state)
    VALUES ('bk-audit-1', 'idem-audit-1', 'hash-audit-1', 'bb-sunset', 'price-sunset-eur', '2026-12-22', 2, 12000, 'EUR', 1000, 'requested');
  `);

  // Perform view + mutation sequence
  assert.equal((await callWorker(env, '/v1/extranet/dashboard', { cookie: owner.cookie, ip: '198.51.100.7' })).status, 200);
  assert.equal((await callWorker(env, '/v1/extranet/providers', { cookie: owner.cookie, ip: '198.51.100.7' })).status, 200);
  assert.equal((await callWorker(env, '/v1/extranet/bookings', { cookie: owner.cookie, ip: '198.51.100.7' })).status, 200);
  assert.equal((await callWorker(env, '/v1/extranet/bookings/bk:bk-audit-1', { cookie: owner.cookie, ip: '198.51.100.7' })).status, 200);
  assert.equal(
    (
      await callWorker(env, '/v1/extranet/bookings/bk:bk-audit-1/status', {
        method: 'POST',
        cookie: owner.cookie,
        csrf: owner.csrf,
        ip: '198.51.100.7',
        body: { toStatus: 'in_progress' },
      })
    ).status,
    200
  );
  assert.equal(
    (
      await callWorker(env, '/v1/extranet/bookings/bk:bk-audit-1/status', {
        method: 'POST',
        cookie: owner.cookie,
        csrf: owner.csrf,
        ip: '198.51.100.7',
        body: { toStatus: 'confirmed' },
      })
    ).status,
    200
  );
  assert.equal(
    (
      await callWorker(env, '/v1/extranet/bookings/bk:bk-audit-1/status', {
        method: 'POST',
        cookie: owner.cookie,
        csrf: owner.csrf,
        ip: '198.51.100.7',
        body: { toStatus: 'completed' },
      })
    ).status,
    200
  );

  // Verify booking_requests state reached 'fulfilled' and booking_events has 3 linked rows
  const bkRow = env.DB.raw.prepare(`SELECT state FROM booking_requests WHERE id = 'bk-audit-1'`).get();
  assert.equal(bkRow.state, 'fulfilled');
  const bkEvents = env.DB.raw.prepare(`SELECT * FROM booking_events WHERE booking_id = 'bk-audit-1'`).all();
  assert.equal(bkEvents.length, 3);

  // Verify extranet_audit captured who, action, target, old/new values, IP, and timestamp
  const actions = env.DB.raw
    .prepare(`SELECT action, ip_address, old_value, new_value, created_at FROM extranet_audit WHERE actor_member_id = ?`)
    .all(owner.memberId);
  const actionSet = new Set(actions.map((a) => a.action));
  for (const expected of ['view_dashboard', 'list_providers', 'list_bookings', 'view_booking', 'update_booking_status']) {
    assert.ok(actionSet.has(expected), `Missing audit action: ${expected}`);
  }
  assert.ok(actions.every((a) => a.ip_address === '198.51.100.7' && a.created_at));

  // Deactivating a staff user immediately invalidates their active session
  env.DB.raw.prepare(`UPDATE extranet_users SET active = 0 WHERE member_id = ?`).run(staff.memberId);
  const deactRes = await callWorker(env, '/v1/extranet/dashboard', { cookie: staff.cookie });
  assert.equal(deactRes.status, 403);

  // Managed Cloudflare RATE_LIMITER failure fails closed with 429
  const envLimited = { ...env, RATE_LIMITER: { limit: async () => ({ success: false }) } };
  assert.equal((await callWorker(envLimited, '/v1/extranet/dashboard', { cookie: owner.cookie })).status, 429);

  // Logout deletes session and logs audit
  const outRes = await callWorker(env, '/v1/extranet/logout', {
    method: 'POST',
    cookie: owner.cookie,
    csrf: owner.csrf,
  });
  assert.equal(outRes.status, 200);
  assert.equal((await callWorker(env, '/v1/extranet/session', { cookie: owner.cookie })).status, 401);
});
