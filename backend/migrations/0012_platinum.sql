-- Platinum uses a dedicated campaign id; keep the existing kind CHECK and all FK targets intact.
INSERT INTO campaigns (id, kind, percent_bps, valid_days)
VALUES ('platinum-2026', 'loyalty', 1000, 180);
PRAGMA foreign_key_check;
