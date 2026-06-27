// Salvage v1 (unlocked at Lv 3): convert unwanted gear into Whetstones + a little
// gold. Respects item locks. Pure simulation. See docs/design/ITEMS_AND_EQUIPMENT.md.

import type { World, Entity } from '../core/ecs/world';
import {
  C,
  type Item,
  type Rarity,
  type Inventory,
  type Progression,
} from '../core/ecs/components';
import { CombatEvent, type ItemSalvagedEvent } from './combat/events';

export const SALVAGE_LEVEL = 3;

const RARITY_ORDER: Record<Rarity, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
const SALVAGE_BONUS: Record<Rarity, number> = { common: 0, uncommon: 2, rare: 4, epic: 7, legendary: 11 };
const GOLD_MULT: Record<Rarity, number> = { common: 1, uncommon: 2, rare: 3, epic: 5, legendary: 8 };

/** Whetstones + gold returned for salvaging an item (better gear feeds Reinforcement). */
export function salvageYield(item: Item): { whetstones: number; gold: number } {
  return {
    whetstones: 1 + SALVAGE_BONUS[item.rarity] + Math.floor(item.ilvl / 5),
    gold: Math.round(item.ilvl * GOLD_MULT[item.rarity]),
  };
}

export function canSalvage(level: number): boolean {
  return level >= SALVAGE_LEVEL;
}

/** Salvage one bagged item by uid. Fails if locked, missing, or below the unlock level. */
export function salvageItem(world: World, player: Entity, uid: string): boolean {
  const prog = world.get<Progression>(player, C.Progression)!;
  if (!canSalvage(prog.level)) return false;
  const inv = world.get<Inventory>(player, C.Inventory)!;
  const idx = inv.items.findIndex((i) => i.uid === uid);
  if (idx < 0) return false;
  const item = inv.items[idx];
  if (item.locked) return false;

  inv.items.splice(idx, 1);
  const y = salvageYield(item);
  inv.materials += y.whetstones;
  inv.gold += y.gold;
  world.events.emit<ItemSalvagedEvent>(CombatEvent.ItemSalvaged, {
    itemName: item.name,
    whetstones: y.whetstones,
    gold: y.gold,
  });
  return true;
}

/** Salvage all unlocked bagged items at or below `maxRarity`. Returns the count. */
export function salvageAllBelow(world: World, player: Entity, maxRarity: Rarity): number {
  const prog = world.get<Progression>(player, C.Progression)!;
  if (!canSalvage(prog.level)) return 0;
  const inv = world.get<Inventory>(player, C.Inventory)!;
  const targets = inv.items.filter(
    (i) => !i.locked && RARITY_ORDER[i.rarity] <= RARITY_ORDER[maxRarity],
  );
  let count = 0;
  for (const it of targets) if (salvageItem(world, player, it.uid)) count++;
  return count;
}
