// Warrior early kit (Lv 1–5) for the vertical slice — filler, spender, pack answer,
// and a survival button. Data-driven; numbers are `v1` tuning targets from
// docs/design/CLASS_DESIGN.md. No class resource costs existed pre-0.1.0; Fury arrives
// here.

import type { AbilityHit } from './damage';
import { Status } from './statuses';

/** How an ability picks what it hits. */
export type Targeting =
  | 'target' // single locked/soft target
  | 'frontalSplash' // primary target + a small cleave around it
  | 'selfAoE' // everything around the caster
  | 'self'; // no target (buff)

export interface AbilityDef extends AbilityHit {
  id: string;
  name: string;
  /** Fury cost. */
  cost: number;
  /** Fury generated on use (filler builds resource). */
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

export const ABILITIES: readonly AbilityDef[] = [
  {
    id: 'cleaving-strike',
    name: 'Cleaving Strike',
    base: 4,
    coeff: 0.7,
    damageType: 'physical',
    cost: 0,
    furyGain: 12,
    cooldown: 0,
    triggersGcd: true,
    targeting: 'frontalSplash',
    range: 6,
    radius: 2.5,
  },
  {
    id: 'sunder',
    name: 'Sunder',
    base: 6,
    coeff: 1.6,
    damageType: 'physical',
    cost: 30,
    furyGain: 0,
    cooldown: 0,
    triggersGcd: true,
    targeting: 'target',
    range: 6,
    radius: 0,
    debuff: { id: Status.ArmorBreak, durationSec: 8, magnitude: 12 },
  },
  {
    id: 'whirl',
    name: 'Whirl',
    base: 5,
    coeff: 0.9,
    damageType: 'physical',
    cost: 35,
    furyGain: 0,
    cooldown: 6,
    triggersGcd: true,
    targeting: 'selfAoE',
    range: 0,
    radius: 4,
  },
  {
    id: 'bulwark',
    name: 'Bulwark',
    base: 0,
    coeff: 0,
    damageType: 'physical',
    cost: 0,
    furyGain: 0,
    cooldown: 18,
    triggersGcd: false,
    targeting: 'self',
    range: 0,
    radius: 0,
    selfBuff: { id: Status.Bulwark, durationSec: 4, magnitude: 0.5 },
  },
];

/** Effective GCD after Haste, floored. */
export function effectiveGcd(haste: number): number {
  return Math.max(GCD_FLOOR, GCD * (1 - haste));
}
