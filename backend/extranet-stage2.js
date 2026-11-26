import { membershipTier, MEMBER_TIERS } from "./membership-tier.js";
import { memberControls } from "./member-controls.js";
import { redactCards } from "./message-store.js";

export const REPLY_TEMPLATES = {
  tr: {
    subject: "Bosphorly talebiniz hakkında",
    body: "Merhaba, talebinizi aldık. Ekibimiz ayrıntıları kontrol edip size dönüş yapacak. Teşekkürler, Bosphorly",
  },
  en: {
    subject: "Your Bosphorly request",
    body: "Hello, we received your request. Our team will check the details and get back to you. Thank you, Bosphorly",
  },
  ru: {
    subject: "Ваш запрос Bosphorly",
    body: "Здравствуйте! Мы получили ваш запрос. Наша команда проверит детали и свяжется с вами. Спасибо, Bosphorly",
  },
};
const allRoles = ["owner", "admin", "staff"],
  managers = ["owner", "admin"];
const sqlTime = (ms) =>
  new Date(ms).toISOString().replace("T", " ").slice(0, 19);
const parse = (value) => JSON.parse(value);
const token = () => crypto.randomUUID();
export async function stage2Routes(request, env, url, nowMs, h) {
  const {
    auth: authenticate,
    fail,
    json,
    body: readBody,
    audit,
    ownerEmail,
    maskEmail,
    maskPhone,
  } = h;
  const pii = (value) =>
    String(value || "")
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, maskEmail)
      .replace(/\+?\d[\d ()-]{8,}\d/g, (raw) =>
        raw.replace(/\D/g, "").length >= 10 ? maskPhone(raw) : raw,
      );
  const path = url.pathname,
    method = request.method,
    now = sqlTime(nowMs);
  if (
    !/^\/v1\/extranet\/(members|messages|actions|reply-templates)(\/|$)/.test(
      path,
    )
  )
    return null;
  const tierOperation =
    /\/(tier|tier-preview|tier-bulk-preview|controls|tier-mail-preview)(\/|$)/.test(
      path,
    );
  const restricted = method !== "GET" || tierOperation;
  const roles = path.includes("/delete-preview")
    ? ["owner"]
    : path.startsWith("/v1/extranet/messages") ||
        path.includes("/actions/") ||
        path.endsWith("/reply-templates")
      ? allRoles
      : restricted
        ? managers
        : allRoles;
  const actor = await authenticate(request, env, roles, nowMs);
  const respond = (data, status = 200) =>
    json(data, status, { "Set-Cookie": h.cookie(actor.rawCookie) });
  const stmt = (sql, ...args) => env.DB.prepare(sql).bind(...args);
  const first = (sql, ...args) => stmt(sql, ...args).first();
  const rows = async (sql, ...args) => (await stmt(sql, ...args).all()).results;
  const log = (action, targetType, targetId, oldValue, newValue) =>
    audit(env, {
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
  const member = async (id) => {
    const m = await first("SELECT * FROM members WHERE id=?", id);
    if (!m) fail(404, "Üye bulunamadı.");
    return m;
  };
  const protect = (m) => {
    if (ownerEmail(env, m.email))
      fail(403, "İşletme sahibi hesabı bu işlemden korunur.");
  };
  const reason = (b) => {
    if (
      typeof b.reason !== "string" ||
      b.reason.trim().length < 3 ||
      b.reason.length > 500 ||
      redactCards(b.reason) !== b.reason
    )
      fail(400, "3–500 karakter kart verisi içermeyen gerekçe gerekli.");
    return b.reason.trim();
  };
  const count = async (id) =>
    Number(
      (
        await first(
          "SELECT COUNT(*) AS n FROM member_requests WHERE member_id=? AND state='fulfilled'",
          id,
        )
      ).n,
    );
  const preview = async (kind, payload, summary) => {
    const id = token();
    await stmt(
      "INSERT INTO extranet_actions(id,actor_id,kind,payload_json,expires_at,created_at) VALUES(?,?,?,?,?,?)",
      id,
      actor.memberId,
      kind,
      JSON.stringify(payload),
      sqlTime(nowMs + 10 * 60000),
      now,
    ).run();
    await log("preview_" + kind, kind, null, null, {
      count: summary.count || 1,
    }).run();
    return respond({
      confirmationId: id,
      preview: summary,
      requiresConfirmation: true,
    });
  };
  const levelChange = async (m, b) => {
    const before = {
      ...(await membershipTier(env, m.id, await count(m.id), nowMs)),
      controls: await memberControls(env, m.id),
    };
    const why = reason(b);
    const days = b.days == null ? null : Number(b.days);
    if (
      !["automatic", ...MEMBER_TIERS].includes(b.tier) ||
      (days !== null && (!Number.isInteger(days) || days < 1 || days > 730))
    )
      fail(400, "Geçersiz seviye veya süre.");
    const currentOverride = await first(
      "SELECT expires_at FROM member_tier_overrides WHERE member_id=?",
      m.id,
    );
    if (
      days &&
      currentOverride?.expires_at &&
      Date.parse(currentOverride.expires_at) > nowMs
    )
      fail(
        409,
        "Önce mevcut süreli atamayı kaldırın; üst üste süreli atama yapılamaz.",
      );
    const expires = days ? sqlTime(nowMs + days * 86400000) : null;
    // Restore the prior manual level after a temporary assignment; otherwise return to automatic/frozen.
    const mutation =
      b.tier === "automatic"
        ? stmt("DELETE FROM member_tier_overrides WHERE member_id=?", m.id)
        : stmt(
            `INSERT INTO member_tier_overrides(member_id,tier,reason,updated_by,updated_at,expires_at,previous_tier) VALUES(?,?,?,?,?,?,?) ON CONFLICT(member_id) DO UPDATE SET tier=excluded.tier,reason=excluded.reason,updated_by=excluded.updated_by,updated_at=excluded.updated_at,expires_at=excluded.expires_at,previous_tier=excluded.previous_tier`,
            m.id,
            b.tier,
            why,
            actor.memberId,
            now,
            expires,
            before.manualTier,
          );
    const after = {
      tier: b.tier,
      expiresAt: expires,
      previousTier: before.manualTier,
    };
    const statements = [
      mutation,
      stmt(
        "INSERT INTO member_tier_history(id,member_id,actor_id,old_json,new_json,reason,created_at) VALUES(?,?,?,?,?,?,?)",
        token(),
        m.id,
        actor.memberId,
        JSON.stringify(before),
        JSON.stringify(after),
        why,
        now,
      ),
      log("set_member_tier", "member", m.id, before, { ...after, reason: why }),
    ];
    if (b.tier === "automatic")
      statements.push(
        stmt(
          "UPDATE member_controls SET automatic_disabled=0,frozen_tier=NULL WHERE member_id=?",
          m.id,
        ),
      );
    return statements;
  };
  if (method === "GET" && path === "/v1/extranet/reply-templates")
    return respond(REPLY_TEMPLATES);
  if (method === "GET" && path === "/v1/extranet/members") {
    const q = (url.searchParams.get("q") || "").trim().slice(0, 120),
      page = Math.max(
        1,
        Math.min(10000, Number(url.searchParams.get("page")) || 1),
      );
    const pattern = "%" + q.replace(/[\\%_]/g, (c) => "\\" + c) + "%";
    const status = url.searchParams.get("status"),
      tier = url.searchParams.get("tier"),
      provider = url.searchParams.get("provider");
    if (tier && !managers.includes(actor.role))
      fail(403, "Seviye kontrolleri yetkisi gerekli.");
    // Bound by database pagination; level filtering is also computed in SQL using expiry/frozen rules.
    const effective = `COALESCE((SELECT CASE WHEN expires_at IS NOT NULL AND expires_at<=? THEN previous_tier ELSE tier END FROM member_tier_overrides WHERE member_id=m.id),(SELECT CASE WHEN automatic_disabled=1 THEN frozen_tier END FROM member_controls WHERE member_id=m.id),CASE WHEN (SELECT COUNT(*) FROM member_requests WHERE member_id=m.id AND state='fulfilled')>=5 THEN 'platinum' WHEN (SELECT COUNT(*) FROM member_requests WHERE member_id=m.id AND state='fulfilled')>=2 THEN 'gold' ELSE 'silver' END)`;
    let where =
        "WHERE (m.name LIKE ? ESCAPE '\\' OR m.email LIKE ? ESCAPE '\\')",
      args = [pattern, pattern];
    if (["active", "suspended"].includes(status)) {
      where +=
        " AND COALESCE((SELECT suspended FROM member_controls WHERE member_id=m.id),0)=?";
      args.push(status === "suspended" ? 1 : 0);
    }
    if (MEMBER_TIERS.has(tier)) {
      where +=
        " AND (CASE WHEN lower(m.email)=? THEN 'platinum' ELSE " +
        effective +
        " END)=?";
      args.push(
        String(env.ADMIN_OWNER_EMAIL || "")
          .trim()
          .toLowerCase(),
        now,
        tier,
      );
    }
    if (provider) {
      where +=
        provider === "email"
          ? " AND 1=1"
          : provider === "passkey"
            ? " AND EXISTS(SELECT 1 FROM passkeys WHERE member_id=m.id)"
            : " AND EXISTS(SELECT 1 FROM member_identities WHERE member_id=m.id AND provider=?)";
      if (!["email", "passkey"].includes(provider)) args.push(provider);
    }
    const total = await first(
      "SELECT COUNT(*) AS n FROM members m " + where,
      ...args,
    );
    const found = await rows(
      `SELECT m.*,(SELECT last_login FROM member_activity WHERE member_id=m.id) AS last_login,(SELECT COUNT(*) FROM member_requests WHERE member_id=m.id) AS request_count FROM members m ${where} ORDER BY m.created_at DESC,m.id LIMIT 20 OFFSET ?`,
      ...args,
      (page - 1) * 20,
    );
    const members = [];
    for (const m of found) {
      const levels = await membershipTier(env, m.id, await count(m.id), nowMs);
      members.push({
        id: m.id,
        name: m.name,
        lang: m.lang,
        country: m.country || null,
        email: maskEmail(m.email),
        phone: maskPhone(m.phone),
        owner: ownerEmail(env, m.email),
        createdAt: m.created_at,
        lastLogin: m.last_login,
        requestCount: m.request_count,
        methods: [
          "email",
          ...(
            await rows(
              "SELECT DISTINCT provider FROM member_identities WHERE member_id=?",
              m.id,
            )
          ).map((x) => x.provider),
          ...((await first(
            "SELECT credential_id FROM passkeys WHERE member_id=? LIMIT 1",
            m.id,
          ))
            ? ["passkey"]
            : []),
        ],
        suspended: !!(await memberControls(env, m.id)).suspended,
        fulfilledCount: await count(m.id),
        owner: ownerEmail(env, m.email),
        ...(managers.includes(actor.role) ? levels : {}),
      });
    }
    await log("list_members", "member", null, null, {
      count: members.length,
    }).run();
    return respond({ members, total: total.n, page, pageSize: 20 });
  }
  const match =
    path === "/v1/extranet/members/tier-bulk-preview"
      ? null
      : path.match(/^\/v1\/extranet\/members\/([^/]+)(?:\/(.*))?$/);
  if (match) {
    const id = decodeURIComponent(match[1]),
      operation = match[2],
      m = await member(id);
    if (method === "GET" && !operation) {
      const data = {
        id: m.id,
        name: m.name,
        lang: m.lang,
        country: m.country || null,
        email: maskEmail(m.email),
        phone: maskPhone(m.phone),
        owner: ownerEmail(env, m.email),
        createdAt: m.created_at,
        lastLogin:
          (
            await first(
              "SELECT last_login FROM member_activity WHERE member_id=?",
              id,
            )
          )?.last_login || null,
        requests: await rows(
          "SELECT ref,service_id,service_date,guests,state,created_at FROM member_requests WHERE member_id=? ORDER BY created_at DESC LIMIT 100",
          id,
        ),
        coupons: await rows(
          "SELECT id,code,percent_bps,status,expires_at FROM coupons WHERE member_id=? ORDER BY issued_at DESC LIMIT 100",
          id,
        ),
        mimo: await first(
          "SELECT COALESCE(SUM(day_count),0) AS messagesToday,MAX(day_bucket) AS counterDay FROM assistant_rate_limits WHERE key=?",
          "member:" + id,
        ),
      };
      if (managers.includes(actor.role))
        Object.assign(data, {
          levels: ownerEmail(env, m.email)
            ? {
                tier: "platinum",
                automaticTier: "platinum",
                manualTier: null,
                tierSource: "owner",
                unlimited: true,
              }
            : await membershipTier(env, id, await count(id), nowMs),
          controls: await memberControls(env, id),
          history: await rows(
            "SELECT actor_id,old_json,new_json,reason,created_at FROM member_tier_history WHERE member_id=? ORDER BY created_at DESC LIMIT 100",
            id,
          ),
        });
      await log("view_member", "member", id, null, null).run();
      return respond(data);
    }
    if (method === "POST") {
      const b = await readBody(request, 8192);
      protect(m);
      if (operation === "tier") {
        await env.DB.batch(await levelChange(m, b));
        return respond(await membershipTier(env, id, await count(id), nowMs));
      }
      if (operation === "tier-preview")
        return preview(
          "tier",
          { ids: [id], ...b },
          {
            count: 1,
            member: maskEmail(m.email),
            tier: b.tier,
            days: b.days || null,
            reason: reason(b),
          },
        );
      if (operation === "controls") {
        reason(b);
        const old = await memberControls(env, id);
        if (
          (b.suspended !== undefined && typeof b.suspended !== "boolean") ||
          (b.automaticDisabled !== undefined &&
            typeof b.automaticDisabled !== "boolean") ||
          (b.mimoDailyLimit !== undefined &&
            b.mimoDailyLimit !== null &&
            (!Number.isInteger(b.mimoDailyLimit) ||
              b.mimoDailyLimit < 0 ||
              b.mimoDailyLimit > 10000))
        )
          fail(400, "Geçersiz hesap ayarı.");
        const suspended =
            b.suspended === undefined ? !!old.suspended : b.suspended,
          disabled =
            b.automaticDisabled === undefined
              ? !!old.automatic_disabled
              : b.automaticDisabled;
        const frozen = disabled
          ? old.automatic_disabled
            ? old.frozen_tier
            : (await membershipTier(env, id, await count(id), nowMs)).tier
          : null;
        const limit =
          b.mimoDailyLimit === undefined
            ? (old.mimo_daily_limit ?? null)
            : b.mimoDailyLimit;
        const statements = [
          stmt(
            `INSERT INTO member_controls(member_id,suspended,automatic_disabled,frozen_tier,mimo_daily_limit) VALUES(?,?,?,?,?) ON CONFLICT(member_id) DO UPDATE SET suspended=excluded.suspended,automatic_disabled=excluded.automatic_disabled,frozen_tier=excluded.frozen_tier,mimo_daily_limit=excluded.mimo_daily_limit`,
            id,
            Number(suspended),
            Number(disabled),
            frozen,
            limit,
          ),
          log("member_controls", "member", id, old, {
            suspended,
            disabled,
            frozen,
            limit,
            reason: b.reason,
          }),
        ];
        if (suspended || b.revokeSessions === true)
          statements.push(
            stmt("DELETE FROM sessions WHERE member_id=?", id),
            stmt("DELETE FROM extranet_sessions WHERE member_id=?", id),
            stmt("DELETE FROM passkey_challenges WHERE member_id=?", id),
            stmt("DELETE FROM login_codes WHERE email=?", m.email),
          );
        await env.DB.batch(statements);
        return respond({ updated: true });
      }
      if (operation === "coupon") {
        const why = reason(b),
          bps = Number(b.percentBps),
          days = Number(b.validDays);
        if (
          !Number.isInteger(bps) ||
          bps < 1 ||
          bps > Math.min(5000, Number(env.MAX_DISCOUNT_BPS) || 1000) ||
          !Number.isInteger(days) ||
          days < 1 ||
          days > 730
        )
          fail(400, "Geçersiz kupon oranı veya süre.");
        const campaign = "manual-" + token(),
          code =
            "BOS-" + token().replaceAll("-", "").slice(0, 12).toUpperCase();
        await env.DB.batch([
          stmt(
            "INSERT INTO campaigns(id,kind,percent_bps,valid_days) VALUES(?,'loyalty',?,?)",
            campaign,
            bps,
            days,
          ),
          stmt(
            "INSERT INTO coupons(id,code,member_id,campaign_id,percent_bps,status,expires_at) VALUES(?,?,?,?,?,'issued',?)",
            token(),
            code,
            id,
            campaign,
            bps,
            sqlTime(nowMs + days * 86400000),
          ),
          log("grant_coupon", "member", id, null, {
            code,
            percentBps: bps,
            validDays: days,
            reason: why,
          }),
        ]);
        return respond({ code });
      }
      if (operation === "delete-preview")
        return preview(
          "delete",
          { id, reason: reason(b) },
          {
            member: maskEmail(m.email),
            message:
              "Üye hesabı, talepleri, kuponları ve kişisel kayıtları silinecek. İşlem geri alınamaz.",
          },
        );
      if (operation === "tier-mail-preview") {
        if (!managers.includes(actor.role)) fail(403, "Yetki gerekli.");
        const levels = await membershipTier(env, id, await count(id), nowMs),
          lang = ["tr", "en", "ru"].includes(b.lang) ? b.lang : "tr";
        const templates = {
          tr: ["Üyelik seviyeniz güncellendi", "Bosphorly üyelik seviyeniz: "],
          en: [
            "Your membership level was updated",
            "Your Bosphorly membership level: ",
          ],
          ru: ["Ваш уровень участника обновлён", "Ваш уровень Bosphorly: "],
        };
        return preview(
          "tier-mail",
          {
            id,
            to: m.email,
            subject: templates[lang][0],
            body: templates[lang][1] + levels.tier,
          },
          {
            to: maskEmail(m.email),
            subject: templates[lang][0],
            body: templates[lang][1] + levels.tier,
          },
        );
      }
    }
  }
  if (method === "POST" && path === "/v1/extranet/members/tier-bulk-preview") {
    const b = await readBody(request, 16384);
    reason(b);
    if (!Array.isArray(b.ids) || !b.ids.length || b.ids.length > 100)
      fail(400, "1–100 üye seçin.");
    if (!["automatic", ...MEMBER_TIERS].includes(b.tier))
      fail(400, "Geçersiz seviye.");
    const ids = [],
      skipped = [];
    for (const id of [...new Set(b.ids)]) {
      const m = await member(id);
      if (ownerEmail(env, m.email)) skipped.push(id);
      else ids.push(id);
    }
    return preview(
      "tier",
      { ...b, ids },
      {
        count: ids.length,
        skipped: skipped.length,
        tier: b.tier,
        days: b.days || null,
        reason: b.reason,
      },
    );
  }
  if (method === "GET" && path === "/v1/extranet/messages") {
    const page = Math.max(
      1,
      Math.min(10000, Number(url.searchParams.get("page")) || 1),
    );
    let where = "WHERE expires_at>?",
      args = [new Date(nowMs).toISOString()];
    for (const [name, allowed] of [
      ["status", ["new", "read", "replied", "archived"]],
      ["source", ["form", "handoff", "complaint", "blocked"]],
      ["channel", ["web","whatsapp","telegram","email"]],
    ]) {
      const v = url.searchParams.get(name);
      if (allowed.includes(v)) {
        where += " AND " + name + "=?";
        args.push(v);
      }
    }
    const assigned=url.searchParams.get('assignedTo');
    if(assigned==='me'){where+=' AND assigned_to=?';args.push(actor.memberId);}
    const total = await first(
        "SELECT COUNT(*) AS n FROM extranet_messages " + where,
        ...args,
      ),
      items = await rows(
        "SELECT id,source,channel,assigned_to,subject,status,name,email,created_at FROM extranet_messages " +
          where +
          " ORDER BY CASE WHEN source='handoff' AND status NOT IN('replied','archived') THEN 0 ELSE 1 END,created_at DESC LIMIT 20 OFFSET ?",
        ...args,
        (page - 1) * 20,
      );
    await log("list_messages", "message", null, null, {
      count: items.length,
    }).run();
    return respond({
      messages: items.map((x) => ({ ...x, email: maskEmail(x.email) })),
      total: total.n,
      page,
      pageSize: 20,
    });
  }
  const messageMatch = path.match(
    /^\/v1\/extranet\/messages\/([^/]+)(?:\/(.*))?$/,
  );
  if (messageMatch) {
    const id = decodeURIComponent(messageMatch[1]),
      operation = messageMatch[2],
      m = await first(
        "SELECT * FROM extranet_messages WHERE id=? AND expires_at>?",
        id,
        new Date(nowMs).toISOString(),
      );
    if (!m) fail(404, "Mesaj bulunamadı.");
    if (method === "GET" && !operation) {
      await log("view_message", "message", id, null, null).run();
      return respond({
        ...m,
        body: pii(m.body),
        subject: pii(m.subject),
        email: maskEmail(m.email),
        phone: maskPhone(m.phone),
        notes: (
          await rows(
            "SELECT body,actor_id,created_at FROM extranet_message_notes WHERE message_id=? ORDER BY created_at",
            id,
          )
        ).map((r) => ({ ...r, body: pii(r.body) })),
        replies: (
          await rows(
            "SELECT subject,body,status,created_at FROM extranet_replies WHERE message_id=? ORDER BY created_at",
            id,
          )
        ).map((r) => ({ ...r, body: pii(r.body), subject: pii(r.subject) })),
      });
    }
    if (method === "POST") {
      const b = await readBody(request, 16384);
      if (operation === "status") {
        if (!["new", "read", "replied", "archived"].includes(b.status))
          fail(400, "Geçersiz durum.");
        await env.DB.batch([
          stmt(
            "UPDATE extranet_messages SET status=? WHERE id=?",
            b.status,
            id,
          ),
          log(
            "message_status",
            "message",
            id,
            { status: m.status },
            { status: b.status },
          ),
        ]);
        return respond({ updated: true });
      }
      if (operation === "note") {
        if (
          typeof b.body !== "string" ||
          !b.body.trim() ||
          b.body.length > 2000
        )
          fail(400, "Not 1–2000 karakter olmalı.");
        const safe = redactCards(b.body);
        await env.DB.batch([
          stmt(
            "INSERT INTO extranet_message_notes(id,message_id,actor_id,body,created_at) VALUES(?,?,?,?,?)",
            token(),
            id,
            actor.memberId,
            safe,
            now,
          ),
          log("message_note", "message", id, null, { noteAdded: true }),
        ]);
        return respond({ added: true });
      }
      if (operation === "reply-preview") {
        if (!m.email || !/^\S+@\S+\.\S+$/.test(m.email))
          fail(400, "Bu kayıtta yanıtlanabilir e-posta yok.");
        const template = REPLY_TEMPLATES[b.lang] || REPLY_TEMPLATES.tr;
        const subject = redactCards(b.subject || template.subject).slice(
            0,
            200,
          ),
          text = redactCards(b.body || template.body).trim();
        if (!text || text.length > 12000)
          fail(400, "Yanıt 1–12000 karakter olmalı.");
        return preview(
          "reply",
          { messageId: id, to: m.email, subject, body: text },
          { to: maskEmail(m.email), subject, body: text },
        );
      }
    }
  }
  const confirmation = path.match(
    /^\/v1\/extranet\/actions\/([^/]+)\/confirm$/,
  );
  if (method === "POST" && confirmation) {
    const b = await readBody(request, 1024);
    if (b.confirm !== true) fail(400, "İkinci onay gerekli.");
    const draft = await first(
      "SELECT * FROM extranet_actions WHERE id=? AND actor_id=? AND expires_at>? AND used=0",
      confirmation[1],
      actor.memberId,
      now,
    );
    if (!draft) fail(409, "Önizleme süresi doldu veya kullanıldı.");
    if (
      (draft.kind === "delete" && actor.role !== "owner") ||
      (["tier", "tier-mail"].includes(draft.kind) &&
        !managers.includes(actor.role))
    )
      fail(403, "İşlem yetkisi yok.");
    const payload = parse(draft.payload_json);
    const claim = await stmt(
      "UPDATE extranet_actions SET used=1 WHERE id=? AND used=0 RETURNING id",
      draft.id,
    ).first();
    if (!claim) fail(409, "Onay daha önce kullanıldı.");
    if (draft.kind === "tier") {
      const batch = [],
        skipped = [];
      for (const id of payload.ids) {
        const m = await member(id);
        if (ownerEmail(env, m.email)) {
          skipped.push(id);
          continue;
        }
        batch.push(...(await levelChange(m, payload)));
      }
      if (batch.length) await env.DB.batch(batch);
      return respond({
        updated: payload.ids.length - skipped.length,
        skipped: skipped.length,
      });
    }
    if (draft.kind === "delete") {
      const m = await member(payload.id);
      protect(m);
      const id = m.id;
      const statements = [
        log("kvkk_delete", "member", id, null, { reason: payload.reason }),
      ];
      // Only explicit, approved inbox records are touched, never normal chat history.
      statements.push(
        stmt(
          "DELETE FROM extranet_messages WHERE member_id=? OR email=?",
          id,
          m.email,
        ),
        stmt("DELETE FROM extranet_replies WHERE recipient=?", m.email),
        stmt("UPDATE extranet_booking_meta SET guest_email=NULL,guest_phone=NULL,guest_name=NULL,guest_hotel=NULL,guest_room=NULL,member_id=NULL WHERE member_id=? OR guest_email=? OR (guest_phone IS NOT NULL AND guest_phone=?)",id,m.email,m.phone||null),
        stmt("DELETE FROM assistant_rate_limits WHERE key=?", "member:" + id),
      );
      for (const table of [
        "mimo_profile",
        "extranet_sessions",
        "extranet_users",
        "member_tier_overrides",
        "member_tier_history",
        "member_activity",
        "member_controls",
        "member_requests",
        "coupons",
        "sessions",
        "passkeys",
        "passkey_challenges",
        "member_identities",
      ])
        statements.push(
          stmt("DELETE FROM " + table + " WHERE member_id=?", id),
        );
      statements.push(
        stmt("UPDATE members SET referred_by=NULL WHERE referred_by=?", id),
        stmt("DELETE FROM login_codes WHERE email=?", m.email),
        stmt("DELETE FROM newsletter_subscribers WHERE email=?", m.email),
        stmt(
          "DELETE FROM extranet_actions WHERE json_extract(payload_json,'$.id')=? OR json_extract(payload_json,'$.to')=? OR EXISTS(SELECT 1 FROM json_each(extranet_actions.payload_json,'$.ids') WHERE value=?)",
          id,
          m.email,
          id,
        ),
        stmt("DELETE FROM members WHERE id=?", id),
      );
      await env.DB.batch(statements);
      return respond({ deleted: true });
    }
    if (["reply", "tier-mail"].includes(draft.kind)) {
      if (draft.kind === "tier-mail") protect(await member(payload.id));
      if (!env.RESEND_API_KEY || !(env.REQUEST_FROM_EMAIL || env.MAIL_FROM))
        fail(503, "E-posta servisi yapılandırılmamış.");
      const id = draft.id;
      await env.DB.batch([
        stmt(
          "INSERT INTO extranet_replies(id,message_id,actor_id,recipient,subject,body,status,created_at) VALUES(?,?,?,?,?,?,'sending',?)",
          id,
          payload.messageId || null,
          actor.memberId,
          payload.to,
          payload.subject,
          payload.body,
          now,
        ),
        log(
          "send_email_attempt",
          payload.messageId ? "message" : "member",
          payload.messageId || payload.id,
          null,
          { replyId: id },
        ),
      ]);
      let success = false;
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          signal: AbortSignal.timeout(8000),
          headers: {
            Authorization: "Bearer " + env.RESEND_API_KEY,
            "Content-Type": "application/json",
            "Idempotency-Key": id,
          },
          body: JSON.stringify({
            from: env.REQUEST_FROM_EMAIL || env.MAIL_FROM,
            to: [payload.to],
            subject: payload.subject,
            text: payload.body,
          }),
        });
        success = res.ok;
      } catch {}
      const statements = [
        stmt(
          "UPDATE extranet_replies SET status=? WHERE id=?",
          success ? "sent" : "failed",
          id,
        ),
        log(
          success ? "send_email" : "email_failed",
          payload.messageId ? "message" : "member",
          payload.messageId || payload.id,
          null,
          { replyId: id },
        ),
      ];
      if (success && payload.messageId)
        statements.push(
          stmt(
            "UPDATE extranet_messages SET status='replied' WHERE id=?",
            payload.messageId,
          ),
        );
      await env.DB.batch(statements);
      if (!success) fail(502, "E-posta gönderilemedi; durum kaydedildi.");
      return respond({ sent: true });
    }
    fail(400, "Geçersiz işlem.");
  }
  fail(404, "Uç nokta bulunamadı.");
}
