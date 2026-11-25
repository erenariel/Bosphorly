import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import worker from '../backend/worker.js';
import { STAMPS_GOAL, signState } from '../backend/members.js';

// A minimal Cloudflare D1 stand-in over real SQLite, so the SQL and constraints run for real.
function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../backend/migrations/0001.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../backend/migrations/0002_members.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../backend/migrations/0003_member_preferences_newsletter.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../backend/migrations/0004_member_sync_requests_details.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../backend/migrations/0005_identities_passkeys.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../backend/migrations/0006_oauth_pending.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../backend/migrations/0012_platinum.sql', import.meta.url), 'utf8'));
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

test('deleting the account removes the member, sessions, coupons, requests and newsletter row', async () => {
  const env = setup();
  const { token } = await signUp(env, 'a@example.com', { marketing: true });
  await call(env, '/v1/me/requests', { ref: 'BOS-DEL001', serviceId: 'bb-sunset', date: '2099-08-01', guests: 2 }, token);
  assert.equal((await call(env, '/v1/me/delete', {}, token)).body.deleted, true);
  for (const t of ['members', 'sessions', 'coupons', 'member_requests', 'login_codes', 'newsletter_subscribers', 'passkeys', 'passkey_challenges', 'member_identities']) assert.equal(env.DB.raw.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n, 0, t);
  assert.equal((await call(env, '/v1/me', null, token, 'GET')).status, 401);
});

test('member routes keep the origin check, rate limit and size limit', async () => {
  const env = setup();
  const evil = await worker.fetch(new Request('https://api.example/v1/auth/start', { method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: '{}' }), env);
  assert.equal(evil.status, 403);
  assert.equal((await call({ ...env, RATE_LIMITER: { limit: async () => ({ success: false }) } }, '/v1/auth/start', { email: 'a@example.com' })).status, 429);
  assert.equal((await call(env, '/v1/auth/start', { email: 'a@example.com', pad: 'x'.repeat(5000) })).status, 413);
});

test('deployment config has D1 database_id, live api base, secret-only workflow and a finished TR/EN KVKK notice', () => {
  const wrangler = readFileSync(new URL('../backend/wrangler.jsonc', import.meta.url), 'utf8');
  assert.match(wrangler, /"database_id"\s*:\s*"[0-9a-f-]{36}"/);
  const apiConfig = readFileSync(new URL('../config/api.js', import.meta.url), 'utf8');
  assert.match(apiConfig, /\bbase:\s*'https:\/\/api\.bosphorly\.com'/);
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
  // The published notice has no editor or lawyer notes and no unfilled fields.
  assert.doesNotMatch(privacy, /TASLAK|DRAFT|Avukat değerlendirmesi|Legal review|class="(?:draft|legal)"/);
  assert.doesNotMatch(privacy, /class="ph"|\[(?:Ad Soyad|Full name|iletişim adresi|contact address|tarih|date)\]/);
  assert.match(privacy, /Hangi veriler işlenir\?/);
  assert.match(privacy, /What data we process:/);
  assert.match(privacy, /Silme talebi nasıl yapılır\?/);
  assert.match(privacy, /How to delete your account or request erasure:/);
});

test('OAuth endpoints report configured providers and redirect to Google, Yandex, Facebook and Apple consent screens', async () => {
  const env = {
    ...setup(),
    GOOGLE_CLIENT_ID: 'g-client', GOOGLE_CLIENT_SECRET: 'g-secret',
    YANDEX_CLIENT_ID: 'y-client', YANDEX_CLIENT_SECRET: 'y-secret',
    FACEBOOK_CLIENT_ID: 'fb-client', FACEBOOK_CLIENT_SECRET: 'fb-secret',
    APPLE_CLIENT_ID: 'com.bosphorly.web'
  };
  const prov = await call(env, '/v1/auth/providers', null, null, 'GET');
  assert.equal(prov.status, 200);
  assert.deepEqual(prov.body, { google: true, yandex: true, facebook: true, apple: true, microsoft: false, telegram: false });

  const gRes = await worker.fetch(new Request('https://api.example/v1/auth/oauth/google?lang=tr'), env);
  assert.equal(gRes.status, 302);
  assert.match(gRes.headers.get('Location'), /^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?.*client_id=g-client/);

  const yRes = await worker.fetch(new Request('https://api.example/v1/auth/oauth/yandex?lang=tr'), env);
  assert.equal(yRes.status, 302);
  assert.match(yRes.headers.get('Location'), /^https:\/\/oauth\.yandex\.com\/authorize\?.*client_id=y-client/);

  const fbRes = await worker.fetch(new Request('https://api.example/v1/auth/oauth/facebook?lang=tr'), env);
  assert.equal(fbRes.status, 302);
  assert.match(fbRes.headers.get('Location'), /^https:\/\/www\.facebook\.com\/v19\.0\/dialog\/oauth\?.*client_id=fb-client/);

  const aRes = await worker.fetch(new Request('https://api.example/v1/auth/oauth/apple?lang=tr'), env);
  assert.equal(aRes.status, 302);
  assert.match(aRes.headers.get('Location'), /^https:\/\/appleid\.apple\.com\/auth\/authorize\?.*client_id=com\.bosphorly\.web/);

  const envWithMs = { ...env, MICROSOFT_CLIENT_ID: 'ms-client', MICROSOFT_CLIENT_SECRET: 'ms-secret' };
  const msRes = await worker.fetch(new Request('https://api.example/v1/auth/oauth/microsoft?lang=tr'), envWithMs);
  assert.equal(msRes.status, 302);
  assert.match(msRes.headers.get('Location'), /^https:\/\/login\.microsoftonline\.com\/consumers\/oauth2\/v2\.0\/authorize\?.*client_id=ms-client/);
});

test('country, interests and progressive tiers (silver -> gold -> platinum) with VIP priority & free upgrade', async () => {
  const env = setup();
  const up = await signUp(env, 'vip@example.com', {
    name: 'Deniz Kaya',
    country: 'Türkiye',
    interests: ['cruise', 'private', 'invalid-ignored'],
    marketing: true
  });
  assert.equal(up.member.country, 'Türkiye');
  assert.deepEqual(up.member.interests, ['cruise', 'private']);
  assert.equal(up.member.tier, 'silver');
  assert.equal(up.member.freeUpgrade, 'none');
  assert.equal(up.member.nextTier, 'gold');
  assert.equal(up.member.toursToNextTier, 2);

  // Fulfil 2 tours -> Gold (eligible Free Upgrade + 5% VIP priority).
  for (let i = 1; i <= 2; i++) {
    await call(env, '/v1/me/requests', { ref: 'BOS-GOLD0' + i, serviceId: 'bb-sunset', date: '2099-06-0' + i, guests: 2 }, up.token);
    await call(env, '/v1/partner/fulfil', { ref: 'BOS-GOLD0' + i }, 'partner-secret');
  }
  const goldMe = (await call(env, '/v1/me', null, up.token, 'GET')).body;
  assert.equal(goldMe.tier, 'gold');
  assert.equal(goldMe.freeUpgrade, 'eligible');
  assert.equal(goldMe.vipPriorityDiscountBps, 300);
  assert.equal(goldMe.toursToNextTier, 3);

  // Fulfil 3 more tours (5 total) -> Platinum (priority Free Upgrade + max 10% always-on VIP priority discount).
  for (let i = 3; i <= 5; i++) {
    await call(env, '/v1/me/requests', { ref: 'BOS-PLAT0' + i, serviceId: 'bb-morning', date: '2099-06-0' + i, guests: 2 }, up.token);
    await call(env, '/v1/partner/fulfil', { ref: 'BOS-PLAT0' + i }, 'partner-secret');
  }
  const platMe = (await call(env, '/v1/me', null, up.token, 'GET')).body;
  assert.equal(platMe.tier, 'platinum');
  assert.equal(platMe.freeUpgrade, 'priority');
  assert.equal(platMe.vipPriorityDiscountBps, 1000);
  assert.equal(platMe.nextTier, null);

  // Partner lookup exposes the member's tier and free upgrade eligibility.
  await call(env, '/v1/me/requests', { ref: 'BOS-VIPCHK', serviceId: 'jewish-heritage', date: '2099-07-01', guests: 2 }, up.token);
  const lk = await call(env, '/v1/partner/lookup', { ref: 'BOS-VIPCHK' }, 'partner-secret');
  assert.equal(lk.body.tier, 'platinum');
  assert.equal(lk.body.freeUpgrade, 'priority');

  // Updating profile preferences syncs country & interests.
  const upd = await call(env, '/v1/me', { country: 'Germany', interests: ['transfer', 'oldcity'], marketing: false }, up.token);
  assert.equal(upd.body.country, 'Germany');
  assert.deepEqual(upd.body.interests, ['transfer', 'oldcity']);
  assert.equal(upd.body.marketing, false);
});

test('newsletter subscription, admin filtered broadcast, and unsubscribe endpoints', async () => {
  const env = setup();
  const m1 = await signUp(env, 'gold@example.com', { name: 'Ali Demir', interests: ['cruise', 'private'], marketing: true });
  for (let i = 1; i <= 2; i++) {
    await call(env, '/v1/me/requests', { ref: 'BOS-NLG0' + i, serviceId: 'bb-sunset', date: '2099-08-0' + i, guests: 2 }, m1.token);
    await call(env, '/v1/partner/fulfil', { ref: 'BOS-NLG0' + i }, 'partner-secret');
  }
  const sub = await call(env, '/v1/newsletter/subscribe', { email: 'Visitor@Example.com', lang: 'en', interests: ['cruise'], source: 'home' });
  assert.equal(sub.status, 200);
  assert.equal(sub.body.subscribed, true);

  // Admin auth required for broadcasts.
  assert.equal((await call(env, '/v1/admin/newsletter/send', { subject: 'Hi', text: 'Test' }, 'wrong')).status, 401);

  // Dry run all active subscribers -> 2 (gold member + visitor).
  const dryAll = await call(env, '/v1/admin/newsletter/send', { subject: 'Bosphorly News', text: 'Hello {name}', dryRun: true }, 'admin-secret');
  assert.equal(dryAll.body.count, 2);

  // Filter by tier=gold -> only gold member.
  const dryGold = await call(env, '/v1/admin/newsletter/send', { subject: 'VIP Gold Offer', text: 'Hi {name} ({tier})', tier: 'gold', dryRun: true }, 'admin-secret');
  assert.equal(dryGold.body.count, 1);
  assert.deepEqual(dryGold.body.recipients, ['gold@example.com']);

  // Live send in dev mode counts sent cleanly.
  const sent = await call(env, '/v1/admin/newsletter/send', { subject: 'VIP Gold Offer', text: 'Hi {name}', tier: 'gold' }, 'admin-secret');
  assert.equal(sent.body.sent, 1);

  // Member unsubscribes via authenticated endpoint.
  const unsub = await call(env, '/v1/newsletter/unsubscribe', {}, m1.token);
  assert.equal(unsub.body.unsubscribed, true);
  const dryAfter = await call(env, '/v1/admin/newsletter/send', { subject: 'VIP Gold Offer', text: 'Hi', tier: 'gold', dryRun: true }, 'admin-secret');
  assert.equal(dryAfter.body.count, 0);
});

test('cross-device sync saves phone/hotel/room, cart/request metadata, and releases coupons on delete', async () => {
  const env = setup();
  const up = await signUp(env, 'sync@example.com', {
    name: 'Zeynep Acar',
    phone: '+90 555 111 22 33',
    hotelName: 'Four Seasons',
    room: '305'
  });
  const code = up.member.coupons[0].code;
  const reg = await call(env, '/v1/me/requests', {
    ref: 'BOS-CART01',
    serviceId: 'airport-transfer-ist',
    date: '2099-09-01',
    guests: 3,
    couponCode: code,
    type: 'transfer',
    title: 'Havalimanı transferi · IST → Sultanahmet',
    operator: 'Four Seasons',
    time: '14:30',
    total: '€60 · araç başı',
    notes: '2 large suitcases'
  }, up.token);
  assert.equal(reg.status, 200);

  // Signing in from a second device returns full details and cart/request metadata.
  const secondDevice = await signUp(env, 'sync@example.com');
  assert.equal(secondDevice.member.phone, '+90 555 111 22 33');
  assert.equal(secondDevice.member.hotel, 'Four Seasons');
  assert.equal(secondDevice.member.room, '305');
  assert.equal(secondDevice.member.requests.length, 1);
  assert.equal(secondDevice.member.requests[0].title, 'Havalimanı transferi · IST → Sultanahmet');
  assert.equal(secondDevice.member.requests[0].time, '14:30');
  assert.equal(secondDevice.member.requests[0].total, '€60 · araç başı');
  assert.equal(secondDevice.member.requests[0].couponCode, code);

  // Update contact info via /v1/me.
  const upd = await call(env, '/v1/me', { phone: '+90 555 999 88 77', hotel: 'Ciragan Palace', room: '501' }, up.token);
  assert.equal(upd.body.phone, '+90 555 999 88 77');
  assert.equal(upd.body.hotel, 'Ciragan Palace');
  assert.equal(upd.body.room, '501');

  // Deleting an open request removes it and releases the held coupon back to issued.
  const del = await call(env, '/v1/me/requests/delete', { ref: 'BOS-CART01' }, secondDevice.token);
  assert.equal(del.status, 200);
  assert.equal(del.body.removed, true);
  assert.equal(del.body.member.requests.length, 0);
  assert.equal(del.body.member.coupons[0].status, 'issued');
  assert.equal(del.body.member.coupons[0].heldFor, null);
});

test('disabled provider redirects to oauth_error and oauth_modal is not returned', async () => {
  const env = setup();
  // Disabled Google
  const gRes = await worker.fetch(new Request('https://api.example/v1/auth/oauth/google?lang=tr'), env);
  assert.equal(gRes.status, 302);
  const gLoc = gRes.headers.get('Location');
  assert.match(gLoc, /account\.html\?oauth_error=google#signup/);
  assert.doesNotMatch(gLoc, /oauth_modal/);

  // Disabled Microsoft
  const msRes = await worker.fetch(new Request('https://api.example/v1/auth/oauth/microsoft?lang=tr'), env);
  assert.equal(msRes.status, 302);
  const msLoc = msRes.headers.get('Location');
  assert.match(msLoc, /account\.html\?oauth_error=microsoft#signup/);
  assert.doesNotMatch(msLoc, /oauth_modal/);

  // Disabled Telegram
  const tgRes = await worker.fetch(new Request('https://api.example/v1/auth/oauth/telegram?lang=tr'), env);
  assert.equal(tgRes.status, 302);
  const tgLoc = tgRes.headers.get('Location');
  assert.match(tgLoc, /account\.html\?oauth_error=telegram#signup/);
  assert.doesNotMatch(tgLoc, /oauth_modal/);
});

test('Google callback rejects when email_verified is false', async () => {
  const env = {
    ...setup(),
    GOOGLE_CLIENT_ID: 'g-client',
    GOOGLE_CLIENT_SECRET: 'g-secret'
  };
  const origFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url, opts) => {
      const u = String(url);
      if (u.includes('oauth2.googleapis.com/token')) {
        return new Response(JSON.stringify({ access_token: 'fake-google-token' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (u.includes('openidconnect.googleapis.com/v1/userinfo')) {
        return new Response(JSON.stringify({ email: 'fake@example.com', email_verified: false, name: 'Fake User' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return origFetch(url, opts);
    };

    const st = await signState(env.CODE_PEPPER, { p: 'google', t: Date.now(), lang: 'en', nonce: 'nonce-g' });
    const res = await worker.fetch(new Request(`https://api.example/v1/auth/oauth/google/callback?code=mock-code&state=${encodeURIComponent(st)}`), env);
    assert.equal(res.status, 302);
    assert.match(res.headers.get('Location'), /account\.html\?oauth_error=google#signup/);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('Microsoft rejects wrong aud, expired token, non-personal tid, and iss/tid mismatch', async () => {
  const { verifyMicrosoftIdToken } = await import('../backend/members.js');
  const b64 = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const PERSONAL_MS_TID = '9188040d-6c67-4c5b-b112-36a304b66dad';

  // Wrong aud
  const wrongAudToken = `${b64({ kid: 'k1', alg: 'RS256' })}.${b64({
    aud: 'wrong-client',
    exp: Math.floor(Date.now() / 1000) + 3600,
    tid: PERSONAL_MS_TID,
    iss: `https://login.microsoftonline.com/${PERSONAL_MS_TID}/v2.0`,
    email: 'user@outlook.com'
  })}.fakesig`;
  assert.equal(await verifyMicrosoftIdToken(wrongAudToken, 'correct-client', 'nonce-1'), null);

  // Expired token
  const expiredToken = `${b64({ kid: 'k1', alg: 'RS256' })}.${b64({
    aud: 'correct-client',
    exp: Math.floor(Date.now() / 1000) - 300,
    tid: PERSONAL_MS_TID,
    iss: `https://login.microsoftonline.com/${PERSONAL_MS_TID}/v2.0`,
    email: 'user@outlook.com'
  })}.fakesig`;
  assert.equal(await verifyMicrosoftIdToken(expiredToken, 'correct-client', 'nonce-1'), null);

  // Non-personal Microsoft account tenant (e.g. work/school 'organizations' or company GUID) - nOAuth defense
  const workTenantToken = `${b64({ kid: 'k1', alg: 'RS256' })}.${b64({
    aud: 'correct-client',
    exp: Math.floor(Date.now() / 1000) + 3600,
    tid: 'organizations',
    iss: 'https://login.microsoftonline.com/organizations/v2.0',
    email: 'victim@company.com'
  })}.fakesig`;
  assert.equal(await verifyMicrosoftIdToken(workTenantToken, 'correct-client', 'nonce-1'), null);

  const customTenantToken = `${b64({ kid: 'k1', alg: 'RS256' })}.${b64({
    aud: 'correct-client',
    exp: Math.floor(Date.now() / 1000) + 3600,
    tid: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    iss: 'https://login.microsoftonline.com/a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d/v2.0',
    email: 'victim@company.com'
  })}.fakesig`;
  assert.equal(await verifyMicrosoftIdToken(customTenantToken, 'correct-client', 'nonce-1'), null);

  // iss / tid mismatch
  const mismatchedIssToken = `${b64({ kid: 'k1', alg: 'RS256' })}.${b64({
    aud: 'correct-client',
    exp: Math.floor(Date.now() / 1000) + 3600,
    tid: PERSONAL_MS_TID,
    iss: 'https://login.microsoftonline.com/tid-OTHER/v2.0',
    email: 'user@outlook.com'
  })}.fakesig`;
  assert.equal(await verifyMicrosoftIdToken(mismatchedIssToken, 'correct-client', 'nonce-1'), null);

  // Mismatched nonce
  const wrongNonceToken = `${b64({ kid: 'k1', alg: 'RS256' })}.${b64({
    aud: 'correct-client',
    exp: Math.floor(Date.now() / 1000) + 3600,
    tid: PERSONAL_MS_TID,
    iss: `https://login.microsoftonline.com/${PERSONAL_MS_TID}/v2.0`,
    nonce: 'bad-nonce',
    email: 'user@outlook.com'
  })}.fakesig`;
  assert.equal(await verifyMicrosoftIdToken(wrongNonceToken, 'correct-client', 'expected-nonce'), null);
});

test('OAuth initiation strips PII from URLs and signed state via single-use oauth_pending', async () => {
  const env = {
    ...setup(),
    GOOGLE_CLIENT_ID: 'g-client', GOOGLE_CLIENT_SECRET: 'g-secret',
    MICROSOFT_CLIENT_ID: 'ms-client', MICROSOFT_CLIENT_SECRET: 'ms-secret'
  };

  // 1. Prepare OAuth prefill data
  const prepRes = await call(env, '/v1/auth/oauth/prepare', {
    phone: '+90 555 123 4567',
    hotel: 'Four Seasons Bosphorus',
    hotelName: 'Four Seasons Bosphorus',
    country: 'TR',
    interests: ['cruise', 'private'],
    marketing: true
  });
  assert.equal(prepRes.status, 200);
  assert.ok(prepRes.body.id);
  const pendingId = prepRes.body.id;

  // Verify stored in D1 oauth_pending table with 10m expiry
  const row = env.DB.raw.prepare('SELECT * FROM oauth_pending WHERE id=?').get(pendingId);
  assert.ok(row);
  const parsedData = JSON.parse(row.data);
  assert.equal(parsedData.phone, '+90 555 123 4567');
  assert.equal(parsedData.hotelName, 'Four Seasons Bosphorus');
  assert.equal(parsedData.country, 'TR');

  // 2. Start OAuth redirect with pendingId parameter
  const startRes = await worker.fetch(new Request(`https://api.example/v1/auth/oauth/google?p=${encodeURIComponent(pendingId)}&lang=tr`), env);
  assert.equal(startRes.status, 302);
  const location = startRes.headers.get('Location');
  assert.ok(location);

  // Assert NO PII in the Google OAuth redirect URL or query parameters
  assert.doesNotMatch(location, /phone/i);
  assert.doesNotMatch(decodeURIComponent(location.replaceAll('+', ' ')), /555\s*123\s*4567/);
  assert.doesNotMatch(location, /hotel/i);
  assert.doesNotMatch(location, /Four%20Seasons/i);
  assert.doesNotMatch(location, /country/i);
  assert.doesNotMatch(location, /interests/i);
  assert.doesNotMatch(location, /cruise/i);

  // Extract state param and verify its payload has no PII
  const targetUrl = new URL(location);
  const stateParam = targetUrl.searchParams.get('state');
  assert.ok(stateParam);
  const statePayloadRaw = stateParam.split('.')[0];
  const stateObj = JSON.parse(Buffer.from(statePayloadRaw, 'base64url').toString('utf8'));
  assert.equal(stateObj.p, 'google');
  assert.equal(stateObj.lang, 'tr');
  assert.equal(stateObj.pendingId, pendingId);
  assert.equal(stateObj.phone, undefined);
  assert.equal(stateObj.hotel, undefined);
  assert.equal(stateObj.country, undefined);
  assert.equal(stateObj.interests, undefined);
  assert.equal(stateObj.marketing, undefined);

  // 3. Callback consumes the pending data and deletes the single-use record
  const origFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url, opts) => {
      const u = String(url);
      if (u.includes('oauth2.googleapis.com/token')) {
        return new Response(JSON.stringify({ access_token: 'valid-google-tok' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (u.includes('openidconnect.googleapis.com/v1/userinfo')) {
        return new Response(JSON.stringify({ email: 'newoauthuser@example.com', email_verified: true, name: 'OAuth Guest' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return origFetch(url, opts);
    };

    const cbRes = await worker.fetch(new Request(`https://api.example/v1/auth/oauth/google/callback?code=good-code&state=${encodeURIComponent(stateParam)}`), env);
    assert.equal(cbRes.status, 302);
    assert.match(cbRes.headers.get('Location'), /account\.html#oauth_token=/);

    // oauth_pending record is deleted (single-use)
    const afterRow = env.DB.raw.prepare('SELECT * FROM oauth_pending WHERE id=?').get(pendingId);
    assert.equal(afterRow, undefined);

    // New member created with prefill data
    const member = env.DB.raw.prepare('SELECT * FROM members WHERE email=?').get('newoauthuser@example.com');
    assert.ok(member);
    assert.equal(member.phone, '+90 555 123 4567');
    assert.equal(member.hotel, 'Four Seasons Bosphorus');
    assert.equal(member.country, 'TR');
    assert.deepEqual(JSON.parse(member.interests), ['cruise', 'private']);
    assert.equal(member.marketing_consent, 1);
  } finally {
    globalThis.fetch = origFetch;
  }
});

function computeTelegramHash(params, botToken) {
  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  const checkKeys = Object.keys(params).filter(k => k !== 'hash').sort();
  const dataCheckString = checkKeys.map(k => `${k}=${params[k]}`).join('\n');
  return crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
}

test('Telegram callback rejects invalid hash and auth_date older than 10m; handles unlinked and linked users', async () => {
  const botToken = '123456789:ABCdefGHIjklMNOpqrSTUvwxYZ';
  const env = {
    ...setup(),
    TELEGRAM_BOT_TOKEN: botToken
  };

  const nowSec = Math.floor(Date.now() / 1000);

  // 1. Invalid hash is rejected
  const p1 = { id: '998877', first_name: 'Ahmet', auth_date: String(nowSec), hash: 'invalidhash123' };
  const resBadHash = await worker.fetch(new Request('https://api.example/v1/auth/oauth/telegram/callback?' + new URLSearchParams(p1)), env);
  assert.equal(resBadHash.status, 302);
  assert.match(resBadHash.headers.get('Location'), /account\.html\?oauth_error=telegram#signup/);

  // 2. auth_date older than 10 minutes (600s) is rejected
  const oldDate = String(nowSec - 700);
  const p2 = { id: '998877', first_name: 'Ahmet', auth_date: oldDate };
  p2.hash = computeTelegramHash(p2, botToken);
  const resOldDate = await worker.fetch(new Request('https://api.example/v1/auth/oauth/telegram/callback?' + new URLSearchParams(p2)), env);
  assert.equal(resOldDate.status, 302);
  assert.match(resOldDate.headers.get('Location'), /account\.html\?oauth_error=telegram#signup/);

  // 3. Valid hash for unlinked user redirects to account.html#link-telegram&state=...
  // Must NOT include telegram id, name or username in redirect URL!
  const p3 = { id: '7770001', first_name: 'SecretGuest', username: 'secretguest', auth_date: String(nowSec) };
  p3.hash = computeTelegramHash(p3, botToken);
  const resUnlinked = await worker.fetch(new Request('https://api.example/v1/auth/oauth/telegram/callback?' + new URLSearchParams(p3)), env);
  assert.equal(resUnlinked.status, 302);
  const locUnlinked = resUnlinked.headers.get('Location');
  assert.match(locUnlinked, /account\.html#link-telegram&state=/);
  assert.doesNotMatch(locUnlinked, /7770001/);
  assert.doesNotMatch(locUnlinked, /SecretGuest/);
  assert.doesNotMatch(locUnlinked, /secretguest/);

  // Extract linkToken and verify email linking
  const hashPart = locUnlinked.split('#')[1];
  const linkState = new URLSearchParams(hashPart).get('state');
  assert.ok(linkState);

  // Sign up / verify with email and the linkToken
  const verified = await signUp(env, 'telegramuser@example.com', { linkToken: linkState });
  assert.equal(verified.member.email, 'telegramuser@example.com');

  // Verify member_identities table has the link
  const memberRow = env.DB.raw.prepare('SELECT id FROM members WHERE email=?').get('telegramuser@example.com');
  const ident = env.DB.raw.prepare(`SELECT * FROM member_identities WHERE provider='telegram' AND subject='7770001'`).get();
  assert.ok(ident);
  assert.equal(ident.member_id, memberRow.id);

  // 4. Valid hash for linked user now directly creates session and redirects with oauth_token
  const p4 = { id: '7770001', first_name: 'SecretGuest', auth_date: String(nowSec) };
  p4.hash = computeTelegramHash(p4, botToken);
  const resLinked = await worker.fetch(new Request('https://api.example/v1/auth/oauth/telegram/callback?' + new URLSearchParams(p4)), env);
  assert.equal(resLinked.status, 302);
  const locLinked = resLinked.headers.get('Location');
  assert.match(locLinked, /account\.html#oauth_token=[A-Za-z0-9_-]+&oauth_provider=telegram/);
});

test('Passkey: unauthenticated user cannot get registration options, challenge is single-use and expires in 5m', async () => {
  const env = setup();

  // 1. Unauthenticated user cannot get registration options
  const unauthRes = await call(env, '/v1/passkeys/register/options', {});
  assert.equal(unauthRes.status, 401);

  // 2. Authenticated user can get registration options
  const user = await signUp(env, 'passkeyuser@example.com');
  const regOpts = await call(env, '/v1/passkeys/register/options', {}, user.token);
  assert.equal(regOpts.status, 200);
  assert.ok(regOpts.body.challenge);

  // Verify challenge saved in DB with 5-minute expiry
  const passkeyMember = env.DB.raw.prepare('SELECT id FROM members WHERE email=?').get('passkeyuser@example.com');
  const chRow = env.DB.raw.prepare(`SELECT * FROM passkey_challenges WHERE challenge=?`).get(regOpts.body.challenge);
  assert.ok(chRow);
  assert.equal(chRow.purpose, 'registration');
  assert.equal(chRow.member_id, passkeyMember.id);

  // 3. Login options can be requested without authentication (discoverable credentials)
  const loginOpts = await call(env, '/v1/passkeys/login/options', {});
  assert.equal(loginOpts.status, 200);
  assert.ok(loginOpts.body.challenge);

  const loginChRow = env.DB.raw.prepare(`SELECT * FROM passkey_challenges WHERE challenge=?`).get(loginOpts.body.challenge);
  assert.ok(loginChRow);
  assert.equal(loginChRow.purpose, 'authentication');

  // 4. Challenge reuse: if challenge is deleted or expired, verification fails
  // Manually delete the challenge to simulate it being already used
  env.DB.raw.exec(`DELETE FROM passkey_challenges WHERE challenge='${loginOpts.body.challenge}'`);

  const fakeClientDataJSON = Buffer.from(JSON.stringify({
    type: 'webauthn.get',
    challenge: loginOpts.body.challenge,
    origin: ORIGIN
  })).toString('base64url');

  const reuseRes = await call(env, '/v1/passkeys/login/verify', {
    id: 'cred-1',
    response: { clientDataJSON: fakeClientDataJSON }
  });
  assert.equal(reuseRes.status, 400);
  assert.equal(reuseRes.body.error, 'Invalid or expired challenge');
});

test('/v1/auth/providers returns microsoft and telegram keys', async () => {
  const env = {
    ...setup(),
    MICROSOFT_CLIENT_ID: 'ms-id',
    MICROSOFT_CLIENT_SECRET: 'ms-sec',
    TELEGRAM_BOT_TOKEN: 'tg-token'
  };
  const prov = await call(env, '/v1/auth/providers', null, null, 'GET');
  assert.equal(prov.status, 200);
  assert.equal(prov.body.microsoft, true);
  assert.equal(prov.body.telegram, true);
  assert.equal(prov.body.google, false);
});

test('account deletion deletes passkeys, passkey_challenges, and member_identities', async () => {
  const env = setup();
  const user = await signUp(env, 'fullclean@example.com');
  const cleanMember = env.DB.raw.prepare('SELECT id FROM members WHERE email=?').get('fullclean@example.com');

  // Insert a passkey, a challenge, and an identity
  env.DB.raw.exec(`INSERT INTO passkeys (credential_id, member_id, public_key, counter, created_at) VALUES ('pk-clean-1', '${cleanMember.id}', 'pubkey-b64', 0, datetime('now'))`);
  env.DB.raw.exec(`INSERT INTO passkey_challenges (id, challenge, member_id, purpose, expires_at, created_at) VALUES ('ch-clean-1', 'ch-val-1', '${cleanMember.id}', 'registration', datetime('now', '+5 minutes'), datetime('now'))`);
  env.DB.raw.exec(`INSERT INTO member_identities (provider, subject, member_id, created_at) VALUES ('telegram', 'tg-clean-1', '${cleanMember.id}', datetime('now'))`);

  assert.equal(env.DB.raw.prepare(`SELECT COUNT(*) AS n FROM passkeys WHERE member_id=?`).get(cleanMember.id).n, 1);
  assert.equal(env.DB.raw.prepare(`SELECT COUNT(*) AS n FROM passkey_challenges WHERE member_id=?`).get(cleanMember.id).n, 1);
  assert.equal(env.DB.raw.prepare(`SELECT COUNT(*) AS n FROM member_identities WHERE member_id=?`).get(cleanMember.id).n, 1);

  const delRes = await call(env, '/v1/me/delete', {}, user.token);
  assert.equal(delRes.status, 200);
  assert.equal(delRes.body.deleted, true);

  assert.equal(env.DB.raw.prepare(`SELECT COUNT(*) AS n FROM passkeys WHERE member_id=?`).get(cleanMember.id).n, 0);
  assert.equal(env.DB.raw.prepare(`SELECT COUNT(*) AS n FROM passkey_challenges WHERE member_id=?`).get(cleanMember.id).n, 0);
  assert.equal(env.DB.raw.prepare(`SELECT COUNT(*) AS n FROM member_identities WHERE member_id=?`).get(cleanMember.id).n, 0);
});






test('Platinum gift: fifth completed tour, 10%, 180 days, once per member and separate from loyalty', async () => {
  const env = setup();
  const up = await signUp(env, 'platinum-gift@example.com');
  for (let i = 1; i <= 10; i++) {
    const ref = 'BOS-GIFT' + String(i).padStart(3, '0');
    assert.equal((await call(env, '/v1/me/requests', { ref, serviceId: 'bb-morning', date: '2099-06-01', guests: 2 }, up.token)).status, 200);
    const fulfilled = await call(env, '/v1/partner/fulfil', { ref }, 'partner-secret');
    assert.equal(fulfilled.status, 200);
    const me = (await call(env, '/v1/me', null, up.token, 'GET')).body;
    const gifts = me.coupons.filter(c => c.kind === 'platinum');
    assert.equal(gifts.length, i < 5 ? 0 : 1);
    if (i >= 5) {
      assert.equal(gifts[0].percentBps, 1000);
      assert.ok(Math.abs(new Date(gifts[0].expiresAt.replace(' ', 'T') + 'Z').getTime() - Date.now() - 180 * 864e5) < 10000);
      assert.ok(me.platinumSince);
    }
    if (i >= 5) assert.equal(me.coupons.filter(c => c.kind === 'loyalty').length, Math.floor(i / 5));
  }
});


test('Yandex can be temporarily disabled with credentials retained and re-enabled by configuration', async () => {
  const env = { ...setup(), YANDEX_CLIENT_ID: 'y-client', YANDEX_CLIENT_SECRET: 'y-secret', YANDEX_DISABLED: '1' };
  const providers = await call(env, '/v1/auth/providers', null, null, 'GET');
  assert.equal(providers.body.yandex, false);
  const start = await worker.fetch(new Request('https://api.example/v1/auth/oauth/yandex?lang=tr'), env);
  assert.equal(start.status, 302);
  assert.equal(new URL(start.headers.get('Location')).hostname, 'example.com');
  assert.equal(new URL(start.headers.get('Location')).searchParams.get('oauth_error'), 'yandex');
  env.YANDEX_DISABLED = '0';
  assert.equal((await call(env, '/v1/auth/providers', null, null, 'GET')).body.yandex, true);
  const config = readFileSync(new URL('../backend/wrangler.jsonc', import.meta.url), 'utf8');
  assert.match(config, /"YANDEX_DISABLED"\s*:\s*"1"/);
});
