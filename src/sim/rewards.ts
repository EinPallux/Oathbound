// Kill rewards: XP, gold + loot drop, and flagging the enemy dead. Shared by the
// player combat system (melee/cone/trap) and the projectile system (ranged) so a kill
// pays out identically however it landed. Pure simulation.

import type { World, Entity } from '../core/ecs/world';
import {
  C,
  type Transform,
  type Enemy,
  type EnemyInfo,
  type Progression,
  type PlayerClass,
  type LootDrop,
  type LootLuck,
  type Boss,
  type RelicMods,
  type Health,
  type AbilityState,
} from '../core/ecs/components';
import type { Rng } from '../core/rng';
import { grantXp } from './progression';
import { conXpMultiplier } from './stats';
import { rollLoot, pityMultiplier, isRarePlus } from './loot/droptable';
import { makeRelic, rollRelicDrop } from './loot/relics';
import { getClass } from './classes';
import { threatParticipants, clearThreat } from './combat/threat';
import { CombatEvent, type DeathEvent, type LootDroppedEvent } from './combat/events';

/** Grace period (s) before an uncollected drop despawns. */
export const LOOT_TTL = 120;

/**
 * Pay out an enemy kill. Every player who built threat on it is a **participant** (the final-blow
 * `killer` first) — each earns **full XP** (scaled to their own level) and their **own** loot
 * drop (owner-instanced, so no one can take another's). With a single player this is exactly the
 * old behaviour, byte-for-byte (killer first → identical RNG draws).
 */
export function rewardKill(world: World, killer: Entity, victim: Entity, rng: Rng): void {
  const enemy = world.get<Enemy>(victim, C.Enemy);
  const einfo = world.get<EnemyInfo>(victim, C.EnemyInfo);
  const enemyLevel = einfo?.level ?? 1;
  const tr = world.get<Transform>(victim, C.Transform)!;
  const tier = enemy?.tier ?? 'standard';
  const boss = world.get<Boss>(victim, C.Boss);

  // Participants: the killer, then every other living player that damaged this enemy. (A dead
  // participant who's still in the world stays eligible — assisting a kill counts.)
  const participants: Entity[] = [killer];
  for (const p of threatParticipants(world, victim)) {
    if (p !== killer && world.has(p) && world.get(p, C.PlayerControlled) !== undefined) participants.push(p);
  }

  for (const p of participants) {
    const prog = world.get<Progression>(p, C.Progression);
    if (enemy && prog) {
      const xp = Math.round(enemy.xpBase * conXpMultiplier(prog.level, enemyLevel));
      grantXp(world, p, xp);
    }
    // Relic on-kill effects (Reaper): heal + shave cooldowns when a participant scores the kill.
    applyKillRelicEffects(world, p);
    payoutLoot(world, p, victim, enemy, boss, enemyLevel, tier, tr, rng);
  }

  clearThreat(world, victim);
  if (enemy) {
    enemy.state = 'dead';
    enemy.deadFor = 0;
  }
  world.events.emit<DeathEvent>(CombatEvent.Death, { entity: victim, killer });
}

/** Roll one participant's own loot (their class/pity), and spawn a drop owned by them. */
function payoutLoot(
  world: World,
  p: Entity,
  _victim: Entity,
  enemy: Enemy | undefined,
  boss: Boss | undefined,
  enemyLevel: number,
  tier: Enemy['tier'],
  tr: Transform,
  rng: Rng,
): void {
  const primary = getClass(world.get<PlayerClass>(p, C.PlayerClass)?.id ?? 'warrior').primaryStatId;
  const lootPrimary = primary === 'VIT' ? 'STR' : primary;

  // Bad-luck protection: boost rare+ odds by this player's pity.
  const luck = world.get<LootLuck>(p, C.LootLuck);
  const roll = rollLoot(rng, enemyLevel, tier, 1, lootPrimary, luck ? pityMultiplier(luck.pity) : 1);

  // World bosses can drop a Relic (the apex), replacing the normal roll.
  let item = roll.item;
  if (boss) {
    const relicId = rollRelicDrop(rng, boss.bossId);
    if (relicId) item = makeRelic(rng, relicId);
  }

  if (luck) {
    if (item && isRarePlus(item.rarity)) luck.pity = 0;
    else luck.pity += 1;
  }
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
  world.set<LootDrop>(drop, C.LootDrop, { item, gold, owner: p, ttl: LOOT_TTL });
  world.events.emit<LootDroppedEvent>(CombatEvent.LootDropped, {
    entity: drop,
    item,
    gold,
    x: tr.x,
    y: tr.y,
    z: tr.z,
  });
}

/** Reaper relic: on each kill, heal a fraction of max HP and shave all cooldowns. */
function applyKillRelicEffects(world: World, killer: Entity): void {
  const relic = world.get<RelicMods>(killer, C.RelicMods);
  if (!relic) return;
  if (relic.killHealFrac > 0) {
    const h = world.get<Health>(killer, C.Health);
    if (h && h.current > 0) h.current = Math.min(h.max, h.current + h.max * relic.killHealFrac);
  }
  if (relic.killCdr > 0) {
    const ab = world.get<AbilityState>(killer, C.AbilityState);
    if (ab) {
      for (let i = 0; i < ab.cooldowns.length; i++) {
        ab.cooldowns[i] = Math.max(0, ab.cooldowns[i] - relic.killCdr);
      }
    }
  }
}
