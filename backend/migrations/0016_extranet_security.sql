-- Preserve all role grants and audit rows while expanding SQLite CHECK constraints.
CREATE TABLE extranet_users_next (
  member_id TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('owner', 'admin', 'staff', 'partner')),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
  created_by TEXT REFERENCES members(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO extranet_users_next SELECT * FROM extranet_users;
DROP TABLE extranet_users;
ALTER TABLE extranet_users_next RENAME TO extranet_users;
CREATE INDEX IF NOT EXISTS idx_extranet_users_role ON extranet_users(role, active);

CREATE TABLE extranet_audit_next (
  id TEXT PRIMARY KEY,
  actor_member_id TEXT NOT NULL,
  actor_role TEXT NOT NULL CHECK(actor_role IN ('owner', 'admin', 'staff', 'partner', 'unauthorized')),
  action TEXT NOT NULL CHECK(length(action) <= 80),
  target_type TEXT NOT NULL CHECK(length(target_type) <= 60),
  target_id TEXT CHECK(target_id IS NULL OR length(target_id) <= 120),
  old_value TEXT,
  new_value TEXT,
  ip_address TEXT NOT NULL CHECK(length(ip_address) <= 80),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO extranet_audit_next SELECT * FROM extranet_audit;
DROP TABLE extranet_audit;
ALTER TABLE extranet_audit_next RENAME TO extranet_audit;
CREATE INDEX IF NOT EXISTS idx_extranet_audit_created ON extranet_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_extranet_audit_actor ON extranet_audit(actor_member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_extranet_audit_target ON extranet_audit(target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_extranet_audit_action ON extranet_audit(action, created_at DESC);


CREATE TRIGGER extranet_audit_no_update BEFORE UPDATE ON extranet_audit BEGIN SELECT RAISE(ABORT,'audit is append-only'); END;
CREATE TRIGGER extranet_audit_no_delete BEFORE DELETE ON extranet_audit BEGIN SELECT RAISE(ABORT,'audit is append-only'); END;
