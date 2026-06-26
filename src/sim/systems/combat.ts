// Player combat: ticks the GCD/cooldowns, resolves soft tab-targeting, buffers the
// next ability press, and applies the canonical damage formula to the target. Pure
// simulation (no Three.js/DOM); emits combat events for rendering/UI to consume.
// See docs/design/COMBAT_DESIGN.md.

import type { System, World, Entity } from '../../core/ecs/world';
import {
  C,
  type Transform,
  type Offense,
  type Defense,
  type Health,
  type AbilityState,
  type Target,
} from '../../core/ecs/components';
import type { ControlState } from '../../platform/input';
import type { CylinderCollider } from '../../world/heightfield';
import type { Rng } from '../../core/rng';
import {
  ABILITIES,
  GCD,
  INPUT_BUFFER,
  TARGET_CONE_DEG,
  TAB_RANGE,
} from '../combat/abilities';
import { computeDamage, rollDamage } from '../combat/damage';
import {
  hostilesInCone,
  cycleTarget,
  segmentBlockedByCylinders,
  type Candidate,
} from '../combat/targeting';
import { CombatEvent, type DamageEvent, type DeathEvent } from '../combat/events';

const CONE_HALF = ((TARGET_CONE_DEG / 2) * Math.PI) / 180;
/** LoS shrink so grazing a rock's edge doesn't block a shot. */
const LOS_PAD = 0.25;

export interface CombatDeps {
  input: ControlState;
  rng: Rng;
  colliders: readonly CylinderCollider[];
}

export function createCombatSystem(deps: CombatDeps): System {
  const { input, rng, colliders } = deps;

  return {
    name: 'combat',
    update(world: World, dt: number): void {
      // Gather all live, targetable hostiles once per step.
      const candidates: Candidate[] = [];
      for (const e of world.query(C.Targetable, C.Transform, C.Health)) {
        const h = world.get<Health>(e, C.Health)!;
        if (h.current <= 0) continue;
        const tr = world.get<Transform>(e, C.Transform)!;
        candidates.push({ entity: e, x: tr.x, z: tr.z });
      }

      for (const e of world.query(
        C.PlayerControlled,
        C.Transform,
        C.Offense,
        C.AbilityState,
        C.Target,
      )) {
        const t = world.get<Transform>(e, C.Transform)!;
        const off = world.get<Offense>(e, C.Offense)!;
        const ab = world.get<AbilityState>(e, C.AbilityState)!;
        const tgt = world.get<Target>(e, C.Target)!;

        // 1) Advance timers.
        ab.gcdRemaining = Math.max(0, ab.gcdRemaining - dt);
        for (let i = 0; i < ab.cooldowns.length; i++) {
          ab.cooldowns[i] = Math.max(0, ab.cooldowns[i] - dt);
        }
        if (ab.bufferedIndex >= 0) {
          ab.bufferRemaining -= dt;
          if (ab.bufferRemaining <= 0) ab.bufferedIndex = -1;
        }

        // 2) Drop an invalid locked target (gone or dead).
        if (tgt.entity != null && !isAlive(world, tgt.entity)) tgt.entity = null;

        // 3) Targeting input.
        if (input.consumeTargetCycle()) {
          const inCone = hostilesInCone(
            t.x,
            t.z,
            input.yaw,
            TAB_RANGE,
            CONE_HALF,
            candidates,
          ).map((a) => a.entity);
          tgt.entity = cycleTarget(tgt.entity, inCone);
        }
        if (input.consumeClearTarget()) tgt.entity = null;

        // 4) Buffer an ability press.
        const req = input.consumeAbility();
        if (req != null && req >= 0 && req < ABILITIES.length) {
          ab.bufferedIndex = req;
          ab.bufferRemaining = INPUT_BUFFER;
        }

        // 5) Try to fire the buffered ability.
        if (ab.bufferedIndex < 0) continue;
        const def = ABILITIES[ab.bufferedIndex];
        if (ab.gcdRemaining > 0 || ab.cooldowns[ab.bufferedIndex] > 0) continue;

        // Resolve a victim: the locked target if usable, else soft-acquire.
        let victim: Entity | null = null;
        if (tgt.entity != null && usable(world, tgt.entity, t.x, t.z, def.range, colliders)) {
          victim = tgt.entity;
        } else {
          victim = softAcquire(world, t.x, t.z, input.yaw, def.range, colliders, candidates);
          if (victim != null) tgt.entity = victim; // lock onto the soft target
        }
        if (victim == null) continue; // keep the buffer; nothing to hit yet

        // 6) Apply the canonical formula.
        const tr = world.get<Transform>(victim, C.Transform)!;
        const dfn = world.get<Defense>(victim, C.Defense)!;
        const h = world.get<Health>(victim, C.Health)!;
        const roll = rollDamage(rng, off.critChance);
        const res = computeDamage(def, off, dfn, roll);
        h.current = Math.max(0, h.current - res.amount);

        // Face the target on attack.
        t.yaw = Math.atan2(tr.x - t.x, tr.z - t.z);

        world.events.emit<DamageEvent>(CombatEvent.Damage, {
          source: e,
          target: victim,
          amount: res.amount,
          isCrit: res.isCrit,
          damageType: def.damageType,
          abilityId: def.id,
          x: tr.x,
          y: tr.y,
          z: tr.z,
        });
        if (h.current <= 0) {
          world.events.emit<DeathEvent>(CombatEvent.Death, { entity: victim });
        }

        // 7) Pay the costs.
        if (def.triggersGcd) ab.gcdRemaining = GCD;
        ab.cooldowns[ab.bufferedIndex] = def.cooldown;
        ab.bufferedIndex = -1;
      }
    },
  };
}

function isAlive(world: World, e: Entity): boolean {
  if (!world.has(e)) return false;
  const h = world.get<Health>(e, C.Health);
  return !!h && h.current > 0;
}

/** A target is usable if it is alive, within range, and in line of sight. */
function usable(
  world: World,
  e: Entity,
  ox: number,
  oz: number,
  range: number,
  cols: readonly CylinderCollider[],
): boolean {
  if (!isAlive(world, e)) return false;
  const tr = world.get<Transform>(e, C.Transform)!;
  if (Math.hypot(tr.x - ox, tr.z - oz) > range) return false;
  return !segmentBlockedByCylinders(ox, oz, tr.x, tr.z, cols, LOS_PAD);
}

/** Nearest hostile in the forward cone, within range, with a clear line of sight. */
function softAcquire(
  world: World,
  ox: number,
  oz: number,
  yaw: number,
  range: number,
  cols: readonly CylinderCollider[],
  candidates: readonly Candidate[],
): Entity | null {
  const list = hostilesInCone(ox, oz, yaw, range, CONE_HALF, candidates);
  for (const a of list) {
    const tr = world.get<Transform>(a.entity, C.Transform)!;
    if (!segmentBlockedByCylinders(ox, oz, tr.x, tr.z, cols, LOS_PAD)) return a.entity;
  }
  return null;
}
