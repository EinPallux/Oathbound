// Player combat: ticks GCD/cooldowns/statuses, resolves soft tab-targeting, buffers
// input, spends/builds the class resource, and executes the class kit — melee,
// cleave, self-AoE, self-buff, ranged projectiles, cone shots, a dash, and trap
// placement. Pure simulation (no Three.js/DOM). Kills pay out via rewards.

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
  type PlayerClass,
  type Trap,
  type CastState,
  type Shield,
  type Enemy,
  type GroundAoe,
} from '../../core/ecs/components';
import type { ControlState } from '../../platform/input';
import type { Heightfield, CylinderCollider } from '../../world/heightfield';
import type { Rng } from '../../core/rng';
import { clamp } from '../../core/math';
import { resolveCircleVsCylinders } from '../collision';
import { getClass, resolveKit, empowerKit } from '../classes';
import {
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
import { applyHeal } from '../combat/heal';
import { addStatus, hasStatus, removeStatus, tickStatuses, Status } from '../combat/statuses';
import { CombatEvent, type AbilityUsedEvent } from '../combat/events';
import { rewardKill } from '../rewards';
import type { SpatialGrid } from '../spatial-grid';
import type { Projectiles } from '../projectiles';

const CONE_HALF = ((TARGET_CONE_DEG / 2) * Math.PI) / 180;
const LOS_PAD = 0.25;
const PLAYER_HALF = 0.9;
const PLAYER_RADIUS = 0.4;
/** Fraction of spell damage Atonement returns to the Priest as healing. */
const ATONEMENT_LEECH = 0.3;

export interface CombatDeps {
  /** Default control for players without a per-entity PlayerInput (focused unit tests). Real
   *  players (offline + networked) each carry their own PlayerInput component. */
  input?: ControlState;
  rng: Rng;
  colliders: readonly CylinderCollider[];
  field: Heightfield;
  projectiles: Projectiles;
  grid?: SpatialGrid;
}

export function createCombatSystem(deps: CombatDeps): System {
  const { input: defaultInput, rng, colliders, field, projectiles, grid } = deps;
  const bound = field.size / 2 - 1;
  const idScratch: Entity[] = [];
  const candidates: Candidate[] = [];

  return {
    name: 'combat',
    update(world: World, dt: number): void {
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
        // Per-player intent: each player fires abilities / targets via its own PlayerInput.
        const input = world.get<ControlState>(e, C.PlayerInput) ?? defaultInput;
        if (!input) continue;
        const t = world.get<Transform>(e, C.Transform)!;
        const off = world.get<Offense>(e, C.Offense)!;
        const ab = world.get<AbilityState>(e, C.AbilityState)!;
        const tgt = world.get<Target>(e, C.Target)!;
        const res = world.get<Resource>(e, C.Resource)!;
        const pc = world.get<PlayerClass>(e, C.PlayerClass);
        const cls = getClass(pc?.id ?? 'warrior');
        // At Lv 30 the capstone empowers the class's signature ability in place.
        const abilities = empowerKit(cls, resolveKit(cls, pc?.choices), off.level);

        // Timers.
        ab.gcdRemaining = Math.max(0, ab.gcdRemaining - dt);
        for (let i = 0; i < ab.cooldowns.length; i++) {
          ab.cooldowns[i] = Math.max(0, ab.cooldowns[i] - dt);
        }
        if (ab.bufferedIndex >= 0) {
          ab.bufferRemaining -= dt;
          if (ab.bufferRemaining <= 0) ab.bufferedIndex = -1;
        }

        // An in-progress cast finishes (or is cancelled by moving). Locks actions.
        const cast = world.get<CastState>(e, C.CastState);
        if (cast) {
          if (input.forward || input.back || input.left || input.right) {
            world.remove(e, C.CastState);
          } else {
            cast.remaining -= dt;
            if (cast.remaining <= 0) {
              finishCast(world, e, abilities[cast.index], cast.target, off, rng);
              world.remove(e, C.CastState);
            }
            continue;
          }
        }

        if (tgt.entity != null && !isAlive(world, tgt.entity)) tgt.entity = null;

        gatherCandidates(world, grid, t.x, t.z, TAB_RANGE, idScratch, candidates);

        if (input.consumeTargetCycle()) {
          const inCone = hostilesInCone(t.x, t.z, input.yaw, TAB_RANGE, CONE_HALF, candidates).map(
            (a) => a.entity,
          );
          tgt.entity = cycleTarget(tgt.entity, inCone);
        }
        // Esc is handled centrally by the bootstrap (close panel → clear target → menu).

        const req = input.consumeAbility();
        if (req != null && req >= 0 && req < abilities.length) {
          ab.bufferedIndex = req;
          ab.bufferRemaining = INPUT_BUFFER;
        }

        if (ab.bufferedIndex < 0 || ab.bufferedIndex >= abilities.length) continue;
        const def = abilities[ab.bufferedIndex];
        if ((def.unlockLevel ?? 1) > off.level) {
          ab.bufferedIndex = -1; // not learned yet
          continue;
        }
        if (def.triggersGcd && ab.gcdRemaining > 0) continue;
        if (ab.cooldowns[ab.bufferedIndex] > 0) continue;
        if (res.current < def.cost) continue;

        // Resolve targets per targeting type. `continue` keeps the buffer.
        let primary: Entity | null = null;
        const hitList: Entity[] = [];
        if (def.targeting === 'selfAoE') {
          for (const c of candidates) {
            if (Math.hypot(c.x - t.x, c.z - t.z) <= def.radius) hitList.push(c.entity);
          }
          if (hitList.length === 0) continue;
          primary = hitList[0];
        } else if (def.targeting === 'cone') {
          const half = ((def.coneHalfDeg ?? 45) * Math.PI) / 180;
          const hits = hostilesInCone(t.x, t.z, input.yaw, def.range, half, candidates);
          if (hits.length === 0) continue;
          for (const a of hits) hitList.push(a.entity);
          primary = hitList[0];
        } else if (
          def.targeting === 'target' ||
          def.targeting === 'projectile' ||
          def.targeting === 'charge' ||
          def.targeting === 'interrupt'
        ) {
          primary = resolvePrimary(world, t, input.yaw, def.range, tgt, colliders, candidates);
          if (primary == null) continue;
          if (def.targeting !== 'charge' && def.targeting !== 'interrupt') hitList.push(primary);
        } else if (def.targeting === 'groundAoE') {
          // Aimed at the locked/soft target if there is one; otherwise dropped ahead.
          primary = resolvePrimary(world, t, input.yaw, def.range, tgt, colliders, candidates);
        } else if (def.targeting === 'frontalSplash') {
          primary = resolvePrimary(world, t, input.yaw, def.range, tgt, colliders, candidates);
          if (primary == null) continue;
          hitList.push(primary);
          const ptr = world.get<Transform>(primary, C.Transform)!;
          for (const c of candidates) {
            if (c.entity !== primary && Math.hypot(c.x - ptr.x, c.z - ptr.z) <= def.radius) {
              hitList.push(c.entity);
            }
          }
        }
        // 'self', 'dash', 'trap' need no target.

        // Pay costs + timers.
        const firedIndex = ab.bufferedIndex;
        res.current = clamp(res.current - def.cost + def.furyGain, 0, res.max);
        if (def.triggersGcd) ab.gcdRemaining = effectiveGcd(off.haste);
        ab.cooldowns[firedIndex] = def.cooldown;
        ab.bufferedIndex = -1;

        // The ability is now committed (past all the target/resource guards): tell the
        // renderer to play the player's swing/draw/cast motion. Purely cosmetic.
        world.events.emit<AbilityUsedEvent>(CombatEvent.AbilityUsed, {
          entity: e,
          classId: pc?.id ?? 'warrior',
          abilityId: def.id,
          targeting: def.targeting,
          castTime: def.castTime ?? 0,
        });

        if (def.selfBuff) {
          const ss = world.get<Statuses>(e, C.Statuses);
          if (ss) addStatus(ss, def.selfBuff.id, def.selfBuff.durationSec, def.selfBuff.magnitude);
        }
        if (primary != null) {
          tgt.entity = primary;
          const ptr = world.get<Transform>(primary, C.Transform)!;
          t.yaw = Math.atan2(ptr.x - t.x, ptr.z - t.z);
        }

        // Atonement (Priest toggle) returns a fraction of spell damage as healing.
        const atonement = hasStatus(world.get<Statuses>(e, C.Statuses), Status.Atonement)
          ? ATONEMENT_LEECH
          : 0;
        const leech = off.leech + atonement;

        // Execute.
        if (def.castTime && def.castTime > 0 && primary != null) {
          // Begin a cast; it resolves later and locks the GCD for its duration.
          ab.gcdRemaining = Math.max(ab.gcdRemaining, def.castTime);
          world.set<CastState>(e, C.CastState, {
            index: firedIndex,
            remaining: def.castTime,
            target: primary,
          });
          markCombat(world, e);
        } else if (def.targeting === 'dash') {
          doDash(t, def, colliders, field, bound, input.yaw);
        } else if (def.targeting === 'charge' && primary != null) {
          doCharge(t, primary, world, colliders, field, bound);
          if (def.debuff) {
            const vs = world.get<Statuses>(primary, C.Statuses);
            if (vs) addStatus(vs, def.debuff.id, def.debuff.durationSec, def.debuff.magnitude);
          }
          markCombat(world, e);
        } else if (def.targeting === 'trap') {
          placeTrap(world, e, t, def);
          markCombat(world, e);
        } else if (def.targeting === 'interrupt' && primary != null) {
          // Cancel any telegraph in progress, then silence + lightly damage the target.
          const en = world.get<Enemy>(primary, C.Enemy);
          if (en) {
            en.windupTimer = -1;
            en.attackTimer = Math.max(en.attackTimer, en.attackCooldown);
          }
          const r = applyDamage(
            world,
            e,
            primary,
            { base: def.base, coeff: def.coeff, damageType: def.damageType },
            rng,
            leech,
          );
          if (def.debuff) {
            const vs = world.get<Statuses>(primary, C.Statuses);
            if (vs) addStatus(vs, def.debuff.id, def.debuff.durationSec, def.debuff.magnitude);
          }
          if (r.killed) rewardKill(world, e, primary, rng);
          markCombat(world, e);
        } else if (def.targeting === 'groundAoE') {
          placeGroundAoe(world, e, t, def, primary, input.yaw, field);
          markCombat(world, e);
        } else if (def.targeting === 'heal' && def.heal) {
          let flat = 0;
          if (def.heal.missingHpPct) {
            const ph = world.get<Health>(e, C.Health);
            if (ph) flat = def.heal.missingHpPct * (ph.max - ph.current);
          }
          applyHeal(world, e, e, def.heal.base, def.heal.coeff, rng, flat);
        } else if (def.targeting === 'shield' && def.shield) {
          world.set<Shield>(e, C.Shield, {
            amount: Math.round(def.shield.coeff * off.primaryStat),
            remaining: def.shield.durationSec,
          });
        } else if (def.targeting === 'toggle' && def.toggle) {
          const ss = world.get<Statuses>(e, C.Statuses);
          if (ss) {
            if (hasStatus(ss, def.toggle.id)) removeStatus(ss, def.toggle.id);
            else addStatus(ss, def.toggle.id, Infinity, def.toggle.magnitude);
          }
        } else if (def.targeting === 'projectile' && primary != null) {
          projectiles.spawn({
            x: t.x,
            y: t.y + 1,
            z: t.z,
            source: e,
            target: primary,
            speed: def.projectileSpeed ?? 25,
            base: def.base,
            coeff: def.coeff,
            damageType: def.damageType,
            leech,
            fromPlayer: true,
          });
          markCombat(world, e);
        } else if (def.base > 0 || def.coeff > 0) {
          for (const victim of hitList) {
            const r = applyDamage(
              world,
              e,
              victim,
              { base: def.base, coeff: def.coeff, damageType: def.damageType },
              rng,
              leech,
            );
            if (victim === primary && def.debuff) {
              const vs = world.get<Statuses>(victim, C.Statuses);
              if (vs) addStatus(vs, def.debuff.id, def.debuff.durationSec, def.debuff.magnitude);
            }
            if (r.killed) rewardKill(world, e, victim, rng);
          }
          if (def.heal) applyHeal(world, e, e, def.heal.base, def.heal.coeff, rng); // Holy Nova rider
          markCombat(world, e);
        }
      }
    },
  };
}

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

/** Resolve a finished cast (Searing Light): damage the stored target if still valid. */
function finishCast(
  world: World,
  e: Entity,
  def: AbilityDef,
  target: Entity | null,
  off: Offense,
  rng: Rng,
): void {
  if (target == null || !isAlive(world, target)) return;
  const tr = world.get<Transform>(target, C.Transform);
  const pt = world.get<Transform>(e, C.Transform);
  if (!tr || !pt) return;
  if (Math.hypot(tr.x - pt.x, tr.z - pt.z) > def.range) return; // walked out of range
  const atonement = hasStatus(world.get<Statuses>(e, C.Statuses), Status.Atonement)
    ? ATONEMENT_LEECH
    : 0;
  const r = applyDamage(
    world,
    e,
    target,
    { base: def.base, coeff: def.coeff, damageType: def.damageType },
    rng,
    off.leech + atonement,
  );
  if (r.killed) rewardKill(world, e, target, rng);
}

function resolvePrimary(
  world: World,
  t: Transform,
  yaw: number,
  range: number,
  tgt: Target,
  cols: readonly CylinderCollider[],
  candidates: readonly Candidate[],
): Entity | null {
  if (tgt.entity != null && usable(world, tgt.entity, t.x, t.z, range, cols)) return tgt.entity;
  const list = hostilesInCone(t.x, t.z, yaw, range, CONE_HALF, candidates);
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

function markCombat(world: World, e: Entity): void {
  const cs = world.get<CombatState>(e, C.CombatState);
  if (cs) {
    cs.inCombat = true;
    cs.sinceEventSec = 0;
  }
}

function doDash(
  t: Transform,
  def: AbilityDef,
  cols: readonly CylinderCollider[],
  field: Heightfield,
  bound: number,
  yaw: number,
): void {
  const d = def.dashDistance ?? 5;
  const bx = -Math.sin(yaw);
  const bz = -Math.cos(yaw);
  const r = resolveCircleVsCylinders(t.x + bx * d, t.z + bz * d, PLAYER_RADIUS, cols);
  t.x = clamp(r.x, -bound, bound);
  t.z = clamp(r.z, -bound, bound);
  t.y = field.sample(t.x, t.z) + PLAYER_HALF;
}

/** Gap-closer: leap to just short of the target and face it. */
function doCharge(
  t: Transform,
  target: Entity,
  world: World,
  cols: readonly CylinderCollider[],
  field: Heightfield,
  bound: number,
): void {
  const tr = world.get<Transform>(target, C.Transform);
  if (!tr) return;
  const dx = tr.x - t.x;
  const dz = tr.z - t.z;
  const dist = Math.hypot(dx, dz);
  if (dist <= 1e-3) return;
  const stop = Math.max(0, dist - 1.6); // arrive at melee range
  const r = resolveCircleVsCylinders(t.x + (dx / dist) * stop, t.z + (dz / dist) * stop, PLAYER_RADIUS, cols);
  t.x = clamp(r.x, -bound, bound);
  t.z = clamp(r.z, -bound, bound);
  t.y = field.sample(t.x, t.z) + PLAYER_HALF;
  t.yaw = Math.atan2(dx, dz);
}

/** Drop a ground-AoE zone at the target (if any) or a point ahead of the caster. */
function placeGroundAoe(
  world: World,
  source: Entity,
  t: Transform,
  def: AbilityDef,
  primary: Entity | null,
  yaw: number,
  field: Heightfield,
): void {
  let x = t.x;
  let z = t.z;
  if (primary != null) {
    const pt = world.get<Transform>(primary, C.Transform);
    if (pt) {
      x = pt.x;
      z = pt.z;
    }
  } else {
    const dist = Math.min(def.range, 8);
    x = t.x + Math.sin(yaw) * dist;
    z = t.z + Math.cos(yaw) * dist;
  }
  const e = world.createEntity();
  const y = field.sample(x, z) + 0.05;
  world.set<Transform>(e, C.Transform, {
    x,
    y,
    z,
    yaw: 0,
    prevX: x,
    prevY: y,
    prevZ: z,
    prevYaw: 0,
  });
  world.set<GroundAoe>(e, C.GroundAoe, {
    source,
    radius: def.radius,
    ttl: def.aoeTtl ?? 4,
    tickEvery: def.aoeTick ?? 1,
    tickTimer: 0,
    base: def.base,
    coeff: def.coeff,
    damageType: def.damageType,
  });
}

function placeTrap(world: World, source: Entity, t: Transform, def: AbilityDef): void {
  const trap = world.createEntity();
  const y = t.y - PLAYER_HALF + 0.05;
  world.set<Transform>(trap, C.Transform, {
    x: t.x,
    y,
    z: t.z,
    yaw: 0,
    prevX: t.x,
    prevY: y,
    prevZ: t.z,
    prevYaw: 0,
  });
  world.set<Trap>(trap, C.Trap, {
    source,
    radius: def.trapRadius ?? 2,
    rootDuration: def.trapRootSec ?? 3,
    ttl: def.trapTtl ?? 30,
    base: def.base,
    coeff: def.coeff,
  });
}
