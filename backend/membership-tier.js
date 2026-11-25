import { memberControls } from "./member-controls.js";
export const MEMBER_TIERS = new Set(["silver", "gold", "platinum"]);
export function automaticTier(count) {
  return Number(count || 0) >= 5
    ? "platinum"
    : Number(count || 0) >= 2
      ? "gold"
      : "silver";
}
export async function membershipTier(env, id, count, now = Date.now()) {
  let row = null;
  if (id && env?.DB)
    try {
      row = await env.DB.prepare(
        "SELECT * FROM member_tier_overrides WHERE member_id=?",
      )
        .bind(id)
        .first();
    } catch (e) {
      if (!/no such table.*member_tier_overrides/i.test(String(e.message)))
        throw e;
    }
  const controls = id ? await memberControls(env, id) : {};
  const expired = row?.expires_at && Date.parse(row.expires_at) <= now;
  const manual = expired ? row.previous_tier : row?.tier;
  const frozen = controls.automatic_disabled ? controls.frozen_tier : null;
  const manualTier = MEMBER_TIERS.has(manual)
    ? manual
    : MEMBER_TIERS.has(frozen)
      ? frozen
      : null;
  return {
    tier: manualTier || automaticTier(count),
    automaticTier: automaticTier(count),
    manualTier: manualTier || null,
    tierSource: manualTier ? "manual" : "automatic",
    expiresAt: expired ? null : row?.expires_at || null,
  };
}
