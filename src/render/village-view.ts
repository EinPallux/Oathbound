// The starting village (render-only): low-poly buildings + props built from the pure
// layout in src/world/village.ts, plus animated villager figures that stroll authored
// routes or stand at their posts (the smith hammers, others idle-sway). Reads world data;
// never touches the sim. The building footprints are solid in the sim via villageBoxes().
//
// Static geometry (every building, and each prop type) is merged into a handful of meshes
// to keep the draw-call count down; only the villagers — which animate — are separate.

import * as THREE from 'three';
import type { Heightfield } from '../world/heightfield';
import {
  BUILDINGS,
  PROPS,
  WALKERS,
  STANDERS,
  type Building,
  type VillageProp,
} from '../world/village';

interface Part {
  geo: THREE.BufferGeometry;
  color: number;
}

/** Concatenate parts into one geometry, baking a per-part vertex colour. */
function merge(parts: Part[]): THREE.BufferGeometry {
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

function box(w: number, h: number, d: number): THREE.BoxGeometry {
  return new THREE.BoxGeometry(w, h, d);
}

const LAMBERT = (): THREE.MeshLambertMaterial =>
  new THREE.MeshLambertMaterial({ vertexColors: true });

// ── Building palettes ────────────────────────────────────────────────────────
interface Palette {
  wall: number;
  roof: number;
  door: number;
  window: number;
  trim: number;
}
const BUILDING_PALETTE: Record<Building['type'], Palette> = {
  cottage: { wall: 0xd8cdb4, roof: 0x8a6f3e, door: 0x5a4226, window: 0x394a52, trim: 0x6b5436 },
  house: { wall: 0xcabfa3, roof: 0x7c4a38, door: 0x4f3a22, window: 0x3a4b54, trim: 0x5a4632 },
  blacksmith: { wall: 0x70706f, roof: 0x3f3b38, door: 0x2c2622, window: 0x2a3338, trim: 0x4a4642 },
  tavern: { wall: 0xb79f78, roof: 0x77492f, door: 0x4a3520, window: 0x3a4b54, trim: 0x5c4326 },
};

/** Local-space parts for one building (centred at origin, +z is the front). */
function buildingParts(b: Building): Part[] {
  const pal = BUILDING_PALETTE[b.type];
  const parts: Part[] = [];
  // Walls.
  parts.push({ geo: box(b.w, b.h, b.d).translate(0, b.h / 2, 0), color: pal.wall });
  // A timber sill line near the base for a bit of definition.
  parts.push({ geo: box(b.w + 0.06, 0.18, b.d + 0.06).translate(0, 0.12, 0), color: pal.trim });
  // Hip/pyramid roof (a 4-sided cone), overhanging the walls a touch.
  const rh = b.type === 'blacksmith' ? 1.5 : 1.7;
  const k = 1.08 / 0.7071;
  parts.push({
    geo: new THREE.ConeGeometry(1, rh, 4)
      .rotateY(Math.PI / 4)
      .scale((b.w / 2) * k, 1, (b.d / 2) * k)
      .translate(0, b.h + rh / 2, 0),
    color: pal.roof,
  });
  // Door on the front (+z) wall.
  parts.push({ geo: box(1.0, 1.5, 0.12).translate(0, 0.75, b.d / 2 + 0.02), color: pal.door });
  // Front windows flanking the door, plus one on each side wall.
  const wy = Math.min(1.4, b.h - 0.7);
  parts.push({ geo: box(0.7, 0.7, 0.1).translate(-b.w / 2 + 0.95, wy, b.d / 2 + 0.02), color: pal.window });
  parts.push({ geo: box(0.7, 0.7, 0.1).translate(b.w / 2 - 0.95, wy, b.d / 2 + 0.02), color: pal.window });
  parts.push({ geo: box(0.1, 0.7, 0.7).translate(-b.w / 2 - 0.02, wy, 0), color: pal.window });
  parts.push({ geo: box(0.1, 0.7, 0.7).translate(b.w / 2 + 0.02, wy, 0), color: pal.window });
  // Chimney for houses, the tavern and the smithy.
  if (b.type !== 'cottage') {
    parts.push({ geo: box(0.5, 1.3, 0.5).translate(b.w / 2 - 0.9, b.h + 0.9, b.d / 2 - 0.9), color: pal.trim });
  }
  return parts;
}

/** Transform a set of local parts to a building's world placement (rotate, then translate). */
function placeParts(parts: Part[], x: number, y: number, z: number, rot: number): Part[] {
  for (const p of parts) p.geo.rotateY(rot).translate(x, y, z);
  return parts;
}

// ── Props ────────────────────────────────────────────────────────────────────
function propParts(p: VillageProp): Part[] {
  const parts: Part[] = [];
  switch (p.type) {
    case 'well': {
      parts.push({ geo: new THREE.CylinderGeometry(1.1, 1.2, 1.0, 12).translate(0, 0.5, 0), color: 0x8f8a82 });
      parts.push({ geo: new THREE.CylinderGeometry(0.95, 0.95, 0.2, 12).translate(0, 1.0, 0), color: 0x6f6a62 });
      parts.push({ geo: box(0.16, 1.6, 0.16).translate(-1.0, 1.5, 0), color: 0x5a4326 });
      parts.push({ geo: box(0.16, 1.6, 0.16).translate(1.0, 1.5, 0), color: 0x5a4326 });
      parts.push({ geo: new THREE.ConeGeometry(1.5, 0.8, 4).rotateY(Math.PI / 4).translate(0, 2.7, 0), color: 0x77492f });
      break;
    }
    case 'stall': {
      parts.push({ geo: box(2.4, 0.12, 1.4).translate(0, 1.0, 0), color: 0x7a5a36 }); // counter
      for (const sx of [-1.05, 1.05]) for (const sz of [-0.55, 0.55])
        parts.push({ geo: box(0.12, 1.0, 0.12).translate(sx, 0.5, sz), color: 0x5a4326 });
      parts.push({ geo: box(2.7, 0.1, 1.7).rotateX(-0.32).translate(0, 1.95, -0.35), color: 0x9a4a44 }); // awning
      for (const sx of [-1.1, 1.1])
        parts.push({ geo: box(0.1, 1.0, 0.1).translate(sx, 1.5, 0.6), color: 0x5a4326 });
      break;
    }
    case 'cart': {
      parts.push({ geo: box(2.4, 0.5, 1.3).translate(0, 0.8, 0), color: 0x6a4f2e });
      parts.push({ geo: box(2.3, 0.4, 0.1).translate(0, 1.1, -0.6), color: 0x5a4326 });
      for (const sz of [-0.7, 0.7])
        parts.push({ geo: new THREE.CylinderGeometry(0.5, 0.5, 0.16, 10).rotateX(Math.PI / 2).translate(-0.7, 0.5, sz), color: 0x3e342a });
      parts.push({ geo: box(0.1, 0.1, 1.6).translate(1.3, 0.6, 0), color: 0x5a4326 }); // handles
      break;
    }
    case 'lantern': {
      parts.push({ geo: box(0.12, 2.0, 0.12).translate(0, 1.0, 0), color: 0x4a4038 });
      parts.push({ geo: box(0.28, 0.1, 0.28).translate(0, 2.05, 0), color: 0x3a342c });
      break; // the glowing flame is added separately (emissive)
    }
    case 'crate':
      parts.push({ geo: box(0.8, 0.8, 0.8).translate(0, 0.4, 0), color: 0x7a5a34 });
      break;
    case 'barrel':
      parts.push({ geo: new THREE.CylinderGeometry(0.4, 0.36, 0.9, 10).translate(0, 0.45, 0), color: 0x6a4a2c });
      parts.push({ geo: new THREE.CylinderGeometry(0.42, 0.42, 0.1, 10).translate(0, 0.45, 0), color: 0x3a2f22 });
      break;
    case 'hay':
      parts.push({ geo: new THREE.CylinderGeometry(0.6, 0.6, 1.1, 10).rotateZ(Math.PI / 2).translate(0, 0.55, 0), color: 0xc6a64e });
      break;
    case 'board': {
      parts.push({ geo: box(0.12, 1.3, 0.12).translate(-0.6, 0.65, 0), color: 0x5a4326 });
      parts.push({ geo: box(0.12, 1.3, 0.12).translate(0.6, 0.65, 0), color: 0x5a4326 });
      parts.push({ geo: box(1.5, 0.9, 0.1).translate(0, 1.2, 0), color: 0x6a4f2e });
      parts.push({ geo: box(1.3, 0.7, 0.06).translate(0, 1.2, 0.06), color: 0xcfc3a4 });
      break;
    }
    case 'fence':
      parts.push({ geo: box(2.0, 0.1, 0.08).translate(0, 0.8, 0), color: 0x6a4f2e });
      parts.push({ geo: box(2.0, 0.1, 0.08).translate(0, 0.45, 0), color: 0x6a4f2e });
      break;
  }
  return parts;
}

// ── Villagers ────────────────────────────────────────────────────────────────
interface VPalette {
  tunic: number;
  pants: number;
  skin: number;
}
const SKINS = [0xddae86, 0xc6915f, 0xe7c19a, 0xb07a4e];
const TUNICS = [0x5f76ad, 0x6f9a5a, 0x9a5648, 0xb0894a, 0x7a6a9a, 0x8a9a86, 0xa86a4a];
function villagerPalette(i: number): VPalette {
  return { tunic: TUNICS[i % TUNICS.length], pants: 0x49403a, skin: SKINS[i % SKINS.length] };
}

interface Villager {
  group: THREE.Group;
  body: THREE.Group; // torso/head/arms — bobs & sways
  legL: THREE.Group;
  legR: THREE.Group;
  hammer: THREE.Group | null;
  // animation state
  kind: 'walk' | 'idle' | 'smith';
  route?: { x: number; z: number }[];
  seg: number;
  segT: number;
  speed: number;
  phase: number;
}

function buildVillager(pal: VPalette, withHammer: boolean): Villager {
  const group = new THREE.Group();

  // Body (torso + head + left arm, plus the right arm unless it wields a hammer).
  const bodyParts: Part[] = [
    { geo: box(0.5, 0.62, 0.3).translate(0, 1.02, 0), color: pal.tunic },
    { geo: box(0.32, 0.32, 0.3).translate(0, 1.5, 0), color: pal.skin },
    { geo: box(0.15, 0.5, 0.17).translate(0.32, 0.95, 0), color: pal.tunic },
  ];
  if (!withHammer) bodyParts.push({ geo: box(0.15, 0.5, 0.17).translate(-0.32, 0.95, 0), color: pal.tunic });
  const body = new THREE.Group();
  body.add(new THREE.Mesh(merge(bodyParts), LAMBERT()));
  group.add(body);

  // Legs (hip-pivot groups so they can swing for the walk cycle).
  const leg = (sx: number): THREE.Group => {
    const g = new THREE.Group();
    g.position.set(sx, 0.7, 0);
    const m = new THREE.Mesh(merge([{ geo: box(0.2, 0.72, 0.22).translate(0, -0.36, 0), color: pal.pants }]), LAMBERT());
    g.add(m);
    return g;
  };
  const legL = leg(0.13);
  const legR = leg(-0.13);
  group.add(legL, legR);

  // Optional hammer arm (the smith).
  let hammer: THREE.Group | null = null;
  if (withHammer) {
    hammer = new THREE.Group();
    hammer.position.set(-0.32, 1.05, 0);
    const m = new THREE.Mesh(
      merge([
        { geo: box(0.15, 0.55, 0.17).translate(0, -0.27, 0), color: pal.tunic },
        { geo: box(0.18, 0.18, 0.4).translate(0, -0.55, 0.18), color: 0x3a3530 },
        { geo: box(0.1, 0.1, 0.3).translate(0, -0.55, 0.18), color: 0x6a5436 },
      ]),
      LAMBERT(),
    );
    hammer.add(m);
    group.add(hammer);
  }

  return {
    group,
    body,
    legL,
    legR,
    hammer,
    kind: 'idle',
    seg: 0,
    segT: 0,
    speed: 1,
    phase: Math.random() * Math.PI * 2,
  };
}

export class VillageView {
  readonly group = new THREE.Group();
  /** The merged building mesh — added to the camera's occlusion obstacles. */
  readonly buildings: THREE.Mesh;
  private readonly villagers: Villager[] = [];
  private readonly lanternGlow: THREE.MeshStandardMaterial;
  private readonly forgeGlow: THREE.MeshStandardMaterial;
  private t = 0;

  constructor(scene: THREE.Scene, private readonly field: Heightfield) {
    this.group.name = 'village';

    // ── Buildings (all merged into one mesh) ──
    const allBuilding: Part[] = [];
    for (const b of BUILDINGS) {
      const gy = field.sample(b.x, b.z);
      allBuilding.push(...placeParts(buildingParts(b), b.x, gy, b.z, b.rot));
    }
    this.buildings = new THREE.Mesh(merge(allBuilding), LAMBERT());
    this.buildings.name = 'village-buildings';
    this.group.add(this.buildings);

    // Forge glow + anvil at the blacksmith.
    const smithy = BUILDINGS.find((b) => b.type === 'blacksmith')!;
    const sgy = field.sample(smithy.x, smithy.z);
    this.forgeGlow = new THREE.MeshStandardMaterial({ color: 0xff7a1e, emissive: 0xff5a10, emissiveIntensity: 1.4 });
    const forge = new THREE.Mesh(box(0.7, 0.7, 0.4), this.forgeGlow);
    // In front of the smithy (its front +z faces the plaza after rotation).
    forge.position.set(smithy.x + Math.sin(smithy.rot) * (smithy.d / 2 + 0.2), sgy + 0.7, smithy.z + Math.cos(smithy.rot) * (smithy.d / 2 + 0.2));
    this.group.add(forge);
    const anvil = new THREE.Mesh(merge([
      { geo: box(0.3, 0.35, 0.6).translate(0, 0.5, 0), color: 0x2e2a28 },
      { geo: box(0.5, 0.18, 0.5).translate(0, 0.27, 0), color: 0x35302c },
    ]), LAMBERT());
    anvil.position.set(-11.5, field.sample(-11.5, -3.6), -3.6);
    this.group.add(anvil);

    // ── Props (merged per type) + lantern flames (emissive) ──
    const byType = new Map<string, Part[]>();
    const lanternFlames: Part[] = [];
    for (const p of PROPS) {
      const gy = field.sample(p.x, p.z);
      const parts = placeParts(propParts(p), p.x, gy, p.z, p.rot);
      const arr = byType.get(p.type);
      if (arr) arr.push(...parts);
      else byType.set(p.type, parts);
      if (p.type === 'lantern') lanternFlames.push({ geo: new THREE.SphereGeometry(0.13, 8, 6).translate(p.x, gy + 2.05, p.z), color: 0 });
    }
    for (const parts of byType.values()) {
      this.group.add(new THREE.Mesh(merge(parts), LAMBERT()));
    }
    this.lanternGlow = new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffb24a, emissiveIntensity: 1.5 });
    if (lanternFlames.length) {
      const flames = new THREE.Mesh(merge(lanternFlames), this.lanternGlow);
      this.group.add(flames);
    }

    // ── Villagers ──
    let pi = 0;
    for (const w of WALKERS) {
      const v = buildVillager(villagerPalette(pi++), false);
      v.kind = 'walk';
      v.route = w.route;
      v.speed = w.speed;
      v.segT = Math.random();
      this.placeOnRoute(v);
      this.villagers.push(v);
      this.group.add(v.group);
    }
    for (const s of STANDERS) {
      const v = buildVillager(villagerPalette(pi++), s.kind === 'smith');
      v.kind = s.kind === 'smith' ? 'smith' : 'idle';
      v.group.position.set(s.x, field.sample(s.x, s.z), s.z);
      v.group.rotation.y = s.rot;
      this.villagers.push(v);
      this.group.add(v.group);
    }

    scene.add(this.group);
  }

  /** Snap a walker onto its current route segment + face along it. */
  private placeOnRoute(v: Villager): void {
    const r = v.route!;
    const a = r[v.seg];
    const b = r[(v.seg + 1) % r.length];
    const x = a.x + (b.x - a.x) * v.segT;
    const z = a.z + (b.z - a.z) * v.segT;
    v.group.position.set(x, this.field.sample(x, z), z);
    v.group.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
  }

  update(dt: number): void {
    this.t += dt;
    for (const v of this.villagers) {
      if (v.kind === 'walk' && v.route) {
        // Advance along the route by distance = speed*dt.
        let remaining = v.speed * dt;
        const r = v.route;
        let guard = 0;
        while (remaining > 0 && guard++ < 8) {
          const a = r[v.seg];
          const b = r[(v.seg + 1) % r.length];
          const segLen = Math.hypot(b.x - a.x, b.z - a.z) || 1;
          const stepT = remaining / segLen;
          if (v.segT + stepT >= 1) {
            remaining -= (1 - v.segT) * segLen;
            v.seg = (v.seg + 1) % r.length;
            v.segT = 0;
          } else {
            v.segT += stepT;
            remaining = 0;
          }
        }
        this.placeOnRoute(v);
        // Walk cycle: swing legs + bob the body.
        v.phase += dt * 7;
        const sw = Math.sin(v.phase);
        v.legL.rotation.x = sw * 0.6;
        v.legR.rotation.x = -sw * 0.6;
        v.body.position.y = Math.abs(Math.sin(v.phase)) * 0.05;
      } else if (v.kind === 'smith') {
        // Hammer strikes with a quick down / slow up motion.
        const p = (this.t * 1.5 + v.phase) % 1;
        const swing = p < 0.25 ? 1 - p / 0.25 : (p - 0.25) / 0.75;
        if (v.hammer) v.hammer.rotation.x = -2.0 + swing * 1.8;
        v.body.rotation.x = 0.12 * (1 - swing);
      } else {
        // Idlers gently sway / breathe.
        v.body.rotation.z = Math.sin(this.t * 1.3 + v.phase) * 0.04;
        v.body.position.y = Math.sin(this.t * 1.6 + v.phase) * 0.015;
      }
    }
    // Subtle lantern + forge flicker.
    const flick = 1.2 + Math.sin(this.t * 11) * 0.18 + Math.sin(this.t * 23) * 0.1;
    this.lanternGlow.emissiveIntensity = flick;
    this.forgeGlow.emissiveIntensity = 1.2 + Math.sin(this.t * 7 + 1) * 0.3;
  }
}
