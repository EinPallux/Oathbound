// Server persistence + auth regression test (run with `npm run server:test`). Node-only, so it
// lives under server/ (not Vitest, which is browser-typed) and uses node:assert. Covers the DB
// repositories, scrypt auth, sessions, and — the headline — that a character survives a server
// "restart" (closing the DB and reopening the same file).

import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { Db } from '../db';
import { hashPassword, verifyPassword, newSessionToken, hashToken } from '../auth';

const dbPath = join(tmpdir(), `oathbound-test-${process.pid}-${Date.now()}.db`);
const cleanup = (): void => {
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      rmSync(dbPath + suffix);
    } catch {
      /* ignore */
    }
  }
};

function sampleFlush(level = 3, gold = 500, x = 12, z = -8) {
  return {
    saveJson: JSON.stringify({ schemaVersion: 1, character: { level }, gold, position: { x, z } }),
    schemaVersion: 1,
    level,
    gold,
    x,
    z,
  };
}

async function run(): Promise<void> {
  // ── auth primitives (async scrypt) ──
  const { hash, salt } = await hashPassword('hunter2!');
  assert.equal(await verifyPassword('hunter2!', hash, salt), true, 'correct password verifies');
  assert.equal(await verifyPassword('wrong', hash, salt), false, 'wrong password rejected');

  // ── first boot ──
  let db = new Db(dbPath);
  const accId = db.createAccount('Alice', hash, salt);
  assert.ok(accId > 0, 'account created');
  assert.equal(db.findAccountByUsername('alice')?.id, accId, 'username lookup is case-insensitive');
  assert.equal(db.getAccount(accId)?.username, 'Alice');

  // sessions
  const { token, tokenHash } = newSessionToken();
  db.createSession(accId, tokenHash, Date.now() + 60_000);
  assert.equal(db.findSessionAccount(hashToken(token)), accId, 'live session resolves');
  db.createSession(accId, hashToken('expired'), Date.now() - 1);
  assert.equal(db.findSessionAccount(hashToken('expired')), undefined, 'expired session rejected');

  // characters
  db.createCharacter(accId, 0, 'Alaric', 'warrior', sampleFlush(3, 500, 12, -8));
  assert.equal(db.listCharacters(accId).length, 1, 'one character');
  db.saveCharacter(accId, 0, sampleFlush(9, 4200, 100, -50)); // simulate a play session flush
  assert.throws(() => db.createCharacter(accId, 0, 'Other', 'hunter', sampleFlush()), 'slot is unique');
  assert.throws(() => db.createCharacter(accId, 1, 'Alaric', 'hunter', sampleFlush()), 'name is unique');

  // world state
  db.setWorldState('boss.rimewyrm', JSON.stringify({ deadUntil: 123 }));
  assert.equal(db.getWorldState('boss.rimewyrm'), '{"deadUntil":123}');

  // ── "restart": close and reopen the same file ──
  db.close();
  db = new Db(dbPath);

  const acc = db.findAccountByUsername('Alice');
  assert.ok(acc, 'account survived restart');
  assert.equal(await verifyPassword('hunter2!', acc!.pass_hash, acc!.pass_salt), true, 'password hash survived');
  const chars = db.listCharacters(accId);
  assert.equal(chars.length, 1, 'character survived restart');
  assert.equal(chars[0].name, 'Alaric');
  assert.equal(chars[0].level, 9, 'flushed level survived restart');
  const row = db.getCharacter(accId, 0);
  assert.ok(row, 'character row present');
  const save = JSON.parse(row!.save_json) as { gold: number; position: { x: number } };
  assert.equal(save.gold, 4200, 'flushed gold survived restart');
  assert.equal(save.position.x, 100, 'flushed position survived restart');
  assert.equal(db.getWorldState('boss.rimewyrm'), '{"deadUntil":123}', 'world state survived restart');

  // delete
  db.deleteCharacter(accId, 0);
  assert.equal(db.listCharacters(accId).length, 0, 'character deleted');
  db.close();
}

run()
  .then(() => {
    cleanup();
    console.log('persistence.test: ALL PASSED');
  })
  .catch((err) => {
    cleanup();
    console.error('persistence.test: FAILED');
    console.error(err);
    process.exit(1);
  });
