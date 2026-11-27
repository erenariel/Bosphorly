import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
export function supportDb(fallback) {
  const raw = new DatabaseSync(":memory:");
  const dir = new URL("../backend/migrations/", import.meta.url);
  for (const f of readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort())
    raw.exec(readFileSync(new URL(f, dir), "utf8"));
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async () => raw.prepare(sql).get(...args) || null,
    all: async () => ({ results: raw.prepare(sql).all(...args) }),
    run: async () => ({
      meta: { changes: Number(raw.prepare(sql).run(...args).changes) },
    }),
    _run: () => raw.prepare(sql).run(...args),
  });
  return {
    raw,
    prepare: (sql) =>
      fallback && !/extranet_messages|extranet_audit/.test(sql)
        ? fallback.prepare(sql)
        : stmt(sql),
    batch: async (list) => {
      raw.exec("BEGIN");
      try {
        const results = list.map((s) => s._run());
        raw.exec("COMMIT");
        return results;
      } catch (e) {
        raw.exec("ROLLBACK");
        throw e;
      }
    },
  };
}
