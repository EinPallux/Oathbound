import { describe, it, expect } from 'vitest';
import { generateItem, baseBudget, scoreItem } from '../../src/sim/loot/items';
import { rollLoot } from '../../src/sim/loot/droptable';
import { Rng } from '../../src/core/rng';

describe('baseBudget', () => {
  it('matches the item-power table', () => {
    expect(baseBudget(1)).toBe(16);
    expect(baseBudget(10)).toBe(70);
    expect(baseBudget(30)).toBe(190);
  });
});

describe('generateItem', () => {
  it('armour slots give armour + VIT; weapons give STR and no armour', () => {
    const chest = generateItem(new Rng(1), { ilvl: 5, slot: 'chest', rarity: 'common' });
    expect(chest.armor).toBeGreaterThan(0);
    expect(chest.primary.stat).toBe('VIT');

    const weapon = generateItem(new Rng(1), { ilvl: 5, slot: 'weapon', rarity: 'common' });
    expect(weapon.primary.stat).toBe('STR');
    expect(weapon.armor).toBe(0);
  });

  it('rarity controls affix count', () => {
    const common = generateItem(new Rng(2), { ilvl: 10, slot: 'weapon', rarity: 'common' });
    const uncommon = generateItem(new Rng(2), { ilvl: 10, slot: 'weapon', rarity: 'uncommon' });
    const rare = generateItem(new Rng(2), { ilvl: 10, slot: 'weapon', rarity: 'rare' });
    expect(common.affixes.length).toBe(0);
    expect(uncommon.affixes.length).toBe(1);
    expect(rare.affixes.length).toBe(2);
    expect(rare.score).toBeGreaterThan(common.score); // higher budget
  });

  it('is deterministic in its rolled fields for a given seed', () => {
    const a = generateItem(new Rng(7), { ilvl: 8, slot: 'legs', rarity: 'uncommon' });
    const b = generateItem(new Rng(7), { ilvl: 8, slot: 'legs', rarity: 'uncommon' });
    expect(b.slot).toBe(a.slot);
    expect(b.rarity).toBe(a.rarity);
    expect(b.primary).toEqual(a.primary);
    expect(b.armor).toBe(a.armor);
    expect(b.affixes).toEqual(a.affixes);
    expect(b.score).toBe(a.score);
  });

  it('scoreItem is positive', () => {
    const it = generateItem(new Rng(3), { ilvl: 12, slot: 'amulet', rarity: 'uncommon' });
    expect(scoreItem(it)).toBeGreaterThan(0);
  });
});

describe('rollLoot', () => {
  it('drops at roughly the target rate with a small uncommon tail', () => {
    const rng = new Rng(12345);
    const N = 4000;
    let drops = 0;
    let uncommon = 0;
    for (let i = 0; i < N; i++) {
      const r = rollLoot(rng, 1, 'standard');
      expect(r.gold).toBeGreaterThan(0);
      if (r.item) {
        drops++;
        if (r.item.rarity === 'uncommon') uncommon++;
      }
    }
    expect(drops / N).toBeGreaterThan(0.3);
    expect(drops / N).toBeLessThan(0.4);
    // ~8–12% uncommon of all kills (0.35 * 0.28 ≈ 0.098)
    expect(uncommon / N).toBeGreaterThan(0.05);
    expect(uncommon / N).toBeLessThan(0.15);
  });

  it('elites drop more often and can drop Rare; standards never do', () => {
    const rng = new Rng(999);
    const N = 3000;
    let standardRare = 0;
    let eliteDrops = 0;
    let eliteRare = 0;
    for (let i = 0; i < N; i++) {
      if (rollLoot(rng, 5, 'standard').item?.rarity === 'rare') standardRare++;
      const e = rollLoot(rng, 5, 'elite');
      if (e.item) {
        eliteDrops++;
        if (e.item.rarity === 'rare') eliteRare++;
      }
    }
    expect(standardRare).toBe(0); // standards never drop Rare
    expect(eliteDrops / N).toBeGreaterThan(0.55); // elites drop far more
    expect(eliteRare).toBeGreaterThan(0); // and can be Rare
  });
});
