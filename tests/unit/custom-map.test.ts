import { describe, it, expect } from 'vitest';
import {
  blankMap,
  normalizeMap,
  packHeights,
  unpackHeightsPacked,
  serializeMap,
  MAP_FORMAT_VERSION,
  type OathboundMap,
} from '../../src/world/map-format';
import {
  buildCustomHeightfield,
  customColliders,
  customSpawns,
  customBosses,
  biomeIndexAt,
  customSceneryForMinimap,
} from '../../src/world/custom-map';

function sampleMap(): OathboundMap {
  const m = blankMap('Test', 100, 5); // cell = 25; centre node (x=0,z=0) is index 12
  m.heights![12] = 7.5;
  m.heights![0] = 12.34;
  m.biomes[12] = 4; // riven
  m.assets = [
    { asset: 'boulder:0', x: 10, z: 10, scale: 2, rot: 0 },
    { asset: 'tree:0', x: 5, z: 5, scale: 1, rot: 0 },
    { asset: 'custom:rock', x: -5, z: -5, scale: 3, rot: 0 },
    { asset: 'custom:bush', x: -8, z: -8, scale: 1, rot: 0 },
  ];
  m.customAssets = [
    { id: 'rock', name: 'Rock', category: 'rock', parts: [], collider: 1.5 },
    { id: 'bush', name: 'Bush', category: 'plant', parts: [], collider: null },
  ];
  m.spawns = [
    { id: 'bloomhusk', x: 1, z: 1, level: 3 },
    { id: 'notreal' as never, x: 2, z: 2, level: 5 },
  ];
  m.bosses = [
    { id: 'emberhorn', x: 0, z: 0 },
    { id: 'nope' as never, x: 1, z: 1 },
  ];
  return m;
}

describe('map-format height packing', () => {
  it('round-trips heights to centimetre precision', () => {
    const heights = new Float32Array([0, 12.34, -5.67, 320, -50.01]);
    const back = unpackHeightsPacked(packHeights(heights));
    expect(back.length).toBe(heights.length);
    for (let i = 0; i < heights.length; i++) {
      expect(back[i]).toBeCloseTo(heights[i], 2);
    }
  });

  it('serializeMap packs heights and normalizeMap reloads them', () => {
    const m = sampleMap();
    const json = serializeMap(m, m.heights!);
    const reloaded = normalizeMap(JSON.parse(json));
    expect(reloaded.version).toBe(MAP_FORMAT_VERSION);
    expect(reloaded.heightsPacked).toBeTruthy();
    const field = buildCustomHeightfield(reloaded);
    expect(field.sample(0, 0)).toBeCloseTo(7.5, 2);
  });

  it('normalizeMap fills defaults for a partial object', () => {
    const m = normalizeMap({ name: 'Partial', size: 200, res: 4 });
    expect(m.biomes.length).toBe(16);
    expect(m.assets).toEqual([]);
    expect(m.playerSpawn).toEqual({ x: 0, z: 0 });
    expect(m.village).toBeNull();
  });
});

describe('custom-map builders', () => {
  it('builds a heightfield that samples the authored grid', () => {
    const field = buildCustomHeightfield(sampleMap());
    expect(field.size).toBe(100);
    expect(field.res).toBe(5);
    expect(field.sample(0, 0)).toBeCloseTo(7.5, 2);
  });

  it('derives colliders from boulders and custom assets with a collider only', () => {
    const cols = customColliders(sampleMap());
    expect(cols.length).toBe(2); // boulder + custom:rock; tree + custom:bush excluded
    const boulder = cols.find((c) => Math.abs(c.x - 10) < 0.01)!;
    expect(boulder.radius).toBeCloseTo(0.95 * 2, 3);
    const rock = cols.find((c) => Math.abs(c.x + 5) < 0.01)!;
    expect(rock.radius).toBeCloseTo(1.5 * 3, 3);
  });

  it('drops spawns/bosses with unknown ids', () => {
    const spawns = customSpawns(sampleMap());
    expect(spawns.length).toBe(1);
    expect(spawns[0].id).toBe('bloomhusk');
    expect(spawns[0].level).toBe(3);
    const bosses = customBosses(sampleMap());
    expect(bosses.length).toBe(1);
    expect(bosses[0].id).toBe('emberhorn');
  });

  it('reads the painted biome at a position', () => {
    expect(biomeIndexAt(sampleMap(), 0, 0)).toBe(4);
  });

  it('exposes rivers/roads to the minimap scenery', () => {
    const m = sampleMap();
    m.roads = [{ points: [{ x: 0, z: 0 }, { x: 10, z: 10 }], width: 4 }];
    m.rivers = [{ points: [{ x: 0, z: 0 }, { x: -10, z: 5 }], width: 6 }];
    const scenery = customSceneryForMinimap(m);
    expect(scenery.roads.length).toBe(1);
    expect(scenery.rivers.length).toBe(1);
    expect(scenery.trees).toEqual([]);
  });
});
