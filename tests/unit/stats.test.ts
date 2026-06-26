import { describe, it, expect } from 'vitest';
import {
  xpToNext,
  xpPerKill,
  conColor,
  conXpMultiplier,
  deriveStats,
  primaryStatForLevel,
  maxHpForLevel,
} from '../../src/sim/stats';
import type { Equipment } from '../../src/core/ecs/components';

describe('xp curve', () => {
  it('matches the canonical table', () => {
    expect(xpToNext(1)).toBe(50);
    expect(xpToNext(2)).toBe(160);
    expect(xpToNext(3)).toBe(320);
    expect(xpToNext(5)).toBe(770);
    expect(xpToNext(10)).toBe(2510);
    expect(xpToNext(29)).toBe(15310);
  });
  it('is Infinity at the cap', () => {
    expect(xpToNext(30)).toBe(Infinity);
  });
  it('xpPerKill = round(8 + 4.2*L)', () => {
    expect(xpPerKill(1)).toBe(12);
    expect(xpPerKill(10)).toBe(50);
    expect(xpPerKill(30)).toBe(134);
  });
});

describe('con system', () => {
  it('colours by level difference', () => {
    expect(conColor(5, 5)).toBe('white');
    expect(conColor(5, 7)).toBe('yellow');
    expect(conColor(5, 11)).toBe('red');
    expect(conColor(10, 4)).toBe('gray');
    expect(conColor(10, 7)).toBe('green');
    expect(conColor(5, 10)).toBe('orange');
  });
  it('applies the anti-farm gray rule and caps', () => {
    expect(conXpMultiplier(10, 4)).toBe(0.05);
    expect(conXpMultiplier(5, 5)).toBe(1.0);
    expect(conXpMultiplier(5, 7)).toBe(1.2);
    expect(conXpMultiplier(5, 12)).toBe(1.3);
  });
});

describe('deriveStats', () => {
  const empty: Equipment = { slots: {} };

  it('returns level base stats with no gear', () => {
    const d = deriveStats(1, empty);
    expect(d.primaryStat).toBe(primaryStatForLevel(1));
    expect(d.maxHp).toBe(maxHpForLevel(1));
    expect(d.armor).toBe(0);
    expect(d.critChance).toBeCloseTo(0.1, 5);
  });

  it('adds equipment primary stats, armor, and affixes', () => {
    const eq: Equipment = {
      slots: {
        weapon: {
          uid: 'w',
          name: 'Axe',
          slot: 'weapon',
          rarity: 'uncommon',
          ilvl: 5,
          primary: { stat: 'STR', value: 6 },
          armor: 0,
          affixes: [{ id: 'crit', value: 0.05 }],
          score: 1,
        },
        chest: {
          uid: 'c',
          name: 'Cuirass',
          slot: 'chest',
          rarity: 'common',
          ilvl: 5,
          primary: { stat: 'VIT', value: 3 },
          armor: 10,
          affixes: [],
          score: 1,
        },
      },
    };
    const d = deriveStats(1, eq);
    expect(d.primaryStat).toBe(primaryStatForLevel(1) + 6);
    expect(d.maxHp).toBe(maxHpForLevel(1) + 3 * 4); // VIT_HP = 4
    expect(d.armor).toBe(10);
    expect(d.critChance).toBeCloseTo(0.15, 5);
  });

  it('caps haste at 0.3', () => {
    const eq: Equipment = {
      slots: {
        ring1: {
          uid: 'r',
          name: 'Ring',
          slot: 'ring1',
          rarity: 'uncommon',
          ilvl: 30,
          primary: { stat: 'STR', value: 1 },
          armor: 0,
          affixes: [{ id: 'haste', value: 0.5 }],
          score: 1,
        },
      },
    };
    expect(deriveStats(1, eq).haste).toBe(0.3);
  });
});
