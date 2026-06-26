// Shared damage application: rolls + the canonical formula + status modifiers
// (Armor Break on the defender, Bulwark / Shaken on the player), applies HP, leech,
// and emits damage/heal events. Used by both the player combat system and enemy AI.
// Pure simulation (no Three.js/DOM).

import type { World, Entity } from '../../core/ecs/world';
import {
  C,
  type Offense,
  type Defense,
  type Health,
  type Transform,
  type Statuses,
  type Enemy,
} from '../../core/ecs/components';
import type { Rng } from '../../core/rng';
import { computeDamage, rollDamage, type AbilityHit } from './damage';
import { Status, statusMagnitude } from './statuses';
import { CombatEvent, type DamageEvent, type HealEvent } from './events';

export interface ApplyResult {
  amount: number;
  isCrit: boolean;
  /** True if this hit took the target from alive to dead. */
  killed: boolean;
}

/**
 * Apply one `hit` from `source` to `target`. `leech` heals the source for a
 * fraction of damage dealt. Returns the outcome; emits a `combat/damage` event
 * (and `combat/heal` when leeching).
 */
export function applyDamage(
  world: World,
  source: Entity,
  target: Entity,
  hit: AbilityHit,
  rng: Rng,
  leech = 0,
): ApplyResult {
  const off = world.get<Offense>(source, C.Offense)!;
  const def = world.get<Defense>(target, C.Defense)!;
  const h = world.get<Health>(target, C.Health)!;
  if (h.current <= 0) return { amount: 0, isCrit: false, killed: false };

  const targetStatuses = world.get<Statuses>(target, C.Statuses);
  const sourceStatuses = world.get<Statuses>(source, C.Statuses);

  // Armor Break lowers the defender's effective armor before mitigation.
  const armorBreak = statusMagnitude(targetStatuses, Status.ArmorBreak);
  const defAdj: Defense = { ...def, armor: Math.max(0, def.armor - armorBreak) };

  const roll = rollDamage(rng, off.critChance);
  const res = computeDamage(hit, off, defAdj, roll);

  // Post multipliers: Shaken weakens the source; Bulwark protects the target.
  let amount = res.amount;
  amount *= 1 - statusMagnitude(sourceStatuses, Status.Shaken);
  amount *= 1 - statusMagnitude(targetStatuses, Status.Bulwark);
  amount = Math.max(0, Math.round(amount));

  const before = h.current;
  h.current = Math.max(0, h.current - amount);
  const killed = before > 0 && h.current <= 0;

  // Taking a hit pulls an idle enemy into the fight (so ranged attacks aggro too).
  const en = world.get<Enemy>(target, C.Enemy);
  if (en && en.state === 'idle' && !killed) en.state = 'engage';

  const tr = world.get<Transform>(target, C.Transform)!;
  world.events.emit<DamageEvent>(CombatEvent.Damage, {
    source,
    target,
    amount,
    isCrit: res.isCrit,
    damageType: hit.damageType,
    abilityId: '',
    x: tr.x,
    y: tr.y,
    z: tr.z,
  });

  if (leech > 0 && amount > 0) {
    const sh = world.get<Health>(source, C.Health);
    if (sh && sh.current > 0) {
      const healed = Math.round(amount * leech);
      if (healed > 0) {
        sh.current = Math.min(sh.max, sh.current + healed);
        const str = world.get<Transform>(source, C.Transform);
        if (str) {
          world.events.emit<HealEvent>(CombatEvent.Heal, {
            entity: source,
            amount: healed,
            x: str.x,
            y: str.y,
            z: str.z,
          });
        }
      }
    }
  }

  return { amount, isCrit: res.isCrit, killed };
}
