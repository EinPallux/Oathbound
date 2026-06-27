// Item generation + scoring. Pure: deterministic for a given RNG. Implements a
// trimmed slice of docs/design/ITEMS_AND_EQUIPMENT.md — Common/Uncommon, a budget
// model per slot, and a small affix set. All `v1` tuning targets.

import type {
  Item,
  EquipSlot,
  Rarity,
  Affix,
  AffixId,
} from '../../core/ecs/components';
import type { Rng } from '../../core/rng';

export const EQUIP_SLOTS: readonly EquipSlot[] = [
  'weapon',
  'offhand',
  'head',
  'chest',
  'hands',
  'legs',
  'feet',
  'amulet',
  'ring1',
  'ring2',
];

const SLOT_WEIGHT: Record<EquipSlot, number> = {
  weapon: 1.4,
  offhand: 0.9,
  head: 0.8,
  chest: 1.0,
  hands: 0.6,
  legs: 0.8,
  feet: 0.6,
  amulet: 0.7,
  ring1: 0.5,
  ring2: 0.5,
};

const ARMOR_SLOTS = new Set<EquipSlot>(['offhand', 'head', 'chest', 'hands', 'legs', 'feet']);

const BASE_NAME: Record<EquipSlot, string> = {
  weapon: 'Greataxe',
  offhand: 'Bulwark Shield',
  head: 'Helm',
  chest: 'Cuirass',
  hands: 'Gauntlets',
  legs: 'Greaves',
  feet: 'Sabatons',
  amulet: 'Amulet',
  ring1: 'Ring',
  ring2: 'Ring',
};

const QUALITY_WORD: Record<Rarity, readonly string[]> = {
  common: ['Worn', 'Plain', 'Crude'],
  uncommon: ['Sturdy', 'Fine', 'Honed'],
  rare: ['Gleaming', 'Runed', 'Vanguard'],
  epic: ['Resplendent', 'Ascendant', 'Oathforged'],
};

const RARITY_MULT: Record<Rarity, number> = { common: 1.0, uncommon: 1.1, rare: 1.2, epic: 1.32 };
const RARITY_AFFIXES: Record<Rarity, number> = { common: 0, uncommon: 1, rare: 2, epic: 3 };

/** Chest-equivalent budget at an item level. */
export function baseBudget(ilvl: number): number {
  return Math.round(10 + 6 * ilvl);
}

/** Total stat budget for a slot at an item level + rarity (used by gen + reinforce). */
export function slotBudget(slot: EquipSlot, rarity: Rarity, ilvl: number): number {
  return Math.round(baseBudget(ilvl) * SLOT_WEIGHT[slot] * RARITY_MULT[rarity]);
}

/** Split a slot's budget into base armor + primary-stat value. */
export function baseStatsFromBudget(slot: EquipSlot, budget: number): { armor: number; primaryValue: number } {
  if (ARMOR_SLOTS.has(slot)) {
    return { armor: Math.max(1, Math.round(budget * 0.6)), primaryValue: Math.max(1, Math.round(budget * 0.2)) };
  }
  return { armor: 0, primaryValue: Math.max(1, Math.round(budget * 0.18)) };
}

/** An item's effective level: base ilvl + reinforcement steps. */
export function effectiveIlvl(item: Item): number {
  return item.ilvl + (item.reinforced ?? 0);
}

function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[rng.int(arr.length)];
}

function rollAffix(rng: Rng, slot: EquipSlot, ilvl: number): Affix {
  // Bias: armour slots → defensive (incl. typed resists); weapon/jewelry → offensive.
  const pool: AffixId[] = ARMOR_SLOTS.has(slot)
    ? ['armor', 'vit', 'leech', 'resistFire', 'resistFrost', 'resistBlight']
    : ['crit', 'haste', 'leech'];
  const id = pick(rng, pool);
  switch (id) {
    case 'crit':
      return { id, value: round3(0.02 + 0.001 * ilvl) };
    case 'haste':
      return { id, value: round3(0.015 + 0.0008 * ilvl) };
    case 'leech':
      return { id, value: round3(0.015 + 0.0008 * ilvl) };
    case 'armor':
      return { id, value: Math.round(4 + 0.8 * ilvl) };
    case 'vit':
      return { id, value: Math.round(3 + 0.5 * ilvl) };
    case 'healing':
      return { id, value: Math.round(3 + 0.5 * ilvl) };
    case 'resistFire':
    case 'resistFrost':
    case 'resistBlight':
      return { id, value: Math.round(15 + 3.5 * ilvl) };
  }
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Rough comparison power used for inventory upgrade deltas. */
export function scoreItem(item: Item): number {
  let s = item.primary.value * (item.primary.stat === 'STR' ? 3 : 2) + item.armor * 0.5;
  for (const a of item.affixes) {
    switch (a.id) {
      case 'crit':
      case 'haste':
      case 'leech':
        s += a.value * 200;
        break;
      case 'armor':
        s += a.value * 0.5;
        break;
      case 'vit':
        s += a.value * 2;
        break;
      case 'resistFire':
      case 'resistFrost':
      case 'resistBlight':
        s += a.value * 0.4;
        break;
    }
  }
  return Math.round(s);
}

export interface GenerateOpts {
  ilvl: number;
  slot?: EquipSlot;
  rarity?: Rarity;
  /** Primary stat for non-armour slots (smart-loot bias toward the class). */
  primaryStat?: 'STR' | 'DEX' | 'SPR';
}

let uidCounter = 0;
function makeUid(rng: Rng): string {
  uidCounter = (uidCounter + 1) % 1_000_000;
  return `it_${Math.floor(rng.next() * 1e9).toString(36)}${uidCounter.toString(36)}`;
}

/** Generate one item. Deterministic for a given RNG stream. */
export function generateItem(rng: Rng, opts: GenerateOpts): Item {
  const slot = opts.slot ?? pick(rng, EQUIP_SLOTS);
  const rarity = opts.rarity ?? 'common';
  const ilvl = Math.max(1, Math.round(opts.ilvl));
  const budget = slotBudget(slot, rarity, ilvl);
  const bs = baseStatsFromBudget(slot, budget);
  const armor = bs.armor;
  const primary: Item['primary'] = ARMOR_SLOTS.has(slot)
    ? { stat: 'VIT', value: bs.primaryValue }
    : { stat: opts.primaryStat ?? 'STR', value: bs.primaryValue };

  const affixes: Affix[] = [];
  for (let i = 0; i < RARITY_AFFIXES[rarity]; i++) affixes.push(rollAffix(rng, slot, ilvl));

  const item: Item = {
    uid: makeUid(rng),
    name: `${pick(rng, QUALITY_WORD[rarity])} ${BASE_NAME[slot]}`,
    slot,
    rarity,
    ilvl,
    primary,
    armor,
    affixes,
    score: 0,
    locked: false,
    reinforced: 0,
  };
  item.score = scoreItem(item);
  return item;
}
