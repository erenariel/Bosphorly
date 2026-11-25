-- Extranet Stage 1: roles & users, idle-timeout HttpOnly sessions, immutable audit log,
-- operational booking metadata (workflow status, manual payment record, provider assignment),
-- and internal extranet-only reservation notes. No card details are ever stored.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS extranet_users (
  member_id TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('owner', 'admin', 'staff')),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
  created_by TEXT REFERENCES members(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_extranet_users_role ON extranet_users(role, active);

CREATE TABLE IF NOT EXISTS extranet_sessions (
  token_hash TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  ip_address TEXT NOT NULL DEFAULT 'unknown',
  user_agent TEXT,
  created_at INTEGER NOT NULL,
  last_active_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_extranet_sessions_member ON extranet_sessions(member_id);
CREATE INDEX IF NOT EXISTS idx_extranet_sessions_expires ON extranet_sessions(expires_at);

CREATE TABLE IF NOT EXISTS extranet_audit (
  id TEXT PRIMARY KEY,
  actor_member_id TEXT NOT NULL,
  actor_role TEXT NOT NULL CHECK(actor_role IN ('owner', 'admin', 'staff', 'unauthorized')),
  action TEXT NOT NULL CHECK(length(action) <= 80),
  target_type TEXT NOT NULL CHECK(length(target_type) <= 60),
  target_id TEXT CHECK(target_id IS NULL OR length(target_id) <= 120),
  old_value TEXT,
  new_value TEXT,
  ip_address TEXT NOT NULL CHECK(length(ip_address) <= 80),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_extranet_audit_created ON extranet_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_extranet_audit_actor ON extranet_audit(actor_member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_extranet_audit_target ON extranet_audit(target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_extranet_audit_action ON extranet_audit(action, created_at DESC);

CREATE TABLE IF NOT EXISTS extranet_booking_meta (
  record_type TEXT NOT NULL CHECK(record_type IN ('booking', 'member_request')),
  record_id TEXT NOT NULL CHECK(length(record_id) <= 80),
  workflow_status TEXT NOT NULL DEFAULT 'new' CHECK(workflow_status IN ('new', 'in_progress', 'confirmed', 'completed', 'cancelled')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK(payment_status IN ('pending', 'paid', 'refunded')),
  assigned_provider_id TEXT REFERENCES providers(id) ON DELETE SET NULL,
  member_id TEXT REFERENCES members(id) ON DELETE SET NULL,
  guest_name TEXT CHECK(guest_name IS NULL OR length(guest_name) <= 120),
  guest_email TEXT CHECK(guest_email IS NULL OR length(guest_email) <= 254),
  guest_phone TEXT CHECK(guest_phone IS NULL OR length(guest_phone) <= 40),
  guest_hotel TEXT CHECK(guest_hotel IS NULL OR length(guest_hotel) <= 140),
  guest_room TEXT CHECK(guest_room IS NULL OR length(guest_room) <= 24),
  source TEXT CHECK(source IS NULL OR length(source) <= 40),
  lang TEXT CHECK(lang IS NULL OR length(lang) <= 8),
  coupon_id TEXT REFERENCES coupons(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (record_type, record_id)
);
CREATE INDEX IF NOT EXISTS idx_extranet_booking_meta_status ON extranet_booking_meta(workflow_status);
CREATE INDEX IF NOT EXISTS idx_extranet_booking_meta_provider ON extranet_booking_meta(assigned_provider_id);

CREATE TABLE IF NOT EXISTS extranet_booking_notes (
  id TEXT PRIMARY KEY,
  record_type TEXT NOT NULL CHECK(record_type IN ('booking', 'member_request')),
  record_id TEXT NOT NULL CHECK(length(record_id) <= 80),
  author_member_id TEXT NOT NULL,
  author_role TEXT NOT NULL CHECK(author_role IN ('owner', 'admin', 'staff')),
  note TEXT NOT NULL CHECK(length(note) BETWEEN 1 AND 2000),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_extranet_booking_notes_rec ON extranet_booking_notes(record_type, record_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_booking_events_booking ON booking_events(booking_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_booking_events_evidence ON booking_events(evidence_reference);
