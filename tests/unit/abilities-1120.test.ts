import { describe, it, expect } from 'vitest';
import { World } from '../../src/core/ecs/world';
import {
  C,
  type Health,
  type Enemy,
  type Statuses,
  type Resource,
  type GroundAoe,
  type Transform,
} from '../../src/core/ecs/components';
import { createCombatSystem } from '../../src/sim/systems/combat';
import { createEnemyAiSystem } from '../../src/sim/systems/enemy-ai';
import { createGroundAoeSystem } from '../../src/sim/systems/ground-aoe';
import { createPlayer, createBloomhusk } from '../../src/sim/factory';
import { Projectiles } from '../../src/sim/projectiles';
import { Rng } from '../../src/core/rng';
import { Status, hasStatus, addStatus } from '../../src/sim/combat/statuses';
import { DT } from '../../src/core/time';
import { flatField, makeInput, setLevel } from './helpers';

const FIELD = flatField();

function combatSetup(level: number) {
  const world = new World();
  const { ctrl, state } = makeInput();
  const player = createPlayer(world, FIELD, 0, 0);
  setLevel(world, player, level);
  const sys = createCombatSystem({
    input: ctrl,
    rng: new Rng(7),
    colliders: [],
    field: FIELD,
    projectiles: new Projectiles(),
  });
  return { world, state, player, sys };
}

describe('Lv 11–20 kit — interrupt', () => {
  it('cancels a winding-up enemy and silences + damages it', () => {
    const { world, state, sys } = combatSetup(12);
    const enemy = createBloomhusk(world, FIELD, 0, 3);
    const en = world.get<Enemy>(enemy, C.Enemy)!;
    en.state = 'attack';
    en.windupTimer = 0.5; // mid-telegraph
    const h = world.get<Health>(enemy, C.Health)!;

    state.ability = 6; // Pommel Strike (Warrior interrupt)
    sys.update(world, DT);

    expect(en.windupTimer).toBe(-1); // telegraph cancelled
    expect(hasStatus(world.get<Statuses>(enemy, C.Statuses), Status.Silence)).toBe(true);
    expect(h.current).toBeLessThan(h.max);
  });

  it('is gated until its unlock level', () => {
    const { world, state, sys } = combatSetup(11); // one below unlock
    const enemy = createBloomhusk(world, FIELD, 0, 3);
    const en = world.get<Enemy>(enemy, C.Enemy)!;
    en.state = 'attack';
    en.windupTimer = 0.5;

    state.ability = 6;
    sys.update(world, DT);

    expect(en.windupTimer).toBeCloseTo(0.5); // not interrupted — still locked
  });
});

describe('Lv 11–20 kit — Silence on the enemy AI', () => {
  it('a silenced enemy cannot begin a new wind-up', () => {
    const world = new World();
    const player = createPlayer(world, FIELD, 0, 0);
    setLevel(world, player, 12);
    const enemy = createBloomhusk(world, FIELD, 0, 1.5); // in melee range
    const en = world.get<Enemy>(enemy, C.Enemy)!;
    en.state = 'attack';
    en.attackTimer = 0;
    en.windupTimer = -1;
    const ai = createEnemyAiSystem({ field: FIELD, colliders: [], rng: new Rng(1) });

    addStatus(world.get<Statuses>(enemy, C.Statuses)!, Status.Silence, 3, 1);
    ai.update(world, DT);
    expect(en.windupTimer).toBe(-1); // silenced → no telegraph started

    world.get<Statuses>(enemy, C.Statuses)!.list.length = 0; // clear silence
    en.attackTimer = 0;
    ai.update(world, DT);
    expect(en.windupTimer).toBeGreaterThan(0); // now it winds up
  });
});

describe('Lv 11–20 kit — ground-AoE', () => {
  it('ticks damage to enemies in radius, then expires', () => {
    const world = new World();
    const player = createPlayer(world, FIELD, 0, 0);
    const enemy = createBloomhusk(world, FIELD, 0, 1);
    const h = world.get<Health>(enemy, C.Health)!;
    h.current = h.max = 1000; // survive several ticks

    const zone = world.createEntity();
    world.set<Transform>(zone, C.Transform, {
      x: 0, y: 0, z: 0, yaw: 0, prevX: 0, prevY: 0, prevZ: 0, prevYaw: 0,
    });
    world.set<GroundAoe>(zone, C.GroundAoe, {
      source: player,
      radius: 4,
      ttl: 3,
      tickEvery: 1,
      tickTimer: 0,
      base: 6,
      coeff: 1,
      damageType: 'physical',
    });
    const sys = createGroundAoeSystem(new Rng(3));

    sys.update(world, DT); // first tick lands immediately
    const afterFirst = h.current;
    expect(afterFirst).toBeLessThan(1000);

    // Run out the lifetime: more ticks land, then the zone despawns.
    for (let i = 0; i < Math.ceil(3 / DT) + 2; i++) sys.update(world, DT);
    expect(h.current).toBeLessThan(afterFirst);
    expect(world.has(zone)).toBe(false);
  });

  it('Earthsplitter (slot 7) drops a zone at the targeted enemy', () => {
    const { world, state, player, sys } = combatSetup(16);
    const enemy = createBloomhusk(world, FIELD, 0, 3);
    world.get<Resource>(player, C.Resource)!.current = 100; // enough Fury

    state.ability = 7; // Earthsplitter (Warrior ground-AoE)
    sys.update(world, DT);

    let zones = 0;
    for (const e of world.query(C.GroundAoe, C.Transform)) {
      const gt = world.get<Transform>(e, C.Transform)!;
      const et = world.get<Transform>(enemy, C.Transform)!;
      expect(Math.hypot(gt.x - et.x, gt.z - et.z)).toBeLessThan(1); // placed on the target
      zones++;
    }
    expect(zones).toBe(1);
  });
});
