-- Member third-party identities (Telegram, etc.) and Passkeys (WebAuthn credentials).
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS member_identities (
  provider TEXT NOT NULL,
  subject TEXT NOT NULL,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (provider, subject)
);
CREATE INDEX IF NOT EXISTS member_identities_member ON member_identities(member_id);

CREATE TABLE IF NOT EXISTS passkeys (
  credential_id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  transports TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT
);
CREATE INDEX IF NOT EXISTS passkeys_member ON passkeys(member_id);

CREATE TABLE IF NOT EXISTS passkey_challenges (
  id TEXT PRIMARY KEY,
  challenge TEXT NOT NULL UNIQUE,
  member_id TEXT REFERENCES members(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK(purpose IN ('registration', 'authentication')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS passkey_challenges_challenge ON passkey_challenges(challenge);
