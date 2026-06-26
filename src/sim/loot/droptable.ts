// Drop resolution: gold + (maybe) one item, weighted by enemy tier. Pure /
// deterministic for a given RNG. Trimmed slice (standard tier, Common/Uncommon).
// Targets ~8–12% uncommon+ from a standard kill (docs/design/SOLO_BALANCE_RULES.md).

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
  /** Probability the dropped item is Uncommon (else Common). */
  uncommonShare: number;
}

const TIERS: Record<string, TierTable> = {
  standard: { dropChance: 0.35, uncommonShare: 0.28 },
};

/**
 * Roll loot for a kill. `conMult` mildly biases rarity for higher-con enemies.
 * Gold is small and always awarded.
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

  const uncommonChance = Math.min(0.6, t.uncommonShare * conMult);
  const rarity: Rarity = rng.next() < uncommonChance ? 'uncommon' : 'common';
  const item = generateItem(rng, { ilvl: enemyLevel, rarity, primaryStat });
  return { item, gold };
}
