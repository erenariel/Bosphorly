-- Temporary, single-use pending metadata for OAuth registration (pre-filled contact/preferences).
-- Prevents PII (phone, hotel, country, interests) from leaking into OAuth URLs and browser history.
CREATE TABLE IF NOT EXISTS oauth_pending (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS oauth_pending_expires ON oauth_pending(expires_at);
