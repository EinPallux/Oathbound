// Item-info tests (0.7.0 CP2): the pure stat-line + comparison helpers behind the
// inventory hover tooltip (formatting, contributions, equip-vs-equipped deltas).

import { describe, it, expect } from 'vitest';
import type { Item } from '../../src/core/ecs/components';
import {
  formatAttr,
  affixText,
  itemStatLines,
  itemContributions,
  compareItems,
} from '../../src/sim/loot/item-info';

function mkItem(over: Partial<Item>): Item {
  return {
    uid: 'x',
    name: 'Test',
    slot: 'weapon',
    rarity: 'rare',
    ilvl: 20,
    primary: { stat: 'STR', value: 60 },
    armor: 0,
    affixes: [],
    score: 0,
    locked: false,
    ...over,
  };
}

describe('item-info — formatting', () => {
  it('formats percent attrs as % and flat attrs as integers (optionally signed)', () => {
    expect(formatAttr('crit', 0.053)).toBe('5.3%');
    expect(formatAttr('crit', 0.053, true)).toBe('+5.3%');
    expect(formatAttr('crit', -0.021, true)).toBe('-2.1%');
    expect(formatAttr('armor', 30)).toBe('30');
    expect(formatAttr('armor', 30, true)).toBe('+30');
    expect(formatAttr('armor', -5, true)).toBe('-5');
  });

  it('labels affixes', () => {
    expect(affixText({ id: 'crit', value: 0.053 })).toBe('Crit +5.3%');
    expect(affixText({ id: 'armor', value: 30 })).toBe('Armor +30');
    expect(affixText({ id: 'vit', value: 20 })).toBe('Vitality +20');
    expect(affixText({ id: 'resistFire', value: 131 })).toBe('Fire Resist +131');
  });

  it('lists an item’s own stat lines (primary, armor when present, then affixes)', () => {
    const weapon = mkItem({ primary: { stat: 'STR', value: 60 }, affixes: [{ id: 'crit', value: 0.05 }] });
    expect(itemStatLines(weapon)).toEqual(['Strength +60', 'Crit +5.0%']);

    const chest = mkItem({
      slot: 'chest',
      primary: { stat: 'VIT', value: 20 },
      armor: 30,
      affixes: [{ id: 'resistFire', value: 100 }],
    });
    expect(itemStatLines(chest)).toEqual(['Vitality +20', 'Armor +30', 'Fire Resist +100']);
  });
});

describe('item-info — contributions & comparison', () => {
  it('sums primary + base armor + affixes per attribute', () => {
    const it = mkItem({
      primary: { stat: 'STR', value: 60 },
      armor: 10,
      affixes: [
        { id: 'vit', value: 20 },
        { id: 'armor', value: 5 },
        { id: 'crit', value: 0.05 },
      ],
    });
    expect(itemContributions(it)).toEqual({ STR: 60, armor: 15, VIT: 20, crit: 0.05 });
  });

  it('compares against nothing equipped → all gains', () => {
    const it = mkItem({ primary: { stat: 'STR', value: 60 }, affixes: [{ id: 'crit', value: 0.05 }] });
    const deltas = compareItems(it, null);
    expect(deltas.map((d) => `${d.label} ${d.text}`)).toEqual(['Strength +60', 'Crit +5.0%']);
    expect(deltas.every((d) => d.sign > 0)).toBe(true);
  });

  it('computes net per-attribute deltas vs the equipped piece (in display order)', () => {
    const a = mkItem({ primary: { stat: 'STR', value: 60 }, affixes: [{ id: 'crit', value: 0.05 }] });
    const b = mkItem({ primary: { stat: 'STR', value: 40 }, affixes: [{ id: 'haste', value: 0.04 }] });
    const deltas = compareItems(a, b);
    expect(deltas.map((d) => `${d.label} ${d.text}`)).toEqual([
      'Strength +20',
      'Crit +5.0%',
      'Haste -4.0%',
    ]);
    expect(deltas.find((d) => d.key === 'haste')!.sign).toBe(-1);
  });

  it('returns no deltas for stat-identical items', () => {
    const a = mkItem({ primary: { stat: 'STR', value: 50 }, affixes: [{ id: 'crit', value: 0.03 }] });
    const b = mkItem({ uid: 'y', primary: { stat: 'STR', value: 50 }, affixes: [{ id: 'crit', value: 0.03 }] });
    expect(compareItems(a, b)).toEqual([]);
  });
});
