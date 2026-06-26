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
import { CombatEvent, type PlayerDiedEvent, type RespawnEvent } from '../combat/events';

const ENEMY_HALF = 0.9;
const ENEMY_RADIUS = 0.45;
const LEASH_RETURN_SPEED = 1.3;

export interface EnemyAiDeps {
  field: Heightfield;
  colliders: readonly CylinderCollider[];
  rng: Rng;
}

export function createEnemyAiSystem(deps: EnemyAiDeps): System {
  const { field, colliders, rng } = deps;
  const bound = field.size / 2 - 1;

  return {
    name: 'enemy-ai',
    update(world: World, dt: number): void {
      // Single player in the slice.
      let player: Entity | null = null;
      for (const p of world.query(C.PlayerControlled, C.Transform, C.Health)) {
        player = p;
        break;
      }
      if (player == null) return;
      const pt = world.get<Transform>(player, C.Transform)!;
      const playerAlive = world.get<Health>(player, C.Health)!.current > 0;

      const enemies = [...world.query(C.Enemy, C.Transform, C.Velocity, C.Health)];

      for (const e of enemies) {
        const en = world.get<Enemy>(e, C.Enemy)!;
        const tr = world.get<Transform>(e, C.Transform)!;
        const v = world.get<Velocity>(e, C.Velocity)!;
        const h = world.get<Health>(e, C.Health)!;

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
          rallyPack(world, enemies, e, en);
        }

        let vx = 0;
        let vz = 0;

        if (en.state === 'engage') {
          if (distPlayer <= en.attackRange) {
            en.state = 'attack';
          } else if (distPlayer > 1e-3) {
            vx = (dpx / distPlayer) * en.moveSpeed;
            vz = (dpz / distPlayer) * en.moveSpeed;
          }
        } else if (en.state === 'attack') {
          en.attackTimer = Math.max(0, en.attackTimer - dt);
          if (distPlayer > en.attackRange * 1.2) {
            en.state = 'engage';
            en.windupTimer = -1;
          } else if (en.windupTimer >= 0) {
            // Telegraphed swing in progress.
            en.windupTimer -= dt;
            if (en.windupTimer <= 0) {
              en.windupTimer = -1;
              en.attackTimer = en.attackCooldown;
              if (playerAlive && distPlayer <= en.attackRange * 1.1) {
                const r = applyDamage(
                  world,
                  e,
                  player,
                  { base: en.attackBase, coeff: en.attackCoeff, damageType: 'physical' },
                  rng,
                  0,
                );
                markCombat(world, player);
                if (r.killed) {
                  world.events.emit<PlayerDiedEvent>(CombatEvent.PlayerDied, { entity: player });
                }
              }
            }
          } else if (en.attackTimer <= 0) {
            en.windupTimer = en.windup; // begin a new telegraph
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

/** Nearby idle packmates join the fight (social aggro). */
function rallyPack(world: World, enemies: Entity[], leader: Entity, leaderEn: Enemy): void {
  const lt = world.get<Transform>(leader, C.Transform)!;
  for (const other of enemies) {
    if (other === leader) continue;
    const oe = world.get<Enemy>(other, C.Enemy)!;
    if (oe.state !== 'idle') continue;
    const oh = world.get<Health>(other, C.Health)!;
    if (oh.current <= 0) continue;
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
