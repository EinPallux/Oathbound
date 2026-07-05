// Client prediction + reconciliation. The prediction uses the SAME movement code as the server
// (createMovementSystem), so "reconcile to a state the client agrees with" must leave the client
// exactly where it predicted — and a genuine correction must snap it there.

import { describe, it, expect } from 'vitest';
import { Heightfield } from '../../src/world/heightfield';
import { PredictedPlayer } from '../../src/net/prediction';
import { VOXEL_CUBE, VOXEL_STEP } from '../../src/world/layout';
import type { InputMessage } from '../../src/net/protocol';

function fwd(seq: number): InputMessage {
  return { t: 'input', seq, forward: true, back: false, left: false, right: false, yaw: 0, jump: false };
}
function field(): Heightfield {
  const res = 65;
  const f = new Heightfield(128, res, new Float32Array(res * res));
  f.voxelCube = VOXEL_CUBE;
  f.voxelStep = VOXEL_STEP;
  return f;
}

describe('client prediction + reconciliation', () => {
  it('reconciling to an agreed server state is stable (no rubber-banding)', () => {
    // The "true" predicted end after inputs 1,2,3.
    const ref = new PredictedPlayer(field(), [], [], { x: 0, z: 0 });
    ref.predict(fwd(1));
    ref.predict(fwd(2));
    ref.predict(fwd(3));
    const refPos = { x: ref.transform.x, z: ref.transform.z };

    // The server has applied only inputs 1 and 2 (its authoritative post-seq-2 state).
    const server = new PredictedPlayer(field(), [], [], { x: 0, z: 0 });
    server.predict(fwd(1));
    server.predict(fwd(2));
    const s = server.transform;

    // The client predicted 1,2,3, then reconciles to the server's post-2 state with ack=2.
    const client = new PredictedPlayer(field(), [], [], { x: 0, z: 0 });
    client.predict(fwd(1));
    client.predict(fwd(2));
    client.predict(fwd(3));
    client.reconcile(s.x, s.z, s.yaw, 2);

    // Only input 3 is still un-acked, and replaying it lands back on the predicted position.
    expect(client.pendingCount).toBe(1);
    expect(Math.hypot(client.transform.x - refPos.x, client.transform.z - refPos.z)).toBeLessThan(1e-3);
  });

  it('a server correction snaps the player and clears acked inputs', () => {
    const client = new PredictedPlayer(field(), [], [], { x: 0, z: 0 });
    client.predict(fwd(1));
    client.predict(fwd(2));
    client.predict(fwd(3));

    // Server fully acked (ack=3) but reports a different position (e.g. knockback).
    client.reconcile(5, -5, 0, 3);

    expect(client.pendingCount).toBe(0);
    expect(client.transform.x).toBeCloseTo(5, 4);
    expect(client.transform.z).toBeCloseTo(-5, 4);
  });
});
