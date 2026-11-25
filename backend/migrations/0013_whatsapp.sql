CREATE TABLE whatsapp_control(phone TEXT PRIMARY KEY, until_ms INTEGER NOT NULL);
CREATE TABLE whatsapp_leases(phone TEXT PRIMARY KEY, until_ms INTEGER NOT NULL);
CREATE TABLE whatsapp_seen(id TEXT PRIMARY KEY, expires INTEGER NOT NULL);
CREATE TABLE whatsapp_requests(id TEXT PRIMARY KEY, data_json TEXT NOT NULL, created_at INTEGER NOT NULL);
