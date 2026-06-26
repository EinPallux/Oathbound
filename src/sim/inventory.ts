// Inventory & equipment operations + derived-stat recomputation. Pure simulation
// (operates on the ECS world; no Three.js/DOM). Equipping recomputes the player's
// combat stats from level + gear (docs/design/PROGRESSION_AND_XP.md power model).

import type { World, Entity } from '../core/ecs/world';
import {
  C,
  type Item,
  type Inventory,
  type Equipment,
  type Offense,
  type Defense,
  type Health,
  type Resource,
  type Progression,
} from '../core/ecs/components';
import { deriveStats, FURY_MAX } from './stats';

/** Recompute the player's combat stats from level + equipped gear. */
export function recomputeDerived(world: World, player: Entity): void {
  const prog = world.get<Progression>(player, C.Progression)!;
  const eq = world.get<Equipment>(player, C.Equipment)!;
  const d = deriveStats(prog.level, eq);

  const off = world.get<Offense>(player, C.Offense)!;
  off.primaryStat = d.primaryStat;
  off.critChance = d.critChance;
  off.leech = d.leech;
  off.haste = d.haste;
  off.level = prog.level;

  const def = world.get<Defense>(player, C.Defense)!;
  def.armor = d.armor;

  const h = world.get<Health>(player, C.Health)!;
  h.max = d.maxHp;
  if (h.current > h.max) h.current = h.max;

  const r = world.get<Resource>(player, C.Resource);
  if (r) {
    r.max = FURY_MAX;
    if (r.current > r.max) r.current = r.max;
  }
}

/** Add an item to the inventory if there is room. Returns success. */
export function addItem(world: World, player: Entity, item: Item): boolean {
  const inv = world.get<Inventory>(player, C.Inventory)!;
  if (inv.items.length >= inv.capacity) return false;
  inv.items.push(item);
  return true;
}

/**
 * Equip an item from the inventory. The previously-equipped piece (if any) goes
 * back to the inventory. Recomputes derived stats. Returns the swapped-out item.
 */
export function equipItem(world: World, player: Entity, item: Item): Item | null {
  const inv = world.get<Inventory>(player, C.Inventory)!;
  const eq = world.get<Equipment>(player, C.Equipment)!;

  const idx = inv.items.findIndex((i) => i.uid === item.uid);
  if (idx >= 0) inv.items.splice(idx, 1);

  const previous = eq.slots[item.slot] ?? null;
  eq.slots[item.slot] = item;
  if (previous) inv.items.push(previous);

  recomputeDerived(world, player);
  return previous;
}
