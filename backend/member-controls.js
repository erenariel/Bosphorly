export class MemberSuspendedError extends Error {}
export async function memberControls(env, id) {
  try {
    return (
      (await env.DB.prepare("SELECT * FROM member_controls WHERE member_id=?")
        .bind(id)
        .first()) || {}
    );
  } catch (e) {
    if (/no such table.*member_controls/i.test(String(e.message))) return {};
    throw e;
  }
}
export async function assertMemberActive(env, m) {
  if (!m) return;
  const owner =
    String(env.ADMIN_OWNER_EMAIL || "")
      .trim()
      .toLowerCase() === String(m.email || "").toLowerCase();
  if (!owner && (await memberControls(env, m.id || m.member_id)).suspended) {
    throw new MemberSuspendedError("Hesap askıya alındı.");
  }
}
export async function recordMemberLogin(env, m) {
  await assertMemberActive(env, m);
  try {
    await env.DB.prepare(
      "INSERT INTO member_activity(member_id,last_login) VALUES(?,?) ON CONFLICT(member_id) DO UPDATE SET last_login=excluded.last_login",
    )
      .bind(m.id, new Date().toISOString())
      .run();
  } catch (e) {
    if (!/no such table.*member_activity/i.test(String(e.message))) throw e;
  }
}
