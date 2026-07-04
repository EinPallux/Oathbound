// Builds Three.js meshes from the pure heightfield data. The terrain is a single
// vertex-coloured mesh tinted per biome; rocks are one InstancedMesh (one draw call),
// biome-tinted per instance. Rendering reads world data; it never mutates the sim.

import * as THREE from 'three';
import type { Heightfield, CylinderCollider } from '../world/heightfield';
import { biomeFactors, dominantBiome } from '../world/biomes';
import { TERRAIN_RENDER_RES } from '../world/layout';

// ── Voxel / Cube-World terrain constants (shared by the sim collision grid + the renderer) ──
/** Horizontal cube size (m). Fine enough to read as "Cube World" (≈1.5× the player). */
export const VOXEL_CUBE = 3;
/** Vertical quantization (m) — the height step between stacked cubes. */
export const VOXEL_STEP = 2;
/** Half-extent (m) of the fine-cube bubble rendered around the player (≈ the voxel-mode fog far). */
export const VOXEL_VIEW = 340;

// Per-biome terrain palette (low ground → high ground within each biome).
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
};

const tmpA = new THREE.Color();
const tmpB = new THREE.Color();

// Ground grain — a little deterministic per-spot colour variation so the terrain reads with
// texture (grassy speckle, craggier on the bare-rock frontiers) instead of one flat colour.
function hash01(ix: number, iz: number, seed: number): number {
  let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(wx: number, wz: number, cell: number, seed: number): number {
  return hash01(Math.floor(wx / cell), Math.floor(wz / cell), seed);
}

/** Blended terrain colour at a world position + height. Smooth across biome borders. */
function terrainColor(x: number, z: number, h: number, out: THREE.Color): THREE.Color {
  const f = biomeFactors(x, z);
  // Base = Greenmarch low→high gradient.
  const t = THREE.MathUtils.clamp((h + 2) / 5, 0, 1);
  out.copy(PALETTE.greenLow).lerp(PALETTE.greenHigh, t);

  // Pull toward each frontier biome by its smooth membership (order: corners last).
  if (f.west > 0) out.lerp(tmpA.copy(PALETTE.ember).lerp(PALETTE.emberHot, t), f.west);
  if (f.south > 0) out.lerp(PALETTE.fen, f.south * 0.9);
  if (f.north > 0) out.lerp(PALETTE.grave, f.north * (1 - f.ne));
  if (f.east > 0) {
    // Riven Peaks: bare rock on the flanks, snow only capping the high summits.
    const snow = THREE.MathUtils.clamp((h - 24) / 22, 0, 1);
    tmpB.copy(PALETTE.rivenRock).lerp(PALETTE.snow, snow);
    out.lerp(tmpB, f.east * (1 - f.ne));
  }
  if (f.ne > 0) out.lerp(PALETTE.thorn, f.ne);

  // Grain: grassy speckle + meadow patches everywhere, craggier on the bare-rock frontiers.
  const rocky = Math.max(f.east * (1 - f.ne), f.north * (1 - f.ne));
  const fine = vnoise(x, z, 1.7, 11) - 0.5;
  const patch = vnoise(x, z, 6.5, 12) - 0.5;
  const crag = vnoise(x, z, 3.4, 22) - 0.5;
  out.addScalar(fine * (0.09 + rocky * 0.05) + patch * 0.05 + crag * rocky * 0.09);
  out.g += patch * 0.035 * (1 - rocky);
  out.r += patch * 0.02 * (1 - rocky);
  return out;
}

export function buildTerrainMesh(field: Heightfield): THREE.Mesh {
  // Draw at the render tessellation (≤ the heightfield density); heights are still
  // sampled from the full-res field at each vertex, so landforms are unchanged.
  const seg = Math.min(field.res - 1, TERRAIN_RENDER_RES - 1);
  const geo = new THREE.PlaneGeometry(field.size, field.size, seg, seg);
  geo.rotateX(-Math.PI / 2); // lie flat in the XZ plane (Y becomes height)

  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = field.sample(x, z);
    pos.setY(i, h);
    terrainColor(x, z, h, c);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  pos.needsUpdate = true;
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  // Lambert (not Standard/PBR): the terrain fills most of the screen, and a matte
  // diffuse surface looks identical here while costing far less per fragment — the main
  // fill-rate win on integrated GPUs. Same for the other large matte world surfaces.
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'terrain';
  return mesh;
}

// The voxel terrain itself is a player-centred bubble — see render/voxel-terrain.ts.
const _tc = new THREE.Color();
/** Procedural-world terrain colour as an [r,g,b] tuple — the colour source for the voxel cubes. */
export function terrainColorRGB(x: number, z: number, h: number, out: [number, number, number]): void {
  terrainColor(x, z, h, _tc);
  out[0] = _tc.r; out[1] = _tc.g; out[2] = _tc.b;
}

// Biome tints for the collidable rocks.
const ROCK_TINT: Record<string, THREE.Color> = {
  greenmarch: new THREE.Color(0x6b6f76),
  thornwood: new THREE.Color(0x5d6358),
  fen: new THREE.Color(0x55604f),
  ember: new THREE.Color(0x6e4338),
  riven: new THREE.Color(0xaab2bf),
  gravereach: new THREE.Color(0x6a6678),
  hub: new THREE.Color(0x6b6f76),
};

export function buildProps(cols: readonly CylinderCollider[], field: Heightfield): THREE.InstancedMesh {
  const geo = new THREE.IcosahedronGeometry(1, 0);
  const mat = new THREE.MeshLambertMaterial({ flatShading: true });
  const mesh = new THREE.InstancedMesh(geo, mat, cols.length);
  const dummy = new THREE.Object3D();

  for (let i = 0; i < cols.length; i++) {
    const c = cols[i];
    const y = field.sample(c.x, c.z);
    dummy.position.set(c.x, y + c.radius * 0.4, c.z);
    dummy.scale.setScalar(c.radius);
    dummy.rotation.set(i * 0.7, i * 1.3, i * 0.4);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, ROCK_TINT[dominantBiome(c.x, c.z)] ?? ROCK_TINT.greenmarch);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.name = 'props';
  return mesh;
}
