export const MEMBER_TIERS = new Set(['silver', 'gold', 'platinum']);
export function automaticTier(count) {
  return Number(count || 0) >= 5 ? 'platinum' : Number(count || 0) >= 2 ? 'gold' : 'silver';
}
export async function membershipTier(env, memberId, count) {
  let manualTier = null;
  if (memberId && env?.DB) {
    try {
      const row = await env.DB.prepare('SELECT tier FROM member_tier_overrides WHERE member_id=?').bind(memberId).first();
      if (MEMBER_TIERS.has(row?.tier)) manualTier = row.tier;
    } catch (error) {
      // Before migration 0015, existing members retain automatic levels.
      if (!/no such table.*member_tier_overrides/i.test(String(error?.message))) throw error;
    }
  }
  const automatic = automaticTier(count);
  return { tier: manualTier || automatic, automaticTier: automatic, manualTier, tierSource: manualTier ? 'manual' : 'automatic' };
}
