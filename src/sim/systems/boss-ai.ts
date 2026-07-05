// World-boss AI: the *escalation* layer on top of enemy-ai (which already drives a
// boss's locomotion + basic swings as a melee bruiser). Each tick this derives the
// boss's phase from its HP and, while it's actively fighting, telegraphs a heavy ground
// attack on a per-phase cadence — a GroundAoe (`hitsPlayer`) dropped at the player's
// feet that lands after a short wind-up unless they step out. Pure sim (no Three.js/DOM).

import type { System, World, Entity } from '../../core/ecs/world';
import {
  C,
  type Transform,
  type Health,
  type Enemy,
  type Boss,
  type EnemyInfo,
  type GroundAoe,
} from '../../core/ecs/components';
import type { Heightfield } from '../../world/heightfield';
import { topThreatPlayer } from '../combat/threat';
import { CombatEvent, type BossPhaseEvent } from '../combat/events';

/** Each extra player engaged in a boss fight adds this fraction of its base HP (v1 tuning). */
const BOSS_HP_PER_PLAYER = 0.6;
/** Players within this distance of the boss count as "in the fight" for HP scaling. */
const BOSS_ENGAGE_RANGE = 34;

export interface BossAiDeps {
  field: Heightfield;
}

export function createBossAiSystem(deps: BossAiDeps): System {
  const { field } = deps;
  const players: { e: Entity; t: Transform; alive: boolean }[] = [];
  return {
    name: 'boss-ai',
    update(world: World, dt: number): void {
      // All players in the slice; each boss targets the highest-threat living one (M5).
      players.length = 0;
      for (const p of world.query(C.PlayerControlled, C.Transform, C.Health)) {
        players.push({
          e: p,
          t: world.get<Transform>(p, C.Transform)!,
          alive: (world.get<Health>(p, C.Health)?.current ?? 0) > 0,
        });
      }
      const aliveSet = new Set<Entity>();
      for (const pl of players) if (pl.alive) aliveSet.add(pl.e);

      for (const e of world.query(C.Boss, C.Enemy, C.Health)) {
        const boss = world.get<Boss>(e, C.Boss)!;
        const en = world.get<Enemy>(e, C.Enemy)!;
        const h = world.get<Health>(e, C.Health)!;
        if (boss.baseMaxHp == null) boss.baseMaxHp = h.max; // capture the unscaled base once

        // Dead → reset escalation + restore base HP for the next (possibly solo) pull.
        if (h.current <= 0) {
          boss.phase = 0;
          boss.heavyTimer = boss.heavyCadence[0] * 0.6;
          if (boss.baseMaxHp != null) h.max = boss.baseMaxHp;
          boss.scaledForPlayers = 0;
          continue;
        }

        // Derive the current phase from HP and announce escalations (never de-escalate).
        const frac = h.current / h.max;
        let phase = 0;
        for (const t of boss.phaseThresholds) if (frac <= t) phase++;
        if (phase > boss.phase) {
          boss.phase = phase;
          const info = world.get<EnemyInfo>(e, C.EnemyInfo);
          world.events.emit<BossPhaseEvent>(CombatEvent.BossPhase, {
            entity: e,
            name: info?.name ?? 'Boss',
            phase: phase + 1, // 1-based for display
            totalPhases: boss.phaseThresholds.length + 1,
          });
        }

        // Target the highest-threat living player (its heavy lands on them); fall back to the
        // nearest before any threat exists. With one player this is unchanged.
        const bt = world.get<Transform>(e, C.Transform);
        let pt: Transform | undefined;
        let best = Infinity;
        if (bt) {
          for (const pl of players) {
            if (!pl.alive) continue;
            const d = (pl.t.x - bt.x) ** 2 + (pl.t.z - bt.z) ** 2;
            if (d < best) {
              best = d;
              pt = pl.t;
            }
          }
          const tp = topThreatPlayer(world, e, aliveSet);
          if (tp != null) {
            const tpt = world.get<Transform>(tp, C.Transform);
            if (tpt) pt = tpt;
          }
        }

        // Only telegraph heavies while actively fighting a living player; otherwise keep
        // the timer primed so a fresh pull doesn't open with an instant slam.
        const fighting = en.state === 'engage' || en.state === 'attack';

        // On the first engaged tick, scale the boss's HP by how many players are in the fight
        // (solo → base; each extra player +60%). Reset to base on death (above).
        if (fighting && (boss.scaledForPlayers ?? 0) === 0 && bt) {
          let n = 0;
          for (const pl of players) {
            if (pl.alive && (pl.t.x - bt.x) ** 2 + (pl.t.z - bt.z) ** 2 <= BOSS_ENGAGE_RANGE ** 2) n++;
          }
          n = Math.max(1, n);
          boss.scaledForPlayers = n;
          if (n > 1 && boss.baseMaxHp != null) {
            const scaled = Math.round(boss.baseMaxHp * (1 + (n - 1) * BOSS_HP_PER_PLAYER));
            h.max = scaled;
            h.current = scaled;
          }
        }

        if (!fighting || pt == null) {
          boss.heavyTimer = boss.heavyCadence[0] * 0.6;
          continue;
        }

        boss.heavyTimer -= dt;
        if (boss.heavyTimer <= 0) {
          const cadence = boss.heavyCadence[Math.min(boss.phase, boss.heavyCadence.length - 1)];
          boss.heavyTimer = cadence;
          spawnHeavy(world, field, boss, e, pt.x, pt.z);
        }
      }
    },
  };
}

/** Drop a telegraphed heavy-attack zone at (x, z): a single delayed tick to the player. */
function spawnHeavy(
  world: World,
  field: Heightfield,
  boss: Boss,
  source: Entity,
  x: number,
  z: number,
): void {
  const g = world.createEntity();
  const y = field.sample(x, z) + 0.05;
  world.set<Transform>(g, C.Transform, {
    x,
    y,
    z,
    yaw: 0,
    prevX: x,
    prevY: y,
    prevZ: z,
    prevYaw: 0,
  });
  world.set<GroundAoe>(g, C.GroundAoe, {
    source,
    radius: boss.heavyRadius,
    // One delayed tick at `telegraph`, then expire just after.
    ttl: boss.heavyTelegraph + 0.18,
    tickEvery: boss.heavyTelegraph,
    tickTimer: boss.heavyTelegraph,
    base: boss.heavyBase,
    coeff: boss.heavyCoeff,
    damageType: boss.heavyType,
    hitsPlayer: true,
    telegraph: boss.heavyTelegraph,
  });
}
