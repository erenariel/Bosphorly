-- Rate-limit & daily cap counters for the AI assistant (no chat content stored).
CREATE TABLE IF NOT EXISTS assistant_rate_limits (
  key TEXT PRIMARY KEY,
  min_bucket INTEGER NOT NULL DEFAULT 0,
  min_count INTEGER NOT NULL DEFAULT 0,
  day_bucket TEXT NOT NULL DEFAULT '',
  day_count INTEGER NOT NULL DEFAULT 0
);

-- Ephemeral Telegram handoff state (only kept briefly to ask for guest email and include recent Q&A context on forward; cleared after forwarding).
CREATE TABLE IF NOT EXISTS telegram_handoff_state (
  chat_id TEXT PRIMARY KEY,
  pending_handoff INTEGER NOT NULL DEFAULT 0,
  lang TEXT NOT NULL DEFAULT 'en',
  context_json TEXT NOT NULL DEFAULT '[]',
  updated_at INTEGER NOT NULL DEFAULT 0
);
