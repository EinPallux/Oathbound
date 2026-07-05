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
      for (const e of world.query(C.LootDrop, C.Transform)) {
        const ld = world.get<LootDrop>(e, C.LootDrop)!;

        // Despawn after the grace period (keeps world-entity count bounded).
        ld.ttl -= dt;
        if (ld.ttl <= 0) {
          world.destroyEntity(e);
          continue;
        }

        // Gold auto-collects to the drop's owner when they're nearby (instanced loot: each
        // drop belongs to the player who earned it — with a single player, that's just them).
        if (ld.gold > 0) {
          const ownerT = world.get<Transform>(ld.owner, C.Transform);
          const ownerInv = world.get<Inventory>(ld.owner, C.Inventory);
          if (ownerT && ownerInv) {
            const lt = world.get<Transform>(e, C.Transform)!;
            if (Math.hypot(lt.x - ownerT.x, lt.z - ownerT.z) <= GOLD_RADIUS) {
              const amount = ld.gold;
              ownerInv.gold += amount;
              ld.gold = 0;
              world.events.emit<GoldGainedEvent>(CombatEvent.GoldGained, {
                amount,
                total: ownerInv.gold,
              });
            }
          }
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
export function pickUpNearest(world: World, player?: Entity): Item | null {
  // Default to the first player (single-player / focused tests); the server passes the specific
  // player who pressed interact.
  let p: Entity | null = player ?? null;
  if (p == null) {
    for (const q of world.query(C.PlayerControlled, C.Transform, C.Inventory)) {
      p = q;
      break;
    }
  }
  if (p == null) return null;
  const pt = world.get<Transform>(p, C.Transform);
  if (!pt) return null;

  let nearest: Entity | null = null;
  let nearestDist = Infinity;
  for (const e of world.query(C.LootDrop, C.Transform)) {
    const ld = world.get<LootDrop>(e, C.LootDrop)!;
    if (!ld.item) continue;
    // Owner-instanced loot: a drop owned by a *different* live player is not yours to take.
    // Unowned or orphaned (owner gone) drops are free to anyone.
    if (
      ld.owner !== p &&
      world.has(ld.owner) &&
      world.get(ld.owner, C.PlayerControlled) !== undefined
    ) {
      continue;
    }
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
  if (!addItem(world, p, item)) return null;
  // Endgame chase: a picked-up relic is permanently "discovered" (collection progress).
  if (item.relic) {
    const coll = world.get<RelicCollection>(p, C.RelicCollection);
    if (coll && !coll.discovered.includes(item.relic)) coll.discovered.push(item.relic);
  }
  world.events.emit<LootPickedEvent>(CombatEvent.LootPicked, { item });
  ld.item = null;
  if (ld.gold <= 0) world.destroyEntity(nearest);
  return item;
}
