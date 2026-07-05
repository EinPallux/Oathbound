// SQLite persistence (better-sqlite3, WAL). The single durable store for the server: accounts,
// sessions, characters (hot columns + the full versioned SaveData as JSON — reusing the game's
// serialize()/applySave() as the boundary) and cross-restart world flags. Synchronous + in-
// process; one file on disk. See docs/technical/MMO_ARCHITECTURE.md §6.

import Database from 'better-sqlite3';

type DB = Database.Database;

export interface AccountRow {
  id: number;
  username: string;
  pass_hash: Buffer;
  pass_salt: Buffer;
  is_admin: number;
  is_banned: number;
}

export interface CharacterSummary {
  slot: number;
  name: string;
  classId: string;
  level: number;
}

export interface CharacterRow {
  slot: number;
  name: string;
  class_id: string;
  save_json: string;
  save_schema_version: number;
}

/** Fields updated on each character flush (derived from the SaveData). */
export interface CharacterFlush {
  saveJson: string;
  schemaVersion: number;
  level: number;
  gold: number;
  x: number;
  z: number;
}

// ── Ordered migrations. Each runs once, inside a transaction, recorded in `migrations`. ──
const MIGRATIONS: { name: string; sql: string }[] = [
  {
    name: '001_init',
    sql: `
      CREATE TABLE accounts (
        id INTEGER PRIMARY KEY,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        pass_hash BLOB NOT NULL,
        pass_salt BLOB NOT NULL,
        is_admin INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        last_login_at INTEGER
      );
      CREATE TABLE sessions (
        token_hash BLOB PRIMARY KEY,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE TABLE characters (
        id INTEGER PRIMARY KEY,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        slot INTEGER NOT NULL,
        name TEXT NOT NULL UNIQUE COLLATE NOCASE,
        class_id TEXT NOT NULL,
        level INTEGER NOT NULL,
        gold INTEGER NOT NULL,
        pos_x REAL NOT NULL,
        pos_z REAL NOT NULL,
        save_json TEXT NOT NULL,
        save_schema_version INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE (account_id, slot)
      );
      CREATE TABLE world_state (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `,
  },
  {
    name: '002_bans',
    sql: `ALTER TABLE accounts ADD COLUMN is_banned INTEGER NOT NULL DEFAULT 0;`,
  },
];

export class Db {
  private readonly db: DB;

  constructor(path: string) {
    this.db = new Database(path);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 5000');
    this.migrate();
  }

  close(): void {
    this.db.close();
  }

  private migrate(): void {
    this.db.exec('CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)');
    const done = new Set(
      this.db.prepare('SELECT name FROM migrations').all().map((r) => (r as { name: string }).name),
    );
    const apply = this.db.transaction((m: { name: string; sql: string }) => {
      this.db.exec(m.sql);
      this.db.prepare('INSERT INTO migrations (name, applied_at) VALUES (?, ?)').run(m.name, Date.now());
    });
    for (const m of MIGRATIONS) if (!done.has(m.name)) apply(m);
  }

  // ── Accounts ──
  createAccount(username: string, passHash: Buffer, passSalt: Buffer): number {
    const info = this.db
      .prepare('INSERT INTO accounts (username, pass_hash, pass_salt, created_at) VALUES (?, ?, ?, ?)')
      .run(username, passHash, passSalt, Date.now());
    return Number(info.lastInsertRowid);
  }

  findAccountByUsername(username: string): AccountRow | undefined {
    return this.db
      .prepare('SELECT id, username, pass_hash, pass_salt, is_admin, is_banned FROM accounts WHERE username = ?')
      .get(username) as AccountRow | undefined;
  }

  getAccount(id: number): AccountRow | undefined {
    return this.db
      .prepare('SELECT id, username, pass_hash, pass_salt, is_admin, is_banned FROM accounts WHERE id = ?')
      .get(id) as AccountRow | undefined;
  }

  touchLogin(accountId: number): void {
    this.db.prepare('UPDATE accounts SET last_login_at = ? WHERE id = ?').run(Date.now(), accountId);
  }

  setAdmin(accountId: number, admin: boolean): void {
    this.db.prepare('UPDATE accounts SET is_admin = ? WHERE id = ?').run(admin ? 1 : 0, accountId);
  }

  setBanned(accountId: number, banned: boolean): void {
    this.db.prepare('UPDATE accounts SET is_banned = ? WHERE id = ?').run(banned ? 1 : 0, accountId);
  }

  // ── Sessions ──
  createSession(accountId: number, tokenHash: Buffer, expiresAt: number): void {
    this.db
      .prepare('INSERT INTO sessions (token_hash, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
      .run(tokenHash, accountId, Date.now(), expiresAt);
  }

  /** Resolve a live (unexpired) session to its account id, or undefined. */
  findSessionAccount(tokenHash: Buffer): number | undefined {
    const row = this.db
      .prepare('SELECT account_id, expires_at FROM sessions WHERE token_hash = ?')
      .get(tokenHash) as { account_id: number; expires_at: number } | undefined;
    if (!row || row.expires_at < Date.now()) return undefined;
    return row.account_id;
  }

  // ── Characters ──
  listCharacters(accountId: number): CharacterSummary[] {
    return this.db
      .prepare('SELECT slot, name, class_id, level FROM characters WHERE account_id = ? ORDER BY slot')
      .all(accountId)
      .map((r) => {
        const row = r as { slot: number; name: string; class_id: string; level: number };
        return { slot: row.slot, name: row.name, classId: row.class_id, level: row.level };
      });
  }

  getCharacter(accountId: number, slot: number): CharacterRow | undefined {
    return this.db
      .prepare(
        'SELECT slot, name, class_id, save_json, save_schema_version FROM characters WHERE account_id = ? AND slot = ?',
      )
      .get(accountId, slot) as CharacterRow | undefined;
  }

  /** Insert a new character. Throws on a duplicate (account, slot) or duplicate name. */
  createCharacter(accountId: number, slot: number, name: string, classId: string, f: CharacterFlush): void {
    const now = Date.now();
    this.db
      .prepare(
        `INSERT INTO characters
           (account_id, slot, name, class_id, level, gold, pos_x, pos_z, save_json, save_schema_version, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(accountId, slot, name, classId, f.level, f.gold, f.x, f.z, f.saveJson, f.schemaVersion, now, now);
  }

  /** Persist a character's live state (write-behind flush). */
  saveCharacter(accountId: number, slot: number, f: CharacterFlush): void {
    this.db
      .prepare(
        `UPDATE characters
            SET save_json = ?, save_schema_version = ?, level = ?, gold = ?, pos_x = ?, pos_z = ?, updated_at = ?
          WHERE account_id = ? AND slot = ?`,
      )
      .run(f.saveJson, f.schemaVersion, f.level, f.gold, f.x, f.z, Date.now(), accountId, slot);
  }

  deleteCharacter(accountId: number, slot: number): void {
    this.db.prepare('DELETE FROM characters WHERE account_id = ? AND slot = ?').run(accountId, slot);
  }

  // ── World state (cross-restart flags: boss timers, world events) ──
  getWorldState(key: string): string | undefined {
    const row = this.db.prepare('SELECT value_json FROM world_state WHERE key = ?').get(key) as
      | { value_json: string }
      | undefined;
    return row?.value_json;
  }

  setWorldState(key: string, valueJson: string): void {
    this.db
      .prepare(
        `INSERT INTO world_state (key, value_json, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
      )
      .run(key, valueJson, Date.now());
  }
}
