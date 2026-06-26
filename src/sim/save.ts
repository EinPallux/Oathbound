// Save serialization (pure). A versioned snapshot of the things worth persisting —
// character, gold, position, inventory, equipment — plus apply-to-world. The browser
// IndexedDB transport lives in src/platform/save-store.ts. Full migration/corruption
// hardening (idb + zod) is scheduled for the Technical Beta phase per ADR-005; this is
// "save v1". See docs/technical/SAVE_SYSTEM_PLAN.md.

import type { World, Entity } from '../core/ecs/world';
import {
  C,
  type Item,
  type EquipSlot,
  type Progression,
  type Inventory,
  type Equipment,
  type Transform,
  type Health,
  type Resource,
} from '../core/ecs/components';
import { recomputeDerived } from './inventory';
import { xpToNext } from './stats';

export const SCHEMA_VERSION = 1;

export interface SaveData {
  schemaVersion: number;
  updatedAt: number;
  character: { level: number; xp: number; xpToNext: number };
  gold: number;
  position: { x: number; z: number };
  inventory: Item[];
  equipment: Partial<Record<EquipSlot, Item>>;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** Capture a save snapshot from the player's components. */
export function serialize(world: World, player: Entity): SaveData {
  const prog = world.get<Progression>(player, C.Progression)!;
  const inv = world.get<Inventory>(player, C.Inventory)!;
  const eq = world.get<Equipment>(player, C.Equipment)!;
  const tr = world.get<Transform>(player, C.Transform)!;

  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: Date.now(),
    character: { level: prog.level, xp: prog.xp, xpToNext: prog.xpToNext },
    gold: inv.gold,
    position: { x: tr.x, z: tr.z },
    inventory: clone(inv.items),
    equipment: clone(eq.slots),
  };
}

/** Apply a save snapshot onto the player's components, rebuilding derived stats. */
export function applySave(world: World, player: Entity, data: SaveData): void {
  const prog = world.get<Progression>(player, C.Progression)!;
  prog.level = data.character.level;
  prog.xp = data.character.xp;
  prog.xpToNext = xpToNext(prog.level);

  const inv = world.get<Inventory>(player, C.Inventory)!;
  inv.items = clone(data.inventory);
  inv.gold = data.gold;

  const eq = world.get<Equipment>(player, C.Equipment)!;
  eq.slots = clone(data.equipment);

  const tr = world.get<Transform>(player, C.Transform)!;
  tr.x = data.position.x;
  tr.z = data.position.z;
  tr.prevX = tr.x;
  tr.prevZ = tr.z;

  recomputeDerived(world, player);
  const h = world.get<Health>(player, C.Health)!;
  h.current = h.max;
  const r = world.get<Resource>(player, C.Resource);
  if (r) r.current = 0;
}
