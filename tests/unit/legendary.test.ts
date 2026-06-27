import { describe, it, expect } from 'vitest';
import { generateItem, slotBudget } from '../../src/sim/loot/items';
import { rollLoot, isRarePlus, pityMultiplier } from '../../src/sim/loot/droptable';
import { Rng } from '../../src/core/rng';

describe('Legendary rarity', () => {
  it('generates 4 affixes and out-budgets an Epic of the same ilvl/slot', () => {
    const leg = generateItem(new Rng(1), { ilvl: 33, slot: 'weapon', rarity: 'legendary' });
    expect(leg.rarity).toBe('legendary');
    expect(leg.affixes).toHaveLength(4);
    expect(slotBudget('weapon', 'legendary', 33)).toBeGreaterThan(slotBudget('weapon', 'epic', 33));
    const epic = generateItem(new Rng(1), { ilvl: 33, slot: 'weapon', rarity: 'epic' });
    expect(leg.score).toBeGreaterThan(epic.score);
  });

  it('drops as a tail from rare-named enemies, never from standards', () => {
    const rng = new Rng(7);
    let legFromRare = 0;
    for (let i = 0; i < 2000; i++) {
      if (rollLoot(rng, 30, 'rare', 1, 'STR').item?.rarity === 'legendary') legFromRare++;
    }
    expect(legFromRare).toBeGreaterThan(0);

    let legFromStd = 0;
    for (let i = 0; i < 2000; i++) {
      if (rollLoot(rng, 30, 'standard', 1, 'STR').item?.rarity === 'legendary') legFromStd++;
    }
    expect(legFromStd).toBe(0);
  });

  it('counts as rare+ for bad-luck protection (resets the pity counter)', () => {
    expect(isRarePlus('legendary')).toBe(true);
  });

  it('bad-luck protection raises the Legendary tail too', () => {
    const countLeg = (pity: number): number => {
      const rng = new Rng(11);
      let n = 0;
      for (let i = 0; i < 4000; i++) {
        if (rollLoot(rng, 30, 'rare', 1, 'STR', pityMultiplier(pity)).item?.rarity === 'legendary') n++;
      }
      return n;
    };
    expect(countLeg(20)).toBeGreaterThan(countLeg(0));
  });
});
