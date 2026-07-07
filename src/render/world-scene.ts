// The visual world: everything non-entity that makes the game look like the game — the "Cube
// World" voxel terrain that follows the player, decorative scenery (trees/rocks/rivers/roads),
// the village/buildings, map NPCs + critters, ambient life, and the sky. Built from the same
// pure map/heightfield data the server uses, so it needs no networking. Extracted so the online
// client renders an identical world to the (legacy) offline bootstrap. Reads data only.

import * as THREE from 'three';
import type { Heightfield } from '../world/heightfield';
import type { OathboundMap } from '../world/map-format';
import { biomeIndexAt } from '../world/custom-map';
import { dominantBiome } from '../world/biomes';
import { generateScenery, type Scenery } from '../world/scenery';
import { VoxelTerrain } from './voxel-terrain';
import { buildProps, terrainColorRGB, VOXEL_CUBE, VOXEL_STEP, VOXEL_VIEW } from './terrain-mesh';
import { buildScenery } from './scenery-view';
import { buildCustomScenery, colorForBiome } from './custom-map-view';
import { VillageView } from './village-view';
import { CustomNpcs } from './custom-npcs';
import { CustomCritters } from './custom-critters';
import { AmbientLife } from './ambient-life';
import { Sky } from './sky';

export interface WorldScene {
  voxelTerrain: VoxelTerrain;
  village: VillageView | null;
  npcs: CustomNpcs | null;
  critters: CustomCritters | null;
  /** Per-frame: roam the voxel bubble, animate village/npcs/critters/ambient life + sky. */
  update(dt: number, camera: THREE.Camera, x: number, z: number, field: Heightfield): void;
}

/**
 * Build the full visual world into `scene`. `map` is the active custom map (Talar) or null for the
 * procedural world. `renderer` sets the fog to hide the voxel-bubble edge. `spawn` seeds the first
 * terrain build so there's ground under the player on frame one.
 */
export function buildWorldScene(
  scene: THREE.Scene,
  field: Heightfield,
  map: OathboundMap | null,
  setFogRange: (near: number, far: number) => void,
  spawn: { x: number; z: number },
): WorldScene {
  let village: VillageView | null = null;

  if (map) {
    const customSceneryGroup = buildCustomScenery(map, field);
    scene.add(customSceneryGroup);
    // The voxel bubble draws its own per-cube paved tops → hide the smooth authoring-res paving.
    const smoothPaving = customSceneryGroup.getObjectByName('paving');
    if (smoothPaving) smoothPaving.visible = false;
    if (map.village != null) village = new VillageView(scene, field);
  } else {
    const scenery: Scenery = generateScenery(field.size, { seed: 7777 });
    scene.add(buildScenery(scenery, field));
    // Decorative (non-collidable) boulders/rocks so the procedural world isn't bare.
    scene.add(buildProps([], field));
    village = new VillageView(scene, field);
  }

  // Cube-World terrain: a bubble of fine cubes that follows the player (the map is too big to
  // voxelize whole; fog hides the edge). Render + collision share field.voxelHeightAt.
  field.voxelCube = VOXEL_CUBE;
  field.voxelStep = VOXEL_STEP;
  setFogRange(60, VOXEL_VIEW);

  const tmp = new THREE.Color();
  const colorAt: (x: number, z: number, h: number, out: [number, number, number]) => void = map
    ? (x, z, h, out) => {
        colorForBiome(biomeIndexAt(map, x, z), h, x, z, tmp);
        out[0] = tmp.r;
        out[1] = tmp.g;
        out[2] = tmp.b;
      }
    : terrainColorRGB;
  const groundAt: (x: number, z: number) => number = map
    ? (x, z) => biomeIndexAt(map, x, z)
    : (x, z) => {
        const b = dominantBiome(x, z);
        return b === 'ember' || b === 'riven' || b === 'gravereach' ? 20 : 0;
      };
  const voxelTerrain = new VoxelTerrain(field, colorAt, VOXEL_CUBE, VOXEL_VIEW, groundAt);
  voxelTerrain.rebuildAt(spawn.x, spawn.z);
  scene.add(voxelTerrain.group);

  const npcs = map ? new CustomNpcs(scene, field, map.npcs) : null;
  const critters = map ? new CustomCritters(scene, field, map.critters) : null;
  const ambientLife = new AmbientLife(scene);
  const sky = new Sky(scene);

  return {
    voxelTerrain,
    village,
    npcs,
    critters,
    update(dt, camera, x, z, fld): void {
      voxelTerrain.update(x, z);
      village?.update(dt);
      npcs?.update(dt);
      critters?.update(dt);
      ambientLife.update(dt, x, z, fld);
      sky.update(camera, dt);
    },
  };
}
