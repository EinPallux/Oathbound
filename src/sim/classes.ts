// Data-driven class definitions: the Warrior (melee/Fury) and Hunter (ranged/Focus)
// kits, their primary stat, and their resource behaviour. Adding the Priest in 0.2.1
// is a data change here. Numbers are `v1` tuning targets (docs/design/CLASS_DESIGN.md).

import type { ClassId, PrimaryStatId } from '../core/ecs/components';
import type { AbilityDef } from './combat/abilities';
import { Status } from './combat/statuses';

export interface ResourceConfig {
  name: string;
  max: number;
  /** Regenerated every second, always. */
  regenPerSec: number;
  /** Added per second while in combat (e.g. Warrior Battle Hardened). */
  inCombatRegen: number;
  /** Lost per second while out of combat (e.g. Fury decay). */
  decayOocPerSec: number;
  /** Whether the pool starts full (Focus) or empty (Fury). */
  startsFull: boolean;
}

export interface ClassDef {
  id: ClassId;
  name: string;
  primaryStatId: PrimaryStatId;
  resource: ResourceConfig;
  abilities: readonly AbilityDef[];
}

const WARRIOR_ABILITIES: AbilityDef[] = [
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

const HUNTER_ABILITIES: AbilityDef[] = [
  {
    id: 'quick-shot',
    name: 'Quick Shot',
    base: 3,
    coeff: 0.7,
    damageType: 'physical',
    cost: 0,
    furyGain: 0,
    cooldown: 0,
    triggersGcd: true,
    targeting: 'projectile',
    range: 25,
    radius: 0,
    projectileSpeed: 30,
  },
  {
    id: 'piercing-arrow',
    name: 'Piercing Arrow',
    base: 5,
    coeff: 1.1,
    damageType: 'physical',
    cost: 35,
    furyGain: 0,
    cooldown: 0,
    triggersGcd: true,
    targeting: 'projectile',
    range: 25,
    radius: 0,
    projectileSpeed: 34,
  },
  {
    id: 'volley',
    name: 'Volley',
    base: 5,
    coeff: 0.8,
    damageType: 'physical',
    cost: 40,
    furyGain: 0,
    cooldown: 6,
    triggersGcd: true,
    targeting: 'cone',
    range: 16,
    radius: 0,
    coneHalfDeg: 30,
  },
  {
    id: 'disengage',
    name: 'Disengage',
    base: 0,
    coeff: 0,
    damageType: 'physical',
    cost: 0,
    furyGain: 0,
    cooldown: 10,
    triggersGcd: false,
    targeting: 'dash',
    range: 0,
    radius: 0,
    dashDistance: 6,
    selfBuff: { id: Status.Fleet, durationSec: 2, magnitude: 0.3 },
  },
  {
    id: 'snare-trap',
    name: 'Snare Trap',
    base: 4,
    coeff: 0.5,
    damageType: 'physical',
    cost: 20,
    furyGain: 0,
    cooldown: 12,
    triggersGcd: true,
    targeting: 'trap',
    range: 0,
    radius: 0,
    trapRadius: 2.2,
    trapRootSec: 3,
    trapTtl: 30,
  },
];

const CLASSES: Record<ClassId, ClassDef> = {
  warrior: {
    id: 'warrior',
    name: 'Warrior',
    primaryStatId: 'STR',
    resource: {
      name: 'Fury',
      max: 100,
      regenPerSec: 0,
      inCombatRegen: 3,
      decayOocPerSec: 6,
      startsFull: false,
    },
    abilities: WARRIOR_ABILITIES,
  },
  hunter: {
    id: 'hunter',
    name: 'Hunter',
    primaryStatId: 'DEX',
    resource: {
      name: 'Focus',
      max: 100,
      regenPerSec: 10,
      inCombatRegen: 0,
      decayOocPerSec: 0,
      startsFull: true,
    },
    abilities: HUNTER_ABILITIES,
  },
};

export function getClass(id: ClassId): ClassDef {
  return CLASSES[id];
}
