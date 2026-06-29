// Geometry for props placed in a custom map: the game's built-in low-poly prop builders
// (kept in sync with scenery-view.ts) plus a builder for custom AssetDefs (Asset Builder
// output). Used only by the custom-map renderer; the procedural world uses scenery-view.

import * as THREE from 'three';
import type { AssetDef, AssetPart } from '../world/map-format';

type BuiltinKind =
  | 'tree' | 'boulder' | 'pebble' | 'bush' | 'grass' | 'flower' | 'fern' | 'mushroom' | 'log' | 'lily';

export function mergeParts(parts: { geo: THREE.BufferGeometry; color: number }[]): THREE.BufferGeometry {
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

function treeGeometry(variant: number): THREE.BufferGeometry {
  switch (variant) {
    case 1: {
      const trunk = new THREE.CylinderGeometry(0.08, 0.14, 1.4, 6).translate(0, 0.7, 0);
      return mergeParts([
        { geo: trunk, color: 0x5a4632 },
        { geo: new THREE.ConeGeometry(0.85, 1.6, 7).translate(0, 1.55, 0), color: 0x2f5640 },
        { geo: new THREE.ConeGeometry(0.58, 1.4, 7).translate(0, 2.5, 0), color: 0x386450 },
      ]);
    }
    case 2: {
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
      const trunk = new THREE.CylinderGeometry(0.09, 0.13, 2.3, 6).translate(0, 1.15, 0);
      return mergeParts([
        { geo: trunk, color: 0xd8d8cf },
        { geo: blob(0.72, 0, 2.7, 0), color: 0x84b056 },
        { geo: blob(0.5, 0.28, 3.0, 0.12), color: 0x8fbb60 },
      ]);
    }
    case 4: {
      const trunk = new THREE.CylinderGeometry(0.24, 0.36, 1.8, 7).translate(0, 0.9, 0);
      return mergeParts([
        { geo: trunk, color: 0x4f3a23 },
        { geo: blob(1.5, 0, 2.7, 0), color: 0x355c2b },
        { geo: blob(1.05, 0.95, 2.9, 0.3), color: 0x3a6330 },
        { geo: blob(1.0, -0.85, 2.7, -0.4), color: 0x335829 },
      ]);
    }
    case 5: {
      const trunk = new THREE.CylinderGeometry(0.16, 0.24, 1.5, 6).translate(0, 0.75, 0);
      const parts = [
        { geo: trunk, color: 0x5a4a30 },
        { geo: blob(1.2, 0, 2.1, 0).scale(1, 0.7, 1), color: 0x728f3e },
      ];
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const frond = new THREE.ConeGeometry(0.15, 1.3, 5).rotateX(Math.PI).translate(Math.cos(a) * 0.95, 1.55, Math.sin(a) * 0.95);
        parts.push({ geo: frond, color: 0x6e8a3c });
      }
      return mergeParts(parts);
    }
    default: {
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

const BOULDER_TINTS = [0x80858f, 0x7a4a3c, 0xc9d2db, 0x6c7560];
const GRASS_TINTS = [0x5f8c3f, 0x6f7a3a];
const BUSH_TINTS = [0x3c6b34, 0x6e5a36, 0x6a5a72];

function bushGeometry(variant: number): THREE.BufferGeometry {
  if (variant === 3) {
    const parts = [
      { geo: blob(0.55, 0, 0.42, 0), color: 0x3c6b34 },
      { geo: blob(0.45, 0.42, 0.36, 0.12), color: 0x42703a },
      { geo: blob(0.4, -0.36, 0.4, -0.12), color: 0x386630 },
    ];
    const petals = [0xf3d6e2, 0xf6e7a0, 0xe7b6d0];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      parts.push({ geo: blob(0.1, Math.cos(a) * 0.5, 0.55 + (i % 2) * 0.12, Math.sin(a) * 0.5), color: petals[i % petals.length] });
    }
    return mergeParts(parts);
  }
  const tint = BUSH_TINTS[variant] ?? BUSH_TINTS[0];
  return mergeParts([
    { geo: blob(0.55, 0, 0.42, 0), color: tint },
    { geo: blob(0.45, 0.42, 0.36, 0.12), color: tint },
    { geo: blob(0.4, -0.36, 0.4, -0.12), color: tint },
  ]);
}

function flowerGeometry(variant: number): THREE.BufferGeometry {
  const bloomCol = [0xe0556a, 0xf2c84a, 0x9a6fd0, 0xf2eef0][variant] ?? 0xe0556a;
  const stem = new THREE.CylinderGeometry(0.02, 0.03, 0.46, 4).translate(0, 0.23, 0);
  const parts = [{ geo: stem, color: 0x4a7a3a }, { geo: blob(0.12, 0, 0.5, 0), color: bloomCol }];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    parts.push({ geo: blob(0.07, Math.cos(a) * 0.12, 0.5, Math.sin(a) * 0.12), color: bloomCol });
  }
  return mergeParts(parts);
}

function fernGeometry(): THREE.BufferGeometry {
  const parts: { geo: THREE.BufferGeometry; color: number }[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    parts.push({ geo: new THREE.ConeGeometry(0.08, 0.82, 4).rotateZ(0.5).rotateY(a).translate(0, 0.32, 0), color: i % 2 ? 0x3e6b34 : 0x47743b });
  }
  return mergeParts(parts);
}

function mushroomGeometry(variant: number): THREE.BufferGeometry {
  const capCol = [0xc23b34, 0x8a6a3a, 0xbfe6d8][variant] ?? 0xc23b34;
  const stem = new THREE.CylinderGeometry(0.06, 0.09, 0.32, 6).translate(0, 0.16, 0);
  const cap = blob(0.22, 0, 0.34, 0, 0).scale(1, 0.62, 1);
  return mergeParts([{ geo: stem, color: 0xeee8d8 }, { geo: cap, color: capCol }]);
}

function logGeometry(): THREE.BufferGeometry {
  const log = new THREE.CylinderGeometry(0.3, 0.34, 2.3, 8).rotateZ(Math.PI / 2).translate(0, 0.3, 0);
  const moss = new THREE.BoxGeometry(1.6, 0.08, 0.5).translate(0, 0.56, 0);
  return mergeParts([{ geo: log, color: 0x5a4327 }, { geo: moss, color: 0x4d6b34 }]);
}

function builtinGeometry(kind: BuiltinKind, variant: number): THREE.BufferGeometry {
  switch (kind) {
    case 'tree': return treeGeometry(variant);
    case 'boulder': return mergeParts([{ geo: new THREE.IcosahedronGeometry(1, 0), color: BOULDER_TINTS[variant] ?? BOULDER_TINTS[0] }]);
    case 'pebble': return mergeParts([{ geo: new THREE.IcosahedronGeometry(0.5, 0), color: 0x8b8c8f }]);
    case 'bush': return bushGeometry(variant);
    case 'grass': return mergeParts([{ geo: new THREE.ConeGeometry(0.14, 0.7, 4).translate(0, 0.35, 0), color: GRASS_TINTS[variant] ?? GRASS_TINTS[0] }]);
    case 'flower': return flowerGeometry(variant);
    case 'fern': return fernGeometry();
    case 'mushroom': return mushroomGeometry(variant);
    case 'log': return logGeometry();
    case 'lily': return mergeParts([{ geo: new THREE.CircleGeometry(0.5, 10).rotateX(-Math.PI / 2), color: 0x3f7a44 }]);
  }
}

const KINDS = new Set<string>(['tree', 'boulder', 'pebble', 'bush', 'grass', 'flower', 'fern', 'mushroom', 'log', 'lily']);
function parseBuiltin(assetId: string): { kind: BuiltinKind; variant: number } | null {
  const [kind, v] = assetId.split(':');
  if (!KINDS.has(kind)) return null;
  return { kind: kind as BuiltinKind, variant: parseInt(v ?? '0', 10) || 0 };
}

function primitiveGeometry(part: AssetPart): THREE.BufferGeometry {
  const [a, b, c] = part.dims;
  let geo: THREE.BufferGeometry;
  switch (part.shape) {
    case 'box': geo = new THREE.BoxGeometry(Math.max(0.01, a), Math.max(0.01, b), Math.max(0.01, c)); break;
    case 'cylinder': geo = new THREE.CylinderGeometry(Math.max(0, a), Math.max(0, b), Math.max(0.01, c), 8); break;
    case 'cone': geo = new THREE.ConeGeometry(Math.max(0.01, a), Math.max(0.01, b), 8); break;
    case 'sphere': geo = new THREE.SphereGeometry(Math.max(0.01, a), 12, 8); break;
    case 'icosahedron': geo = new THREE.IcosahedronGeometry(Math.max(0.01, a), Math.min(2, Math.max(0, Math.floor(b)))); break;
  }
  geo.rotateX(part.rot[0]).rotateY(part.rot[1]).rotateZ(part.rot[2]);
  geo.translate(part.pos[0], part.pos[1], part.pos[2]);
  return geo;
}

function customAssetGeometry(def: AssetDef): THREE.BufferGeometry {
  if (!def.parts.length) return new THREE.BufferGeometry();
  return mergeParts(def.parts.map((p) => ({ geo: primitiveGeometry(p), color: p.color })));
}

/** Geometry for any placed asset id (built-in or "custom:<id>"), or null if unknown. */
export function placedAssetGeometry(assetId: string, customAssets: AssetDef[]): THREE.BufferGeometry | null {
  const b = parseBuiltin(assetId);
  if (b) return builtinGeometry(b.kind, b.variant);
  if (assetId.startsWith('custom:')) {
    const def = customAssets.find((d) => `custom:${d.id}` === assetId);
    if (def) return customAssetGeometry(def);
  }
  return null;
}

/** Y-offset to seat a built-in prop on the ground (mirrors scenery-view yLift). */
export function assetYLift(assetId: string, scale: number): number {
  const b = parseBuiltin(assetId);
  if (!b) return 0;
  switch (b.kind) {
    case 'boulder': return scale * 0.35;
    case 'pebble': return 0.05;
    case 'bush': return scale * 0.1;
    case 'grass': return b.variant === 1 ? 0.2 : 0;
    case 'flower': return 0.1;
    default: return 0;
  }
}

const SMOOTH = new Set<string>(['tree', 'flower', 'lily']);
export function isSmoothAsset(assetId: string): boolean {
  const b = parseBuiltin(assetId);
  return b ? SMOOTH.has(b.kind) : false;
}
