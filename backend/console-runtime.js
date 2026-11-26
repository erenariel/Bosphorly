export async function consoleSettings(env) {
  if (!env?.DB) return {};
  try {
    const row = await env.DB.prepare(
      "SELECT value_json FROM extranet_settings WHERE key='console'",
    )
      .bind()
      .first();
    return typeof row?.value_json === "string"
      ? JSON.parse(row.value_json)
      : {};
  } catch (e) {
    if (
      /no such table.*extranet_settings/.test(e.message) ||
      /unsupported|unexpected|not implemented/i.test(e.message)
    )
      return {};
    throw e;
  }
}
export function deploymentCaps(env) {
  return (
    env.CONSOLE_DEPLOYMENT_CAPS || {
      assistant: Number(env.ASSISTANT_DAILY_LIMIT) || 1000,
      tts: Number.isFinite(Number(env.TTS_MONTHLY_CHAR_CAP))
        ? Number(env.TTS_MONTHLY_CHAR_CAP)
        : 800000,
    }
  );
}
export async function withConsoleRuntime(env) {
  const settings = await consoleSettings(env),
    caps = deploymentCaps(env);
  const effective = {
    ...env,
    CONSOLE_DEPLOYMENT_CAPS: caps,
    ASSISTANT_DAILY_LIMIT: String(
      Math.min(caps.assistant, settings.assistantDailyLimit ?? caps.assistant),
    ),
    TTS_MONTHLY_CHAR_CAP: String(
      Math.min(caps.tts, settings.ttsMonthlyChars ?? caps.tts),
    ),
  };
  if (env.AI?.run)
    effective.AI = {
      run: async (...args) => {
        const result = await env.AI.run(...args);
        try {
          if (env.DB) {
            const usage = result?.usage,
              estimated = !(
                Number.isFinite(usage?.prompt_tokens) &&
                Number.isFinite(usage?.completion_tokens)
              );
            const input = estimated
                ? Math.ceil(JSON.stringify(args[1]?.messages || []).length / 4)
                : usage.prompt_tokens,
              output = estimated
                ? Math.ceil(String(result?.response || "").length / 4)
                : usage.completion_tokens;
            await env.DB.prepare(
              "INSERT INTO extranet_usage_daily(day,ai_calls,input_tokens,output_tokens,estimated_calls) VALUES(?,1,?,?,?) ON CONFLICT(day) DO UPDATE SET ai_calls=ai_calls+1,input_tokens=input_tokens+excluded.input_tokens,output_tokens=output_tokens+excluded.output_tokens,estimated_calls=estimated_calls+excluded.estimated_calls",
            )
              .bind(
                new Date().toISOString().slice(0, 10),
                input,
                output,
                Number(estimated),
              )
              .run();
          }
        } catch {}
        return result;
      },
    };
  return effective;
}

export async function recordTtsUsage(env, chars, now) {
  try {
    if (env.DB)
      await env.DB.prepare(
        "INSERT INTO extranet_usage_daily(day,tts_chars) VALUES(?,?) ON CONFLICT(day) DO UPDATE SET tts_chars=tts_chars+excluded.tts_chars",
      )
        .bind(new Date(now).toISOString().slice(0, 10), chars)
        .run();
  } catch {}
}
