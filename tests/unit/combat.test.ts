import { describe, it, expect } from 'vitest';
import { World } from '../../src/core/ecs/world';
import {
  C,
  type Health,
  type Resource,
  type Target,
  type Statuses,
  type Progression,
  type LootDrop,
  type Offense,
} from '../../src/core/ecs/components';
import { createCombatSystem } from '../../src/sim/systems/combat';
import { createPlayer, createBloomhusk } from '../../src/sim/factory';
import { Rng } from '../../src/core/rng';
import { GCD } from '../../src/sim/combat/abilities';
import { Status, statusMagnitude } from '../../src/sim/combat/statuses';
import { DT } from '../../src/core/time';
import { flatField, makeInput } from './helpers';

const FIELD = flatField();

function setup(seed = 1) {
  const world = new World();
  const { ctrl, state } = makeInput();
  const player = createPlayer(world, FIELD, 0, 0);
  const sys = createCombatSystem({ input: ctrl, rng: new Rng(seed), colliders: [] });
  return { world, state, player, sys };
}

describe('warrior combat', () => {
  it('Cleaving Strike (slot 0) builds Fury and damages a hostile ahead', () => {
    const { world, state, player, sys } = setup();
    const enemy = createBloomhusk(world, FIELD, 0, 3);

    state.ability = 0;
    sys.update(world, DT);

    expect(world.get<Health>(enemy, C.Health)!.current).toBeLessThan(
      world.get<Health>(enemy, C.Health)!.max,
    );
    expect(world.get<Resource>(player, C.Resource)!.current).toBe(12); // furyGain
    expect(world.get<Target>(player, C.Target)!.entity).toBe(enemy);
  });

  it('enforces the GCD between casts', () => {
    const { world, state, sys } = setup();
    const enemy = createBloomhusk(world, FIELD, 0, 3);
    const h = world.get<Health>(enemy, C.Health)!;

    state.ability = 0;
    sys.update(world, DT);
    const afterFirst = h.current;

    state.ability = 0; // inside the GCD
    sys.update(world, DT);
    expect(h.current).toBe(afterFirst);

    for (let i = 0; i < Math.ceil(GCD / DT) + 2; i++) sys.update(world, DT);
    state.ability = 0;
    sys.update(world, DT);
    expect(h.current).toBeLessThan(afterFirst);
  });

  it('Sunder costs Fury and cannot be cast without it; applies Armor Break', () => {
    const { world, state, player, sys } = setup();
    const enemy = createBloomhusk(world, FIELD, 0, 3);
    const h = world.get<Health>(enemy, C.Health)!;

    // No Fury yet → Sunder (slot 1) does nothing.
    state.ability = 1;
    sys.update(world, DT);
    expect(h.current).toBe(h.max);

    // Build Fury with cleaves, then Sunder.
    const res = world.get<Resource>(player, C.Resource)!;
    res.current = 40;
    state.ability = 1;
    sys.update(world, DT);
    expect(res.current).toBe(10); // 40 - 30 cost
    expect(statusMagnitude(world.get<Statuses>(enemy, C.Statuses), Status.ArmorBreak)).toBe(12);
  });

  it('a kill grants XP and spawns a loot drop', () => {
    const { world, state, player, sys } = setup();
    const enemy = createBloomhusk(world, FIELD, 0, 3);
    world.get<Health>(enemy, C.Health)!.current = 1; // one hit kills

    const before = world.get<Progression>(player, C.Progression)!.xp;
    state.ability = 0;
    sys.update(world, DT);

    const prog = world.get<Progression>(player, C.Progression)!;
    // XP went up (either banked or consumed by a level-up).
    expect(prog.xp !== before || prog.level > 1).toBe(true);

    let drops = 0;
    for (const e of world.query(C.LootDrop)) {
      const ld = world.get<LootDrop>(e, C.LootDrop)!;
      expect(ld.gold).toBeGreaterThan(0);
      drops++;
    }
    expect(drops).toBe(1);
  });

  it('does not hit hostiles outside the forward cone', () => {
    const { world, state, player, sys } = setup();
    const behind = createBloomhusk(world, FIELD, 0, -3);
    state.ability = 0;
    sys.update(world, DT);
    expect(world.get<Health>(behind, C.Health)!.current).toBe(
      world.get<Health>(behind, C.Health)!.max,
    );
    expect(world.get<Target>(player, C.Target)!.entity).toBeNull();
  });
});

describe('time-to-kill band (combat-sim)', () => {
  it('a Warrior kills a same-level standard in 3–6s', () => {
    const world = new World();
    const { ctrl, state } = makeInput();
    const player = createPlayer(world, FIELD, 0, 0);
    const enemy = createBloomhusk(world, FIELD, 0, 2.5, 1);
    // Remove crit variance for a deterministic centre of the band.
    world.get<Offense>(player, C.Offense)!.critChance = 0;
    const sys = createCombatSystem({ input: ctrl, rng: new Rng(99), colliders: [] });
    const h = world.get<Health>(enemy, C.Health)!;
    const res = world.get<Resource>(player, C.Resource)!;

    let seconds = 0;
    const maxSteps = Math.ceil(10 / DT);
    for (let i = 0; i < maxSteps && h.current > 0; i++) {
      // Simple rotation: Sunder when affordable, else Cleaving Strike filler.
      state.ability = res.current >= 30 ? 1 : 0;
      sys.update(world, DT);
      seconds += DT;
    }

    expect(h.current).toBe(0);
    expect(seconds).toBeGreaterThanOrEqual(3);
    expect(seconds).toBeLessThanOrEqual(6);
  });
});
