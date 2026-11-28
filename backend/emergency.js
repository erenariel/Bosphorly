// Independent Emergency & Security Center module for Bosphorly.
// Isolates channel kill-switches, dual-account HMAC OTP verification, public channel status,
// Telegram emergency close requests, immutable security audit logging, and persistent notification retries.

import { detectLanguage, SUPPORTED_LANGS } from './assistant.js';

export const EMERGENCY_OWNER_EMAIL = 'info@bosphorly.com';
export const EMERGENCY_CHANNELS = Object.freeze(['whatsapp', 'telegram', 'instagram', 'mimo']);
export const EMERGENCY_TARGETS = Object.freeze(['whatsapp', 'telegram', 'instagram', 'mimo', 'all', 'banner']);
export const EMERGENCY_ACTIONS = Object.freeze([
  'close',
  'reopen',
  'close_all',
  'reopen_all',
  'banner_enable',
  'banner_disable',
  'banner_update',
]);

export const ENV_LOCK_VARS = Object.freeze({
  whatsapp: 'WHATSAPP_DISABLED',
  telegram: 'TELEGRAM_DISABLED',
  instagram: 'INSTAGRAM_DISABLED',
  mimo: 'MIMO_DISABLED',
});

export const ENV_LOCK_WARNING = 'Ortam değişkeniyle güvenlik kilidi uygulanmış';

export const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const OTP_COOLDOWN_MS = 60 * 1000; // 60 seconds
export const OTP_MAX_ATTEMPTS = 3;
const DROPPED_MSG_TTL_MS = 7 * 86400 * 1000;
const TG_REQ_TTL_MS = 30 * 60 * 1000;
const KV_STATE_TTL_SEC = 2592000; // 30 days (within KV mock & Cloudflare bounds)

export const MIMO_MAINTENANCE_MESSAGES = Object.freeze({
  tr: 'Şu anda bakımdayız. Bize info@bosphorly.com adresinden ulaşabilirsiniz.',
  en: 'We are currently undergoing maintenance. You can reach us at info@bosphorly.com.',
  ru: 'Сейчас ведутся технические работы. Вы можете связаться с нами по адресу info@bosphorly.com.',
  uk: 'Зараз тривають технічні роботи. Ви можете зв’язатися з нами за адресою info@bosphorly.com.',
  de: 'Wir führen derzeit Wartungsarbeiten durch. Sie erreichen uns unter info@bosphorly.com.',
  fr: 'Nous sommes actuellement en maintenance. Vous pouvez nous contacter à info@bosphorly.com.',
  nl: 'We voeren momenteel onderhoud uit. U kunt ons bereiken via info@bosphorly.com.',
  ar: 'نحن في وضع الصيانة حاليًا. يمكنكم التواصل معنا عبر info@bosphorly.com.',
  he: 'אנחנו בתחזוקה כעת. ניתן ליצור איתנו קשר בכתובת info@bosphorly.com.',
  az: 'Hazırda texniki baxışdayıq. Bizimlə info@bosphorly.com ünvanı vasitəsilə əlaqə saxlaya bilərsiniz.',
  fa: 'در حال حاضر در وضعیت تعمیرات هستیم. می‌توانید از طریق info@bosphorly.com با ما در ارتباط باشید.',
  es: 'Actualmente estamos en mantenimiento. Puede contactarnos en info@bosphorly.com.',
  it: 'Siamo attualmente in manutenzione. Puoi contattarci all’indirizzo info@bosphorly.com.',
  pt: 'Estamos atualmente em manutenção. Você pode entrar em contato conosco pelo info@bosphorly.com.',
  hr: 'Trenutačno smo u održavanju. Možete nam se javiti na info@bosphorly.com.',
  hu: 'Jelenleg karbantartást végzünk. Elérhet minket az info@bosphorly.com címen.',
  bs: 'Trenutno smo u održavanju. Možete nam se obratiti na info@bosphorly.com.',
  zh: '我们目前正在维护中。您可以通过 info@bosphorly.com 联系我们。',
  ja: '現在メンテナンス中です。info@bosphorly.com までご連絡ください。',
  ko: '현재 점검 중입니다. info@bosphorly.com으로 문의해 주세요.',
  hi: 'हम अभी रखरखाव में हैं। आप हमसे info@bosphorly.com पर संपर्क कर सकते हैं।',
  bn: 'আমরা বর্তমানে রক্ষণাবেক্ষণে আছি। আমাদের সাথে info@bosphorly.com-এ যোগাযোগ করতে পারেন।',
  id: 'Saat ini kami sedang dalam pemeliharaan. Anda dapat menghubungi kami di info@bosphorly.com.',
});

export const BANNER_PRESETS = Object.freeze({
  whatsapp_closed: Object.freeze({
    tr: 'WhatsApp hesabımız geçici olarak kapalıdır. Başka numaralardan gelen mesajlara itibar etmeyin. Bize yalnızca info@bosphorly.com üzerinden ulaşın.',
    en: 'Our WhatsApp line is temporarily closed. Disregard messages from any other numbers and contact us only via info@bosphorly.com.',
    ru: 'Наш WhatsApp временно закрыт. Не доверяйте сообщениям с других номеров. Связывайтесь с нами только через info@bosphorly.com.',
    uk: 'Наш WhatsApp тимчасово закритий. Не довіряйте повідомленням з інших номерів. Пишіть нам лише на info@bosphorly.com.',
    de: 'Unser WhatsApp-Konto ist vorübergehend geschlossen. Vertrauen Sie keinen Nachrichten von anderen Nummern. Kontaktieren Sie uns nur über info@bosphorly.com.',
    fr: 'Notre compte WhatsApp est temporairement fermé. Ne tenez pas compte des messages provenant d’autres numéros. Contactez-nous uniquement via info@bosphorly.com.',
    nl: 'Ons WhatsApp-account is tijdelijk gesloten. Vertrouw geen berichten van andere nummers. Neem alleen contact op via info@bosphorly.com.',
    ar: 'حسابنا على واتساب مغلق مؤقتًا. لا تثقوا بالرسائل الواردة من أرقام أخرى وتواصلوا معنا فقط عبر info@bosphorly.com.',
    he: 'חשבון הוואטסאפ שלנו סגור זמנית. אל תסתמכו על הודעות ממספרים אחרים ופנו אלינו רק דרך info@bosphorly.com.',
    az: 'WhatsApp hesabımız müvəqqəti olaraq bağlıdır. Başqa nömrələrdən gələn mesajlara etibar etməyin. Bizimlə yalnız info@bosphorly.com vasitəsilə əlaqə saxlayın.',
    fa: 'حساب واتساپ ما موقتاً بسته است. به پیام‌های سایر شماره‌ها اعتماد نکنید و فقط از طریق info@bosphorly.com با ما تماس بگیرید.',
    es: 'Nuestra cuenta de WhatsApp está temporalmente cerrada. No confíe en mensajes de otros números; contáctenos solo en info@bosphorly.com.',
    it: 'Il nostro account WhatsApp è temporaneamente chiuso. Non fidarti di messaggi da altri numeri; contattaci solo tramite info@bosphorly.com.',
    pt: 'Nossa conta do WhatsApp está temporariamente fechada. Não confie em mensagens de outros números; fale conosco apenas por info@bosphorly.com.',
    hr: 'Naš WhatsApp račun privremeno je zatvoren. Ne vjerujte porukama s drugih brojeva; javite nam se isključivo na info@bosphorly.com.',
    hu: 'WhatsApp-fiókunk átmenetileg zárva tart. Ne bízzon más számokról érkező üzenetekben; kizárólag az info@bosphorly.com címen keressen minket.',
    bs: 'Naš WhatsApp račun je privremeno zatvoren. Ne vjerujte porukama s drugih brojeva; kontaktirajte nas isključivo putem info@bosphorly.com.',
    zh: '我们的 WhatsApp 账号暂时关闭。请勿轻信其他号码发来的消息，仅通过 info@bosphorly.com 与我们联系。',
    ja: '当社のWhatsAppアカウントは一時休止中です。他の番号からの連絡にはご注意いただき、info@bosphorly.com のみをご利用ください。',
    ko: '당사 WhatsApp 계정이 일시 중단되었습니다. 다른 번호의 메시지를 신뢰하지 마시고 info@bosphorly.com으로만 연락해 주세요.',
    hi: 'हमारा WhatsApp खाता अस्थायी रूप से बंद है। अन्य नंबरों से आने वाले संदेशों पर भरोसा न करें; केवल info@bosphorly.com के माध्यम से संपर्क करें।',
    bn: 'আমাদের WhatsApp অ্যাকাউন্ট সাময়িকভাবে বন্ধ রয়েছে। অন্য নম্বর থেকে আসা বার্তায় আস্থা রাখবেন না; শুধুমাত্র info@bosphorly.com-এ যোগাযোগ করুন।',
    id: 'Akun WhatsApp kami ditutup sementara. Jangan percayai pesan dari nomor lain dan hubungi kami hanya melalui info@bosphorly.com.',
  }),
  telegram_closed: Object.freeze({
    tr: 'Telegram hattımız geçici olarak kapalıdır. Başka hesaplardan gelen mesajlara itibar etmeyin. Bize yalnızca info@bosphorly.com üzerinden ulaşın.',
    en: 'Our Telegram channel is temporarily closed. Disregard messages from other accounts and contact us only via info@bosphorly.com.',
  }),
  instagram_closed: Object.freeze({
    tr: 'Instagram hesabımız geçici olarak kapalıdır. Başka hesaplardan gelen mesajlara itibar etmeyin. Bize yalnızca info@bosphorly.com üzerinden ulaşın.',
    en: 'Our Instagram account is temporarily closed. Disregard messages from other accounts and contact us only via info@bosphorly.com.',
  }),
  all_closed: Object.freeze({
    tr: 'Sosyal mesajlaşma kanallarımız geçici olarak bakımdadır. Başka numara veya hesaplardan gelen mesajlara itibar etmeyin. Bize yalnızca info@bosphorly.com üzerinden ulaşın.',
    en: 'Our messaging channels are temporarily offline for security maintenance. Contact us exclusively via info@bosphorly.com.',
  }),
});

const enc = new TextEncoder();
const isolateStateCache = new WeakMap();

function toHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(input) {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(String(input))));
}

export async function hmacSha256Hex(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(String(secret)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(String(message))));
}

export function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function sqlNow(nowMs = Date.now()) {
  return new Date(nowMs).toISOString().replace('T', ' ').slice(0, 19);
}

function isValidEmail(raw) {
  if (typeof raw !== 'string') return false;
  const s = raw.trim();
  return s.length >= 5 && s.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s);
}

function maskEmailAddr(rawEmail) {
  const e = String(rawEmail || '').trim();
  if (!e || !e.includes('@')) return null;
  const [local, domain] = e.split('@');
  if (!local || !domain) return '***';
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

export function generateSecureSixDigitCode() {
  const arr = new Uint32Array(1);
  // 4294000000 is the largest multiple of 1,000,000 <= 2^32 - 1 (zero modulo bias).
  for (;;) {
    crypto.getRandomValues(arr);
    if (arr[0] < 4294000000) {
      return String(arr[0] % 1000000).padStart(6, '0');
    }
  }
}

export function getMimoMaintenanceMessage(lang = 'en') {
  const code = String(lang || '').trim().toLowerCase().split(/[-_]/)[0];
  const normalized = code === 'in' ? 'id' : code;
  return MIMO_MAINTENANCE_MESSAGES[normalized] || MIMO_MAINTENANCE_MESSAGES.en;
}

export function sanitizeBannerText(raw) {
  if (typeof raw !== 'string') return '';
  let text = raw
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/vbscript\s*:/gi, '')
    .replace(/data\s*:\s*text\/html/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length > 500) text = text.slice(0, 500).trim();
  return text;
}

export function isChannelEnvLocked(env, channel) {
  const varName = ENV_LOCK_VARS[channel];
  if (!varName || !env) return false;
  return String(env[varName] || '').trim() === '1';
}

function primaryDb(env) {
  if (!env || !env.DB) return null;
  if (typeof env.DB.withSession === 'function') {
    try {
      return env.DB.withSession('first-primary');
    } catch {
      return env.DB;
    }
  }
  return env.DB;
}

function getIsolateMap(env) {
  if (!env || !env.DB || typeof env.DB !== 'object') return null;
  try {
    let map = isolateStateCache.get(env.DB);
    if (!map) {
      map = new Map();
      isolateStateCache.set(env.DB, map);
    }
    return map;
  } catch {
    return null;
  }
}

const CHANNEL_GUARD_D1_TIMEOUT_MS = 1200;
const CHANNEL_GUARD_KV_TIMEOUT_MS = 600;

function withBoundedTimeout(promise, ms, code = 'emergency_io_timeout') {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(code)), ms);
  });
  return Promise.race([Promise.resolve(promise), timeoutPromise]).finally(() => clearTimeout(timer));
}

async function readKvJson(env, key) {
  if (!env || !env.WHATSAPP_KV || typeof env.WHATSAPP_KV.get !== 'function') return null;
  try {
    const val = await withBoundedTimeout(env.WHATSAPP_KV.get(key, 'json'), CHANNEL_GUARD_KV_TIMEOUT_MS, 'emergency_kv_timeout');
    if (!val) return null;
    if (typeof val === 'string') return JSON.parse(val);
    if (typeof val === 'object') return val;
    return null;
  } catch {
    return null;
  }
}

async function writeKvJson(env, key, obj) {
  if (!env || !env.WHATSAPP_KV || typeof env.WHATSAPP_KV.put !== 'function') return;
  try {
    await withBoundedTimeout(
      env.WHATSAPP_KV.put(key, JSON.stringify(obj), { expirationTtl: KV_STATE_TTL_SEC }),
      CHANNEL_GUARD_KV_TIMEOUT_MS,
      'emergency_kv_timeout'
    );
  } catch {
    // Best-effort secondary mirror; D1 primary remains source of truth.
  }
}

function isMissingEmergencyTableError(err) {
  const msg = String(err?.message || '');
  return /no such table:\s*emergency_/i.test(msg);
}

async function readChannelRecordWithContinuity(env, channel) {
  if (isChannelEnvLocked(env, channel)) {
    return {
      enabled: false,
      envLocked: true,
      lastClosedAtMs: 0,
      lastReopenedAtMs: 0,
      known: true,
      fromFallback: false,
    };
  }
  const db = primaryDb(env);
  if (!db || typeof db.prepare !== 'function') {
    return { enabled: channel !== 'banner', envLocked: false, lastClosedAtMs: 0, lastReopenedAtMs: 0, known: true, fromFallback: false };
  }

  let isoMap = null;
  try {
    isoMap = getIsolateMap(env);
    const row = await withBoundedTimeout(
      db
        .prepare(
          'SELECT enabled, banner_text, banner_preset, last_closed_at_ms, last_reopened_at_ms, updated_at_ms FROM emergency_channel_states WHERE channel = ?'
        )
        .bind(channel)
        .first(),
      CHANNEL_GUARD_D1_TIMEOUT_MS,
      'emergency_d1_timeout'
    );

    if (!row) {
      const openDefault = channel !== 'banner';
      const state = {
        enabled: openDefault,
        bannerText: '',
        bannerPreset: '',
        lastClosedAtMs: 0,
        lastReopenedAtMs: 0,
        updatedAtMs: 0,
      };
      if (isoMap) isoMap.set(channel, state);
      return { ...state, envLocked: false, known: true, fromFallback: false };
    }

    const state = {
      enabled: Number(row.enabled) === 1,
      bannerText: sanitizeBannerText(row.banner_text || ''),
      bannerPreset: typeof row.banner_preset === 'string' ? row.banner_preset : '',
      lastClosedAtMs: Number(row.last_closed_at_ms || 0),
      lastReopenedAtMs: Number(row.last_reopened_at_ms || 0),
      updatedAtMs: Number(row.updated_at_ms || 0),
    };
    const prevMem = isoMap ? isoMap.get(channel) : null;
    if (isoMap) isoMap.set(channel, state);
    if (!prevMem || Number(prevMem.updatedAtMs || 0) !== state.updatedAtMs) {
      const kvExisting = await readKvJson(env, `emergency:ch:${channel}`);
      if (!kvExisting || Number(kvExisting.updatedAtMs || 0) !== state.updatedAtMs) {
        // Mirror explicit state rows into persistent KV only when updatedAtMs changed so a closed channel never reopens on D1 blips across isolates.
        await writeKvJson(env, `emergency:ch:${channel}`, state);
      }
    }
    return { ...state, envLocked: false, known: true, fromFallback: false };
  } catch (err) {
    if (isMissingEmergencyTableError(err)) {
      return {
        enabled: channel !== 'banner',
        bannerText: '',
        bannerPreset: '',
        lastClosedAtMs: 0,
        lastReopenedAtMs: 0,
        envLocked: false,
        known: true,
        fromFallback: false,
      };
    }

    // Transient D1 read error or timeout: check persistent KV mirror + isolate cache so previously closed channels stay closed
    // and previously open channels keep running without disruption.
    const memCached = isoMap ? isoMap.get(channel) : null;
    const kvCached = await readKvJson(env, `emergency:ch:${channel}`);
    let chosen = null;
    if (memCached && kvCached) {
      chosen = Number(kvCached.updatedAtMs || 0) > Number(memCached.updatedAtMs || 0) ? kvCached : memCached;
      // Fail-safe tie-breaker: if timestamps match and either says disabled, stay disabled.
      if (Number(kvCached.updatedAtMs || 0) === Number(memCached.updatedAtMs || 0) && (!kvCached.enabled || !memCached.enabled)) {
        chosen = !kvCached.enabled ? kvCached : memCached;
      }
    } else {
      chosen = kvCached || memCached || null;
    }

    if (chosen) {
      return {
        enabled: Boolean(chosen.enabled),
        bannerText: sanitizeBannerText(chosen.bannerText || ''),
        bannerPreset: typeof chosen.bannerPreset === 'string' ? chosen.bannerPreset : '',
        lastClosedAtMs: Number(chosen.lastClosedAtMs || 0),
        lastReopenedAtMs: Number(chosen.lastReopenedAtMs || 0),
        envLocked: false,
        known: true,
        fromFallback: true,
      };
    }

    return {
      enabled: channel !== 'banner',
      bannerText: '',
      bannerPreset: '',
      lastClosedAtMs: 0,
      lastReopenedAtMs: 0,
      envLocked: false,
      known: false,
      fromFallback: true,
    };
  }
}

export async function isChannelEnabled(env, channel) {
  if (!EMERGENCY_CHANNELS.includes(channel)) return true;
  if (isChannelEnvLocked(env, channel)) return false;
  const record = await readChannelRecordWithContinuity(env, channel);
  return Boolean(record.enabled);
}

async function recordDroppedMessage(env, channel, messageKey, nowMs = Date.now()) {
  if (!messageKey) return;
  const db = primaryDb(env);
  if (!db || typeof db.prepare !== 'function') return;
  try {
    await withBoundedTimeout(
      db
        .prepare(
          `INSERT OR IGNORE INTO emergency_dropped_messages (channel, message_key, dropped_at_ms, expires_at_ms)
           VALUES (?, ?, ?, ?)`
        )
        .bind(channel, String(messageKey).slice(0, 160), nowMs, nowMs + DROPPED_MSG_TTL_MS)
        .run(),
      CHANNEL_GUARD_D1_TIMEOUT_MS,
      'emergency_d1_timeout'
    );
  } catch {
    // Best-effort recording; must never break webhook 200 ACK.
  }
}

async function wasMessageInClosedPeriod(env, channel, messageKey, messageAtMs, lastClosedAtMs) {
  if (!lastClosedAtMs || lastClosedAtMs <= 0) return false;
  const db = primaryDb(env);
  if (!db || typeof db.prepare !== 'function') return false;
  try {
    if (messageKey) {
      const dropped = await withBoundedTimeout(
        db
          .prepare('SELECT message_key FROM emergency_dropped_messages WHERE channel = ? AND message_key = ?')
          .bind(channel, String(messageKey).slice(0, 160))
          .first(),
        CHANNEL_GUARD_D1_TIMEOUT_MS,
        'emergency_d1_timeout'
      );
      if (dropped) return true;
    }
    if (Number.isFinite(messageAtMs) && messageAtMs > 0) {
      // WhatsApp/Telegram message timestamps have 1-second resolution (ts * 1000).
      // Floor reopened_at_ms to whole seconds so a message sent in the same second right after reopen is never dropped.
      const win = await withBoundedTimeout(
        db
          .prepare(
            `SELECT id FROM emergency_closed_windows
             WHERE channel = ? AND closed_at_ms <= ? AND (reopened_at_ms IS NULL OR ? < (reopened_at_ms / 1000) * 1000)
             LIMIT 1`
          )
          .bind(channel, messageAtMs, messageAtMs)
          .first(),
        CHANNEL_GUARD_D1_TIMEOUT_MS,
        'emergency_d1_timeout'
      );
      if (win) return true;
    }
  } catch {
    return false;
  }
  return false;
}

export async function allowWhatsAppWebhook(env, raw, nowMs = Date.now()) {
  let msgId = '';
  let msgAtMs = 0;
  let isMessageEvent = false;
  let parsedValidObject = false;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (parsed && typeof parsed === 'object') {
      parsedValidObject = true;
      const d = parsed?.data;
      const p = d?.payload;
      if (p && p.type === 'WHATSAPP' && typeof p.id === 'string') {
        if (d.event_type === 'message.received' || d.event_type === 'message.echo') {
          isMessageEvent = true;
          msgId = p.id;
          const ts = Number(p.body?.timestamp);
          if (Number.isFinite(ts) && ts > 0) msgAtMs = ts * 1000;
        }
      }
    }
  } catch {
    // Invalid JSON continues to handleWhatsApp's own 400 handler when open, or is safely ignored when closed.
  }

  if (isChannelEnvLocked(env, 'whatsapp')) {
    if (isMessageEvent && msgId) {
      await recordDroppedMessage(env, 'whatsapp', msgId, nowMs);
    }
    return false;
  }

  // Delivery status webhooks (message.sent / message.finalized / message.read) never trigger Mimo replies;
  // avoid unnecessary D1 round-trips inside Telnyx's 2-second webhook ACK budget.
  if (parsedValidObject && !isMessageEvent) {
    return true;
  }

  const record = await readChannelRecordWithContinuity(env, 'whatsapp');
  if (!record.enabled) {
    if (isMessageEvent && msgId) {
      await recordDroppedMessage(env, 'whatsapp', msgId, nowMs);
    }
    return false;
  }

  if (isMessageEvent && record.lastClosedAtMs > 0) {
    if (await wasMessageInClosedPeriod(env, 'whatsapp', msgId, msgAtMs, record.lastClosedAtMs)) {
      return false;
    }
  }
  return true;
}

async function sendAdminTelegramNotice(env, chatId, text) {
  if (!env?.TELEGRAM_BOT_TOKEN || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      signal: AbortSignal.timeout(5000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch {
    // Admin reply failure never blocks recording the request.
  }
}

async function writeSecurityAudit(env, entry, nowMs = Date.now()) {
  const db = primaryDb(env);
  if (!db || typeof db.prepare !== 'function') return;
  try {
    await buildEmergencyAuditStmt(db, entry, nowMs).run();
  } catch {
    // Audit helper ignores unmigrated test mocks.
  }
}

function buildEmergencyAuditStmt(db, entry, nowMs = Date.now()) {
  const ser = (v) => {
    if (v === null || v === undefined) return null;
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    return s.length > 2000 ? s.slice(0, 2000) : s;
  };
  return db
    .prepare(
      `INSERT INTO emergency_audit_log
       (id, operation_id, created_at_ms, created_at, actor_email, actor_member_id, actor_role,
        channel, previous_state, new_state, action_type, source, outcome, reason, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      String(entry.operationId || crypto.randomUUID()).slice(0, 80),
      nowMs,
      sqlNow(nowMs),
      String(entry.actorEmail || 'unknown').slice(0, 254),
      entry.actorMemberId ? String(entry.actorMemberId).slice(0, 80) : null,
      String(entry.actorRole || 'unauthorized').slice(0, 40),
      String(entry.channel || 'unknown').slice(0, 40),
      ser(entry.previousState),
      ser(entry.newState),
      String(entry.actionType || 'unknown').slice(0, 60),
      ['extranet', 'telegram_command', 'public_api', 'system'].includes(entry.source) ? entry.source : 'system',
      entry.outcome === 'success' ? 'success' : 'failed',
      entry.reason ? String(entry.reason).slice(0, 240) : null,
      entry.ipAddress ? String(entry.ipAddress).slice(0, 80) : null
    );
}

async function checkEmergencyRateLimit(env, key, maxCount, windowMs, nowMs = Date.now()) {
  const db = primaryDb(env);
  if (!db || typeof db.prepare !== 'function') return true;
  try {
    const bucket = Math.floor(nowMs / windowMs);
    const dayBucket = new Date(nowMs).toISOString().slice(0, 10);
    const row = await db
      .prepare(
        `INSERT INTO assistant_rate_limits (key, min_bucket, min_count, day_bucket, day_count)
         VALUES (?, ?, 1, ?, 1)
         ON CONFLICT(key) DO UPDATE SET
           min_count = CASE WHEN min_bucket = excluded.min_bucket THEN min_count + 1 ELSE 1 END,
           min_bucket = excluded.min_bucket,
           day_bucket = excluded.day_bucket
         RETURNING min_count`
      )
      .bind(key, bucket, dayBucket)
      .first();
    return !row || Number(row.min_count) <= maxCount;
  } catch {
    return true;
  }
}

export async function guardTelegramWebhook(env, msg, nowMs = Date.now()) {
  const rawText = typeof msg?.text === 'string' ? msg.text.trim() : '';
  const cmdMatch = /^\/acil_(kapat|ac|aç)(?:@\w+)?(?:\s+(.*))?$/iu.exec(rawText);

  if (cmdMatch) {
    const subCmd = cmdMatch[1].toLowerCase();
    const arg = String(cmdMatch[2] || '').trim().toLowerCase();
    const chatId = String(msg?.chat?.id ?? '');
    const senderId = msg?.from?.id != null ? String(msg.from.id) : '';
    const adminChatId = String(env?.TELEGRAM_ADMIN_CHAT_ID || '').trim();
    const expectedOwnerTgId = String(env?.EMERGENCY_OWNER_TELEGRAM_ID || adminChatId).trim();

    const validAdminChat =
      msg?.chat?.type === 'private' &&
      Boolean(adminChatId) &&
      Boolean(expectedOwnerTgId) &&
      Boolean(senderId) &&
      constantTimeEqual(chatId, adminChatId) &&
      constantTimeEqual(senderId, expectedOwnerTgId);

    if (!validAdminChat) {
      await writeSecurityAudit(
        env,
        {
          actorEmail: 'telegram:unauthorized',
          actorRole: 'unauthorized',
          channel: arg || 'unknown',
          actionType: 'telegram_emergency_command',
          source: 'telegram_command',
          outcome: 'failed',
          reason: 'unauthorized_telegram_actor',
        },
        nowMs
      );
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Verify if Telegram identity is linked in D1 that it does not belong to a non-owner member.
    const db = primaryDb(env);
    if (db && typeof db.prepare === 'function') {
      try {
        const linked = await db
          .prepare(
            `SELECT m.email FROM member_identities mi
             JOIN members m ON m.id = mi.member_id
             WHERE mi.provider = 'telegram' AND mi.subject = ?`
          )
          .bind(senderId)
          .first();
        if (linked?.email && linked.email.trim().toLowerCase() !== EMERGENCY_OWNER_EMAIL) {
          await writeSecurityAudit(
            env,
            {
              actorEmail: linked.email,
              actorRole: 'unauthorized',
              channel: arg || 'unknown',
              actionType: 'telegram_emergency_command',
              source: 'telegram_command',
              outcome: 'failed',
              reason: 'linked_telegram_not_emergency_owner',
            },
            nowMs
          );
          return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
      } catch {
        // Ignore if member_identities is absent in isolated test fixtures.
      }
    }

    // Reopen via Telegram is strictly forbidden by security policy.
    if (subCmd === 'ac' || subCmd === 'aç') {
      await writeSecurityAudit(
        env,
        {
          actorEmail: EMERGENCY_OWNER_EMAIL,
          actorRole: 'owner',
          channel: arg || 'unknown',
          actionType: 'telegram_reopen_forbidden',
          source: 'telegram_command',
          outcome: 'failed',
          reason: 'telegram_reopen_disallowed',
        },
        nowMs
      );
      await sendAdminTelegramNotice(
        env,
        chatId,
        'Güvenlik kuralı: Telegram üzerinden kanal yeniden açılamaz. Yalnızca Extranet Acil Durum Merkezi üzerinden "AÇ" onayı ve çift hesap doğrulamasıyla açılabilir.'
      );
      return new Response(JSON.stringify({ ok: true, denied: 'reopen_forbidden' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const targetMap = {
      whatsapp: 'whatsapp',
      telegram: 'telegram',
      instagram: 'instagram',
      mimo: 'mimo',
      hepsi: 'all',
    };
    const targetChannel = targetMap[arg] || null;
    if (!targetChannel) {
      await sendAdminTelegramNotice(
        env,
        chatId,
        'Kullanım: /acil_kapat whatsapp|telegram|instagram|mimo|hepsi'
      );
      return new Response(JSON.stringify({ ok: true, usage: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const allowedRate = await checkEmergencyRateLimit(env, `emg:tg:${chatId}`, 5, 15 * 60 * 1000, nowMs);
    if (!allowedRate) {
      return new Response(JSON.stringify({ ok: true, rateLimited: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const reqId = crypto.randomUUID();
    const secret = env?.EMERGENCY_CODE_SECRET || env?.CODE_PEPPER || 'tg-hash';
    const chatHash = await hmacSha256Hex(secret, `tg-chat:${chatId}`);
    const userHash = await hmacSha256Hex(secret, `tg-user:${senderId}`);

    if (db && typeof db.batch === 'function') {
      await db.batch([
        db
          .prepare(
            `INSERT INTO emergency_telegram_requests
             (id, target_channel, telegram_chat_hash, telegram_user_hash, status, created_at_ms, expires_at_ms)
             VALUES (?, ?, ?, ?, 'pending', ?, ?)`
          )
          .bind(reqId, targetChannel, chatHash, userHash, nowMs, nowMs + TG_REQ_TTL_MS),
        buildEmergencyAuditStmt(
          db,
          {
            operationId: reqId,
            actorEmail: EMERGENCY_OWNER_EMAIL,
            actorRole: 'owner',
            channel: targetChannel,
            previousState: null,
            newState: { status: 'pending_dual_verification' },
            actionType: 'telegram_close_request',
            source: 'telegram_command',
            outcome: 'success',
            reason: 'awaiting_extranet_and_gmail_verification',
          },
          nowMs
        ),
      ]);
    }

    await sendAdminTelegramNotice(
      env,
      chatId,
      `Acil kapatma talebi oluşturuldu (${arg.toUpperCase()}).\nGüvenlik gereği kanal doğrudan kapatılmadı. İşlemi tamamlamak için info@bosphorly.com ile Extranet → Acil Durum ve Güvenlik Merkezi'ne girip ikinci e-posta doğrulama kodunu onaylayın.`
    );
    return new Response(JSON.stringify({ ok: true, emergencyRequestCreated: true, requestId: reqId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Normal Telegram message path: check if Telegram channel is open.
  const record = await readChannelRecordWithContinuity(env, 'telegram');
  const msgKey = msg?.chat?.id != null && msg?.message_id != null ? `${msg.chat.id}:${msg.message_id}` : '';
  const msgAtMs = Number.isFinite(Number(msg?.date)) && Number(msg.date) > 0 ? Number(msg.date) * 1000 : 0;

  if (!record.enabled) {
    if (msgKey) await recordDroppedMessage(env, 'telegram', msgKey, nowMs);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (record.lastClosedAtMs > 0 && (await wasMessageInClosedPeriod(env, 'telegram', msgKey, msgAtMs, record.lastClosedAtMs))) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return null;
}

export async function handlePublicChannels(request, env) {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  const results = await Promise.all([
    readChannelRecordWithContinuity(env, 'whatsapp'),
    readChannelRecordWithContinuity(env, 'telegram'),
    readChannelRecordWithContinuity(env, 'instagram'),
    readChannelRecordWithContinuity(env, 'mimo'),
    readChannelRecordWithContinuity(env, 'banner'),
  ]);

  const [wa, tg, ig, mimo, banner] = results;

  // If D1 is unreachable AND no persistent last-known-good state exists for unprotected channels,
  // return 503 so the public website hides WhatsApp/Telegram/Instagram buttons safely.
  const allUnknown = [wa, tg, ig, mimo].some((r) => !r.envLocked && !r.known);
  if (allUnknown) {
    return new Response(JSON.stringify({ error: 'Channel status temporarily unavailable' }), {
      status: 503,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  const bannerEnabled = Boolean(banner.enabled && (banner.bannerText || banner.bannerPreset));
  const presetCode = bannerEnabled && BANNER_PRESETS[banner.bannerPreset] ? banner.bannerPreset : '';
  const safeText = bannerEnabled ? sanitizeBannerText(banner.bannerText) : '';

  const payload = {
    channels: {
      whatsapp: Boolean(wa.enabled),
      telegram: Boolean(tg.enabled),
      instagram: Boolean(ig.enabled),
      mimo: Boolean(mimo.enabled),
    },
    banner: {
      enabled: Boolean(bannerEnabled && (safeText || presetCode)),
      text: safeText,
      ...(presetCode ? { preset: presetCode, translations: BANNER_PRESETS[presetCode] } : {}),
    },
  };

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=30, s-maxage=30, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function resolveLangFromAssistantRequest(request, url, bodyObj) {
  const qLang = url?.searchParams?.get('lang') || '';
  const bodyLang = typeof bodyObj?.lang === 'string' ? bodyObj.lang : '';
  for (const cand of [bodyLang, qLang]) {
    const short = String(cand || '').trim().toLowerCase().split(/[-_]/)[0];
    const norm = short === 'in' ? 'id' : short;
    if (SUPPORTED_LANGS.has(norm)) return norm;
  }
  if (typeof bodyObj?.message === 'string' && bodyObj.message.trim()) {
    const det = detectLanguage({ message: bodyObj.message });
    if (SUPPORTED_LANGS.has(det)) return det;
  }
  const accept = request.headers.get('Accept-Language') || '';
  for (const part of accept.split(',')) {
    const code = part.split(';')[0].trim().toLowerCase().split(/[-_]/)[0];
    const norm = code === 'in' ? 'id' : code;
    if (SUPPORTED_LANGS.has(norm)) return norm;
  }
  return 'en';
}

export async function guardMimoWebAssistantRequest(request, env, url) {
  if (await isChannelEnabled(env, 'mimo')) return null;

  let parsedBody = null;
  if (request.method === 'POST' && (request.headers.get('Content-Type') || '').includes('application/json')) {
    try {
      parsedBody = await request.clone().json();
    } catch {
      parsedBody = null;
    }
  }
  const lang = resolveLangFromAssistantRequest(request, url, parsedBody);
  const message = getMimoMaintenanceMessage(lang);
  return new Response(
    JSON.stringify({
      error: message,
      reply: message,
      maintenance: true,
      closed: true,
      handoff: false,
      lang,
    }),
    {
      status: 503,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    }
  );
}

function resolveVerifyEmail(env) {
  const raw = typeof env?.EMERGENCY_VERIFY_EMAIL === 'string' ? env.EMERGENCY_VERIFY_EMAIL.trim().toLowerCase() : '';
  if (!isValidEmail(raw)) return '';
  // Secondary verification email must NEVER be the primary corporate account itself.
  if (raw === EMERGENCY_OWNER_EMAIL) return '';
  return raw;
}

function resolveEmergencyHmacSecret(env) {
  const s = typeof env?.EMERGENCY_CODE_SECRET === 'string' && env.EMERGENCY_CODE_SECRET.trim()
    ? env.EMERGENCY_CODE_SECRET.trim()
    : typeof env?.CODE_PEPPER === 'string' && env.CODE_PEPPER.trim()
      ? env.CODE_PEPPER.trim()
      : '';
  return s;
}

function resolveNotificationRecipients(env) {
  const set = new Set([EMERGENCY_OWNER_EMAIL]);
  const verifyEmail = resolveVerifyEmail(env);
  if (verifyEmail) set.add(verifyEmail);
  const rawList = typeof env?.EMERGENCY_NOTIFY_EMAILS === 'string' ? env.EMERGENCY_NOTIFY_EMAILS : '';
  for (const item of rawList.split(',')) {
    const clean = item.trim().toLowerCase();
    if (isValidEmail(clean)) set.add(clean);
  }
  return [...set];
}

async function computeVerificationHmac(env, { operationId, sessionHash, actorMemberId, targetChannel, actionType, payloadJson, code }) {
  const secret = resolveEmergencyHmacSecret(env);
  if (!secret) throw new Error('hmac_secret_missing');
  const payloadHash = await sha256Hex(payloadJson || '{}');
  const msg = [
    'emergency-otp-v1',
    operationId,
    sessionHash,
    actorMemberId,
    targetChannel,
    actionType,
    payloadHash,
    code,
  ].join('|');
  return hmacSha256Hex(secret, msg);
}

async function sendEmergencyEmail(env, { to, subject, text, idempotencyKey }) {
  const fromEmail = env?.REQUEST_FROM_EMAIL || env?.MAIL_FROM;
  if (!env?.RESEND_API_KEY || !fromEmail) {
    return { ok: false, error: 'email_provider_not_configured' };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: AbortSignal.timeout(5000),
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: fromEmail,
        to: Array.isArray(to) ? to : [to],
        subject,
        text,
      }),
    });
    if (!res.ok) {
      return { ok: false, error: `resend_http_${res.status}` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'resend_network_error' };
  }
}

const RETRY_DELAYS_MS = [
  60 * 1000,
  5 * 60 * 1000,
  15 * 60 * 1000,
  60 * 60 * 1000,
  4 * 60 * 60 * 1000,
];
const MAX_NOTIFICATION_ATTEMPTS = 8;

export async function flushEmergencyNotifications(env, nowMs = Date.now()) {
  const db = primaryDb(env);
  if (!db || typeof db.prepare !== 'function') return { processed: 0, sent: 0 };
  const secret = resolveEmergencyHmacSecret(env);
  if (!secret) return { processed: 0, sent: 0 };

  let pending = [];
  try {
    const res = await db
      .prepare(
        `SELECT id, operation_id, subject, body_text, delivered_json, attempts
         FROM emergency_notification_queue
         WHERE status = 'pending' AND next_retry_at_ms <= ?
         ORDER BY next_retry_at_ms ASC
         LIMIT 10`
      )
      .bind(nowMs)
      .all();
    pending = res?.results || [];
  } catch {
    return { processed: 0, sent: 0 };
  }

  if (!pending.length) return { processed: 0, sent: 0 };

  const recipients = resolveNotificationRecipients(env);
  let sentCount = 0;

  for (const job of pending) {
    let deliveredHashes = [];
    try {
      const parsed = JSON.parse(job.delivered_json || '[]');
      if (Array.isArray(parsed)) deliveredHashes = parsed.filter((x) => typeof x === 'string');
    } catch {
      deliveredHashes = [];
    }
    const deliveredSet = new Set(deliveredHashes);
    let allDelivered = true;
    let lastError = null;
    const nextAttempt = Number(job.attempts || 0) + 1;

    for (const rcpt of recipients) {
      const rcptHash = await hmacSha256Hex(secret, `notif-rcpt:${rcpt}`);
      if (deliveredSet.has(rcptHash)) continue;
      const sendRes = await sendEmergencyEmail(env, {
        to: rcpt,
        subject: job.subject,
        text: job.body_text,
        idempotencyKey: `emg-notif-${job.id}-${rcptHash.slice(0, 16)}-a${nextAttempt}`,
      });
      if (sendRes.ok) {
        deliveredSet.add(rcptHash);
      } else {
        allDelivered = false;
        lastError = sendRes.error || 'send_failed';
      }
    }

    const updatedDeliveredJson = JSON.stringify([...deliveredSet]);
    if (allDelivered) {
      sentCount += 1;
      await db
        .prepare(
          `UPDATE emergency_notification_queue
           SET status = 'sent', delivered_json = ?, attempts = ?, last_error = NULL, sent_at_ms = ?
           WHERE id = ?`
        )
        .bind(updatedDeliveredJson, nextAttempt, nowMs, job.id)
        .run();
    } else {
      const exhausted = nextAttempt >= MAX_NOTIFICATION_ATTEMPTS;
      const delay = RETRY_DELAYS_MS[Math.min(nextAttempt - 1, RETRY_DELAYS_MS.length - 1)];
      await db
        .prepare(
          `UPDATE emergency_notification_queue
           SET status = ?, delivered_json = ?, attempts = ?, next_retry_at_ms = ?, last_error = ?
           WHERE id = ?`
        )
        .bind(
          exhausted ? 'exhausted' : 'pending',
          updatedDeliveredJson,
          nextAttempt,
          nowMs + delay,
          lastError,
          job.id
        )
        .run();
    }
  }

  return { processed: pending.length, sent: sentCount };
}

function isExclusiveEmergencyOwner(actor) {
  if (!actor || actor.role !== 'owner') return false;
  const email = typeof actor.email === 'string' ? actor.email.trim().toLowerCase() : '';
  return constantTimeEqual(email, EMERGENCY_OWNER_EMAIL);
}

async function requireExclusiveEmergencyOwner(request, env, nowMs, h) {
  let actor;
  try {
    actor = await h.auth(request, env, ['owner', 'admin', 'staff', 'partner'], nowMs);
  } catch (err) {
    await writeSecurityAudit(
      env,
      {
        actorEmail: 'unauthenticated',
        actorRole: 'unauthorized',
        channel: 'security_center',
        actionType: 'unauthenticated_access_attempt',
        source: 'extranet',
        outcome: 'failed',
        reason: err?.code || 'unauthenticated',
        ipAddress: (request.headers.get('CF-Connecting-IP') || 'unknown').trim().slice(0, 80),
      },
      nowMs
    );
    throw err;
  }

  if (!isExclusiveEmergencyOwner(actor)) {
    await writeSecurityAudit(
      env,
      {
        actorEmail: actor.email || 'unknown',
        actorMemberId: actor.memberId || null,
        actorRole: actor.role || 'unauthorized',
        channel: 'security_center',
        actionType: 'unauthorized_access_attempt',
        source: 'extranet',
        outcome: 'failed',
        reason: 'not_exclusive_emergency_owner',
        ipAddress: actor.ipAddress,
      },
      nowMs
    );
    h.fail(
      403,
      'Acil Durum ve Güvenlik Merkezi yalnızca yetkili kurumsal işletme sahibi hesabı tarafından yönetilebilir.',
      'EMERGENCY_FORBIDDEN'
    );
  }

  return actor;
}

const CHANNEL_LABELS_TR = Object.freeze({
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  instagram: 'Instagram',
  mimo: 'Mimo Web AI',
  all: 'Bütün İletişim Kanalları',
  banner: 'Web Sitesi Güvenlik Uyarı Bandı',
});

const ACTION_LABELS_TR = Object.freeze({
  close: 'Acil Kanal Kapatma',
  reopen: 'Kanal Yeniden Açma',
  close_all: 'Bütün Kanalları Acil Kapatma',
  reopen_all: 'Bütün Kanalları Yeniden Açma',
  banner_enable: 'Güvenlik Uyarı Bandını Açma',
  banner_disable: 'Güvenlik Uyarı Bandını Kapatma',
  banner_update: 'Güvenlik Uyarı Bandı Metnini Güncelleme',
});

async function loadAllChannelStatesForAdmin(env, nowMs) {
  const db = primaryDb(env);
  const rows = (
    await db
      .prepare(
        `SELECT channel, enabled, banner_text, banner_preset, last_closed_at_ms, last_reopened_at_ms,
                updated_by, operation_id, updated_at_ms, updated_at
         FROM emergency_channel_states`
      )
      .all()
  ).results || [];

  const byChannel = new Map(rows.map((r) => [r.channel, r]));

  // Expire stale pending verifications first
  await db
    .prepare(`UPDATE emergency_verifications SET status = 'expired' WHERE status = 'pending' AND expires_at_ms <= ?`)
    .bind(nowMs)
    .run();
  await db
    .prepare(`UPDATE emergency_telegram_requests SET status = 'expired' WHERE status = 'pending' AND expires_at_ms <= ?`)
    .bind(nowMs)
    .run();

  const pendingRow = await db
    .prepare(
      `SELECT operation_id, session_hash, target_channel, action_type, payload_json, created_at_ms, expires_at_ms
       FROM emergency_verifications
       WHERE status = 'pending' AND expires_at_ms > ?
       ORDER BY created_at_ms DESC
       LIMIT 1`
    )
    .bind(nowMs)
    .first();

  const channels = EMERGENCY_CHANNELS.map((id) => {
    const r = byChannel.get(id);
    const d1Enabled = r ? Number(r.enabled) === 1 : true;
    const envLocked = isChannelEnvLocked(env, id);
    const effectiveEnabled = envLocked ? false : d1Enabled;
    const pendingVerification = Boolean(
      pendingRow &&
        (pendingRow.target_channel === id ||
          (pendingRow.target_channel === 'all' &&
            (pendingRow.action_type === 'reopen_all' ? !envLocked && !d1Enabled : !envLocked)))
    );
    return {
      id,
      label: CHANNEL_LABELS_TR[id],
      enabled: effectiveEnabled,
      d1Enabled,
      envLocked,
      envVarName: ENV_LOCK_VARS[id],
      lockWarning: envLocked ? ENV_LOCK_WARNING : null,
      pendingVerification,
      updatedAt: r?.updated_at || null,
      updatedAtMs: r ? Number(r.updated_at_ms || 0) : null,
      updatedBy: r?.updated_by || null,
    };
  });

  const bRow = byChannel.get('banner');
  const banner = {
    enabled: bRow ? Number(bRow.enabled) === 1 : false,
    text: bRow ? sanitizeBannerText(bRow.banner_text || '') : '',
    preset: bRow?.banner_preset || '',
    pendingVerification: Boolean(pendingRow && pendingRow.target_channel === 'banner'),
    updatedAt: bRow?.updated_at || null,
    updatedBy: bRow?.updated_by || null,
  };

  return { channels, banner, pendingRow, byChannel };
}

export async function emergencyExtranetRoutes(request, env, url, nowMs, h) {
  const path = url.pathname;
  if (path !== '/v1/extranet/emergency' && !path.startsWith('/v1/extranet/emergency/')) {
    return null;
  }

  const actor = await requireExclusiveEmergencyOwner(request, env, nowMs, h);
  const db = primaryDb(env);
  const response = (data, status = 200) =>
    h.json(data, status, { 'Set-Cookie': h.cookie(actor.rawCookie) });

  // GET /v1/extranet/emergency/status
  if (request.method === 'GET' && path === '/v1/extranet/emergency/status') {
    await flushEmergencyNotifications(env, nowMs).catch(() => {});
    const { channels, banner, pendingRow } = await loadAllChannelStatesForAdmin(env, nowMs);

    const lastVerif = await db
      .prepare(`SELECT created_at_ms FROM emergency_verifications WHERE actor_member_id = ? ORDER BY created_at_ms DESC LIMIT 1`)
      .bind(actor.memberId)
      .first();
    const cooldownRemainingSec = lastVerif
      ? Math.max(0, Math.ceil((Number(lastVerif.created_at_ms) + OTP_COOLDOWN_MS - nowMs) / 1000))
      : 0;

    const tgRequests = (
      await db
        .prepare(
          `SELECT id, target_channel, created_at_ms, expires_at_ms
           FROM emergency_telegram_requests
           WHERE status = 'pending' AND expires_at_ms > ?
           ORDER BY created_at_ms DESC
           LIMIT 10`
        )
        .bind(nowMs)
        .all()
    ).results || [];

    const auditLogs = (
      await db
        .prepare(
          `SELECT id, operation_id, created_at_ms, created_at, actor_email, actor_role,
                  channel, previous_state, new_state, action_type, source, outcome, reason
           FROM emergency_audit_log
           ORDER BY created_at_ms DESC
           LIMIT 100`
        )
        .all()
    ).results || [];

    const recentOperations = auditLogs
      .filter((a) => a.outcome === 'success' && ['close', 'reopen', 'close_all', 'reopen_all', 'banner_enable', 'banner_disable', 'banner_update'].includes(a.action_type))
      .slice(0, 10);

    const pendingNotifRow = await db
      .prepare(`SELECT COUNT(*) AS n FROM emergency_notification_queue WHERE status = 'pending'`)
      .first();

    const verifyEmail = resolveVerifyEmail(env);

    return response({
      channels,
      banner,
      presets: Object.entries(BANNER_PRESETS).map(([key, dict]) => ({
        key,
        textTr: dict.tr,
      })),
      pendingVerification:
        pendingRow && constantTimeEqual(pendingRow.session_hash, actor.tokenHash)
          ? {
              operationId: pendingRow.operation_id,
              targetChannel: pendingRow.target_channel,
              actionType: pendingRow.action_type,
              expiresAtMs: Number(pendingRow.expires_at_ms),
              cooldownRemainingSec,
              maskedVerifyEmail: maskEmailAddr(verifyEmail),
            }
          : null,
      cooldownRemainingSec,
      telegramRequests: tgRequests.map((r) => ({
        id: r.id,
        targetChannel: r.target_channel,
        label: CHANNEL_LABELS_TR[r.target_channel] || r.target_channel,
        createdAtMs: Number(r.created_at_ms),
        expiresAtMs: Number(r.expires_at_ms),
      })),
      recentOperations,
      auditLogs,
      configStatus: {
        verifyEmailConfigured: Boolean(verifyEmail),
        maskedVerifyEmail: maskEmailAddr(verifyEmail),
        emailProviderConfigured: Boolean(env.RESEND_API_KEY && (env.REQUEST_FROM_EMAIL || env.MAIL_FROM)),
        pendingNotifications: Number(pendingNotifRow?.n || 0),
      },
    });
  }

  // POST /v1/extranet/emergency/request-code
  if (request.method === 'POST' && path === '/v1/extranet/emergency/request-code') {
    const body = await h.body(request, 4096);
    const allowedKeys = new Set([
      'targetChannel',
      'actionType',
      'confirmAction',
      'confirmReopenText',
      'bannerText',
      'bannerPreset',
      'telegramRequestId',
    ]);
    for (const k of Object.keys(body)) {
      if (!allowedKeys.has(k)) {
        await writeSecurityAudit(
          env,
          {
            actorEmail: actor.email,
            actorMemberId: actor.memberId,
            actorRole: actor.role,
            channel: String(body.targetChannel || 'unknown'),
            actionType: 'request_code_invalid_payload',
            source: 'extranet',
            outcome: 'failed',
            reason: `unexpected_field:${k}`,
            ipAddress: actor.ipAddress,
          },
          nowMs
        );
        h.fail(400, 'İstek gövdesinde izin verilmeyen alan tespit edildi.', 'INVALID_PAYLOAD');
      }
    }

    const targetChannel = typeof body.targetChannel === 'string' ? body.targetChannel.trim() : '';
    const actionType = typeof body.actionType === 'string' ? body.actionType.trim() : '';

    if (!EMERGENCY_TARGETS.includes(targetChannel) || !EMERGENCY_ACTIONS.includes(actionType)) {
      h.fail(400, 'Geçersiz kanal veya acil durum işlem türü.', 'INVALID_ACTION');
    }

    if (actionType === 'close' && (!EMERGENCY_CHANNELS.includes(targetChannel) || body.confirmAction !== true)) {
      h.fail(400, 'Kapatma işlemi için kanal seçimi ve açık onay gereklidir.', 'CONFIRM_REQUIRED');
    }
    if (actionType === 'close_all' && (targetChannel !== 'all' || body.confirmAction !== true)) {
      h.fail(400, 'Bütün kanalları kapatmak için açık onay gereklidir.', 'CONFIRM_REQUIRED');
    }
    if (actionType === 'reopen') {
      if (!EMERGENCY_CHANNELS.includes(targetChannel)) {
        h.fail(400, 'Geçersiz kanal seçimi.', 'INVALID_CHANNEL');
      }
      if (isChannelEnvLocked(env, targetChannel)) {
        await writeSecurityAudit(
          env,
          {
            actorEmail: actor.email,
            actorMemberId: actor.memberId,
            actorRole: actor.role,
            channel: targetChannel,
            actionType: 'reopen_blocked_env_lock',
            source: 'extranet',
            outcome: 'failed',
            reason: 'env_lock_active',
            ipAddress: actor.ipAddress,
          },
          nowMs
        );
        h.fail(409, `${ENV_LOCK_WARNING}. Panelden bu kilit kaldırılamaz.`, 'ENV_LOCKED');
      }
      if (String(body.confirmReopenText || '').trim() !== 'AÇ') {
        await writeSecurityAudit(
          env,
          {
            actorEmail: actor.email,
            actorMemberId: actor.memberId,
            actorRole: actor.role,
            channel: targetChannel,
            actionType: 'reopen_missing_ac_confirmation',
            source: 'extranet',
            outcome: 'failed',
            reason: 'missing_AC_confirmation',
            ipAddress: actor.ipAddress,
          },
          nowMs
        );
        h.fail(400, 'Yeniden açma işlemi için doğrulama alanına tam olarak "AÇ" yazılmalıdır.', 'REOPEN_CONFIRM_REQUIRED');
      }
    }

    if (actionType === 'close' && isChannelEnvLocked(env, targetChannel)) {
      h.fail(409, `${ENV_LOCK_WARNING}. Kanal zaten altyapı kilidiyle kapalıdır.`, 'ENV_LOCKED');
    }

    if (actionType === 'reopen_all') {
      if (targetChannel !== 'all') {
        h.fail(400, 'Toplu yeniden açma yalnızca "all" hedefiyle yapılabilir.', 'INVALID_CHANNEL');
      }
      const reopenAllAudit = (auditAction, reason) =>
        writeSecurityAudit(
          env,
          {
            actorEmail: actor.email,
            actorMemberId: actor.memberId,
            actorRole: actor.role,
            channel: 'all',
            actionType: auditAction,
            source: 'extranet',
            outcome: 'failed',
            reason,
            ipAddress: actor.ipAddress,
          },
          nowMs
        );
      if (EMERGENCY_CHANNELS.every((ch) => isChannelEnvLocked(env, ch))) {
        await reopenAllAudit('reopen_all_blocked_env_lock', 'env_lock_active_all_channels');
        h.fail(409, `${ENV_LOCK_WARNING}. Panelden bu kilit kaldırılamaz.`, 'ENV_LOCKED');
      }
      if (String(body.confirmReopenText || '').trim() !== 'AÇ') {
        await reopenAllAudit('reopen_all_missing_ac_confirmation', 'missing_AC_confirmation');
        h.fail(400, 'Toplu yeniden açma işlemi için doğrulama alanına tam olarak "AÇ" yazılmalıdır.', 'REOPEN_CONFIRM_REQUIRED');
      }
      const { byChannel: currentStates } = await loadAllChannelStatesForAdmin(env, nowMs);
      const reopenable = EMERGENCY_CHANNELS.filter((ch) => {
        const row = currentStates.get(ch);
        return !isChannelEnvLocked(env, ch) && row && Number(row.enabled) !== 1;
      });
      if (!reopenable.length) {
        const anyEnvLockedClosed = EMERGENCY_CHANNELS.some((ch) => isChannelEnvLocked(env, ch));
        if (anyEnvLockedClosed) {
          await reopenAllAudit('reopen_all_blocked_env_lock', 'only_env_locked_channels_closed');
          h.fail(409, `${ENV_LOCK_WARNING}. Panelden bu kilit kaldırılamaz.`, 'ENV_LOCKED');
        }
        h.fail(409, 'Yeniden açılabilecek kapalı kanal bulunmuyor.', 'NOTHING_TO_REOPEN');
      }
    }

    let payloadObj = {};
    if (actionType.startsWith('banner_')) {
      if (targetChannel !== 'banner') {
        h.fail(400, 'Uyarı bandı işlemi yalnızca banner hedefiyle yapılabilir.', 'INVALID_TARGET');
      }
      const preset = typeof body.bannerPreset === 'string' && BANNER_PRESETS[body.bannerPreset] ? body.bannerPreset : '';
      const rawText = typeof body.bannerText === 'string' ? body.bannerText : (preset ? BANNER_PRESETS[preset].tr : '');
      const cleanText = sanitizeBannerText(rawText);
      if ((actionType === 'banner_enable' || actionType === 'banner_update') && !cleanText) {
        h.fail(400, 'Güvenlik uyarı bandı metni boş olamaz.', 'BANNER_TEXT_REQUIRED');
      }
      payloadObj = {
        enabled: actionType !== 'banner_disable',
        text: actionType === 'banner_disable' ? cleanText : cleanText,
        preset: actionType === 'banner_disable' ? '' : preset,
      };
    } else if (!['close', 'reopen', 'close_all', 'reopen_all'].includes(actionType)) {
      h.fail(400, 'Geçersiz işlem türü.', 'INVALID_ACTION');
    }

    const telegramRequestId =
      typeof body.telegramRequestId === 'string' && /^[0-9a-f-]{36}$/i.test(body.telegramRequestId.trim())
        ? body.telegramRequestId.trim()
        : null;

    if (telegramRequestId) {
      const tgReq = await db
        .prepare(`SELECT id, target_channel FROM emergency_telegram_requests WHERE id = ? AND status = 'pending' AND expires_at_ms > ?`)
        .bind(telegramRequestId, nowMs)
        .first();
      if (!tgReq || tgReq.target_channel !== targetChannel || !['close', 'close_all'].includes(actionType)) {
        h.fail(400, 'Geçersiz veya süresi dolmuş Telegram acil kapatma talebi.', 'INVALID_TELEGRAM_REQUEST');
      }
    }

    const verifyEmail = resolveVerifyEmail(env);
    if (!verifyEmail) {
      h.fail(
        503,
        'İkinci doğrulama e-posta yapılandırması (EMERGENCY_VERIFY_EMAIL) sunucuda tanımlı değil. Kanal durumu değiştirilmedi.',
        'VERIFY_EMAIL_NOT_CONFIGURED'
      );
    }

    const secret = resolveEmergencyHmacSecret(env);
    if (!secret) {
      h.fail(503, 'Sunucu doğrulama anahtarı yapılandırılmamış. Kanal durumu değiştirilmedi.', 'SECRET_NOT_CONFIGURED');
    }

    // 1. Cooldown check (60 seconds between sent codes, including challenges locked out by wrong attempts)
    const lastSent = await db
      .prepare(
        `SELECT created_at_ms FROM emergency_verifications
         WHERE actor_member_id = ?
         ORDER BY created_at_ms DESC LIMIT 1`
      )
      .bind(actor.memberId)
      .first();
    if (lastSent && nowMs - Number(lastSent.created_at_ms) < OTP_COOLDOWN_MS) {
      const waitSec = Math.ceil((Number(lastSent.created_at_ms) + OTP_COOLDOWN_MS - nowMs) / 1000);
      h.fail(429, `Yeni doğrulama kodu istemek için lütfen ${waitSec} saniye bekleyin.`, 'OTP_COOLDOWN');
    }

    // 2. Session & Account total code send limits
    const hourAgo = nowMs - 3600 * 1000;
    const dayAgo = nowMs - 86400 * 1000;
    const sessCountRow = await db
      .prepare(`SELECT COUNT(*) AS n FROM emergency_verifications WHERE session_hash = ? AND created_at_ms >= ?`)
      .bind(actor.tokenHash, hourAgo)
      .first();
    const acctHourRow = await db
      .prepare(`SELECT COUNT(*) AS n FROM emergency_verifications WHERE actor_member_id = ? AND created_at_ms >= ?`)
      .bind(actor.memberId, hourAgo)
      .first();
    const acctDayRow = await db
      .prepare(`SELECT COUNT(*) AS n FROM emergency_verifications WHERE actor_member_id = ? AND created_at_ms >= ?`)
      .bind(actor.memberId, dayAgo)
      .first();

    if (
      Number(sessCountRow?.n || 0) >= 6 ||
      Number(acctHourRow?.n || 0) >= 10 ||
      Number(acctDayRow?.n || 0) >= 20
    ) {
      await writeSecurityAudit(
        env,
        {
          actorEmail: actor.email,
          actorMemberId: actor.memberId,
          actorRole: actor.role,
          channel: targetChannel,
          actionType: 'request_code_rate_limited',
          source: 'extranet',
          outcome: 'failed',
          reason: 'otp_send_limit_exceeded',
          ipAddress: actor.ipAddress,
        },
        nowMs
      );
      h.fail(429, 'Doğrulama kodu gönderim limiti aşıldı. Lütfen daha sonra tekrar deneyin.', 'OTP_SEND_RATE_LIMIT');
    }

    const operationId = crypto.randomUUID();
    const code = generateSecureSixDigitCode();
    const payloadJson = JSON.stringify(payloadObj);
    const expiresAtMs = nowMs + OTP_TTL_MS;
    const codeHmac = await computeVerificationHmac(env, {
      operationId,
      sessionHash: actor.tokenHash,
      actorMemberId: actor.memberId,
      targetChannel,
      actionType,
      payloadJson,
      code,
    });

    // Invalidate all prior pending codes for this owner before inserting the new pending challenge
    await db.batch([
      db
        .prepare(`UPDATE emergency_verifications SET status = 'invalidated' WHERE actor_member_id = ? AND status = 'pending'`)
        .bind(actor.memberId),
      db
        .prepare(
          `INSERT INTO emergency_verifications
           (operation_id, session_hash, actor_member_id, actor_email, target_channel, action_type,
            payload_json, code_hmac, attempts, status, source_request_id, created_at_ms, expires_at_ms)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'pending', ?, ?, ?)`
        )
        .bind(
          operationId,
          actor.tokenHash,
          actor.memberId,
          actor.email,
          targetChannel,
          actionType,
          payloadJson,
          codeHmac,
          telegramRequestId,
          nowMs,
          expiresAtMs
        ),
    ]);

    const subject = `Bosphorly Acil Güvenlik Doğrulama Kodu · ${ACTION_LABELS_TR[actionType]}`;
    const emailLines = [
      'BOSPHORLY ACİL DURUM VE GÜVENLİK MERKEZİ',
      '',
      `İşlem: ${ACTION_LABELS_TR[actionType]}`,
      `Hedef Kanal: ${CHANNEL_LABELS_TR[targetChannel] || targetChannel}`,
      `Talep Eden Oturum: ${actor.email}`,
      `İşlem Kimliği: ${operationId}`,
      '',
      `Tek Kullanımlık Doğrulama Kodunuz: ${code}`,
      '',
      'Bu kod 5 dakika süreyle geçerlidir ve yalnızca bu işlem için tek kez kullanılabilir.',
      'Bu işlemi siz başlatmadıysanız kodu kimseyle paylaşmayın ve Extranet oturumlarını derhal sonlandırın.',
    ];

    const mailRes = await sendEmergencyEmail(env, {
      to: verifyEmail,
      subject,
      text: emailLines.join('\n'),
      idempotencyKey: `emg-otp-${operationId}`,
    });

    if (!mailRes.ok) {
      await db.batch([
        db.prepare(`DELETE FROM emergency_verifications WHERE operation_id = ? AND status = 'pending'`).bind(operationId),
        buildEmergencyAuditStmt(
          db,
          {
            operationId,
            actorEmail: actor.email,
            actorMemberId: actor.memberId,
            actorRole: actor.role,
            channel: targetChannel,
            actionType: `otp_delivery_failed:${actionType}`,
            source: 'extranet',
            outcome: 'failed',
            reason: mailRes.error || 'email_send_failed',
            ipAddress: actor.ipAddress,
          },
          nowMs
        ),
      ]);
      h.fail(
        502,
        'İkinci doğrulama e-postası gönderilemedi. Güvenlik kuralı gereği kanal durumu değiştirilmedi.',
        'OTP_EMAIL_FAILED'
      );
    }

    await writeSecurityAudit(
      env,
      {
        operationId,
        actorEmail: actor.email,
        actorMemberId: actor.memberId,
        actorRole: actor.role,
        channel: targetChannel,
        actionType: `otp_sent:${actionType}`,
        source: 'extranet',
        outcome: 'success',
        reason: 'awaiting_code_verification',
        ipAddress: actor.ipAddress,
      },
      nowMs
    );

    return response({
      ok: true,
      operationId,
      targetChannel,
      actionType,
      expiresAtMs,
      cooldownSec: 60,
      maskedVerifyEmail: maskEmailAddr(verifyEmail),
    });
  }

  // POST /v1/extranet/emergency/verify
  if (request.method === 'POST' && path === '/v1/extranet/emergency/verify') {
    const minOk = await checkEmergencyRateLimit(env, `emg:vfy:m:${actor.tokenHash}`, 10, 60 * 1000, nowMs);
    const hrOk = await checkEmergencyRateLimit(env, `emg:vfy:h:${actor.memberId}`, 25, 3600 * 1000, nowMs);
    if (!minOk || !hrOk) {
      await writeSecurityAudit(
        env,
        {
          actorEmail: actor.email,
          actorMemberId: actor.memberId,
          actorRole: actor.role,
          channel: 'security_center',
          actionType: 'verify_rate_limited',
          source: 'extranet',
          outcome: 'failed',
          reason: 'verify_rate_limit_exceeded',
          ipAddress: actor.ipAddress,
        },
        nowMs
      );
      h.fail(429, 'Çok fazla doğrulama denemesi yapıldı. Lütfen biraz bekleyin.', 'VERIFY_RATE_LIMITED');
    }

    const body = await h.body(request, 2048);
    const allowedKeys = new Set(['operationId', 'code', 'targetChannel', 'actionType', 'confirmReopenText']);
    if (Object.keys(body).some((k) => !allowedKeys.has(k))) {
      h.fail(400, 'Geçersiz doğrulama isteği.', 'INVALID_PAYLOAD');
    }

    const operationId = typeof body.operationId === 'string' ? body.operationId.trim() : '';
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    const targetChannel = typeof body.targetChannel === 'string' ? body.targetChannel.trim() : '';
    const actionType = typeof body.actionType === 'string' ? body.actionType.trim() : '';

    if (!operationId || operationId.length > 80 || !/^\d{6}$/.test(code)) {
      h.fail(400, 'Geçerli bir işlem kimliği ve 6 haneli doğrulama kodu girin.', 'INVALID_CODE_FORMAT');
    }

    const verif = await db
      .prepare(`SELECT * FROM emergency_verifications WHERE operation_id = ?`)
      .bind(operationId)
      .first();

    if (!verif) {
      await writeSecurityAudit(
        env,
        {
          operationId,
          actorEmail: actor.email,
          actorMemberId: actor.memberId,
          actorRole: actor.role,
          channel: targetChannel || 'unknown',
          actionType: actionType || 'verify',
          source: 'extranet',
          outcome: 'failed',
          reason: 'operation_not_found',
          ipAddress: actor.ipAddress,
        },
        nowMs
      );
      h.fail(400, 'Doğrulama işlemi bulunamadı.', 'OPERATION_NOT_FOUND');
    }

    if (
      verif.actor_member_id !== actor.memberId ||
      !constantTimeEqual(String(verif.session_hash || ''), actor.tokenHash)
    ) {
      await writeSecurityAudit(
        env,
        {
          operationId,
          actorEmail: actor.email,
          actorMemberId: actor.memberId,
          actorRole: actor.role,
          channel: verif.target_channel,
          actionType: verif.action_type,
          source: 'extranet',
          outcome: 'failed',
          reason: 'session_binding_mismatch',
          ipAddress: actor.ipAddress,
        },
        nowMs
      );
      h.fail(403, 'Bu doğrulama kodu mevcut oturumunuza ait değil.', 'SESSION_MISMATCH');
    }

    if (verif.target_channel !== targetChannel || verif.action_type !== actionType) {
      await writeSecurityAudit(
        env,
        {
          operationId,
          actorEmail: actor.email,
          actorMemberId: actor.memberId,
          actorRole: actor.role,
          channel: targetChannel || verif.target_channel,
          actionType: actionType || verif.action_type,
          source: 'extranet',
          outcome: 'failed',
          reason: 'channel_or_action_mismatch',
          ipAddress: actor.ipAddress,
        },
        nowMs
      );
      h.fail(400, 'Doğrulama kodu seçilen kanal veya işlem türüyle eşleşmiyor.', 'BINDING_MISMATCH');
    }

    if (actionType === 'reopen' || actionType === 'reopen_all') {
      if (String(body.confirmReopenText || '').trim() !== 'AÇ') {
        await writeSecurityAudit(
          env,
          {
            operationId,
            actorEmail: actor.email,
            actorMemberId: actor.memberId,
            actorRole: actor.role,
            channel: targetChannel,
            actionType,
            source: 'extranet',
            outcome: 'failed',
            reason: 'missing_AC_confirmation_on_verify',
            ipAddress: actor.ipAddress,
          },
          nowMs
        );
        h.fail(400, 'Yeniden açma işlemi için "AÇ" onayı zorunludur.', 'REOPEN_CONFIRM_REQUIRED');
      }
      if (actionType === 'reopen' && isChannelEnvLocked(env, targetChannel)) {
        h.fail(409, `${ENV_LOCK_WARNING}. Panelden bu kilit kaldırılamaz.`, 'ENV_LOCKED');
      }
      if (actionType === 'reopen_all' && EMERGENCY_CHANNELS.every((ch) => isChannelEnvLocked(env, ch))) {
        h.fail(409, `${ENV_LOCK_WARNING}. Panelden bu kilit kaldırılamaz.`, 'ENV_LOCKED');
      }
    }

    if (verif.status === 'consumed') {
      await writeSecurityAudit(
        env,
        {
          operationId,
          actorEmail: actor.email,
          actorMemberId: actor.memberId,
          actorRole: actor.role,
          channel: targetChannel,
          actionType,
          source: 'extranet',
          outcome: 'failed',
          reason: 'code_replay_rejected',
          ipAddress: actor.ipAddress,
        },
        nowMs
      );
      h.fail(409, 'Bu doğrulama kodu daha önce kullanılmış.', 'CODE_ALREADY_USED');
    }

    if (verif.status === 'invalidated') {
      await writeSecurityAudit(
        env,
        {
          operationId,
          actorEmail: actor.email,
          actorMemberId: actor.memberId,
          actorRole: actor.role,
          channel: targetChannel,
          actionType,
          source: 'extranet',
          outcome: 'failed',
          reason: 'code_superseded',
          ipAddress: actor.ipAddress,
        },
        nowMs
      );
      h.fail(409, 'Yeni bir kod üretildiği için bu kod geçersiz kılındı.', 'CODE_INVALIDATED');
    }

    if (verif.status === 'failed' || Number(verif.attempts || 0) >= OTP_MAX_ATTEMPTS) {
      await writeSecurityAudit(
        env,
        {
          operationId,
          actorEmail: actor.email,
          actorMemberId: actor.memberId,
          actorRole: actor.role,
          channel: targetChannel,
          actionType,
          source: 'extranet',
          outcome: 'failed',
          reason: 'max_attempts_reached',
          ipAddress: actor.ipAddress,
        },
        nowMs
      );
      h.fail(429, 'En fazla 3 hatalı deneme hakkı aşıldı. Yeni bir doğrulama kodu isteyin.', 'MAX_ATTEMPTS_EXCEEDED');
    }

    if (nowMs > Number(verif.expires_at_ms)) {
      await db.batch([
        db.prepare(`UPDATE emergency_verifications SET status = 'expired' WHERE operation_id = ? AND status = 'pending'`).bind(operationId),
        buildEmergencyAuditStmt(
          db,
          {
            operationId,
            actorEmail: actor.email,
            actorMemberId: actor.memberId,
            actorRole: actor.role,
            channel: targetChannel,
            actionType,
            source: 'extranet',
            outcome: 'failed',
            reason: 'code_expired',
            ipAddress: actor.ipAddress,
          },
          nowMs
        ),
      ]);
      h.fail(410, 'Doğrulama kodunun 5 dakikalık geçerlilik süresi doldu.', 'CODE_EXPIRED');
    }

    const expectedHmac = await computeVerificationHmac(env, {
      operationId,
      sessionHash: actor.tokenHash,
      actorMemberId: actor.memberId,
      targetChannel: verif.target_channel,
      actionType: verif.action_type,
      payloadJson: verif.payload_json,
      code,
    });

    if (!constantTimeEqual(expectedHmac, String(verif.code_hmac || ''))) {
      const nextAttempts = Number(verif.attempts || 0) + 1;
      const lockedOut = nextAttempts >= OTP_MAX_ATTEMPTS;
      await db.batch([
        db
          .prepare(
            `UPDATE emergency_verifications
             SET attempts = attempts + 1,
                 status = CASE WHEN attempts + 1 >= ? THEN 'failed' ELSE status END
             WHERE operation_id = ? AND status = 'pending'`
          )
          .bind(OTP_MAX_ATTEMPTS, operationId),
        buildEmergencyAuditStmt(
          db,
          {
            operationId,
            actorEmail: actor.email,
            actorMemberId: actor.memberId,
            actorRole: actor.role,
            channel: targetChannel,
            actionType,
            source: 'extranet',
            outcome: 'failed',
            reason: lockedOut ? 'invalid_code_locked_out' : `invalid_code_attempt_${nextAttempts}`,
            ipAddress: actor.ipAddress,
          },
          nowMs
        ),
      ]);
      const rem = Math.max(0, OTP_MAX_ATTEMPTS - nextAttempts);
      h.fail(
        400,
        lockedOut
          ? 'Hatalı doğrulama kodu. 3 deneme hakkınız dolduğu için kod iptal edildi.'
          : `Hatalı doğrulama kodu. Kalan deneme hakkı: ${rem}.`,
        'INVALID_CODE'
      );
    }

    // Validated! Load current states on primary to capture accurate previous_state and build atomic batch.
    const { byChannel } = await loadAllChannelStatesForAdmin(env, nowMs);
    const nowSqlStr = sqlNow(nowMs);
    let parsedPayload = {};
    try {
      parsedPayload = JSON.parse(verif.payload_json || '{}') || {};
    } catch {
      parsedPayload = {};
    }

    const stmts = [
      db
        .prepare(
          `UPDATE emergency_verifications
           SET status = 'consumed', consumed_at_ms = ?
           WHERE operation_id = ? AND session_hash = ? AND actor_member_id = ?
             AND status = 'pending' AND expires_at_ms > ? AND attempts < ?`
        )
        .bind(nowMs, operationId, actor.tokenHash, actor.memberId, nowMs, OTP_MAX_ATTEMPTS),
      db
        .prepare(`INSERT INTO emergency_consumed_ops (operation_id, consumed_at_ms) VALUES (?, ?)`)
        .bind(operationId, nowMs),
    ];

    const updatedMirrors = [];
    let prevSummary = {};
    let nextSummary = {};

    const upsertChannelState = (ch, nextEnabled, bannerText = '', bannerPreset = '') => {
      const prevRow = byChannel.get(ch);
      const prevEnabled = prevRow ? Number(prevRow.enabled) === 1 : ch !== 'banner';
      const prevClosedMs = prevRow ? Number(prevRow.last_closed_at_ms || 0) : 0;
      const prevReopenedMs = prevRow ? Number(prevRow.last_reopened_at_ms || 0) : 0;
      const nextClosedMs = !nextEnabled && ch !== 'banner' ? nowMs : prevClosedMs;
      const nextReopenedMs = nextEnabled && ch !== 'banner' && !prevEnabled ? nowMs : prevReopenedMs;

      stmts.push(
        db
          .prepare(
            `INSERT INTO emergency_channel_states
             (channel, enabled, banner_text, banner_preset, last_closed_at_ms, last_reopened_at_ms, updated_by, operation_id, updated_at_ms, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(channel) DO UPDATE SET
               enabled = excluded.enabled,
               banner_text = excluded.banner_text,
               banner_preset = excluded.banner_preset,
               last_closed_at_ms = excluded.last_closed_at_ms,
               last_reopened_at_ms = excluded.last_reopened_at_ms,
               updated_by = excluded.updated_by,
               operation_id = excluded.operation_id,
               updated_at_ms = excluded.updated_at_ms,
               updated_at = excluded.updated_at`
          )
          .bind(
            ch,
            nextEnabled ? 1 : 0,
            bannerText,
            bannerPreset,
            nextClosedMs,
            nextReopenedMs,
            actor.email,
            operationId,
            nowMs,
            nowSqlStr
          )
      );

      if ((ch === 'whatsapp' || ch === 'telegram') && !nextEnabled && prevEnabled) {
        stmts.push(
          db
            .prepare(
              `INSERT INTO emergency_closed_windows (id, channel, closed_at_ms, reopened_at_ms, operation_id)
               VALUES (?, ?, ?, NULL, ?)`
            )
            .bind(crypto.randomUUID(), ch, nowMs, operationId)
        );
      } else if ((ch === 'whatsapp' || ch === 'telegram') && nextEnabled && !prevEnabled) {
        stmts.push(
          db
            .prepare(
              `UPDATE emergency_closed_windows SET reopened_at_ms = ?
               WHERE channel = ? AND reopened_at_ms IS NULL`
            )
            .bind(nowMs, ch)
        );
      }

      updatedMirrors.push([
        ch,
        {
          enabled: nextEnabled,
          bannerText,
          bannerPreset,
          lastClosedAtMs: nextClosedMs,
          lastReopenedAtMs: nextReopenedMs,
          updatedAtMs: nowMs,
        },
      ]);

      return prevRow
        ? {
            enabled: prevEnabled,
            ...(ch === 'banner' ? { text: prevRow.banner_text || '', preset: prevRow.banner_preset || '' } : {}),
          }
        : { enabled: ch !== 'banner', ...(ch === 'banner' ? { text: '', preset: '' } : {}) };
    };

    if (actionType === 'close') {
      prevSummary = upsertChannelState(targetChannel, false);
      nextSummary = { enabled: false };
    } else if (actionType === 'reopen') {
      prevSummary = upsertChannelState(targetChannel, true);
      nextSummary = { enabled: true };
    } else if (actionType === 'close_all') {
      prevSummary = {};
      nextSummary = {};
      for (const ch of EMERGENCY_CHANNELS) {
        prevSummary[ch] = upsertChannelState(ch, false).enabled ? 'open' : 'closed';
        nextSummary[ch] = 'closed';
      }
    } else if (actionType === 'reopen_all') {
      // Toplu yeniden etkinleştirme: yalnızca panelden kapatılmış ve altyapı (env) kilidi
      // olmayan kanallar açılır. *_DISABLED=1 kilitli kanallara hiçbir şekilde dokunulmaz.
      prevSummary = {};
      nextSummary = {};
      for (const ch of EMERGENCY_CHANNELS) {
        const row = byChannel.get(ch);
        const d1Enabled = row ? Number(row.enabled) === 1 : true;
        if (isChannelEnvLocked(env, ch)) {
          prevSummary[ch] = d1Enabled ? 'env_locked' : 'closed_env_locked';
          nextSummary[ch] = d1Enabled ? 'env_locked' : 'closed_env_locked';
          continue;
        }
        if (d1Enabled) {
          prevSummary[ch] = 'open';
          nextSummary[ch] = 'open';
          continue;
        }
        upsertChannelState(ch, true);
        prevSummary[ch] = 'closed';
        nextSummary[ch] = 'open';
      }
      if (!Object.values(prevSummary).includes('closed')) {
        h.fail(409, 'Yeniden açılabilecek kapalı kanal bulunmuyor. Kanal durumu değiştirilmedi.', 'NOTHING_TO_REOPEN');
      }
    } else if (actionType.startsWith('banner_')) {
      const bEnabled = Boolean(parsedPayload.enabled);
      const bText = sanitizeBannerText(parsedPayload.text || '');
      const bPreset = typeof parsedPayload.preset === 'string' ? parsedPayload.preset : '';
      prevSummary = upsertChannelState('banner', bEnabled, bText, bPreset);
      nextSummary = { enabled: bEnabled, text: bText, preset: bPreset };
    }

    if (verif.source_request_id) {
      stmts.push(
        db
          .prepare(
            `UPDATE emergency_telegram_requests
             SET status = 'completed', completed_operation_id = ?
             WHERE id = ? AND status = 'pending'`
          )
          .bind(operationId, verif.source_request_id)
      );
    }

    const effectiveSource = verif.source_request_id ? 'telegram_command' : 'extranet';
    stmts.push(
      buildEmergencyAuditStmt(
        db,
        {
          operationId,
          actorEmail: actor.email,
          actorMemberId: actor.memberId,
          actorRole: actor.role,
          channel: targetChannel,
          previousState: prevSummary,
          newState: nextSummary,
          actionType,
          source: effectiveSource,
          outcome: 'success',
          reason: verif.source_request_id ? `completed_telegram_req:${verif.source_request_id}` : 'dual_account_verified',
          ipAddress: actor.ipAddress,
        },
        nowMs
      ),
      h.audit(env, {
        actorMemberId: actor.memberId,
        actorRole: actor.role,
        action: `emergency_${actionType}`,
        targetType: 'emergency_channel',
        targetId: targetChannel,
        oldValue: prevSummary,
        newValue: { ...nextSummary, operationId },
        ipAddress: actor.ipAddress,
        nowSql: nowSqlStr,
      })
    );

    const notifId = crypto.randomUUID();
    const notifSubject = `Bosphorly Güvenlik Bildirimi · ${ACTION_LABELS_TR[actionType]}`;
    const notifBody = [
      'BOSPHORLY ACİL DURUM VE GÜVENLİK MERKEZİ — İŞLEM BİLDİRİMİ',
      '',
      `İşlem Kimliği: ${operationId}`,
      `Tarih / Saat (UTC): ${nowSqlStr}`,
      `Yetkili Hesap: ${actor.email}`,
      `İlgili Kanal: ${CHANNEL_LABELS_TR[targetChannel] || targetChannel}`,
      `İşlem Türü: ${ACTION_LABELS_TR[actionType]}`,
      `Kaynak: ${effectiveSource === 'telegram_command' ? 'Telegram Acil Komutu + Extranet Çift Doğrulama' : 'Extranet Çift Hesap Doğrulama'}`,
      `Önceki Durum: ${JSON.stringify(prevSummary)}`,
      `Yeni Durum: ${JSON.stringify(nextSummary)}`,
      '',
      'Web sitesi, rezervasyonlar, e-postalar ve kapatılmamış diğer kanallar normal şekilde çalışmaya devam etmektedir.',
    ].join('\n');

    stmts.push(
      db
        .prepare(
          `INSERT INTO emergency_notification_queue
           (id, operation_id, subject, body_text, delivered_json, status, attempts, next_retry_at_ms, created_at_ms)
           VALUES (?, ?, ?, ?, '[]', 'pending', 0, ?, ?)`
        )
        .bind(notifId, operationId, notifSubject, notifBody, nowMs, nowMs)
    );

    try {
      await db.batch(stmts);
    } catch (err) {
      const msg = String(err?.message || '');
      if (/UNIQUE constraint failed:\s*emergency_consumed_ops|verification_not_consumable/i.test(msg)) {
        await writeSecurityAudit(
          env,
          {
            operationId,
            actorEmail: actor.email,
            actorMemberId: actor.memberId,
            actorRole: actor.role,
            channel: targetChannel,
            actionType,
            source: 'extranet',
            outcome: 'failed',
            reason: 'concurrent_or_replay_blocked',
            ipAddress: actor.ipAddress,
          },
          nowMs
        );
        h.fail(409, 'Bu doğrulama kodu eşzamanlı bir istekle zaten kullanıldı veya geçersiz oldu.', 'CONCURRENT_REPLAY_BLOCKED');
      }
      throw err;
    }

    // Update persistent KV mirror + isolate cache immediately after atomic commit
    const isoMap = getIsolateMap(env);
    for (const [ch, stateObj] of updatedMirrors) {
      if (isoMap) isoMap.set(ch, stateObj);
      await writeKvJson(env, `emergency:ch:${ch}`, stateObj);
    }

    // Attempt notification delivery asynchronously/safely: a failure NEVER rolls back the committed channel change!
    let notificationResult = { sent: 0 };
    try {
      notificationResult = await flushEmergencyNotifications(env, nowMs);
    } catch {
      notificationResult = { sent: 0 };
    }

    const updatedView = await loadAllChannelStatesForAdmin(env, nowMs);
    return response({
      ok: true,
      operationId,
      targetChannel,
      actionType,
      channels: updatedView.channels,
      banner: updatedView.banner,
      notificationQueued: true,
      notificationDeliveredImmediately: notificationResult.sent > 0,
    });
  }

  // POST /v1/extranet/emergency/cancel-pending
  if (request.method === 'POST' && path === '/v1/extranet/emergency/cancel-pending') {
    const body = await h.body(request, 1024);
    const opId = typeof body.operationId === 'string' ? body.operationId.trim() : '';
    if (!opId) h.fail(400, 'İşlem kimliği gerekli.', 'INVALID_OPERATION_ID');
    await db
      .prepare(
        `UPDATE emergency_verifications SET status = 'invalidated'
         WHERE operation_id = ? AND actor_member_id = ? AND session_hash = ? AND status = 'pending'`
      )
      .bind(opId, actor.memberId, actor.tokenHash)
      .run();
    return response({ ok: true, cancelled: true });
  }

  h.fail(404, 'Acil durum uç noktası bulunamadı.', 'NOT_FOUND');
}
