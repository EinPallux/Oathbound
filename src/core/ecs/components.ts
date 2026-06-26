// Component registry. Components are plain data keyed by a string name.
// Phase 0.0.3 introduced movement; 0.0.4 "First Contact" adds combat components.

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
  Dummy: 'dummy',
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

// ── Combat (0.0.4 "First Contact") ──────────────────────────────────────────

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

/** Target-dummy behaviour: auto-resets to full HP a short time after dying. */
export interface Dummy {
  respawnDelay: number;
  deadFor: number;
  dead: boolean;
}
