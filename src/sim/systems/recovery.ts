// Out-of-combat recovery, combat-state decay, and player death → respawn. Pure
// simulation. HP ramps to full in ≤8s out of combat; Fury slowly decays out of combat
// and trickles in during combat (Battle Hardened). See docs/design/SOLO_BALANCE_RULES.md.

import type { System, World, Entity } from '../../core/ecs/world';
import {
  C,
  type Transform,
  type Health,
  type Resource,
  type CombatState,
  type Statuses,
  type Target,
} from '../../core/ecs/components';
import type { Heightfield } from '../../world/heightfield';
import { addStatus, Status } from '../combat/statuses';
import { CombatEvent, type PlayerRespawnEvent } from '../combat/events';

/** Seconds of no combat events before leaving combat. */
const T_OUT_OF_COMBAT = 5;
/** Seconds to fully heal out of combat. */
const HP_RAMP_SEC = 8;
const FURY_DECAY_PER_SEC = 6;
const FURY_REGEN_IN_COMBAT = 3;
const RESPAWN_DELAY = 2;
const SHAKEN_SEC = 30;
const SHAKEN_MAGNITUDE = 0.1;
const PLAYER_HALF = 0.9;

export interface RecoveryDeps {
  field: Heightfield;
  spawnX: number;
  spawnZ: number;
}

export function createRecoverySystem(deps: RecoveryDeps): System {
  const { field, spawnX, spawnZ } = deps;
  const deadTimers = new Map<Entity, number>();

  return {
    name: 'recovery',
    update(world: World, dt: number): void {
      for (const e of world.query(C.PlayerControlled, C.Health, C.CombatState)) {
        const h = world.get<Health>(e, C.Health)!;
        const cs = world.get<CombatState>(e, C.CombatState)!;
        const res = world.get<Resource>(e, C.Resource);

        // Death → respawn after a short delay.
        if (h.current <= 0) {
          const t = (deadTimers.get(e) ?? 0) + dt;
          if (t >= RESPAWN_DELAY) {
            deadTimers.delete(e);
            respawn(world, e, h, res, cs, field, spawnX, spawnZ);
          } else {
            deadTimers.set(e, t);
          }
          continue;
        }

        // Combat-state decay.
        cs.sinceEventSec += dt;
        if (cs.sinceEventSec >= T_OUT_OF_COMBAT) cs.inCombat = false;

        // Regen.
        if (cs.inCombat) {
          if (res) res.current = Math.min(res.max, res.current + FURY_REGEN_IN_COMBAT * dt);
        } else {
          if (h.current < h.max) {
            h.current = Math.min(h.max, h.current + (h.max * dt) / HP_RAMP_SEC);
          }
          if (res) res.current = Math.max(0, res.current - FURY_DECAY_PER_SEC * dt);
        }
      }
    },
  };
}

function respawn(
  world: World,
  e: Entity,
  h: Health,
  res: Resource | undefined,
  cs: CombatState,
  field: Heightfield,
  spawnX: number,
  spawnZ: number,
): void {
  h.current = h.max;
  if (res) res.current = 0;
  cs.inCombat = false;
  cs.sinceEventSec = T_OUT_OF_COMBAT;

  const tr = world.get<Transform>(e, C.Transform);
  if (tr) {
    tr.x = spawnX;
    tr.z = spawnZ;
    tr.y = field.sample(spawnX, spawnZ) + PLAYER_HALF;
    tr.prevX = tr.x;
    tr.prevY = tr.y;
    tr.prevZ = tr.z;
  }
  const tgt = world.get<Target>(e, C.Target);
  if (tgt) tgt.entity = null;
  const ss = world.get<Statuses>(e, C.Statuses);
  if (ss) {
    ss.list.length = 0;
    addStatus(ss, Status.Shaken, SHAKEN_SEC, SHAKEN_MAGNITUDE);
  }
  world.events.emit<PlayerRespawnEvent>(CombatEvent.PlayerRespawn, { entity: e });
}
