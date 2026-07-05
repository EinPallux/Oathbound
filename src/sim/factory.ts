// Entity factories — the player composition, plus thin wrappers over the data-driven
// enemy spawner (src/sim/content/enemies.ts). Shared by the bootstrap and tests so
// they exercise the same setup. Pure simulation.

import type { World, Entity } from '../core/ecs/world';
import {
  C,
  type Transform,
  type Character,
  type Health,
  type Offense,
  type Defense,
  type AbilityState,
  type Target,
  type Resource,
  type Statuses,
  type CombatState,
  type Progression,
  type Inventory,
  type Equipment,
  type PlayerClass,
  type ClassId,
  type Respawn,
  type Oathstone,
  type Vendor,
  type LootLuck,
  type RelicCollection,
  type WaypointUnlocks,
} from '../core/ecs/components';
import type { Heightfield } from '../world/heightfield';
import { getClass, kitLength } from './classes';
import { recomputeDerived } from './inventory';
import { xpToNext, CRIT_MULT } from './stats';
import { spawnEnemy } from './content/enemies';

export const PLAYER_HALF = 0.9;

function transformAt(x: number, z: number, y: number, yaw = 0): Transform {
  return { x, y, z, yaw, prevX: x, prevY: y, prevZ: z, prevYaw: yaw };
}

/** Create the player entity (full component set) for a class, started at full HP. */
export function createPlayer(
  world: World,
  field: Heightfield,
  x = 0,
  z = 0,
  classId: ClassId = 'warrior',
): Entity {
  const e = world.createEntity();
  const y = field.sample(x, z) + PLAYER_HALF;
  const cls = getClass(classId);

  world.set<PlayerClass>(e, C.PlayerClass, { id: classId });
  world.set<Transform>(e, C.Transform, transformAt(x, z, y));
  world.set(e, C.Velocity, { x: 0, y: 0, z: 0 });
  world.set<Character>(e, C.Character, {
    radius: 0.4,
    halfHeight: PLAYER_HALF,
    runSpeed: 6.6,
    jumpSpeed: 7,
    grounded: true,
    mounted: false,
    mountCast: 0,
  });
  world.set(e, C.PlayerControlled, true);
  world.set<Progression>(e, C.Progression, { level: 1, xp: 0, xpToNext: xpToNext(1) });
  world.set<Equipment>(e, C.Equipment, { slots: {} });
  world.set<Inventory>(e, C.Inventory, { items: [], gold: 0, materials: 0, capacity: 30 });
  world.set<Health>(e, C.Health, { current: 1, max: 1 });
  world.set<Offense>(e, C.Offense, {
    primaryStat: 10,
    level: 1,
    critChance: 0.1,
    critMult: CRIT_MULT,
    leech: 0,
    haste: 0,
    healPower: 0,
  });
  world.set<Defense>(e, C.Defense, {
    armor: 0,
    resist: { fire: 0, frost: 0, blight: 0 },
    weakness: {},
  });
  world.set<Resource>(e, C.Resource, {
    current: cls.resource.startsFull ? cls.resource.max : 0,
    max: cls.resource.max,
  });
  world.set<Statuses>(e, C.Statuses, { list: [] });
  world.set<CombatState>(e, C.CombatState, { inCombat: false, sinceEventSec: 999 });
  world.set<AbilityState>(e, C.AbilityState, {
    gcdRemaining: 0,
    cooldowns: new Array(kitLength(cls)).fill(0),
    bufferedIndex: -1,
    bufferRemaining: 0,
  });
  world.set<Target>(e, C.Target, { entity: null });
  world.set<Respawn>(e, C.Respawn, { x, z });
  world.set<LootLuck>(e, C.LootLuck, { pity: 0 });
  world.set<RelicCollection>(e, C.RelicCollection, { discovered: [] });
  world.set<WaypointUnlocks>(e, C.WaypointUnlocks, { ids: [] });

  recomputeDerived(world, e);
  const h = world.get<Health>(e, C.Health)!;
  h.current = h.max;
  const r = world.get<Resource>(e, C.Resource)!;
  if (cls.resource.startsFull) r.current = r.max;
  return e;
}

/** Switch the player's class (fresh character / class-select). Resets the kit + pools. */
export function setPlayerClass(world: World, player: Entity, classId: ClassId): void {
  const cls = getClass(classId);
  const pc = world.get<PlayerClass>(player, C.PlayerClass);
  if (pc) {
    pc.id = classId;
    pc.choices = {}; // talent ids are class-specific — start fresh
  }
  const ab = world.get<AbilityState>(player, C.AbilityState)!;
  ab.cooldowns = new Array(kitLength(cls)).fill(0);
  ab.gcdRemaining = 0;
  ab.bufferedIndex = -1;
  ab.bufferRemaining = 0;
  recomputeDerived(world, player);
  const h = world.get<Health>(player, C.Health)!;
  h.current = h.max;
  const r = world.get<Resource>(player, C.Resource)!;
  r.current = cls.resource.startsFull ? cls.resource.max : 0;
}

// ── Enemy wrappers over the data-driven spawner (src/sim/content/enemies.ts) ──
// Kept for ergonomic call sites + stable test imports.

export function createBloomhusk(world: World, field: Heightfield, x: number, z: number, level = 1): Entity {
  return spawnEnemy(world, field, 'bloomhusk', x, z, { level });
}

export function createReaver(world: World, field: Heightfield, x: number, z: number, level = 1): Entity {
  return spawnEnemy(world, field, 'reaver', x, z, { level });
}

export function createWisp(world: World, field: Heightfield, x: number, z: number, level = 1): Entity {
  return spawnEnemy(world, field, 'wisp', x, z, { level });
}

// ── World props ──────────────────────────────────────────────────────────────

/** Create an Oathstone waypoint (inactive until visited). */
export function createOathstone(
  world: World,
  field: Heightfield,
  id: string,
  name: string,
  x: number,
  z: number,
): Entity {
  const e = world.createEntity();
  world.set<Transform>(e, C.Transform, transformAt(x, z, field.sample(x, z)));
  world.set<Oathstone>(e, C.Oathstone, { id, name, activated: false });
  return e;
}

/** Create a vendor (interact with F to sell). */
export function createVendor(
  world: World,
  field: Heightfield,
  name: string,
  x: number,
  z: number,
): Entity {
  const e = world.createEntity();
  world.set<Transform>(e, C.Transform, transformAt(x, z, field.sample(x, z) + PLAYER_HALF));
  world.set<Vendor>(e, C.Vendor, { name });
  return e;
}
