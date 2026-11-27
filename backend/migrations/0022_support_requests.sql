-- A support request is an inbox message, with a durable email outbox on the same row.
ALTER TABLE extranet_messages ADD COLUMN request_key TEXT;
ALTER TABLE extranet_messages ADD COLUMN conversation_hash TEXT;
ALTER TABLE extranet_messages ADD COLUMN support_json TEXT;
ALTER TABLE extranet_messages ADD COLUMN email_status TEXT CHECK(email_status IN('pending','sending','sent','failed'));
ALTER TABLE extranet_messages ADD COLUMN email_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE extranet_messages ADD COLUMN email_next_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE extranet_messages ADD COLUMN email_lease_until INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX support_request_idempotency ON extranet_messages(request_key) WHERE request_key IS NOT NULL;
CREATE INDEX support_email_retry ON extranet_messages(email_status,email_next_at);
CREATE TRIGGER support_request_hourly_limit BEFORE INSERT ON extranet_messages
WHEN NEW.request_key IS NOT NULL AND NOT EXISTS(SELECT 1 FROM extranet_messages WHERE request_key=NEW.request_key)
AND (SELECT COUNT(*) FROM extranet_messages WHERE conversation_hash=NEW.conversation_hash AND created_at>datetime(NEW.created_at,'-1 hour'))>=3
BEGIN SELECT RAISE(ABORT,'support_rate_limit'); END;
-- Authorized team admin: keep owner status and disabled accounts intact.
INSERT INTO extranet_audit(id,actor_member_id,actor_role,action,target_type,target_id,old_value,new_value,ip_address,created_at)
SELECT lower(hex(randomblob(16))),'system','unauthorized','support_admin_bootstrap','extranet_user',m.id,NULL,'{"role":"admin"}','migration',CURRENT_TIMESTAMP
FROM members m LEFT JOIN extranet_users u ON u.member_id=m.id
WHERE lower(m.email)='cafer@bosphorly.com' AND (u.member_id IS NULL OR (u.active=1 AND u.role NOT IN('owner','admin')));
INSERT INTO extranet_users(member_id,role,active,created_at,updated_at)
SELECT m.id,'admin',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP FROM members m WHERE lower(m.email)='cafer@bosphorly.com'
ON CONFLICT(member_id) DO UPDATE SET role='admin',updated_at=CURRENT_TIMESTAMP WHERE extranet_users.active=1 AND extranet_users.role NOT IN('owner','admin');
