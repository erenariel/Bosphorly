export function redactCards(value) {
  return String(value || "").replace(
    /(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g,
    (raw) => {
      const digits = raw.replace(/\D/g, "");
      let sum = 0;
      for (let i = digits.length - 1, n = 0; i >= 0; i--, n++) {
        let d = Number(digits[i]);
        if (n % 2) {
          d *= 2;
          if (d > 9) d -= 9;
        }
        sum += d;
      }
      return sum % 10 === 0 ? "[CARD REDACTED]" : raw;
    },
  );
}
export async function captureMessage(env, data, now = Date.now()) {
  if (!env?.DB) return null;
  if (!["form", "handoff", "complaint", "blocked"].includes(data.source))
    throw new Error("Unsupported inbox source");
  const months = Math.max(
    1,
    Math.min(120, Number(env.MESSAGE_RETENTION_MONTHS) || 24),
  );
  const expires = new Date(now);
  expires.setUTCMonth(expires.getUTCMonth() + months);
  const id = data.id || crypto.randomUUID();
  try {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO extranet_messages(id,source,reference,member_id,name,email,phone,subject,body,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
    )
      .bind(
        id,
        data.source,
        data.reference || null,
        data.memberId || null,
        redactCards(data.name).slice(0, 120),
        redactCards(data.email) || null,
        redactCards(data.phone).slice(0, 40),
        redactCards(data.subject).slice(0, 200),
        redactCards(data.body).slice(0, 16000),
        new Date(now).toISOString(),
        expires.toISOString(),
      )
      .run();
  } catch (error) {
    if (!/no such table.*extranet_messages/i.test(String(error.message)))
      throw error;
    return null;
  }
  return id;
}
export async function cleanupInbox(env, now = Date.now()) {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(
    cutoff.getUTCMonth() -
      Math.max(1, Math.min(120, Number(env.MESSAGE_RETENTION_MONTHS) || 24)),
  );
  try {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM extranet_messages WHERE expires_at<=?").bind(
        new Date(now).toISOString(),
      ),
      env.DB.prepare("DELETE FROM extranet_actions WHERE expires_at<=?").bind(
        new Date(now).toISOString(),
      ),
      env.DB.prepare(
        "DELETE FROM extranet_replies WHERE created_at<=? AND message_id IS NULL",
      ).bind(cutoff.toISOString()),
    ]);
  } catch (error) {
    if (
      !/no such table.*extranet_(messages|actions|replies)/i.test(
        String(error.message),
      )
    )
      throw error;
  }
}
