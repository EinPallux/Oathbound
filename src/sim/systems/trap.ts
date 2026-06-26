// Snare Trap behaviour: a placed trap roots (and lightly damages) the first enemy to
// enter it, then is consumed; untriggered traps despawn after their TTL. Pure sim.

import type { System, World } from '../../core/ecs/world';
import {
  C,
  type Trap,
  type Transform,
  type Health,
  type Statuses,
} from '../../core/ecs/components';
import type { Rng } from '../../core/rng';
import { applyDamage } from '../combat/apply';
import { addStatus, Status } from '../combat/statuses';
import { rewardKill } from '../rewards';

export function createTrapSystem(rng: Rng): System {
  return {
    name: 'trap',
    update(world: World, dt: number): void {
      for (const e of world.query(C.Trap, C.Transform)) {
        const trap = world.get<Trap>(e, C.Trap)!;
        const tt = world.get<Transform>(e, C.Transform)!;

        trap.ttl -= dt;
        if (trap.ttl <= 0) {
          world.destroyEntity(e);
          continue;
        }

        for (const enemy of world.query(C.Enemy, C.Transform, C.Health)) {
          const h = world.get<Health>(enemy, C.Health)!;
          if (h.current <= 0) continue;
          const et = world.get<Transform>(enemy, C.Transform)!;
          if (Math.hypot(et.x - tt.x, et.z - tt.z) > trap.radius) continue;

          const ss = world.get<Statuses>(enemy, C.Statuses);
          if (ss) addStatus(ss, Status.Root, trap.rootDuration, 1);
          const r = applyDamage(
            world,
            trap.source,
            enemy,
            { base: trap.base, coeff: trap.coeff, damageType: 'physical' },
            rng,
            0,
          );
          if (r.killed) rewardKill(world, trap.source, enemy, rng);
          world.destroyEntity(e); // single-use
          break;
        }
      }
    },
  };
}
