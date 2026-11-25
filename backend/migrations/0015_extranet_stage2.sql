-- Manual membership levels supplement, never modify, completed-tour history.
CREATE TABLE member_tier_overrides (
  member_id TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK(tier IN ('silver','gold','platinum')),
  reason TEXT NOT NULL CHECK(length(reason) BETWEEN 3 AND 500),
  updated_by TEXT NOT NULL REFERENCES members(id),
  updated_at TEXT NOT NULL
);
