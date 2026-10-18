/**
 * One-time, repeatable import of the original Passway SQLite database into MySQL.
 * Requires Node.js >= 22.5 and an already-created MySQL schema (`npm run db:push`).
 * By default reads db/custom.db; override with SQLITE_SOURCE=/path/to/custom.db.
 */
import { DatabaseSync } from 'node:sqlite';
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const source = path.resolve(process.env.SQLITE_SOURCE || 'db/custom.db');
if (!fs.existsSync(source)) {
  console.error(`SQLite source database not found: ${source}`);
  console.error('Set SQLITE_SOURCE to the path of the original db/custom.db file.');
  process.exit(1);
}

let sqlite;
try {
  sqlite = new DatabaseSync(source, { readOnly: true });
} catch (error) {
  console.error(`Could not open SQLite database ${source}:`, error);
  process.exit(1);
}

const prisma = new PrismaClient({ log: ['error'] });
const dateColumns = new Set(['createdAt', 'updatedAt', 'deletedAt', 'expiresAt']);

function convertValue(column, value) {
  if (value === null || value === undefined) return null;
  if (dateColumns.has(column)) {
    if (typeof value === 'bigint' || typeof value === 'number') return new Date(Number(value));
    if (value instanceof Date) return value;
    const numeric = Number(value);
    if (String(value).trim() !== '' && Number.isFinite(numeric)) return new Date(numeric);
    return new Date(String(value));
  }
  return value;
}

function quoteIdent(value) {
  return `\`${String(value).replaceAll('`', '``')}\``;
}

// Parent tables must be imported before dependent tables; this avoids disabling
// MySQL foreign-key checks and keeps relational integrity active throughout.
const importOrder = [
  'User',
  'Group',
  'Credential',
  'ShareGrant',
  'Activity',
  'Note',
  'Attachment',
  'LoginPairing',
];

try {
  const sourceTables = new Set(
    sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map((row) => row.name),
  );
  const targetRows = await prisma.$queryRawUnsafe('SHOW TABLES');
  const targetTables = new Set(targetRows.map((row) => String(Object.values(row)[0]).toLowerCase()));

  const missing = [...sourceTables].filter((table) => !importOrder.includes(table));
  if (missing.length) {
    console.warn(`Skipping unrecognized legacy tables: ${missing.join(', ')}`);
  }

  let total = 0;
  for (const table of importOrder) {
    if (!sourceTables.has(table)) continue;
    if (!targetTables.has(table.toLowerCase())) {
      throw new Error(`MySQL table ${table} does not exist. Run npm run db:push first.`);
    }
    const rows = sqlite.prepare(`SELECT * FROM ${quoteIdent(table)}`).all();
    if (!rows.length) {
      console.log(`${table}: 0 rows (empty source table)`);
      continue;
    }
    const columns = Object.keys(rows[0]);
    const colSql = columns.map(quoteIdent).join(', ');
    let imported = 0;
    let skipped = 0;
    for (const row of rows) {
      const values = columns.map((column) => convertValue(column, row[column]));
      const placeholders = values.map(() => '?').join(', ');
      const sql = `INSERT IGNORE INTO ${quoteIdent(table)} (${colSql}) VALUES (${placeholders})`;
      const result = await prisma.$executeRawUnsafe(sql, ...values);
      if (Number(result) > 0) imported++;
      else skipped++;
    }
    total += imported;
    console.log(`${table}: imported ${imported}; already present/skipped ${skipped}`);
  }

  console.log(`SQLite → MySQL import complete. New rows imported: ${total}.`);
  console.log('The SQLite source database was opened read-only and has not been changed.');
} catch (error) {
  console.error('SQLite → MySQL import failed:', error);
  process.exitCode = 1;
} finally {
  sqlite.close();
  await prisma.$disconnect();
}
