// Ground-AoE zones (the Lv 16 tool): a persistent hazard that ticks damage to every
// enemy inside its radius on a fixed cadence, then expires. Pure simulation. The same
// shape could later host friendly zones (e.g. a healing Consecration). See COMBAT_DESIGN.

import type { System, World, Entity } from '../../core/ecs/world';
import {
  C,
  type GroundAoe,
  type Transform,
  type Health,
} from '../../core/ecs/components';
import type { Rng } from '../../core/rng';
import { applyDamage } from '../combat/apply';
import { rewardKill } from '../rewards';
import { CombatEvent, type PlayerDiedEvent } from '../combat/events';

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
          if (g.hitsPlayer) tickPlayer(world, g, gt, rng);
          else tickEnemies(world, g, gt, rng);
        }

        if (g.ttl <= 0) world.destroyEntity(e);
      }
    },
  };
}

/** Player tool: damage every living enemy inside the radius (and pay out kills). */
function tickEnemies(world: World, g: GroundAoe, gt: Transform, rng: Rng): void {
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

/** Boss heavy attack: a single telegraphed hit to the player if they didn't step out. */
function tickPlayer(world: World, g: GroundAoe, gt: Transform, rng: Rng): void {
  let player: Entity | null = null;
  for (const p of world.query(C.PlayerControlled, C.Transform, C.Health)) {
    player = p;
    break;
  }
  if (player == null) return;
  const h = world.get<Health>(player, C.Health)!;
  if (h.current <= 0) return;
  const pt = world.get<Transform>(player, C.Transform)!;
  if (Math.hypot(pt.x - gt.x, pt.z - gt.z) > g.radius) return; // dodged the telegraph
  const r = applyDamage(
    world,
    g.source,
    player,
    { base: g.base, coeff: g.coeff, damageType: g.damageType },
    rng,
    0,
  );
  if (r.killed) world.events.emit<PlayerDiedEvent>(CombatEvent.PlayerDied, { entity: player });
}
