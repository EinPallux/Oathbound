// Ground-AoE zones (the Lv 16 tool): a persistent hazard that ticks damage to every
// enemy inside its radius on a fixed cadence, then expires. Pure simulation. The same
// shape could later host friendly zones (e.g. a healing Consecration). See COMBAT_DESIGN.

import type { System, World } from '../../core/ecs/world';
import {
  C,
  type GroundAoe,
  type Transform,
  type Health,
} from '../../core/ecs/components';
import type { Rng } from '../../core/rng';
import { applyDamage } from '../combat/apply';
import { rewardKill } from '../rewards';

export function createGroundAoeSystem(rng: Rng): System {
  return {
    name: 'ground-aoe',
    update(world: World, dt: number): void {
      for (const e of world.query(C.GroundAoe, C.Transform)) {
        const g = world.get<GroundAoe>(e, C.GroundAoe)!;
        const gt = world.get<Transform>(e, C.Transform)!;

        g.ttl -= dt;
        g.tickTimer -= dt;
        if (g.tickTimer <= 0) {
          g.tickTimer += g.tickEvery;
          for (const enemy of world.query(C.Enemy, C.Transform, C.Health)) {
            const h = world.get<Health>(enemy, C.Health)!;
            if (h.current <= 0) continue;
            const et = world.get<Transform>(enemy, C.Transform)!;
            if (Math.hypot(et.x - gt.x, et.z - gt.z) > g.radius) continue;
            const r = applyDamage(
              world,
              g.source,
              enemy,
              { base: g.base, coeff: g.coeff, damageType: g.damageType },
              rng,
              0,
            );
            if (r.killed) rewardKill(world, g.source, enemy, rng);
          }
        }

        if (g.ttl <= 0) world.destroyEntity(e);
      }
    },
  };
}
