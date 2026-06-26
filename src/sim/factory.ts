// Entity factories — the composition of components for the player and for the one
// Greenmarch enemy family in the slice (Bloomhusks, melee bruiser). Shared by the
// bootstrap and the tests so they exercise the same setup. Pure simulation.

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
  type Enemy,
  type EnemyInfo,
  type Targetable,
} from '../core/ecs/components';
import type { Heightfield } from '../world/heightfield';
import { ABILITIES } from './combat/abilities';
import { recomputeDerived } from './inventory';
import { xpToNext, xpPerKill, CRIT_MULT, FURY_MAX } from './stats';

export const PLAYER_HALF = 0.9;
const ENEMY_HALF = 0.9;

function transformAt(x: number, z: number, y: number, yaw = 0): Transform {
  return { x, y, z, yaw, prevX: x, prevY: y, prevZ: z, prevYaw: yaw };
}

/** Create the Warrior player entity (full component set), started at full HP. */
export function createPlayer(world: World, field: Heightfield, x = 0, z = 0): Entity {
  const e = world.createEntity();
  const y = field.sample(x, z) + PLAYER_HALF;

  world.set<Transform>(e, C.Transform, transformAt(x, z, y));
  world.set(e, C.Velocity, { x: 0, y: 0, z: 0 });
  world.set<Character>(e, C.Character, {
    radius: 0.4,
    halfHeight: PLAYER_HALF,
    runSpeed: 6,
    sprintSpeed: 9.5,
    jumpSpeed: 7,
    grounded: true,
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
  });
  world.set<Defense>(e, C.Defense, {
    armor: 0,
    resist: { fire: 0, frost: 0, blight: 0 },
    weakness: {},
  });
  world.set<Resource>(e, C.Resource, { current: 0, max: FURY_MAX });
  world.set<Statuses>(e, C.Statuses, { list: [] });
  world.set<CombatState>(e, C.CombatState, { inCombat: false, sinceEventSec: 999 });
  world.set<AbilityState>(e, C.AbilityState, {
    gcdRemaining: 0,
    cooldowns: ABILITIES.map(() => 0),
    bufferedIndex: -1,
    bufferRemaining: 0,
  });
  world.set<Target>(e, C.Target, { entity: null });

  recomputeDerived(world, e);
  const h = world.get<Health>(e, C.Health)!;
  h.current = h.max;
  return e;
}

// Bloomhusk (Greenmarch melee bruiser) stat curve — `v1` tuning targets.
function bloomhuskHp(level: number): number {
  return 34 + 12 * level;
}
function bloomhuskArmor(level: number): number {
  return 10 + 5 * level;
}
function bloomhuskPrimary(level: number): number {
  return 8 + 2 * level;
}

/** Create one Bloomhusk Thrasher at (x, z), its home/leash anchor. */
export function createBloomhusk(world: World, field: Heightfield, x: number, z: number, level = 1): Entity {
  const e = world.createEntity();
  const y = field.sample(x, z) + ENEMY_HALF;
  const hp = bloomhuskHp(level);

  world.set<Transform>(e, C.Transform, transformAt(x, z, y));
  world.set(e, C.Velocity, { x: 0, y: 0, z: 0 });
  world.set<Health>(e, C.Health, { current: hp, max: hp });
  world.set<Offense>(e, C.Offense, {
    primaryStat: bloomhuskPrimary(level),
    level,
    critChance: 0.05,
    critMult: CRIT_MULT,
    leech: 0,
    haste: 0,
  });
  world.set<Defense>(e, C.Defense, {
    armor: bloomhuskArmor(level),
    resist: { fire: 0, frost: 0, blight: 0 },
    weakness: { fire: 1.15 },
  });
  world.set<Statuses>(e, C.Statuses, { list: [] });
  world.set<Targetable>(e, C.Targetable, true);
  world.set<EnemyInfo>(e, C.EnemyInfo, { name: 'Bloomhusk Thrasher', level });
  world.set<Enemy>(e, C.Enemy, {
    archetype: 'melee_bruiser',
    family: 'Bloomhusks',
    tier: 'standard',
    state: 'idle',
    homeX: x,
    homeZ: z,
    aggroRadius: 10,
    leashRange: 35,
    socialRange: 6,
    moveSpeed: 3.4,
    attackRange: 2.2,
    attackCooldown: 2.0,
    attackTimer: 0,
    windup: 0.8,
    windupTimer: -1,
    attackBase: 6,
    attackCoeff: 0.6,
    xpBase: xpPerKill(level),
    goldMin: 2,
    goldMax: 6,
    lootTable: 'greenmarch_standard',
    respawnDelay: 30,
    deadFor: 0,
    invulnTimer: 0,
  });
  return e;
}
