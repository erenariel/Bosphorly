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
