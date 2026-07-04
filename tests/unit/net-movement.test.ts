// The M1 milestone, pinned: a client input packet drives the authoritative player, and the
// world snapshot reflects it. Exercises the real, isomorphic net path (NetworkControlState →
// the movement system inside createSimWorld → buildSnapshot) on Node — the same code the server
// runs, minus the WebSocket transport.

import { describe, it, expect } from 'vitest';
import { Heightfield } from '../../src/world/heightfield';
import { createSimWorld } from '../../src/sim/boot/sim-world';
import { NetworkControlState } from '../../src/net/net-input';
import { buildSnapshot } from '../../src/net/snapshot';
import { VOXEL_CUBE, VOXEL_STEP } from '../../src/world/layout';
import { DT } from '../../src/core/time';
import { C, type Transform } from '../../src/core/ecs/components';

function makeWorld() {
  const res = 65;
  const field = new Heightfield(128, res, new Float32Array(res * res));
  field.voxelCube = VOXEL_CUBE;
  field.voxelStep = VOXEL_STEP;
  const input = new NetworkControlState();
  const sim = createSimWorld({
    field,
    colliders: [],
    boxes: [],
    playerStart: { x: 0, z: 0 },
    spawns: [],
    bosses: [],
    oathstones: [{ id: 'home', name: 'Home', x: 0, z: 0 }],
    vendor: { name: 'Quartermaster', x: 3, z: -3 },
    input,
  });
  return { sim, input };
}

const pos = (sim: ReturnType<typeof makeWorld>['sim']) => {
  const t = sim.world.get<Transform>(sim.player, C.Transform)!;
  return { x: t.x, z: t.z };
};

describe('networked movement — input → authoritative sim → snapshot', () => {
  it('moves the server player on a forward packet and halts when it is released', () => {
    const { sim, input } = makeWorld();
    const start = pos(sim);

    // No input → the player stays put.
    for (let i = 0; i < 10; i++) sim.world.update(DT);
    const idle = pos(sim);
    expect(Math.hypot(idle.x - start.x, idle.z - start.z)).toBeLessThan(0.01);

    // A forward input packet → the player moves.
    input.applyInput({ t: 'input', seq: 1, forward: true, back: false, left: false, right: false, yaw: 0, jump: false });
    for (let i = 0; i < 30; i++) sim.world.update(DT);
    const moved = pos(sim);
    expect(Math.hypot(moved.x - idle.x, moved.z - idle.z)).toBeGreaterThan(0.5);

    // The snapshot carries the player at its new position + the applied seq as ack.
    const snap = buildSnapshot(sim.world, 40, input.seq);
    expect(snap.ack).toBe(1);
    const self = snap.ents.find((e) => e.id === sim.player);
    expect(self).toBeDefined();
    expect(self!.k).toBe('player');
    expect(Math.hypot(self!.x - moved.x, self!.z - moved.z)).toBeLessThan(0.02); // quantization only
    expect(self!.hp ?? 0).toBeGreaterThan(0);

    // Releasing forward → the player halts (kinematic movement, no drift).
    input.applyInput({ t: 'input', seq: 2, forward: false, back: false, left: false, right: false, yaw: 0, jump: false });
    for (let i = 0; i < 10; i++) sim.world.update(DT);
    const halted = pos(sim);
    expect(Math.hypot(halted.x - moved.x, halted.z - moved.z)).toBeLessThan(0.2);
  });

  it('ignores stale/duplicate input sequence numbers', () => {
    const { input } = makeWorld();
    input.applyInput({ t: 'input', seq: 5, forward: true, back: false, left: false, right: false, yaw: 1, jump: false });
    expect(input.seq).toBe(5);
    expect(input.forward).toBe(true);
    // An older packet is ignored (no rewind of state).
    input.applyInput({ t: 'input', seq: 3, forward: false, back: false, left: false, right: false, yaw: 0, jump: false });
    expect(input.seq).toBe(5);
    expect(input.forward).toBe(true);
    expect(input.yaw).toBe(1);
  });
});
