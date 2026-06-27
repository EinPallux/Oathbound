// Melee-bruiser enemy AI: a simple state machine — idle → engage → attack →
// leash/reset(heal) → dead(respawn) — with aggro radius, social aggro, leashing, a
// telegraphed wind-up, and cheap steering (move + ground-snap + prop collision).
// Pure simulation (no Three.js/DOM). See docs/design/ENEMY_DESIGN.md.

import type { System, World, Entity } from '../../core/ecs/world';
import {
  C,
  type Transform,
  type Velocity,
  type Health,
  type Enemy,
  type Statuses,
  type CombatState,
} from '../../core/ecs/components';
import type { Heightfield, CylinderCollider } from '../../world/heightfield';
import type { Rng } from '../../core/rng';
import { clamp } from '../../core/math';
import { resolveCircleVsCylinders } from '../collision';
import { segmentBlockedByCylinders } from '../combat/targeting';
import { applyDamage } from '../combat/apply';
import { hasStatus, Status } from '../combat/statuses';
import { CombatEvent, type PlayerDiedEvent, type RespawnEvent } from '../combat/events';
import type { SpatialGrid } from '../spatial-grid';
import type { Projectiles } from '../projectiles';

const ENEMY_HALF = 0.9;
const ENEMY_RADIUS = 0.45;
const LEASH_RETURN_SPEED = 1.3;
const ENEMY_PROJECTILE_SPEED = 22;
/** Idle enemies past this distance from the player update on a slow cadence. */
const DEFAULT_SIM_RADIUS = 60;
const THROTTLE_EVERY = 6;

export interface EnemyAiDeps {
  field: Heightfield;
  colliders: readonly CylinderCollider[];
  rng: Rng;
  grid?: SpatialGrid;
  projectiles?: Projectiles;
  simRadius?: number;
}

export function createEnemyAiSystem(deps: EnemyAiDeps): System {
  const { field, colliders, rng, grid, projectiles } = deps;
  const simRadius = deps.simRadius ?? DEFAULT_SIM_RADIUS;
  const bound = field.size / 2 - 1;
  const enemies: Entity[] = [];
  const socialScratch: Entity[] = [];
  let tick = 0;

  return {
    name: 'enemy-ai',
    update(world: World, dt: number): void {
      tick++;
      // Single player in the slice.
      let player: Entity | null = null;
      for (const p of world.query(C.PlayerControlled, C.Transform, C.Health)) {
        player = p;
        break;
      }
      if (player == null) return;
      const pt = world.get<Transform>(player, C.Transform)!;
      const playerAlive = world.get<Health>(player, C.Health)!.current > 0;

      enemies.length = 0;
      for (const e of world.query(C.Enemy, C.Transform, C.Velocity, C.Health)) enemies.push(e);

      for (const e of enemies) {
        const en = world.get<Enemy>(e, C.Enemy)!;
        const tr = world.get<Transform>(e, C.Transform)!;
        const v = world.get<Velocity>(e, C.Velocity)!;
        const h = world.get<Health>(e, C.Health)!;

        // Throttle: distant idle enemies do nothing useful — update them rarely.
        if (en.state === 'idle' && h.current > 0 && tick % THROTTLE_EVERY !== 0) {
          const ddx = pt.x - tr.x;
          const ddz = pt.z - tr.z;
          if (ddx * ddx + ddz * ddz > simRadius * simRadius) continue;
        }

        tr.prevX = tr.x;
        tr.prevY = tr.y;
        tr.prevZ = tr.z;
        tr.prevYaw = tr.yaw;

        // Dead → count down to respawn.
        if (h.current <= 0) {
          v.x = 0;
          v.z = 0;
          if (en.state !== 'dead') {
            en.state = 'dead';
            en.deadFor = 0;
          }
          en.deadFor += dt;
          if (en.deadFor >= en.respawnDelay) respawn(world, e, en, tr, h, field);
          continue;
        }

        if (en.invulnTimer > 0) en.invulnTimer = Math.max(0, en.invulnTimer - dt);

        const dpx = pt.x - tr.x;
        const dpz = pt.z - tr.z;
        const distPlayer = Math.hypot(dpx, dpz);
        const distHome = Math.hypot(tr.x - en.homeX, tr.z - en.homeZ);

        // Leash if dragged too far, or if the player is gone.
        if ((en.state === 'engage' || en.state === 'attack') && distHome > en.leashRange) {
          en.state = 'leash';
        }
        if (!playerAlive && (en.state === 'engage' || en.state === 'attack')) {
          en.state = 'leash';
        }

        // Acquire aggro (with line of sight) + social aggro.
        if (
          en.state === 'idle' &&
          playerAlive &&
          distPlayer <= en.aggroRadius &&
          !segmentBlockedByCylinders(tr.x, tr.z, pt.x, pt.z, colliders, 0.25)
        ) {
          en.state = 'engage';
          rallyPack(world, e, en, grid, enemies, socialScratch);
        }

        let vx = 0;
        let vz = 0;
        // Ranged skirmishers + casters fire projectiles; only skirmishers kite.
        const usesProjectile =
          en.archetype === 'ranged_skirmisher' || en.archetype === 'caster';
        const kites = en.archetype === 'ranged_skirmisher';
        const minRange = en.attackRange * 0.55;

        if (en.state === 'engage') {
          if (usesProjectile) {
            if (distPlayer > en.attackRange && distPlayer > 1e-3) {
              vx = (dpx / distPlayer) * en.moveSpeed;
              vz = (dpz / distPlayer) * en.moveSpeed;
            } else if (kites && distPlayer < minRange && distPlayer > 1e-3) {
              vx = -(dpx / distPlayer) * en.moveSpeed;
              vz = -(dpz / distPlayer) * en.moveSpeed;
            } else {
              en.state = 'attack';
            }
          } else if (distPlayer <= en.attackRange) {
            en.state = 'attack';
          } else if (distPlayer > 1e-3) {
            vx = (dpx / distPlayer) * en.moveSpeed;
            vz = (dpz / distPlayer) * en.moveSpeed;
          }
        } else if (en.state === 'attack') {
          en.attackTimer = Math.max(0, en.attackTimer - dt);
          const loseRange = distPlayer > en.attackRange * (usesProjectile ? 1.15 : 1.2);
          if (loseRange) {
            en.state = 'engage';
            en.windupTimer = -1;
          } else {
            // Skirmishers back-pedal when the player closes (kite); casters hold ground.
            if (kites && distPlayer < minRange && distPlayer > 1e-3) {
              vx = -(dpx / distPlayer) * en.moveSpeed;
              vz = -(dpz / distPlayer) * en.moveSpeed;
            }
            if (en.windupTimer >= 0) {
              en.windupTimer -= dt;
              if (en.windupTimer <= 0) {
                en.windupTimer = -1;
                en.attackTimer = en.attackCooldown;
                if (playerAlive)
                  fireAttack(world, e, en, tr, player, distPlayer, usesProjectile, projectiles, rng);
              }
            } else if (
              en.attackTimer <= 0 &&
              !hasStatus(world.get<Statuses>(e, C.Statuses), Status.Silence)
            ) {
              en.windupTimer = en.windup; // begin a new telegraph (blocked while silenced)
            }
          }
        } else if (en.state === 'leash') {
          const dhx = en.homeX - tr.x;
          const dhz = en.homeZ - tr.z;
          if (distHome <= 0.6) {
            // Reached home: reset + heal to full.
            en.state = 'idle';
            en.windupTimer = -1;
            en.invulnTimer = 0.5;
            h.current = h.max;
            const ss = world.get<Statuses>(e, C.Statuses);
            if (ss) ss.list.length = 0;
          } else if (distHome > 1e-3) {
            vx = (dhx / distHome) * en.moveSpeed * LEASH_RETURN_SPEED;
            vz = (dhz / distHome) * en.moveSpeed * LEASH_RETURN_SPEED;
          }
        }

        // A snared (rooted) enemy can't move.
        if (hasStatus(world.get<Statuses>(e, C.Statuses), Status.Root)) {
          vx = 0;
          vz = 0;
        }

        // Integrate + resolve.
        v.x = vx;
        v.z = vz;
        tr.x += vx * dt;
        tr.z += vz * dt;
        const resolved = resolveCircleVsCylinders(tr.x, tr.z, ENEMY_RADIUS, colliders);
        tr.x = clamp(resolved.x, -bound, bound);
        tr.z = clamp(resolved.z, -bound, bound);
        tr.y = field.sample(tr.x, tr.z) + ENEMY_HALF;

        // Facing.
        if (vx !== 0 || vz !== 0) {
          tr.yaw = Math.atan2(vx, vz);
        } else if ((en.state === 'attack' || en.state === 'engage') && distPlayer > 1e-3) {
          tr.yaw = Math.atan2(dpx, dpz);
        }
      }
    },
  };
}

/** Land an enemy attack: a ranged shot (projectile) or a melee swing (instant). */
function fireAttack(
  world: World,
  e: Entity,
  en: Enemy,
  tr: Transform,
  player: Entity,
  distPlayer: number,
  projectile: boolean,
  projectiles: Projectiles | undefined,
  rng: Rng,
): void {
  // Elites/rares enrage below 30% HP (a readable "real fight" mechanic).
  let base = en.attackBase;
  if (en.tier !== 'standard') {
    const h = world.get<Health>(e, C.Health);
    if (h && h.current < 0.3 * h.max) base = Math.round(base * 1.4);
  }

  if (projectile) {
    projectiles?.spawn({
      x: tr.x,
      y: tr.y + 1,
      z: tr.z,
      source: e,
      target: player,
      speed: ENEMY_PROJECTILE_SPEED,
      base,
      coeff: en.attackCoeff,
      damageType: en.attackType,
      fromPlayer: false,
    });
    return;
  }
  if (distPlayer > en.attackRange * 1.1) return;
  const r = applyDamage(
    world,
    e,
    player,
    { base, coeff: en.attackCoeff, damageType: en.attackType },
    rng,
    0,
  );
  markCombat(world, player);
  if (r.killed) world.events.emit<PlayerDiedEvent>(CombatEvent.PlayerDied, { entity: player });
}

/** Nearby idle packmates join the fight (social aggro). Uses the grid when present. */
function rallyPack(
  world: World,
  leader: Entity,
  leaderEn: Enemy,
  grid: SpatialGrid | undefined,
  enemies: readonly Entity[],
  scratch: Entity[],
): void {
  const lt = world.get<Transform>(leader, C.Transform)!;
  const list = grid ? grid.queryCircle(lt.x, lt.z, leaderEn.socialRange, scratch) : enemies;
  for (const other of list) {
    if (other === leader) continue;
    const oe = world.get<Enemy>(other, C.Enemy);
    if (!oe || oe.state !== 'idle') continue;
    const oh = world.get<Health>(other, C.Health);
    if (!oh || oh.current <= 0) continue;
    const ot = world.get<Transform>(other, C.Transform)!;
    if (Math.hypot(ot.x - lt.x, ot.z - lt.z) <= leaderEn.socialRange) oe.state = 'engage';
  }
}

function respawn(
  world: World,
  e: Entity,
  en: Enemy,
  tr: Transform,
  h: Health,
  field: Heightfield,
): void {
  en.state = 'idle';
  en.deadFor = 0;
  en.windupTimer = -1;
  en.attackTimer = 0;
  en.invulnTimer = 0;
  h.current = h.max;
  tr.x = en.homeX;
  tr.z = en.homeZ;
  tr.y = field.sample(en.homeX, en.homeZ) + ENEMY_HALF;
  tr.prevX = tr.x;
  tr.prevY = tr.y;
  tr.prevZ = tr.z;
  const ss = world.get<Statuses>(e, C.Statuses);
  if (ss) ss.list.length = 0;
  world.events.emit<RespawnEvent>(CombatEvent.Respawn, { entity: e });
}

function markCombat(world: World, e: Entity): void {
  const cs = world.get<CombatState>(e, C.CombatState);
  if (cs) {
    cs.inCombat = true;
    cs.sinceEventSec = 0;
  }
}
