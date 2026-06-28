// Loot: gold auto-collects on proximity every tick; uncollected drops despawn after
// their TTL (keeps the world-entity count bounded). Item pickup is an explicit action
// (the centralized F interact in the bootstrap calls `pickUpNearest`), so the loot
// system no longer reads input. Pure simulation. See docs/design/COMBAT_DESIGN.md#12-loot-pickup.

import type { System, World, Entity } from '../../core/ecs/world';
import {
  C,
  type Transform,
  type Inventory,
  type Item,
  type LootDrop,
  type RelicCollection,
} from '../../core/ecs/components';
import { addItem } from '../inventory';
import {
  CombatEvent,
  type GoldGainedEvent,
  type LootPickedEvent,
} from '../combat/events';

const GOLD_RADIUS = 2.5;
export const PICKUP_RADIUS = 2.5;

export function createLootSystem(): System {
  return {
    name: 'loot',
    update(world: World, dt: number): void {
      let player: Entity | null = null;
      for (const p of world.query(C.PlayerControlled, C.Transform, C.Inventory)) {
        player = p;
        break;
      }
      if (player == null) return;
      const pt = world.get<Transform>(player, C.Transform)!;
      const inv = world.get<Inventory>(player, C.Inventory)!;

      for (const e of world.query(C.LootDrop, C.Transform)) {
        const ld = world.get<LootDrop>(e, C.LootDrop)!;

        // Despawn after the grace period (keeps world-entity count bounded).
        ld.ttl -= dt;
        if (ld.ttl <= 0) {
          world.destroyEntity(e);
          continue;
        }

        const lt = world.get<Transform>(e, C.Transform)!;
        const dist = Math.hypot(lt.x - pt.x, lt.z - pt.z);

        // Gold auto-pickup.
        if (ld.gold > 0 && dist <= GOLD_RADIUS) {
          const amount = ld.gold;
          inv.gold += amount;
          ld.gold = 0;
          world.events.emit<GoldGainedEvent>(CombatEvent.GoldGained, {
            amount,
            total: inv.gold,
          });
        }

        // Destroy fully-consumed drops.
        if (!ld.item && ld.gold <= 0) world.destroyEntity(e);
      }
    },
  };
}

/**
 * Pick up the nearest in-range item drop into the player's bag. Returns the item
 * picked up (for feedback), or null if there was nothing to grab / the bag was full.
 * The centralized F interact in the bootstrap calls this first.
 */
export function pickUpNearest(world: World): Item | null {
  let player: Entity | null = null;
  for (const p of world.query(C.PlayerControlled, C.Transform, C.Inventory)) {
    player = p;
    break;
  }
  if (player == null) return null;
  const pt = world.get<Transform>(player, C.Transform)!;

  let nearest: Entity | null = null;
  let nearestDist = Infinity;
  for (const e of world.query(C.LootDrop, C.Transform)) {
    const ld = world.get<LootDrop>(e, C.LootDrop)!;
    if (!ld.item) continue;
    const lt = world.get<Transform>(e, C.Transform)!;
    const dist = Math.hypot(lt.x - pt.x, lt.z - pt.z);
    if (dist <= PICKUP_RADIUS && dist < nearestDist) {
      nearestDist = dist;
      nearest = e;
    }
  }
  if (nearest == null) return null;

  const ld = world.get<LootDrop>(nearest, C.LootDrop)!;
  const item = ld.item!;
  if (!addItem(world, player, item)) return null;
  // Endgame chase: a picked-up relic is permanently "discovered" (collection progress).
  if (item.relic) {
    const coll = world.get<RelicCollection>(player, C.RelicCollection);
    if (coll && !coll.discovered.includes(item.relic)) coll.discovered.push(item.relic);
  }
  world.events.emit<LootPickedEvent>(CombatEvent.LootPicked, { item });
  ld.item = null;
  if (ld.gold <= 0) world.destroyEntity(nearest);
  return item;
}
