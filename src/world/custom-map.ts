// Builds the *pure* world data (no three.js) for a custom map authored in the Admin
// Tools Map Builder: the heightfield, physical colliders, biome sampler, enemy/boss
// placements, and a minimal Scenery for the minimap. The renderer turns the same map into
// meshes (src/render/custom-map-view.ts). Loaded only when a map is requested; with none,
// the procedural world (heightfield.ts / scenery.ts) is unchanged.

import { Heightfield, type CylinderCollider } from './heightfield';
import { clamp } from '../core/math';
import { unpackHeights, ENEMY_IDS, BOSS_IDS, type OathboundMap } from './map-format';
import type { Scenery } from './scenery';
import type { Spawn } from '../sim/content/spawns';
import type { EnemyTemplateId, Tier } from '../sim/content/enemies';
import type { BossId } from '../sim/content/bosses';

/** Collider radius (m, at scale 1) for a built-in boulder — mirrors the builder catalog. */
const BOULDER_COLLIDER = 0.95;

/** Construct the gameplay heightfield from the map's stored grid. */
export function buildCustomHeightfield(map: OathboundMap): Heightfield {
  return new Heightfield(map.size, map.res, unpackHeights(map));
}

/**
 * Physical colliders for a custom map: built-in boulders + any custom asset that declares
 * a collider radius, each scaled by its placement scale. All other props are visual-only
 * (matching the game's "scenery adds no colliders" rule).
 */
export function customColliders(map: OathboundMap): CylinderCollider[] {
  const out: CylinderCollider[] = [];
  const customRadius = new Map<string, number | null>();
  for (const d of map.customAssets) customRadius.set(d.id, d.collider);
  for (const a of map.assets) {
    if (a.asset.startsWith('boulder:')) {
      out.push({ x: a.x, z: a.z, radius: BOULDER_COLLIDER * a.scale });
    } else if (a.asset.startsWith('custom:')) {
      const r = customRadius.get(a.asset.slice('custom:'.length));
      if (r && r > 0) out.push({ x: a.x, z: a.z, radius: r * a.scale });
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
