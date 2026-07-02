// Kinematic character movement: camera-relative WASD, gravity + jump, static-collider
// resolution, and terrain ground-snap. Pure simulation (no Three.js); reads control
// state + heightfield data. See docs/technical/ARCHITECTURE_PLAN.md (ADR-008).

import type { System } from '../../core/ecs/world';
import {
  C,
  type Transform,
  type Velocity,
  type Character,
  type Statuses,
} from '../../core/ecs/components';
import { clamp } from '../../core/math';
import type { ControlState } from '../../platform/input';
import type { Heightfield, CylinderCollider } from '../../world/heightfield';
import { resolveCircleVsCylinders, resolveCircleVsBoxes, type BoxCollider } from '../collision';
import { statusMagnitude, Status } from '../combat/statuses';

const GRAVITY = 20;
/** Seconds of standing still to summon the mount (a channelled cast; moving cancels it). */
export const MOUNT_CAST_TIME = 2;
/** Move-speed multiplier while mounted (+60%). */
export const MOUNT_SPEED_MULT = 1.6;

export interface MovementDeps {
  input: ControlState;
  field: Heightfield;
  colliders: readonly CylinderCollider[];
  /** Solid building footprints (the starting village). Resolved after the cylinders. */
  boxes?: readonly BoxCollider[];
}

export function createMovementSystem(deps: MovementDeps): System {
  const { input, field, colliders, boxes } = deps;
  const bound = field.size / 2 - 1;

  return {
    name: 'movement',
    update(world, dt) {
      for (const e of world.query(C.PlayerControlled, C.Transform, C.Velocity, C.Character)) {
        const t = world.get<Transform>(e, C.Transform)!;
        const v = world.get<Velocity>(e, C.Velocity)!;
        const ch = world.get<Character>(e, C.Character)!;

        // Retain previous state for render interpolation.
        t.prevX = t.x;
        t.prevY = t.y;
        t.prevZ = t.z;
        t.prevYaw = t.yaw;

        // Normalised input in the camera's local frame.
        let fwd = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
        let strafe = (input.right ? 1 : 0) - (input.left ? 1 : 0);
        const mag = Math.hypot(fwd, strafe);
        if (mag > 1) {
          fwd /= mag;
          strafe /= mag;
        }

        // World-space move direction from the camera yaw. Forward follows where the
        // camera looks: forward(yaw) = (sin, cos). Screen-right must match the camera's
        // actual right axis — Three's lookAt builds right = cross(up, eye−target), which
        // at yaw 0 (camera south of the player) is world −x. So right(yaw) = (−cos, sin);
        // strafing D moves toward the right of the screen. (Using (cos, −sin) here inverts
        // A/D relative to the camera — the classic strafe-inversion bug.)
        const sy = Math.sin(input.yaw);
        const cy = Math.cos(input.yaw);
        const moveX = sy * fwd - cy * strafe;
        const moveZ = cy * fwd + sy * strafe;

        // Mount (Shift): toggle. Dismount is instant; summoning is a MOUNT_CAST_TIME channel
        // that any movement cancels. On a completed channel the rider is mounted.
        if (input.consumeMount()) {
          if (ch.mounted) ch.mounted = false;
          else if (ch.mountCast > 0) ch.mountCast = 0; // cancel a summon in progress
          else ch.mountCast = MOUNT_CAST_TIME;
        }
        if (ch.mountCast > 0) {
          if (mag > 0) ch.mountCast = 0; // moving cancels the summon
          else {
            ch.mountCast -= dt;
            if (ch.mountCast <= 0) {
              ch.mountCast = 0;
              ch.mounted = true;
            }
          }
        }

        // Fleet (Disengage) gives a brief move-speed bonus; the mount grants a flat bonus.
        const fleet = statusMagnitude(world.get<Statuses>(e, C.Statuses), Status.Fleet);
        const speed = ch.runSpeed * (ch.mounted ? MOUNT_SPEED_MULT : 1) * (1 + fleet);
        v.x = moveX * speed;
        v.z = moveZ * speed;

        // Gravity + jump.
        v.y -= GRAVITY * dt;
        if (ch.grounded && input.consumeJump()) {
          v.y = ch.jumpSpeed;
          ch.grounded = false;
        }

        // Integrate.
        t.x += v.x * dt;
        t.y += v.y * dt;
        t.z += v.z * dt;

        // Resolve against static props (cylinders) then buildings (boxes), then clamp.
        let r = resolveCircleVsCylinders(t.x, t.z, ch.radius, colliders);
        if (boxes && boxes.length) r = resolveCircleVsBoxes(r.x, r.z, ch.radius, boxes);
        let nx = clamp(r.x, -bound, bound);
        let nz = clamp(r.z, -bound, bound);

        // Voxel ("Cube World") mode: cube side-faces act as walls. While grounded, block a
        // horizontal move that would raise the ground by more than ~1.5 cube steps, resolved
        // per-axis so you slide along a cliff instead of sticking. Gentle stepped slopes (one
        // step) still auto-climb, and jumping (airborne) is unaffected so you can hop up ledges.
        if (field.voxelCube > 0 && ch.grounded) {
          const maxStep = field.voxelStep * 1.5 + 0.05;
          const g0 = field.sample(t.prevX, t.prevZ);
          if (field.sample(nx, t.prevZ) - g0 > maxStep) nx = t.prevX;
          if (field.sample(nx, nz) - g0 > maxStep) nz = t.prevZ;
        }
        t.x = nx;
        t.z = nz;

        // Ground-snap: the capsule centre sits halfHeight above the terrain.
        const groundY = field.sample(t.x, t.z) + ch.halfHeight;
        if (t.y <= groundY) {
          t.y = groundY;
          if (v.y < 0) v.y = 0;
          ch.grounded = true;
        } else {
          ch.grounded = false;
        }

        // Face the movement direction.
        if (mag > 0) t.yaw = Math.atan2(moveX, moveZ);
      }
    },
  };
}
