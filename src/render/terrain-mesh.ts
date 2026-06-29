// Builds Three.js meshes from the pure heightfield data. The terrain is a single
// vertex-coloured mesh tinted per biome; rocks are one InstancedMesh (one draw call),
// biome-tinted per instance. Rendering reads world data; it never mutates the sim.

import * as THREE from 'three';
import type { Heightfield, CylinderCollider } from '../world/heightfield';
import { biomeFactors, dominantBiome } from '../world/biomes';
import { TERRAIN_RENDER_RES } from '../world/layout';

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
    // Riven Peaks: bare rock low, snow on the heights.
    const snow = THREE.MathUtils.clamp((h - 12) / 16, 0, 1);
    tmpB.copy(PALETTE.rivenRock).lerp(PALETTE.snow, snow);
    out.lerp(tmpB, f.east * (1 - f.ne));
  }
  if (f.ne > 0) out.lerp(PALETTE.thorn, f.ne);
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
