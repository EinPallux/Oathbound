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
} from '../core/ecs/components';
import type { Rng } from '../core/rng';
import { grantXp } from './progression';
import { conXpMultiplier } from './stats';
import { rollLoot, pityMultiplier, isRarePlus } from './loot/droptable';
import { getClass } from './classes';
import { CombatEvent, type DeathEvent, type LootDroppedEvent } from './combat/events';

/** Grace period (s) before an uncollected drop despawns. */
export const LOOT_TTL = 120;

/** Pay out an enemy kill by `killer`: XP + a loot drop, and mark the enemy dead. */
export function rewardKill(world: World, killer: Entity, victim: Entity, rng: Rng): void {
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
  const primary = getClass(world.get<PlayerClass>(killer, C.PlayerClass)?.id ?? 'warrior').primaryStatId;
  const lootPrimary = primary === 'VIT' ? 'STR' : primary;

  // Bad-luck protection: boost rare+ odds by the killer's pity, then update it.
  const luck = world.get<LootLuck>(killer, C.LootLuck);
  const roll = rollLoot(rng, enemyLevel, tier, 1, lootPrimary, luck ? pityMultiplier(luck.pity) : 1);
  if (luck) {
    if (roll.item && isRarePlus(roll.item.rarity)) luck.pity = 0;
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
