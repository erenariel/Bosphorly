import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const MIGRATIONS_DIR = new URL('../backend/migrations/', import.meta.url).pathname;
const BACKEND_DIR = new URL('../backend/', import.meta.url).pathname;
const LOCK_PATH = join(MIGRATIONS_DIR, 'migrations.lock.json');

function sha256File(filePath) {
  return crypto.createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function collectDefinedTables() {
  const sqlFiles = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  const tables = new Set();
  for (const file of sqlFiles) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    for (const m of sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z_][a-zA-Z0-9_]*)/gi)) {
      tables.add(m[1].toLowerCase());
    }
  }
  return { sqlFiles, tables };
}

test('migrations are append-only: locked SHA-256 hashes match and all .sql files are registered', () => {
  assert.ok(existsSync(LOCK_PATH), 'backend/migrations/migrations.lock.json must exist');
  const lock = JSON.parse(readFileSync(LOCK_PATH, 'utf8'));
  assert.ok(lock && typeof lock === 'object' && !Array.isArray(lock), 'migrations.lock.json must be an object');

  const diskSqlFiles = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();

  for (const [filename, expectedHash] of Object.entries(lock)) {
    const filePath = join(MIGRATIONS_DIR, filename);
    assert.ok(
      existsSync(filePath),
      `Locked migration ${filename} was deleted; applied D1 migrations must never be removed`
    );
    const actualHash = sha256File(filePath);
    assert.equal(
      actualHash,
      expectedHash,
      `Migration ${filename} was modified (SHA-256 mismatch)! Applied migrations are append-only; create a new numbered .sql migration file instead.`
    );
  }

  for (const filename of diskSqlFiles) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(lock, filename),
      `New migration ${filename} is missing from backend/migrations/migrations.lock.json; add its SHA-256 hash to the lockfile.`
    );
  }
});

test('all migrations apply cleanly in sequence on fresh SQLite', () => {
  const { sqlFiles } = collectDefinedTables();
  assert.ok(sqlFiles.length >= 8);
  const db = new DatabaseSync(':memory:');
  for (const file of sqlFiles) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    assert.doesNotThrow(() => db.exec(sql), `Migration ${file} failed to execute sequentially`);
  }
});

test('every FROM/INTO/UPDATE/JOIN table referenced in backend/*.js SQL queries is defined by CREATE TABLE in migrations', () => {
  const { tables } = collectDefinedTables();
  const jsFiles = readdirSync(BACKEND_DIR).filter((f) => f.endsWith('.js')).sort();
  assert.ok(jsFiles.length > 0);

  // Extract string/template arguments passed to .prepare(...) so prose strings (e.g. system prompts) are ignored
  const prepareRe = /\.prepare\s*\(\s*(`[\s\S]*?`|'[^']*'|"[^"]*")/g;

  for (const file of jsFiles) {
    const src = readFileSync(join(BACKEND_DIR, file), 'utf8');
    for (const prepMatch of src.matchAll(prepareRe)) {
      const sqlLiteral = prepMatch[1];
      // Strip ON CONFLICT ... DO UPDATE SET so "UPDATE SET" is not treated as table "SET"
      const normalizedSql = sqlLiteral.replace(/\bDO\s+UPDATE\s+SET\b/gi, ' ');
      for (const tblMatch of normalizedSql.matchAll(/\b(?:FROM|INTO|UPDATE|JOIN)\s+([a-zA-Z_][a-zA-Z0-9_]*)\b/gi)) {
        const tableName = tblMatch[1].toLowerCase();
        assert.ok(
          tables.has(tableName),
          `${file} references SQL table "${tableName}" (${tblMatch[0]}) which has no CREATE TABLE in backend/migrations/*.sql`
        );
      }
    }
  }
});

test('0012 preserves campaign and issued coupon rows and foreign keys inside a migration transaction', () => {
  const db = new DatabaseSync(':memory:');
  const { sqlFiles } = collectDefinedTables();
  for (const file of sqlFiles.filter(f => f < '0012')) db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
  db.exec(`INSERT INTO members (id,email,referral_code) VALUES ('m','m@example.com','REF123');
    INSERT INTO coupons (id,code,member_id,campaign_id,percent_bps,expires_at,once_key)
    VALUES ('old','BOS-OLD','m','welcome-2026',500,'2099-01-01','m:welcome-2026');`);
  const campaigns = db.prepare('SELECT * FROM campaigns ORDER BY id').all();
  const coupons = db.prepare('SELECT * FROM coupons ORDER BY id').all();
  db.exec('BEGIN');
  db.exec(readFileSync(join(MIGRATIONS_DIR, '0012_platinum.sql'), 'utf8'));
  db.exec('COMMIT');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM campaigns').get().n, campaigns.length + 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM coupons').get().n, coupons.length);
  assert.deepEqual(db.prepare("SELECT * FROM campaigns WHERE id!='platinum-2026' ORDER BY id").all(), campaigns);
  assert.deepEqual(db.prepare('SELECT * FROM coupons ORDER BY id').all(), coupons);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  assert.equal(db.prepare("SELECT percent_bps FROM coupons WHERE id='old'").get().percent_bps, 500);
  assert.equal(db.prepare("SELECT valid_days FROM campaigns WHERE id='platinum-2026'").get().valid_days, 180);
});

test('0021 preserves existing booking requests and adds safe commission defaults', () => {
  const db = new DatabaseSync(':memory:');
  const { sqlFiles } = collectDefinedTables();
  for (const file of sqlFiles.filter(f => f < '0021')) db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
  db.exec(`INSERT INTO members(id,email,referral_code) VALUES('m','m@example.com','MREF');
    INSERT INTO member_requests(ref,member_id,service_id,service_date,guests,state,total_text) VALUES('BOS-OLD','m','tour','2026-12-01',1,'fulfilled','€100');
    INSERT INTO extranet_booking_meta(record_type,record_id,payment_status) VALUES('member_request','BOS-OLD','paid');`);
  const before = db.prepare('SELECT * FROM member_requests').get();
  db.exec(readFileSync(join(MIGRATIONS_DIR, '0021_commission_basis.sql'), 'utf8'));
  const { is_test, ...after } = db.prepare('SELECT * FROM member_requests').get();
  assert.equal(is_test, 0);
  assert.deepEqual(after, { ...before });
  assert.equal(db.prepare('SELECT refunded_minor FROM extranet_booking_meta').get().refunded_minor, 0);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
});

test('0022 preserves data, grants existing Cafer staff admin with audit and leaves owner/disabled roles intact',()=>{
 for(const [role,active,expected] of [['staff',1,'admin'],['owner',1,'owner'],['staff',0,'staff']]){
  const db=new DatabaseSync(':memory:');const {sqlFiles}=collectDefinedTables();
  for(const file of sqlFiles.filter(f=>f<'0022'))db.exec(readFileSync(join(MIGRATIONS_DIR,file),'utf8'));
  db.exec(`INSERT INTO members(id,email,referral_code) VALUES('cafer','cafer@bosphorly.com','CAF');`);
  db.prepare('INSERT INTO extranet_users(member_id,role,active) VALUES(?,?,?)').run('cafer',role,active);
  db.exec(`INSERT INTO extranet_messages(id,source,subject,body,created_at,expires_at) VALUES('old','form','Old','Private body','2026-11-01','2099-01-01');`);
  db.exec(readFileSync(join(MIGRATIONS_DIR,'0022_support_requests.sql'),'utf8'));
  assert.equal(db.prepare("SELECT body FROM extranet_messages WHERE id='old'").get().body,'Private body');
  assert.equal(db.prepare("SELECT role FROM extranet_users WHERE member_id='cafer'").get().role,expected);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM extranet_audit WHERE action='support_admin_bootstrap'").get().n,expected==='admin'?1:0);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
 }
});
