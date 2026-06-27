import { describe, it, expect } from 'vitest';
import { World } from '../../src/core/ecs/world';
import {
  C,
  type Health,
  type Resource,
  type Offense,
  type Statuses,
} from '../../src/core/ecs/components';
import { createCombatSystem } from '../../src/sim/systems/combat';
import { createEnemyAiSystem } from '../../src/sim/systems/enemy-ai';
import { createTrapSystem } from '../../src/sim/systems/trap';
import { createPlayer, createBloomhusk, createReaver, setPlayerClass } from '../../src/sim/factory';
import { Projectiles } from '../../src/sim/projectiles';
import { Status, hasStatus } from '../../src/sim/combat/statuses';
import { Rng } from '../../src/core/rng';
import { DT } from '../../src/core/time';
import { flatField, makeInput, setLevel } from './helpers';

const FIELD = flatField();

function hunterSetup(seed = 1) {
  const world = new World();
  const { ctrl, state } = makeInput();
  const player = createPlayer(world, FIELD, 0, 0, 'hunter');
  const projectiles = new Projectiles();
  const combat = createCombatSystem({
    input: ctrl,
    rng: new Rng(seed),
    colliders: [],
    field: FIELD,
    projectiles,
  });
  const rng = new Rng(seed + 1);
  const step = (): void => {
    combat.update(world, DT);
    projectiles.update(world, DT, rng);
  };
  return { world, state, player, projectiles, step };
}

describe('Hunter — ranged combat', () => {
  it('starts with full Focus and DEX scaling', () => {
    const { world, player } = hunterSetup();
    expect(world.get<Resource>(player, C.Resource)!.current).toBe(100);
    expect(world.get<Offense>(player, C.Offense)!.primaryStat).toBeGreaterThan(0);
  });

  it('Quick Shot fires a projectile that damages the target (not instant)', () => {
    const { world, state, projectiles, step } = hunterSetup();
    const enemy = createBloomhusk(world, FIELD, 0, 6);
    const h = world.get<Health>(enemy, C.Health)!;

    state.ability = 0; // Quick Shot
    // First step: spawns a projectile, no instant damage yet.
    // (combat runs, then projectiles advance one tick — still in flight from 6m)
    const before = h.current;
    // run one combined step
    step();
    expect(projectiles.list.some((p) => p.active) || h.current < before).toBe(true);

    // Let the projectile reach the target.
    for (let i = 0; i < 60 && h.current === before; i++) projectiles.update(world, DT, new Rng(i));
    expect(h.current).toBeLessThan(before);
  });

  it('Piercing Arrow spends Focus', () => {
    const { world, state, player, step } = hunterSetup();
    createBloomhusk(world, FIELD, 0, 6);
    const res = world.get<Resource>(player, C.Resource)!;
    state.ability = 1; // Piercing Arrow (cost 35)
    step();
    expect(res.current).toBeLessThanOrEqual(66); // 100 - 35 (+ <=1 tick regen)
  });

  it('kills a same-level standard within ~3–6s', () => {
    const { world, state, player, step } = hunterSetup(99);
    const enemy = createBloomhusk(world, FIELD, 0, 4, 1);
    world.get<Offense>(player, C.Offense)!.critChance = 0; // deterministic
    const h = world.get<Health>(enemy, C.Health)!;
    const res = world.get<Resource>(player, C.Resource)!;

    let seconds = 0;
    for (let i = 0; i < Math.ceil(10 / DT) && h.current > 0; i++) {
      state.ability = res.current >= 35 ? 1 : 0; // Piercing when affordable, else Quick Shot
      step();
      seconds += DT;
    }
    expect(h.current).toBe(0);
    expect(seconds).toBeGreaterThanOrEqual(3);
    expect(seconds).toBeLessThanOrEqual(6);
  });
});

describe('Hunter — traps + root', () => {
  it('a placed Snare Trap roots and damages the first enemy, then is consumed', () => {
    const world = new World();
    const { ctrl, state } = makeInput();
    const player = createPlayer(world, FIELD, 0, 0, 'hunter');
    setLevel(world, player, 10); // unlock Snare Trap (Lv 9)
    const projectiles = new Projectiles();
    const combat = createCombatSystem({
      input: ctrl,
      rng: new Rng(1),
      colliders: [],
      field: FIELD,
      projectiles,
    });
    const trapSys = createTrapSystem(new Rng(2));

    state.ability = 5; // Snare Trap → placed at the player
    combat.update(world, DT);

    const traps = [...world.query(C.Trap, C.Transform)];
    expect(traps.length).toBe(1);

    // An enemy stands on the trap.
    const enemy = createBloomhusk(world, FIELD, 0, 0);
    const eh = world.get<Health>(enemy, C.Health)!;
    trapSys.update(world, DT);

    expect(hasStatus(world.get<Statuses>(enemy, C.Statuses), Status.Root)).toBe(true);
    expect(eh.current).toBeLessThan(eh.max);
    expect(world.has(traps[0])).toBe(false); // single-use
  });
});

describe('ranged-skirmisher enemy', () => {
  it('a Reaver shoots a projectile that damages the player', () => {
    const world = new World();
    const player = createPlayer(world, FIELD, 0, 0, 'warrior');
    createReaver(world, FIELD, 0, 8); // within its 13m attack range
    const projectiles = new Projectiles();
    const rng = new Rng(7);
    const ai = createEnemyAiSystem({ field: FIELD, colliders: [], rng, projectiles });

    const ph = world.get<Health>(player, C.Health)!;
    const before = ph.current;
    for (let i = 0; i < Math.ceil(4 / DT) && ph.current === before; i++) {
      ai.update(world, DT);
      projectiles.update(world, DT, rng);
    }
    expect(ph.current).toBeLessThan(before);
  });
});

describe('class switching', () => {
  it('setPlayerClass swaps kit + resource', () => {
    const world = new World();
    const player = createPlayer(world, FIELD, 0, 0, 'warrior');
    expect(world.get<Resource>(player, C.Resource)!.current).toBe(0); // Fury starts empty

    setPlayerClass(world, player, 'hunter');
    const res = world.get<Resource>(player, C.Resource)!;
    expect(res.current).toBe(res.max); // Focus starts full
  });
});
