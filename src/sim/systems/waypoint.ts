// Oathstones: activate on proximity (first visit) and bind the player's respawn to
// the nearest visited one. Runs for EVERY player (shared world), and unlocks are tracked
// per-player (WaypointUnlocks) so one character's discoveries never leak into another's.
// The stone's own `activated` flag stays as a cosmetic "someone lit this" world marker.
// Pure sim.

import type { System, World } from '../../core/ecs/world';
import {
  C,
  type Transform,
  type Oathstone,
  type Respawn,
  type WaypointUnlocks,
} from '../../core/ecs/components';
import { CombatEvent, type OathstoneActivatedEvent } from '../combat/events';

const ACTIVATE_RADIUS = 4;

export function createWaypointSystem(): System {
  return {
    name: 'waypoint',
    update(world: World): void {
      for (const player of world.query(C.PlayerControlled, C.Transform, C.Respawn)) {
        const pt = world.get<Transform>(player, C.Transform)!;
        const respawn = world.get<Respawn>(player, C.Respawn)!;
        const unlocks = world.get<WaypointUnlocks>(player, C.WaypointUnlocks);

        for (const e of world.query(C.Oathstone, C.Transform)) {
          const os = world.get<Oathstone>(e, C.Oathstone)!;
          const ot = world.get<Transform>(e, C.Transform)!;
          if (Math.hypot(pt.x - ot.x, pt.z - ot.z) > ACTIVATE_RADIUS) continue;

          // First time THIS player reaches the stone: add it to their network + announce.
          if (unlocks && !unlocks.ids.includes(os.id)) {
            unlocks.ids.push(os.id);
            os.activated = true; // cosmetic: the obelisk lights up in the world for everyone
            world.events.emit<OathstoneActivatedEvent>(CombatEvent.OathstoneActivated, {
              entity: e,
              name: os.name,
            });
          }
          // Bind respawn to the stone you're standing at.
          respawn.x = ot.x;
          respawn.z = ot.z;
        }
      }
    },
  };
}
