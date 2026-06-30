// Builds the *pure* world data (no three.js) for a custom map authored in the Admin
// Tools Map Builder: the heightfield, physical colliders, biome sampler, enemy/boss
// placements, and a minimal Scenery for the minimap. The renderer turns the same map into
// meshes (src/render/custom-map-view.ts). Loaded only when a map is requested; with none,
// the procedural world (heightfield.ts / scenery.ts) is unchanged.

import { Heightfield, type CylinderCollider, type BoxCollider } from './heightfield';
import { clamp } from '../core/math';
import { TERRAIN_RENDER_RES } from './layout';
import { unpackHeights, ENEMY_IDS, BOSS_IDS, type AssetDef, type OathboundMap } from './map-format';
import { presetById } from './presets';
import type { Scenery } from './scenery';
import type { Spawn } from '../sim/content/spawns';
import type { EnemyTemplateId, Tier } from '../sim/content/enemies';
import type { BossId } from '../sim/content/bosses';

/** Collider radius (m, at scale 1) for a built-in boulder — mirrors the builder catalog. */
const BOULDER_COLLIDER = 0.95;

/**
 * Construct the gameplay heightfield from the map's stored grid.
 *
 * The terrain *mesh* is tessellated at most TERRAIN_RENDER_RES vertices per side (a perf
 * cap), so a higher-res authored field would be drawn as a *smoother* surface than the
 * full-res field the player snaps to — leaving you half-buried on detailed (heightmap)
 * terrain. To keep collision exactly on the surface that's drawn, resample the gameplay
 * field down to the render grid whenever the map is finer than it. Maps at or below the
 * render resolution are used as-authored (the mesh tessellates at their full res).
 */
export function buildCustomHeightfield(map: OathboundMap): Heightfield {
  const heights = unpackHeights(map);
  if (map.res <= TERRAIN_RENDER_RES) return new Heightfield(map.size, map.res, heights);

  const full = new Heightfield(map.size, map.res, heights);
  const res = TERRAIN_RENDER_RES;
  const half = map.size / 2;
  const cell = map.size / (res - 1);
  const down = new Float32Array(res * res);
  for (let z = 0; z < res; z++) {
    for (let x = 0; x < res; x++) {
      down[z * res + x] = full.sample(-half + x * cell, -half + z * cell);
    }
  }
  return new Heightfield(map.size, res, down);
}

/** Resolve a placed asset id to its definition (preset library or per-map custom). */
function defFor(assetId: string, map: OathboundMap): AssetDef | null {
  if (assetId.startsWith('preset:')) return presetById(assetId.slice('preset:'.length)) ?? null;
  if (assetId.startsWith('custom:')) return map.customAssets.find((d) => `custom:${d.id}` === assetId) ?? null;
  return null;
}

/**
 * Round colliders for a custom map: built-in boulders + any preset/custom asset that
 * declares a collider radius, each scaled by its placement scale. Decorative props add no
 * colliders (matching the game's "scenery is visual" rule).
 */
export function customColliders(map: OathboundMap): CylinderCollider[] {
  const out: CylinderCollider[] = [];
  for (const a of map.assets) {
    if (a.asset.startsWith('boulder:')) {
      out.push({ x: a.x, z: a.z, radius: BOULDER_COLLIDER * a.scale });
      continue;
    }
    const def = defFor(a.asset, map);
    if (def && def.collider && def.collider > 0) out.push({ x: a.x, z: a.z, radius: def.collider * a.scale });
  }
  return out;
}

/** Rectangular footprint colliders for placed buildings/walls (preset/custom with a box). */
export function customBoxColliders(map: OathboundMap): BoxCollider[] {
  const out: BoxCollider[] = [];
  for (const a of map.assets) {
    const def = defFor(a.asset, map);
    if (def && def.box) {
      out.push({ x: a.x, z: a.z, hw: def.box.hw * a.scale, hd: def.box.hd * a.scale, rot: a.rot });
    }
  }
  return out;
}

const ENEMY_SET = new Set<string>(ENEMY_IDS);
const BOSS_SET = new Set<string>(BOSS_IDS);

/** Valid enemy spawns from the map (unknown ids dropped). */
export function customSpawns(map: OathboundMap): Spawn[] {
  const out: Spawn[] = [];
  for (const s of map.spawns) {
    if (!ENEMY_SET.has(s.id)) continue;
    out.push({
      id: s.id as EnemyTemplateId,
      x: s.x,
      z: s.z,
      level: clamp(Math.round(s.level), 1, 60),
      tier: s.tier as Tier | undefined,
      name: s.name,
    });
  }
  return out;
}

/** Valid boss placements from the map (unknown ids dropped). */
export function customBosses(map: OathboundMap): { id: BossId; x: number; z: number }[] {
  const out: { id: BossId; x: number; z: number }[] = [];
  for (const b of map.bosses) {
    if (BOSS_SET.has(b.id)) out.push({ id: b.id as BossId, x: b.x, z: b.z });
  }
  return out;
}

/** Nearest-cell biome index at a world position (drives terrain colour + scatter hints). */
export function biomeIndexAt(map: OathboundMap, x: number, z: number): number {
  const half = map.size / 2;
  const cell = map.size / (map.res - 1);
  const xi = clamp(Math.round((x + half) / cell), 0, map.res - 1);
  const zi = clamp(Math.round((z + half) / cell), 0, map.res - 1);
  return map.biomes[zi * map.res + xi] ?? 0;
}

/**
 * A minimal Scenery for the minimap relief/overlay: the map's rivers + roads (MapPath is
 * structurally a SceneryPath). The prop layers are empty — the minimap only strokes
 * roads/rivers from this.
 */
export function customSceneryForMinimap(map: OathboundMap): Scenery {
  return {
    trees: [], boulders: [], pebbles: [], bushes: [], grass: [], flowers: [],
    ferns: [], mushrooms: [], logs: [], lilies: [],
    rivers: map.rivers.map((p) => ({ points: p.points, width: p.width })),
    roads: map.roads.map((p) => ({ points: p.points, width: p.width })),
  };
}
