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
  weights: { common: number; uncommon: number; rare: number };
}

const TIERS: Record<string, TierTable> = {
  standard: { dropChance: 0.35, weights: { common: 0.72, uncommon: 0.28, rare: 0 } },
  elite: { dropChance: 0.7, weights: { common: 0.2, uncommon: 0.5, rare: 0.3 } },
  rare: { dropChance: 1.0, weights: { common: 0.1, uncommon: 0.3, rare: 0.6 } },
};

function pickRarity(rng: Rng, w: TierTable['weights'], conMult: number): Rarity {
  // `conMult` mildly biases toward the better rolls for higher-con enemies.
  const common = w.common;
  const uncommon = w.uncommon * conMult;
  const rare = w.rare * conMult;
  const total = common + uncommon + rare;
  let r = rng.next() * total;
  if ((r -= common) < 0) return 'common';
  if ((r -= uncommon) < 0) return 'uncommon';
  return 'rare';
}

/**
 * Roll loot for a kill. Gold is small and always awarded; an item drops per the
 * tier's `dropChance`, with rarity weighted by tier (and mildly by con).
 */
export function rollLoot(
  rng: Rng,
  enemyLevel: number,
  tier: keyof typeof TIERS | string = 'standard',
  conMult = 1,
  primaryStat: 'STR' | 'DEX' | 'SPR' = 'STR',
): LootRoll {
  const t = TIERS[tier] ?? TIERS.standard;
  const gold = Math.max(1, Math.round((1 + enemyLevel) * (0.8 + rng.next() * 0.8)));

  if (rng.next() > t.dropChance) return { item: null, gold };

  const rarity = pickRarity(rng, t.weights, conMult);
  const item = generateItem(rng, { ilvl: enemyLevel, rarity, primaryStat });
  return { item, gold };
}
