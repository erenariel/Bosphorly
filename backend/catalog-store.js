export const CATALOG_LANGS = [
  "tr",
  "en",
  "ru",
  "uk",
  "de",
  "fr",
  "nl",
  "ar",
  "he",
  "az",
  "fa",
  "es",
  "it",
  "pt",
  "hr",
  "hu",
  "bs",
  "zh",
  "ja",
  "ko",
  "hi",
  "bn",
  "id",
];
export async function managedCatalog(env, includeInactive = false) {
  if (!env?.DB) return null;
  const statement = env.DB.prepare(
    "SELECT id,record_json,active,revision FROM extranet_catalog ORDER BY id",
  ).bind();
  if (typeof statement.all !== "function") return null;
  let rows;
  try {
    rows = (await statement.all()).results || [];
  } catch (e) {
    if (/no such table.*extranet_catalog/i.test(e.message)) return null;
    throw e;
  }
  return rows
    .filter((r) => includeInactive || r.active)
    .map((r) => ({
      ...JSON.parse(r.record_json),
      active: !!r.active,
      revision: r.revision,
    }));
}
export function missingTranslations(record) {
  return CATALOG_LANGS.filter(
    (lang) =>
      !(lang === "en" ? record.title : record["title_" + lang]) ||
      !(lang === "en"
        ? record.details?.summary
        : record.details?.[lang]?.summary),
  );
}
export async function liveCatalogContext(env, query, fallback, lang = "en") {
  const records = await managedCatalog(env);
  if (records === null) return { chunks: fallback, managed: false };
  const words =
    String(query)
      .toLocaleLowerCase()
      .match(/[\p{L}\p{N}]+/gu) || [];
  const scored = records
    .map((r) => {
      const hay = (
        r.id +
        " " +
        r.title +
        " " +
        Object.entries(r)
          .filter(([k]) => k.startsWith("title_"))
          .map(([, v]) => v)
          .join(" ")
      ).toLocaleLowerCase();
      return {
        r,
        score: words.reduce((n, w) => n + (hay.includes(w) ? 1 : 0), 0),
      };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);
  const chunks = scored.map(({ r }) => ({
    id: "tour-" + r.id,
    title: r.title,
    url:
      "https://bosphorly.com/booking.html?service=" + encodeURIComponent(r.id),
    text:
      (Number.isFinite(r.price)
        ? r.price + " " + r.currency + "; "
        : "Quote required; ") +
      (r.options || [])
        .flatMap((o) => o.durations || [])
        .filter((o) => Number.isFinite(o.price))
        .map((o) => o.price + " " + r.currency)
        .join("; ") +
      " " +
      JSON.stringify(
        {
          id: r.id,
          title: lang === "en" ? r.title : r["title_" + lang] || r.title,
          price: r.price,
          currency: r.currency,
          basis: r.basis,
          price_type: r.price_type,
          details: {
            ...r.details,
            ...r.details[lang],
            included: (
              r.details[lang]?.included ||
              r.details.included ||
              []
            ).slice(0, 10),
            summary: r.details[lang]?.summary || r.details.summary,
          },
          options: r.options?.map((o) => ({
            name: o["name_" + lang] || o.name,
            price: o.price,
            currency: r.currency,
            durations: o.durations,
          })),
        },
        (key, value) => (CATALOG_LANGS.includes(key) ? undefined : value),
      ).slice(0, 2000),
    keywords: r.id,
  }));
  return {
    chunks: [...chunks, ...fallback.filter((d) => !/^tour-/.test(d.id))].slice(
      0,
      6,
    ),
    managed: true,
  };
}
