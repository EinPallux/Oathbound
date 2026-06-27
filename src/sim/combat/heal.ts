// Healing — same shape as the damage formula (base + coeff*primary + healPower),
// can crit, no mitigation. Pure simulation; emits a heal event for floating text.

import type { World, Entity } from '../../core/ecs/world';
import { C, type Offense, type Health, type Transform } from '../../core/ecs/components';
import type { Rng } from '../../core/rng';
import { CombatEvent, type HealEvent } from './events';

/** Heal `target` from `source`'s stats. Returns HP actually restored. */
export function applyHeal(
  world: World,
  source: Entity,
  target: Entity,
  base: number,
  coeff: number,
  rng: Rng,
  flatBonus = 0,
): number {
  const off = world.get<Offense>(source, C.Offense);
  const h = world.get<Health>(target, C.Health);
  if (!off || !h || h.current <= 0) return 0;

  const isCrit = rng.next() < off.critChance;
  const variance = 0.95 + rng.next() * 0.1;
  let amount = base + coeff * off.primaryStat + off.healPower + flatBonus;
  if (isCrit) amount *= off.critMult;
  amount = Math.max(0, Math.round(amount * variance));

  const before = h.current;
  h.current = Math.min(h.max, h.current + amount);
  const healed = h.current - before;

  const tr = world.get<Transform>(target, C.Transform);
  if (tr && healed > 0) {
    world.events.emit<HealEvent>(CombatEvent.Heal, {
      entity: target,
      amount: healed,
      x: tr.x,
      y: tr.y,
      z: tr.z,
    });
  }
  return healed;
}
