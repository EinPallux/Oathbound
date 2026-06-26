// Target-dummy behaviour: once a dummy's HP hits 0 it stays down for a moment, then
// resets to full so it can be hit again. (Death is emitted by the combat system; the
// dummy only owns the respawn.) Pure simulation — no Three.js/DOM.

import type { System, World } from '../../core/ecs/world';
import { C, type Health, type Dummy } from '../../core/ecs/components';
import { CombatEvent, type RespawnEvent } from '../combat/events';

export function createDummySystem(): System {
  return {
    name: 'dummy',
    update(world: World, dt: number): void {
      for (const e of world.query(C.Dummy, C.Health)) {
        const d = world.get<Dummy>(e, C.Dummy)!;
        const h = world.get<Health>(e, C.Health)!;
        if (h.current > 0) continue;

        if (!d.dead) {
          d.dead = true;
          d.deadFor = 0;
        }
        d.deadFor += dt;
        if (d.deadFor >= d.respawnDelay) {
          h.current = h.max;
          d.dead = false;
          d.deadFor = 0;
          world.events.emit<RespawnEvent>(CombatEvent.Respawn, { entity: e });
        }
      }
    },
  };
}
