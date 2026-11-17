-- Membership, campaigns and coupons. Discounts are funded from Bosphorly's commission
-- (funded_by='bosphorly'); a coupon is held by one request and redeemed only when that
-- request is fulfilled, so rewards follow completed tours, not sign-ups.
PRAGMA foreign_keys = ON;

CREATE TABLE members (
 id TEXT PRIMARY KEY,
 email TEXT NOT NULL UNIQUE CHECK(email = lower(email) AND length(email) BETWEEN 5 AND 254),
 name TEXT CHECK(name IS NULL OR length(name) <= 100),
 lang TEXT NOT NULL DEFAULT 'en' CHECK(length(lang) = 2),
 referral_code TEXT NOT NULL UNIQUE,
 referred_by TEXT REFERENCES members(id),
 hotel_id TEXT REFERENCES hotels(id),
 marketing_consent INTEGER NOT NULL DEFAULT 0 CHECK(marketing_consent IN (0,1)),
 marketing_consent_at TEXT,
 stamps INTEGER NOT NULL DEFAULT 0 CHECK(stamps >= 0),
 referral_rewarded INTEGER NOT NULL DEFAULT 0 CHECK(referral_rewarded IN (0,1)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(referred_by IS NULL OR referred_by != id)
);

-- One-time sign-in codes: only a keyed hash is stored; at most 5 tries, 10 minutes.
CREATE TABLE login_codes (
 id TEXT PRIMARY KEY,
 email TEXT NOT NULL,
 code_hash TEXT NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
 used INTEGER NOT NULL DEFAULT 0 CHECK(used IN (0,1)),
 expires_at TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX login_codes_email ON login_codes(email, created_at);

CREATE TABLE sessions (
 token_hash TEXT PRIMARY KEY,
 member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
 expires_at TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE campaigns (
 id TEXT PRIMARY KEY,
 kind TEXT NOT NULL CHECK(kind IN ('welcome','referral','hotel','second_tour','loyalty')),
 percent_bps INTEGER NOT NULL CHECK(percent_bps BETWEEN 1 AND 5000),
 valid_days INTEGER NOT NULL CHECK(valid_days BETWEEN 1 AND 730),
 hotel_id TEXT REFERENCES hotels(id),
 funded_by TEXT NOT NULL DEFAULT 'bosphorly' CHECK(funded_by IN ('bosphorly','provider','shared')),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 starts_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 ends_at TEXT,
 CHECK(kind != 'hotel' OR hotel_id IS NOT NULL)
);

CREATE TABLE coupons (
 id TEXT PRIMARY KEY,
 code TEXT NOT NULL UNIQUE,
 member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
 campaign_id TEXT NOT NULL REFERENCES campaigns(id),
 percent_bps INTEGER NOT NULL CHECK(percent_bps BETWEEN 1 AND 5000),
 status TEXT NOT NULL DEFAULT 'issued' CHECK(status IN ('issued','held','redeemed','void')),
 held_ref TEXT,
 issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 expires_at TEXT NOT NULL,
 redeemed_at TEXT,
 -- Set for one-per-member campaigns (welcome, hotel, second tour) so a duplicate cannot be issued.
 once_key TEXT UNIQUE,
 CHECK(status != 'held' OR held_ref IS NOT NULL),
 CHECK(status != 'redeemed' OR redeemed_at IS NOT NULL)
);
CREATE INDEX coupons_member ON coupons(member_id, status);

-- Requests a signed-in member sent on WhatsApp: the reference, not the message or contact details.
CREATE TABLE member_requests (
 ref TEXT PRIMARY KEY CHECK(length(ref) BETWEEN 6 AND 40),
 member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
 service_id TEXT NOT NULL CHECK(length(service_id) <= 80),
 service_date TEXT NOT NULL,
 guests INTEGER NOT NULL CHECK(guests BETWEEN 1 AND 16),
 coupon_id TEXT REFERENCES coupons(id),
 state TEXT NOT NULL DEFAULT 'requested' CHECK(state IN ('requested','fulfilled','cancelled')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 closed_at TEXT
);

-- Default programme. Percentages are proposals; change them with the admin endpoint.
INSERT INTO campaigns (id, kind, percent_bps, valid_days) VALUES
 ('welcome-2026', 'welcome', 500, 90),
 ('referral-2026', 'referral', 500, 120),
 ('second-tour-2026', 'second_tour', 700, 120),
 ('loyalty-2026', 'loyalty', 1000, 180);
