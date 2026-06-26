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
  archetype: 'melee_bruiser' | 'ranged_skirmisher' | 'caster';
  family: string;
  tier: 'standard';
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

export type Rarity = 'common' | 'uncommon';

export type PrimaryStatId = 'STR' | 'DEX' | 'SPR' | 'VIT';

/** Playable classes. */
export type ClassId = 'warrior' | 'hunter' | 'priest';

/** Which class the player is. Drives kit, resource, and primary stat. */
export interface PlayerClass {
  id: ClassId;
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

export type AffixId = 'crit' | 'leech' | 'haste' | 'armor' | 'vit' | 'healing';

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

/** A loot drop in the world (corpse pickup). Owner-eligibility is modelled now so
 *  the future multiplayer transition to instanced loot is a data change. */
export interface LootDrop {
  item: Item | null;
  gold: number;
  owner: number;
  /** Seconds before an uncollected drop despawns (grace period). */
  ttl: number;
}
