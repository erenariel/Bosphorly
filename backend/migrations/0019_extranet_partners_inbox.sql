ALTER TABLE extranet_messages ADD COLUMN channel TEXT NOT NULL DEFAULT 'web' CHECK(channel IN('web','whatsapp','telegram','email'));
ALTER TABLE extranet_messages ADD COLUMN assigned_to TEXT REFERENCES members(id) ON DELETE SET NULL;
UPDATE extranet_messages SET channel='whatsapp' WHERE reference LIKE 'wa:%' OR subject LIKE '%WhatsApp%';
UPDATE extranet_messages SET channel='telegram' WHERE reference LIKE 'tg:%' OR subject LIKE '%Telegram%';
CREATE TABLE extranet_partner_accounts(member_id TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,provider_id TEXT NOT NULL REFERENCES providers(id),name TEXT NOT NULL,commission_bps INTEGER NOT NULL CHECK(commission_bps BETWEEN 0 AND 10000),active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1)),created_at TEXT NOT NULL);
CREATE TABLE extranet_partner_bookings(booking_uid TEXT PRIMARY KEY,partner_member_id TEXT REFERENCES extranet_partner_accounts(member_id) ON DELETE SET NULL,currency TEXT NOT NULL,commission_bps INTEGER NOT NULL,amount_minor INTEGER NOT NULL CHECK(amount_minor>=0),status TEXT NOT NULL DEFAULT 'unpaid' CHECK(status IN('unpaid','paid')),payment_reference TEXT,paid_at TEXT,created_at TEXT NOT NULL);
CREATE INDEX extranet_partner_bookings_account ON extranet_partner_bookings(partner_member_id,status);
