import {
  managedCatalog,
  missingTranslations,
  CATALOG_LANGS,
} from "./catalog-store.js";
import { consoleSettings, deploymentCaps } from "./console-runtime.js";
export async function publicCatalog(env) {
  const records = await managedCatalog(env);
  if (records === null)
    return new Response("Catalog unavailable", { status: 503 });
  const settings = await consoleSettings(env);
  return Response.json(
    {
      managed: true,
      records,
      esim: {
        url: settings.airaloUrl || "",
        comingSoon: settings.esimComingSoon !== false,
      },
      note: "Operator service information; final price and availability require team confirmation.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function catalogRoutes(request, env, url, nowMs, h) {
  const path = url.pathname;
  if (!/^\/v1\/extranet\/(catalog|settings|usage)(\/|$)/.test(path))
    return null;
  const roles =
    path.includes("/settings") && request.method !== "GET"
      ? ["owner"]
      : ["owner", "admin"];
  const actor = await h.auth(request, env, roles, nowMs),
    now = new Date(nowMs).toISOString().replace("T", " ").slice(0, 19),
    stmt = (sql, ...args) => env.DB.prepare(sql).bind(...args),
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
  if (path === "/v1/extranet/catalog" && request.method === "GET") {
    const records = await managedCatalog(env, true);
    await audit("list_catalog", "catalog", null, null, {
      count: records?.length || 0,
    }).run();
    return response({
      records: (records || []).map((r) => ({
        ...r,
        missingTranslations: missingTranslations(r),
      })),
      languages: CATALOG_LANGS,
    });
  }
  const match = path.match(/^\/v1\/extranet\/catalog\/([a-z0-9-]+)$/);
  if (match && request.method === "POST") {
    const b = await h.body(request, 100000),
      r = b.record;
    if (
      !r ||
      r.id !== match[1] ||
      r.id.length > 80 ||
      typeof r.title !== "string" ||
      !r.title.trim() ||
      r.title.length > 200 ||
      typeof r.operator !== "string" ||
      !r.operator.trim() ||
      r.operator.length > 120 ||
      !["EUR", "USD", "TRY", "GBP"].includes(r.currency) ||
      !(
        r.price === null ||
        (Number.isFinite(r.price) && r.price >= 0 && r.price <= 1000000)
      ) ||
      typeof b.active !== "boolean" ||
      !r.details ||
      Array.isArray(r.details) ||
      typeof r.details !== "object" ||
      !Number.isInteger(b.revision) ||
      b.revision < 0
    )
      h.fail(400, "Geçerli katalog kaydı, aktiflik ve sürüm gerekli.");
    const details = [
      r.details,
      ...CATALOG_LANGS.map((code) => r.details[code]).filter(
        (x) => x !== undefined,
      ),
    ];
    for (const d of details) {
      if (
        !d ||
        Array.isArray(d) ||
        typeof d !== "object" ||
        (d.duration !== undefined &&
          (typeof d.duration !== "string" || d.duration.length > 500)) ||
        (d.included !== undefined &&
          (!Array.isArray(d.included) ||
            d.included.length > 50 ||
            d.included.some((x) => typeof x !== "string" || x.length > 1000)))
      )
        h.fail(400, "Süre ve içerik alanları geçersiz.");
    }
    if (
      r.options !== undefined &&
      (!Array.isArray(r.options) ||
        r.options.some(
          (o) =>
            !o ||
            !Array.isArray(o.durations) ||
            o.durations.some(
              (d) =>
                !Number.isInteger(d.min) ||
                d.min < 1 ||
                d.min > 1440 ||
                !Number.isFinite(d.price) ||
                d.price < 0 ||
                d.price > 1000000,
            ),
        ))
    )
      h.fail(400, "Tur seçeneklerinin süre ve fiyatları geçersiz.");
    if (h.containsCard(JSON.stringify(r)))
      h.fail(400, "Katalogda kart verisi bulunamaz.");
    for (const lang of CATALOG_LANGS) {
      const title = lang === "en" ? r.title : r["title_" + lang],
        summary = lang === "en" ? r.details.summary : r.details[lang]?.summary;
      if (
        (title !== undefined &&
          (typeof title !== "string" || title.length > 200)) ||
        (summary !== undefined &&
          (typeof summary !== "string" || summary.length > 4000))
      )
        h.fail(400, "Çeviri alanı geçersiz.");
    }
    if (
      !Array.isArray(r.photos || []) ||
      (r.photos || []).length > 12 ||
      (r.photos || []).some(
        (x) =>
          typeof x !== "string" ||
          x.length > 2000 ||
          !/^(?:https:\/\/|\/assets\/)/.test(x),
      )
    )
      h.fail(400, "En fazla 12 HTTPS veya /assets/ fotoğraf adresi kullanın.");
    const old = await stmt(
      "SELECT * FROM extranet_catalog WHERE id=?",
      r.id,
    ).first();
    if ((old?.revision || 0) !== b.revision)
      h.fail(409, "Katalog değişmiş; yeniden yükleyin.");
    const record = { ...r };
    delete record.revision;
    delete record.active;
    delete record.missingTranslations;
    const revision = b.revision + 1;
    // Unique revision journal fences concurrent writers in the same atomic batch.
    await env.DB.batch([
      stmt(
        "INSERT INTO extranet_catalog_versions(id,revision,record_json,active) VALUES(?,?,?,?)",
        r.id,
        revision,
        JSON.stringify(record),
        Number(b.active),
      ),
      stmt(
        "INSERT INTO extranet_catalog(id,record_json,active,revision,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET record_json=excluded.record_json,active=excluded.active,revision=excluded.revision,updated_at=excluded.updated_at",
        r.id,
        JSON.stringify(record),
        Number(b.active),
        revision,
        now,
      ),
      audit(
        "save_catalog",
        "catalog",
        r.id,
        old
          ? {
              revision: old.revision,
              price: JSON.parse(old.record_json).price,
              active: !!old.active,
            }
          : null,
        {
          revision,
          price: record.price,
          currency: record.currency,
          active: b.active,
          immutableSnapshot: "extranet_catalog_versions",
        },
      ),
    ]);
    return response({
      saved: true,
      revision,
      missingTranslations: missingTranslations(record),
    });
  }
  if (path === "/v1/extranet/settings" && request.method === "GET")
    return response({
      settings: await consoleSettings(env),
      deploymentCaps: deploymentCaps(env),
      ownerOnlyChanges: true,
    });
  if (path === "/v1/extranet/settings" && request.method === "POST") {
    const b = await h.body(request),
      allowed = [
        "assistantDailyLimit",
        "ttsMonthlyChars",
        "monthlyBudgetUsd",
        "inputUsdPerMillion",
        "outputUsdPerMillion",
        "ttsUsdPerMillion",
        "airaloUrl",
        "esimComingSoon",
      ],
      caps = deploymentCaps(env);
    if (Object.keys(b).some((k) => !allowed.includes(k)))
      h.fail(400, "Desteklenmeyen ayar.");
    for (const [key, max] of [
      ["assistantDailyLimit", caps.assistant],
      ["ttsMonthlyChars", caps.tts],
    ])
      if (
        b[key] !== undefined &&
        (!Number.isInteger(b[key]) || b[key] < 1 || b[key] > max)
      )
        h.fail(400, "Operasyonel limit mevcut deployment tavanını aşamaz.");
    for (const key of [
      "monthlyBudgetUsd",
      "inputUsdPerMillion",
      "outputUsdPerMillion",
      "ttsUsdPerMillion",
    ])
      if (
        b[key] !== undefined &&
        (!Number.isFinite(b[key]) || b[key] < 0 || b[key] > 10000)
      )
        h.fail(400, "Geçerli maliyet varsayımı gerekli.");
    if (b.esimComingSoon !== undefined && typeof b.esimComingSoon !== "boolean")
      h.fail(400, "Geçerli eSIM etiketi gerekli.");
    if (
      b.airaloUrl !== undefined &&
      (typeof b.airaloUrl !== "string" || b.airaloUrl.length > 2000)
    )
      h.fail(400, "Geçerli Airalo adresi gerekli.");
    if (b.airaloUrl) {
      let u;
      try {
        u = new URL(b.airaloUrl);
      } catch {
        h.fail(400, "Geçersiz Airalo adresi.");
      }
      if (
        u.protocol !== "https:" ||
        u.username ||
        u.password ||
        !(
          u.hostname === "airalo.com" ||
          u.hostname.endsWith(".airalo.com") ||
          u.hostname === "airalo.pxf.io"
        )
      )
        h.fail(400, "HTTPS Airalo/affiliate adresi gerekli.");
    }
    const old = await consoleSettings(env),
      value = { ...old, ...b };
    await env.DB.batch([
      stmt(
        "INSERT INTO extranet_settings(key,value_json,updated_by,updated_at) VALUES('console',?,?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_by=excluded.updated_by,updated_at=excluded.updated_at",
        JSON.stringify(value),
        actor.memberId,
        now,
      ),
      audit("save_console_settings", "settings", "console", old, value),
    ]);
    return response({ saved: true, settings: value });
  }
  if (path === "/v1/extranet/usage" && request.method === "GET") {
    const today = now.slice(0, 10),
      month = now.slice(0, 7),
      settings = await consoleSettings(env),
      daily =
        (await stmt(
          "SELECT * FROM extranet_usage_daily WHERE day=?",
          today,
        ).first()) || {},
      monthly =
        (await stmt(
          "SELECT SUM(ai_calls) AS ai_calls,SUM(input_tokens) AS input_tokens,SUM(output_tokens) AS output_tokens,SUM(estimated_calls) AS estimated_calls,SUM(tts_chars) AS tts_chars FROM extranet_usage_daily WHERE day LIKE ?",
          month + "%",
        ).first()) || {},
      tts = await stmt(
        "SELECT chars FROM tts_usage WHERE month=?",
        month,
      ).first();
    monthly.tts_chars = Number(tts?.chars || 0);
    const priced = [
      "inputUsdPerMillion",
      "outputUsdPerMillion",
      "ttsUsdPerMillion",
    ].every((k) => Number.isFinite(settings[k]));
    const estimatedCostUsd = priced
        ? ((monthly.input_tokens || 0) * settings.inputUsdPerMillion +
            (monthly.output_tokens || 0) * settings.outputUsdPerMillion +
            monthly.tts_chars * settings.ttsUsdPerMillion) /
          1000000
        : null,
      budget = settings.monthlyBudgetUsd ?? 9;
    await audit("view_usage", "usage", month, null, null).run();
    return response({
      today,
      month,
      daily,
      monthly,
      estimatedCostUsd,
      budgetUsd: budget,
      warning:
        estimatedCostUsd === null
          ? "cost_rates_missing"
          : estimatedCostUsd >= budget * 0.8
            ? "budget_warning"
            : null,
      note: "Sayaçlar bu sürümden itibaren ölçülür. Token tahminleri ve girilen birim fiyatlar fatura değildir.",
    });
  }
  h.fail(404, "Uç nokta bulunamadı.");
}
