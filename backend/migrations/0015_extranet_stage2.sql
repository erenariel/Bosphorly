-- Manual membership levels supplement, never modify, completed-tour history.
CREATE TABLE member_tier_overrides (
  member_id TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK(tier IN ('silver','gold','platinum')),
  reason TEXT NOT NULL CHECK(length(reason) BETWEEN 3 AND 500),
  updated_by TEXT REFERENCES members(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL
);
ALTER TABLE member_tier_overrides ADD COLUMN expires_at TEXT;
ALTER TABLE member_tier_overrides ADD COLUMN previous_tier TEXT;
CREATE TABLE member_controls (
 member_id TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
 suspended INTEGER NOT NULL DEFAULT 0 CHECK(suspended IN(0,1)),
 automatic_disabled INTEGER NOT NULL DEFAULT 0 CHECK(automatic_disabled IN(0,1)),
 frozen_tier TEXT CHECK(frozen_tier IN('silver','gold','platinum')),
 mimo_daily_limit INTEGER CHECK(mimo_daily_limit BETWEEN 0 AND 10000)
);
CREATE TABLE member_activity(member_id TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,last_login TEXT NOT NULL);
CREATE TABLE member_tier_history(id TEXT PRIMARY KEY,member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,actor_id TEXT NOT NULL,old_json TEXT,new_json TEXT NOT NULL,reason TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE INDEX member_tier_history_member ON member_tier_history(member_id,created_at);
CREATE TABLE extranet_messages (
 id TEXT PRIMARY KEY,source TEXT NOT NULL CHECK(source IN('form','handoff','complaint','blocked')),
 reference TEXT UNIQUE,member_id TEXT REFERENCES members(id) ON DELETE SET NULL,
 name TEXT,email TEXT,phone TEXT,subject TEXT NOT NULL,body TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'new' CHECK(status IN('new','read','replied','archived')),
 created_at TEXT NOT NULL,expires_at TEXT NOT NULL
);
CREATE INDEX extranet_messages_inbox ON extranet_messages(status,created_at);
CREATE TABLE extranet_message_notes(id TEXT PRIMARY KEY,message_id TEXT NOT NULL REFERENCES extranet_messages(id) ON DELETE CASCADE,actor_id TEXT NOT NULL,body TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE extranet_actions (
 id TEXT PRIMARY KEY,actor_id TEXT NOT NULL,kind TEXT NOT NULL,payload_json TEXT NOT NULL,
 expires_at TEXT NOT NULL,used INTEGER NOT NULL DEFAULT 0 CHECK(used IN(0,1)),created_at TEXT NOT NULL
);
CREATE TABLE extranet_replies(id TEXT PRIMARY KEY,message_id TEXT REFERENCES extranet_messages(id) ON DELETE CASCADE,actor_id TEXT NOT NULL,recipient TEXT NOT NULL,subject TEXT NOT NULL,body TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN('sending','sent','failed')),created_at TEXT NOT NULL);
