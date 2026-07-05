// Assembles the pure simulation world — the ECS, its entities (player, enemies, bosses,
// oathstones, vendor) and the fixed system pipeline — from already-built world data. This is
// the render-free heart of the game: the browser bootstrap (src/game/bootstrap.ts) and the
// headless multiplayer server both call it, so there is exactly ONE definition of the sim
// wiring and the two can never drift. No three.js, no DOM, no Node APIs — it runs anywhere
// the simulation runs. See docs/technical/MMO_ARCHITECTURE.md (§the M2 refactor builds on this).

import { World, type Entity } from '../../core/ecs/world';
import { Rng } from '../../core/rng';
import { SpatialGrid } from '../spatial-grid';
import { Projectiles } from '../projectiles';
import { Telemetry, createTelemetrySystem } from '../telemetry';
import { createPlayer, createOathstone, createVendor } from '../factory';
import { spawnEnemy } from '../content/enemies';
import { spawnBoss } from '../content/bosses';
import { createSpatialSystem } from '../systems/spatial';
import { createMovementSystem } from '../systems/movement';
import { createCombatSystem } from '../systems/combat';
import { createEnemyAiSystem } from '../systems/enemy-ai';
import { createBossAiSystem } from '../systems/boss-ai';
import { createProjectileSystem } from '../systems/projectile';
import { createTrapSystem } from '../systems/trap';
import { createGroundAoeSystem } from '../systems/ground-aoe';
import { createLootSystem } from '../systems/loot';
import { createWaypointSystem } from '../systems/waypoint';
import { createRecoverySystem } from '../systems/recovery';
import type { Heightfield, CylinderCollider } from '../../world/heightfield';
import type { BoxCollider } from '../collision';
import type { ControlState } from '../../platform/input';
import type { Spawn } from '../content/spawns';
import type { BossId } from '../content/bosses';
import { C, type ClassId } from '../../core/ecs/components';

/** A waypoint to place (stable id + display name + position). */
export interface OathstonePlacement {
  id: string;
  name: string;
  x: number;
  z: number;
}

/** A world boss to place. */
export interface BossPlacement {
  id: BossId;
  x: number;
  z: number;
}

export interface SimWorldInput {
  /** Gameplay heightfield — the caller sets its voxel collision grid before passing it in. */
  field: Heightfield;
  /** Round physical colliders (rocks, boulders, round assets). */
  colliders: CylinderCollider[];
  /** Rectangular footprint colliders (buildings/walls). */
  boxes: BoxCollider[];
  /** Where the player spawns (also the recovery system's fallback respawn point). */
  playerStart: { x: number; z: number };
  spawns: readonly Spawn[];
  bosses: readonly BossPlacement[];
  oathstones: readonly OathstonePlacement[];
  vendor: { name: string; x: number; z: number };
  /**
   * The primary player's intent source (keyboard client, network packet, or null input). When
   * provided, a primary player is created at `playerStart`. Omit it for a multi-player server,
   * which creates a player per connection with {@link addPlayer} instead.
   */
  input?: ControlState;
  /** Gameplay RNG seed. Defaults to the historical client seed so rolls match. */
  seed?: number;
  /** Starting class; bootstrap overrides from the save / new-character choice afterward. */
  playerClass?: ClassId;
}

export interface SimWorld {
  world: World;
  /** The primary player, or null when the world was built without one (server: per-connection). */
  player: Entity | null;
  rng: Rng;
  grid: SpatialGrid;
  projectiles: Projectiles;
  telemetry: Telemetry;
}

/** The gameplay RNG seed shared by every world (the historical bootstrap value). */
export const DEFAULT_SIM_SEED = 0xc0ffee;

/**
 * Create a player entity and attach its per-tick intent source as a PlayerInput component, so
 * the movement/combat systems drive it independently of any other player. Used for the primary
 * player (offline/tests) and for each networked connection on the server.
 */
export function addPlayer(
  world: World,
  field: Heightfield,
  input: ControlState,
  opts: { x: number; z: number; classId?: ClassId },
): Entity {
  const e = createPlayer(world, field, opts.x, opts.z, opts.classId);
  world.set<ControlState>(e, C.PlayerInput, input);
  return e;
}

/**
 * Build the ECS, spawn the standard entity set, and register the fixed system pipeline.
 * Entities are created in a fixed order so entity ids are deterministic (the player is id 1),
 * and systems are registered in the canonical order (spatial → movement → combat → enemy AI →
 * boss AI → projectiles → traps → ground-AoE → loot → waypoint → recovery → telemetry).
 */
export function createSimWorld(opts: SimWorldInput): SimWorld {
  const { field, colliders, boxes, playerStart, spawns, bosses, oathstones, vendor, input } = opts;

  const world = new World();
  const rng = new Rng(opts.seed ?? DEFAULT_SIM_SEED);
  const grid = new SpatialGrid(8);
  const projectiles = new Projectiles();
  const telemetry = new Telemetry();

  // Entities (fixed creation order → deterministic ids). The primary player is created first
  // (offline/tests → id 1) only when an input is given; a server omits it and adds a player per
  // connection with addPlayer(). Players drive themselves via their own PlayerInput component,
  // so the movement/combat systems no longer take a single shared input.
  const player = input ? addPlayer(world, field, input, { x: playerStart.x, z: playerStart.z, classId: opts.playerClass }) : null;
  for (const s of spawns) {
    spawnEnemy(world, field, s.id, s.x, s.z, { level: s.level, tier: s.tier, name: s.name });
  }
  for (const b of bosses) spawnBoss(world, field, b.id, b.x, b.z);
  for (const o of oathstones) createOathstone(world, field, o.id, o.name, o.x, o.z);
  createVendor(world, field, vendor.name, vendor.x, vendor.z);
  if (player != null) telemetry.attach(world, player);

  // Systems (canonical order; waypoint after movement so it sees the updated position, and
  // before recovery so respawn binds to the stone just visited).
  world.addSystem(createSpatialSystem(grid));
  world.addSystem(createMovementSystem({ field, colliders, boxes }));
  world.addSystem(createCombatSystem({ rng, colliders, field, projectiles, grid }));
  world.addSystem(createEnemyAiSystem({ field, colliders, rng, grid, projectiles }));
  world.addSystem(createBossAiSystem({ field }));
  world.addSystem(createProjectileSystem(projectiles, rng));
  world.addSystem(createTrapSystem(rng));
  world.addSystem(createGroundAoeSystem(rng));
  world.addSystem(createLootSystem());
  world.addSystem(createWaypointSystem());
  world.addSystem(createRecoverySystem({ field, spawnX: playerStart.x, spawnZ: playerStart.z }));
  world.addSystem(createTelemetrySystem(telemetry));

  return { world, player, rng, grid, projectiles, telemetry };
}
