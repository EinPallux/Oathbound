// Ability definitions: the data shape + shared execution constants. The actual class
// kits live in src/sim/classes.ts. Numbers are `v1` tuning targets (docs/design/CLASS_DESIGN.md).

import type { AbilityHit } from './damage';

/** How an ability picks what it hits. */
export type Targeting =
  | 'target' // single locked/soft target (melee/instant)
  | 'frontalSplash' // primary target + a small cleave around it
  | 'selfAoE' // everything around the caster
  | 'self' // no target (buff)
  | 'projectile' // single target, hit resolved by a travelling projectile
  | 'cone' // everything in a forward cone within range (instant)
  | 'dash' // self movement (leap) + optional buff
  | 'trap' // place a trap at the caster
  | 'heal' // restore HP to the caster
  | 'shield' // grant the caster an absorb shield
  | 'toggle'; // flip a sustained self-status (Atonement)

export interface AbilityDef extends AbilityHit {
  id: string;
  name: string;
  /** Resource cost. */
  cost: number;
  /** Resource generated on use (filler builds resource). */
  furyGain: number;
  cooldown: number;
  triggersGcd: boolean;
  targeting: Targeting;
  /** Max distance to a target (m). */
  range: number;
  /** Cleave/AoE radius (m). */
  radius: number;
  /** Optional debuff applied to the primary target. */
  debuff?: { id: string; durationSec: number; magnitude: number };
  /** Optional buff applied to the caster. */
  selfBuff?: { id: string; durationSec: number; magnitude: number };
  /** Projectile speed (m/s) for `projectile` targeting. */
  projectileSpeed?: number;
  /** Half-angle (deg) for `cone` targeting. */
  coneHalfDeg?: number;
  /** Leap distance (m) for `dash` targeting. */
  dashDistance?: number;
  /** Trap parameters for `trap` targeting. */
  trapRadius?: number;
  trapRootSec?: number;
  trapTtl?: number;
  /** Cast time (s) — the ability channels a bar before it resolves; moving cancels. */
  castTime?: number;
  /** Self-heal for `heal` targeting (and the self-heal rider on Holy Nova). */
  heal?: { base: number; coeff: number };
  /** Absorb shield for `shield` targeting (amount = coeff*primaryStat). */
  shield?: { coeff: number; durationSec: number };
  /** Status to flip for `toggle` targeting (Atonement). */
  toggle?: { id: string; magnitude: number };
}

/** Global cooldown (s). `v1` 1.0s; reduced by Haste toward a 0.7s floor. */
export const GCD = 1.0;
export const GCD_FLOOR = 0.7;

/** Input buffer window (s). */
export const INPUT_BUFFER = 0.25;
/** Soft-target cone, full angle (deg). */
export const TARGET_CONE_DEG = 100;
/** Max range (m) for Tab acquisition. */
export const TAB_RANGE = 40;

/** Effective GCD after Haste, floored. */
export function effectiveGcd(haste: number): number {
  return Math.max(GCD_FLOOR, GCD * (1 - haste));
}
