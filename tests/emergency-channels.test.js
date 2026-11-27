import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import worker from '../backend/worker.js';
import { EXTRANET_COOKIE_NAME } from '../backend/extranet.js';
import { handleWhatsApp, parseWhatsApp, processWhatsApp, sendWhatsApp } from '../backend/whatsapp.js';
import { computeTelegramWebhookSecret, handleTelegramWebhook } from '../backend/telegram.js';
import { MAINTENANCE_MESSAGES } from '../backend/emergency-channels.js';
import { SUPPORTED_LANGS } from '../backend/assistant.js';

const MIGRATIONS_DIR = new URL('../backend/migrations/', import.meta.url).pathname;
const ORIGIN = 'https://bosphorly.com';
const WA_BUSINESS = '+16197386408';
const WA_CUSTOMER = '+905551112233';

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

function createEnv(overrides = {}) {
  const DB = createD1();
  const kv = new Map();
  return {
    DB,
    WHATSAPP_KV: {
      async get(k, type) {
        if (!kv.has(k)) return null;
        return type === 'json' ? JSON.parse(kv.get(k)) : kv.get(k);
      },
      async put(k, v) {
        kv.set(k, v);
      },
      async delete(k) {
        kv.delete(k);
      },
    },
    AI: {
      async run() {
        return {
          response: JSON.stringify({
            reply: 'Boğaz turu hakkında yardımcı olabilirim.',
            handoff: false,
            abuse: false,
            proposal: null,
          }),
        };
      },
    },
    PUBLIC_ORIGIN: ORIGIN,
    ALLOWED_ORIGINS: 'https://bosphorly.com,https://www.bosphorly.com',
    RATE_LIMITER: { limit: async () => ({ success: true }) },
    CODE_PEPPER: 'emergency-test-pepper',
    DEV_RETURN_CODE: '1',
    PARTNER_TOKEN: 'partner-secret',
    ADMIN_TOKEN: 'admin-secret',
    OWNER_EMAILS: 'owner@bosphorly.example',
    SUPPORT_EMAILS: 'info@bosphorly.com,ops@bosphorly.example',
    MAIL_FROM: 'Bosphorly <no-reply@notify.bosphorly.com>',
    REQUEST_FROM_EMAIL: 'Bosphorly <no-reply@notify.bosphorly.com>',
    RESEND_API_KEY: 'resend-test-key',
    TURNSTILE_SECRET: 'ts-secret',
    TELEGRAM_BOT_TOKEN: 'tg-bot-token',
    TELEGRAM_ADMIN_CHAT_ID: '777000',
    TELNYX_API_KEY: 'telnyx-test-key',
    WHATSAPP_PHONE_NUMBER: WA_BUSINESS,
    ...overrides,
  };
}

async function callWorker(env, path, { method = 'GET', body = undefined, cookie = '', csrf = '', origin = ORIGIN, ip = '203.0.113.55' } = {}) {
  const headers = {
    ...(origin ? { Origin: origin } : {}),
    'CF-Connecting-IP': ip,
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(cookie ? { Cookie: cookie } : {}),
    ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
  };
  const req = new Request(`https://api.bosphorly.com${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const res = await worker.fetch(req, env, { waitUntil() {} });
  const ct = res.headers.get('Content-Type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();
  return { status: res.status, body: data, headers: res.headers };
}

function createActor(env, email, role, nowMs = Date.now()) {
  const id = crypto.randomUUID();
  const refCode = 'R' + id.replace(/-/g, '').slice(0, 8).toUpperCase();
  env.DB.raw.prepare('INSERT INTO members (id, email, name, referral_code) VALUES (?, ?, ?, ?)').run(id, email.toLowerCase(), role, refCode);
  env.DB.raw.prepare('INSERT OR REPLACE INTO extranet_users (member_id, role, active) VALUES (?, ?, 1)').run(id, role === 'forged_owner' ? 'owner' : role);
  const rawSession = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(rawSession).digest('hex');
  const csrf = crypto.randomBytes(32).toString('base64url');
  env.DB.raw
    .prepare(
      `INSERT INTO extranet_sessions (token_hash, member_id, csrf_token, ip_address, user_agent, created_at, last_active_at, expires_at)
       VALUES (?, ?, ?, '203.0.113.55', 'node-test', ?, ?, ?)`
    )
    .run(tokenHash, id, csrf, nowMs, nowMs, nowMs + 3600_000);
  return {
    memberId: id,
    email,
    cookie: `${EXTRANET_COOKIE_NAME}=${rawSession}`,
    csrf,
  };
}

function waEventPayload(text = 'Boğaz turu fiyat nedir?', id = 'wa-msg-' + crypto.randomUUID()) {
  return {
    data: {
      event_type: 'message.received',
      payload: {
        id,
        type: 'WHATSAPP',
        direction: 'inbound',
        from: { phone_number: WA_CUSTOMER },
        to: WA_BUSINESS,
        body: {
          type: 'text',
          timestamp: String(Math.floor(Date.now() / 1000)),
          text: { body: text },
        },
      },
    },
  };
}

async function signedWhatsAppRequest(payloadObj, privateKey) {
  const raw = JSON.stringify(payloadObj);
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = Buffer.from(await crypto.subtle.sign('Ed25519', privateKey, new TextEncoder().encode(`${ts}|${raw}`))).toString('base64');
  return new Request('https://api.bosphorly.com/webhooks/whatsapp/telnyx', {
    method: 'POST',
    body: raw,
    headers: {
      'telnyx-timestamp': ts,
      'telnyx-signature-ed25519': sig,
      'content-type': 'application/json',
    },
  });
}

test('default state (no D1 record): all channels start OPEN, cache <= 60s, and wrangler defines no *_DISABLED vars', async () => {
  const env = createEnv();
  const pub = await callWorker(env, '/v1/public/channels', { origin: '' });
  assert.equal(pub.status, 200);
  assert.deepEqual(pub.body, {
    whatsapp: true,
    telegram: true,
    instagram: true,
    mimo: true,
    banner: '',
  });
  const cc = pub.headers.get('Cache-Control') || '';
  const maxAges = [...cc.matchAll(/max-age=(\d+)/g)].map((m) => Number(m[1]));
  assert.ok(maxAges.length > 0 && maxAges.every((n) => n <= 60), `Expected <= 60s cache, got ${cc}`);

  const owner = createActor(env, 'owner@bosphorly.example', 'owner');
  const panel = await callWorker(env, '/v1/extranet/emergency', { cookie: owner.cookie });
  assert.equal(panel.status, 200);
  for (const ch of ['whatsapp', 'telegram', 'instagram', 'mimo']) {
    assert.equal(panel.body.channels[ch].enabled, true);
    assert.equal(panel.body.channels[ch].stored, true);
    assert.equal(panel.body.channels[ch].lockedByEnv, false);
  }

  const wranglerRaw = readFileSync(new URL('../backend/wrangler.jsonc', import.meta.url), 'utf8');
  for (const key of ['WHATSAPP_DISABLED', 'TELEGRAM_DISABLED', 'INSTAGRAM_DISABLED', 'MIMO_DISABLED']) {
    assert.ok(!wranglerRaw.includes(`"${key}"`), `${key} must not be defined by default in wrangler.jsonc`);
  }

  for (const lang of SUPPORTED_LANGS) {
    assert.ok(MAINTENANCE_MESSAGES[lang] && MAINTENANCE_MESSAGES[lang].includes('info@bosphorly.com'), `Missing maintenance message for ${lang}`);
  }
});

test('RBAC & confirmation: unauthenticated, staff, partner, admin and DB-forged owner cannot read or change switches; owner requires confirm on close and exact "AÇ" on open; audit + SUPPORT_EMAILS sent', async (t) => {
  const env = createEnv();
  const owner = createActor(env, 'owner@bosphorly.example', 'owner');
  const admin = createActor(env, 'admin@bosphorly.example', 'admin');
  const staff = createActor(env, 'staff@bosphorly.example', 'staff');
  const partner = createActor(env, 'partner@bosphorly.example', 'partner');
  const forgedOwner = createActor(env, 'attacker@bosphorly.example', 'forged_owner');

  const emails = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    if (String(url).includes('api.resend.com/emails')) {
      emails.push(JSON.parse(init.body));
      return Response.json({ id: 'mail-' + emails.length });
    }
    return Response.json({ ok: true });
  });

  // Unauthenticated denied
  assert.equal((await callWorker(env, '/v1/extranet/emergency')).status, 401);
  assert.equal((await callWorker(env, '/v1/extranet/emergency', { method: 'POST', body: { channel: 'whatsapp', enabled: false, confirm: true } })).status, 401);

  // Admin, staff, partner, and DB-forged owner all denied (forgedOwner session is revoked on first 403 -> 401 on retry)
  for (const actor of [admin, staff, partner, forgedOwner]) {
    const getRes = await callWorker(env, '/v1/extranet/emergency', { cookie: actor.cookie });
    assert.equal(getRes.status, 403, `${actor.email} GET should be 403`);
    const postRes = await callWorker(env, '/v1/extranet/emergency', {
      method: 'POST',
      cookie: actor.cookie,
      csrf: actor.csrf,
      body: { channel: 'whatsapp', enabled: false, confirm: true },
    });
    assert.ok(
      actor === forgedOwner ? postRes.status === 401 : postRes.status === 403,
      `${actor.email} POST should be denied (got ${postRes.status})`
    );
  }

  // Owner without CSRF denied
  assert.equal(
    (await callWorker(env, '/v1/extranet/emergency', {
      method: 'POST',
      cookie: owner.cookie,
      body: { channel: 'whatsapp', enabled: false, confirm: true },
    })).status,
    403
  );

  // Owner close without confirm:true rejected
  assert.equal(
    (await callWorker(env, '/v1/extranet/emergency', {
      method: 'POST',
      cookie: owner.cookie,
      csrf: owner.csrf,
      body: { channel: 'whatsapp', enabled: false },
    })).status,
    400
  );

  // Owner closes WhatsApp
  const closeRes = await callWorker(env, '/v1/extranet/emergency', {
    method: 'POST',
    cookie: owner.cookie,
    csrf: owner.csrf,
    body: { channel: 'whatsapp', enabled: false, confirm: true },
  });
  assert.equal(closeRes.status, 200);
  assert.equal(closeRes.body.channels.whatsapp.enabled, false);
  assert.equal(closeRes.body.emailSent, true);

  // Verify email sent to SUPPORT_EMAILS (both addresses) with channel, status, time, actor
  assert.equal(emails.length, 1);
  assert.deepEqual(emails[0].to, ['info@bosphorly.com', 'ops@bosphorly.example']);
  assert.match(emails[0].subject, /WhatsApp.*KAPATILDI/);
  assert.match(emails[0].text, /owner@bosphorly\.example/);
  assert.match(emails[0].text, /Zaman \(UTC\): \d{4}-\d{2}-\d{2}/);

  // Re-opening WITHOUT exact "AÇ" confirmation is rejected
  for (const wrong of ['', 'ac', 'aç', 'AC', 'evet', 'true', 'OPEN']) {
    const badOpen = await callWorker(env, '/v1/extranet/emergency', {
      method: 'POST',
      cookie: owner.cookie,
      csrf: owner.csrf,
      body: { channel: 'whatsapp', enabled: true, confirmText: wrong },
    });
    assert.equal(badOpen.status, 400, `Expected 400 for confirmText="${wrong}"`);
    assert.equal(badOpen.body.code, 'OPEN_CONFIRM_REQUIRED');
  }
  assert.equal((await callWorker(env, '/v1/public/channels', { origin: '' })).body.whatsapp, false);

  // Re-opening WITH "AÇ" succeeds, writes audit log, and sends SUPPORT_EMAILS notification
  const openRes = await callWorker(env, '/v1/extranet/emergency', {
    method: 'POST',
    cookie: owner.cookie,
    csrf: owner.csrf,
    body: { channel: 'whatsapp', enabled: true, confirmText: 'AÇ' },
  });
  assert.equal(openRes.status, 200);
  assert.equal(openRes.body.channels.whatsapp.enabled, true);
  assert.equal((await callWorker(env, '/v1/public/channels', { origin: '' })).body.whatsapp, true);
  assert.equal(emails.length, 2);
  assert.match(emails[1].subject, /WhatsApp.*AÇILDI/);

  // Banner set & clear audited and prevents card numbers
  const cardBanner = await callWorker(env, '/v1/extranet/emergency', {
    method: 'POST',
    cookie: owner.cookie,
    csrf: owner.csrf,
    body: { banner: 'Kart: 4111 1111 1111 1111' },
  });
  assert.equal(cardBanner.status, 400);

  const bannerRes = await callWorker(env, '/v1/extranet/emergency', {
    method: 'POST',
    cookie: owner.cookie,
    csrf: owner.csrf,
    body: { banner: 'WhatsApp hesabımız geçici olarak kapalıdır. Bize yalnızca info@bosphorly.com üzerinden ulaşın.' },
  });
  assert.equal(bannerRes.status, 200);
  assert.match((await callWorker(env, '/v1/public/channels', { origin: '' })).body.banner, /info@bosphorly\.com/);

  const audits = env.DB.raw
    .prepare("SELECT action, target_id, actor_role FROM extranet_audit WHERE target_type IN ('channel','emergency_banner') ORDER BY rowid ASC")
    .all();
  assert.deepEqual(
    audits.map((a) => `${a.action}:${a.target_id}:${a.actor_role}`),
    [
      'emergency_channel_close:whatsapp:owner',
      'emergency_channel_open:whatsapp:owner',
      'emergency_banner_update:banner:owner',
    ]
  );
});

test('each channel when disabled stops ONLY that channel (webhook 200 without processing, zero outbound sends, Mimo maintenance / scrubbed suggestions) while booking form & emails keep working', async (t) => {
  const pair = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  const pubKey = Buffer.from(await crypto.subtle.exportKey('raw', pair.publicKey)).toString('base64');
  const env = createEnv({
    TELNYX_PUBLIC_KEY: pubKey,
    ENABLE_EMAIL_REQUESTS: 'true',
  });
  const owner = createActor(env, 'owner@bosphorly.example', 'owner');
  const tgSecret = await computeTelegramWebhookSecret(env.CODE_PEPPER);

  let aiCalls = 0;
  const telnyxCalls = [];
  const tgApiCalls = [];
  const resendCalls = [];

  env.AI = {
    async run() {
      aiCalls += 1;
      return {
        response: 'Boğaz turlarımız her gün Eminönü iskelesinden kalkıyor. Bize WhatsApp https://wa.me/16197386408 üzerinden de yazabilirsin. [[flags:abuse=0;handoff=0]]',
      };
    },
  };

  t.mock.method(globalThis, 'fetch', async (url, init) => {
    const u = String(url);
    if (u.includes('challenges.cloudflare.com/turnstile')) {
      return Response.json({ success: true });
    }
    if (u.includes('api.telnyx.com')) {
      telnyxCalls.push(JSON.parse(init.body));
      return Response.json({ data: { id: 'wa-out' } });
    }
    if (u.includes('api.telegram.org')) {
      tgApiCalls.push(JSON.parse(init.body));
      return Response.json({ ok: true });
    }
    if (u.includes('api.resend.com')) {
      resendCalls.push(JSON.parse(init.body));
      return Response.json({ id: 'resend-id' });
    }
    return Response.json({ ok: true });
  });

  const setSwitch = (channel, enabled) =>
    callWorker(env, '/v1/extranet/emergency', {
      method: 'POST',
      cookie: owner.cookie,
      csrf: owner.csrf,
      body: enabled ? { channel, enabled: true, confirmText: 'AÇ' } : { channel, enabled: false, confirm: true },
    });

  // 1) Disable WhatsApp
  assert.equal((await setSwitch('whatsapp', false)).status, 200);
  const jobs = [];
  const waRes = await handleWhatsApp(await signedWhatsAppRequest(waEventPayload(), pair.privateKey), env, {
    waitUntil(p) {
      jobs.push(p);
    },
  });
  assert.equal(waRes.status, 200);
  await Promise.all(jobs);
  assert.equal(aiCalls, 0, 'WhatsApp webhook must not call AI when disabled');
  assert.equal(telnyxCalls.length, 0, 'WhatsApp must never send via Telnyx when disabled');
  assert.equal(await sendWhatsApp(env, WA_CUSTOMER, 'Test', Date.now()), false);
  assert.equal(await processWhatsApp(env, parseWhatsApp(waEventPayload(), WA_BUSINESS)), false);
  assert.equal(telnyxCalls.length, 0);

  // Web Mimo still works while WhatsApp is disabled, and scrubs WhatsApp suggestions from reply
  const webWhileWaOff = await callWorker(env, '/v1/assistant', {
    method: 'POST',
    body: { message: 'Boğaz turu nereden kalkıyor?', lang: 'tr', turnstileToken: 'ok' },
  });
  assert.equal(webWhileWaOff.status, 200);
  assert.match(webWhileWaOff.body.reply, /Eminönü/);
  assert.doesNotMatch(webWhileWaOff.body.reply, /WhatsApp|wa\.me|6408/i);

  // Site booking email form (/v1/requests) continues working normally while WhatsApp is disabled
  const bookingRes = await callWorker(env, '/v1/requests', {
    method: 'POST',
    body: {
      reference: 'BOS_TEST_9001',
      kind: 'tour',
      service: 'Morning Bosphorus Cruise',
      date: '2026-12-15',
      guests: 2,
      name: 'Ada Lovelace',
      phone: '+44 7700 900077',
      email: 'ada@example.com',
      message: 'Two adults please.',
      turnstileToken: 'ok',
      consent: true,
    },
  });
  assert.equal(bookingRes.status, 202);
  assert.equal(bookingRes.body.accepted, true);

  // 2) Disable Telegram -> bot does not reply
  assert.equal((await setSwitch('telegram', false)).status, 200);
  const aiBeforeTg = aiCalls;
  const tgGuestReq = new Request('https://api.bosphorly.com/v1/telegram/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': tgSecret,
    },
    body: JSON.stringify({
      message: { chat: { id: 999111, type: 'private' }, from: { id: 999111, language_code: 'tr' }, text: 'Merhaba' },
    }),
  });
  const tgRes = await handleTelegramWebhook(tgGuestReq, env, Date.now());
  assert.equal(tgRes.status, 200);
  assert.equal(aiCalls, aiBeforeTg, 'Telegram webhook must not call AI when disabled');
  assert.equal(tgApiCalls.length, 0, 'Telegram bot must send zero messages when disabled');

  // 3) Disable Instagram -> reflected on /v1/public/channels
  assert.equal((await setSwitch('instagram', false)).status, 200);
  assert.equal((await callWorker(env, '/v1/public/channels', { origin: '' })).body.instagram, false);

  // 4) Disable Mimo web -> returns localized maintenance message without calling AI
  assert.equal((await setSwitch('mimo', false)).status, 200);
  const aiBeforeMimo = aiCalls;
  const mimoTr = await callWorker(env, '/v1/assistant', {
    method: 'POST',
    body: { message: 'Merhaba', lang: 'tr' },
  });
  assert.equal(mimoTr.status, 200);
  assert.equal(mimoTr.body.maintenance, true);
  assert.match(mimoTr.body.reply, /Şu an bakımdayız, bize info@bosphorly\.com adresinden ulaşabilirsiniz/);

  const mimoDe = await callWorker(env, '/v1/assistant', {
    method: 'POST',
    body: { message: 'Hallo', lang: 'de' },
  });
  assert.equal(mimoDe.status, 200);
  assert.equal(mimoDe.body.maintenance, true);
  assert.match(mimoDe.body.reply, /info@bosphorly\.com/);
  assert.equal(aiCalls, aiBeforeMimo, 'Mimo web must not invoke AI when disabled');
  assert.equal((await callWorker(env, '/v1/tts', { method: 'POST', body: { text: 'Hi', lang: 'en' } })).status, 503);
});

test('Telegram backup command /acil_kapat works ONLY from TELEGRAM_ADMIN_CHAT_ID, closes target or hepsi, audits + emails, and NEVER opens channels', async (t) => {
  const env = createEnv();
  const tgSecret = await computeTelegramWebhookSecret(env.CODE_PEPPER);
  const emails = [];
  const tgNotices = [];

  t.mock.method(globalThis, 'fetch', async (url, init) => {
    if (String(url).includes('api.resend.com')) {
      emails.push(JSON.parse(init.body));
      return Response.json({ id: 'mail-tg' });
    }
    if (String(url).includes('api.telegram.org')) {
      tgNotices.push(JSON.parse(init.body));
      return Response.json({ ok: true });
    }
    return Response.json({ ok: true });
  });

  const postTg = (chatId, text) =>
    handleTelegramWebhook(
      new Request('https://api.bosphorly.com/v1/telegram/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Bot-Api-Secret-Token': tgSecret,
        },
        body: JSON.stringify({
          message: { chat: { id: chatId, type: 'private' }, from: { id: chatId, language_code: 'tr' }, text },
        }),
      }),
      env,
      Date.now()
    );

  // Non-admin chat cannot trigger /acil_kapat
  assert.equal((await postTg(111222, '/acil_kapat whatsapp')).status, 200);
  assert.equal((await postTg(111222, '/acil_kapat hepsi')).status, 200);
  assert.equal((await callWorker(env, '/v1/public/channels', { origin: '' })).body.whatsapp, true);
  assert.equal(emails.length, 0);
  assert.equal(tgNotices.length, 0);

  // Admin chat closes telegram first, then still closes hepsi via backup command
  assert.equal((await postTg(777000, '/acil_kapat telegram')).status, 200);
  assert.equal((await callWorker(env, '/v1/public/channels', { origin: '' })).body.telegram, false);
  assert.equal((await callWorker(env, '/v1/public/channels', { origin: '' })).body.whatsapp, true);
  assert.equal(emails.length, 1);
  assert.match(emails[0].subject, /Telegram.*KAPATILDI/);

  assert.equal((await postTg(777000, '/acil_kapat hepsi')).status, 200);
  const pubAfterAll = (await callWorker(env, '/v1/public/channels', { origin: '' })).body;
  assert.deepEqual(pubAfterAll, {
    whatsapp: false,
    telegram: false,
    instagram: false,
    mimo: false,
    banner: '',
  });
  assert.equal(emails.length, 2);

  // Telegram has NO open command: /acil_ac, /acil_aç, /acil_open never re-enable any channel
  for (const cmd of ['/acil_ac whatsapp', '/acil_aç whatsapp', '/acil_open hepsi']) {
    await postTg(777000, cmd);
  }
  const pubStillClosed = (await callWorker(env, '/v1/public/channels', { origin: '' })).body;
  assert.equal(pubStillClosed.whatsapp, false);
  assert.equal(pubStillClosed.telegram, false);
  assert.equal(pubStillClosed.instagram, false);
  assert.equal(pubStillClosed.mimo, false);

  const auditCount = env.DB.raw
    .prepare("SELECT COUNT(*) AS n FROM extranet_audit WHERE action='emergency_channel_close' AND ip_address='telegram'")
    .get().n;
  assert.equal(auditCount, 2);
});

test('environment variables WHATSAPP_DISABLED=1, TELEGRAM_DISABLED=1, MIMO_DISABLED=1 override D1 state and lock Extranet panel; /v1/public/channels returns 503 on D1 failure', async () => {
  const env = createEnv({
    WHATSAPP_DISABLED: '1',
    TELEGRAM_DISABLED: '1',
    MIMO_DISABLED: '1',
  });
  const owner = createActor(env, 'owner@bosphorly.example', 'owner');

  const pub = await callWorker(env, '/v1/public/channels', { origin: '' });
  assert.equal(pub.status, 200);
  assert.deepEqual(pub.body, {
    whatsapp: false,
    telegram: false,
    instagram: true,
    mimo: false,
    banner: '',
  });

  const panel = await callWorker(env, '/v1/extranet/emergency', { cookie: owner.cookie });
  assert.equal(panel.status, 200);
  assert.equal(panel.body.channels.whatsapp.lockedByEnv, true);
  assert.equal(panel.body.channels.telegram.lockedByEnv, true);
  assert.equal(panel.body.channels.mimo.lockedByEnv, true);
  assert.equal(panel.body.channels.instagram.lockedByEnv, false);

  const tryUnlock = await callWorker(env, '/v1/extranet/emergency', {
    method: 'POST',
    cookie: owner.cookie,
    csrf: owner.csrf,
    body: { channel: 'whatsapp', enabled: true, confirmText: 'AÇ' },
  });
  assert.equal(tryUnlock.status, 409);
  assert.equal(tryUnlock.body.code, 'ENV_LOCKED');

  // When D1 fails completely, /v1/public/channels returns 503 (so frontend fail-closed hides buttons)
  const brokenPublic = await callWorker({ ...env, DB: null }, '/v1/public/channels', { origin: '' });
  assert.equal(brokenPublic.status, 503);
});

test('when D1 switch status read fails (mock D1 error on extranet_settings), WhatsApp and Telegram message processing continue normally', async (t) => {
  const baseEnv = createEnv();
  const realPrepare = baseEnv.DB.prepare.bind(baseEnv.DB);
  const envWithBrokenSwitchRead = {
    ...baseEnv,
    DB: {
      ...baseEnv.DB,
      prepare(sql) {
        if (sql.includes('extranet_settings')) {
          return {
            bind() {
              return {
                async first() {
                  throw new Error('D1_MOCK_SETTINGS_UNAVAILABLE');
                },
              };
            },
          };
        }
        return realPrepare(sql);
      },
    },
  };

  // Public endpoint fails closed (503) when switch read fails
  const pubErr = await callWorker(envWithBrokenSwitchRead, '/v1/public/channels', { origin: '' });
  assert.equal(pubErr.status, 503);

  const waSent = [];
  const tgSent = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    if (String(url).includes('api.telnyx.com')) {
      waSent.push(JSON.parse(init.body));
      return Response.json({ data: { id: 'wa-ok' } });
    }
    if (String(url).includes('api.telegram.org')) {
      tgSent.push(JSON.parse(init.body));
      return Response.json({ ok: true });
    }
    return Response.json({ ok: true });
  });

  // WhatsApp continues normal processing and replies
  const m = parseWhatsApp(waEventPayload('Boğaz turu saat kaçta?'), WA_BUSINESS);
  const sentOk = await processWhatsApp(envWithBrokenSwitchRead, m);
  assert.equal(sentOk, true);
  assert.equal(waSent.length, 1);
  assert.equal(waSent[0].type, 'WHATSAPP');

  // Telegram continues normal processing and replies
  envWithBrokenSwitchRead.AI = {
    async run() {
      return { response: 'Boğaz turları sabah ve akşam kalkıyor. [[flags:abuse=0;handoff=0]]' };
    },
  };
  const tgSecret = await computeTelegramWebhookSecret(envWithBrokenSwitchRead.CODE_PEPPER);
  const tgRes = await handleTelegramWebhook(
    new Request('https://api.bosphorly.com/v1/telegram/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': tgSecret,
      },
      body: JSON.stringify({
        message: { chat: { id: 444555, type: 'private' }, from: { id: 444555, language_code: 'tr' }, text: 'Boğaz turu saat kaçta?' },
      }),
    }),
    envWithBrokenSwitchRead,
    Date.now()
  );
  assert.equal(tgRes.status, 200);
  assert.equal(tgSent.length, 1);
  assert.match(tgSent[0].text, /Boğaz/);
});
