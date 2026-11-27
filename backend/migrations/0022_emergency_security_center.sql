-- Additive migration for Bosphorly Emergency & Security Center.
-- Existing tables, triggers, indexes, and records are untouched.

CREATE TABLE IF NOT EXISTS emergency_channel_states (
  channel TEXT PRIMARY KEY CHECK(channel IN ('whatsapp', 'telegram', 'instagram', 'mimo', 'banner')),
  enabled INTEGER NOT NULL CHECK(enabled IN (0, 1)),
  banner_text TEXT NOT NULL DEFAULT '' CHECK(length(banner_text) <= 500),
  banner_preset TEXT NOT NULL DEFAULT '' CHECK(length(banner_preset) <= 40),
  last_closed_at_ms INTEGER NOT NULL DEFAULT 0,
  last_reopened_at_ms INTEGER NOT NULL DEFAULT 0,
  updated_by TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS emergency_closed_windows (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL CHECK(channel IN ('whatsapp', 'telegram')),
  closed_at_ms INTEGER NOT NULL,
  reopened_at_ms INTEGER,
  operation_id TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_emergency_closed_win_ch ON emergency_closed_windows(channel, closed_at_ms DESC);

CREATE TABLE IF NOT EXISTS emergency_dropped_messages (
  channel TEXT NOT NULL CHECK(channel IN ('whatsapp', 'telegram')),
  message_key TEXT NOT NULL,
  dropped_at_ms INTEGER NOT NULL,
  expires_at_ms INTEGER NOT NULL,
  PRIMARY KEY (channel, message_key)
);
CREATE INDEX IF NOT EXISTS idx_emergency_dropped_exp ON emergency_dropped_messages(expires_at_ms);

CREATE TABLE IF NOT EXISTS emergency_verifications (
  operation_id TEXT PRIMARY KEY,
  session_hash TEXT NOT NULL,
  actor_member_id TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  target_channel TEXT NOT NULL CHECK(target_channel IN ('whatsapp', 'telegram', 'instagram', 'mimo', 'all', 'banner')),
  action_type TEXT NOT NULL CHECK(action_type IN ('close', 'reopen', 'close_all', 'banner_enable', 'banner_disable', 'banner_update')),
  payload_json TEXT NOT NULL DEFAULT '{}',
  code_hmac TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts >= 0 AND attempts <= 10),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'consumed', 'expired', 'invalidated', 'failed')),
  source_request_id TEXT,
  created_at_ms INTEGER NOT NULL,
  expires_at_ms INTEGER NOT NULL,
  consumed_at_ms INTEGER
);
CREATE INDEX IF NOT EXISTS idx_emergency_verif_actor_created ON emergency_verifications(actor_member_id, created_at_ms DESC);
CREATE INDEX IF NOT EXISTS idx_emergency_verif_session_created ON emergency_verifications(session_hash, created_at_ms DESC);

CREATE TABLE IF NOT EXISTS emergency_consumed_ops (
  operation_id TEXT PRIMARY KEY REFERENCES emergency_verifications(operation_id),
  consumed_at_ms INTEGER NOT NULL
);

CREATE TRIGGER IF NOT EXISTS emergency_consumed_require_valid
BEFORE INSERT ON emergency_consumed_ops
WHEN (SELECT status FROM emergency_verifications WHERE operation_id = NEW.operation_id) != 'consumed'
BEGIN
  SELECT RAISE(ABORT, 'verification_not_consumable');
END;

CREATE TABLE IF NOT EXISTS emergency_telegram_requests (
  id TEXT PRIMARY KEY,
  target_channel TEXT NOT NULL CHECK(target_channel IN ('whatsapp', 'telegram', 'instagram', 'mimo', 'all')),
  telegram_chat_hash TEXT NOT NULL,
  telegram_user_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'expired', 'cancelled')),
  created_at_ms INTEGER NOT NULL,
  expires_at_ms INTEGER NOT NULL,
  completed_operation_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_emergency_tg_req_status ON emergency_telegram_requests(status, created_at_ms DESC);

CREATE TABLE IF NOT EXISTS emergency_audit_log (
  id TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actor_email TEXT NOT NULL,
  actor_member_id TEXT,
  actor_role TEXT NOT NULL,
  channel TEXT NOT NULL,
  previous_state TEXT,
  new_state TEXT,
  action_type TEXT NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('extranet', 'telegram_command', 'public_api', 'system')),
  outcome TEXT NOT NULL CHECK(outcome IN ('success', 'failed')),
  reason TEXT,
  ip_address TEXT
);
CREATE INDEX IF NOT EXISTS idx_emergency_audit_created ON emergency_audit_log(created_at_ms DESC);
CREATE INDEX IF NOT EXISTS idx_emergency_audit_outcome ON emergency_audit_log(outcome, created_at_ms DESC);

CREATE TRIGGER IF NOT EXISTS emergency_audit_no_update
BEFORE UPDATE ON emergency_audit_log
BEGIN
  SELECT RAISE(ABORT, 'emergency audit log is immutable');
END;

CREATE TRIGGER IF NOT EXISTS emergency_audit_no_delete
BEFORE DELETE ON emergency_audit_log
BEGIN
  SELECT RAISE(ABORT, 'emergency audit log is immutable');
END;

CREATE TABLE IF NOT EXISTS emergency_notification_queue (
  id TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  delivered_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'exhausted')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_retry_at_ms INTEGER NOT NULL,
  last_error TEXT,
  created_at_ms INTEGER NOT NULL,
  sent_at_ms INTEGER
);
CREATE INDEX IF NOT EXISTS idx_emergency_notif_retry ON emergency_notification_queue(status, next_retry_at_ms ASC);
