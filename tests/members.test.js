import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../backend/worker.js';
import { STAMPS_GOAL } from '../backend/members.js';

// A minimal Cloudflare D1 stand-in over real SQLite, so the SQL and constraints run for real.
function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../backend/migrations/0001.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../backend/migrations/0002_members.sql', import.meta.url), 'utf8'));
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...args).changes) } }),
    _run: () => db.prepare(sql).run(...args)
  });
  return {
    raw: db,
    prepare: sql => stmt(sql),
    batch: async list => { db.exec('BEGIN'); try { const r = list.map(s => s._run()); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } }
  };
}

const ORIGIN = 'https://example.com';
function setup() {
  const DB = d1();
  DB.raw.exec(`INSERT INTO hotels VALUES ('hotel-a','verified','EUR',1000,'contract');
               INSERT INTO campaigns (id, kind, percent_bps, valid_days, hotel_id) VALUES ('hotel-a-2026','hotel',500,60,'hotel-a');`);
  return { DB, PUBLIC_ORIGIN: ORIGIN, RATE_LIMITER: { limit: async () => ({ success: true }) }, CODE_PEPPER: 'test-pepper', DEV_RETURN_CODE: '1', PARTNER_TOKEN: 'partner-secret', ADMIN_TOKEN: 'admin-secret' };
}
const call = async (env, path, body, token, method = 'POST') => {
  const headers = { Origin: ORIGIN, ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) };
  const r = await worker.fetch(new Request('https://api.example' + path, { method, headers, body: body ? JSON.stringify(body) : undefined }), env);
  return { status: r.status, body: await r.json(), headers: r.headers };
};
async function signUp(env, email, extra = {}) {
  const s = await call(env, '/v1/auth/start', { email, lang: 'tr' });
  assert.equal(s.status, 200);
  const v = await call(env, '/v1/auth/verify', { email, code: s.body.devCode, ...extra });
  assert.equal(v.status, 200, JSON.stringify(v.body));
  return v.body;
}
const kinds = me => me.coupons.map(c => c.kind).sort();

test('sign-in code: hashed, limited per address, 5 tries, no account probing', async () => {
  const env = setup();
  const s = await call(env, '/v1/auth/start', { email: 'Guest@Example.com' });
  assert.equal(s.status, 200); assert.match(s.body.devCode, /^\d{6}$/);
  const stored = env.DB.raw.prepare('SELECT email, code_hash FROM login_codes').get();
  assert.equal(stored.email, 'guest@example.com'); assert.notEqual(stored.code_hash, s.body.devCode);
  const wrong = s.body.devCode === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i++) assert.equal((await call(env, '/v1/auth/verify', { email: 'guest@example.com', code: wrong })).status, 400);
  assert.equal((await call(env, '/v1/auth/verify', { email: 'guest@example.com', code: s.body.devCode })).status, 429);
  await call(env, '/v1/auth/start', { email: 'guest@example.com' }); await call(env, '/v1/auth/start', { email: 'guest@example.com' });
  assert.equal((await call(env, '/v1/auth/start', { email: 'guest@example.com' })).status, 429);
  assert.equal((await call(env, '/v1/auth/start', { email: 'not-an-email' })).status, 400);
  // Without an e-mail provider and outside development, codes are never returned or silently dropped.
  assert.equal((await call({ ...setup(), DEV_RETURN_CODE: undefined }, '/v1/auth/start', { email: 'a@example.com' })).status, 503);
});

test('new member gets a welcome coupon, and a hotel coupon when they came from a partner hotel', async () => {
  const env = setup();
  const a = await signUp(env, 'a@example.com', { name: 'Ayşe Yılmaz' });
  assert.equal(a.created, true); assert.deepEqual(kinds(a.member), ['welcome']);
  assert.equal(a.member.coupons[0].percentBps, 500); assert.match(a.member.coupons[0].code, /^BOS-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  const b = await signUp(env, 'b@example.com', { hotel: 'hotel-a', marketing: true });
  assert.deepEqual(kinds(b.member), ['hotel', 'welcome']); assert.equal(b.member.marketing, true);
  // Signing in again does not issue more coupons.
  const again = await signUp(env, 'b@example.com');
  assert.equal(again.created, false); assert.equal(again.member.coupons.length, 2);
  // An unknown or unverified hotel gives nothing extra.
  assert.deepEqual(kinds((await signUp(env, 'c@example.com', { hotel: 'nope' })).member), ['welcome']);
});

test('profile needs a valid session; sign-out ends it', async () => {
  const env = setup();
  const { token } = await signUp(env, 'a@example.com');
  assert.equal((await call(env, '/v1/me', null, null, 'GET')).status, 401);
  assert.equal((await call(env, '/v1/me', null, 'forged', 'GET')).status, 401);
  const me = await call(env, '/v1/me', null, token, 'GET');
  assert.equal(me.status, 200); assert.equal(me.body.email, 'a@example.com'); assert.equal(me.body.stampsGoal, STAMPS_GOAL);
  assert.equal(me.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  const upd = await call(env, '/v1/me', { name: 'Ayşe', marketing: true }, token);
  assert.equal(upd.body.name, 'Ayşe'); assert.equal(upd.body.marketing, true);
  await call(env, '/v1/auth/logout', {}, token);
  assert.equal((await call(env, '/v1/me', null, token, 'GET')).status, 401);
});

test('coupon is held by one request, redeemed on fulfilment, released on cancellation', async () => {
  const env = setup();
  const { token, member } = await signUp(env, 'a@example.com', { name: 'Ayşe Yılmaz' });
  const code = member.coupons[0].code;
  const r1 = await call(env, '/v1/me/requests', { ref: 'BOS-AAAA11', serviceId: 'bb-sunset', date: '2099-05-01', guests: 2, couponCode: code }, token);
  assert.equal(r1.status, 200); assert.equal(r1.body.coupon.percentBps, 500);
  // The same coupon cannot be used again, by this or any other member.
  assert.equal((await call(env, '/v1/me/requests', { ref: 'BOS-AAAA12', serviceId: 'bb-sunset', date: '2099-05-02', guests: 2, couponCode: code }, token)).status, 409);
  const other = await signUp(env, 'b@example.com');
  assert.equal((await call(env, '/v1/me/requests', { ref: 'BOS-BBBB11', serviceId: 'bb-sunset', date: '2099-05-02', guests: 2, couponCode: code }, other.token)).status, 409);
  // Partner check-in: authorised only, shows first name and coupon, then cancels and releases it.
  assert.equal((await call(env, '/v1/partner/lookup', { ref: 'BOS-AAAA11' }, 'wrong')).status, 401);
  const look = await call(env, '/v1/partner/lookup', { ref: 'BOS-AAAA11' }, 'partner-secret');
  assert.equal(look.body.firstName, 'Ayşe'); assert.equal(look.body.coupon.status, 'held'); assert.equal(look.body.email, undefined);
  assert.equal((await call(env, '/v1/partner/cancel', { ref: 'BOS-AAAA11' }, 'partner-secret')).body.coupon.status, 'issued');
  assert.equal((await call(env, '/v1/partner/fulfil', { ref: 'BOS-AAAA11' }, 'partner-secret')).status, 409);
  // Released coupon works on a new request and is redeemed when that one is fulfilled.
  await call(env, '/v1/me/requests', { ref: 'BOS-AAAA13', serviceId: 'bb-sunset', date: '2099-05-03', guests: 2, couponCode: code }, token);
  const done = await call(env, '/v1/partner/fulfil', { ref: 'BOS-AAAA13' }, 'partner-secret');
  assert.equal(done.body.coupon.status, 'redeemed'); assert.deepEqual(done.body.issued, ['second_tour']);
  const me = (await call(env, '/v1/me', null, token, 'GET')).body;
  assert.equal(me.stamps, 1); assert.equal(me.coupons.find(c => c.code === code).status, 'redeemed');
  assert.ok(me.coupons.some(c => c.kind === 'second_tour' && c.status === 'issued'));
});

test('referral reward goes to the inviter only after the friend completes a tour, once', async () => {
  const env = setup();
  const inviter = await signUp(env, 'a@example.com');
  const friend = await signUp(env, 'f@example.com', { ref: inviter.member.referralCode.toLowerCase() });
  await call(env, '/v1/me/requests', { ref: 'BOS-FFFF01', serviceId: 'azure-islands', date: '2099-06-01', guests: 1 }, friend.token);
  assert.deepEqual(kinds((await call(env, '/v1/me', null, inviter.token, 'GET')).body), ['welcome']);
  const done = await call(env, '/v1/partner/fulfil', { ref: 'BOS-FFFF01' }, 'partner-secret');
  assert.deepEqual(done.body.issued.sort(), ['referral', 'second_tour']);
  assert.deepEqual(kinds((await call(env, '/v1/me', null, inviter.token, 'GET')).body), ['referral', 'welcome']);
  await call(env, '/v1/me/requests', { ref: 'BOS-FFFF02', serviceId: 'azure-islands', date: '2099-06-02', guests: 1 }, friend.token);
  assert.deepEqual((await call(env, '/v1/partner/fulfil', { ref: 'BOS-FFFF02' }, 'partner-secret')).body.issued, []);
  // A member cannot refer themselves into extra coupons.
  assert.equal((await signUp(env, 'a@example.com', { ref: inviter.member.referralCode })).member.coupons.length, 2);
});

test(`loyalty coupon after ${STAMPS_GOAL} completed tours, then stamps start again`, async () => {
  const env = setup();
  const { token } = await signUp(env, 'a@example.com');
  for (let i = 1; i <= STAMPS_GOAL; i++) {
    await call(env, '/v1/me/requests', { ref: 'BOS-LOYAL' + i, serviceId: 'bb-morning', date: '2099-07-0' + i, guests: 2 }, token);
    const r = await call(env, '/v1/partner/fulfil', { ref: 'BOS-LOYAL' + i }, 'partner-secret');
    if (i === STAMPS_GOAL) assert.ok(r.body.issued.includes('loyalty'));
  }
  const me = (await call(env, '/v1/me', null, token, 'GET')).body;
  assert.equal(me.stamps, 0); assert.ok(me.coupons.some(c => c.kind === 'loyalty' && c.percentBps === 1000));
});

test('discounts are capped by the commission limit and campaigns are admin-only', async () => {
  const env = setup();
  const camp = { id: 'welcome-2026', kind: 'welcome', percentBps: 1500, validDays: 30 };
  assert.equal((await call(env, '/v1/admin/campaigns', camp, 'partner-secret')).status, 401);
  assert.equal((await call(env, '/v1/admin/campaigns', camp, 'admin-secret')).status, 400);
  assert.equal((await call(env, '/v1/admin/campaigns', { ...camp, percentBps: 800 }, 'admin-secret')).status, 200);
  assert.equal((await signUp(env, 'a@example.com')).member.coupons[0].percentBps, 800);
  // A lowered cap also applies to coupons issued from older, higher campaigns.
  assert.equal((await signUp({ ...env, MAX_DISCOUNT_BPS: '300' }, 'b@example.com')).member.coupons[0].percentBps, 300);
  await call(env, '/v1/admin/campaigns', { ...camp, percentBps: 800, active: false }, 'admin-secret');
  assert.equal((await signUp(env, 'c@example.com')).member.coupons.length, 0);
});

test('deleting the account removes the member, sessions, coupons and requests', async () => {
  const env = setup();
  const { token } = await signUp(env, 'a@example.com');
  await call(env, '/v1/me/requests', { ref: 'BOS-DEL001', serviceId: 'bb-sunset', date: '2099-08-01', guests: 2 }, token);
  assert.equal((await call(env, '/v1/me/delete', {}, token)).body.deleted, true);
  for (const t of ['members', 'sessions', 'coupons', 'member_requests', 'login_codes']) assert.equal(env.DB.raw.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n, 0, t);
  assert.equal((await call(env, '/v1/me', null, token, 'GET')).status, 401);
});

test('member routes keep the origin check, rate limit and size limit', async () => {
  const env = setup();
  const evil = await worker.fetch(new Request('https://api.example/v1/auth/start', { method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: '{}' }), env);
  assert.equal(evil.status, 403);
  assert.equal((await call({ ...env, RATE_LIMITER: { limit: async () => ({ success: false }) } }, '/v1/auth/start', { email: 'a@example.com' })).status, 429);
  assert.equal((await call(env, '/v1/auth/start', { email: 'a@example.com', pad: 'x'.repeat(5000) })).status, 413);
});

test('deployment config has D1 database_id, live api base, secret-only workflow and TR/EN KVKK draft notice', () => {
  const wrangler = readFileSync(new URL('../backend/wrangler.jsonc', import.meta.url), 'utf8');
  assert.match(wrangler, /"database_id"\s*:\s*"[0-9a-f-]{36}"/);
  const apiConfig = readFileSync(new URL('../config/api.js', import.meta.url), 'utf8');
  assert.match(apiConfig, /\bbase:\s*'https:\/\/bosphorly-booking\.erennkirazz98\.workers\.dev'/);
  const workflow = readFileSync(new URL('../.github/workflows/deploy-member-api.yml', import.meta.url), 'utf8');
  assert.match(workflow, /name:\s*Deploy member API/);
  assert.match(workflow, /on:\s*workflow_dispatch/);
  assert.match(workflow, /secrets\.CLOUDFLARE_ACCOUNT_ID\s*\|\|\s*secrets\.CLAUDFLARE_ACCOUNT_ID/);
  assert.match(workflow, /secrets\.CLOUDFLARE_API_TOKEN/);
  assert.match(workflow, /secrets\.RESEND_API_KEY/);
  assert.match(workflow, /secrets\.CODE_PEPPER/);
  assert.match(workflow, /secrets\.PARTNER_TOKEN/);
  assert.match(workflow, /secrets\.ADMIN_TOKEN/);
  assert.match(workflow, /config=backend\/wrangler\.jsonc/);
  assert.match(workflow, /wrangler@\S+\s+d1 migrations apply bosphorly-booking --remote --config "\$config"/);
  assert.match(workflow, /wrangler@\S+\s+deploy --config "\$config"/);
  const privacy = readFileSync(new URL('../privacy.html', import.meta.url), 'utf8');
  assert.match(privacy, /TASLAK \(Üyelik Aydınlatma Bölümü\)/);
  assert.match(privacy, /DRAFT \(Membership Disclosure Section\)/);
  assert.match(privacy, /Hangi veriler işlenir\?/);
  assert.match(privacy, /What data we process:/);
  assert.match(privacy, /Silme talebi nasıl yapılır\?/);
  assert.match(privacy, /How to delete your account or request erasure:/);
});

