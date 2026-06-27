// Level curves, XP, the con (level-difference) system, and derived-stat computation.
// Pure: no Three.js/DOM. Canonical numbers from docs/design/PROGRESSION_AND_XP.md
// (all `v1` tuning targets).

import type { Equipment, PrimaryStatId } from '../core/ecs/components';

export const LEVEL_CAP = 30;
export const BASE_CRIT = 0.1;
export const CRIT_MULT = 1.5;
export const FURY_MAX = 100;
/** HP granted per point of VIT. */
export const VIT_HP = 4;

export function roundTo10(n: number): number {
  return Math.round(n / 10) * 10;
}

/** XP needed to advance from `level` to the next. `Infinity` at the cap. */
export function xpToNext(level: number): number {
  if (level >= LEVEL_CAP) return Infinity;
  return roundTo10(50 * Math.pow(level, 1.7));
}

/** Base XP a same-level standard enemy grants. */
export function xpPerKill(level: number): number {
  return Math.round(8 + 4.2 * level);
}

export function primaryStatForLevel(level: number): number {
  return 10 + 3 * (level - 1);
}

export function maxHpForLevel(level: number): number {
  return 120 + 30 * (level - 1);
}

export type ConColor = 'gray' | 'green' | 'white' | 'yellow' | 'orange' | 'red';

/** Difficulty colour from the level difference (drives nameplate + XP). */
export function conColor(playerLevel: number, enemyLevel: number): ConColor {
  const d = enemyLevel - playerLevel;
  if (d <= -6) return 'gray';
  if (d <= -2) return 'green';
  if (d <= 1) return 'white';
  if (d <= 3) return 'yellow';
  if (d <= 5) return 'orange';
  return 'red';
}

/** XP multiplier from the con table (anti-farm gray rule; capped at the top). */
export function conXpMultiplier(playerLevel: number, enemyLevel: number): number {
  const d = enemyLevel - playerLevel;
  if (d <= -6) return 0.05;
  if (d <= -2) return 0.7;
  if (d <= 1) return 1.0;
  if (d <= 3) return 1.2;
  return 1.3;
}

export interface DerivedStats {
  primaryStat: number;
  maxHp: number;
  armor: number;
  critChance: number;
  leech: number;
  haste: number;
  /** Flat bonus to healing done (+Healing affix). */
  healPower: number;
  /** Typed mitigation from gear (resist affixes). */
  resist: { fire: number; frost: number; blight: number };
}

/** Combine level base stats with equipment into the player's derived combat stats.
 *  `primaryStatId` is the class's main stat (STR Warrior / DEX Hunter); gear that
 *  rolls the matching primary adds to it, VIT always adds HP. */
export function deriveStats(
  level: number,
  equipment: Equipment,
  primaryStatId: PrimaryStatId = 'STR',
): DerivedStats {
  let primary = primaryStatForLevel(level);
  let vit = 0;
  let armor = 0;
  let crit = BASE_CRIT;
  let leech = 0;
  let haste = 0;
  let healPower = 0;
  let resistFire = 0;
  let resistBlight = 0;

  for (const item of Object.values(equipment.slots)) {
    if (!item) continue;
    if (item.primary.stat === 'VIT') vit += item.primary.value;
    else if (item.primary.stat === primaryStatId) primary += item.primary.value;
    armor += item.armor;
    for (const a of item.affixes) {
      switch (a.id) {
        case 'crit':
          crit += a.value;
          break;
        case 'leech':
          leech += a.value;
          break;
        case 'haste':
          haste += a.value;
          break;
        case 'armor':
          armor += a.value;
          break;
        case 'vit':
          vit += a.value;
          break;
        case 'healing':
          healPower += a.value;
          break;
        case 'resistFire':
          resistFire += a.value;
          break;
        case 'resistBlight':
          resistBlight += a.value;
          break;
      }
    }
  }

  return {
    primaryStat: primary,
    maxHp: maxHpForLevel(level) + vit * VIT_HP,
    armor,
    critChance: crit,
    leech,
    haste: Math.min(haste, 0.3),
    healPower,
    resist: { fire: resistFire, frost: 0, blight: resistBlight },
  };
}
