// Renders a custom map: a biome-tinted terrain mesh (coloured from the painted biome grid)
// plus all placed props (instanced), lakes, rivers and roads. Mirrors the look of the
// procedural terrain-mesh.ts / scenery-view.ts so authored maps read the same in-engine.

import * as THREE from 'three';
import type { Heightfield } from '../world/heightfield';
import { TERRAIN_RENDER_RES } from '../world/layout';
import { biomeIndexAt } from '../world/custom-map';
import { unpackHeights, unpackWater, waterSurfaceGeometry, pavedSurfaceGeometry, type OathboundMap, type PlacedAsset } from '../world/map-format';
import { placedAssetGeometry, assetYLift, isSmoothAsset } from './asset-geometry';
import { makePavingTexture } from './paving';

let _pavingMat: THREE.Material | null = null;
function pavingMaterial(): THREE.Material {
  if (!_pavingMat) {
    _pavingMat = new THREE.MeshLambertMaterial({
      map: makePavingTexture(), vertexColors: true,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
  }
  return _pavingMat;
}

// Per-ground palette — an identical copy of the Map Builder's src/oathbound/palette.ts so a
// custom map's painted ground reads the same in-engine. 0–6 are gameplay biomes; 7+ are
// cosmetic ground surfaces (city, desert, mesa, …). Keep the two copies in sync.
const PALETTE = {
  greenLow: new THREE.Color(0x375a32),
  greenHigh: new THREE.Color(0x7d8a55),
  thorn: new THREE.Color(0x274a2a),
  fen: new THREE.Color(0x3b4a39),
  ember: new THREE.Color(0x5a2f24),
  emberHot: new THREE.Color(0x713326),
  rivenRock: new THREE.Color(0x8990a0),
  snow: new THREE.Color(0xe8eef6),
  grave: new THREE.Color(0x49455a),
  hub: new THREE.Color(0x6e7a4e),
  city: new THREE.Color(0x70737a),
  desert: new THREE.Color(0xcbb074),
  mesaLow: new THREE.Color(0x8a4326),
  mesaHigh: new THREE.Color(0xbc7d4c),
  savanna: new THREE.Color(0x9d9a54),
  tundra: new THREE.Color(0xc6d1d7),
  dirt: new THREE.Color(0x6b4f33),
  sand: new THREE.Color(0xe2d29a),
  mud: new THREE.Color(0x463726),
  cobble: new THREE.Color(0x8a8278),
  ash: new THREE.Color(0x47443f),
  jungleLow: new THREE.Color(0x1d3a1b),
  jungleHigh: new THREE.Color(0x386030),
  ice: new THREE.Color(0xb9d4e6),
  basalt: new THREE.Color(0x2c2c31),
  mountainLow: new THREE.Color(0x5b554e),
  mountainHigh: new THREE.Color(0x877f73),
};

function rockNoise(wx: number, wz: number): number {
  const qx = Math.floor(wx / 1.5);
  const qz = Math.floor(wz / 1.5);
  let h = (qx * 374761393 + qz * 668265263) | 0;
  h = ((h ^ (h >>> 13)) * 1274126177) | 0;
  return ((h >>> 0) % 1000) / 1000;
}

export function colorForBiome(biome: number, h: number, wx: number, wz: number, out: THREE.Color): THREE.Color {
  const t = THREE.MathUtils.clamp((h + 2) / 5, 0, 1);
  switch (biome) {
    case 1: return out.copy(PALETTE.thorn).lerp(PALETTE.greenHigh, t * 0.25);
    case 2: return out.copy(PALETTE.fen);
    case 3: return out.copy(PALETTE.ember).lerp(PALETTE.emberHot, t);
    case 4: { const sn = THREE.MathUtils.clamp((h - 24) / 22, 0, 1); return out.copy(PALETTE.rivenRock).lerp(PALETTE.snow, sn); }
    case 5: return out.copy(PALETTE.grave);
    case 6: return out.copy(PALETTE.hub);
    case 7: return out.copy(PALETTE.city);   // City — paved stone (fine paving is a texture overlay)
    case 8: return out.copy(PALETTE.desert);                                       // Desert sand
    case 9: { const band = Math.sin(h * 0.8) * 0.5 + 0.5; return out.copy(PALETTE.mesaLow).lerp(PALETTE.mesaHigh, band); } // Mesa
    case 10: return out.copy(PALETTE.savanna);                                     // Savanna
    case 11: { const sn = THREE.MathUtils.clamp((h - 6) / 20, 0, 1); return out.copy(PALETTE.tundra).lerp(PALETTE.snow, sn); } // Tundra
    case 12: return out.copy(PALETTE.dirt);                                        // Dirt
    case 13: return out.copy(PALETTE.sand);                                        // Beach sand
    case 14: return out.copy(PALETTE.mud);                                         // Mud
    case 15: return out.copy(PALETTE.cobble);                                      // Cobblestone (paving overlay on top)
    case 16: return out.copy(PALETTE.ash);                                         // Ash / wasteland
    case 17: return out.copy(PALETTE.jungleLow).lerp(PALETTE.jungleHigh, t * 0.5); // Jungle
    case 18: return out.copy(PALETTE.ice);                                         // Ice
    case 19: return out.copy(PALETTE.basalt);                                      // Basalt
    case 20: { // Mountains — craggy grey-brown rock with a snow cap on the peaks
      const sn = THREE.MathUtils.clamp((h - 26) / 20, 0, 1);
      const n = rockNoise(wx, wz) * 0.14 - 0.07;
      return out.copy(PALETTE.mountainLow).lerp(PALETTE.mountainHigh, THREE.MathUtils.clamp(h / 40, 0, 1)).addScalar(n).lerp(PALETTE.snow, sn);
    }
    default: return out.copy(PALETTE.greenLow).lerp(PALETTE.greenHigh, t);         // 0 — grass
  }
}

/** Terrain mesh for a custom map, coloured per painted biome. Named 'terrain'. */
export function buildCustomTerrainMesh(field: Heightfield, map: OathboundMap): THREE.Mesh {
  const seg = Math.min(field.res - 1, TERRAIN_RENDER_RES - 1);
  const geo = new THREE.PlaneGeometry(field.size, field.size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = field.sample(x, z);
    pos.setY(i, h);
    colorForBiome(biomeIndexAt(map, x, z), h, x, z, c);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  pos.needsUpdate = true;
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.name = 'terrain';
  return mesh;
}

const smoothMat = new THREE.MeshLambertMaterial({ vertexColors: true });
const flatMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
const _obj = new THREE.Object3D();

function buildPlacedAssets(group: THREE.Group, map: OathboundMap, field: Heightfield): void {
  const byId = new Map<string, PlacedAsset[]>();
  for (const a of map.assets) {
    const arr = byId.get(a.asset);
    if (arr) arr.push(a);
    else byId.set(a.asset, [a]);
  }
  for (const [assetId, items] of byId) {
    const geo = placedAssetGeometry(assetId, map.customAssets);
    if (!geo) continue;
    const mesh = new THREE.InstancedMesh(geo, isSmoothAsset(assetId) ? smoothMat : flatMat, items.length);
    mesh.frustumCulled = false;
    mesh.name = `asset:${assetId}`;
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      _obj.position.set(p.x, field.sample(p.x, p.z) + assetYLift(assetId, p.scale) + (p.y ?? 0), p.z);
      _obj.rotation.set(0, p.rot, 0);
      _obj.scale.setScalar(p.scale);
      _obj.updateMatrix();
      mesh.setMatrixAt(i, _obj.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
  }
}

function resamplePath(pts: { x: number; z: number }[], spacing: number): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [pts[0]];
  let prev = pts[0];
  for (let i = 1; i < pts.length; i++) {
    const cur = pts[i];
    const seg = Math.hypot(cur.x - prev.x, cur.z - prev.z);
    const n = Math.max(1, Math.round(seg / spacing));
    for (let k = 1; k <= n; k++) out.push({ x: prev.x + ((cur.x - prev.x) * k) / n, z: prev.z + ((cur.z - prev.z) * k) / n });
    prev = cur;
  }
  return out;
}

function buildRibbon(path: { points: { x: number; z: number }[]; width: number }, field: Heightfield, yOffset: number, mat: THREE.Material, name: string): THREE.Mesh | null {
  if (path.points.length < 2) return null;
  const pts = resamplePath(path.points, 2.5);
  const hw = path.width / 2;
  const left: number[] = [];
  const right: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    let tx = next.x - prev.x;
    let tz = next.z - prev.z;
    const len = Math.hypot(tx, tz) || 1;
    tx /= len;
    tz /= len;
    const lx = pts[i].x + -tz * hw;
    const lz = pts[i].z + tx * hw;
    const rx = pts[i].x - -tz * hw;
    const rz = pts[i].z - tx * hw;
    left.push(lx, field.sample(lx, lz) + yOffset, lz);
    right.push(rx, field.sample(rx, rz) + yOffset, rz);
  }
  const positions: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = i * 3;
    const b = (i + 1) * 3;
    positions.push(left[a], left[a + 1], left[a + 2], right[b], right[b + 1], right[b + 2], right[a], right[a + 1], right[a + 2]);
    positions.push(left[a], left[a + 1], left[a + 2], left[b], left[b + 1], left[b + 2], right[b], right[b + 1], right[b + 2]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = name;
  mesh.frustumCulled = false;
  return mesh;
}

/** Build the full decorative + water/road group for a custom map. */
export function buildCustomScenery(map: OathboundMap, field: Heightfield): THREE.Group {
  const group = new THREE.Group();
  group.name = 'scenery';
  buildPlacedAssets(group, map, field);

  // Paved-ground (City / Cobblestone) texture overlay — fine stones at any terrain resolution.
  {
    const { positions, uvs, colors, indices } = pavedSurfaceGeometry(map.biomes, unpackHeights(map), map.res, map.size);
    if (positions.length) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, pavingMaterial());
      mesh.name = 'paving';
      mesh.frustumCulled = false;
      group.add(mesh);
    }
  }

  const lakeMat = new THREE.MeshStandardMaterial({ color: 0x356f96, transparent: true, opacity: 0.84, roughness: 0.18, metalness: 0.2, side: THREE.DoubleSide });

  // Painted water (the Water tool): a surface mesh filling the ground up to each cell's level.
  const water = unpackWater(map);
  if (water) {
    const { positions, indices } = waterSurfaceGeometry(water, unpackHeights(map), map.res, map.size);
    if (positions.length) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, lakeMat);
      mesh.name = 'painted-water';
      mesh.frustumCulled = false;
      group.add(mesh);
    }
  }

  for (let i = 0; i < map.lakes.length; i++) {
    const lk = map.lakes[i];
    const disc = new THREE.Mesh(new THREE.CircleGeometry(Math.max(0.5, lk.r * 0.82), 40), lakeMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(lk.x, lk.y ?? field.sample(lk.x, lk.z) + 0.15, lk.z);
    disc.name = `lake-${i}`;
    disc.frustumCulled = false;
    group.add(disc);
  }

  const riverMat = new THREE.MeshStandardMaterial({ color: 0x3a7fa6, transparent: true, opacity: 0.82, roughness: 0.25, metalness: 0.15, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  for (let i = 0; i < map.rivers.length; i++) {
    const m = buildRibbon(map.rivers[i], field, 0.18, riverMat, `river-${i}`);
    if (m) group.add(m);
  }
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x9c8a5e, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  for (let i = 0; i < map.roads.length; i++) {
    const m = buildRibbon(map.roads[i], field, 0.25, roadMat, `road-${i}`);
    if (m) group.add(m);
  }
  return group;
}
