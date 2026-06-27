// Reinforcement (the optional gold + whetstone upgrade sink). Spend currency to add
// +1..+5 effective item levels to a piece you own, strengthening its base stats
// (primary + armor). A supplement to the drop chase + bad-luck insurance, not crafting.
// Pure simulation. See docs/design/ITEMS_AND_EQUIPMENT.md (Reinforcement) + ADR-010.

import type { World, Entity } from '../core/ecs/world';
import { C, type Item, type Inventory, type Equipment } from '../core/ecs/components';
import { slotBudget, baseStatsFromBudget, scoreItem, effectiveIlvl } from './loot/items';
import { recomputeDerived } from './inventory';
import { CombatEvent, type ItemReinforcedEvent } from './combat/events';

/** Maximum reinforcement steps per item (caps below the next rarity's natural power). */
export const MAX_REINFORCE = 5;

/** Gold + whetstone cost of the *next* reinforcement step (rises with step + ilvl). */
export function reinforceCost(item: Item): { gold: number; whetstones: number } {
  const step = (item.reinforced ?? 0) + 1; // 1..5
  return {
    whetstones: 1 + step, // 2,3,4,5,6
    gold: Math.round(item.ilvl * 4 * step),
  };
}

export function canReinforce(item: Item): boolean {
  return (item.reinforced ?? 0) < MAX_REINFORCE;
}

/** Find an owned item (equipped first, then bag) by uid. */
function findOwned(
  world: World,
  player: Entity,
  uid: string,
): { item: Item; equipped: boolean } | null {
  const eq = world.get<Equipment>(player, C.Equipment)!;
  for (const slot of Object.keys(eq.slots) as (keyof typeof eq.slots)[]) {
    const it = eq.slots[slot];
    if (it && it.uid === uid) return { item: it, equipped: true };
  }
  const inv = world.get<Inventory>(player, C.Inventory)!;
  const bagged = inv.items.find((i) => i.uid === uid);
  return bagged ? { item: bagged, equipped: false } : null;
}

/** Re-derive an item's base stats (primary + armor) for its current effective ilvl.
 *  `baseStatsFromBudget` returns armor 0 for non-armor slots, so this is correct for both. */
function restat(item: Item): void {
  const budget = slotBudget(item.slot, item.rarity, effectiveIlvl(item));
  const bs = baseStatsFromBudget(item.slot, budget);
  item.primary.value = bs.primaryValue;
  item.armor = bs.armor;
  item.score = scoreItem(item);
}

/**
 * Reinforce an owned item by uid: spend gold + whetstones, add a step, and restat.
 * Returns success (fails if maxed, unaffordable, or not found). Recomputes derived
 * stats if the item was equipped.
 */
export function reinforceItem(world: World, player: Entity, uid: string): boolean {
  const found = findOwned(world, player, uid);
  if (!found || !canReinforce(found.item)) return false;

  const inv = world.get<Inventory>(player, C.Inventory)!;
  const cost = reinforceCost(found.item);
  if (inv.gold < cost.gold || inv.materials < cost.whetstones) return false;

  inv.gold -= cost.gold;
  inv.materials -= cost.whetstones;
  found.item.reinforced = (found.item.reinforced ?? 0) + 1;
  restat(found.item);

  if (found.equipped) recomputeDerived(world, player);
  world.events.emit<ItemReinforcedEvent>(CombatEvent.ItemReinforced, {
    itemName: found.item.name,
    level: found.item.reinforced,
  });
  return true;
}
