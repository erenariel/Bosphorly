-- Additive commission inputs; existing records remain intact.
ALTER TABLE booking_requests ADD COLUMN is_test INTEGER NOT NULL DEFAULT 0 CHECK(is_test IN(0,1));
ALTER TABLE member_requests ADD COLUMN is_test INTEGER NOT NULL DEFAULT 0 CHECK(is_test IN(0,1));
ALTER TABLE extranet_booking_meta ADD COLUMN refunded_minor INTEGER NOT NULL DEFAULT 0 CHECK(refunded_minor >= 0);
