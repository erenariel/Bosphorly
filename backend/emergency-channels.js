export const EMERGENCY_CHANNELS = Object.freeze(['whatsapp', 'telegram', 'instagram', 'mimo']);

export const ENV_LOCK_KEYS = Object.freeze({
  whatsapp: 'WHATSAPP_DISABLED',
  telegram: 'TELEGRAM_DISABLED',
  instagram: 'INSTAGRAM_DISABLED',
  mimo: 'MIMO_DISABLED',
});

export const CHANNEL_LABELS = Object.freeze({
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  instagram: 'Instagram',
  mimo: 'Mimo Web',
  hepsi: 'Tüm Kanallar (WhatsApp, Telegram, Instagram, Mimo Web)',
  banner: 'Site Üst Uyarı Bandı',
});

export const MAINTENANCE_MESSAGES = Object.freeze({
  tr: 'Şu an bakımdayız, bize info@bosphorly.com adresinden ulaşabilirsiniz.',
  en: 'We are currently under maintenance; you can reach us at info@bosphorly.com.',
  ru: 'Сейчас ведутся технические работы; вы можете связаться с нами по адресу info@bosphorly.com.',
  uk: 'Зараз тривають технічні роботи; ви можете зв’язатися з нами за адресою info@bosphorly.com.',
  de: 'Wir führen gerade Wartungsarbeiten durch; Sie erreichen uns unter info@bosphorly.com.',
  fr: 'Nous sommes actuellement en maintenance ; vous pouvez nous contacter à info@bosphorly.com.',
  nl: 'We voeren momenteel onderhoud uit; u kunt ons bereiken via info@bosphorly.com.',
  ar: 'نحن في وضع الصيانة حاليًا؛ يمكنكم التواصل معنا عبر info@bosphorly.com.',
  he: 'אנחנו כעת בתחזוקה; ניתן לפנות אלינו בכתובת info@bosphorly.com.',
  az: 'Hazırda texniki baxımdayıq, bizimlə info@bosphorly.com ünvanından əlaqə saxlaya bilərsiniz.',
  fa: 'در حال حاضر در وضعیت تعمیرات هستیم؛ می‌توانید از طریق info@bosphorly.com با ما در تماس باشید.',
  es: 'Estamos en mantenimiento en este momento; puedes contactarnos en info@bosphorly.com.',
  it: 'Siamo attualmente in manutenzione; puoi contattarci a info@bosphorly.com.',
  pt: 'Estamos em manutenção no momento; você pode entrar em contato pelo info@bosphorly.com.',
  hr: 'Trenutačno smo u održavanju; možete nam se javiti na info@bosphorly.com.',
  hu: 'Jelenleg karbantartást végzünk; az info@bosphorly.com címen érhet el minket.',
  bs: 'Trenutno smo na održavanju; možete nam se javiti na info@bosphorly.com.',
  zh: '我们目前正在维护中，您可以通过 info@bosphorly.com 联系我们。',
  ja: 'ただいまメンテナンス中です。info@bosphorly.com までご連絡ください。',
  ko: '현재 점검 중입니다. info@bosphorly.com으로 문의해 주세요.',
  hi: 'हम अभी रखरखाव में हैं; आप हमसे info@bosphorly.com पर संपर्क कर सकते हैं।',
  bn: 'আমরা এখন রক্ষণাবেক্ষণে আছি; আমাদের সাথে info@bosphorly.com-এ যোগাযোগ করতে পারেন।',
  id: 'Saat ini kami sedang dalam pemeliharaan; Anda dapat menghubungi kami di info@bosphorly.com.',
});

export function maintenanceMessage(lang) {
  const code = String(lang || 'en').trim().toLowerCase().split(/[-_]/)[0];
  return MAINTENANCE_MESSAGES[code === 'in' ? 'id' : code] || MAINTENANCE_MESSAGES.en;
}

export function isEnvLocked(env, channel) {
  const key = ENV_LOCK_KEYS[channel];
  return Boolean(key && String(env?.[key] || '').trim() === '1');
}

function defaultStored() {
  return { whatsapp: true, telegram: true, instagram: true, mimo: true, banner: '' };
}

function normalizeStored(parsed) {
  const base = defaultStored();
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return base;
  for (const ch of EMERGENCY_CHANNELS) {
    base[ch] = parsed[ch] !== false;
  }
  base.banner = typeof parsed.banner === 'string' ? parsed.banner.slice(0, 500) : '';
  return base;
}

// Fail-open on D1 read errors for live message handlers: only env override (*_DISABLED=1)
// or an explicit stored `false` record stops message processing.
export async function isChannelDisabled(env, channel) {
  if (isEnvLocked(env, channel)) return true;
  if (!env?.DB) return false;
  try {
    const row = await env.DB.prepare("SELECT value_json FROM extranet_settings WHERE key='channels'").bind().first();
    if (!row || typeof row.value_json !== 'string') return false;
    const parsed = JSON.parse(row.value_json);
    return parsed?.[channel] === false;
  } catch {
    return false;
  }
}

export async function readChannelStateStrict(env) {
  if (!env?.DB) throw new Error('db_unavailable');
  const row = await env.DB.prepare("SELECT value_json, updated_by, updated_at FROM extranet_settings WHERE key='channels'").bind().first();
  let stored = defaultStored();
  if (row && typeof row.value_json === 'string') {
    const parsed = JSON.parse(row.value_json);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid_channel_state');
    stored = normalizeStored(parsed);
  }
  const channels = {};
  const publicPayload = { banner: stored.banner };
  for (const ch of EMERGENCY_CHANNELS) {
    const lockedByEnv = isEnvLocked(env, ch);
    const enabled = stored[ch] && !lockedByEnv;
    channels[ch] = {
      enabled,
      stored: stored[ch],
      lockedByEnv,
      envVar: ENV_LOCK_KEYS[ch],
    };
    publicPayload[ch] = enabled;
  }
  return {
    stored,
    channels,
    publicPayload,
    updatedBy: row?.updated_by || null,
    updatedAt: row?.updated_at || null,
  };
}

export async function publicChannelsResponse(env) {
  try {
    const state = await readChannelStateStrict(env);
    return new Response(JSON.stringify(state.publicPayload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=20, s-maxage=30',
        'X-Content-Type-Options': 'nosniff',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Channel status unavailable' }), {
      status: 503,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}

export function resolveSupportEmails(env) {
  const raw = typeof env?.SUPPORT_EMAILS === 'string' ? env.SUPPORT_EMAILS : '';
  const seen = new Set();
  const list = [];
  for (const part of raw.split(',')) {
    const email = part.trim().toLowerCase();
    if (email && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !seen.has(email)) {
      seen.add(email);
      list.push(email);
    }
  }
  if (!list.length) return ['info@bosphorly.com'];
  return list;
}

export async function sendEmergencyEmail(env, { target, statusText, actorLabel, nowSql, detailText = '' }) {
  const from = env?.MAIL_FROM || env?.REQUEST_FROM_EMAIL;
  if (!env?.RESEND_API_KEY || !from) return false;
  const to = resolveSupportEmails(env);
  const label = CHANNEL_LABELS[target] || target;
  const lines = [
    'Bosphorly Acil Durum Kanal Bildirimi',
    '',
    `Kanal / Hedef: ${label} (${target})`,
    `İşlem / Durum: ${statusText}`,
    `Zaman (UTC): ${nowSql}`,
    `İşlemi yapan: ${actorLabel}`,
    detailText ? `Detay: ${detailText}` : '',
  ].filter(Boolean);
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: AbortSignal.timeout(5000),
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject: `[ACİL DURUM] Bosphorly · ${label} — ${statusText}`,
        text: lines.join('\n'),
      }),
    });
    return Boolean(res && res.ok);
  } catch {
    return false;
  }
}

async function sendAdminTelegramNotice(env, text) {
  if (!env?.TELEGRAM_ADMIN_CHAT_ID || !env?.TELEGRAM_BOT_TOKEN) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      signal: AbortSignal.timeout(5000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_ADMIN_CHAT_ID, text }),
    });
    return Boolean(res && res.ok);
  } catch {
    return false;
  }
}

function sqlNow(nowMs = Date.now()) {
  return new Date(nowMs).toISOString().replace('T', ' ').slice(0, 19);
}

// Telegram backup emergency close command:
// ONLY from TELEGRAM_ADMIN_CHAT_ID: /acil_kapat whatsapp|telegram|instagram|mimo|hepsi
// Opening from Telegram is strictly forbidden.
export async function adminEmergencyTelegram(env, chat, sender, text, nowMs = Date.now()) {
  const raw = typeof text === 'string' ? text.trim() : '';
  if (!raw) return false;

  const isAdmin = Boolean(
    env?.TELEGRAM_ADMIN_CHAT_ID &&
    String(chat) === String(env.TELEGRAM_ADMIN_CHAT_ID) &&
    String(sender) === String(env.TELEGRAM_ADMIN_CHAT_ID)
  );

  if (/^\/acil_(?:ac|aç|open)(?:@\w+)?(?:\s|$)/iu.test(raw)) {
    if (isAdmin) {
      await sendAdminTelegramNotice(env, 'Güvenlik kuralı: Kanallar Telegram üzerinden açılamaz; yalnızca Extranet Acil Durum panelinden AÇ onayıyla açılabilir.');
    }
    return true;
  }

  if (!/^\/acil_kapat(?:@\w+)?(?:\s|$)/iu.test(raw)) return false;
  if (!isAdmin) return true;

  const m = /^\/acil_kapat(?:@\w+)?(?:\s+(\S+))?\s*$/iu.exec(raw);
  const arg = m && m[1] ? m[1].trim().toLowerCase() : '';
  const validTargets = new Set([...EMERGENCY_CHANNELS, 'hepsi']);
  if (!validTargets.has(arg)) {
    await sendAdminTelegramNotice(env, 'Kullanım: /acil_kapat whatsapp|telegram|instagram|mimo|hepsi');
    return true;
  }

  if (!env?.DB) return true;
  const nowSql = sqlNow(nowMs);
  let oldStored = defaultStored();
  try {
    const current = await readChannelStateStrict(env);
    oldStored = current.stored;
  } catch {}

  const nextStored = { ...oldStored };
  const targets = arg === 'hepsi' ? [...EMERGENCY_CHANNELS] : [arg];
  for (const ch of targets) nextStored[ch] = false;

  const actorId = `telegram:${String(chat)}`;
  const upsertStmt = env.DB.prepare(
    "INSERT INTO extranet_settings(key,value_json,updated_by,updated_at) VALUES('channels',?,?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_by=excluded.updated_by,updated_at=excluded.updated_at"
  ).bind(JSON.stringify(nextStored), actorId, nowSql);
  const auditStmt = env.DB.prepare(
    `INSERT INTO extranet_audit (id, actor_member_id, actor_role, action, target_type, target_id, old_value, new_value, ip_address, created_at)
     VALUES (?, ?, 'owner', 'emergency_channel_close', 'channel', ?, ?, ?, 'telegram', ?)`
  ).bind(crypto.randomUUID(), actorId, arg, JSON.stringify(oldStored), JSON.stringify(nextStored), nowSql);

  if (typeof env.DB.batch === 'function') {
    await env.DB.batch([upsertStmt, auditStmt]);
  } else {
    await upsertStmt.run();
    await auditStmt.run();
  }

  await sendEmergencyEmail(env, {
    target: arg,
    statusText: 'KAPATILDI',
    actorLabel: `Telegram Admin (${String(chat)})`,
    nowSql,
  });
  await sendAdminTelegramNotice(env, `Acil kapatma uygulandı: ${CHANNEL_LABELS[arg]} → KAPALI (${nowSql} UTC)`);
  return true;
}

async function buildEmergencyBundle(env) {
  const state = await readChannelStateStrict(env);
  let audit = [];
  try {
    const res = await env.DB.prepare(
      "SELECT id, actor_member_id, actor_role, action, target_type, target_id, old_value, new_value, created_at FROM extranet_audit WHERE target_type IN ('channel','emergency_banner') ORDER BY created_at DESC LIMIT 20"
    ).bind().all();
    audit = res?.results || [];
  } catch {}
  return {
    channels: state.channels,
    banner: state.stored.banner,
    updatedBy: state.updatedBy,
    updatedAt: state.updatedAt,
    audit,
  };
}

export async function emergencyRoutes(request, env, url, nowMs, h) {
  if (url.pathname !== '/v1/extranet/emergency') return null;

  const actor = await h.auth(request, env, ['owner'], nowMs);
  if (actor.role !== 'owner' || !h.ownerEmail(env, actor.email)) {
    h.fail(403, 'Acil Durum panelini yalnızca işletme sahibi (OWNER_EMAILS) kullanabilir.', 'ROLE_FORBIDDEN');
  }

  const nowSql = sqlNow(nowMs);
  const respond = (data, status = 200) => h.json(data, status, { 'Set-Cookie': h.cookie(actor.rawCookie) });

  if (request.method === 'GET') {
    return respond(await buildEmergencyBundle(env));
  }

  if (request.method !== 'POST') {
    h.fail(405, 'Desteklenmeyen HTTP metodu.');
  }

  const b = await h.body(request, 4096);
  const allowedKeys = new Set(['channel', 'enabled', 'confirm', 'confirmText', 'banner']);
  if (Object.keys(b).some((k) => !allowedKeys.has(k))) {
    h.fail(400, 'Geçersiz acil durum isteği alanı.');
  }

  const current = await readChannelStateStrict(env);
  const oldStored = current.stored;

  if (b.channel !== undefined) {
    const ch = typeof b.channel === 'string' ? b.channel.trim().toLowerCase() : '';
    const validTargets = new Set([...EMERGENCY_CHANNELS, 'hepsi']);
    if (!validTargets.has(ch) || typeof b.enabled !== 'boolean') {
      h.fail(400, 'Geçerli bir kanal ve durum seçin.');
    }
    if (ch === 'hepsi' && b.enabled === true) {
      h.fail(400, 'Güvenlik gereği kanallar yalnızca tek tek "AÇ" onayıyla açılabilir.');
    }
    if (b.enabled === false) {
      if (b.confirm !== true) {
        h.fail(400, 'Kanalı kapatmak için onay gerekli.', 'CLOSE_CONFIRM_REQUIRED');
      }
    } else {
      if (typeof b.confirmText !== 'string' || b.confirmText.trim() !== 'AÇ') {
        h.fail(400, 'Kanalı yeniden açmak için onay alanına "AÇ" yazmalısınız.', 'OPEN_CONFIRM_REQUIRED');
      }
      if (isEnvLocked(env, ch)) {
        h.fail(409, `Bu kanal ortam değişkeniyle kilitli (${ENV_LOCK_KEYS[ch]}=1). Önce ortam değişkenini kaldırın.`, 'ENV_LOCKED');
      }
    }

    const nextStored = { ...oldStored };
    const targets = ch === 'hepsi' ? [...EMERGENCY_CHANNELS] : [ch];
    for (const k of targets) nextStored[k] = b.enabled;

    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO extranet_settings(key,value_json,updated_by,updated_at) VALUES('channels',?,?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_by=excluded.updated_by,updated_at=excluded.updated_at"
      ).bind(JSON.stringify(nextStored), actor.memberId, nowSql),
      h.audit(env, {
        actorMemberId: actor.memberId,
        actorRole: 'owner',
        action: b.enabled ? 'emergency_channel_open' : 'emergency_channel_close',
        targetType: 'channel',
        targetId: ch,
        oldValue: oldStored,
        newValue: nextStored,
        ipAddress: actor.ipAddress,
        nowSql,
      }),
    ]);

    const emailSent = await sendEmergencyEmail(env, {
      target: ch,
      statusText: b.enabled ? 'AÇILDI' : 'KAPATILDI',
      actorLabel: `${actor.email} (Extranet Owner)`,
      nowSql,
    });

    return respond({ ...(await buildEmergencyBundle(env)), saved: true, emailSent });
  }

  if (b.banner !== undefined) {
    if (typeof b.banner !== 'string') {
      h.fail(400, 'Geçerli bir uyarı bandı metni girin.');
    }
    const clean = b.banner.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim();
    if (clean.length > 500) {
      h.fail(400, 'Uyarı bandı metni en fazla 500 karakter olabilir.');
    }
    if (clean && h.containsCard(clean)) {
      h.fail(400, 'Güvenlik kuralı: Uyarı bandına kart numarası yazılamaz.');
    }

    const nextStored = { ...oldStored, banner: clean };
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO extranet_settings(key,value_json,updated_by,updated_at) VALUES('channels',?,?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_by=excluded.updated_by,updated_at=excluded.updated_at"
      ).bind(JSON.stringify(nextStored), actor.memberId, nowSql),
      h.audit(env, {
        actorMemberId: actor.memberId,
        actorRole: 'owner',
        action: 'emergency_banner_update',
        targetType: 'emergency_banner',
        targetId: 'banner',
        oldValue: { banner: oldStored.banner },
        newValue: { banner: clean },
        ipAddress: actor.ipAddress,
        nowSql,
      }),
    ]);

    const emailSent = await sendEmergencyEmail(env, {
      target: 'banner',
      statusText: clean ? 'GÜNCELLENDİ' : 'KALDIRILDI',
      actorLabel: `${actor.email} (Extranet Owner)`,
      nowSql,
      detailText: clean || '(boş)',
    });

    return respond({ ...(await buildEmergencyBundle(env)), saved: true, emailSent });
  }

  h.fail(400, 'Değiştirilecek kanal veya uyarı bandı belirtilmeli.');
}
