CREATE TABLE extranet_booking_emails(
 id TEXT PRIMARY KEY,record_type TEXT NOT NULL,record_id TEXT NOT NULL,actor_id TEXT NOT NULL,
 subject TEXT NOT NULL,body TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN('sending','sent','failed')),created_at TEXT NOT NULL
);
CREATE INDEX extranet_booking_emails_record ON extranet_booking_emails(record_type,record_id,created_at);
