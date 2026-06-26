// Pooled projectiles (Hunter shots + enemy ranged shots). Plain structs in a reused
// pool — not ECS entities — so there is zero per-shot allocation/entity churn. They
// home toward their target and resolve damage via the shared applier on contact.
// Pure simulation (no Three.js/DOM). Render reads the active list.

import type { World, Entity } from '../core/ecs/world';
import {
  C,
  type Transform,
  type Health,
  type CombatState,
  type DamageType,
} from '../core/ecs/components';
import type { Rng } from '../core/rng';
import { applyDamage } from './combat/apply';
import { rewardKill } from './rewards';
import { CombatEvent, type PlayerDiedEvent } from './combat/events';

export interface Projectile {
  active: boolean;
  x: number;
  y: number;
  z: number;
  source: Entity;
  target: Entity;
  speed: number;
  base: number;
  coeff: number;
  damageType: DamageType;
  leech: number;
  ttl: number;
  /** Source is the player → a kill pays rewards; else it can kill the player. */
  fromPlayer: boolean;
}

export interface SpawnProjectile {
  x: number;
  y: number;
  z: number;
  source: Entity;
  target: Entity;
  speed: number;
  base: number;
  coeff: number;
  damageType: DamageType;
  leech?: number;
  fromPlayer: boolean;
}

const HIT_RADIUS = 0.8;
const MAX_TTL = 4;

export class Projectiles {
  readonly list: Projectile[] = [];

  spawn(o: SpawnProjectile): void {
    let p = this.list.find((q) => !q.active);
    if (!p) {
      p = {} as Projectile;
      this.list.push(p);
    }
    p.active = true;
    p.x = o.x;
    p.y = o.y;
    p.z = o.z;
    p.source = o.source;
    p.target = o.target;
    p.speed = o.speed;
    p.base = o.base;
    p.coeff = o.coeff;
    p.damageType = o.damageType;
    p.leech = o.leech ?? 0;
    p.fromPlayer = o.fromPlayer;
    p.ttl = MAX_TTL;
  }

  update(world: World, dt: number, rng: Rng): void {
    for (const p of this.list) {
      if (!p.active) continue;
      p.ttl -= dt;
      const tt = world.get<Transform>(p.target, C.Transform);
      const th = world.get<Health>(p.target, C.Health);
      if (p.ttl <= 0 || !tt || !th || th.current <= 0) {
        p.active = false;
        continue;
      }

      const dx = tt.x - p.x;
      const dz = tt.z - p.z;
      const dist = Math.hypot(dx, dz);
      const step = p.speed * dt;

      if (dist <= Math.max(HIT_RADIUS, step)) {
        p.x = tt.x;
        p.z = tt.z;
        p.y = tt.y;
        const res = applyDamage(
          world,
          p.source,
          p.target,
          { base: p.base, coeff: p.coeff, damageType: p.damageType },
          rng,
          p.leech,
        );
        if (p.fromPlayer) {
          if (res.killed) rewardKill(world, p.source, p.target, rng);
        } else {
          markCombat(world, p.target);
          if (res.killed) {
            world.events.emit<PlayerDiedEvent>(CombatEvent.PlayerDied, { entity: p.target });
          }
        }
        p.active = false;
      } else {
        p.x += (dx / dist) * step;
        p.z += (dz / dist) * step;
        p.y = tt.y + 1; // track roughly chest-high
      }
    }
  }
}

function markCombat(world: World, e: Entity): void {
  const cs = world.get<CombatState>(e, C.CombatState);
  if (cs) {
    cs.inCombat = true;
    cs.sinceEventSec = 0;
  }
}
