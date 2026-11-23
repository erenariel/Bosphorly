-- Consented member familiarity note (structured JSON only; no raw chat)
-- and anonymous assistant counters (counts and short topic titles only).
CREATE TABLE IF NOT EXISTS mimo_profile (
  member_id TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  consent INTEGER NOT NULL DEFAULT 0 CHECK (consent IN (0, 1)),
  note_json TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS assistant_metrics (
  metric TEXT NOT NULL,
  bucket TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (metric, bucket)
);

CREATE TABLE IF NOT EXISTS assistant_gap_topics (
  topic TEXT NOT NULL,
  bucket TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (topic, bucket)
);
