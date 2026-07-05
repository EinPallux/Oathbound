// The "sim runs headless on Node" invariant, pinned forever. The multiplayer server boots the
// world through the SAME createSimWorld this test uses (src/sim/boot/sim-world.ts), so if the
// simulation ever grows a hidden dependency on the browser (three.js, the DOM, requestAnimation-
// Frame) this test fails long before the server does. It ticks the real system pipeline 300×
// (10 s at 30 Hz) with a null input — a "player who does nothing" — and asserts the world
// advances without crashing while enemy AI runs.

import { describe, it, expect } from 'vitest';
import { Heightfield } from '../../src/world/heightfield';
import { createSimWorld } from '../../src/sim/boot/sim-world';
import { createNullControlState } from '../../src/platform/null-input';
import { VOXEL_CUBE, VOXEL_STEP } from '../../src/world/layout';
import { WORLD_SPAWNS } from '../../src/sim/content/spawns';
import { DT } from '../../src/core/time';
import { C, type Transform } from '../../src/core/ecs/components';

describe('server sim smoke — the sim ticks headless on Node', () => {
  it('boots the shared sim world and advances 300 ticks while AI runs, without crashing', () => {
    // A flat, open field with the Cube-World collision grid the server switches on.
    const res = 65;
    const field = new Heightfield(128, res, new Float32Array(res * res));
    field.voxelCube = VOXEL_CUBE;
    field.voxelStep = VOXEL_STEP;

    // A handful of real Greenmarch enemies near the origin (so they aggro/wander the idle player).
    const spawns = WORLD_SPAWNS.slice(0, 8);

    const sim = createSimWorld({
      field,
      colliders: [],
      boxes: [],
      playerStart: { x: 0, z: 0 },
      spawns,
      bosses: [],
      oathstones: [{ id: 'home', name: 'Home', x: 0, z: 0 }],
      vendor: { name: 'Quartermaster', x: 3, z: -3 },
      input: createNullControlState(),
    });

    // The player entity and every enemy were created.
    expect(sim.player).toBeGreaterThan(0);
    const enemies = [...sim.world.query(C.Enemy)];
    expect(enemies.length).toBe(spawns.length);

    // Record starting positions so we can prove the AI moved something.
    const startPos = new Map<number, { x: number; z: number }>();
    for (const e of enemies) {
      const t = sim.world.get<Transform>(e, C.Transform)!;
      startPos.set(e, { x: t.x, z: t.z });
    }

    // Advance the real system pipeline for 10 s of sim time.
    expect(() => {
      for (let i = 0; i < 300; i++) sim.world.update(DT);
    }).not.toThrow();

    // The player is still a live entity (alive, or respawned by the recovery system).
    expect(sim.world.has(sim.player!)).toBe(true);
    expect(sim.world.get(sim.player!, C.Health)).toBeDefined();

    // Enemy AI ran: at least one enemy changed position over the 300 ticks.
    let moved = 0;
    for (const e of enemies) {
      const t = sim.world.get<Transform>(e, C.Transform);
      const s = startPos.get(e);
      if (t && s && Math.hypot(t.x - s.x, t.z - s.z) > 0.01) moved++;
    }
    expect(moved).toBeGreaterThan(0);
  });
});
