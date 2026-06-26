// Data-driven ability definitions for 0.0.4 "First Contact": one basic attack and
// one stronger ability, both on the global cooldown. Pre-classes there is no
// resource cost yet (added with the Warrior kit in 0.1.x). Numbers are `v1` tuning
// targets. See docs/design/COMBAT_DESIGN.md#4-ability-execution.

import type { AbilityHit } from './damage';

export interface AbilityDef extends AbilityHit {
  id: string;
  name: string;
  /** Max distance to a target (m). Generous pre-class melee range (`v1`). */
  range: number;
  /** Individual cooldown (s), independent of the GCD. */
  cooldown: number;
  /** Whether using it triggers the global cooldown. */
  triggersGcd: boolean;
}

/** Global cooldown (s). `v1` 1.0s; reduced by Haste to a 0.7s floor in a later phase. */
export const GCD = 1.0;

/** Input buffer window (s): a press this close to the GCD ending still fires. */
export const INPUT_BUFFER = 0.25;

/** Soft-target cone, full angle (deg). */
export const TARGET_CONE_DEG = 100;

/** Max range (m) for Tab acquisition. */
export const TAB_RANGE = 40;

export const ABILITIES: readonly AbilityDef[] = [
  {
    id: 'strike',
    name: 'Strike',
    base: 8,
    coeff: 1.0,
    damageType: 'physical',
    range: 8,
    cooldown: 0,
    triggersGcd: true,
  },
  {
    id: 'heavy-strike',
    name: 'Heavy Strike',
    base: 18,
    coeff: 1.6,
    damageType: 'physical',
    range: 8,
    cooldown: 4,
    triggersGcd: true,
  },
];
