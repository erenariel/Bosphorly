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
  computePeriodBoundaries,
  containsCardNumber,
  escapeCsvCell,
  handleExtranetRoutes,
  maskEmail,
  maskPhone,
} from '../backend/extranet.js';

const MIGRATIONS_DIR = new URL('../backend/migrations/', import.meta.url).pathname;
const ORIGIN = 'https://example.com';

async function buildWebAuthnRegistrationResponse({ challenge, origin = ORIGIN, rpID = 'example.com' }) {
  const { publicKey } = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', publicKey);
  const x = Buffer.from(jwk.x, 'base64url');
  const y = Buffer.from(jwk.y, 'base64url');

  // COSE_Key EC2 ES256: { 1: 2, 3: -7, -1: 1, -2: x(32), -3: y(32) }
  const coseKey = Buffer.concat([
    Buffer.from([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20]),
    x,
    Buffer.from([0x22, 0x58, 0x20]),
    y,
  ]);

  const rpIdHash = crypto.createHash('sha256').update(rpID).digest();
  const flags = Buffer.from([0x45]); // UP (0x01) | UV (0x04) | AT (0x40)
  const signCount = Buffer.alloc(4, 0);
  const aaguid = Buffer.alloc(16, 0);
  const credentialId = crypto.randomBytes(16);
  const credIdLen = Buffer.from([0x00, credentialId.length]);

  const authData = Buffer.concat([rpIdHash, flags, signCount, aaguid, credIdLen, credentialId, coseKey]);
  // CBOR map(3): { "fmt": "none", "attStmt": {}, "authData": bstr(authData) }
  const attestationObject = Buffer.concat([
    Buffer.from([0xa3, 0x63]),
    Buffer.from('fmt'),
    Buffer.from([0x64]),
    Buffer.from('none'),
    Buffer.from([0x67]),
    Buffer.from('attStmt'),
    Buffer.from([0xa0, 0x68]),
    Buffer.from('authData'),
    Buffer.from([0x58, authData.length]),
    authData,
  ]);

  const clientDataJSON = Buffer.from(
    JSON.stringify({ type: 'webauthn.create', challenge, origin, crossOrigin: false })
  ).toString('base64url');
  const credIdB64 = credentialId.toString('base64url');

  return {
    id: credIdB64,
    rawId: credIdB64,
    type: 'public-key',
    response: {
      clientDataJSON,
      attestationObject: attestationObject.toString('base64url'),
      transports: ['internal'],
    },
    clientExtensionResults: {},
  };
}

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
    body: { email, code: s.body.devCode, lang: 'tr', extranet:true, ...extra },
  });
  assert.equal(v.status, 200);
  const memberRow = env.DB.raw.prepare(`SELECT * FROM members WHERE email = ?`).get(email.toLowerCase());
  return { token: v.body.token, ticket:v.body.extranetTicket, member: v.body.member, id: memberRow.id };
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
    ['POST', '/v1/extranet/passkeys/add/options'],
    ['POST', '/v1/extranet/passkeys/add/verify'],
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

test('ADMIN_OWNER_EMAIL bootstraps initial owner, supports optional Passkeys and retains cookie sessions without a Passkey', async () => {
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

  // 2. Owner with 0 passkeys can request initial passkey registration options
  const opts = await callWorker(env, '/v1/extranet/passkey/register/options', {
    method: 'POST',
    body: {ticket:ownerMember.ticket},
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

  // 4. Member Bearer token cannot delete an Extranet account's passkey via /v1/passkeys/delete (403);
  //    and if all passkeys are ever removed from DB directly, the Extranet session is immediately terminated.
  const actor = await createExtranetActor(env, 'admin-pk@example.com', 'admin');
  assert.equal((await callWorker(env, '/v1/extranet/dashboard', { cookie: actor.cookie })).status, 200);

  const delPkBearer = await callWorker(env, '/v1/passkeys/delete', {
    method: 'POST',
    body: { id: `pk-${actor.memberId}` },
    bearer: actor.memberBearer,
  });
  assert.equal(delPkBearer.status, 403, 'Extranet passkeys cannot be deleted with only a member bearer token');

  env.DB.raw.prepare(`DELETE FROM passkeys WHERE member_id = ?`).run(actor.memberId);
  const afterDel = await callWorker(env, '/v1/extranet/dashboard', { cookie: actor.cookie });
  assert.equal(afterDel.status, 200);
  assert.match(afterDel.headers.get('Set-Cookie') || '', /Max-Age=1800/);
});

test("passkey'i olan üye, sadece bearer token ile yeni passkey kaydedemez; yeni passkey yalnızca geçerli extranet oturumu + CSRF ile eklenir ve ADMIN_OWNER_EMAIL'e bildirilir", async (t) => {
  const sentEmails = [];
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const urlStr = typeof input === 'string' ? input : input.url;
    if (urlStr === 'https://api.resend.com/emails') {
      sentEmails.push({
        headers: Object.fromEntries(new Headers(init?.headers).entries()),
        body: JSON.parse(init?.body || '{}'),
      });
      return new Response(JSON.stringify({ id: `mail-${sentEmails.length}` }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return origFetch(input, init);
  };
  t.after(() => {
    globalThis.fetch = origFetch;
  });

  const env = createTestEnv({
    ADMIN_OWNER_EMAIL: 'owner-alert@test.example',
    RESEND_API_KEY: 're_test_extranet_notify',
  });

  // 1. Provision an Extranet admin who initially has 0 passkeys (only email-code member session exists; RESEND disabled during signup code)
  const signupEnv = { ...env, RESEND_API_KEY: '' };
  const adminUser = await signUpMember(signupEnv, 'sec-admin@test.example', { name: 'Güvenlik Admin' });
  env.DB.raw
    .prepare(`INSERT INTO extranet_users (member_id, role, active) VALUES (?, 'admin', 1)`)
    .run(adminUser.id);

  // Pre-mint a second registration challenge while 0 passkeys exist to also test race/replay defense on /register/verify
  const preRaceOpts = await callWorker(env, '/v1/extranet/passkey/register/options', {
    method: 'POST',
    body: {ticket:adminUser.ticket},
    bearer: adminUser.token,
  });
  assert.equal(preRaceOpts.status, 200);

  // Initial enrollment with 0 passkeys succeeds via /v1/extranet/passkey/register/options + /verify
  const initOpts = await callWorker(env, '/v1/extranet/passkey/register/options', {
    method: 'POST',
    body: {ticket:adminUser.ticket},
    bearer: adminUser.token,
  });
  assert.equal(initOpts.status, 200);

  const initAttestation = await buildWebAuthnRegistrationResponse({
    challenge: initOpts.body.challenge,
    origin: ORIGIN,
    rpID: 'example.com',
  });
  const initVerify = await callWorker(env, '/v1/extranet/passkey/register/verify', {
    method: 'POST',
    body: {...initAttestation,ticket:adminUser.ticket},
    bearer: adminUser.token,
    ip: '198.51.100.44',
  });
  assert.equal(initVerify.status, 200);
  assert.equal(initVerify.body.authenticated, true);
  assert.ok(initVerify.body.csrfToken);

  const setCookieHeader = initVerify.headers.get('Set-Cookie') || '';
  const sessionCookie = setCookieHeader.split(';')[0];
  assert.match(sessionCookie, /^__Host-bosphorly_extranet=/);

  // Verify ADMIN_OWNER_EMAIL received notification email and extranet_audit logged initial passkey registration
  assert.equal(sentEmails.length, 1);
  assert.deepEqual(sentEmails[0].body.to, ['owner-alert@test.example']);
  assert.match(sentEmails[0].body.subject, /Yeni Passkey Kaydedildi/);
  assert.match(sentEmails[0].body.text, /sec-admin@test\.example/);

  const firstAudit = env.DB.raw
    .prepare(`SELECT * FROM extranet_audit WHERE actor_member_id = ? AND action = 'passkey_register'`)
    .all(adminUser.id);
  assert.equal(firstAudit.length, 1);
  assert.equal(JSON.parse(firstAudit[0].new_value).flow, 'initial_enroll');
  assert.equal(JSON.parse(firstAudit[0].new_value).ownerNotified, true);

  // 2. CRITICAL SECURITY CHECK: User now has 1 passkey.
  //    An attacker holding ONLY the member Bearer token CANNOT register a new passkey anywhere!
  const bearerOptsBlocked = await callWorker(env, '/v1/extranet/passkey/register/options', {
    method: 'POST',
    body: {},
    bearer: adminUser.token,
  });
  assert.equal(bearerOptsBlocked.status, 403);
  assert.equal(bearerOptsBlocked.body.code, 'PASSKEY_ALREADY_EXISTS');

  const raceAttestation = await buildWebAuthnRegistrationResponse({
    challenge: preRaceOpts.body.challenge,
    origin: ORIGIN,
    rpID: 'example.com',
  });
  const bearerVerifyBlocked = await callWorker(env, '/v1/extranet/passkey/register/verify', {
    method: 'POST',
    body: raceAttestation,
    bearer: adminUser.token,
  });
  assert.equal(bearerVerifyBlocked.status, 403);
  assert.equal(bearerVerifyBlocked.body.code, 'PASSKEY_ALREADY_EXISTS');

  // Public member passkey endpoints ALSO block Extranet accounts with 403
  const publicMemberRegOpts = await callWorker(env, '/v1/passkeys/register/options', {
    method: 'POST',
    body: {},
    bearer: adminUser.token,
  });
  assert.equal(publicMemberRegOpts.status, 403);

  const publicMemberRegVerify = await callWorker(env, '/v1/passkeys/register/verify', {
    method: 'POST',
    body: raceAttestation,
    bearer: adminUser.token,
  });
  assert.equal(publicMemberRegVerify.status, 403);

  // Calling the separate /v1/extranet/passkeys/add/* endpoint with ONLY Bearer token (no Extranet session cookie) returns 401
  const addWithBearerOnly = await callWorker(env, '/v1/extranet/passkeys/add/options', {
    method: 'POST',
    body: {},
    bearer: adminUser.token,
  });
  assert.equal(addWithBearerOnly.status, 401);

  // Calling /v1/extranet/passkeys/add/options with Extranet session cookie but missing CSRF returns 403
  const addWithoutCsrf = await callWorker(env, '/v1/extranet/passkeys/add/options', {
    method: 'POST',
    body: {},
    cookie: sessionCookie,
  });
  assert.equal(addWithoutCsrf.status, 403);
  assert.equal(addWithoutCsrf.body.code, 'CSRF_INVALID');

  // Confirm still only 1 passkey in DB after all attack attempts
  assert.equal(
    env.DB.raw.prepare(`SELECT COUNT(*) AS n FROM passkeys WHERE member_id = ?`).get(adminUser.id).n,
    1
  );

  // 3. Adding a second passkey succeeds ONLY via valid Extranet session cookie + valid X-CSRF-Token
  const addOpts = await callWorker(env, '/v1/extranet/passkeys/add/options', {
    method: 'POST',
    body: {},
    cookie: sessionCookie,
    csrf: initVerify.body.csrfToken,
  });
  assert.equal(addOpts.status, 200);
  assert.equal(addOpts.body.excludeCredentials.length, 1);
  assert.equal(addOpts.body.excludeCredentials[0].id, initAttestation.id);

  const secondAttestation = await buildWebAuthnRegistrationResponse({
    challenge: addOpts.body.challenge,
    origin: ORIGIN,
    rpID: 'example.com',
  });
  const addVerify = await callWorker(env, '/v1/extranet/passkeys/add/verify', {
    method: 'POST',
    body: secondAttestation,
    cookie: sessionCookie,
    csrf: initVerify.body.csrfToken,
    ip: '198.51.100.45',
  });
  assert.equal(addVerify.status, 200);
  assert.equal(addVerify.body.verified, true);
  assert.equal(addVerify.body.ownerNotified, true);

  assert.equal(
    env.DB.raw.prepare(`SELECT COUNT(*) AS n FROM passkeys WHERE member_id = ?`).get(adminUser.id).n,
    2
  );
  assert.equal(sentEmails.length, 2);
  assert.match(sentEmails[1].body.text, /Ek Passkey Kaydı/);

  const allPkAudits = env.DB.raw
    .prepare(`SELECT * FROM extranet_audit WHERE actor_member_id = ? AND action = 'passkey_register' ORDER BY rowid ASC`)
    .all(adminUser.id);
  assert.equal(allPkAudits.length, 2);
  assert.equal(JSON.parse(allPkAudits[0].new_value).flow, 'initial_enroll');
  assert.equal(JSON.parse(allPkAudits[1].new_value).flow, 'extranet_session_add');
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

test('dashboard periods use Europe/Istanbul timezone, commission shows coupon-deducted net + gross, and CORS supports api.bosphorly.com origins', async () => {
  const baseEnv = createTestEnv();
  const env = { ...baseEnv, PUBLIC_ORIGIN: 'https://bosphorly.com' };
  // 2026-11-24 21:30:00 UTC === 2026-11-25 00:30:00 Europe/Istanbul (Wednesday)
  const istanbulAfterMidnightUtcMs = Date.UTC(2026, 10, 24, 21, 30, 0);

  const bounds = computePeriodBoundaries(istanbulAfterMidnightUtcMs);
  assert.equal(bounds.timezone, 'Europe/Istanbul');
  assert.equal(bounds.localDate, '2026-11-25');
  assert.equal(bounds.todayStart, '2026-11-24 21:00:00'); // 2026-11-25 00:00:00+03:00 in UTC
  assert.equal(bounds.weekStart, '2026-11-22 21:00:00');  // Monday 2026-11-23 00:00:00+03:00 in UTC
  assert.equal(bounds.monthStart, '2026-10-31 21:00:00'); // 2026-11-01 00:00:00+03:00 in UTC

  const owner = await createExtranetActor(baseEnv, 'owner@test.example', 'owner', istanbulAfterMidnightUtcMs);
  const member = await signUpMember(baseEnv, 'netgross@guest.example', { name: 'Net Brüt Test' });

  // Welcome coupon: 3% (300 bps) funded from Bosphorly's 10% (1000 bps) commission on €120:
  // Gross commission = €12.00 (1200 minor), Coupon = €3.60 (360 minor) -> Net commission = €8.40 (840 minor)
  const cpRow = env.DB.raw.prepare(`SELECT id, percent_bps FROM coupons WHERE member_id = ? LIMIT 1`).get(member.id);
  assert.equal(cpRow.percent_bps, 300);
  env.DB.raw.exec(`
    UPDATE coupons SET status = 'redeemed', redeemed_at = '2026-11-24 21:15:00', held_ref = 'BOS-IST-TODAY' WHERE id = '${cpRow.id}';

    INSERT INTO member_requests (ref, member_id, service_id, service_date, guests, coupon_id, state, total_text, created_at)
    VALUES
      ('BOS-IST-TODAY', '${member.id}', 'bb-sunset', '2026-12-10', 2, '${cpRow.id}', 'fulfilled', '€120', '2026-11-24 21:15:00'),
      ('BOS-IST-YESTERDAY', '${member.id}', 'ist-transfer', '2026-12-11', 2, NULL, 'fulfilled', '€60', '2026-11-24 20:45:00');
  `);

  const dashReq = new Request('https://api.bosphorly.com/v1/extranet/dashboard', {
    method: 'GET',
    headers: {
      Origin: 'https://bosphorly.com',
      Cookie: owner.cookie,
      'CF-Connecting-IP': '203.0.113.55',
    },
  });
  const dashRes = await handleExtranetRoutes(dashReq, env, new URL(dashReq.url), istanbulAfterMidnightUtcMs);
  assert.equal(dashRes.status, 200);
  const dash = await dashRes.json();

  assert.equal(dash.timezone, 'Europe/Istanbul');
  assert.equal(dash.localDate, '2026-11-25');
  // Only BOS-IST-TODAY (00:15 Istanbul) falls in 'today'; BOS-IST-YESTERDAY (23:45 prev day Istanbul) falls in 'week' & 'month'
  assert.equal(dash.periods.today.newRequests, 1);
  assert.equal(dash.periods.today.confirmed, 1);
  assert.equal(dash.periods.today.estimatedCommission.EUR, 840);  // Net after 3% coupon deduction (€8.40)
  assert.equal(dash.periods.today.grossCommission.EUR, 1200);     // Gross before coupon (€12.00)

  assert.equal(dash.periods.week.newRequests, 2);
  assert.equal(dash.periods.week.estimatedCommission.EUR, 1440);  // 840 + 600
  assert.equal(dash.periods.week.grossCommission.EUR, 1800);      // 1200 + 600

  // CORS verification for both https://bosphorly.com and https://www.bosphorly.com on api.bosphorly.com
  env.OWNER_EMAILS='owner2@test.example';
  const liveOwner = await createExtranetActor(baseEnv, 'owner2@test.example', 'owner');
  for (const allowedOrig of ['https://bosphorly.com', 'https://www.bosphorly.com']) {
    const preflight = await worker.fetch(
      new Request('https://api.bosphorly.com/v1/extranet/session', {
        method: 'OPTIONS',
        headers: { Origin: allowedOrig },
      }),
      env
    );
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), allowedOrig);
    assert.equal(preflight.headers.get('Access-Control-Allow-Credentials'), 'true');

    const sess = await worker.fetch(
      new Request('https://api.bosphorly.com/v1/extranet/session', {
        method: 'GET',
        headers: { Origin: allowedOrig, Cookie: liveOwner.cookie, 'CF-Connecting-IP': '203.0.113.56' },
      }),
      env
    );
    assert.equal(sess.status, 200);
    assert.equal(sess.headers.get('Access-Control-Allow-Origin'), allowedOrig);
    assert.equal(sess.headers.get('Access-Control-Allow-Credentials'), 'true');
  }
});

test('members: manual override and automatic return propagate to profile, chat and reservations, with RBAC/CSRF/audit', async () => {
  const {memberTierById,resolveMemberAuth}=await import('../backend/mimo.js');
  const env=createTestEnv();
  const owner=await createExtranetActor(env,'owner@test.example','owner');
  const staff=await createExtranetActor(env,'staff@test.example','staff');
  const guest=await signUpMember(env,'guest@member.example',{name:'Guest Member'});
  const path=`/v1/extranet/members/${guest.id}/tier`;
  const change=(tier,actor=owner,reason='Özel misafir ataması')=>callWorker(env,path,{method:'POST',cookie:actor.cookie,csrf:actor.csrf,body:{tier,reason}});
  assert.equal((await callWorker(env,'/v1/extranet/members')).status,401);
  const list=await callWorker(env,'/v1/extranet/members?q=Guest',{cookie:staff.cookie});
  assert.equal(list.status,200);assert.equal(list.body.members.length,1);assert.notEqual(list.body.members[0].email,'guest@member.example');
  assert.equal((await change('platinum',staff)).status,403);
  assert.equal((await callWorker(env,path,{method:'POST',cookie:owner.cookie,body:{tier:'platinum',reason:'Test reason'}})).status,403);
  assert.equal((await change('owner')).status,400);
  assert.equal((await change('gold',owner,'4111 1111 1111 1111')).status,400);
  assert.equal((await change('platinum')).body.tier,'platinum');
  assert.equal(await memberTierById(env,guest.id),'platinum');
  assert.equal((await resolveMemberAuth(env,guest.token)).tier,'platinum');
  let me=await callWorker(env,'/v1/me',{bearer:guest.token});
  assert.equal(me.body.tier,'platinum');assert.equal(me.body.automaticTier,'silver');assert.equal(me.body.tierSource,'manual');
  assert.equal(me.body.nextTier,null);
  for(let i=0;i<2;i++) env.DB.raw.prepare("INSERT INTO member_requests(ref,member_id,service_id,service_date,guests,state) VALUES(?,?,'bb-sunset','2026-12-01',2,'fulfilled')").run('manual-test-'+i,guest.id);
  assert.equal(await memberTierById(env,guest.id),'platinum','new tours cannot overwrite manual setting');
  const bookings=await callWorker(env,'/v1/extranet/bookings',{cookie:owner.cookie});
  assert.equal(bookings.status,200);assert.ok(JSON.stringify(bookings.body).includes('platinum'));
  const restored=await change('automatic');assert.equal(restored.body.tier,'gold');assert.equal(restored.body.tierSource,'automatic');
  me=await callWorker(env,'/v1/me',{bearer:guest.token});assert.equal(me.body.tier,'gold');assert.equal(await memberTierById(env,guest.id),'gold');
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS n FROM member_requests WHERE member_id=? AND state='fulfilled'").get(guest.id).n,2);
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS n FROM extranet_audit WHERE action='set_member_tier' AND target_id=?").get(guest.id).n,2);
  const protectedOwner=await callWorker(env,`/v1/extranet/members/${owner.memberId}/tier`,{method:'POST',cookie:owner.cookie,csrf:owner.csrf,body:{tier:'silver',reason:'Test reason'}});
  assert.equal(protectedOwner.status,403);
  const wildcard=await callWorker(env,'/v1/extranet/members?q=%25',{cookie:owner.cookie});assert.equal(wildcard.status,200);assert.equal(wildcard.body.total,0);
});

test('tier update rolls back when its audit record cannot be written', async()=>{
  const env=createTestEnv();const owner=await createExtranetActor(env,'owner@test.example','owner');
  const guest=await signUpMember(env,'rollback@test.example');
  env.DB.raw.exec("CREATE TRIGGER reject_tier_audit BEFORE INSERT ON extranet_audit WHEN NEW.action='set_member_tier' BEGIN SELECT RAISE(ABORT,'audit unavailable'); END");
  const result=await callWorker(env,`/v1/extranet/members/${guest.id}/tier`,{method:'POST',cookie:owner.cookie,csrf:owner.csrf,body:{tier:'platinum',reason:'Test atomic change'}});
  assert.notEqual(result.status,200);assert.equal(env.DB.raw.prepare('SELECT * FROM member_tier_overrides WHERE member_id=?').get(guest.id),undefined);
});

test('Stage 2: staff management forbidden; admin cannot affect owner; timed levels restore and bulk skips owner',async()=>{
 const {membershipTier}=await import('../backend/membership-tier.js');
 const env=createTestEnv(),owner=await createExtranetActor(env,'owner@test.example','owner'),admin=await createExtranetActor(env,'admin@test.example','admin'),staff=await createExtranetActor(env,'staff@test.example','staff'),guest=await signUpMember(env,'stage2@test.example');
 const post=(path,body,actor=admin)=>callWorker(env,path,{method:'POST',body,cookie:actor.cookie,csrf:actor.csrf});
 const base='/v1/extranet/members/'+guest.id;
 for(const [operation,body] of [['tier',{tier:'gold',reason:'Test change'}],['coupon',{percentBps:500,validDays:30,reason:'Test coupon'}],['controls',{suspended:true,reason:'Test suspend'}]]) assert.equal((await post(base+'/'+operation,body,staff)).status,403);
 const profile=await callWorker(env,base,{cookie:staff.cookie});assert.equal(profile.status,200);assert.equal(profile.body.history,undefined);assert.equal(profile.body.levels,undefined);assert.equal(profile.body.controls,undefined);
 for(const [operation,body] of [['tier',{tier:'silver',reason:'Test change'}],['controls',{suspended:true,reason:'Test suspend'}]])assert.equal((await post('/v1/extranet/members/'+owner.memberId+'/'+operation,body)).status,403);
 assert.equal((await post(base+'/tier',{tier:'gold',reason:'Persistent grant'})).status,200);
 assert.equal((await post(base+'/tier',{tier:'platinum',days:30,reason:'Temporary grant'})).status,200);
 assert.equal((await membershipTier(env,guest.id,0)).tier,'platinum');assert.equal((await membershipTier(env,guest.id,0,Date.now()+31*86400000)).tier,'gold');
 env.DB.raw.prepare("UPDATE member_tier_overrides SET expires_at='2000-01-01 00:00:00' WHERE member_id=?").run(guest.id);assert.equal((await callWorker(env,'/v1/me',{bearer:guest.token})).body.tier,'gold');
 const bulk=await post('/v1/extranet/members/tier-bulk-preview',{ids:[owner.memberId,guest.id],tier:'silver',reason:'Bulk change'});assert.equal(bulk.status,200);assert.equal(bulk.body.preview.count,1);assert.equal(bulk.body.preview.skipped,1);
 const confirm='/v1/extranet/actions/'+bulk.body.confirmationId+'/confirm';assert.equal((await post(confirm,{confirm:true},staff)).status,409);assert.equal((await post(confirm,{confirm:true})).body.updated,1);assert.equal((await post(confirm,{confirm:true})).status,409);
 assert.equal((await membershipTier(env,guest.id,0)).tier,'silver');
 assert.equal((await post(base+'/controls',{suspended:true,reason:'Abuse review'})).status,200);
 assert.equal((await callWorker(env,'/v1/me',{bearer:guest.token})).status,401);
 const start=await callWorker(env,'/v1/auth/start',{method:'POST',body:{email:'stage2@test.example'}});
 const login=await callWorker(env,'/v1/auth/verify',{method:'POST',body:{email:'stage2@test.example',code:start.body.devCode}});assert.equal(login.status,403);
 assert.equal((await post(base+'/controls',{suspended:false,automaticDisabled:true,mimoDailyLimit:2,reason:'Restore account'})).status,200);
 const frozen=(await membershipTier(env,guest.id,8)).tier;assert.equal(frozen,'silver');
 assert.equal((await post(base+'/tier',{tier:'automatic',reason:'Automatic restore'})).body.tier,'silver');
 assert.equal((await post(base+'/coupon',{percentBps:500,validDays:30,reason:'Goodwill gesture'})).status,200);
 assert.equal((await post(base+'/delete-preview',{reason:'Privacy request'})).status,403);
 const deletion=await post(base+'/delete-preview',{reason:'Privacy request'},owner);assert.equal(deletion.status,200);
 const deleted=await post('/v1/extranet/actions/'+deletion.body.confirmationId+'/confirm',{confirm:true},owner);assert.equal(deleted.status,200);assert.equal(env.DB.raw.prepare('SELECT id FROM members WHERE id=?').get(guest.id),undefined);
});

test('Stage 2 inbox: no normal chats, card redaction, reply previews, staff send, actor binding and audit',async()=>{
 const {captureMessage,cleanupInbox}=await import('../backend/message-store.js');
 const env=createTestEnv({RESEND_API_KEY:'test',REQUEST_FROM_EMAIL:'test@example.com'});
 // Avoid changing signup to provider-only mode while provisioning test actors.
 delete env.RESEND_API_KEY;
 const staff=await createExtranetActor(env,'inbox@test.example','staff');env.RESEND_API_KEY='test';
 const post=(path,body)=>callWorker(env,path,{method:'POST',body,cookie:staff.cookie,csrf:staff.csrf});
 env.DB.raw.prepare("INSERT INTO telegram_handoff_state(chat_id,context_json) VALUES('normal-chat','[\"PRIVATE NORMAL CHAT\"]')").run();
 const form=await captureMessage(env,{source:'form',reference:'FORM-TEST',name:'Guest',email:'guest@test.example',subject:'Transfer',body:'Card 4111 1111 1111 1111 email visitor@private.example tel +905551234567'});
 await assert.rejects(()=>captureMessage(env,{source:'normal',body:'normal chat'}));
 const list=await callWorker(env,'/v1/extranet/messages',{cookie:staff.cookie});assert.equal(list.status,200);assert.equal(list.body.messages.length,1);assert.ok(!JSON.stringify(list.body).includes('PRIVATE NORMAL CHAT'));
 const detail=await callWorker(env,'/v1/extranet/messages/'+form,{cookie:staff.cookie});assert.ok(detail.body.body.includes('[CARD REDACTED]'));assert.ok(!detail.body.body.includes('visitor@private.example'));assert.ok(!detail.body.body.includes('+905551234567'));assert.ok(!JSON.stringify(detail.body).includes('PRIVATE NORMAL CHAT'));
 assert.equal((await callWorker(env,'/v1/extranet/messages/normal-chat',{cookie:staff.cookie})).status,404);
 assert.equal((await post('/v1/extranet/messages/'+form+'/note',{body:'Internal note'})).status,200);
 assert.equal((await post('/v1/extranet/messages/'+form+'/status',{status:'read'})).status,200);
 const preview=await post('/v1/extranet/messages/'+form+'/reply-preview',{lang:'ru'});assert.equal(preview.status,200);
 let calls=0;const original=globalThis.fetch;globalThis.fetch=async(url,options)=>{calls++;const b=JSON.parse(options.body);assert.deepEqual(b.to,['guest@test.example']);assert.ok(b.text.includes('Здравствуйте'));return Response.json({id:'mail-1'});};
 try {
 const confirm='/v1/extranet/actions/'+preview.body.confirmationId+'/confirm';assert.equal((await post(confirm,{confirm:false})).status,400);assert.equal(calls,0);
 assert.equal((await post(confirm,{confirm:true})).status,200);assert.equal(calls,1);assert.equal((await post(confirm,{confirm:true})).status,409);assert.equal(calls,1);
 }finally{globalThis.fetch=original;}
 const record=env.DB.raw.prepare('SELECT status FROM extranet_messages WHERE id=?').get(form);assert.equal(record.status,'replied');assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS n FROM extranet_audit WHERE action='send_email'").get().n,1);
 await cleanupInbox(env,Date.now()+25*31*86400000);assert.equal(env.DB.raw.prepare('SELECT * FROM extranet_messages WHERE id=?').get(form),undefined);
 assert.equal(env.DB.raw.prepare("SELECT context_json FROM telegram_handoff_state WHERE chat_id='normal-chat'").get().context_json,'["PRIVATE NORMAL CHAT"]');
});

test('Stage 2 form requests preserve mail delivery and store only card-redacted inquiry; no ordinary model chat is captured',async()=>{
 const {runAssistant}=await import('../backend/assistant.js');
 const env=createTestEnv({ENABLE_EMAIL_REQUESTS:'true',RESEND_API_KEY:'test',REQUEST_FROM_EMAIL:'test@example.com',TURNSTILE_SECRET:'test'});
 const original=globalThis.fetch;let sent=0;
 globalThis.fetch=async(url)=>{if(String(url).includes('siteverify'))return Response.json({success:true});sent++;return Response.json({id:'provider-test'});};
 try {
 const payload={reference:'FORM-DB-TEST',kind:'transfer',name:'Guest',phone:'+905555551234',email:'visitor@test.example',service:'Airport',date:'2027-01-01',guests:2,message:'PAN 4111111111111111',consent:true,turnstileToken:'test'};
 const res=await callWorker(env,'/v1/requests',{method:'POST',body:payload});assert.equal(res.status,202);assert.equal(sent,1);
 const stored=env.DB.raw.prepare('SELECT body FROM extranet_messages WHERE reference=?').get(payload.reference);assert.ok(stored.body.includes('[CARD REDACTED]'));assert.ok(!stored.body.includes('4111111111111111'));
 }finally{globalThis.fetch=original;}
 env.AI={run:async()=>({response:'İstanbul turu için yardımcı olabilirim. [[flags:abuse=0;handoff=0]]'})};
 const before=env.DB.raw.prepare('SELECT COUNT(*) AS n FROM extranet_messages').get().n;
 await runAssistant({env,message:'Boğaz turları hakkında bilgi istiyorum',actorKey:'privacy-ordinary',channel:'web'});
 assert.equal(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM extranet_messages').get().n,before);
});

test('Stage 2 custom Mimo limits apply to members while owner is exempt',async()=>{
 const {checkAndIncrementLimits}=await import('../backend/assistant.js');const env=createTestEnv();const guest=await signUpMember(env,'limit@test.example');
 env.DB.raw.prepare('INSERT INTO member_controls(member_id,mimo_daily_limit) VALUES(?,1)').run(guest.id);
 const request={env,actorKey:'member:'+guest.id,tier:'silver'};
 assert.equal((await checkAndIncrementLimits(request)).allowed,true);assert.equal((await checkAndIncrementLimits(request)).reason,'day_limit');
 env.DB.raw.prepare('UPDATE member_controls SET mimo_daily_limit=0 WHERE member_id=?').run(guest.id);
 assert.equal((await checkAndIncrementLimits({...request,tier:'owner'})).allowed,true);
});

test('configured secondary admin bootstraps after verified member sign-in and never admits an old member token or reactivates a disabled role',async()=>{
 const env=createTestEnv({EXTRANET_ADMIN_EMAILS:'secondary@test.example'});
 const member=await signUpMember(env,'secondary@test.example');
 const status=await callWorker(env,'/v1/extranet/auth/status',{method:'POST',bearer:member.token,body:{}});
 assert.equal(status.status,200);assert.equal(status.body.user.role,'admin');assert.equal(status.body.hasPasskey,false);assert.equal(status.body.step,'setup_passkey');
 assert.equal((await callWorker(env,'/v1/extranet/dashboard',{bearer:member.token})).status,401);
 env.DB.raw.prepare('UPDATE extranet_users SET active=0 WHERE member_id=?').run(member.id);
 assert.equal((await callWorker(env,'/v1/extranet/auth/status',{method:'POST',bearer:member.token,body:{}})).status,403);
});

test('fresh one-use email OTP admits authorized owners without Passkeys; old/member tokens, replay, expired proofs and ordinary users cannot enter',async()=>{
 const {signState}=await import('../backend/members.js');
 const env=createTestEnv();
 async function verified(email){const s=await callWorker(env,'/v1/auth/start',{method:'POST',body:{email,lang:'tr'}});const v=await callWorker(env,'/v1/auth/verify',{method:'POST',body:{email,code:s.body.devCode,extranet:true}});assert.equal(v.status,200);return v.body;}
 const owner=await verified('owner@test.example');const guest=await verified('ordinary@test.example');
 const login=(token,ticket)=>callWorker(env,'/v1/extranet/auth/email',{method:'POST',bearer:token,body:{ticket}});
 assert.equal((await login(owner.token,undefined)).status,401);
 assert.equal((await login(guest.token,owner.extranetTicket)).status,401);
 assert.equal((await login(guest.token,guest.extranetTicket)).status,403);
 const payload=JSON.parse(Buffer.from(owner.extranetTicket.split('.')[0],'base64url').toString());
 const expired=await signState(env.CODE_PEPPER,{...payload,t:Date.now()-6*60000});assert.equal((await login(owner.token,expired)).status,401);
 const authenticated=await login(owner.token,owner.extranetTicket);assert.equal(authenticated.status,200);assert.equal(authenticated.body.authenticated,true);assert.equal(authenticated.body.user.role,'owner');assert.ok(authenticated.body.csrfToken);
 assert.equal(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM passkeys').get().n,0);
 const cookie=authenticated.headers.get('Set-Cookie').split(';')[0];
 assert.equal((await callWorker(env,'/v1/extranet/dashboard',{cookie})).status,200);
 assert.equal((await callWorker(env,'/v1/extranet/logout',{method:'POST',cookie,body:{}})).status,403);
 assert.equal((await login(owner.token,owner.extranetTicket)).status,401);
 assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS n FROM extranet_audit WHERE action='login_email'").get().n,1);
});

test('Stage 0: OWNER_EMAILS owners bootstrap, database owner forgery is denied, partner grants never access staff APIs',async()=>{
 const env=createTestEnv({OWNER_EMAILS:'second-owner@test.example'});
 const owner=await signUpMember(env,'second-owner@test.example');
 const st=await callWorker(env,'/v1/extranet/auth/status',{method:'POST',bearer:owner.token,body:{}});
 assert.equal(st.body.user.role,'owner');
 const forged=await createExtranetActor(env,'forged@test.example','owner');
 assert.equal((await callWorker(env,'/v1/extranet/dashboard',{cookie:forged.cookie})).status,403);
 const partner=await createExtranetActor(env,'partner-account@test.example','partner');
 const session=await callWorker(env,'/v1/extranet/session',{cookie:partner.cookie});assert.equal(session.body.user.role,'partner');assert.match(session.headers.get('X-Robots-Tag'),/noindex/);
 for(const path of ['/dashboard','/bookings','/members','/messages','/providers'])assert.equal((await callWorker(env,'/v1/extranet'+path,{cookie:partner.cookie})).status,403,path);
 assert.equal((await callWorker(env,'/v1/extranet/logout',{method:'POST',cookie:partner.cookie,csrf:partner.csrf,body:{}})).status,200);
});

test('Stage 0: audit is append-only at the SQL layer and preserves old/new values',async()=>{
 const env=createTestEnv();const owner=await createExtranetActor(env,'owner@test.example','owner');
 await callWorker(env,'/v1/extranet/dashboard',{cookie:owner.cookie});
 const before=env.DB.raw.prepare('SELECT COUNT(*) AS n FROM extranet_audit').get().n;
 assert.ok(before>0);assert.throws(()=>env.DB.raw.exec("UPDATE extranet_audit SET action='tampered'"),/append-only/);
 assert.throws(()=>env.DB.raw.exec('DELETE FROM extranet_audit'),/append-only/);
 assert.equal(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM extranet_audit').get().n,before);
});

test('Stage 0: first passkey enrollment rejects bearer-only access and unrecognized endpoints still require authentication',async()=>{
 const env=createTestEnv();const owner=await signUpMember(env,'owner@test.example');
 const denied=await callWorker(env,'/v1/extranet/passkey/register/options',{method:'POST',bearer:owner.token,body:{}});
 assert.equal(denied.status,401);assert.equal(denied.body.code,'FRESH_OTP_REQUIRED');
 assert.equal((await callWorker(env,'/v1/extranet/unknown')).status,401);
});

test('Stage 1: dashboard exposes cohort conversion, tier/language distribution and top requested tours',async()=>{
 const env=createTestEnv();const owner=await createExtranetActor(env,'owner@test.example','owner');const guest=await signUpMember(env,'metrics@test.example');
 env.DB.raw.prepare("INSERT INTO member_requests(ref,member_id,service_id,service_date,guests,state) VALUES('BOS-METRICS',?,'bb-sunset','2027-01-01',2,'fulfilled')").run(guest.id);
 const r=await callWorker(env,'/v1/extranet/dashboard',{cookie:owner.cookie});assert.equal(r.status,200);
 assert.equal(r.body.periods.today.completed,1);assert.equal(r.body.periods.today.conversion.completionRate,1);assert.equal(r.body.tierDistribution.platinum,1);assert.ok(r.body.topTours.some(x=>x.id==='bb-sunset'&&x.count===1));assert.ok(Object.values(r.body.languageDistribution).includes(1));
});

test('Stage 1: booking mail requires auth, CSRF, valid status, actor-bound preview and second confirmation, and retains history',async t=>{
 const env=createTestEnv();const staff=await createExtranetActor(env,'staff-mail@test.example','staff');const other=await createExtranetActor(env,'other-mail@test.example','staff');const guest=await signUpMember({...env,RESEND_API_KEY:''},'guest-mail@test.example');
 env.DB.raw.prepare("INSERT INTO member_requests(ref,member_id,service_id,service_date,guests,state) VALUES('BOS-MAIL',?,'bb-sunset','2027-01-01',2,'requested')").run(guest.id);
 Object.assign(env,{RESEND_API_KEY:'mock',REQUEST_FROM_EMAIL:'test@example.com'});
 const base='/v1/extranet/bookings/mr:BOS-MAIL';const request={method:'POST',cookie:staff.cookie,csrf:staff.csrf,body:{lang:'en',template:'confirmation'}};
 assert.equal((await callWorker(env,base+'/email-preview',{method:'POST',body:{}})).status,401);
 assert.equal((await callWorker(env,base+'/email-preview',{...request,csrf:''})).status,403);
 assert.equal((await callWorker(env,base+'/email-preview',request)).status,409);
 env.DB.raw.exec("INSERT INTO extranet_booking_meta(record_type,record_id,workflow_status) VALUES('member_request','BOS-MAIL','confirmed')");
 const preview=await callWorker(env,base+'/email-preview',request);assert.equal(preview.status,200);assert.ok(!preview.body.preview.to.includes('guest-mail'));
 const confirmation={method:'POST',cookie:staff.cookie,csrf:staff.csrf,body:{confirmationId:preview.body.confirmationId,confirm:true}};
 assert.equal((await callWorker(env,base+'/email-confirm',{...confirmation,cookie:other.cookie,csrf:other.csrf})).status,409);
 let sent=0;t.mock.method(globalThis,'fetch',async(url,init)=>{sent++;const body=JSON.parse(init.body);assert.deepEqual(body.to,['guest-mail@test.example']);assert.match(body.text,/confirmed/);return Response.json({id:'sent'});});
 assert.equal((await callWorker(env,base+'/email-confirm',confirmation)).body.sent,true);
 assert.equal((await callWorker(env,base+'/email-confirm',confirmation)).status,409);assert.equal(sent,1);
 const detail=await callWorker(env,base,{cookie:staff.cookie});assert.equal(detail.body.booking.emailHistory[0].status,'sent');
 assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS n FROM extranet_audit WHERE action='booking_email_result'").get().n,1);
});

test('Stage 2 campaigns: owner approval, immutable issued rates, coupon issue/revoke and staff isolation',async()=>{
 const env=createTestEnv();const owner=await createExtranetActor(env,'owner@test.example','owner'),admin=await createExtranetActor(env,'campaign-admin@test.example','admin'),staff=await createExtranetActor(env,'campaign-staff@test.example','staff'),guest=await signUpMember(env,'campaign-guest@test.example');
 const auth=(a,body)=>({method:'POST',cookie:a.cookie,csrf:a.csrf,body});
 assert.equal((await callWorker(env,'/v1/extranet/campaigns')).status,401);assert.equal((await callWorker(env,'/v1/extranet/campaigns',{cookie:staff.cookie})).status,403);
 const campaigns=await callWorker(env,'/v1/extranet/campaigns',{cookie:admin.cookie});assert.equal(campaigns.status,200);const c=campaigns.body.campaigns.find(x=>x.active&&x.kind!=='hotel');
 const issued=await callWorker(env,'/v1/extranet/campaigns/'+c.id+'/issue',auth(admin,{memberId:guest.id,reason:'Misafir talebi'}));assert.equal(issued.status,200);
 assert.equal((await callWorker(env,'/v1/extranet/campaigns/'+c.id+'/proposal',auth(owner,{percentBps:1001,validDays:45,active:true,reason:'Tavanı aşma'}))).status,400);
 const proposal=await callWorker(env,'/v1/extranet/campaigns/'+c.id+'/proposal',auth(admin,{percentBps:800,validDays:45,active:true,reason:'Sezon kampanyası'}));assert.equal(proposal.status,200);const path='/v1/extranet/campaign-proposals/'+proposal.body.proposalId+'/approve';
 assert.equal((await callWorker(env,path,auth(admin,{confirm:true}))).status,403);assert.equal((await callWorker(env,path,auth(owner,{confirm:true}))).body.approved,true);
 assert.equal(env.DB.raw.prepare('SELECT percent_bps FROM campaigns WHERE id=?').get(c.id).percent_bps,800);
 assert.equal(env.DB.raw.prepare('SELECT percent_bps FROM coupons WHERE id=?').get(issued.body.id).percent_bps,c.percent_bps);
 assert.throws(()=>env.DB.raw.prepare('UPDATE coupons SET percent_bps=1200 WHERE id=?').run(issued.body.id),/immutable/);
 assert.equal((await callWorker(env,path,auth(owner,{confirm:true}))).status,409);
 env.DB.raw.prepare('UPDATE campaigns SET percent_bps=1100 WHERE id=?').run(c.id);
 assert.equal((await callWorker(env,'/v1/extranet/campaigns/'+c.id+'/issue',auth(owner,{memberId:guest.id,reason:'Mevcut tavan testi'}))).status,400);
 assert.equal((await callWorker(env,'/v1/extranet/coupon-management/'+issued.body.id+'/revoke',auth(admin,{reason:'Misafir vazgeçti'}))).body.revoked,true);
});

test('Stage 2 KVKK: export/reveal are audited and unavailable to staff; confirmed deletion removes reservation contacts',async()=>{
 const env=createTestEnv(),owner=await createExtranetActor(env,'owner@test.example','owner'),admin=await createExtranetActor(env,'export-admin@test.example','admin'),staff=await createExtranetActor(env,'export-staff@test.example','staff'),guest=await signUpMember(env,'export-guest@test.example');
 const post=(actor,body)=>({method:'POST',cookie:actor.cookie,csrf:actor.csrf,body});const path='/v1/extranet/members/'+guest.id;
 assert.equal((await callWorker(env,path+'/data-export',post(staff,{reason:'Üye talebi'}))).status,403);
 const exported=await callWorker(env,path+'/data-export',post(admin,{reason:'Üye talebi'}));assert.equal(exported.status,200);assert.equal(exported.body.member.email,'export-guest@test.example');assert.ok(!JSON.stringify(exported.body).includes('token_hash'));
 assert.equal((await callWorker(env,path+'/reveal-pii',post(admin,{field:'email',reason:'Üye iletişimi'}))).body.value,'export-guest@test.example');
 env.DB.raw.prepare("INSERT INTO extranet_booking_meta(record_type,record_id,member_id,guest_email) VALUES('booking','contact-only',?,?)").run(guest.id,'export-guest@test.example');
 const preview=await callWorker(env,path+'/delete-preview',post(owner,{reason:'KVKK üye talebi'}));assert.equal(preview.status,200);assert.match(JSON.stringify(preview.body),/geri alınamaz/);
 const result=await callWorker(env,'/v1/extranet/actions/'+preview.body.confirmationId+'/confirm',post(owner,{confirm:true}));assert.equal(result.body.deleted,true);
 assert.equal(env.DB.raw.prepare("SELECT guest_email FROM extranet_booking_meta WHERE record_id='contact-only'").get().guest_email,null);
 assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS n FROM extranet_audit WHERE action='kvkk_export'").get().n,1);
});

test('Stage 3: partner accounts isolate bookings, complete only assigned tours once, and earn a snapshotted payable commission',async()=>{
 const env=createTestEnv(),owner=await createExtranetActor(env,'owner@test.example','owner'),p1=await createExtranetActor(env,'agency-one@test.example','partner'),p2=await createExtranetActor(env,'agency-two@test.example','partner'),guest=await signUpMember(env,'partner-guest@test.example');
 const post=(actor,body)=>({method:'POST',cookie:actor.cookie,csrf:actor.csrf,body});
 for(const partner of [p1,p2])assert.equal((await callWorker(env,'/v1/extranet/partners',post(owner,{memberId:partner.memberId,providerId:'prov-bosphorus',name:'Tur Firması',commissionBps:1000}))).status,200);
 const coupon=env.DB.raw.prepare("SELECT id FROM coupons WHERE member_id=? AND status='issued' LIMIT 1").get(guest.id);env.DB.raw.prepare("UPDATE coupons SET status='held',held_ref='BOS-PARTNER' WHERE id=?").run(coupon.id);
 env.DB.raw.prepare("INSERT INTO member_requests(ref,member_id,service_id,service_date,guests,coupon_id,state,total_text) VALUES('BOS-PARTNER',?,'bb-sunset','2027-01-01',2,?,'requested','€100')").run(guest.id,coupon.id);
 env.DB.raw.exec("INSERT INTO extranet_booking_meta(record_type,record_id,workflow_status,assigned_provider_id) VALUES('member_request','BOS-PARTNER','confirmed','prov-bosphorus')");
 const assigned=await callWorker(env,'/v1/extranet/partners/assign',post(owner,{memberId:p1.memberId,bookingUid:'mr:BOS-PARTNER'}));assert.equal(assigned.status,200);
 const path='/v1/extranet/partner/bookings/mr:BOS-PARTNER/complete';assert.equal((await callWorker(env,path,post(p2,{confirm:true}))).status,404);
 assert.equal((await callWorker(env,'/v1/extranet/partners/bookings/mr:BOS-PARTNER/paid',post(owner,{reference:'BANK-1',confirm:true}))).status,409);
 const first=await callWorker(env,path,post(p1,{confirm:true}));assert.equal(first.body.completed,true);assert.equal((await callWorker(env,path,post(p1,{confirm:true}))).status,409);
 assert.equal(env.DB.raw.prepare('SELECT stamps FROM members WHERE id=?').get(guest.id).stamps,1);assert.equal(env.DB.raw.prepare('SELECT status FROM coupons WHERE id=?').get(coupon.id).status,'redeemed');
 const own=await callWorker(env,'/v1/extranet/partner/bookings',{cookie:p1.cookie});assert.equal(own.body.bookings.length,1);assert.equal(own.body.bookings[0].amount_minor,1000);assert.equal(own.body.bookings[0].payable,true);assert.ok(!JSON.stringify(own.body).includes('partner-guest@test.example'));
 assert.equal((await callWorker(env,'/v1/extranet/partner/bookings',{cookie:p2.cookie})).body.bookings.length,0);assert.equal((await callWorker(env,'/v1/extranet/bookings',{cookie:p1.cookie})).status,403);
 assert.equal((await callWorker(env,'/v1/extranet/partners/bookings/mr:BOS-PARTNER/paid',post(owner,{reference:'BANK-1',confirm:true}))).body.paid,true);
});

test('Stage 3: handoff priority and channel filters expose only captured conversations; assignment needs active staff and CSRF',async()=>{
 const {captureMessage}=await import('../backend/message-store.js');const env=createTestEnv(),staff=await createExtranetActor(env,'assign-staff@test.example','staff');
 const normal=await captureMessage(env,{source:'form',subject:'Form',body:'Talep'}),handoff=await captureMessage(env,{source:'handoff',channel:'telegram',subject:'Devir',body:'İnsan desteği gerekli'});
 assert.equal((await callWorker(env,'/v1/extranet/message-handoffs')).status,401);
 const priority=await callWorker(env,'/v1/extranet/message-handoffs',{cookie:staff.cookie});assert.deepEqual(priority.body.messages.map(x=>x.id),[handoff]);
 const path='/v1/extranet/messages/'+handoff+'/assignment';assert.equal((await callWorker(env,path,{method:'POST',cookie:staff.cookie,body:{memberId:staff.memberId}})).status,403);
 assert.equal((await callWorker(env,path,{method:'POST',cookie:staff.cookie,csrf:staff.csrf,body:{memberId:staff.memberId}})).status,200);
 const mine=await callWorker(env,'/v1/extranet/messages?channel=telegram&assignedTo=me',{cookie:staff.cookie});assert.deepEqual(mine.body.messages.map(x=>x.id),[handoff]);assert.ok(!mine.body.messages.some(x=>x.id===normal));
});

test('Stage 3: shared partner bearer is disabled by default, existing compatibility requires an explicit switch',async()=>{
 const env=createTestEnv();const response=await callWorker(env,'/v1/partner/lookup',{method:'POST',bearer:env.PARTNER_TOKEN,body:{ref:'BOS-ANY'}});assert.equal(response.status,410);
});
