// Builds Three.js meshes for the world's decorative scenery from the pure data in
// src/world/scenery.ts. Everything is instanced (one draw call per prop type/variant) or
// a single draped ribbon (rivers/roads) / disc (lakes). Reads world data only.
//
// Scenery is purely visual — it is NOT added to the camera's occlusion obstacles, so the
// chase camera doesn't spring on every tree, and it adds no colliders to the simulation.

import * as THREE from 'three';
import type { Heightfield } from '../world/heightfield';
import type { Scenery, SceneryInstance, SceneryPath } from '../world/scenery';
import { WORLD_LAKES, lakeWaterY, waterLevel } from '../world/lakes';
import { roadMaterial } from './paving';

const up = new THREE.Object3D();

/** Concatenate non-indexed parts into one geometry with a baked per-part vertex colour. */
function mergeParts(parts: { geo: THREE.BufferGeometry; color: number }[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const c = new THREE.Color();
  for (const part of parts) {
    const g = part.geo.index ? part.geo.toNonIndexed() : part.geo;
    const p = g.attributes.position as THREE.BufferAttribute;
    const n = g.attributes.normal as THREE.BufferAttribute;
    c.set(part.color);
    for (let i = 0; i < p.count; i++) {
      positions.push(p.getX(i), p.getY(i), p.getZ(i));
      normals.push(n.getX(i), n.getY(i), n.getZ(i));
      colors.push(c.r, c.g, c.b);
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return out;
}

function blob(r: number, x: number, y: number, z: number, detail = 0): THREE.BufferGeometry {
  return new THREE.IcosahedronGeometry(r, detail).translate(x, y, z);
}

/** A whole tree (trunk + canopy) merged into one geometry, base at y=0. 6 variants. */
function treeGeometry(variant: number): THREE.BufferGeometry {
  switch (variant) {
    case 1: {
      // Pine: slim trunk + two stacked needle tiers.
      const trunk = new THREE.CylinderGeometry(0.08, 0.14, 1.4, 6).translate(0, 0.7, 0);
      return mergeParts([
        { geo: trunk, color: 0x5a4632 },
        { geo: new THREE.ConeGeometry(0.85, 1.6, 7).translate(0, 1.55, 0), color: 0x2f5640 },
        { geo: new THREE.ConeGeometry(0.58, 1.4, 7).translate(0, 2.5, 0), color: 0x386450 },
      ]);
    }
    case 2: {
      // Dead/charred snag: bare forked trunk, no canopy.
      const trunk = new THREE.CylinderGeometry(0.09, 0.16, 1.7, 6).translate(0, 0.85, 0);
      const b1 = new THREE.CylinderGeometry(0.05, 0.08, 0.9, 5).rotateZ(0.7).translate(0.28, 1.5, 0);
      const b2 = new THREE.CylinderGeometry(0.04, 0.07, 0.7, 5).rotateZ(-0.6).translate(-0.24, 1.6, 0.1);
      return mergeParts([
        { geo: trunk, color: 0x3b3530 },
        { geo: b1, color: 0x352f2b },
        { geo: b2, color: 0x352f2b },
      ]);
    }
    case 3: {
      // Birch: tall slim pale trunk + a light, airy canopy.
      const trunk = new THREE.CylinderGeometry(0.09, 0.13, 2.3, 6).translate(0, 1.15, 0);
      return mergeParts([
        { geo: trunk, color: 0xd8d8cf },
        { geo: blob(0.72, 0, 2.7, 0), color: 0x84b056 },
        { geo: blob(0.5, 0.28, 3.0, 0.12), color: 0x8fbb60 },
      ]);
    }
    case 4: {
      // Great oak: thick trunk + a big broad multi-lobed canopy.
      const trunk = new THREE.CylinderGeometry(0.24, 0.36, 1.8, 7).translate(0, 0.9, 0);
      return mergeParts([
        { geo: trunk, color: 0x4f3a23 },
        { geo: blob(1.5, 0, 2.7, 0), color: 0x355c2b },
        { geo: blob(1.05, 0.95, 2.9, 0.3), color: 0x3a6330 },
        { geo: blob(1.0, -0.85, 2.7, -0.4), color: 0x335829 },
      ]);
    }
    case 5: {
      // Willow: short trunk + a wide weeping canopy with drooping fronds.
      const trunk = new THREE.CylinderGeometry(0.16, 0.24, 1.5, 6).translate(0, 0.75, 0);
      const parts = [
        { geo: trunk, color: 0x5a4a30 },
        { geo: blob(1.2, 0, 2.1, 0).scale(1, 0.7, 1), color: 0x728f3e },
      ];
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const frond = new THREE.ConeGeometry(0.15, 1.3, 5)
          .rotateX(Math.PI)
          .translate(Math.cos(a) * 0.95, 1.55, Math.sin(a) * 0.95);
        parts.push({ geo: frond, color: 0x6e8a3c });
      }
      return mergeParts(parts);
    }
    default: {
      // Broadleaf: trunk + a fuller low-poly canopy (a few overlapping blobs).
      const trunk = new THREE.CylinderGeometry(0.12, 0.2, 1.5, 6).translate(0, 0.75, 0);
      return mergeParts([
        { geo: trunk, color: 0x5b4329 },
        { geo: blob(1.02, 0, 2.1, 0), color: 0x3f6b34 },
        { geo: blob(0.66, 0.5, 2.4, 0.2), color: 0x457439 },
        { geo: blob(0.62, -0.42, 2.3, -0.3), color: 0x3a6330 },
      ]);
    }
  }
}

/** A leafy shrub cluster (tinted per-instance), base at y=0. */
function bushGeometry(): THREE.BufferGeometry {
  return mergeParts([
    { geo: blob(0.55, 0, 0.42, 0), color: 0xffffff },
    { geo: blob(0.45, 0.42, 0.36, 0.12), color: 0xffffff },
    { geo: blob(0.4, -0.36, 0.4, -0.12), color: 0xffffff },
  ]);
}

/** A flowering shrub: a green cluster dotted with little blossoms. */
function floweringBushGeometry(): THREE.BufferGeometry {
  const parts = [
    { geo: blob(0.55, 0, 0.42, 0), color: 0x3c6b34 },
    { geo: blob(0.45, 0.42, 0.36, 0.12), color: 0x42703a },
    { geo: blob(0.4, -0.36, 0.4, -0.12), color: 0x386630 },
  ];
  const petals = [0xf3d6e2, 0xf6e7a0, 0xe7b6d0];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const r = 0.5;
    parts.push({
      geo: blob(0.1, Math.cos(a) * r, 0.55 + (i % 2) * 0.12, Math.sin(a) * r),
      color: petals[i % petals.length],
    });
  }
  return mergeParts(parts);
}

/** A single wildflower: a green stem topped with a coloured bloom. 4 colour variants. */
function flowerGeometry(variant: number): THREE.BufferGeometry {
  const bloomCol = [0xe0556a, 0xf2c84a, 0x9a6fd0, 0xf2eef0][variant] ?? 0xe0556a;
  const stem = new THREE.CylinderGeometry(0.02, 0.03, 0.46, 4).translate(0, 0.23, 0);
  const parts = [
    { geo: stem, color: 0x4a7a3a },
    { geo: blob(0.12, 0, 0.5, 0), color: bloomCol },
  ];
  // A few petals around the centre for a flower-ish silhouette.
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    parts.push({ geo: blob(0.07, Math.cos(a) * 0.12, 0.5, Math.sin(a) * 0.12), color: bloomCol });
  }
  return mergeParts(parts);
}

/** A fern: a low rosette of fanned fronds. */
function fernGeometry(): THREE.BufferGeometry {
  const parts: { geo: THREE.BufferGeometry; color: number }[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const frond = new THREE.ConeGeometry(0.08, 0.82, 4)
      .rotateZ(0.5)
      .rotateY(a)
      .translate(0, 0.32, 0);
    parts.push({ geo: frond, color: i % 2 ? 0x3e6b34 : 0x47743b });
  }
  return mergeParts(parts);
}

/** A mushroom: pale stem + coloured cap. 3 variants. */
function mushroomGeometry(variant: number): THREE.BufferGeometry {
  const capCol = [0xc23b34, 0x8a6a3a, 0xbfe6d8][variant] ?? 0xc23b34;
  const stem = new THREE.CylinderGeometry(0.06, 0.09, 0.32, 6).translate(0, 0.16, 0);
  const cap = blob(0.22, 0, 0.34, 0, 0).scale(1, 0.62, 1);
  return mergeParts([
    { geo: stem, color: 0xeee8d8 },
    { geo: cap, color: capCol },
  ]);
}

/** A fallen mossy log lying along +x, base at y≈0. */
function logGeometry(): THREE.BufferGeometry {
  const log = new THREE.CylinderGeometry(0.3, 0.34, 2.3, 8).rotateZ(Math.PI / 2).translate(0, 0.3, 0);
  const moss = new THREE.BoxGeometry(1.6, 0.08, 0.5).translate(0, 0.56, 0);
  return mergeParts([
    { geo: log, color: 0x5a4327 },
    { geo: moss, color: 0x4d6b34 },
  ]);
}

/** A flat lily pad (sits on the water surface). */
function lilyGeometry(): THREE.BufferGeometry {
  const pad = new THREE.CircleGeometry(0.5, 10).rotateX(-Math.PI / 2);
  return mergeParts([{ geo: pad, color: 0x3f7a44 }]);
}

function placeInstanced(
  mesh: THREE.InstancedMesh,
  items: SceneryInstance[],
  field: Heightfield,
  yLift: (inst: SceneryInstance) => number,
  uniformScale: number,
  colorFor?: (variant: number, i: number) => THREE.Color,
  absoluteY?: (inst: SceneryInstance) => number | null,
): void {
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const y = absoluteY?.(it) ?? field.sample(it.x, it.z) + yLift(it);
    up.position.set(it.x, y, it.z);
    up.rotation.set(0, it.rot, 0);
    up.scale.setScalar(it.scale * uniformScale);
    up.updateMatrix();
    mesh.setMatrixAt(i, up.matrix);
    if (colorFor) mesh.setColorAt(i, colorFor(it.variant, i));
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

function instancedFromGeo(
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  count: number,
  name: string,
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.name = name;
  mesh.frustumCulled = false; // instances span the whole world
  return mesh;
}

/** Group instances by variant and build one instanced mesh per present variant. */
function buildVariantLayer(
  group: THREE.Group,
  field: Heightfield,
  items: SceneryInstance[],
  geoFor: (variant: number) => THREE.BufferGeometry,
  mat: THREE.Material,
  name: string,
  yLift: (inst: SceneryInstance) => number,
  jitter = false,
): void {
  const byVariant = new Map<number, SceneryInstance[]>();
  for (const it of items) {
    const arr = byVariant.get(it.variant);
    if (arr) arr.push(it);
    else byVariant.set(it.variant, [it]);
  }
  for (const [variant, list] of byVariant) {
    const mesh = instancedFromGeo(geoFor(variant), mat, list.length, `${name}-${variant}`);
    placeInstanced(mesh, list, field, yLift, 1, jitter ? brightnessJitter : undefined);
    group.add(mesh);
  }
}

const _jit = new THREE.Color();
/** Subtle per-instance brightness so a field of identical props doesn't look stamped. */
function brightnessJitter(_variant: number, i: number): THREE.Color {
  const h = ((i * 2654435761) >>> 0) / 4294967296; // deterministic [0,1)
  const b = 0.82 + h * 0.32;
  return _jit.setRGB(b, b, b);
}

/** Resample a polyline to roughly even `spacing` so the ribbon hugs the terrain. */
function resamplePath(pts: { x: number; z: number }[], spacing: number): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [pts[0]];
  let prev = pts[0];
  for (let i = 1; i < pts.length; i++) {
    const cur = pts[i];
    const dx = cur.x - prev.x;
    const dz = cur.z - prev.z;
    const seg = Math.hypot(dx, dz);
    const n = Math.max(1, Math.round(seg / spacing));
    for (let k = 1; k <= n; k++) out.push({ x: prev.x + (dx * k) / n, z: prev.z + (dz * k) / n });
    prev = cur;
  }
  return out;
}

/** Build a flat ribbon (water/road) draped over the terrain along a path. */
function buildRibbon(
  path: SceneryPath,
  field: Heightfield,
  yOffset: number,
  mat: THREE.Material,
  name: string,
): THREE.Mesh | null {
  if (path.points.length < 2) return null;
  const pts = resamplePath(path.points, 2.5); // dense so the strip follows the ground
  const hw = path.width / 2;
  const TILE = 4; // texture repeat in metres, so road stones/grain keep a constant world size
  const left: number[] = [];
  const right: number[] = [];
  const vRun: number[] = []; // texture V per point (metres along the path / TILE)
  let run = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i > 0) run += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
    vRun.push(run / TILE);
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    let tx = next.x - prev.x;
    let tz = next.z - prev.z;
    const len = Math.hypot(tx, tz) || 1;
    tx /= len;
    tz /= len;
    const px = -tz; // perpendicular
    const pz = tx;
    const lx = pts[i].x + px * hw;
    const lz = pts[i].z + pz * hw;
    const rx = pts[i].x - px * hw;
    const rz = pts[i].z - pz * hw;
    left.push(lx, field.sample(lx, lz) + yOffset, lz);
    right.push(rx, field.sample(rx, rz) + yOffset, rz);
  }
  const uR = path.width / TILE; // U spans the road width → constant world-scale texel density
  const positions: number[] = [];
  const uvs: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = i * 3;
    const b = (i + 1) * 3;
    const va = vRun[i];
    const vb = vRun[i + 1];
    positions.push(left[a], left[a + 1], left[a + 2]);
    positions.push(right[b], right[b + 1], right[b + 2]);
    positions.push(right[a], right[a + 1], right[a + 2]);
    positions.push(left[a], left[a + 1], left[a + 2]);
    positions.push(left[b], left[b + 1], left[b + 2]);
    positions.push(right[b], right[b + 1], right[b + 2]);
    uvs.push(0, va, uR, vb, uR, va, 0, va, 0, vb, uR, vb);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = name;
  mesh.frustumCulled = false;
  return mesh;
}

/** Build all scenery as a single Group to add to the scene. */
export function buildScenery(scenery: Scenery, field: Heightfield): THREE.Group {
  const group = new THREE.Group();
  group.name = 'scenery';

  // ── Trees (per-variant geometry; subtle per-instance brightness jitter) ──────
  const foliageMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  buildVariantLayer(group, field, scenery.trees, treeGeometry, foliageMat, 'trees', () => 0, true);

  // ── Boulders (biome-tinted) ──────────────────────────────────────────────────
  if (scenery.boulders.length) {
    const tints = [
      new THREE.Color(0x80858f),
      new THREE.Color(0x7a4a3c),
      new THREE.Color(0xc9d2db),
      new THREE.Color(0x6c7560),
    ];
    const mesh = instancedFromGeo(
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshLambertMaterial({ flatShading: true }),
      scenery.boulders.length,
      'boulders',
    );
    placeInstanced(mesh, scenery.boulders, field, (it) => it.scale * 0.35, 1, (v) => tints[v] ?? tints[0]);
    group.add(mesh);
  }

  // ── Pebbles ──────────────────────────────────────────────────────────────────
  if (scenery.pebbles.length) {
    const mesh = instancedFromGeo(
      new THREE.IcosahedronGeometry(0.5, 0),
      new THREE.MeshLambertMaterial({ color: 0x8b8c8f, flatShading: true }),
      scenery.pebbles.length,
      'pebbles',
    );
    placeInstanced(mesh, scenery.pebbles, field, () => 0.05, 1);
    group.add(mesh);
  }

  // ── Bushes: plain (variants 0–2, instance-tinted) + flowering (variant 3) ─────
  const plainBushes = scenery.bushes.filter((b) => b.variant !== 3);
  const flowerBushes = scenery.bushes.filter((b) => b.variant === 3);
  if (plainBushes.length) {
    const tints = [new THREE.Color(0x3c6b34), new THREE.Color(0x6e5a36), new THREE.Color(0x6a5a72)];
    const mesh = instancedFromGeo(
      bushGeometry(),
      new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
      plainBushes.length,
      'bushes',
    );
    placeInstanced(mesh, plainBushes, field, (it) => it.scale * 0.1, 1, (v) => tints[v] ?? tints[0]);
    group.add(mesh);
  }
  if (flowerBushes.length) {
    const mesh = instancedFromGeo(
      floweringBushGeometry(),
      new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
      flowerBushes.length,
      'bushes-flowering',
    );
    placeInstanced(mesh, flowerBushes, field, (it) => it.scale * 0.1, 1);
    group.add(mesh);
  }

  // ── Grass tufts + reeds ──────────────────────────────────────────────────────
  if (scenery.grass.length) {
    const tints = [new THREE.Color(0x5f8c3f), new THREE.Color(0x6f7a3a)];
    const geo = new THREE.ConeGeometry(0.14, 0.7, 4).translate(0, 0.35, 0);
    const mesh = instancedFromGeo(geo, new THREE.MeshLambertMaterial(), scenery.grass.length, 'grass');
    placeInstanced(mesh, scenery.grass, field, (it) => (it.variant === 1 ? 0.2 : 0), 1, (v) => tints[v] ?? tints[0]);
    group.add(mesh);
  }

  // ── Wildflowers (per-colour geometry) ────────────────────────────────────────
  buildVariantLayer(
    group,
    field,
    scenery.flowers,
    flowerGeometry,
    new THREE.MeshLambertMaterial({ vertexColors: true }),
    'flowers',
    () => 0.1,
  );

  // ── Ferns ──────────────────────────────────────────────────────────────────--
  if (scenery.ferns.length) {
    const mesh = instancedFromGeo(
      fernGeometry(),
      new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
      scenery.ferns.length,
      'ferns',
    );
    placeInstanced(mesh, scenery.ferns, field, () => 0, 1, brightnessJitter);
    group.add(mesh);
  }

  // ── Mushrooms (per-variant geometry) ─────────────────────────────────────────
  buildVariantLayer(
    group,
    field,
    scenery.mushrooms,
    mushroomGeometry,
    new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
    'mushrooms',
    () => 0,
  );

  // ── Fallen logs ──────────────────────────────────────────────────────────────
  if (scenery.logs.length) {
    const mesh = instancedFromGeo(
      logGeometry(),
      new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
      scenery.logs.length,
      'logs',
    );
    placeInstanced(mesh, scenery.logs, field, () => 0, 1, brightnessJitter);
    group.add(mesh);
  }

  // ── Lily pads (float on each lake's water surface) ────────────────────────────
  if (scenery.lilies.length) {
    const mesh = instancedFromGeo(
      lilyGeometry(),
      new THREE.MeshLambertMaterial({ vertexColors: true }),
      scenery.lilies.length,
      'lilies',
    );
    placeInstanced(mesh, scenery.lilies, field, () => 0, 1, undefined, (it) => {
      const wy = lakeWaterY(it.x, it.z);
      return wy == null ? null : wy + 0.04;
    });
    group.add(mesh);
  }

  // ── Lakes (flat translucent water discs) ─────────────────────────────────────
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x356f96,
    transparent: true,
    opacity: 0.84,
    roughness: 0.18,
    metalness: 0.2,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < WORLD_LAKES.length; i++) {
    const lk = WORLD_LAKES[i];
    const disc = new THREE.Mesh(new THREE.CircleGeometry(lk.r * 0.82, 40), waterMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(lk.x, waterLevel(lk), lk.z);
    disc.name = `lake-${i}`;
    disc.frustumCulled = false;
    group.add(disc);
  }

  // ── Rivers (translucent water) ───────────────────────────────────────────────
  const riverMat = new THREE.MeshStandardMaterial({
    color: 0x3a7fa6,
    transparent: true,
    opacity: 0.82,
    roughness: 0.25,
    metalness: 0.15,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  for (let i = 0; i < scenery.rivers.length; i++) {
    const m = buildRibbon(scenery.rivers[i], field, 0.18, riverMat, `river-${i}`);
    if (m) group.add(m);
  }

  // ── Roads (dirt paths from the hub to the frontier — the grassland road texture) ─────────────
  const roadMat = roadMaterial('grass');
  for (let i = 0; i < scenery.roads.length; i++) {
    const m = buildRibbon(scenery.roads[i], field, 0.25, roadMat, `road-${i}`);
    if (m) group.add(m);
  }

  return group;
}
