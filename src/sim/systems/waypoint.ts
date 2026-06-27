// Oathstones: activate on proximity (first visit) and bind the player's respawn to
// the nearest visited one. Activated stones are the fast-travel network. Pure sim.

import type { System, World, Entity } from '../../core/ecs/world';
import {
  C,
  type Transform,
  type Oathstone,
  type Respawn,
} from '../../core/ecs/components';
import { CombatEvent, type OathstoneActivatedEvent } from '../combat/events';

const ACTIVATE_RADIUS = 4;

export function createWaypointSystem(): System {
  return {
    name: 'waypoint',
    update(world: World): void {
      let player: Entity | null = null;
      for (const p of world.query(C.PlayerControlled, C.Transform, C.Respawn)) {
        player = p;
        break;
      }
      if (player == null) return;
      const pt = world.get<Transform>(player, C.Transform)!;
      const respawn = world.get<Respawn>(player, C.Respawn)!;

      for (const e of world.query(C.Oathstone, C.Transform)) {
        const os = world.get<Oathstone>(e, C.Oathstone)!;
        const ot = world.get<Transform>(e, C.Transform)!;
        if (Math.hypot(pt.x - ot.x, pt.z - ot.z) > ACTIVATE_RADIUS) continue;
        if (!os.activated) {
          os.activated = true;
          world.events.emit<OathstoneActivatedEvent>(CombatEvent.OathstoneActivated, {
            entity: e,
            name: os.name,
          });
        }
        // Bind respawn to the stone you're standing at.
        respawn.x = ot.x;
        respawn.z = ot.z;
      }
    },
  };
}
