// The authoritative game: owns the sim world, accounts + character persistence (SQLite), and
// the tick → snapshot-broadcast loop. M3 "Accounts + SQLite": a connection authenticates, picks
// a character (loaded from the DB via applySave), and enters the world; its state is flushed
// back to the DB via serialize() periodically, on disconnect, and on shutdown. The sim is still
// the authority — the client only sends intents. Node glue; reusable pieces are isomorphic.

import { WebSocket } from 'ws';
import { NetworkControlState } from '../src/net/net-input';
import { buildSnapshot } from '../src/net/snapshot';
import { encode, type InputMessage, type ServerMessage } from '../src/net/protocol';
import { RateLimiter } from '../src/net/rate-limit';
import { addPlayer } from '../src/sim/boot/sim-world';
import { createNullControlState } from '../src/platform/null-input';
import { pickUpNearest } from '../src/sim/systems/loot';
import { serialize, applySave, SCHEMA_VERSION, type SaveData } from '../src/sim/save';
import { LEVEL_CAP } from '../src/sim/stats';
import { CombatEvent, type LevelUpEvent, type DeathEvent } from '../src/sim/combat/events';
import { DT } from '../src/core/time';
import type { Entity } from '../src/core/ecs/world';
import { C, type ClassId, type EnemyInfo } from '../src/core/ecs/components';
import type { ControlState } from '../src/platform/input';
import { bootServerWorld, type ServerWorld } from './world-boot';
import { Db, type CharacterSummary, type CharacterFlush } from './db';
import { hashPassword, verifyPassword, newSessionToken, hashToken } from './auth';
import type { ServerConfig } from './config';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
/** How long a disconnected player's entity lingers so a quick reconnect resumes it in place. */
const RECONNECT_GRACE_MS = 20_000;

interface ConnectedPlayer {
  entity: Entity;
  input: NetworkControlState;
  accountId: number;
  slot: number;
  /** Character display name (for chat + presence). */
  name: string;
  /** Whether this account may use /admin commands. */
  isAdmin: boolean;
  /** Per-player chat throttle (5 lines, ~1/s sustained) to curb spam. */
  chatLimiter: RateLimiter;
}

export type AuthResult =
  | { ok: true; token: string; username: string; accountId: number }
  | { ok: false; code: string; message: string };

export type EnterResult = { ok: true; entity: Entity } | { ok: false; code: string; message: string };

export class GameServer {
  readonly world: ServerWorld;
  private readonly db: Db;
  private readonly clients = new Map<WebSocket, ConnectedPlayer>();
  /** Disconnected-but-still-alive players, keyed by `accountId:slot`, for seamless reconnect. */
  private readonly orphans = new Map<
    string,
    { entity: Entity; accountId: number; slot: number; name: string; deadAt: number }
  >();
  /** `accountId:slot` currently in the world (blocks a duplicate concurrent session). */
  private readonly active = new Set<string>();
  /** Quest progress the server can't re-derive (it doesn't simulate quests). Kept by
   *  `accountId:slot` from the loaded save and re-attached on every flush so a re-serialize
   *  doesn't wipe an imported character's quests. Cleared on fresh-create and on reap. */
  private readonly questCache = new Map<string, SaveData['quests']>();
  private readonly snapshotEvery: number;
  private sinceSnapshot = 0;
  private tickCount = 0;

  constructor(private readonly config: ServerConfig) {
    this.db = new Db(config.dbPath);
    this.world = bootServerWorld(config);
    this.snapshotEvery = Math.max(1, Math.round(config.tickHz / config.snapshotHz));

    // Sim events → world-wide system chat lines (level-ups, world-boss kills).
    const events = this.world.sim.world.events;
    events.on<LevelUpEvent>(CombatEvent.LevelUp, (e) => {
      const name = this.nameOf(e.entity);
      if (name) this.broadcastSystem(`${name} reached level ${e.level}.`);
    });
    events.on<DeathEvent>(CombatEvent.Death, (e) => {
      if (this.world.sim.world.get(e.entity, C.Boss) == null) return;
      const info = this.world.sim.world.get<EnemyInfo>(e.entity, C.EnemyInfo);
      const killer = this.nameOf(e.killer);
      this.broadcastSystem(`${killer ?? 'A hero'} has slain ${info?.name ?? 'a world boss'}!`);
    });
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
  get maxConnPerIp(): number {
    return this.config.maxConnPerIp;
  }

  // ── Accounts / auth ──────────────────────────────────────────────────────────────────────

  async register(username: string, password: string, joinPassword?: string): Promise<AuthResult> {
    if (this.config.joinPassword !== '' && joinPassword !== this.config.joinPassword) {
      return { ok: false, code: 'join_denied', message: 'wrong server password' };
    }
    if (this.db.findAccountByUsername(username)) {
      return { ok: false, code: 'username_taken', message: 'that username is taken' };
    }
    const { hash, salt } = await hashPassword(password);
    const accountId = this.db.createAccount(username, hash, salt);
    return this.issueSession(accountId, username);
  }

  async login(username: string, password: string): Promise<AuthResult> {
    const acc = this.db.findAccountByUsername(username);
    if (!acc || !(await verifyPassword(password, acc.pass_hash, acc.pass_salt))) {
      return { ok: false, code: 'bad_credentials', message: 'wrong username or password' };
    }
    if (acc.is_banned) return { ok: false, code: 'banned', message: 'this account is banned' };
    this.db.touchLogin(acc.id);
    return this.issueSession(acc.id, acc.username);
  }

  resume(token: string): { accountId: number; username: string } | null {
    const accountId = this.db.findSessionAccount(hashToken(token));
    if (accountId == null) return null;
    const acc = this.db.getAccount(accountId);
    if (!acc || acc.is_banned) return null;
    return { accountId, username: acc.username };
  }

  private issueSession(accountId: number, username: string): AuthResult {
    // Auto-promote configured admins (OATHBOUND_ADMINS) on each login.
    if (this.config.admins.includes(username.toLowerCase())) this.db.setAdmin(accountId, true);
    const { token, tokenHash } = newSessionToken();
    this.db.createSession(accountId, tokenHash, Date.now() + SESSION_TTL_MS);
    return { ok: true, token, username, accountId };
  }

  characters(accountId: number): CharacterSummary[] {
    return this.db.listCharacters(accountId);
  }

  /** Delete a character slot — refused while that character is in the world (live or in the
   *  reconnect-grace window), since deleting a live entity would orphan it and its grace-window
   *  flush could later clobber a freshly-created character in the same slot. */
  deleteChar(accountId: number, slot: number): { ok: true } | { ok: false; code: string; message: string } {
    const k = `${accountId}:${slot}`;
    if (this.active.has(k) || this.orphans.has(k)) {
      return { ok: false, code: 'char_in_world', message: 'log that character out before deleting it' };
    }
    this.db.deleteCharacter(accountId, slot);
    return { ok: true };
  }

  // ── Entering the world ───────────────────────────────────────────────────────────────────

  /** Enter as an existing character — re-attaching to a still-alive orphan if reconnecting, else
   *  loading from the DB. */
  enterExisting(ws: WebSocket, accountId: number, slot: number): EnterResult {
    const k = `${accountId}:${slot}`;
    // Seamless reconnect: re-attach to the entity kept alive from the recent disconnect.
    const orphan = this.orphans.get(k);
    if (orphan) {
      this.orphans.delete(k);
      const input = new NetworkControlState();
      this.world.sim.world.set<ControlState>(orphan.entity, C.PlayerInput, input);
      this.clients.set(ws, this.makeClient(orphan.entity, input, accountId, slot, orphan.name));
      this.active.add(k);
      return { ok: true, entity: orphan.entity };
    }
    if (this.active.has(k)) {
      return { ok: false, code: 'already_playing', message: 'that character is already in the world' };
    }
    const row = this.db.getCharacter(accountId, slot);
    if (!row) return { ok: false, code: 'no_character', message: 'no character in that slot' };
    let save: SaveData;
    try {
      save = JSON.parse(row.save_json) as SaveData;
    } catch {
      return { ok: false, code: 'bad_save', message: 'stored save is corrupt' };
    }
    return this.spawn(ws, accountId, slot, save, save.classId, row.name);
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
    this.questCache.delete(`${accountId}:${slot}`); // a fresh character has no quests
    this.clients.set(ws, this.makeClient(entity, input, accountId, slot, name));
    this.active.add(`${accountId}:${slot}`);
    return { ok: true, entity };
  }

  /** One-time import of an offline save into a slot, then enter as it. */
  enterImport(ws: WebSocket, accountId: number, slot: number, name: string, raw: unknown): EnterResult {
    if (this.db.getCharacter(accountId, slot)) {
      return { ok: false, code: 'slot_taken', message: 'that slot is occupied' };
    }
    const save = validateSave(raw);
    if (!save) return { ok: false, code: 'bad_save', message: 'the imported save is not valid' };
    const res = this.spawn(ws, accountId, slot, save, save.classId, name);
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
  private spawn(ws: WebSocket, accountId: number, slot: number, save: SaveData, classId: ClassId, name: string): EnterResult {
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
    // Remember quests from the loaded save so re-serializing on flush doesn't drop them.
    const k = `${accountId}:${slot}`;
    if (save.quests) this.questCache.set(k, save.quests);
    else this.questCache.delete(k);
    this.clients.set(ws, this.makeClient(entity, input, accountId, slot, name));
    this.active.add(k);
    return { ok: true, entity };
  }

  private makeClient(entity: Entity, input: NetworkControlState, accountId: number, slot: number, name: string): ConnectedPlayer {
    const isAdmin = (this.db.getAccount(accountId)?.is_admin ?? 0) === 1;
    return { entity, input, accountId, slot, name, isAdmin, chatLimiter: new RateLimiter(5, 1, Date.now()) };
  }

  /** Set by main so `/admin shutdown` can trigger a graceful exit. */
  onShutdown?: (seconds: number) => void;

  // ── In-world tick / input / persistence ──────────────────────────────────────────────────

  onInput(ws: WebSocket, msg: InputMessage): void {
    this.clients.get(ws)?.input.applyInput(msg);
  }

  step(dt: number = DT): void {
    this.world.sim.world.update(dt);
    for (const p of this.clients.values()) {
      if (p.input.consumeInteract()) pickUpNearest(this.world.sim.world, p.entity);
    }
    this.reap();
    this.tickCount++;
    if (++this.sinceSnapshot >= this.snapshotEvery) {
      this.sinceSnapshot = 0;
      this.broadcast();
    }
  }

  /** Destroy orphaned (disconnected past the grace window) player entities. */
  private reap(): void {
    if (this.orphans.size === 0) return;
    const now = Date.now();
    for (const [k, o] of this.orphans) {
      if (o.deadAt <= now) {
        try {
          this.flushEntity(o.accountId, o.slot, o.entity);
        } catch {
          /* best-effort */
        }
        this.world.sim.world.destroyEntity(o.entity);
        this.orphans.delete(k);
        this.questCache.delete(k);
      }
    }
  }

  /** Flush one character (by entity) to the DB (serialize → row), re-attaching any quest
   *  progress the sim doesn't model so it survives the round-trip. */
  private flushEntity(accountId: number, slot: number, entity: Entity): void {
    const save = serialize(this.world.sim.world, entity);
    const quests = this.questCache.get(`${accountId}:${slot}`);
    if (quests) save.quests = quests;
    this.db.saveCharacter(accountId, slot, this.flushFrom(save));
  }

  private flush(p: ConnectedPlayer): void {
    this.flushEntity(p.accountId, p.slot, p.entity);
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

  /** Persist every character still in the world (active + orphaned) — periodic + shutdown. */
  flushAll(): void {
    for (const p of this.clients.values()) {
      try {
        this.flush(p);
      } catch {
        /* best-effort */
      }
    }
    for (const o of this.orphans.values()) {
      try {
        this.flushEntity(o.accountId, o.slot, o.entity);
      } catch {
        /* best-effort */
      }
    }
  }

  /** A connection dropped: flush the character and keep its entity alive briefly (reconnect
   *  grace) so a quick return resumes in place; the reaper destroys it after the window. */
  leave(ws: WebSocket): void {
    const p = this.clients.get(ws);
    if (!p) return;
    const k = `${p.accountId}:${p.slot}`;
    try {
      this.flush(p);
    } catch {
      /* best-effort on disconnect */
    }
    this.clients.delete(ws);
    this.active.delete(k);
    // Neutralize input so the orphaned body stands still during the grace window (its old
    // NetworkControlState may still hold "forward", which would walk it away).
    this.world.sim.world.set<ControlState>(p.entity, C.PlayerInput, createNullControlState());
    this.orphans.set(k, {
      entity: p.entity,
      accountId: p.accountId,
      slot: p.slot,
      name: p.name,
      deadAt: Date.now() + RECONNECT_GRACE_MS,
    });
    this.broadcastSystem(`${p.name} left the world.`);
  }

  close(): void {
    this.db.close();
  }

  // ── Chat & presence ──────────────────────────────────────────────────────────────────────

  /** Send the MOTD to a freshly-entered player and announce the join to everyone else. */
  announceJoin(ws: WebSocket): void {
    const p = this.clients.get(ws);
    if (!p) return;
    this.sendTo(ws, { t: 'system', text: this.config.motd });
    this.broadcastSystem(`${p.name} joined the world.`, ws);
  }

  /** Handle a chat line from a connection: throttle, run any /command, else broadcast it. */
  chat(ws: WebSocket, text: string): void {
    const p = this.clients.get(ws);
    if (!p) return;
    if (!p.chatLimiter.tryConsume(Date.now())) {
      this.sendTo(ws, { t: 'system', text: 'You are chatting too fast.' });
      return;
    }
    const t = text.trim();
    if (!t) return;
    if (t.startsWith('/')) {
      this.command(ws, p, t.slice(1));
      return;
    }
    this.sendAll({ t: 'chatLine', from: p.name, text: t });
  }

  private command(ws: WebSocket, p: ConnectedPlayer, raw: string): void {
    const sp = raw.indexOf(' ');
    const cmd = (sp === -1 ? raw : raw.slice(0, sp)).toLowerCase();
    const arg = sp === -1 ? '' : raw.slice(sp + 1).trim();
    if (cmd === 'who') {
      const names = [...this.clients.values()].map((c) => c.name).sort();
      this.sendTo(ws, { t: 'system', text: `Online (${names.length}): ${names.join(', ')}` });
    } else if (cmd === 'me' && arg) {
      this.sendAll({ t: 'chatLine', from: p.name, text: arg, me: true });
    } else if (cmd === 'admin') {
      if (!p.isAdmin) {
        this.sendTo(ws, { t: 'system', text: 'You are not an admin.' });
        return;
      }
      this.adminCommand(ws, arg);
    } else {
      this.sendTo(ws, { t: 'system', text: `Unknown command: /${cmd}` });
    }
  }

  private adminCommand(ws: WebSocket, arg: string): void {
    const sp = arg.indexOf(' ');
    const sub = (sp === -1 ? arg : arg.slice(0, sp)).toLowerCase();
    const rest = sp === -1 ? '' : arg.slice(sp + 1).trim();
    switch (sub) {
      case 'broadcast':
        if (rest) this.sendAll({ t: 'system', text: `[Broadcast] ${rest}` });
        break;
      case 'kick':
        this.adminKick(ws, rest);
        break;
      case 'ban':
        this.adminBan(ws, rest);
        break;
      case 'save':
        this.flushAll();
        this.sendTo(ws, { t: 'system', text: 'All characters saved.' });
        break;
      case 'shutdown': {
        const seconds = Math.max(0, Math.min(3600, parseInt(rest, 10) || 30));
        this.sendAll({ t: 'system', text: `Server shutting down in ${seconds}s. Please log out safely.` });
        this.onShutdown?.(seconds);
        break;
      }
      case 'who': {
        const rows = [...this.clients.values()].map((c) => `${c.name}${c.isAdmin ? '*' : ''} (acct ${c.accountId})`);
        this.sendTo(ws, { t: 'system', text: `Admin who (${rows.length}): ${rows.join(', ')}` });
        break;
      }
      default:
        this.sendTo(ws, {
          t: 'system',
          text: 'Admin: /admin broadcast <msg> | kick <name> | ban <name> | save | shutdown [s] | who',
        });
    }
  }

  private findByName(name: string): WebSocket | null {
    const lower = name.toLowerCase();
    for (const [ws, c] of this.clients) if (c.name.toLowerCase() === lower) return ws;
    return null;
  }

  private adminKick(admin: WebSocket, name: string): void {
    const target = this.findByName(name);
    if (!target) {
      this.sendTo(admin, { t: 'system', text: `No player named "${name}" is online.` });
      return;
    }
    this.sendTo(target, { t: 'system', text: 'You have been kicked by an admin.' });
    const who = this.clients.get(target)?.name ?? name;
    target.close(1000, 'kicked');
    this.broadcastSystem(`${who} was kicked.`);
  }

  private adminBan(admin: WebSocket, name: string): void {
    const target = this.findByName(name);
    if (!target) {
      this.sendTo(admin, { t: 'system', text: `No player named "${name}" is online.` });
      return;
    }
    const c = this.clients.get(target)!;
    this.db.setBanned(c.accountId, true);
    this.sendTo(target, { t: 'system', text: 'You have been banned.' });
    target.close(1000, 'banned');
    this.broadcastSystem(`${c.name} was banned.`);
  }

  private nameOf(entity: Entity): string | undefined {
    for (const p of this.clients.values()) if (p.entity === entity) return p.name;
    return undefined;
  }

  private broadcastSystem(text: string, except?: WebSocket): void {
    this.sendAll({ t: 'system', text }, except);
  }

  private sendTo(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) ws.send(encode(msg));
  }

  private sendAll(msg: ServerMessage, except?: WebSocket): void {
    const frame = encode(msg);
    for (const ws of this.clients.keys()) {
      if (ws !== except && ws.readyState === WebSocket.OPEN) ws.send(frame);
    }
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

/** Finite number within an (optional) inclusive range. Rejects NaN/±Infinity — the whole point:
 *  a NaN position would poison distance math and propagate into every client's snapshot. */
function fin(v: unknown, min = -Infinity, max = Infinity): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
}

/** Upper bounds on untrusted array sizes so an import can't bloat the DB or the world. */
const MAX_INVENTORY = 200;
const MAX_OATHSTONES = 128;
const MAX_RELICS = 512;

/**
 * Structurally AND value-validate an untrusted imported save before applySave touches the shared
 * world. This is a live trust boundary (any authenticated client can `importChar`): every scalar
 * must be finite and in a sane range, and every array bounded. Deep per-item/affix validation is
 * still deferred (save v1), but the crash/economy-breaking vectors — NaN position, absurd
 * level/gold, giant arrays — are closed here.
 */
function validateSave(raw: unknown): SaveData | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const s = raw as Partial<SaveData>;
  if (typeof s.schemaVersion !== 'number' || s.schemaVersion > SCHEMA_VERSION) return null;
  if (s.classId !== 'warrior' && s.classId !== 'hunter' && s.classId !== 'priest') return null;

  if (!s.character || typeof s.character !== 'object') return null;
  if (!fin(s.character.level, 1, LEVEL_CAP)) return null;
  if (!fin(s.character.xp, 0, 1e12)) return null;

  if (!s.position || !fin(s.position.x) || !fin(s.position.z)) return null;
  if (s.respawn != null && (typeof s.respawn !== 'object' || !fin(s.respawn.x) || !fin(s.respawn.z))) return null;

  if (!fin(s.gold, 0, 1e12)) return null;
  if (s.materials != null && !fin(s.materials, 0, 1e12)) return null;
  if (s.pity != null && !fin(s.pity, 0, 1e6)) return null;

  if (!Array.isArray(s.inventory) || s.inventory.length > MAX_INVENTORY) return null;
  if (typeof s.equipment !== 'object' || s.equipment === null) return null;
  if (s.oathstones != null && (!Array.isArray(s.oathstones) || s.oathstones.length > MAX_OATHSTONES)) return null;
  if (s.relics != null && (!Array.isArray(s.relics) || s.relics.length > MAX_RELICS)) return null;

  return raw as SaveData;
}
