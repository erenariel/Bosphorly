PRAGMA foreign_keys = ON;
CREATE TABLE providers (
 id TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','verified','suspended')),
 currency TEXT NOT NULL CHECK(currency IN ('TRY','EUR','USD','GBP')), license_reference TEXT,
 source_reference TEXT NOT NULL, verified_by TEXT, verified_at TEXT,
 CHECK(status != 'verified' OR (license_reference IS NOT NULL AND verified_by IS NOT NULL AND verified_at IS NOT NULL))
);
CREATE TABLE experiences (id TEXT PRIMARY KEY, provider_id TEXT NOT NULL REFERENCES providers(id), title TEXT NOT NULL, source_reference TEXT NOT NULL);
CREATE TABLE approved_prices (
 id TEXT PRIMARY KEY, experience_id TEXT NOT NULL REFERENCES experiences(id), currency TEXT NOT NULL,
 unit_minor INTEGER NOT NULL CHECK(unit_minor >= 0), valid_from TEXT NOT NULL, valid_until TEXT NOT NULL,
 approved_by TEXT NOT NULL, source_reference TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(valid_until > valid_from)
);
CREATE TABLE availability (
 experience_id TEXT NOT NULL REFERENCES experiences(id), service_date TEXT NOT NULL, remaining INTEGER NOT NULL CHECK(remaining >= 0),
 verified_until TEXT NOT NULL, source_reference TEXT NOT NULL, PRIMARY KEY(experience_id, service_date)
);
CREATE TABLE hotels (id TEXT PRIMARY KEY, status TEXT NOT NULL CHECK(status IN ('pending','verified','suspended')), currency TEXT NOT NULL, commission_bps INTEGER NOT NULL CHECK(commission_bps BETWEEN 0 AND 10000), source_reference TEXT NOT NULL);
CREATE TABLE referral_tokens (token_hash TEXT PRIMARY KEY, hotel_id TEXT NOT NULL REFERENCES hotels(id), expires_at TEXT NOT NULL, revoked INTEGER NOT NULL DEFAULT 0 CHECK(revoked IN (0,1)), source_reference TEXT NOT NULL);
CREATE TABLE booking_requests (
 id TEXT PRIMARY KEY, idempotency_key TEXT NOT NULL UNIQUE, payload_hash TEXT NOT NULL,
 experience_id TEXT NOT NULL REFERENCES experiences(id), price_id TEXT NOT NULL REFERENCES approved_prices(id),
 service_date TEXT NOT NULL, guests INTEGER NOT NULL CHECK(guests BETWEEN 1 AND 16), total_minor INTEGER NOT NULL CHECK(total_minor >= 0), currency TEXT NOT NULL,
 referral_hash TEXT REFERENCES referral_tokens(token_hash), commission_bps INTEGER CHECK(commission_bps BETWEEN 0 AND 10000),
 state TEXT NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','requested','supplier_pending','confirmed','fulfilled','rejected','cancelled','refund_pending','refunded')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE booking_events (
 id TEXT PRIMARY KEY, booking_id TEXT REFERENCES booking_requests(id), idempotency_key TEXT NOT NULL UNIQUE,
 from_state TEXT, to_state TEXT, actor_id TEXT NOT NULL, evidence_reference TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE commissions (
 id TEXT PRIMARY KEY, booking_id TEXT NOT NULL UNIQUE REFERENCES booking_requests(id), hotel_id TEXT NOT NULL REFERENCES hotels(id),
 currency TEXT NOT NULL, amount_minor INTEGER NOT NULL CHECK(amount_minor >= 0), status TEXT NOT NULL CHECK(status IN ('accrued','reconciled','reversed')),
 fulfillment_event_id TEXT NOT NULL REFERENCES booking_events(id), reconciliation_reference TEXT, reversal_event_id TEXT REFERENCES booking_events(id)
);
CREATE TRIGGER commission_verified BEFORE INSERT ON commissions BEGIN
 SELECT CASE WHEN NOT EXISTS (
 SELECT 1 FROM booking_requests b JOIN booking_events e ON e.booking_id=b.id
 JOIN referral_tokens r ON r.token_hash=b.referral_hash JOIN hotels h ON h.id=r.hotel_id
 WHERE b.id=NEW.booking_id AND b.state='fulfilled' AND e.id=NEW.fulfillment_event_id AND e.to_state='fulfilled'
 AND h.id=NEW.hotel_id AND h.status='verified' AND b.currency=h.currency AND NEW.currency=b.currency
 AND NEW.amount_minor=CAST(b.total_minor*b.commission_bps/10000 AS INTEGER)
 ) THEN RAISE(ABORT,'verified fulfillment and matching attribution required') END;
END;
CREATE TRIGGER commission_refund AFTER UPDATE OF state ON booking_requests WHEN NEW.state IN ('refund_pending','refunded') BEGIN
 UPDATE commissions SET status='reversed', reconciliation_reference=NULL WHERE booking_id=NEW.id;
END;
