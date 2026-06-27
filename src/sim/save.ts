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
  type ClassId,
  type PlayerClass,
  type Progression,
  type Inventory,
  type Equipment,
  type Transform,
  type Health,
  type Resource,
  type Respawn,
  type Oathstone,
} from '../core/ecs/components';
import { recomputeDerived } from './inventory';
import { xpToNext } from './stats';

export const SCHEMA_VERSION = 1;

export interface SaveData {
  schemaVersion: number;
  updatedAt: number;
  classId: ClassId;
  character: { level: number; xp: number; xpToNext: number };
  gold: number;
  materials: number;
  position: { x: number; z: number };
  respawn: { x: number; z: number };
  /** Ids of activated Oathstones. */
  oathstones: string[];
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
  const respawn = world.get<Respawn>(player, C.Respawn);

  const oathstones: string[] = [];
  for (const e of world.query(C.Oathstone)) {
    const os = world.get<Oathstone>(e, C.Oathstone)!;
    if (os.activated) oathstones.push(os.id);
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: Date.now(),
    classId: world.get<PlayerClass>(player, C.PlayerClass)?.id ?? 'warrior',
    character: { level: prog.level, xp: prog.xp, xpToNext: prog.xpToNext },
    gold: inv.gold,
    materials: inv.materials,
    position: { x: tr.x, z: tr.z },
    respawn: { x: respawn?.x ?? tr.x, z: respawn?.z ?? tr.z },
    oathstones,
    inventory: clone(inv.items),
    equipment: clone(eq.slots),
  };
}

/** Apply a save snapshot onto the player's components, rebuilding derived stats. */
export function applySave(world: World, player: Entity, data: SaveData): void {
  const pc = world.get<PlayerClass>(player, C.PlayerClass);
  if (pc) pc.id = data.classId ?? 'warrior';

  const prog = world.get<Progression>(player, C.Progression)!;
  prog.level = data.character.level;
  prog.xp = data.character.xp;
  prog.xpToNext = xpToNext(prog.level);

  const inv = world.get<Inventory>(player, C.Inventory)!;
  inv.items = clone(data.inventory);
  inv.gold = data.gold;
  inv.materials = data.materials ?? 0;

  const eq = world.get<Equipment>(player, C.Equipment)!;
  eq.slots = clone(data.equipment);

  const tr = world.get<Transform>(player, C.Transform)!;
  tr.x = data.position.x;
  tr.z = data.position.z;
  tr.prevX = tr.x;
  tr.prevZ = tr.z;

  const respawn = world.get<Respawn>(player, C.Respawn);
  if (respawn && data.respawn) {
    respawn.x = data.respawn.x;
    respawn.z = data.respawn.z;
  }

  // Re-mark Oathstones that were activated in the saved run.
  const activated = new Set(data.oathstones ?? []);
  for (const e of world.query(C.Oathstone)) {
    const os = world.get<Oathstone>(e, C.Oathstone)!;
    if (activated.has(os.id)) os.activated = true;
  }

  recomputeDerived(world, player);
  const h = world.get<Health>(player, C.Health)!;
  h.current = h.max;
  const r = world.get<Resource>(player, C.Resource);
  if (r) r.current = 0;
}
