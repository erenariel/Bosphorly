-- Dedicated Bosphorly membership data; never shared with another project.
CREATE TABLE members (
 id TEXT PRIMARY KEY, identity_hash TEXT NOT NULL UNIQUE,
 encrypted_profile TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','deleted')),
 marketing_email INTEGER NOT NULL DEFAULT 0 CHECK(marketing_email IN (0,1)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE member_consents (
 id TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES members(id),
 purpose TEXT NOT NULL CHECK(purpose IN ('terms','privacy_notice','marketing_email')),
 document_version TEXT NOT NULL, granted INTEGER NOT NULL CHECK(granted IN (0,1)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE campaigns (
 id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind='member_mobile_percent'),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','suspended')),
 discount_bps INTEGER NOT NULL CHECK(discount_bps BETWEEN 0 AND 10000),
 currency TEXT, maximum_discount_minor INTEGER CHECK(maximum_discount_minor>=0),
 starts_at TEXT, ends_at TEXT, terms_reference TEXT, approved_by TEXT,
 CHECK(status!='approved' OR (currency IS NOT NULL AND maximum_discount_minor IS NOT NULL AND starts_at IS NOT NULL AND ends_at IS NOT NULL AND ends_at>starts_at AND terms_reference IS NOT NULL AND approved_by IS NOT NULL))
);
INSERT INTO campaigns(id,kind,status,discount_bps) VALUES('member-mobile-10','member_mobile_percent','draft',1000);
-- No reward, redemption, free tour, discount or payment is issued by this migration.
