export async function campaignRoutes(request, env, url, nowMs, h) {
  const path = url.pathname;
  if (
    !/^\/v1\/extranet\/(campaigns|campaign-proposals|coupon-management)(\/|$)/.test(
      path,
    ) &&
    !/^\/v1\/extranet\/members\/[^/]+\/(data-export|reveal-pii)$/.test(path)
  )
    return null;
  const actor = await h.auth(request, env, ["owner", "admin"], nowMs),
    now = new Date(nowMs).toISOString().replace("T", " ").slice(0, 19);
  const stmt = (sql, ...args) => env.DB.prepare(sql).bind(...args),
    rows = async (sql, ...args) =>
      (await stmt(sql, ...args).all()).results || [];
  const response = (data) =>
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
  const reason = (b) => {
    if (
      typeof b.reason !== "string" ||
      b.reason.trim().length < 3 ||
      b.reason.length > 500 ||
      h.containsCard(b.reason)
    )
      h.fail(400, "3–500 karakter güvenli gerekçe gerekli.");
    return b.reason.trim();
  };
  const detail = path.match(
    /^\/v1\/extranet\/members\/([^/]+)\/(data-export|reveal-pii)$/,
  );
  if (detail) {
    if (request.method !== "POST") h.fail(405, "POST gerekli.");
    const b = await h.body(request);
    reason(b);
    const id = decodeURIComponent(detail[1]),
      m = await stmt("SELECT * FROM members WHERE id=?", id).first();
    if (!m) h.fail(404, "Üye bulunamadı.");
    await audit(
      detail[2] === "data-export" ? "kvkk_export" : "reveal_member_pii",
      "member",
      id,
      null,
      {
        reason: b.reason,
        fields: detail[2] === "data-export" ? "personal export" : b.field,
      },
    ).run();
    if (detail[2] === "reveal-pii") {
      if (!["email", "phone"].includes(b.field))
        h.fail(400, "E-posta veya telefon seçin.");
      return response({ field: b.field, value: m[b.field] || null });
    }
    return response({
      exportedAt: now,
      member: m,
      reservations: await rows(
        "SELECT * FROM member_requests WHERE member_id=?",
        id,
      ),
      coupons: await rows("SELECT * FROM coupons WHERE member_id=?", id),
      identities: await rows(
        "SELECT provider,created_at FROM member_identities WHERE member_id=?",
        id,
      ),
      tierHistory: await rows(
        "SELECT old_json,new_json,reason,created_at FROM member_tier_history WHERE member_id=?",
        id,
      ),
    });
  }
  if (request.method === "GET" && path === "/v1/extranet/coupon-management") {
    await audit("list_coupons", "coupon", null, null, null).run();
    return response({
      coupons: await rows(
        "SELECT id,code,member_id,campaign_id,percent_bps,status,expires_at FROM coupons ORDER BY issued_at DESC LIMIT 200",
      ),
    });
  }
  if (request.method === "GET" && path === "/v1/extranet/campaigns") {
    await audit("list_campaigns", "campaign", null, null, null).run();
    return response({
      campaigns: await rows(
        "SELECT c.*,(SELECT COUNT(*) FROM coupons p WHERE p.campaign_id=c.id) AS issued,(SELECT COUNT(*) FROM coupons p WHERE p.campaign_id=c.id AND p.status='redeemed') AS redeemed FROM campaigns c ORDER BY starts_at DESC LIMIT 200",
      ),
      proposals: await rows(
        "SELECT * FROM extranet_campaign_proposals WHERE status='pending' ORDER BY created_at DESC LIMIT 100",
      ),
    });
  }
  const couponId = path.match(
    /^\/v1\/extranet\/coupon-management\/([^/]+)\/revoke$/,
  );
  if (request.method === "POST" && couponId) {
    const b = await h.body(request),
      why = reason(b),
      c = await stmt("SELECT * FROM coupons WHERE id=?", couponId[1]).first();
    if (!c) h.fail(404, "Kupon bulunamadı.");
    if (c.status !== "issued")
      h.fail(409, "Yalnız kullanılmamış, tutulmamış kupon iptal edilebilir.");
    await env.DB.batch([
      stmt(
        "UPDATE coupons SET status='void' WHERE id=? AND status='issued'",
        c.id,
      ),
      audit(
        "revoke_coupon",
        "coupon",
        c.id,
        { status: c.status },
        { status: "void", reason: why },
      ),
    ]);
    return response({ revoked: true });
  }
  const match = path.match(
    /^\/v1\/extranet\/campaigns\/([^/]+)\/(proposal|issue)$/,
  );
  if (request.method === "POST" && match) {
    const b = await h.body(request),
      why = reason(b),
      c = await stmt(
        "SELECT * FROM campaigns WHERE id=?",
        decodeURIComponent(match[1]),
      ).first();
    if (!c) h.fail(404, "Kampanya bulunamadı.");
    if (match[2] === "proposal") {
      if (
        !Number.isInteger(b.percentBps) ||
        b.percentBps < 1 ||
        b.percentBps > 5000 ||
        !Number.isInteger(b.validDays) ||
        b.validDays < 1 ||
        b.validDays > 730 ||
        typeof b.active !== "boolean"
      )
        h.fail(
          400,
          "Geçerli oran (1–5000 baz puan), süre ve aktiflik gerekli.",
        );
      const id = crypto.randomUUID(),
        change = {
          percent_bps: b.percentBps,
          valid_days: b.validDays,
          active: Number(b.active),
        };
      await env.DB.batch([
        stmt(
          "INSERT INTO extranet_campaign_proposals(id,campaign_id,actor_id,revision,old_json,new_json,reason,status,created_at) VALUES(?,?,?,?,?,?,?,'pending',?)",
          id,
          c.id,
          actor.memberId,
          c.revision,
          JSON.stringify(c),
          JSON.stringify(change),
          why,
          now,
        ),
        audit("propose_campaign", "campaign", c.id, c, {
          proposalId: id,
          ...change,
          reason: why,
        }),
      ]);
      return response({ proposalId: id, ownerApprovalRequired: true });
    }
    if (!c.active || c.starts_at > now || (c.ends_at && c.ends_at <= now))
      h.fail(409, "Kampanya etkin değil.");
    if (Object.keys(b).some((k) => !["memberId", "reason"].includes(k)))
      h.fail(
        400,
        "Verilen kupon oranı değiştirilemez; kampanya oranı kullanılır.",
      );
    const m = await stmt(
      "SELECT id FROM members WHERE id=?",
      b.memberId,
    ).first();
    if (!m) h.fail(404, "Üye bulunamadı.");
    const id = crypto.randomUUID(),
      code =
        "BOS-" +
        crypto.randomUUID().replaceAll("-", "").toUpperCase().slice(0, 16),
      expires = new Date(nowMs + c.valid_days * 86400000)
        .toISOString()
        .replace("T", " ")
        .slice(0, 19);
    await env.DB.batch([
      stmt(
        "INSERT INTO coupons(id,code,member_id,campaign_id,percent_bps,status,expires_at) VALUES(?,?,?,?,?,'issued',?)",
        id,
        code,
        m.id,
        c.id,
        c.percent_bps,
        expires,
      ),
      audit("issue_campaign_coupon", "coupon", id, null, {
        memberId: m.id,
        campaignId: c.id,
        percentBps: c.percent_bps,
        reason: why,
      }),
    ]);
    return response({ id, code, percentBps: c.percent_bps });
  }
  const approval = path.match(
    /^\/v1\/extranet\/campaign-proposals\/([^/]+)\/approve$/,
  );
  if (request.method === "POST" && approval) {
    if (actor.role !== "owner")
      h.fail(403, "Kampanya oranını yalnız owner onaylayabilir.");
    const b = await h.body(request);
    if (b.confirm !== true) h.fail(400, "İkinci onay gerekli.");
    const proposal = await stmt(
      "SELECT * FROM extranet_campaign_proposals WHERE id=? AND status='pending'",
      approval[1],
    ).first();
    if (!proposal) h.fail(409, "Talep bulunamadı veya sonuçlandırılmış.");
    const current = await stmt(
      "SELECT revision FROM campaigns WHERE id=?",
      proposal.campaign_id,
    ).first();
    if (current.revision !== proposal.revision)
      h.fail(409, "Kampanya değişmiş; yeni öneri oluşturun.");
    await env.DB.batch([
      stmt(
        "UPDATE extranet_campaign_proposals SET status='approved',approved_by=? WHERE id=? AND status='pending'",
        actor.memberId,
        proposal.id,
      ),
      audit(
        "approve_campaign",
        "campaign",
        proposal.campaign_id,
        JSON.parse(proposal.old_json),
        { ...JSON.parse(proposal.new_json), proposalId: proposal.id },
      ),
    ]);
    return response({ approved: true });
  }
  h.fail(404, "Uç nokta bulunamadı.");
}
