// Vendors: sell unwanted gear for gold (a gold source) and, eventually, buy back /
// floor items (a gold sink). Pure simulation. Respects item locks, like salvage.
// See docs/design/ITEMS_AND_EQUIPMENT.md (economy: sources/sinks).

import type { World, Entity } from '../core/ecs/world';
import {
  C,
  type Item,
  type Rarity,
  type Inventory,
  type Transform,
} from '../core/ecs/components';
import { CombatEvent, type ItemSoldEvent } from './combat/events';

/** How close the player must stand to interact with a vendor. */
export const VENDOR_RADIUS = 3;

const RARITY_ORDER: Record<Rarity, number> = { common: 0, uncommon: 1, rare: 2 };
const RARITY_MULT: Record<Rarity, number> = { common: 1, uncommon: 3, rare: 6 };

/** Gold a vendor pays for an item (scales with ilvl + rarity). */
export function vendorValue(item: Item): number {
  return Math.max(1, Math.round(item.ilvl * RARITY_MULT[item.rarity] * 0.6) + 1);
}

/** The nearest vendor within `radius` of the player, or null. */
export function nearestVendor(world: World, player: Entity, radius = VENDOR_RADIUS): Entity | null {
  const pt = world.get<Transform>(player, C.Transform);
  if (!pt) return null;
  let best: Entity | null = null;
  let bestDist = radius;
  for (const e of world.query(C.Vendor, C.Transform)) {
    const vt = world.get<Transform>(e, C.Transform)!;
    const dist = Math.hypot(vt.x - pt.x, vt.z - pt.z);
    if (dist <= bestDist) {
      bestDist = dist;
      best = e;
    }
  }
  return best;
}

/** Sell one bagged item by uid. Fails if locked or missing. Returns success. */
export function sellItem(world: World, player: Entity, uid: string): boolean {
  const inv = world.get<Inventory>(player, C.Inventory)!;
  const idx = inv.items.findIndex((i) => i.uid === uid);
  if (idx < 0) return false;
  const item = inv.items[idx];
  if (item.locked) return false;

  inv.items.splice(idx, 1);
  const gold = vendorValue(item);
  inv.gold += gold;
  world.events.emit<ItemSoldEvent>(CombatEvent.ItemSold, { itemName: item.name, gold });
  return true;
}

/** Sell all unlocked bagged items at or below `maxRarity`. Returns the count sold. */
export function sellAllBelow(world: World, player: Entity, maxRarity: Rarity): number {
  const inv = world.get<Inventory>(player, C.Inventory)!;
  const targets = inv.items.filter(
    (i) => !i.locked && RARITY_ORDER[i.rarity] <= RARITY_ORDER[maxRarity],
  );
  let count = 0;
  for (const it of targets) if (sellItem(world, player, it.uid)) count++;
  return count;
}
