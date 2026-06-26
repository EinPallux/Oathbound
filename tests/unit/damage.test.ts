import { describe, it, expect } from 'vitest';
import {
  computeDamage,
  armorDR,
  resistDR,
  drConstant,
  rollDamage,
  type Attacker,
  type Defender,
  type AbilityHit,
} from '../../src/sim/combat/damage';
import { Rng } from '../../src/core/rng';

const attacker: Attacker = { primaryStat: 10, level: 1, critChance: 0, critMult: 1.5 };

function defender(over: Partial<Defender> = {}): Defender {
  return {
    armor: 40,
    resist: { fire: 0, frost: 0, blight: 0 },
    weakness: {},
    ...over,
  };
}

describe('diminishing-returns helpers', () => {
  it('K(L) = 50 + 25*L', () => {
    expect(drConstant(1)).toBe(75);
    expect(drConstant(10)).toBe(300);
  });

  it('armorDR = armor / (armor + K)', () => {
    expect(armorDR(40, 1)).toBeCloseTo(40 / 115, 10);
    expect(armorDR(0, 1)).toBe(0);
  });

  it('resistDR shares the same shape', () => {
    expect(resistDR(25, 1)).toBeCloseTo(0.25, 10);
    expect(resistDR(0, 5)).toBe(0);
  });
});

describe('computeDamage (canonical formula)', () => {
  const strike: AbilityHit = { base: 8, coeff: 1.0, damageType: 'physical' };

  it('applies the physical formula with armor mitigation', () => {
    // raw 18 → *(1 - 40/115) = 11.739 → round 12
    const r = computeDamage(strike, attacker, defender(), { isCrit: false, variance: 1 });
    expect(r.raw).toBe(18);
    expect(r.mitigated).toBeCloseTo(11.739, 3);
    expect(r.amount).toBe(12);
    expect(r.isCrit).toBe(false);
  });

  it('multiplies by critMult on a crit', () => {
    const r = computeDamage(strike, attacker, defender(), { isCrit: true, variance: 1 });
    expect(r.amount).toBe(18); // 11.739 * 1.5 = 17.6 → 18
    expect(r.isCrit).toBe(true);
  });

  it('applies variance at the ends of the band', () => {
    const lo = computeDamage(strike, attacker, defender(), { isCrit: false, variance: 0.95 });
    const hi = computeDamage(strike, attacker, defender(), { isCrit: false, variance: 1.05 });
    expect(lo.amount).toBe(11); // 11.739 * 0.95 = 11.15
    expect(hi.amount).toBe(12); // 11.739 * 1.05 = 12.33
  });

  it('ignores typed resist for physical hits', () => {
    const r = computeDamage(strike, attacker, defender({ resist: { fire: 999, frost: 999, blight: 999 } }), {
      isCrit: false,
      variance: 1,
    });
    expect(r.amount).toBe(12); // unchanged: physical uses armor only
  });

  it('uses typed resist + weakness for elemental hits, ignoring armor', () => {
    const fire: AbilityHit = { base: 10, coeff: 1.0, damageType: 'fire' };
    // raw 20 → *(1 - 25/100)=0.75 → 15 → *weakness 1.25 = 18.75 → round 19
    const r = computeDamage(
      fire,
      attacker,
      defender({ armor: 999, resist: { fire: 25, frost: 0, blight: 0 }, weakness: { fire: 1.25 } }),
      { isCrit: false, variance: 1 },
    );
    expect(r.raw).toBe(20);
    expect(r.mitigated).toBeCloseTo(18.75, 6);
    expect(r.amount).toBe(19);
  });
});

describe('rollDamage', () => {
  it('crit chance gates the crit flag and variance stays in band', () => {
    const rng = new Rng(123);
    const always = rollDamage(rng, 1);
    expect(always.isCrit).toBe(true);
    const never = rollDamage(rng, 0);
    expect(never.isCrit).toBe(false);
    for (let i = 0; i < 200; i++) {
      const v = rollDamage(rng, 0.5).variance;
      expect(v).toBeGreaterThanOrEqual(0.95);
      expect(v).toBeLessThan(1.05);
    }
  });
});
