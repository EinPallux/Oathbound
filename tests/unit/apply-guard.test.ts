// Regression for the QA-audit VH1 crash: applyDamage must not throw when the source or target
// entity has been destroyed since the hit was scheduled (a trap/projectile can outlive its
// caster — e.g. the caster disconnected and was reaped). Before the guard, the non-null
// component assertions threw a TypeError inside the tick loop and took the whole server down.

import { describe, it, expect } from 'vitest';
import { World } from '../../src/core/ecs/world';
import { C, type Health } from '../../src/core/ecs/components';
import { createPlayer } from '../../src/sim/factory';
import { spawnEnemy } from '../../src/sim/content/enemies';
import { applyDamage } from '../../src/sim/combat/apply';
import { Rng } from '../../src/core/rng';
import { flatField } from './helpers';

const FIELD = flatField();
const HIT = { base: 10, coeff: 1, damageType: 'physical' as const };

describe('applyDamage guards a destroyed source/target (VH1)', () => {
  it('returns zero and does not throw when the source no longer exists', () => {
    const world = new World();
    const attacker = spawnEnemy(world, FIELD, 'bloomhusk', 0, 3, { level: 5 });
    const target = createPlayer(world, FIELD, 0, 0);
    world.destroyEntity(attacker); // caster gone (reaped) before its trap fires

    let res: ReturnType<typeof applyDamage> | undefined;
    expect(() => {
      res = applyDamage(world, attacker, target, HIT, new Rng(1));
    }).not.toThrow();
    expect(res?.amount).toBe(0);
    expect(res?.killed).toBe(false);
    // Target untouched.
    expect(world.get<Health>(target, C.Health)!.current).toBe(world.get<Health>(target, C.Health)!.max);
  });

  it('returns zero and does not throw when the target no longer exists', () => {
    const world = new World();
    const attacker = spawnEnemy(world, FIELD, 'bloomhusk', 0, 3, { level: 5 });
    const target = createPlayer(world, FIELD, 0, 0);
    world.destroyEntity(target);

    let res: ReturnType<typeof applyDamage> | undefined;
    expect(() => {
      res = applyDamage(world, attacker, target, HIT, new Rng(1));
    }).not.toThrow();
    expect(res?.amount).toBe(0);
  });
});
