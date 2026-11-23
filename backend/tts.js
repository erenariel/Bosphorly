// Google Cloud Text-to-Speech ("Chirp 3 HD - Puck") proxy with per-actor rate limit,
// D1 monthly character quota cap, Cloudflare Cache API caching, and silent fallback.

import { chatSessionFromRequest, verifyChatSessionToken } from './assistant.js';
import { resolveMemberAuth } from './mimo.js';

const TTS_ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';
export const TTS_PER_MIN_LIMIT = 10;
export const TTS_PER_DAY_LIMIT = 30;
export const TTS_GUEST_DAILY_LIMIT = 5;
export const TTS_SILVER_DAILY_LIMIT = 30;
export const TTS_GOLD_DAILY_LIMIT = 60;
export const TTS_PLATINUM_DAILY_LIMIT = 60;
export const TTS_OWNER_DAILY_LIMIT = 1000000;
export const TTS_IP_DAILY_LIMIT = 60;
export const TTS_MAX_CHARS = 600;
export const DEFAULT_TTS_MONTHLY_CHAR_CAP = 800000;
export const TTS_CACHE_TTL_SEC = 30 * 24 * 60 * 60; // 30 days

export function ttsDailyLimitForTier(tier) {
  switch (String(tier || '').toLowerCase()) {
    case 'owner':
      return TTS_OWNER_DAILY_LIMIT;
    case 'platinum':
      return TTS_PLATINUM_DAILY_LIMIT;
    case 'gold':
      return TTS_GOLD_DAILY_LIMIT;
    case 'silver':
      return TTS_SILVER_DAILY_LIMIT;
    default:
      return TTS_GUEST_DAILY_LIMIT;
  }
}

export const CHIRP_TTS_LOCALES = Object.freeze({
  tr: 'tr-TR',
  en: 'en-US',
  ru: 'ru-RU',
  uk: 'uk-UA',
  de: 'de-DE',
  fr: 'fr-FR',
  nl: 'nl-NL',
  ar: 'ar-XA',
  he: 'he-IL',
  es: 'es-ES',
  it: 'it-IT',
  pt: 'pt-BR',
  hr: 'hr-HR',
  hu: 'hu-HU',
  zh: 'cmn-CN',
  ja: 'ja-JP',
  ko: 'ko-KR',
  hi: 'hi-IN',
  bn: 'bn-IN',
  id: 'id-ID',
});

const UNSUPPORTED_CHIRP_LANGS = new Set(['fa', 'az', 'bs']);
const memoryTtsRateLimits = new Map();
const memoryTtsMonthlyChars = new Map();
const TTS_ENC = new TextEncoder();

export function resolveChirpVoice(lang) {
  const normalized = String(lang || '').trim().toLowerCase().replace(/_/g, '-');
  if (!normalized) return null;
  let short = normalized.split('-')[0];
  if (short === 'iw') short = 'he';
  else if (short === 'in') short = 'id';
  else if (short === 'cmn') short = 'zh';
  if (!short || UNSUPPORTED_CHIRP_LANGS.has(short)) return null;
  const locale = CHIRP_TTS_LOCALES[short];
  if (!locale) return null;
  return {
    shortLang: short,
    locale,
    voiceName: `${locale}-Chirp3-HD-Puck`,
  };
}

export function sanitizeSpeechText(raw, maxChars = TTS_MAX_CHARS) {
  let s = String(raw || '');
  s = s
    .replace(/<\|channel>thought[\s\S]*?(?:<channel\|>|$)/gi, '')
    .replace(/<\|channel>(?:thought)?|<channel\|>/gi, '')
    .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
    .replace(/\[\[\s*flags\s*:[\s\S]*?(?:\]\]|$)/gi, '');
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/gi, (_, label) => {
    const lbl = String(label || '').trim();
    if (!lbl || /^https?:\/\//i.test(lbl) || /^www\./i.test(lbl)) return '';
    return lbl;
  });
  s = s.replace(/https?:\/\/[^\s<>\)\]"']+/gi, '');
  s = s.replace(/\bwww\.[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s<>\)\]"']*)?/gi, '');
  s = s.replace(/\bt\.me\/[A-Za-z0-9_]+(?:\/[^\s<>\)\]"']*)?/gi, '');
  s = s.replace(/\bbosphorly\.com(?:\/[^\s<>\)\]"']*)?/gi, '');
  s = s.replace(/\(\s*\)|\[\s*\]/g, '');
  // Replace emojis with ". " when followed by words/digits so adjacent sentences never glue together.
  s = s.replace(
    /(?:[\u{1F1E6}-\u{1F1FF}]{2}|\p{Extended_Pictographic}(?:\uFE0F|\uFE0E|\u200D\p{Extended_Pictographic}|\p{Emoji_Modifier})*|[\u200D\uFE0F\uFE0E\u20E3])+(?=\s*[\p{L}\p{N}])/gu,
    '. '
  );
  s = s.replace(
    /(?:[\u{1F1E6}-\u{1F1FF}]{2}|\p{Extended_Pictographic}(?:\uFE0F|\uFE0E|\u200D\p{Extended_Pictographic}|\p{Emoji_Modifier})*|[\u200D\uFE0F\uFE0E\u20E3])+/gu,
    ' '
  );
  s = s.replace(/```[\s\S]*?```/g, ' ');
  s = s.replace(/`([^`]*)`/g, '$1');
  s = s.replace(/^[\t ]{0,3}#{1,6}[\t ]+/gm, '');
  s = s.replace(/^[\t ]{0,3}(?:[-*•]+|\d+\.)[\t ]+/gm, '');
  s = s.replace(/^[\t ]{0,3}>[\t ]?/gm, '');
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '$1');
  s = s.replace(/__([^_\n]+)__/g, '$1');
  s = s.replace(/\*([^*\n]+)\*/g, '$1');
  s = s.replace(/_([^_\n]+)_/g, '$1');
  s = s.replace(/[*_`~]+/g, '');
  s = s.replace(/\s*[:\-–—]\s*(?=$|\n)/gm, '');
  s = s.replace(/([.!?…,:;])\s*\.+/g, '$1');
  s = s.replace(/\s*\r?\n+\s*/g, '. ');
  s = s.replace(/([.!?…])\s*\./g, '$1');
  s = s.replace(/\s+([,.;!?…])/g, '$1');
  s = s.replace(/[ \t]{2,}/g, ' ');
  s = s.replace(/^[\s.,;:!?-]+(?=\S)/, '').trim();
  if (maxChars > 0 && s.length > maxChars) {
    s = s.slice(0, maxChars).trim();
  }
  return s;
}

async function sha256Hex(str) {
  const digest = await crypto.subtle.digest('SHA-256', TTS_ENC.encode(String(str)));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function base64ToUint8Array(b64) {
  const bin = atob(String(b64 || ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

async function readTtsCounter(env, key) {
  if (env && env.DB) {
    const row = await env.DB.prepare(
      'SELECT min_bucket, min_count, day_bucket, day_count FROM assistant_rate_limits WHERE key = ?'
    ).bind(key).first();
    return row
      ? {
          minBucket: Number(row.min_bucket || 0),
          minCount: Number(row.min_count || 0),
          dayBucket: String(row.day_bucket || ''),
          dayCount: Number(row.day_count || 0),
        }
      : { minBucket: 0, minCount: 0, dayBucket: '', dayCount: 0 };
  }
  return memoryTtsRateLimits.get(key) || { minBucket: 0, minCount: 0, dayBucket: '', dayCount: 0 };
}

async function incrementTtsCounter(env, key, minBucket, dayBucket) {
  if (env && env.DB) {
    const row = await env.DB.prepare(
      'SELECT min_bucket, min_count, day_bucket, day_count FROM assistant_rate_limits WHERE key = ?'
    ).bind(key).first();
    const minCount = row && row.min_bucket === minBucket ? Number(row.min_count || 0) + 1 : 1;
    const dayCount = row && row.day_bucket === dayBucket ? Number(row.day_count || 0) + 1 : 1;
    await env.DB.prepare(
      `INSERT INTO assistant_rate_limits (key, min_bucket, min_count, day_bucket, day_count)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET min_bucket = excluded.min_bucket, min_count = excluded.min_count,
         day_bucket = excluded.day_bucket, day_count = excluded.day_count`
    ).bind(key, minBucket, minCount, dayBucket, dayCount).run();
    return { minCount, dayCount };
  }
  if (memoryTtsRateLimits.size > 2000) memoryTtsRateLimits.clear();
  const prev = memoryTtsRateLimits.get(key) || { minBucket: 0, minCount: 0, dayBucket: '', dayCount: 0 };
  const minCount = prev.minBucket === minBucket ? prev.minCount + 1 : 1;
  const dayCount = prev.dayBucket === dayBucket ? prev.dayCount + 1 : 1;
  memoryTtsRateLimits.set(key, { minBucket, minCount, dayBucket, dayCount });
  return { minCount, dayCount };
}

async function incrementTtsDayOnly(env, key, dayBucket) {
  const prev = await readTtsCounter(env, key);
  const dayCount = prev.dayBucket === dayBucket ? prev.dayCount + 1 : 1;
  if (env && env.DB) {
    await env.DB.prepare(
      `INSERT INTO assistant_rate_limits (key, min_bucket, min_count, day_bucket, day_count)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET day_bucket = excluded.day_bucket, day_count = excluded.day_count`
    ).bind(key, prev.minBucket, prev.minCount, dayBucket, dayCount).run();
    return { minCount: prev.minCount, dayCount };
  }
  if (memoryTtsRateLimits.size > 2000) memoryTtsRateLimits.clear();
  memoryTtsRateLimits.set(key, { minBucket: prev.minBucket, minCount: prev.minCount, dayBucket, dayCount });
  return { minCount: prev.minCount, dayCount };
}

async function checkAndIncrementTtsLimits({
  env,
  actorKey,
  ipActorKey = null,
  tier = 'guest',
  dayLimit = null,
  ipDayLimit = TTS_IP_DAILY_LIMIT,
  now = Date.now(),
}) {
  const key = `tts:${actorKey}`;
  const ipKey = ipActorKey ? `tts:${ipActorKey}` : null;
  const minBucket = Math.floor(now / 60000);
  const dayBucket = new Date(now).toISOString().slice(0, 10);
  const effectiveDayLimit = Number.isFinite(Number(dayLimit)) && Number(dayLimit) > 0
    ? Number(dayLimit)
    : ttsDailyLimitForTier(tier);
  const effectiveIpDayLimit = Number.isFinite(Number(ipDayLimit)) && Number(ipDayLimit) > 0
    ? Number(ipDayLimit)
    : TTS_IP_DAILY_LIMIT;
  const hasSeparateIpBrake = String(tier || '').toLowerCase() !== 'owner' && Boolean(ipKey && ipKey !== key);

  if (hasSeparateIpBrake) {
    const ipPrev = await readTtsCounter(env, ipKey);
    const ipDayCount = ipPrev.dayBucket === dayBucket ? ipPrev.dayCount : 0;
    if (ipDayCount >= effectiveIpDayLimit) {
      return { allowed: false, minOk: true, dayOk: false };
    }
  }

  const actor = await incrementTtsCounter(env, key, minBucket, dayBucket);
  const minOk = actor.minCount <= TTS_PER_MIN_LIMIT;
  const dayOk = actor.dayCount <= effectiveDayLimit;
  if (!minOk || !dayOk) {
    return { allowed: false, minOk, dayOk };
  }

  if (hasSeparateIpBrake) {
    const ipNext = await incrementTtsDayOnly(env, ipKey, dayBucket);
    if (ipNext.dayCount > effectiveIpDayLimit) {
      return { allowed: false, minOk: true, dayOk: false };
    }
  }

  return { allowed: true, minOk: true, dayOk: true };
}

export async function checkTtsActorRateLimit({
  env,
  actorKey,
  ipActorKey = null,
  tier = 'guest',
  dayLimit = null,
  ipDayLimit = TTS_IP_DAILY_LIMIT,
  now = Date.now(),
}) {
  const status = await checkAndIncrementTtsLimits({ env, actorKey, ipActorKey, tier, dayLimit, ipDayLimit, now });
  return Boolean(status.allowed);
}

function getTtsMonthlyCap(env) {
  const raw = env && env.TTS_MONTHLY_CHAR_CAP;
  if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return DEFAULT_TTS_MONTHLY_CHAR_CAP;
}

async function getMonthlyChars(env, month) {
  if (env && env.DB) {
    const row = await env.DB.prepare(
      'SELECT chars FROM tts_usage WHERE month = ?'
    ).bind(month).first();
    return row ? Number(row.chars || 0) : 0;
  }
  return Number(memoryTtsMonthlyChars.get(month) || 0);
}

async function incrementMonthlyChars(env, month, deltaChars) {
  const delta = Math.max(0, Math.floor(Number(deltaChars) || 0));
  if (!delta) return;
  if (env && env.DB) {
    await env.DB.prepare(
      `INSERT INTO tts_usage (month, chars)
       VALUES (?, ?)
       ON CONFLICT(month) DO UPDATE SET chars = tts_usage.chars + ?`
    ).bind(month, delta, delta).run();
    return;
  }
  memoryTtsMonthlyChars.set(month, Number(memoryTtsMonthlyChars.get(month) || 0) + delta);
}

function getCacheStore(env) {
  if (env && env.TTS_CACHE && typeof env.TTS_CACHE.match === 'function') return env.TTS_CACHE;
  if (typeof caches !== 'undefined' && caches && caches.default) return caches.default;
  return null;
}

function logTtsUsage({ lang, chars, cached, fallback, ms }) {
  // Never log message text or personal details — metrics only.
  console.log('assistant_tts', JSON.stringify({
    lang: lang || 'unknown',
    chars: Math.max(0, Math.floor(Number(chars) || 0)),
    cached: Boolean(cached),
    fallback: Boolean(fallback),
    ms: Math.max(0, Math.round(Number(ms) || 0)),
  }));
}

async function readJsonBody(request, maxBytes = 8192) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) {
    return { error: 'JSON required', status: 415 };
  }
  const reader = request.body?.getReader();
  let raw = '';
  let size = 0;
  const decoder = new TextDecoder();
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        return { error: 'Payload too large', status: 413 };
      }
      raw += decoder.decode(value, { stream: true });
    }
  }
  raw += decoder.decode();
  try {
    return { data: JSON.parse(raw) };
  } catch {
    return { error: 'Invalid JSON', status: 400 };
  }
}

export async function synthesizeTtsAudio({ env = {}, text = '', lang = 'en', now = Date.now(), fetchImpl = fetch }) {
  const startMs = Date.now();
  const rawShortLang = String(lang || '').trim().toLowerCase().replace(/_/g, '-').split('-')[0] || 'unknown';
  const cleanText = sanitizeSpeechText(text, TTS_MAX_CHARS);
  if (!cleanText) {
    return { kind: 'empty' };
  }

  const finishFallback = (shortLang = rawShortLang) => {
    logTtsUsage({
      lang: shortLang,
      chars: cleanText.length,
      cached: false,
      fallback: true,
      ms: Date.now() - startMs,
    });
    return { kind: 'fallback' };
  };

  const voice = resolveChirpVoice(lang);
  if (!voice) {
    return finishFallback(rawShortLang);
  }

  const cache = getCacheStore(env);
  const hashHex = await sha256Hex(`${voice.locale}${voice.voiceName}${cleanText}`);
  const cacheReq = new Request(`https://tts-cache.bosphorly.internal/v1/tts/${hashHex}.mp3`, { method: 'GET' });

  if (cache) {
    try {
      const cachedRes = await cache.match(cacheReq);
      if (cachedRes) {
        const audioBuf = await cachedRes.arrayBuffer();
        if (audioBuf && audioBuf.byteLength > 0) {
          logTtsUsage({
            lang: voice.shortLang,
            chars: cleanText.length,
            cached: true,
            fallback: false,
            ms: Date.now() - startMs,
          });
          return { kind: 'audio', audio: new Uint8Array(audioBuf), cached: true };
        }
      }
    } catch {}
  }

  const month = new Date(now).toISOString().slice(0, 7);
  const monthlyCap = getTtsMonthlyCap(env);
  const usedChars = await getMonthlyChars(env, month);
  if (usedChars + cleanText.length > monthlyCap) {
    return finishFallback(voice.shortLang);
  }

  const apiKey = env && typeof env.GOOGLE_TTS_API_KEY === 'string' ? env.GOOGLE_TTS_API_KEY.trim() : '';
  if (!apiKey) {
    return finishFallback(voice.shortLang);
  }

  let audioBytes = null;
  try {
    const res = await fetchImpl(TTS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
      },
      body: JSON.stringify({
        input: { text: cleanText },
        voice: { languageCode: voice.locale, name: voice.voiceName },
        audioConfig: { audioEncoding: 'MP3', speakingRate: 1.05 },
      }),
    });
    if (!res || !res.ok) {
      return finishFallback(voice.shortLang);
    }
    const data = await res.json().catch(() => null);
    if (!data || typeof data.audioContent !== 'string' || !data.audioContent) {
      return finishFallback(voice.shortLang);
    }
    audioBytes = base64ToUint8Array(data.audioContent);
    if (!audioBytes.byteLength) {
      return finishFallback(voice.shortLang);
    }
  } catch {
    return finishFallback(voice.shortLang);
  }

  await incrementMonthlyChars(env, month, cleanText.length);

  if (cache) {
    try {
      await cache.put(
        cacheReq,
        new Response(audioBytes, {
          status: 200,
          headers: {
            'Content-Type': 'audio/mpeg',
            'Cache-Control': `public, max-age=${TTS_CACHE_TTL_SEC}`,
          },
        })
      );
    } catch {}
  }

  logTtsUsage({
    lang: voice.shortLang,
    chars: cleanText.length,
    cached: false,
    fallback: false,
    ms: Date.now() - startMs,
  });
  return { kind: 'audio', audio: audioBytes, cached: false };
}

export async function handleTtsRoute(request, env, _url, now = Date.now()) {
  const origin = request.headers.get('Origin');
  const corsHeaders = {};
  if (origin && env && origin === env.PUBLIC_ORIGIN) {
    corsHeaders['Access-Control-Allow-Origin'] = origin;
    corsHeaders.Vary = 'Origin';
  }
  const jsonResp = (body, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...corsHeaders,
    },
  });

  if (request.method !== 'POST') return jsonResp({ error: 'Method not allowed' }, 405);

  const ip = (request.headers.get('CF-Connecting-IP') || 'unknown').trim() || 'unknown';
  const explicitChatHeader = (request.headers.get('X-Chat-Session') || '').trim();
  const rawChatSession = explicitChatHeader || chatSessionFromRequest(request);
  const sessionOk = await verifyChatSessionToken(env?.CODE_PEPPER, rawChatSession, ip, now);
  if (!sessionOk) return jsonResp({ error: 'Chat session required' }, 401);

  const rawMemberHeader = request.headers.get('X-Member-Session')
    || (explicitChatHeader ? request.headers.get('Authorization') : '')
    || '';
  let memberAuth = null;
  try {
    memberAuth = await resolveMemberAuth(env, rawMemberHeader, now);
  } catch { /* invalid/expired member session safely falls back to guest tier */ }

  const ipActorKey = `ip:${ip}`;
  const actorKey = memberAuth ? `member:${memberAuth.memberId}` : ipActorKey;
  const tier = memberAuth ? memberAuth.tier : 'guest';

  const limit = await checkAndIncrementTtsLimits({ env, actorKey, ipActorKey, tier, now });
  if (!limit.dayOk) {
    return jsonResp({ fallback: true }, 200);
  }
  if (!limit.minOk) {
    return jsonResp({ error: 'Rate limited' }, 429);
  }

  const parsed = await readJsonBody(request);
  if (parsed.error) return jsonResp({ error: parsed.error }, parsed.status);
  const body = parsed.data;
  if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.text !== 'string') {
    return jsonResp({ error: 'Invalid payload' }, 400);
  }

  const lang = typeof body.lang === 'string' ? body.lang : 'en';
  const result = await synthesizeTtsAudio({ env, text: body.text, lang, now });
  if (result.kind === 'empty') {
    return jsonResp({ fallback: true }, 200);
  }
  if (result.kind === 'fallback') {
    return jsonResp({ fallback: true }, 200);
  }

  return new Response(result.audio, {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'private, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
      ...corsHeaders,
    },
  });
}
