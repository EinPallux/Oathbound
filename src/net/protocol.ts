// The Oathbound Online wire protocol — the single, isomorphic definition of every message
// that crosses between client and server. Imported by BOTH the browser client and the Node
// server, so it must stay free of three.js, the DOM, and Node APIs (only `zod` is allowed).
// Every message is validated with zod on receipt in both directions: a hostile or buggy peer
// can only ever send well-formed messages, which is the foundation of the server-authoritative
// security model (docs/technical/MMO_ARCHITECTURE.md §7).
//
// M0 scope: just the handshake (hello → welcome) and a latency ping (ping → pong). Later
// phases extend the unions with `input`, `snapshot`, `events`, `cmd`, `chat`, … — additively.

import { z } from 'zod';

/** Bumped on any breaking change to the message shapes. Client & server must agree. */
export const PROTOCOL_VERSION = 1;

/** The three playable classes. */
export const ClassIdSchema = z.enum(['warrior', 'hunter', 'priest']);

// ── Client → Server ────────────────────────────────────────────────────────────────────────

/** Create a new account. `joinPassword` is required only if the server is locked (friends-only). */
export const RegisterMessage = z.object({
  t: z.literal('register'),
  protocol: z.number().int(),
  username: z.string().min(3).max(24),
  password: z.string().min(6).max(200),
  joinPassword: z.string().optional(),
});

/** Log in to an existing account. */
export const LoginMessage = z.object({
  t: z.literal('login'),
  protocol: z.number().int(),
  username: z.string().min(1).max(24),
  password: z.string().min(1).max(200),
});

/** Resume a session with a previously-issued token (reconnect without re-entering the password). */
export const ResumeMessage = z.object({
  t: z.literal('resume'),
  protocol: z.number().int(),
  token: z.string().min(1).max(200),
});

/** Create a fresh character in a slot and enter the world as it. */
export const CreateCharMessage = z.object({
  t: z.literal('createChar'),
  slot: z.number().int().min(0).max(2),
  name: z.string().min(2).max(20),
  classId: ClassIdSchema,
});

/** Enter the world as an existing character. */
export const SelectCharMessage = z.object({
  t: z.literal('selectChar'),
  slot: z.number().int().min(0).max(2),
});

/** Delete a character slot. */
export const DeleteCharMessage = z.object({
  t: z.literal('deleteChar'),
  slot: z.number().int().min(0).max(2),
});

/** One-time import of an offline (IndexedDB) save into a slot, then enter the world as it. */
export const ImportCharMessage = z.object({
  t: z.literal('importChar'),
  slot: z.number().int().min(0).max(2),
  name: z.string().min(2).max(20),
  /** The offline SaveData JSON — structurally validated server-side before applying. */
  save: z.unknown(),
});

/** A chat line from the client. `/who`, `/me …` etc. are handled server-side. */
export const ChatMessage = z.object({
  t: z.literal('chat'),
  text: z.string().min(1).max(200),
});

/** Equip an inventory item (by uid) — server validates ownership + applies. */
export const EquipMessage = z.object({ t: z.literal('equip'), uid: z.string().min(1).max(64) });
/** Salvage one inventory item (by uid). */
export const SalvageMessage = z.object({ t: z.literal('salvage'), uid: z.string().min(1).max(64) });
/** Salvage all Common items in the bag. */
export const SalvageCommonsMessage = z.object({ t: z.literal('salvageCommons') });
/** Sell one item to the vendor (must be near it). */
export const SellMessage = z.object({ t: z.literal('sell'), uid: z.string().min(1).max(64) });
/** Sell all Common items to the vendor. */
export const SellCommonsMessage = z.object({ t: z.literal('sellCommons') });
/** Reinforce one item (spends gold + whetstones). */
export const ReinforceMessage = z.object({ t: z.literal('reinforce'), uid: z.string().min(1).max(64) });
/** Pick a talent-node option (build choice). */
export const TalentMessage = z.object({
  t: z.literal('talent'),
  nodeId: z.string().min(1).max(48),
  option: z.number().int().min(0).max(3),
});
/** Fast-travel to an activated Oathstone (by its stable id). */
export const TravelMessage = z.object({ t: z.literal('travel'), stoneId: z.string().min(1).max(48) });
/** Accept a quest offered by an NPC (by quest id). */
export const QuestAcceptMessage = z.object({ t: z.literal('questAccept'), id: z.string().min(1).max(48) });

/** Latency probe: `time` is the client's clock (ms) and is echoed back untouched. */
export const PingMessage = z.object({
  t: z.literal('ping'),
  time: z.number(),
});

/**
 * Per-tick player intent — the serialized movement subset of ControlState. `seq` is a
 * monotonic counter the server echoes back in snapshots (informational in M1; the basis for
 * M4 prediction/reconciliation). M1 is movement-only; ability/interact/target intents join in
 * later phases. `yaw` rides here because movement is camera-relative (the server needs it).
 */
export const InputMessage = z.object({
  t: z.literal('input'),
  seq: z.number().int().nonnegative(),
  forward: z.boolean(),
  back: z.boolean(),
  left: z.boolean(),
  right: z.boolean(),
  yaw: z.number().finite(), // reject NaN/±Infinity — would poison the movement integration
  jump: z.boolean(),
  /** Queued ability slot (0-based) this tick, or null/absent. Bounded to a sane hotbar range. */
  ability: z.number().int().min(0).max(9).nullable().optional(),
  /** Interact pressed (F) — server-side loot pickup / vendor. */
  interact: z.boolean().optional(),
  /** Cycle target pressed (Tab). */
  cycle: z.boolean().optional(),
});

export type InputMessage = z.infer<typeof InputMessage>;

export const ClientMessage = z.discriminatedUnion('t', [
  RegisterMessage,
  LoginMessage,
  ResumeMessage,
  CreateCharMessage,
  SelectCharMessage,
  DeleteCharMessage,
  ImportCharMessage,
  ChatMessage,
  PingMessage,
  InputMessage,
  EquipMessage,
  SalvageMessage,
  SalvageCommonsMessage,
  SellMessage,
  SellCommonsMessage,
  ReinforceMessage,
  TalentMessage,
  TravelMessage,
  QuestAcceptMessage,
]);
export type ClientMessage = z.infer<typeof ClientMessage>;

// ── Server → Client ──────────────────────────────────────────────────────────────────────

/** Accept a hello: hand the client its player entity id and the world/timing parameters. */
export const WelcomeMessage = z.object({
  t: z.literal('welcome'),
  protocol: z.number().int(),
  entityId: z.number().int(),
  map: z.string(),
  tick: z.number().int(),
  tickHz: z.number(),
  snapshotHz: z.number(),
  players: z.number().int(),
});

/** Answer a ping: echo the client `time` and include the server's current tick. */
export const PongMessage = z.object({
  t: z.literal('pong'),
  time: z.number(),
  serverTick: z.number().int(),
});

/** Authentication succeeded: a resumable session token + the account's username. */
export const AuthOkMessage = z.object({
  t: z.literal('authOk'),
  token: z.string(),
  username: z.string(),
});

/** A character roster entry. */
export const CharSummary = z.object({
  slot: z.number().int(),
  name: z.string(),
  classId: z.string(),
  level: z.number().int(),
});
export type CharSummary = z.infer<typeof CharSummary>;

/** The account's characters (sent after auth and after any create/delete). */
export const CharListMessage = z.object({
  t: z.literal('charList'),
  chars: z.array(CharSummary),
});

/** A chat line to display: `from` is the sender's character name; `me` marks a /me emote. */
export const ChatLineMessage = z.object({
  t: z.literal('chatLine'),
  from: z.string(),
  text: z.string(),
  me: z.boolean().optional(),
});

/** A server/system line (joins, leaves, level-ups, boss kills, MOTD, /who results). */
export const SystemMessage = z.object({
  t: z.literal('system'),
  text: z.string(),
});

/** The local player's bag + equipped gear (sent on enter + whenever they change). Items are
 *  passed through as-is — the client only displays them (the server is authoritative). */
export const InventoryMessage = z.object({
  t: z.literal('inventory'),
  items: z.array(z.unknown()),
  equipment: z.record(z.string(), z.unknown()),
  gold: z.number(),
  materials: z.number(),
  capacity: z.number(),
});

/** Reject/inform: a coded error (e.g. bad protocol version, malformed message). */
export const ErrorMessage = z.object({
  t: z.literal('error'),
  code: z.string(),
  message: z.string(),
});

/**
 * One replicated entity in a snapshot. Short keys because a snapshot may carry many of these.
 * `k` = kind (player | enemy | boss | vendor | oathstone | loot); `st` = an optional state tag
 * (e.g. an enemy's 'dead'); hp/mhp present only for entities that have Health.
 */
export const SnapshotEntity = z.object({
  id: z.number().int(),
  k: z.string(),
  x: z.number(),
  z: z.number(),
  yaw: z.number(),
  hp: z.number().optional(),
  mhp: z.number().optional(),
  st: z.string().optional(),
  /** Display name (players → character name; enemies/bosses/vendors/oathstones → their name). */
  name: z.string().optional(),
  /** Player class id — picks the character model + weapon. */
  cls: z.string().optional(),
  /** Player level (for the overhead nameplate). */
  lvl: z.number().int().optional(),
  /** Enemy family + archetype — pick the low-poly enemy model. */
  fam: z.string().optional(),
  arch: z.string().optional(),
});
export type SnapshotEntity = z.infer<typeof SnapshotEntity>;

/** One active status effect on the local player (for buff/debuff display). */
export const SelfStatus = z.object({ id: z.string(), r: z.number() });

/** The local player's authoritative HUD state, sent per-client inside each snapshot. Lets the
 *  online client drive the full offline HUD (bars, hotbar cooldowns, buffs, target frame) without
 *  the client re-simulating combat. */
export const SelfState = z.object({
  cls: ClassIdSchema,
  /** Talent choices (choice-node id → option index), for the correct ability kit. */
  ch: z.record(z.string(), z.number()).optional(),
  hp: z.number(),
  mhp: z.number(),
  res: z.number(),
  mres: z.number(),
  lvl: z.number().int(),
  xp: z.number(),
  /** XP to next level, or null at the cap (Infinity doesn't survive JSON). */
  xpNext: z.number().nullable(),
  /** Global-cooldown remaining (s) + per-ability cooldowns (s), indexed like the kit. */
  gcd: z.number(),
  cds: z.array(z.number()),
  st: z.array(SelfStatus),
  inC: z.boolean(),
  shield: z.number(),
  gold: z.number(),
  /** Active cast (ability index + seconds left), or null. Client derives the bar from its kit. */
  cast: z.object({ idx: z.number().int(), remaining: z.number() }).nullable(),
  /** "Call Mount" summon channel remaining (s); 0 = not summoning. */
  mount: z.number(),
  /** The server's authoritative target for this player (frame data), or null. */
  tgt: z.object({ id: z.number().int(), name: z.string(), lvl: z.number().int(), hp: z.number(), mhp: z.number() }).nullable(),
});
export type SelfState = z.infer<typeof SelfState>;

/**
 * A world snapshot: the authoritative state of the replicated entities at server `tick`. `ack`
 * is the last input `seq` the server had applied for this client (informational in M1; used for
 * reconciliation in M4). The client interpolates between successive snapshots.
 */
/** A floating-combat-text event (damage/heal) at a world position, for the receiving client. */
export const FxEvent = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
  amount: z.number(),
  crit: z.boolean(),
  heal: z.boolean(),
});
export type FxEvent = z.infer<typeof FxEvent>;

export const SnapshotMessage = z.object({
  t: z.literal('snapshot'),
  tick: z.number().int(),
  ack: z.number().int(),
  ents: z.array(SnapshotEntity),
  /** The receiving client's own HUD state (absent only in pathological cases). */
  self: SelfState.optional(),
  /** Combat text (damage/heal) involving this client since the last snapshot. */
  fx: z.array(FxEvent).optional(),
});

export type SnapshotMessage = z.infer<typeof SnapshotMessage>;

export const ServerMessage = z.discriminatedUnion('t', [
  WelcomeMessage,
  PongMessage,
  ErrorMessage,
  SnapshotMessage,
  AuthOkMessage,
  CharListMessage,
  ChatLineMessage,
  SystemMessage,
  InventoryMessage,
]);
export type ServerMessage = z.infer<typeof ServerMessage>;

// ── (de)serialization helpers ────────────────────────────────────────────────────────────

/** Serialize any protocol message to a string frame. */
export function encode(msg: ClientMessage | ServerMessage): string {
  return JSON.stringify(msg);
}

export type DecodeResult<T> = { ok: true; msg: T } | { ok: false; error: string };

function decode<T>(schema: z.ZodType<T>, raw: string): DecodeResult<T> {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'invalid JSON' };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  return { ok: true, msg: parsed.data };
}

/** Parse + validate a frame as a client→server message (used by the server). */
export function decodeClientMessage(raw: string): DecodeResult<ClientMessage> {
  return decode(ClientMessage, raw);
}

/** Parse + validate a frame as a server→client message (used by the client). */
export function decodeServerMessage(raw: string): DecodeResult<ServerMessage> {
  return decode(ServerMessage, raw);
}
