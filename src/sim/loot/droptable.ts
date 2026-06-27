// Drop resolution: gold + (maybe) one item, with rarity weighted by enemy tier.
// Pure / deterministic for a given RNG. Standards lean common/uncommon; elites add
// Rare; rare-named mostly Rare. See docs/design/ITEMS_AND_EQUIPMENT.md.

import type { Item, Rarity } from '../../core/ecs/components';
import type { Rng } from '../../core/rng';
import { generateItem } from './items';

export interface LootRoll {
  item: Item | null;
  gold: number;
}

interface TierTable {
  /** Probability an item drops at all. */
  dropChance: number;
  /** Relative rarity weights. */
  weights: { common: number; uncommon: number; rare: number; epic: number; legendary: number };
}

const TIERS: Record<string, TierTable> = {
  standard: { dropChance: 0.35, weights: { common: 0.72, uncommon: 0.28, rare: 0, epic: 0, legendary: 0 } },
  elite: { dropChance: 0.7, weights: { common: 0.18, uncommon: 0.45, rare: 0.3, epic: 0.07, legendary: 0.015 } },
  rare: { dropChance: 1.0, weights: { common: 0.08, uncommon: 0.22, rare: 0.5, epic: 0.15, legendary: 0.06 } },
};

/** Items of this rarity or better reset the bad-luck-protection pity counter. */
export function isRarePlus(r: Rarity): boolean {
  return r === 'rare' || r === 'epic' || r === 'legendary';
}

/** Bad-luck protection: each unlucky kill raises the rare+ weight (capped). */
export function pityMultiplier(pity: number): number {
  return 1 + Math.min(Math.max(pity, 0), 25) * 0.08; // +8% per unlucky kill, up to +200%
}

function pickRarity(rng: Rng, w: TierTable['weights'], conMult: number, pityMult: number): Rarity {
  // `conMult` mildly biases toward better rolls for higher-con enemies; `pityMult`
  // (bad-luck protection) boosts the rare+ weights for consecutive unlucky kills.
  const common = w.common;
  const uncommon = w.uncommon * conMult;
  const rare = w.rare * conMult * pityMult;
  const epic = w.epic * conMult * pityMult;
  const legendary = w.legendary * conMult * pityMult;
  const total = common + uncommon + rare + epic + legendary;
  let r = rng.next() * total;
  if ((r -= common) < 0) return 'common';
  if ((r -= uncommon) < 0) return 'uncommon';
  if ((r -= rare) < 0) return 'rare';
  if ((r -= epic) < 0) return 'epic';
  return 'legendary';
}

/**
 * Roll loot for a kill. Gold is small and always awarded; an item drops per the
 * tier's `dropChance`, with rarity weighted by tier, con, and bad-luck protection.
 */
export function rollLoot(
  rng: Rng,
  enemyLevel: number,
  tier: keyof typeof TIERS | string = 'standard',
  conMult = 1,
  primaryStat: 'STR' | 'DEX' | 'SPR' = 'STR',
  pityMult = 1,
): LootRoll {
  const t = TIERS[tier] ?? TIERS.standard;
  const gold = Math.max(1, Math.round((1 + enemyLevel) * (0.8 + rng.next() * 0.8)));

  if (rng.next() > t.dropChance) return { item: null, gold };

  const rarity = pickRarity(rng, t.weights, conMult, pityMult);
  const item = generateItem(rng, { ilvl: enemyLevel, rarity, primaryStat });
  return { item, gold };
}
