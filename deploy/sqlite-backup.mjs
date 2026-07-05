// WAL-safe online backup of the Oathbound SQLite DB, using the better-sqlite3
// online-backup API (the same mechanism as the `sqlite3 .backup` CLI command).
// Safe to run while the server is writing — no need to stop the service.
//
//   node deploy/sqlite-backup.mjs <source.db> <dest.db>
//
// Run from the app dir (where node_modules/better-sqlite3 lives). Called by
// deploy/backup.sh, which then gzips + rotates the output. Requires no system
// sqlite3 package — it reuses the driver the server already depends on.

import Database from 'better-sqlite3';

const [src, dest] = process.argv.slice(2);
if (!src || !dest) {
  console.error('usage: node sqlite-backup.mjs <source.db> <dest.db>');
  process.exit(2);
}

const db = new Database(src, { readonly: true, fileMustExist: true });
try {
  await db.backup(dest);
  console.log(`[backup] ${src} → ${dest} ok`);
} catch (err) {
  console.error(`[backup] failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
} finally {
  db.close();
}
