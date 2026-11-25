export async function partnerRoutes(request, env, url, nowMs, h) {
  const path = url.pathname,
    assignment = path.match(/^\/v1\/extranet\/messages\/([^/]+)\/assignment$/);
  if (
    !assignment &&
    !/^\/v1\/extranet\/(partners|partner|message-handoffs|message-assignees)(\/|$)/.test(
      path,
    )
  )
    return null;
  const own = path.startsWith("/v1/extranet/partner/"),
    inbox = assignment || path.includes("/message-");
  const actor = await h.auth(
      request,
      env,
      own
        ? ["partner"]
        : inbox
          ? ["owner", "admin", "staff"]
          : ["owner", "admin"],
      nowMs,
    ),
    now = new Date(nowMs).toISOString().replace("T", " ").slice(0, 19);
  const stmt = (sql, ...args) => env.DB.prepare(sql).bind(...args),
    rows = async (sql, ...args) =>
      (await stmt(sql, ...args).all()).results || [],
    response = (data) =>
      h.json(data, 200, { "Set-Cookie": h.cookie(actor.rawCookie) });
  const audit = (action, targetType, targetId, oldValue, newValue) =>
    h.audit(env, {
      actorMemberId: actor.memberId,
      actorRole: actor.role,
      action,
      targetType,
      targetId,
      oldValue,
      newValue,
      ipAddress: actor.ipAddress,
      nowSql: now,
    });
  if (assignment && request.method === "POST") {
    const b = await h.body(request),
      m = await stmt(
        "SELECT assigned_to FROM extranet_messages WHERE id=? AND expires_at>?",
        assignment[1],
        new Date(nowMs).toISOString(),
      ).first();
    if (!m) h.fail(404, "Mesaj bulunamadı.");
    const target = b.memberId || null;
    if (
      target &&
      !(await stmt(
        "SELECT member_id FROM extranet_users WHERE member_id=? AND active=1 AND role IN('owner','admin','staff')",
        target,
      ).first())
    )
      h.fail(400, "Aktif ekip hesabı seçin.");
    await env.DB.batch([
      stmt(
        "UPDATE extranet_messages SET assigned_to=? WHERE id=?",
        target,
        assignment[1],
      ),
      audit(
        "assign_message",
        "message",
        assignment[1],
        { assignedTo: m.assigned_to },
        { assignedTo: target },
      ),
    ]);
    return response({ assignedTo: target });
  }
  if (path === "/v1/extranet/message-assignees" && request.method === "GET")
    return response({
      users: await rows(
        "SELECT m.id,m.name,u.role FROM extranet_users u JOIN members m ON m.id=u.member_id WHERE u.active=1 AND u.role IN('owner','admin','staff')",
      ),
    });
  if (path === "/v1/extranet/message-handoffs" && request.method === "GET") {
    await audit("list_priority_handoffs", "message", null, null, null).run();
    return response({
      messages: (
        await rows(
          "SELECT id,subject,channel,status,assigned_to,email,created_at FROM extranet_messages WHERE source='handoff' AND status NOT IN('replied','archived') AND expires_at>? ORDER BY created_at ASC LIMIT 100",
          new Date(nowMs).toISOString(),
        )
      ).map((m) => ({ ...m, email: h.maskEmail(m.email) })),
    });
  }
  if (path === "/v1/extranet/partners" && request.method === "GET") {
    await audit("list_partners", "partner", null, null, null).run();
    return response({
      partners: await rows(
        "SELECT p.*,m.name AS member_name FROM extranet_partner_accounts p JOIN members m ON m.id=p.member_id ORDER BY p.created_at DESC",
      ),
    });
  }
  if (path === "/v1/extranet/partners" && request.method === "POST") {
    const b = await h.body(request);
    if (
      typeof b.name !== "string" ||
      !b.name.trim() ||
      b.name.length > 120 ||
      h.containsCard(b.name) ||
      !Number.isInteger(b.commissionBps) ||
      b.commissionBps < 0 ||
      b.commissionBps > 10000
    )
      h.fail(400, "Geçerli partner adı ve komisyon gerekli.");
    const m = await stmt(
        "SELECT id,email FROM members WHERE id=?",
        b.memberId,
      ).first(),
      p = await stmt(
        "SELECT id FROM providers WHERE id=? AND status='verified'",
        b.providerId,
      ).first();
    if (!m || !p) h.fail(400, "Üye ve doğrulanmış tedarikçi seçin.");
    if (h.ownerEmail(env, m.email))
      h.fail(403, "Owner hesabı partner yapılamaz.");
    const old = await stmt(
        "SELECT * FROM extranet_partner_accounts WHERE member_id=?",
        m.id,
      ).first(),
      role = await stmt(
        "SELECT role FROM extranet_users WHERE member_id=?",
        m.id,
      ).first();
    if (role && role.role !== "partner")
      h.fail(409, "Ekip rolü olan hesap partner yapılamaz.");
    const active = b.active === undefined ? 1 : Number(b.active === true);
    await env.DB.batch([
      stmt(
        "INSERT INTO extranet_partner_accounts(member_id,provider_id,name,commission_bps,active,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(member_id) DO UPDATE SET provider_id=excluded.provider_id,name=excluded.name,commission_bps=excluded.commission_bps,active=excluded.active",
        m.id,
        p.id,
        b.name.trim(),
        b.commissionBps,
        active,
        now,
      ),
      stmt(
        "INSERT INTO extranet_users(member_id,role,active,created_by) VALUES(?,'partner',?,?) ON CONFLICT(member_id) DO UPDATE SET active=excluded.active",
        m.id,
        active,
        actor.memberId,
      ),
      audit("save_partner", "partner", m.id, old, {
        providerId: p.id,
        name: b.name.trim(),
        commissionBps: b.commissionBps,
        active,
      }),
    ]);
    return response({ saved: true });
  }
  if (path === "/v1/extranet/partners/assign" && request.method === "POST") {
    const b = await h.body(request),
      partner = await stmt(
        "SELECT * FROM extranet_partner_accounts WHERE member_id=? AND active=1",
        b.memberId,
      ).first();
    if (!partner) h.fail(400, "Aktif partner seçin.");
    const item = await h.reservation(
      env,
      encodeURIComponent(String(b.bookingUid || "")),
    );
    if (
      ["completed", "cancelled"].includes(item.status) ||
      item.providerId !== partner.provider_id ||
      !Number.isInteger(item.totalMinor)
    )
      h.fail(
        409,
        "Aynı tedarikçiye ait, kapanmamış ve fiyatı belirli rezervasyon gerekli.",
      );
    const amount = Math.floor(
      (item.totalMinor * partner.commission_bps) / 10000,
    );
    await env.DB.batch([
      stmt(
        "INSERT INTO extranet_partner_bookings(booking_uid,partner_member_id,currency,commission_bps,amount_minor,created_at) VALUES(?,?,?,?,?,?)",
        item.uid,
        partner.member_id,
        item.currency,
        partner.commission_bps,
        amount,
        now,
      ),
      audit("assign_partner_booking", "booking", item.uid, null, {
        partnerId: partner.member_id,
        commissionBps: partner.commission_bps,
        amountMinor: amount,
        currency: item.currency,
      }),
    ]);
    return response({ assigned: true });
  }
  const complete = path.match(
      /^\/v1\/extranet\/partner\/bookings\/([^/]+)\/complete$/,
    ),
    pay = path.match(/^\/v1\/extranet\/partners\/bookings\/([^/]+)\/paid$/);
  if (complete && request.method === "POST") {
    const b = await h.body(request);
    if (b.confirm !== true) h.fail(400, "Tamamlama onayı gerekli.");
    const uid = decodeURIComponent(complete[1]);
    const row = await stmt(
      "SELECT booking_uid FROM extranet_partner_bookings WHERE booking_uid=? AND partner_member_id=?",
      uid,
      actor.memberId,
    ).first();
    if (!row) h.fail(404, "Atanmış rezervasyon bulunamadı.");
    const result = await h.changeStatus(
      new Request(request.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStatus: "completed" }),
      }),
      env,
      actor,
      encodeURIComponent(uid),
      now,
    );
    if (!result.ok) h.fail(409, "Tamamlama yapılamadı.");
    return response({ completed: true });
  }
  if (pay && request.method === "POST") {
    const b = await h.body(request),
      uid = decodeURIComponent(pay[1]),
      entry = await stmt(
        "SELECT * FROM extranet_partner_bookings WHERE booking_uid=?",
        uid,
      ).first();
    if (!entry) h.fail(404, "Komisyon kaydı yok.");
    const item = await h.reservation(env, encodeURIComponent(uid));
    if (item.status !== "completed" || entry.status !== "unpaid")
      h.fail(
        409,
        "Yalnız tamamlanan turun ödenmemiş komisyonu kaydedilebilir.",
      );
    if (
      typeof b.reference !== "string" ||
      b.reference.length < 3 ||
      b.reference.length > 120 ||
      h.containsCard(b.reference) ||
      b.confirm !== true
    )
      h.fail(
        400,
        "Kart verisi içermeyen sağlayıcı/banka referansı ve onay gerekli.",
      );
    await env.DB.batch([
      stmt(
        "UPDATE extranet_partner_bookings SET status='paid',payment_reference=?,paid_at=? WHERE booking_uid=? AND status='unpaid'",
        b.reference,
        now,
        uid,
      ),
      audit(
        "mark_partner_commission_paid",
        "booking",
        uid,
        { status: entry.status },
        { status: "paid", reference: b.reference },
      ),
    ]);
    return response({ paid: true });
  }
  if (
    request.method === "GET" &&
    [
      "/v1/extranet/partner/bookings",
      "/v1/extranet/partners/bookings",
    ].includes(path)
  ) {
    const ledger = own
        ? await rows(
            "SELECT * FROM extranet_partner_bookings WHERE partner_member_id=? ORDER BY created_at DESC LIMIT 200",
            actor.memberId,
          )
        : await rows(
            "SELECT * FROM extranet_partner_bookings ORDER BY created_at DESC LIMIT 200",
          ),
      items = [];
    for (const entry of ledger) {
      const b = await h.reservation(env, encodeURIComponent(entry.booking_uid));
      items.push({
        ...entry,
        displayRef: b.displayRef,
        productTitle: b.productTitle,
        serviceDate: b.serviceDate,
        guests: b.guests,
        bookingStatus: b.status,
        guestEmailMasked: b.guestEmailMasked,
        guestPhoneMasked: b.guestPhoneMasked,
        payable: b.status === "completed",
      });
    }
    await audit(
      "view_partner_bookings",
      "partner",
      own ? actor.memberId : null,
      null,
      { count: items.length },
    ).run();
    return response({ bookings: items });
  }
  h.fail(404, "Uç nokta bulunamadı.");
}
