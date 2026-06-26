// Player combat: ticks GCD/cooldowns/statuses, resolves soft tab-targeting, buffers
// input, spends/builds Fury, and executes the Warrior kit (single-target, cleave,
// self-AoE, self-buff) via the shared damage applier. Grants XP + spawns loot on a
// kill. Pure simulation (no Three.js/DOM).

import type { System, World, Entity } from '../../core/ecs/world';
import {
  C,
  type Transform,
  type Offense,
  type Health,
  type AbilityState,
  type Target,
  type Resource,
  type Statuses,
  type CombatState,
  type Enemy,
  type EnemyInfo,
  type Progression,
  type LootDrop,
} from '../../core/ecs/components';
import type { ControlState } from '../../platform/input';
import type { CylinderCollider } from '../../world/heightfield';
import type { Rng } from '../../core/rng';
import { clamp } from '../../core/math';
import {
  ABILITIES,
  INPUT_BUFFER,
  TARGET_CONE_DEG,
  TAB_RANGE,
  effectiveGcd,
  type AbilityDef,
} from '../combat/abilities';
import {
  hostilesInCone,
  cycleTarget,
  segmentBlockedByCylinders,
  type Candidate,
} from '../combat/targeting';
import { applyDamage } from '../combat/apply';
import { addStatus, tickStatuses } from '../combat/statuses';
import type { SpatialGrid } from '../spatial-grid';
import { CombatEvent, type DeathEvent, type LootDroppedEvent } from '../combat/events';
import { grantXp } from '../progression';
import { conXpMultiplier } from '../stats';
import { rollLoot } from '../loot/droptable';

const CONE_HALF = ((TARGET_CONE_DEG / 2) * Math.PI) / 180;
const LOS_PAD = 0.25;
/** Grace period (s) before an uncollected drop despawns. */
const LOOT_TTL = 120;

export interface CombatDeps {
  input: ControlState;
  rng: Rng;
  colliders: readonly CylinderCollider[];
  /** Optional broad-phase index; falls back to a full scan when absent. */
  grid?: SpatialGrid;
}

export function createCombatSystem(deps: CombatDeps): System {
  const { input, rng, colliders, grid } = deps;
  // Reused per-tick scratch buffers (avoid steady allocation churn).
  const idScratch: Entity[] = [];
  const candidates: Candidate[] = [];

  return {
    name: 'combat',
    update(world: World, dt: number): void {
      // Advance every entity's statuses once per step.
      for (const e of world.query(C.Statuses)) {
        tickStatuses(world.get<Statuses>(e, C.Statuses)!, dt);
      }

      for (const e of world.query(
        C.PlayerControlled,
        C.Transform,
        C.Offense,
        C.AbilityState,
        C.Target,
        C.Resource,
      )) {
        const t = world.get<Transform>(e, C.Transform)!;
        const off = world.get<Offense>(e, C.Offense)!;
        const ab = world.get<AbilityState>(e, C.AbilityState)!;
        const tgt = world.get<Target>(e, C.Target)!;
        const res = world.get<Resource>(e, C.Resource)!;

        // Timers.
        ab.gcdRemaining = Math.max(0, ab.gcdRemaining - dt);
        for (let i = 0; i < ab.cooldowns.length; i++) {
          ab.cooldowns[i] = Math.max(0, ab.cooldowns[i] - dt);
        }
        if (ab.bufferedIndex >= 0) {
          ab.bufferRemaining -= dt;
          if (ab.bufferRemaining <= 0) ab.bufferedIndex = -1;
        }

        if (tgt.entity != null && !isAlive(world, tgt.entity)) tgt.entity = null;

        // Live, targetable hostiles near this player (broad-phase if available).
        gatherCandidates(world, grid, t.x, t.z, TAB_RANGE, idScratch, candidates);

        // Targeting input.
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

        // Buffer an ability press.
        const req = input.consumeAbility();
        if (req != null && req >= 0 && req < ABILITIES.length) {
          ab.bufferedIndex = req;
          ab.bufferRemaining = INPUT_BUFFER;
        }

        // Attempt to fire.
        if (ab.bufferedIndex < 0) continue;
        const def = ABILITIES[ab.bufferedIndex];
        if (def.triggersGcd && ab.gcdRemaining > 0) continue;
        if (ab.cooldowns[ab.bufferedIndex] > 0) continue;
        if (res.current < def.cost) continue;

        // Resolve what gets hit.
        let primary: Entity | null = null;
        const hitList: Entity[] = [];
        if (def.targeting === 'selfAoE') {
          for (const c of candidates) {
            if (Math.hypot(c.x - t.x, c.z - t.z) <= def.radius) hitList.push(c.entity);
          }
          if (hitList.length === 0) continue; // don't waste it on empty air
          primary = hitList[0];
        } else if (def.targeting !== 'self') {
          primary = resolvePrimary(world, t, input.yaw, def, tgt, colliders, candidates);
          if (primary == null) continue;
          hitList.push(primary);
          if (def.targeting === 'frontalSplash') {
            const ptr = world.get<Transform>(primary, C.Transform)!;
            for (const c of candidates) {
              if (c.entity !== primary && Math.hypot(c.x - ptr.x, c.z - ptr.z) <= def.radius) {
                hitList.push(c.entity);
              }
            }
          }
          tgt.entity = primary;
        }

        // Pay costs + set timers.
        res.current = clamp(res.current - def.cost + def.furyGain, 0, res.max);
        if (def.triggersGcd) ab.gcdRemaining = effectiveGcd(off.haste);
        ab.cooldowns[ab.bufferedIndex] = def.cooldown;
        ab.bufferedIndex = -1;
        markCombat(world, e);

        // Self buff (Bulwark).
        if (def.selfBuff) {
          const ss = world.get<Statuses>(e, C.Statuses);
          if (ss) addStatus(ss, def.selfBuff.id, def.selfBuff.durationSec, def.selfBuff.magnitude);
        }

        // Face the primary target.
        if (primary != null) {
          const ptr = world.get<Transform>(primary, C.Transform)!;
          t.yaw = Math.atan2(ptr.x - t.x, ptr.z - t.z);
        }

        // Damage.
        if (def.base > 0 || def.coeff > 0) {
          for (const victim of hitList) {
            const r = applyDamage(
              world,
              e,
              victim,
              { base: def.base, coeff: def.coeff, damageType: def.damageType },
              rng,
              off.leech,
            );
            if (victim === primary && def.debuff) {
              const vs = world.get<Statuses>(victim, C.Statuses);
              if (vs) addStatus(vs, def.debuff.id, def.debuff.durationSec, def.debuff.magnitude);
            }
            if (r.killed) handleKill(world, e, victim, rng);
          }
        }
      }
    },
  };
}

/** Fill `out` with live, targetable hostiles near (ox, oz). Uses the grid when
 *  present (broad-phase), else a full scan. Reuses the provided scratch buffers. */
function gatherCandidates(
  world: World,
  grid: SpatialGrid | undefined,
  ox: number,
  oz: number,
  radius: number,
  idScratch: Entity[],
  out: Candidate[],
): void {
  out.length = 0;
  if (grid) {
    grid.queryCircle(ox, oz, radius, idScratch);
    for (const e of idScratch) {
      const h = world.get<Health>(e, C.Health);
      if (!h || h.current <= 0) continue;
      const tr = world.get<Transform>(e, C.Transform)!;
      out.push({ entity: e, x: tr.x, z: tr.z });
    }
  } else {
    for (const e of world.query(C.Targetable, C.Transform, C.Health)) {
      if (world.get<Health>(e, C.Health)!.current <= 0) continue;
      const tr = world.get<Transform>(e, C.Transform)!;
      out.push({ entity: e, x: tr.x, z: tr.z });
    }
  }
}

function isAlive(world: World, e: Entity): boolean {
  if (!world.has(e)) return false;
  const h = world.get<Health>(e, C.Health);
  return !!h && h.current > 0;
}

function markCombat(world: World, e: Entity): void {
  const cs = world.get<CombatState>(e, C.CombatState);
  if (cs) {
    cs.inCombat = true;
    cs.sinceEventSec = 0;
  }
}

function resolvePrimary(
  world: World,
  t: Transform,
  yaw: number,
  def: AbilityDef,
  tgt: Target,
  cols: readonly CylinderCollider[],
  candidates: readonly Candidate[],
): Entity | null {
  if (tgt.entity != null && usable(world, tgt.entity, t.x, t.z, def.range, cols)) {
    return tgt.entity;
  }
  const list = hostilesInCone(t.x, t.z, yaw, def.range, CONE_HALF, candidates);
  for (const a of list) {
    const tr = world.get<Transform>(a.entity, C.Transform)!;
    if (!segmentBlockedByCylinders(t.x, t.z, tr.x, tr.z, cols, LOS_PAD)) return a.entity;
  }
  return null;
}

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

/** XP + loot on an enemy kill, and flag the enemy dead (AI handles respawn). */
function handleKill(world: World, killer: Entity, victim: Entity, rng: Rng): void {
  const enemy = world.get<Enemy>(victim, C.Enemy);
  const einfo = world.get<EnemyInfo>(victim, C.EnemyInfo);
  const prog = world.get<Progression>(killer, C.Progression);
  const enemyLevel = einfo?.level ?? 1;

  if (enemy && prog) {
    const xp = Math.round(enemy.xpBase * conXpMultiplier(prog.level, enemyLevel));
    grantXp(world, killer, xp);
  }

  const tr = world.get<Transform>(victim, C.Transform)!;
  const tier = enemy?.tier ?? 'standard';
  const roll = rollLoot(rng, enemyLevel, tier);
  const gold = enemy ? enemy.goldMin + rng.int(enemy.goldMax - enemy.goldMin + 1) : roll.gold;

  const drop = world.createEntity();
  world.set<Transform>(drop, C.Transform, {
    x: tr.x,
    y: tr.y,
    z: tr.z,
    yaw: 0,
    prevX: tr.x,
    prevY: tr.y,
    prevZ: tr.z,
    prevYaw: 0,
  });
  world.set<LootDrop>(drop, C.LootDrop, { item: roll.item, gold, owner: killer, ttl: LOOT_TTL });
  world.events.emit<LootDroppedEvent>(CombatEvent.LootDropped, {
    entity: drop,
    item: roll.item,
    gold,
    x: tr.x,
    y: tr.y,
    z: tr.z,
  });

  if (enemy) {
    enemy.state = 'dead';
    enemy.deadFor = 0;
  }
  world.events.emit<DeathEvent>(CombatEvent.Death, { entity: victim, killer });
}
