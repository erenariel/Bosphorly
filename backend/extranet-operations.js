const roles = ["owner", "admin", "staff"];
export const BOOKING_EMAIL_TEMPLATES = {
  tr: {
    confirmation: {
      subject: "Bosphorly rezervasyon onayı",
      text: "Rezervasyonunuz onaylandı.",
    },
    reminder: {
      subject: "Bosphorly rezervasyon hatırlatması",
      text: "Yaklaşan rezervasyonunuzu hatırlatmak isteriz.",
    },
  },
  en: {
    confirmation: {
      subject: "Bosphorly booking confirmation",
      text: "Your booking has been confirmed.",
    },
    reminder: {
      subject: "Bosphorly booking reminder",
      text: "A reminder about your upcoming booking.",
    },
  },
  ru: {
    confirmation: {
      subject: "Подтверждение бронирования Bosphorly",
      text: "Ваше бронирование подтверждено.",
    },
    reminder: {
      subject: "Напоминание о бронировании Bosphorly",
      text: "Напоминаем о вашем предстоящем бронировании.",
    },
  },
};
export async function operationsRoutes(request, env, url, nowMs, h) {
  const match = url.pathname.match(
    /^\/v1\/extranet\/bookings\/([^/]+)\/(email-preview|email-confirm)$/,
  );
  if (!match && url.pathname !== "/v1/extranet/booking-email-templates")
    return null;
  const actor = await h.auth(request, env, roles, nowMs),
    now = new Date(nowMs).toISOString().replace("T", " ").slice(0, 19);
  const response = (data) =>
    h.json(data, 200, { "Set-Cookie": h.cookie(actor.rawCookie) });
  if (request.method === "GET" && !match)
    return response({ templates: BOOKING_EMAIL_TEMPLATES });
  if (request.method !== "POST" || !match)
    h.fail(405, "Desteklenmeyen HTTP metodu.");
  const item = await h.reservation(env, match[1]),
    b = await h.body(request, 2048);
  const audit = (action, oldValue, newValue) =>
    h.audit(env, {
      actorMemberId: actor.memberId,
      actorRole: actor.role,
      action,
      targetType: "booking_email",
      targetId: item.uid,
      oldValue,
      newValue,
      ipAddress: actor.ipAddress,
      nowSql: now,
    });
  if (match[2] === "email-preview") {
    const template = BOOKING_EMAIL_TEMPLATES[b.lang || item.lang]?.[b.template];
    if (!template) h.fail(400, "TR/EN/RU onay veya hatırlatma şablonu seçin.");
    if (!item._rawEmail) h.fail(409, "Bu rezervasyonda e-posta adresi yok.");
    if (
      b.template === "confirmation" &&
      !["confirmed", "completed"].includes(item.status)
    )
      h.fail(
        409,
        "Onay e-postası yalnız onaylanmış rezervasyon için gönderilir.",
      );
    if (b.template === "reminder" && item.status !== "confirmed")
      h.fail(409, "Hatırlatma için rezervasyon onaylanmış olmalı.");
    const id = crypto.randomUUID(),
      payload = {
        uid: item.uid,
        to: item._rawEmail,
        subject: template.subject,
        body:
          template.text +
          "\n" +
          item.displayRef +
          " · " +
          item.productTitle +
          "\n" +
          item.serviceDate,
      };
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO extranet_actions(id,actor_id,kind,payload_json,expires_at,created_at) VALUES(?,?,?,?,?,?)",
      ).bind(
        id,
        actor.memberId,
        "booking-email",
        JSON.stringify(payload),
        new Date(nowMs + 300000).toISOString().replace("T", " ").slice(0, 19),
        now,
      ),
      audit("preview_booking_email", null, {
        template: b.template,
        lang: b.lang || item.lang,
      }),
    ]);
    return response({
      confirmationId: id,
      preview: { ...payload, to: h.maskEmail(payload.to) },
      requiresConfirmation: true,
    });
  }
  if (b.confirm !== true) h.fail(400, "İkinci onay gerekli.");
  const draft = await env.DB.prepare(
    "SELECT * FROM extranet_actions WHERE id=? AND actor_id=? AND kind='booking-email' AND used=0 AND expires_at>?",
  )
    .bind(b.confirmationId, actor.memberId, now)
    .first();
  if (!draft) h.fail(409, "Önizleme süresi doldu veya kullanıldı.");
  const payload = JSON.parse(draft.payload_json);
  if (payload.uid !== item.uid || payload.to !== item._rawEmail)
    h.fail(409, "Kayıt değişti; yeniden önizleyin.");
  if (!["confirmed", "completed"].includes(item.status))
    h.fail(409, "Rezervasyonun durumu değişti.");
  if (!env.RESEND_API_KEY || !env.REQUEST_FROM_EMAIL)
    h.fail(503, "E-posta sağlayıcısı ayarlanmamış.");
  const claimed = await env.DB.prepare(
    "UPDATE extranet_actions SET used=1 WHERE id=? AND used=0 RETURNING id",
  )
    .bind(draft.id)
    .first();
  if (!claimed) h.fail(409, "Onay kullanılmış.");
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO extranet_booking_emails(id,record_type,record_id,actor_id,subject,body,status,created_at) VALUES(?,?,?,?,?,?,'sending',?)",
    ).bind(
      draft.id,
      item.recordType,
      item.recordId,
      actor.memberId,
      payload.subject,
      payload.body,
      now,
    ),
    audit("send_booking_email", null, { emailId: draft.id, status: "sending" }),
  ]);
  let sent = false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(5000),
      headers: {
        Authorization: "Bearer " + env.RESEND_API_KEY,
        "Content-Type": "application/json",
        "Idempotency-Key": "booking-" + draft.id,
      },
      body: JSON.stringify({
        from: env.REQUEST_FROM_EMAIL,
        to: [payload.to],
        subject: payload.subject,
        text: payload.body,
      }),
    });
    sent = r.ok;
  } catch {}
  const status = sent ? "sent" : "failed";
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE extranet_booking_emails SET status=? WHERE id=?",
    ).bind(status, draft.id),
    audit(
      "booking_email_result",
      { status: "sending" },
      { emailId: draft.id, status },
    ),
  ]);
  return response({ sent, status });
}
