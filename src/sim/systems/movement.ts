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
import { resolveCircleVsCylinders } from '../collision';
import { statusMagnitude, Status } from '../combat/statuses';

const GRAVITY = 20;

export interface MovementDeps {
  input: ControlState;
  field: Heightfield;
  colliders: readonly CylinderCollider[];
}

export function createMovementSystem(deps: MovementDeps): System {
  const { input, field, colliders } = deps;
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

        // Fleet (Disengage) gives a brief move-speed bonus.
        const fleet = statusMagnitude(world.get<Statuses>(e, C.Statuses), Status.Fleet);
        const speed = (input.sprint ? ch.sprintSpeed : ch.runSpeed) * (1 + fleet);
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

        // Resolve against static props, then clamp to world bounds.
        const r = resolveCircleVsCylinders(t.x, t.z, ch.radius, colliders);
        t.x = clamp(r.x, -bound, bound);
        t.z = clamp(r.z, -bound, bound);

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
