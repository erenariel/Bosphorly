-- Cross-device member contact details and cart/request summaries.
PRAGMA foreign_keys = ON;

ALTER TABLE members ADD COLUMN phone TEXT CHECK(phone IS NULL OR length(phone) <= 40);
ALTER TABLE members ADD COLUMN hotel TEXT CHECK(hotel IS NULL OR length(hotel) <= 140);
ALTER TABLE members ADD COLUMN room TEXT CHECK(room IS NULL OR length(room) <= 24);

ALTER TABLE member_requests ADD COLUMN req_type TEXT CHECK(req_type IS NULL OR length(req_type) <= 24);
ALTER TABLE member_requests ADD COLUMN title TEXT CHECK(title IS NULL OR length(title) <= 160);
ALTER TABLE member_requests ADD COLUMN operator TEXT CHECK(operator IS NULL OR length(operator) <= 120);
ALTER TABLE member_requests ADD COLUMN service_time TEXT CHECK(service_time IS NULL OR length(service_time) <= 24);
ALTER TABLE member_requests ADD COLUMN total_text TEXT CHECK(total_text IS NULL OR length(total_text) <= 80);
ALTER TABLE member_requests ADD COLUMN notes TEXT CHECK(notes IS NULL OR length(notes) <= 500);
