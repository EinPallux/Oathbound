// Client-side prediction + server reconciliation for the LOCAL player's movement. The client
// can't wait a round-trip to see itself move, so it runs the *exact same* movement code the
// server runs (createMovementSystem over the same heightfield + colliders — all isomorphic) on
// a one-entity world, applying each input immediately. When an authoritative snapshot arrives,
// it snaps the predicted player to the server's position and replays the inputs the server
// hasn't acknowledged yet. Same code + same inputs → the prediction matches the server, and a
// correction (knockback, a rejected move) is a small snap instead of visible rubber-banding.
//
// Isomorphic: no three/DOM/Node. Only the local player is predicted; remote entities are
// interpolated by the renderer. See docs/production/MMO_ROADMAP.md (M4).

import { World, type Entity } from '../core/ecs/world';
import { C, type Transform, type ClassId } from '../core/ecs/components';
import { createPlayer, PLAYER_HALF } from '../sim/factory';
import { createMovementSystem } from '../sim/systems/movement';
import { DT } from '../core/time';
import type { Heightfield, CylinderCollider } from '../world/heightfield';
import type { BoxCollider } from '../sim/collision';
import type { ControlState } from '../platform/input';
import type { InputMessage } from './protocol';

/** A ControlState set straight from an input packet — no seq dedup, so it can be replayed. */
class ReplayControl implements ControlState {
  forward = false;
  back = false;
  left = false;
  right = false;
  yaw = 0;
  pitch = 0.5;
  dist = 10;
  private jumpQueued = false;

  set(m: InputMessage): void {
    this.forward = m.forward;
    this.back = m.back;
    this.left = m.left;
    this.right = m.right;
    this.yaw = m.yaw;
    if (m.jump) this.jumpQueued = true;
  }

  consumeJump(): boolean {
    const j = this.jumpQueued;
    this.jumpQueued = false;
    return j;
  }
  consumeMount(): boolean {
    return false;
  }
  consumeAbility(): number | null {
    return null;
  }
  consumeTargetCycle(): boolean {
    return false;
  }
  consumeEscape(): boolean {
    return false;
  }
  consumeClick(): { ndcX: number; ndcY: number } | null {
    return null;
  }
  consumeInteract(): boolean {
    return false;
  }
  consumeToggleInventory(): boolean {
    return false;
  }
  consumeToggleCharacter(): boolean {
    return false;
  }
  consumeToggleTravel(): boolean {
    return false;
  }
  consumeToggleMap(): boolean {
    return false;
  }
  consumeToggleSettings(): boolean {
    return false;
  }
}

/** Cap on un-acked buffered inputs (~10 s at 30 Hz) so a silent server can't grow it forever. */
const MAX_PENDING = 300;

export class PredictedPlayer {
  private readonly world: World;
  private readonly entity: Entity;
  private readonly control = new ReplayControl();
  private readonly field: Heightfield;
  /** Inputs sent but not yet acknowledged by the server (replayed on reconcile). */
  private pending: InputMessage[] = [];

  constructor(
    field: Heightfield,
    colliders: CylinderCollider[],
    boxes: BoxCollider[],
    spawn: { x: number; z: number },
    classId?: ClassId,
  ) {
    this.field = field;
    this.world = new World();
    this.entity = createPlayer(this.world, field, spawn.x, spawn.z, classId);
    this.world.set<ControlState>(this.entity, C.PlayerInput, this.control);
    this.world.addSystem(createMovementSystem({ field, colliders, boxes }));
  }

  /** Predict one tick forward from a fresh local input (also buffered for reconciliation). */
  predict(msg: InputMessage): void {
    this.pending.push(msg);
    // Bound the buffer: if the server goes silent (no snapshots → no reconcile drains this), it
    // must not grow without limit. A few seconds of unacked input at 30 Hz is ample headroom.
    if (this.pending.length > MAX_PENDING) this.pending.splice(0, this.pending.length - MAX_PENDING);
    this.control.set(msg);
    this.world.update(DT);
  }

  /**
   * The server sent the authoritative local-player transform + the last input seq it applied:
   * drop acknowledged inputs, snap to the server state, and replay the rest.
   */
  reconcile(x: number, z: number, yaw: number, ack: number): void {
    this.pending = this.pending.filter((m) => m.seq > ack);
    const t = this.world.get<Transform>(this.entity, C.Transform)!;
    t.x = x;
    t.z = z;
    t.y = this.field.sample(x, z) + PLAYER_HALF;
    t.yaw = yaw;
    t.prevX = x;
    t.prevZ = z;
    t.prevY = t.y;
    t.prevYaw = yaw;
    for (const m of this.pending) {
      this.control.set(m);
      this.world.update(DT);
    }
  }

  /** The current predicted transform (what the local player mesh renders at). */
  get transform(): Transform {
    return this.world.get<Transform>(this.entity, C.Transform)!;
  }

  /** Number of un-acked inputs currently buffered (for diagnostics/tests). */
  get pendingCount(): number {
    return this.pending.length;
  }
}
