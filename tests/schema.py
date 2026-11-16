import sqlite3
from pathlib import Path
c=sqlite3.connect(':memory:')
c.executescript(Path('backend/migrations/0001.sql').read_text())
c.executescript("""
INSERT INTO providers VALUES ('p','verified','EUR','license','source','admin','2026-01-01');
INSERT INTO experiences VALUES ('e','p','Experience','source');
INSERT INTO approved_prices VALUES ('rate','e','EUR',100,'2099-01-01','2099-12-31','admin','source','2026-01-01');
INSERT INTO hotels VALUES ('h','verified','EUR',1000,'contract');
INSERT INTO referral_tokens VALUES ('hash','h','2099-12-31',0,'source');
INSERT INTO booking_requests VALUES ('b','unique','payload','e','rate','2099-01-01',2,200,'EUR','hash',1000,'requested','2026-01-01');
INSERT INTO booking_events VALUES ('event','b','unique-event','confirmed','fulfilled','operator','fulfillment-proof','2026-01-01');
""")
try:
 c.execute("INSERT INTO commissions VALUES ('c','b','h','EUR',20,'accrued','event',NULL,NULL)")
 raise AssertionError('Commission before fulfillment accepted')
except sqlite3.IntegrityError: pass
c.execute("UPDATE booking_requests SET state='fulfilled' WHERE id='b'")
c.execute("INSERT INTO commissions VALUES ('c','b','h','EUR',20,'accrued','event',NULL,NULL)")
c.execute("UPDATE booking_requests SET state='refund_pending' WHERE id='b'")
assert c.execute('SELECT status FROM commissions').fetchone()[0]=='reversed'
print('SQLite migration, fulfillment gate and refund reversal OK')
