// Component registry. Components are plain data keyed by a string name.
// 0.0.3 added movement; 0.0.4 combat; 0.1.0 "Vertical Slice" adds the full grind
// loop (resource, statuses, enemy AI, progression, loot, inventory/equipment).

export const C = {
  Transform: 'transform',
  Velocity: 'velocity',
  Character: 'character',
  PlayerControlled: 'playerControlled',
  // Combat (0.0.4)
  Health: 'health',
  Offense: 'offense',
  Defense: 'defense',
  AbilityState: 'abilityState',
  Target: 'target',
  Targetable: 'targetable',
  EnemyInfo: 'enemyInfo',
  // Vertical slice (0.1.0)
  Resource: 'resource',
  Statuses: 'statuses',
  Enemy: 'enemy',
  Progression: 'progression',
  Inventory: 'inventory',
  Equipment: 'equipment',
  LootDrop: 'lootDrop',
  CombatState: 'combatState',
  PlayerClass: 'playerClass',
  Trap: 'trap',
  Shield: 'shield',
  CastState: 'castState',
  Oathstone: 'oathstone',
  Vendor: 'vendor',
  Respawn: 'respawn',
  GroundAoe: 'groundAoe',
  LootLuck: 'lootLuck',
  Boss: 'boss',
} as const;

/**
 * Position + yaw, with the previous sim values retained so the renderer can
 * interpolate between fixed simulation steps.
 */
export interface Transform {
  x: number;
  y: number;
  z: number;
  /** Facing angle in radians (rotation about +Y). */
  yaw: number;
  prevX: number;
  prevY: number;
  prevZ: number;
  prevYaw: number;
}

export interface Velocity {
  x: number;
  y: number;
  z: number;
}

/** Kinematic capsule controller parameters and runtime state. */
export interface Character {
  /** Horizontal collision radius (m). */
  radius: number;
  /** Half the capsule height (m); the Transform.y is the capsule centre. */
  halfHeight: number;
  runSpeed: number;
  sprintSpeed: number;
  jumpSpeed: number;
  grounded: boolean;
}

/** Marker component: this entity is driven by player input. */
export type PlayerControlled = true;

// ── Combat ──────────────────────────────────────────────────────────────────

/** Damage school. `physical` is mitigated by armor; the rest by typed resists. */
export type DamageType = 'physical' | 'fire' | 'frost' | 'blight' | 'holy';

/** A pool of hit points. */
export interface Health {
  current: number;
  max: number;
}

/** Offensive stats for the attacker side of the canonical damage formula. */
export interface Offense {
  /** Class main stat (STR/DEX/SPR); a single generic value pre-classes. */
  primaryStat: number;
  /** Attacker level — scales the armor/resist diminishing-returns constant. */
  level: number;
  /** Crit probability in [0, 1]. */
  critChance: number;
  /** Crit damage multiplier (base 1.5 `v1`). */
  critMult: number;
  /** Fraction of damage dealt returned to the attacker as HP. */
  leech: number;
  /** GCD/cast reduction fraction in [0, ~0.3]. */
  haste: number;
  /** Flat bonus to healing done (+Healing affix). */
  healPower: number;
}

/** Defensive stats for the defender side of the canonical damage formula. */
export interface Defense {
  /** Physical mitigation source. */
  armor: number;
  /** Typed mitigation sources. */
  resist: { fire: number; frost: number; blight: number };
  /** Per-school vulnerability multipliers (e.g. undead +25% holy). Default 1. */
  weakness: Partial<Record<DamageType, number>>;
}

/** Per-entity ability runtime: the global cooldown, per-ability cooldowns, and a
 *  short input buffer so the next press fires the instant the GCD frees. */
export interface AbilityState {
  /** Seconds left on the global cooldown. */
  gcdRemaining: number;
  /** Seconds left per ability, indexed like the ability list. */
  cooldowns: number[];
  /** Buffered ability index, or -1 if none is queued. */
  bufferedIndex: number;
  /** Seconds left for the buffered press to stay valid. */
  bufferRemaining: number;
}

/** The entity's current locked target (soft tab-target). */
export interface Target {
  entity: number | null;
}

/** Marker: this entity is a valid hostile target. */
export type Targetable = true;

/** Display info for nameplates / target frame. */
export interface EnemyInfo {
  name: string;
  level: number;
}

/** A class resource pool (Warrior Fury in the slice). */
export interface Resource {
  current: number;
  max: number;
}

/** A timed buff/debuff instance. `id` keys behaviour; `magnitude` is effect-specific. */
export interface StatusInstance {
  id: string;
  remaining: number;
  magnitude: number;
}

/** Active timed effects on an entity. */
export interface Statuses {
  list: StatusInstance[];
}

/** Combat engagement tracking, for recovery/sprint gating. */
export interface CombatState {
  inCombat: boolean;
  /** Seconds since the last combat event (drives the in→out transition). */
  sinceEventSec: number;
}

// ── Enemy AI (melee bruiser) ────────────────────────────────────────────────

export type EnemyState = 'idle' | 'engage' | 'attack' | 'leash' | 'dead';

export interface Enemy {
  archetype: 'melee_bruiser' | 'ranged_skirmisher' | 'caster' | 'support' | 'pack_leader';
  family: string;
  tier: 'standard' | 'elite' | 'rare' | 'boss';
  state: EnemyState;
  /** Spawn point — leash + reset returns here. */
  homeX: number;
  homeZ: number;
  aggroRadius: number;
  leashRange: number;
  socialRange: number;
  moveSpeed: number;
  attackRange: number;
  /** Seconds between swings. */
  attackCooldown: number;
  attackTimer: number;
  /** Telegraph wind-up before a swing lands (s). */
  windup: number;
  /** Remaining wind-up; <0 means not currently winding up. */
  windupTimer: number;
  attackBase: number;
  attackCoeff: number;
  /** Damage school of the enemy's attack (casters use typed damage). */
  attackType: DamageType;
  /** Same-level standard XP grant. */
  xpBase: number;
  goldMin: number;
  goldMax: number;
  lootTable: string;
  respawnDelay: number;
  deadFor: number;
  /** Brief invulnerability while returning from a leash. */
  invulnTimer: number;
  /** Idle wander (lazy-initialised by enemy-ai): a roam target near home + a timer. */
  wanderTimer?: number;
  wanderTx?: number;
  wanderTz?: number;
}

/**
 * World-boss state, layered on top of an `Enemy` (the boss is a melee bruiser for
 * locomotion/basic swings; this drives the fight's *escalation*). The boss-ai system
 * derives the current phase from HP and, on a per-phase cadence, telegraphs a heavy
 * ground attack (a `GroundAoe` with `hitsPlayer`). Pure data — see boss-ai.ts.
 */
export interface Boss {
  /** Stable boss identity (loot table key + display). */
  bossId: string;
  /** Current phase (0-based), derived from HP vs `phaseThresholds`. */
  phase: number;
  /** Descending HP fractions that advance phases (e.g. [0.66, 0.33] ⇒ three phases). */
  phaseThresholds: number[];
  /** Seconds between heavy attacks, indexed by phase (length = phaseThresholds.length + 1). */
  heavyCadence: number[];
  /** Countdown to the next heavy attack (s). */
  heavyTimer: number;
  /** Telegraph lead-in before the heavy lands (s) — the window to step out. */
  heavyTelegraph: number;
  heavyRadius: number;
  heavyBase: number;
  heavyCoeff: number;
  heavyType: DamageType;
}

// ── Progression ─────────────────────────────────────────────────────────────

export interface Progression {
  level: number;
  xp: number;
  xpToNext: number;
}

// ── Items, inventory & equipment ────────────────────────────────────────────

export type EquipSlot =
  | 'weapon'
  | 'offhand'
  | 'head'
  | 'chest'
  | 'hands'
  | 'legs'
  | 'feet'
  | 'amulet'
  | 'ring1'
  | 'ring2';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export type PrimaryStatId = 'STR' | 'DEX' | 'SPR' | 'VIT';

/** Playable classes. */
export type ClassId = 'warrior' | 'hunter' | 'priest';

/** Which class the player is. Drives kit, resource, and primary stat. */
export interface PlayerClass {
  id: ClassId;
  /** Talent picks: choice-node id → selected option index (0/1). Absent ⇒ option 0. */
  choices?: Record<string, number>;
}

/** A waypoint shrine: activates on first visit, then serves as a respawn + fast-travel node. */
export interface Oathstone {
  id: string;
  name: string;
  activated: boolean;
}

/** A vendor you can sell to (interact with F). */
export interface Vendor {
  name: string;
}

/** The player's bound respawn point (set by the last Oathstone visited). */
export interface Respawn {
  x: number;
  z: number;
}

/** A persistent ground hazard. Two uses share this primitive: the Lv 16 player tool
 *  (ticks damage to *enemies* in radius), and a boss heavy attack (`hitsPlayer`, a
 *  single telegraphed tick to the *player*). Ticks every `tickEvery` s for its life. */
export interface GroundAoe {
  source: number;
  radius: number;
  ttl: number;
  tickEvery: number;
  tickTimer: number;
  base: number;
  coeff: number;
  damageType: DamageType;
  /** Boss heavy attack: damage the player instead of enemies. Default false. */
  hitsPlayer?: boolean;
  /** Telegraph lead-in (s) for the render fill animation; 0/undefined = a steady zone. */
  telegraph?: number;
}

/** A placed trap (Hunter Snare Trap): roots the first enemy that enters, then expires. */
export interface Trap {
  source: number;
  radius: number;
  rootDuration: number;
  ttl: number;
  base: number;
  coeff: number;
}

export type AffixId =
  | 'crit'
  | 'leech'
  | 'haste'
  | 'armor'
  | 'vit'
  | 'healing'
  | 'resistFire'
  | 'resistFrost'
  | 'resistBlight';

/** A temporary absorb pool that soaks damage before HP (Priest Aegis). */
export interface Shield {
  amount: number;
  remaining: number;
}

/** An in-progress cast (cast-time abilities). Cleared on finish, move, or interrupt. */
export interface CastState {
  /** Index into the caster's class ability list. */
  index: number;
  remaining: number;
  target: number | null;
}

export interface Affix {
  id: AffixId;
  value: number;
}

export interface Item {
  /** Unique instance id (save-stable). */
  uid: string;
  name: string;
  slot: EquipSlot;
  rarity: Rarity;
  ilvl: number;
  primary: { stat: PrimaryStatId; value: number };
  /** Base armor contributed by armor/weapon slots. */
  armor: number;
  affixes: Affix[];
  /** Rough comparison power (for inventory deltas). */
  score: number;
  /** Locked items can't be salvaged or sold. */
  locked: boolean;
  /** Reinforcement steps applied (0..MAX_REINFORCE); boosts effective item level. */
  reinforced?: number;
}

export interface Inventory {
  items: Item[];
  gold: number;
  /** Whetstones (salvage material wallet — not an item, per ITEMS_AND_EQUIPMENT). */
  materials: number;
  capacity: number;
}

export interface Equipment {
  slots: Partial<Record<EquipSlot, Item>>;
}

/** Bad-luck protection state: consecutive kills without a rare-or-better drop.
 *  Raises the rare+ chance as it climbs, and resets to 0 when one finally drops. */
export interface LootLuck {
  pity: number;
}

/** A loot drop in the world (corpse pickup). Owner-eligibility is modelled now so
 *  the future multiplayer transition to instanced loot is a data change. */
export interface LootDrop {
  item: Item | null;
  gold: number;
  owner: number;
  /** Seconds before an uncollected drop despawns (grace period). */
  ttl: number;
}
