// The authoritative game: owns the sim world, accounts + character persistence (SQLite), and
// the tick → snapshot-broadcast loop. M3 "Accounts + SQLite": a connection authenticates, picks
// a character (loaded from the DB via applySave), and enters the world; its state is flushed
// back to the DB via serialize() periodically, on disconnect, and on shutdown. The sim is still
// the authority — the client only sends intents. Node glue; reusable pieces are isomorphic.

import { WebSocket } from 'ws';
import { NetworkControlState } from '../src/net/net-input';
import { buildSnapshot } from '../src/net/snapshot';
import { encode, type InputMessage } from '../src/net/protocol';
import { addPlayer } from '../src/sim/boot/sim-world';
import { pickUpNearest } from '../src/sim/systems/loot';
import { serialize, applySave, SCHEMA_VERSION, type SaveData } from '../src/sim/save';
import { DT } from '../src/core/time';
import type { Entity } from '../src/core/ecs/world';
import type { ClassId } from '../src/core/ecs/components';
import { bootServerWorld, type ServerWorld } from './world-boot';
import { Db, type CharacterSummary, type CharacterFlush } from './db';
import { hashPassword, verifyPassword, newSessionToken, hashToken } from './auth';
import type { ServerConfig } from './config';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface ConnectedPlayer {
  entity: Entity;
  input: NetworkControlState;
  accountId: number;
  slot: number;
}

export type AuthResult =
  | { ok: true; token: string; username: string; accountId: number }
  | { ok: false; code: string; message: string };

export type EnterResult = { ok: true; entity: Entity } | { ok: false; code: string; message: string };

export class GameServer {
  readonly world: ServerWorld;
  private readonly db: Db;
  private readonly clients = new Map<WebSocket, ConnectedPlayer>();
  private readonly snapshotEvery: number;
  private sinceSnapshot = 0;
  private tickCount = 0;

  constructor(private readonly config: ServerConfig) {
    this.db = new Db(config.dbPath);
    this.world = bootServerWorld(config);
    this.snapshotEvery = Math.max(1, Math.round(config.tickHz / config.snapshotHz));
  }

  get tick(): number {
    return this.tickCount;
  }
  get playerCount(): number {
    return this.clients.size;
  }
  get mapName(): string {
    return this.world.mapName;
  }
  get tickHz(): number {
    return this.config.tickHz;
  }
  get snapshotHz(): number {
    return this.config.snapshotHz;
  }
  get needsJoinPassword(): boolean {
    return this.config.joinPassword !== '';
  }

  // ── Accounts / auth ──────────────────────────────────────────────────────────────────────

  register(username: string, password: string, joinPassword?: string): AuthResult {
    if (this.config.joinPassword !== '' && joinPassword !== this.config.joinPassword) {
      return { ok: false, code: 'join_denied', message: 'wrong server password' };
    }
    if (this.db.findAccountByUsername(username)) {
      return { ok: false, code: 'username_taken', message: 'that username is taken' };
    }
    const { hash, salt } = hashPassword(password);
    const accountId = this.db.createAccount(username, hash, salt);
    return this.issueSession(accountId, username);
  }

  login(username: string, password: string): AuthResult {
    const acc = this.db.findAccountByUsername(username);
    if (!acc || !verifyPassword(password, acc.pass_hash, acc.pass_salt)) {
      return { ok: false, code: 'bad_credentials', message: 'wrong username or password' };
    }
    this.db.touchLogin(acc.id);
    return this.issueSession(acc.id, acc.username);
  }

  resume(token: string): { accountId: number; username: string } | null {
    const accountId = this.db.findSessionAccount(hashToken(token));
    if (accountId == null) return null;
    const acc = this.db.getAccount(accountId);
    if (!acc) return null;
    return { accountId, username: acc.username };
  }

  private issueSession(accountId: number, username: string): AuthResult {
    const { token, tokenHash } = newSessionToken();
    this.db.createSession(accountId, tokenHash, Date.now() + SESSION_TTL_MS);
    return { ok: true, token, username, accountId };
  }

  characters(accountId: number): CharacterSummary[] {
    return this.db.listCharacters(accountId);
  }

  deleteChar(accountId: number, slot: number): void {
    this.db.deleteCharacter(accountId, slot);
  }

  // ── Entering the world ───────────────────────────────────────────────────────────────────

  /** Enter as an existing character (loaded from the DB). */
  enterExisting(ws: WebSocket, accountId: number, slot: number): EnterResult {
    const row = this.db.getCharacter(accountId, slot);
    if (!row) return { ok: false, code: 'no_character', message: 'no character in that slot' };
    let save: SaveData;
    try {
      save = JSON.parse(row.save_json) as SaveData;
    } catch {
      return { ok: false, code: 'bad_save', message: 'stored save is corrupt' };
    }
    return this.spawn(ws, accountId, slot, save, save.classId, false);
  }

  /** Create a fresh character in a slot, then enter as it. */
  enterNew(ws: WebSocket, accountId: number, slot: number, name: string, classId: ClassId): EnterResult {
    if (this.db.getCharacter(accountId, slot)) {
      return { ok: false, code: 'slot_taken', message: 'that slot is occupied' };
    }
    const input = new NetworkControlState();
    const { x, z } = this.world.playerStart;
    const entity = addPlayer(this.world.sim.world, this.world.field, input, { x, z, classId });
    const save = serialize(this.world.sim.world, entity);
    try {
      this.db.createCharacter(accountId, slot, name, classId, this.flushFrom(save));
    } catch {
      this.world.sim.world.destroyEntity(entity);
      return { ok: false, code: 'name_taken', message: 'that character name is taken' };
    }
    this.clients.set(ws, { entity, input, accountId, slot });
    return { ok: true, entity };
  }

  /** One-time import of an offline save into a slot, then enter as it. */
  enterImport(ws: WebSocket, accountId: number, slot: number, name: string, raw: unknown): EnterResult {
    if (this.db.getCharacter(accountId, slot)) {
      return { ok: false, code: 'slot_taken', message: 'that slot is occupied' };
    }
    const save = validateSave(raw);
    if (!save) return { ok: false, code: 'bad_save', message: 'the imported save is not valid' };
    const res = this.spawn(ws, accountId, slot, save, save.classId, true);
    if (res.ok) {
      try {
        this.db.createCharacter(accountId, slot, name, save.classId, this.flushFrom(save));
      } catch {
        this.leave(ws);
        return { ok: false, code: 'name_taken', message: 'that character name is taken' };
      }
    }
    return res;
  }

  /** Spawn a player entity, apply a save onto it, and register the connection. */
  private spawn(ws: WebSocket, accountId: number, slot: number, save: SaveData, classId: ClassId, _imported: boolean): EnterResult {
    const input = new NetworkControlState();
    const entity = addPlayer(this.world.sim.world, this.world.field, input, {
      x: save.position?.x ?? this.world.playerStart.x,
      z: save.position?.z ?? this.world.playerStart.z,
      classId,
    });
    try {
      applySave(this.world.sim.world, entity, save);
    } catch {
      this.world.sim.world.destroyEntity(entity);
      return { ok: false, code: 'bad_save', message: 'could not apply the save' };
    }
    this.clients.set(ws, { entity, input, accountId, slot });
    return { ok: true, entity };
  }

  // ── In-world tick / input / persistence ──────────────────────────────────────────────────

  onInput(ws: WebSocket, msg: InputMessage): void {
    this.clients.get(ws)?.input.applyInput(msg);
  }

  step(dt: number = DT): void {
    this.world.sim.world.update(dt);
    for (const p of this.clients.values()) {
      if (p.input.consumeInteract()) pickUpNearest(this.world.sim.world, p.entity);
    }
    this.tickCount++;
    if (++this.sinceSnapshot >= this.snapshotEvery) {
      this.sinceSnapshot = 0;
      this.broadcast();
    }
  }

  /** Flush one in-world character to the DB (serialize → row). */
  private flush(p: ConnectedPlayer): void {
    const save = serialize(this.world.sim.world, p.entity);
    this.db.saveCharacter(p.accountId, p.slot, this.flushFrom(save));
  }

  private flushFrom(save: SaveData): CharacterFlush {
    return {
      saveJson: JSON.stringify(save),
      schemaVersion: save.schemaVersion ?? SCHEMA_VERSION,
      level: save.character.level,
      gold: save.gold,
      x: save.position.x,
      z: save.position.z,
    };
  }

  /** Persist every in-world character (periodic + shutdown). */
  flushAll(): void {
    for (const p of this.clients.values()) this.flush(p);
  }

  /** A connection dropped: flush its character and remove its entity. */
  leave(ws: WebSocket): void {
    const p = this.clients.get(ws);
    if (!p) return;
    try {
      this.flush(p);
    } catch {
      /* best-effort on disconnect */
    }
    this.world.sim.world.destroyEntity(p.entity);
    this.clients.delete(ws);
  }

  close(): void {
    this.db.close();
  }

  sendSnapshotTo(ws: WebSocket): void {
    const p = this.clients.get(ws);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(encode(buildSnapshot(this.world.sim.world, this.tickCount, p?.input.seq ?? 0)));
    }
  }

  private broadcast(): void {
    if (this.clients.size === 0) return;
    for (const [ws, p] of this.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(encode(buildSnapshot(this.world.sim.world, this.tickCount, p.input.seq)));
      }
    }
  }
}

/** Structurally validate an untrusted imported save before applySave touches the world. */
function validateSave(raw: unknown): SaveData | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const s = raw as Partial<SaveData>;
  if (typeof s.schemaVersion !== 'number' || s.schemaVersion > SCHEMA_VERSION) return null;
  if (s.classId !== 'warrior' && s.classId !== 'hunter' && s.classId !== 'priest') return null;
  if (!s.character || typeof s.character.level !== 'number') return null;
  if (!s.position || typeof s.position.x !== 'number' || typeof s.position.z !== 'number') return null;
  if (!Array.isArray(s.inventory) || typeof s.equipment !== 'object' || s.equipment === null) return null;
  if (typeof s.gold !== 'number') return null;
  return raw as SaveData;
}
