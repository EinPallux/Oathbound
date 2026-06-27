import { describe, it, expect } from 'vitest';
import { World } from '../../src/core/ecs/world';
import {
  C,
  type Health,
  type Resource,
  type Transform,
  type Offense,
  type Statuses,
} from '../../src/core/ecs/components';
import { createCombatSystem } from '../../src/sim/systems/combat';
import { createPlayer, createBloomhusk } from '../../src/sim/factory';
import { Projectiles } from '../../src/sim/projectiles';
import { applyDamage } from '../../src/sim/combat/apply';
import { addStatus, hasStatus, Status } from '../../src/sim/combat/statuses';
import { Rng } from '../../src/core/rng';
import { DT } from '../../src/core/time';
import { flatField, makeInput, setLevel } from './helpers';

const FIELD = flatField();

function warrior(level: number) {
  const world = new World();
  const { ctrl, state } = makeInput();
  const player = createPlayer(world, FIELD, 0, 0, 'warrior');
  setLevel(world, player, level);
  const combat = createCombatSystem({
    input: ctrl,
    rng: new Rng(1),
    colliders: [],
    field: FIELD,
    projectiles: new Projectiles(),
  });
  return { world, ctrl, state, player, combat };
}

describe('ability unlocks', () => {
  it('blocks an ability below its unlock level, allows it at/after', () => {
    // Whirl (slot 2) unlocks at Lv 3.
    const low = warrior(1);
    createBloomhusk(low.world, FIELD, 0, 2);
    createBloomhusk(low.world, FIELD, 2, 0);
    const enemiesHp = () =>
      [...low.world.query(C.Health, C.Enemy)].reduce(
        (s, e) => s + low.world.get<Health>(e, C.Health)!.current,
        0,
      );
    const before = enemiesHp();
    low.state.ability = 2; // Whirl — locked at Lv 1
    low.combat.update(low.world, DT);
    expect(enemiesHp()).toBe(before);

    const ok = warrior(3);
    createBloomhusk(ok.world, FIELD, 0, 2);
    const e = [...ok.world.query(C.Enemy)][0];
    const h = ok.world.get<Health>(e, C.Health)!;
    ok.world.get<Resource>(ok.player, C.Resource)!.current = 50; // Fury for Whirl
    ok.state.ability = 2; // Whirl — unlocked at Lv 3
    ok.combat.update(ok.world, DT);
    expect(h.current).toBeLessThan(h.max);
  });

  it('Charge (Lv 7) closes the gap to a target and roots it', () => {
    const { world, state, player, combat } = warrior(8);
    const enemy = createBloomhusk(world, FIELD, 0, 12); // far, within Charge range 18
    const pt = world.get<Transform>(player, C.Transform)!;
    const startZ = pt.z;

    state.ability = 4; // Charge
    combat.update(world, DT);

    expect(pt.z).toBeGreaterThan(startZ + 5); // leapt toward the target
    expect(hasStatus(world.get<Statuses>(enemy, C.Statuses), Status.Root)).toBe(true);
  });

  it('Second Wind (Lv 9) heals, scaling with missing HP', () => {
    const { world, state, player, combat } = warrior(10);
    const h = world.get<Health>(player, C.Health)!;
    h.current = h.max - 200; // badly hurt
    world.get<Resource>(player, C.Resource)!.current = 50; // enough Fury
    const before = h.current;

    state.ability = 5; // Second Wind
    combat.update(world, DT);
    expect(h.current).toBeGreaterThan(before);
  });
});

describe("Hunter's Mark vulnerability", () => {
  it('marked targets take more damage', () => {
    const world = new World();
    const attacker = createPlayer(world, FIELD, 0, 0, 'warrior');
    world.get<Offense>(attacker, C.Offense)!.critChance = 0;
    const hit = { base: 20, coeff: 0, damageType: 'physical' as const };

    const a = createBloomhusk(world, FIELD, 0, 3);
    const unmarked = applyDamage(world, attacker, a, hit, new Rng(1), 0).amount;

    const b = createBloomhusk(world, FIELD, 0, 4);
    addStatus(world.get<Statuses>(b, C.Statuses)!, Status.Marked, 10, 0.5);
    const marked = applyDamage(world, attacker, b, hit, new Rng(1), 0).amount;

    expect(marked).toBeGreaterThan(unmarked);
  });
});
