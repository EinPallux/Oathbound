// M5 "Playing Together" rules, pinned: threat-based aggro, shared XP, owner-instanced loot, and
// world-boss HP scaling — all behaviour-neutral for a single player. Exercises the real sim on
// Node (createSimWorld + addPlayer + the combat/reward code).

import { describe, it, expect } from 'vitest';
import { Heightfield } from '../../src/world/heightfield';
import { createSimWorld, addPlayer } from '../../src/sim/boot/sim-world';
import { spawnEnemy } from '../../src/sim/content/enemies';
import { spawnBoss, BOSS_SPAWNS } from '../../src/sim/content/bosses';
import { addThreat } from '../../src/sim/combat/threat';
import { rewardKill } from '../../src/sim/rewards';
import { createNullControlState } from '../../src/platform/null-input';
import { VOXEL_CUBE, VOXEL_STEP } from '../../src/world/layout';
import { DT } from '../../src/core/time';
import {
  C,
  type Health,
  type Enemy,
  type Progression,
  type LootDrop,
  type Boss,
} from '../../src/core/ecs/components';

function makeWorld() {
  const res = 129;
  const field = new Heightfield(256, res, new Float32Array(res * res));
  field.voxelCube = VOXEL_CUBE;
  field.voxelStep = VOXEL_STEP;
  const sim = createSimWorld({
    field,
    colliders: [],
    boxes: [],
    playerStart: { x: 0, z: 0 },
    spawns: [],
    bosses: [],
    oathstones: [{ id: 'home', name: 'Home', x: 0, z: 0 }],
    vendor: { name: 'Quartermaster', x: 3, z: -3 },
  });
  return { sim, field };
}
const hp = (sim: ReturnType<typeof makeWorld>['sim'], e: number) => sim.world.get<Health>(e, C.Health)!;

describe('M5 playing together', () => {
  it('an enemy targets the highest-threat player, not the nearest', () => {
    const { sim, field } = makeWorld();
    // A and B are the same distance from the enemy; A has far more threat, so A is the target.
    const a = addPlayer(sim.world, field, createNullControlState(), { x: 3, z: 0 });
    const b = addPlayer(sim.world, field, createNullControlState(), { x: -3, z: 0 });
    const enemy = spawnEnemy(sim.world, field, 'reaver', 0, 0, { level: 3 });
    sim.world.get<Enemy>(enemy, C.Enemy)!.state = 'engage';
    addThreat(sim.world, enemy, a, 500);
    addThreat(sim.world, enemy, b, 20);

    const aMax = hp(sim, a).max;
    const bMax = hp(sim, b).max;
    for (let i = 0; i < 200; i++) sim.world.update(DT);

    expect(hp(sim, a).current).toBeLessThan(aMax); // the high-threat player got hit
    expect(hp(sim, b).current).toBe(bMax); // the low-threat player was ignored
  });

  it('shares full XP with every participant and gives each their own instanced loot', () => {
    const { sim, field } = makeWorld();
    const a = addPlayer(sim.world, field, createNullControlState(), { x: 0, z: 0 });
    const b = addPlayer(sim.world, field, createNullControlState(), { x: 1, z: 0 });
    const enemy = spawnEnemy(sim.world, field, 'reaver', 0.5, 0, { level: 3 });
    // Both players damaged it (built threat); A lands the final blow.
    addThreat(sim.world, enemy, a, 40);
    addThreat(sim.world, enemy, b, 60);

    const xpA0 = sim.world.get<Progression>(a, C.Progression)!.xp;
    const xpB0 = sim.world.get<Progression>(b, C.Progression)!.xp;
    rewardKill(sim.world, a, enemy, sim.rng);

    // Both participants earned XP.
    expect(sim.world.get<Progression>(a, C.Progression)!.xp).toBeGreaterThan(xpA0);
    expect(sim.world.get<Progression>(b, C.Progression)!.xp).toBeGreaterThan(xpB0);

    // Two loot drops, one owned by each player (no shared/contested loot).
    const drops = [...sim.world.query(C.LootDrop)].map((e) => sim.world.get<LootDrop>(e, C.LootDrop)!);
    expect(drops.length).toBe(2);
    expect(new Set(drops.map((d) => d.owner))).toEqual(new Set([a, b]));
  });

  it('a solo kill still gives exactly one drop, owned by the killer', () => {
    const { sim, field } = makeWorld();
    const a = addPlayer(sim.world, field, createNullControlState(), { x: 0, z: 0 });
    const enemy = spawnEnemy(sim.world, field, 'reaver', 0.5, 0, { level: 3 });
    addThreat(sim.world, enemy, a, 100);
    rewardKill(sim.world, a, enemy, sim.rng);

    const drops = [...sim.world.query(C.LootDrop)].map((e) => sim.world.get<LootDrop>(e, C.LootDrop)!);
    expect(drops.length).toBe(1);
    expect(drops[0].owner).toBe(a);
  });

  it('a world boss scales HP with engaged players and stays base HP solo', () => {
    // Solo: base HP, no scaling.
    {
      const { sim, field } = makeWorld();
      addPlayer(sim.world, field, createNullControlState(), { x: 1, z: 0 });
      const boss = spawnBoss(sim.world, field, BOSS_SPAWNS[0].id, 0, 0);
      const base = hp(sim, boss).max;
      sim.world.get<Enemy>(boss, C.Enemy)!.state = 'engage';
      sim.world.update(DT);
      expect(hp(sim, boss).max).toBe(base);
      expect(sim.world.get<Boss>(boss, C.Boss)!.scaledForPlayers).toBe(1);
    }
    // Three players in range: base × (1 + 2·0.6) = base × 2.2.
    {
      const { sim, field } = makeWorld();
      addPlayer(sim.world, field, createNullControlState(), { x: 1, z: 0 });
      addPlayer(sim.world, field, createNullControlState(), { x: 2, z: 0 });
      addPlayer(sim.world, field, createNullControlState(), { x: 3, z: 0 });
      const boss = spawnBoss(sim.world, field, BOSS_SPAWNS[0].id, 0, 0);
      const base = hp(sim, boss).max;
      sim.world.get<Enemy>(boss, C.Enemy)!.state = 'engage';
      sim.world.update(DT);
      expect(sim.world.get<Boss>(boss, C.Boss)!.scaledForPlayers).toBe(3);
      expect(hp(sim, boss).max).toBe(Math.round(base * 2.2));
    }
  });
});
