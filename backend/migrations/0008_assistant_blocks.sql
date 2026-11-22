-- Hotfix: assistant_blocks was appended to 0007 after 0007 had already been applied in production,
-- so D1 never created it. This idempotent migration creates it on existing databases
-- (no-op on fresh databases where 0007 already created it).
-- Stores only a SHA-256 hash of session/IP/chat_id and an expiry timestamp (no message text).
CREATE TABLE IF NOT EXISTS assistant_blocks (
  actor_hash TEXT PRIMARY KEY,
  blocked_until INTEGER NOT NULL DEFAULT 0,
  strike_count INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL DEFAULT 0
);
