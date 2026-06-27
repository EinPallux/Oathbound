import { describe, it, expect } from 'vitest';
import { World } from '../../src/core/ecs/world';
import {
  C,
  type Health,
  type Statuses,
  type Offense,
} from '../../src/core/ecs/components';
import { createPlayer } from '../../src/sim/factory';
import { spawnEnemy } from '../../src/sim/content/enemies';
import { createEnemyAiSystem } from '../../src/sim/systems/enemy-ai';
import { applyDamage } from '../../src/sim/combat/apply';
import { addStatus, hasStatus, Status } from '../../src/sim/combat/statuses';
import { Rng } from '../../src/core/rng';
import { flatField } from './helpers';

const FIELD = flatField();

describe('support archetype (Sporemother)', () => {
  it('heals the most-wounded nearby ally', () => {
    const world = new World();
    createPlayer(world, FIELD, 0, 0);
    spawnEnemy(world, FIELD, 'sporemother', 0, 4, { level: 8 });
    const ally = spawnEnemy(world, FIELD, 'sporeling', 1, 4, { level: 8 });
    const ah = world.get<Health>(ally, C.Health)!;
    ah.current = 20; // wounded

    const ai = createEnemyAiSystem({ field: FIELD, colliders: [], rng: new Rng(1) });
    for (let i = 0; i < 80; i++) ai.update(world, 0.1); // ~8s → a couple of heals

    expect(ah.current).toBeGreaterThan(20);
  });
});

describe('pack-leader archetype (Bramble Warchief)', () => {
  it('empowers nearby allies while fighting', () => {
    const world = new World();
    createPlayer(world, FIELD, 0, 0);
    spawnEnemy(world, FIELD, 'warchief', 0, 2, { level: 9 });
    const ally = spawnEnemy(world, FIELD, 'bramblekin', 1, 2, { level: 9 });

    const ai = createEnemyAiSystem({ field: FIELD, colliders: [], rng: new Rng(2) });
    for (let i = 0; i < 40; i++) ai.update(world, 0.1); // ~4s → the warchief rallies

    expect(hasStatus(world.get<Statuses>(ally, C.Statuses), Status.Empowered)).toBe(true);
  });

  it('an Empowered attacker deals more damage', () => {
    const hit = (empowered: boolean): number => {
      const world = new World();
      const player = createPlayer(world, FIELD, 0, 0);
      const atk = spawnEnemy(world, FIELD, 'bloomhusk', 0, 3, { level: 5 });
      world.get<Offense>(atk, C.Offense)!.critChance = 0; // deterministic
      if (empowered) addStatus(world.get<Statuses>(atk, C.Statuses)!, Status.Empowered, 5, 0.25);
      return applyDamage(world, atk, player, { base: 10, coeff: 1, damageType: 'physical' }, new Rng(9))
        .amount;
    };
    expect(hit(true)).toBeGreaterThan(hit(false));
  });
});
