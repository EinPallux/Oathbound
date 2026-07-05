// M2 "Shared World", pinned: multiple players in ONE sim world act independently — each drives
// its own entity via its own PlayerInput, enemies aggro the nearest player, and loot is
// owner-instanced (you can't take another player's drop). Exercises the real per-entity path on
// Node: createSimWorld (no primary player) + addPlayer × N + the real systems.

import { describe, it, expect } from 'vitest';
import { Heightfield } from '../../src/world/heightfield';
import { createSimWorld, addPlayer } from '../../src/sim/boot/sim-world';
import { NetworkControlState } from '../../src/net/net-input';
import { pickUpNearest } from '../../src/sim/systems/loot';
import { spawnEnemy } from '../../src/sim/content/enemies';
import { generateItem } from '../../src/sim/loot/items';
import { VOXEL_CUBE, VOXEL_STEP } from '../../src/world/layout';
import { DT } from '../../src/core/time';
import { C, type Transform, type Health, type LootDrop } from '../../src/core/ecs/components';

function makeWorld() {
  const res = 129;
  const field = new Heightfield(256, res, new Float32Array(res * res));
  field.voxelCube = VOXEL_CUBE;
  field.voxelStep = VOXEL_STEP;
  // No `input` → no primary player; we add players explicitly (as the server does per connection).
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
  expect(sim.player).toBeNull();
  return { sim, field };
}

const at = (sim: ReturnType<typeof makeWorld>['sim'], e: number) => {
  const t = sim.world.get<Transform>(e, C.Transform)!;
  return { x: t.x, z: t.z };
};
const hp = (sim: ReturnType<typeof makeWorld>['sim'], e: number) =>
  sim.world.get<Health>(e, C.Health)!.current;

const idle = { forward: false, back: false, left: false, right: false, yaw: 0, jump: false } as const;

describe('M2 shared world — independent players', () => {
  it('two players move independently from their own input', () => {
    const { sim, field } = makeWorld();
    const inA = new NetworkControlState();
    const inB = new NetworkControlState();
    const a = addPlayer(sim.world, field, inA, { x: 0, z: 0 });
    const b = addPlayer(sim.world, field, inB, { x: 40, z: 0 });
    const bStart = at(sim, b);

    // A drives forward; B sends nothing.
    inA.applyInput({ t: 'input', seq: 1, ...idle, forward: true });
    for (let i = 0; i < 30; i++) sim.world.update(DT);

    expect(Math.hypot(at(sim, a).x - 0, at(sim, a).z - 0)).toBeGreaterThan(0.5); // A moved
    expect(Math.hypot(at(sim, b).x - bStart.x, at(sim, b).z - bStart.z)).toBeLessThan(0.01); // B still
  });

  it('an enemy aggros the nearest player, leaving the far one untouched', () => {
    const { sim, field } = makeWorld();
    const a = addPlayer(sim.world, field, new NetworkControlState(), { x: 0, z: 0 });
    const b = addPlayer(sim.world, field, new NetworkControlState(), { x: 40, z: 0 });
    // A lone enemy right next to B, far from A.
    spawnEnemy(sim.world, field, 'reaver', 41, 0, { level: 3 });

    const aHp0 = hp(sim, a);
    const bHp0 = hp(sim, b);
    for (let i = 0; i < 150; i++) sim.world.update(DT); // 5 s — enough to close + attack

    expect(hp(sim, b)).toBeLessThan(bHp0); // the nearby player took hits
    expect(hp(sim, a)).toBe(aHp0); // the far player was never targeted
  });

  it('loot is owner-instanced — you cannot take another player’s drop', () => {
    const { sim, field } = makeWorld();
    const a = addPlayer(sim.world, field, new NetworkControlState(), { x: 0, z: 0 });
    const b = addPlayer(sim.world, field, new NetworkControlState(), { x: 0.5, z: 0 });

    // A drop owned by A, in range of both players.
    const item = generateItem(sim.rng, { ilvl: 1, slot: 'weapon', rarity: 'common', primaryStat: 'STR' });
    const drop = sim.world.createEntity();
    sim.world.set<Transform>(drop, C.Transform, {
      x: 0, y: 0, z: 0, yaw: 0, prevX: 0, prevY: 0, prevZ: 0, prevYaw: 0,
    });
    sim.world.set<LootDrop>(drop, C.LootDrop, { item, gold: 0, owner: a, ttl: 100 });

    // B is standing on it but does not own it → cannot pick it up. A can.
    expect(pickUpNearest(sim.world, b)).toBeNull();
    expect(pickUpNearest(sim.world, a)?.uid).toBe(item.uid);
  });
});
