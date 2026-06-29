// Builds Three.js meshes for the world's decorative scenery from the pure data in
// src/world/scenery.ts. Everything is instanced (one draw call per prop type) or a
// single draped ribbon (rivers/roads). Reads world data only; never touches the sim.
//
// Scenery is purely visual — it is NOT added to the camera's occlusion obstacles, so the
// chase camera doesn't spring on every tree, and it adds no colliders to the simulation.

import * as THREE from 'three';
import type { Heightfield } from '../world/heightfield';
import type { Scenery, SceneryInstance, SceneryPath } from '../world/scenery';

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

/** A whole tree (trunk + canopy) merged into one geometry, base at y=0. */
function treeGeometry(variant: number): THREE.BufferGeometry {
  if (variant === 1) {
    // Pine: slim trunk + two stacked needle cones.
    const trunk = new THREE.CylinderGeometry(0.08, 0.14, 1.4, 6).translate(0, 0.7, 0);
    const lower = new THREE.ConeGeometry(0.85, 1.5, 7).translate(0, 1.5, 0);
    const upper = new THREE.ConeGeometry(0.55, 1.2, 7).translate(0, 2.3, 0);
    return mergeParts([
      { geo: trunk, color: 0x5a4632 },
      { geo: lower, color: 0x2f5640 },
      { geo: upper, color: 0x356048 },
    ]);
  }
  if (variant === 2) {
    // Dead/charred snag: bare forked trunk, no canopy.
    const trunk = new THREE.CylinderGeometry(0.09, 0.16, 1.7, 6).translate(0, 0.85, 0);
    const branch = new THREE.CylinderGeometry(0.05, 0.08, 0.9, 5)
      .rotateZ(0.7)
      .translate(0.28, 1.5, 0);
    return mergeParts([
      { geo: trunk, color: 0x3b3530 },
      { geo: branch, color: 0x352f2b },
    ]);
  }
  // Broadleaf: trunk + a leafy low-poly canopy blob.
  const trunk = new THREE.CylinderGeometry(0.12, 0.2, 1.5, 6).translate(0, 0.75, 0);
  const canopy = new THREE.IcosahedronGeometry(1.05, 0).translate(0, 2.1, 0);
  return mergeParts([
    { geo: trunk, color: 0x5b4329 },
    { geo: canopy, color: 0x3f6b34 },
  ]);
}

function placeInstanced(
  mesh: THREE.InstancedMesh,
  items: SceneryInstance[],
  field: Heightfield,
  yLift: (inst: SceneryInstance) => number,
  uniformScale: number,
  colorFor?: (variant: number) => THREE.Color,
): void {
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    up.position.set(it.x, field.sample(it.x, it.z) + yLift(it), it.z);
    up.rotation.set(0, it.rot, 0);
    up.scale.setScalar(it.scale * uniformScale);
    up.updateMatrix();
    mesh.setMatrixAt(i, up.matrix);
    if (colorFor) mesh.setColorAt(i, colorFor(it.variant));
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
    const px = -tz; // perpendicular
    const pz = tx;
    const lx = pts[i].x + px * hw;
    const lz = pts[i].z + pz * hw;
    const rx = pts[i].x - px * hw;
    const rz = pts[i].z - pz * hw;
    left.push(lx, field.sample(lx, lz) + yOffset, lz);
    right.push(rx, field.sample(rx, rz) + yOffset, rz);
  }
  const positions: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = i * 3;
    const b = (i + 1) * 3;
    // Two triangles per segment, wound so the face normal points up (+y).
    positions.push(left[a], left[a + 1], left[a + 2]);
    positions.push(right[b], right[b + 1], right[b + 2]);
    positions.push(right[a], right[a + 1], right[a + 2]);
    positions.push(left[a], left[a + 1], left[a + 2]);
    positions.push(left[b], left[b + 1], left[b + 2]);
    positions.push(right[b], right[b + 1], right[b + 2]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
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

  // ── Trees (one instanced mesh per variant; baked trunk/canopy colours) ───────
  const treeMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const byVariant: SceneryInstance[][] = [[], [], []];
  for (const t of scenery.trees) byVariant[t.variant]?.push(t);
  for (let v = 0; v < byVariant.length; v++) {
    const items = byVariant[v];
    if (items.length === 0) continue;
    const mesh = instancedFromGeo(treeGeometry(v), treeMat, items.length, `trees-${v}`);
    placeInstanced(mesh, items, field, () => 0, 1);
    group.add(mesh);
  }

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
    placeInstanced(mesh, scenery.boulders, field, (it) => it.scale * 0.35, 1, (variant) => tints[variant] ?? tints[0]);
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

  // ── Bushes (leafy / dry / fungal) ────────────────────────────────────────────
  if (scenery.bushes.length) {
    const tints = [new THREE.Color(0x3c6b34), new THREE.Color(0x6e5a36), new THREE.Color(0x6a5a72)];
    const mesh = instancedFromGeo(
      new THREE.IcosahedronGeometry(0.7, 0),
      new THREE.MeshLambertMaterial({ flatShading: true }),
      scenery.bushes.length,
      'bushes',
    );
    placeInstanced(mesh, scenery.bushes, field, (it) => it.scale * 0.3, 1, (variant) => tints[variant] ?? tints[0]);
    group.add(mesh);
  }

  // ── Grass tufts + reeds ──────────────────────────────────────────────────────
  if (scenery.grass.length) {
    const tints = [new THREE.Color(0x5f8c3f), new THREE.Color(0x6f7a3a)];
    const geo = new THREE.ConeGeometry(0.14, 0.7, 4).translate(0, 0.35, 0);
    const mesh = instancedFromGeo(
      geo,
      new THREE.MeshLambertMaterial(),
      scenery.grass.length,
      'grass',
    );
    placeInstanced(
      mesh,
      scenery.grass,
      field,
      (it) => (it.variant === 1 ? 0.2 : 0),
      1,
      (variant) => tints[variant] ?? tints[0],
    );
    group.add(mesh);
  }

  // ── Wildflowers ──────────────────────────────────────────────────────────────
  if (scenery.flowers.length) {
    const tints = [new THREE.Color(0xd85b6a), new THREE.Color(0xe6c64a), new THREE.Color(0x9a6fd0)];
    const mesh = instancedFromGeo(
      new THREE.IcosahedronGeometry(0.16, 0),
      new THREE.MeshLambertMaterial({ flatShading: true }),
      scenery.flowers.length,
      'flowers',
    );
    placeInstanced(mesh, scenery.flowers, field, () => 0.35, 1, (variant) => tints[variant] ?? tints[0]);
    group.add(mesh);
  }

  // ── Rivers (translucent water) ───────────────────────────────────────────────
  const waterMat = new THREE.MeshStandardMaterial({
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
    const m = buildRibbon(scenery.rivers[i], field, 0.18, waterMat, `river-${i}`);
    if (m) group.add(m);
  }

  // ── Roads (draped tan paths from the hub to the frontier) ────────────────────
  const roadMat = new THREE.MeshLambertMaterial({
    color: 0x9c8a5e,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  });
  for (let i = 0; i < scenery.roads.length; i++) {
    const m = buildRibbon(scenery.roads[i], field, 0.25, roadMat, `road-${i}`);
    if (m) group.add(m);
  }

  return group;
}
