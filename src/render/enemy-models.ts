// Procedural low-poly enemy models — one distinct look per family, built from primitives
// (no asset files). Keyed by (family, archetype) so the three shared families split by
// role (Sporeling/Sporemother, Bramblekin/Warchief, Ashen Reaver/Ember Warlord). Each
// returns a Group plus the body materials to flash on hit/telegraph and a height for the
// nameplate. Render-only; never touches the simulation.

import * as THREE from 'three';
import type { Entity } from '../core/ecs/world';

export interface EnemyModel {
  root: THREE.Group;
  /** Body materials that flash on hit / tint during a wind-up (glow cores excluded). */
  flashMats: THREE.MeshStandardMaterial[];
  /** Visual height (m) for placing the HP bar + nameplate. */
  top: number;
  /** Hover + bob (floating creatures). */
  bob: boolean;
}

type BodyType = 'humanoid' | 'beast' | 'floating' | 'spider' | 'mushroom' | 'plant' | 'construct';

interface Def {
  type: BodyType;
  color: number;
  accent: number;
  eyes: number;
  /** Emissive core/glow colour (casters, magma, ghosts). */
  glow?: number;
  variant?: string;
}

// Map an enemy family (+ archetype for the shared families) to a model kind.
function kindFor(family: string, archetype: string): string {
  if (family === 'Sporelings') return archetype === 'support' ? 'sporemother' : 'sporeling';
  if (family === 'Bramblekin') return archetype === 'pack_leader' ? 'warchief' : 'bramblekin';
  if (family === 'Ashen Reavers') return archetype === 'pack_leader' ? 'emberwarlord' : 'ashreaver';
  return FAMILY_KIND[family] ?? 'drudge';
}

const FAMILY_KIND: Record<string, string> = {
  Bloomhusks: 'bloomhusk',
  Reavers: 'reaver',
  Wisps: 'wisp',
  Weavers: 'weaver',
  Drudge: 'drudge',
  Fenstalkers: 'fenstalker',
  Mirelings: 'mireling',
  Magmaw: 'magmaw',
  Cinderborn: 'cinderborn',
  Rimebound: 'rimebound',
  Frostfang: 'frostfang',
  Revenants: 'revenant',
  Wraiths: 'wraith',
  Bonewrought: 'bonewrought',
  'The Forsworn': 'forsworn',
  // World bosses (CP2) — rendered at boss scale (2.5×) in enemy-view.
  Emberhorn: 'emberhorn',
  Rimewyrm: 'rimewyrm',
  Maelgrith: 'maelgrith',
};

const DEFS: Record<string, Def> = {
  // Greenmarch
  bloomhusk: { type: 'plant', color: 0x6b8e3a, accent: 0x7a5a2a, eyes: 0xffd24a },
  reaver: { type: 'humanoid', color: 0x8a7a55, accent: 0x5a4a30, eyes: 0xffe08a, variant: 'slim' },
  wisp: { type: 'floating', color: 0x3a6b3a, accent: 0x2f5230, eyes: 0xffffff, glow: 0x9be08a },
  // Thornwood
  weaver: { type: 'spider', color: 0x3a2f2a, accent: 0x271f1b, eyes: 0xff5050 },
  bramblekin: { type: 'plant', color: 0x5a4326, accent: 0x3f6b34, eyes: 0xc6ff6a, variant: 'thorny' },
  sporeling: { type: 'mushroom', color: 0xe8dcc0, accent: 0xc06b5a, eyes: 0x3a2a22 },
  sporemother: { type: 'mushroom', color: 0xdfd6c0, accent: 0x46c98a, eyes: 0x244a3a, glow: 0x46c98a, variant: 'mother' },
  warchief: { type: 'plant', color: 0x5a4326, accent: 0xc0563c, eyes: 0xffd24a, variant: 'warchief' },
  // Sunken Fen
  drudge: { type: 'humanoid', color: 0x4a5a44, accent: 0x35422f, eyes: 0x9bd06a, variant: 'brute' },
  fenstalker: { type: 'beast', color: 0x46584a, accent: 0x6a7a5a, eyes: 0xbfe080, variant: 'lanky' },
  mireling: { type: 'floating', color: 0x3a4a3a, accent: 0x2f3a2f, eyes: 0xffffff, glow: 0x8fd0a0 },
  // Emberreach
  magmaw: { type: 'beast', color: 0x2a2420, accent: 0x1c1714, eyes: 0xff7a20, glow: 0xff6a20, variant: 'heavy' },
  ashreaver: { type: 'humanoid', color: 0x5a4a44, accent: 0x3a302c, eyes: 0xffa040, variant: 'slim' },
  cinderborn: { type: 'floating', color: 0x3a2620, accent: 0x241712, eyes: 0xffffff, glow: 0xff7a30 },
  emberwarlord: { type: 'humanoid', color: 0x4a2e26, accent: 0xff6a20, eyes: 0xffb030, glow: 0xff6a20, variant: 'knight' },
  // Riven Peaks
  rimebound: { type: 'construct', color: 0x9fd4e6, accent: 0xcdeef7, eyes: 0x5ad0ff, glow: 0x6fc8ff, variant: 'ice' },
  frostfang: { type: 'beast', color: 0xcfe0ec, accent: 0x7aa8c8, eyes: 0x5ad0ff, variant: 'wolf' },
  revenant: { type: 'floating', color: 0xcdd6dd, accent: 0x8fa0ab, eyes: 0x9fe8ff, glow: 0x7fd0ff, variant: 'skeletal' },
  // Gravereach
  wraith: { type: 'floating', color: 0x4a4656, accent: 0x363143, eyes: 0xd6a0ff, glow: 0xb060d0, variant: 'ghost' },
  bonewrought: { type: 'construct', color: 0xdad2bd, accent: 0x9a917a, eyes: 0x9bff7a, variant: 'bone' },
  forsworn: { type: 'humanoid', color: 0x3a3645, accent: 0x8a3b3b, eyes: 0xff5a3a, glow: 0xff5a3a, variant: 'knight' },
  // World bosses — huge, themed, and visually distinct from their zone's standards.
  emberhorn: { type: 'beast', color: 0x3a1f16, accent: 0x1c1410, eyes: 0xffd24a, glow: 0xff7a1a, variant: 'heavy' },
  rimewyrm: { type: 'beast', color: 0x6a9ec0, accent: 0x3a6a8a, eyes: 0x9fe8ff, glow: 0x7fd0ff, variant: 'heavy' },
  maelgrith: { type: 'humanoid', color: 0x2e2a3a, accent: 0x6a3a8a, eyes: 0xc08aff, glow: 0xb060d0, variant: 'knight' },
};

function makeMat(color: number, rough = 0.8, metal = 0.05): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}

function glowMat(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.4 });
}

function part(
  group: THREE.Group,
  geo: THREE.BufferGeometry,
  mat: THREE.MeshStandardMaterial,
  e: Entity,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.userData.entity = e;
  group.add(m);
  return m;
}

/** Two glowing eyes on the +Z face of a head at height hy. */
function eyes(group: THREE.Group, def: Def, e: Entity, hy: number, spread: number, z: number): void {
  const m = glowMat(def.eyes);
  const g = new THREE.BoxGeometry(0.09, 0.1, 0.05);
  part(group, g, m, e, spread, hy, z);
  part(group, g.clone(), m, e, -spread, hy, z);
}

function buildHumanoid(root: THREE.Group, def: Def, e: Entity, mats: THREE.MeshStandardMaterial[]): number {
  const v = def.variant;
  const bulky = v === 'knight' || v === 'brute';
  const body = makeMat(def.color);
  const limbMat = makeMat(def.accent);
  mats.push(body, limbMat);

  const tw = bulky ? 0.66 : 0.46;
  const torso = part(root, new THREE.BoxGeometry(tw, 0.7, 0.36), body, e, 0, 1.12, 0);
  if (v === 'brute') torso.rotation.x = 0.22; // hunched
  // Head
  const head = part(root, new THREE.BoxGeometry(0.36, 0.34, 0.34), makeMat(def.color), e, 0, 1.6, v === 'brute' ? 0.12 : 0);
  mats.push(head.material as THREE.MeshStandardMaterial);
  eyes(root, def, e, 1.62, 0.09, (v === 'brute' ? 0.12 : 0) + 0.18);
  // Arms
  const aw = bulky ? 0.2 : 0.14;
  part(root, new THREE.BoxGeometry(aw, 0.62, 0.2), limbMat, e, tw / 2 + aw / 2, 1.18, 0);
  part(root, new THREE.BoxGeometry(aw, 0.62, 0.2), limbMat, e, -(tw / 2 + aw / 2), 1.18, 0);
  // Legs
  part(root, new THREE.BoxGeometry(0.18, 0.7, 0.22), limbMat, e, 0.16, 0.4, 0);
  part(root, new THREE.BoxGeometry(0.18, 0.7, 0.22), limbMat, e, -0.16, 0.4, 0);
  // Knight pauldrons + crest.
  if (v === 'knight') {
    const trim = def.glow ? glowMat(def.accent) : makeMat(def.accent);
    part(root, new THREE.BoxGeometry(0.24, 0.16, 0.34), trim, e, tw / 2, 1.46, 0);
    part(root, new THREE.BoxGeometry(0.24, 0.16, 0.34), trim, e, -tw / 2, 1.46, 0);
    part(root, new THREE.BoxGeometry(0.07, 0.22, 0.07), trim, e, 0, 1.9, 0);
  }
  return 1.85;
}

function buildBeast(root: THREE.Group, def: Def, e: Entity, mats: THREE.MeshStandardMaterial[]): number {
  const v = def.variant;
  const body = makeMat(def.color);
  const accent = makeMat(def.accent);
  mats.push(body, accent);
  const heavy = v === 'heavy';
  const len = heavy ? 1.5 : 1.2;
  const bh = heavy ? 0.8 : 0.55;
  const y = heavy ? 0.8 : 0.62;
  // Horizontal body.
  part(root, new THREE.BoxGeometry(heavy ? 0.9 : 0.6, bh, len), body, e, 0, y, 0);
  // Head at the front (+Z).
  part(root, new THREE.BoxGeometry(heavy ? 0.62 : 0.42, heavy ? 0.5 : 0.4, heavy ? 0.5 : 0.42), body, e, 0, y + (heavy ? 0.1 : 0.06), len / 2 + 0.1);
  eyes(root, def, e, y + (heavy ? 0.16 : 0.1), 0.12, len / 2 + 0.31);
  // Magma cracks / wolf belly.
  if (def.glow) {
    const gm = glowMat(def.glow);
    part(root, new THREE.BoxGeometry(heavy ? 0.92 : 0.62, 0.1, len * 0.7), gm, e, 0, y + bh / 2, 0);
  }
  // Four legs.
  const lh = y; // leg length down to ground
  const legGeo = new THREE.BoxGeometry(heavy ? 0.2 : 0.14, lh, heavy ? 0.2 : 0.14);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      part(root, legGeo.clone(), accent, e, sx * (heavy ? 0.32 : 0.22), lh / 2, sz * (len / 2 - 0.2));
    }
  }
  // Tail.
  part(root, new THREE.BoxGeometry(0.1, 0.1, 0.5), accent, e, 0, y, -(len / 2 + 0.22));
  return y + bh + (heavy ? 0.2 : 0.16);
}

function buildFloating(root: THREE.Group, def: Def, e: Entity, mats: THREE.MeshStandardMaterial[]): number {
  const v = def.variant;
  const shroud = makeMat(def.color, 0.85, 0);
  mats.push(shroud);
  // Tattered lower body (a downward cone), hovering above the ground.
  const skirt = part(root, new THREE.ConeGeometry(0.42, 1.1, 7), shroud, e, 0, 1.05, 0);
  skirt.rotation.x = Math.PI; // point down
  // Core / head.
  if (v === 'skeletal' || v === 'ghost') {
    // A hooded head.
    part(root, new THREE.BoxGeometry(0.34, 0.36, 0.34), shroud, e, 0, 1.7, 0);
    eyes(root, def, e, 1.72, 0.08, 0.18);
  } else {
    // A glowing orb (wisp / mireling / cinderborn).
    const core = glowMat(def.glow ?? def.color);
    part(root, new THREE.IcosahedronGeometry(0.26, 0), core, e, 0, 1.55, 0);
  }
  // A bright wisp core inside the shroud.
  if (def.glow) {
    const c = glowMat(def.glow);
    c.transparent = true;
    c.opacity = 0.85;
    part(root, new THREE.IcosahedronGeometry(0.16, 0), c, e, 0, 1.2, 0);
  }
  // Two short tendril "arms".
  part(root, new THREE.BoxGeometry(0.1, 0.5, 0.1), shroud, e, 0.34, 1.25, 0).rotation.z = 0.5;
  part(root, new THREE.BoxGeometry(0.1, 0.5, 0.1), shroud, e, -0.34, 1.25, 0).rotation.z = -0.5;
  return 1.95;
}

function buildSpider(root: THREE.Group, def: Def, e: Entity, mats: THREE.MeshStandardMaterial[]): number {
  const body = makeMat(def.color);
  const legMat = makeMat(def.accent);
  mats.push(body, legMat);
  // Abdomen + head.
  part(root, new THREE.IcosahedronGeometry(0.42, 0), body, e, 0, 0.6, -0.2);
  part(root, new THREE.IcosahedronGeometry(0.26, 0), body, e, 0, 0.55, 0.34);
  eyes(root, def, e, 0.6, 0.1, 0.56);
  // Six splayed legs.
  const legGeo = new THREE.BoxGeometry(0.06, 0.06, 0.7);
  for (let i = 0; i < 3; i++) {
    const z = 0.1 - i * 0.28;
    for (const sx of [-1, 1]) {
      const leg = part(root, legGeo.clone(), legMat, e, sx * 0.36, 0.5, z);
      leg.rotation.z = sx * 0.9;
      leg.rotation.x = (i - 1) * 0.4;
    }
  }
  return 0.95;
}

function buildMushroom(root: THREE.Group, def: Def, e: Entity, mats: THREE.MeshStandardMaterial[]): number {
  const mother = def.variant === 'mother';
  const stalk = makeMat(def.color);
  mats.push(stalk);
  const s = mother ? 1.4 : 1;
  // Stalk.
  part(root, new THREE.CylinderGeometry(0.18 * s, 0.24 * s, 0.7 * s, 7), stalk, e, 0, 0.35 * s, 0);
  // Cap (glowing for the mother).
  const capMat = mother ? glowMat(def.accent) : makeMat(def.accent);
  if (!mother) mats.push(capMat);
  const cap = part(root, new THREE.ConeGeometry(0.5 * s, 0.5 * s, 9), capMat, e, 0, 0.85 * s, 0);
  cap.scale.y = 0.7;
  // Little eyes on the stalk.
  eyes(root, def, e, 0.42 * s, 0.08, 0.2 * s);
  // Stubby feet.
  part(root, new THREE.BoxGeometry(0.12, 0.12, 0.16), stalk, e, 0.12 * s, 0.06, 0);
  part(root, new THREE.BoxGeometry(0.12, 0.12, 0.16), stalk, e, -0.12 * s, 0.06, 0);
  return (mother ? 1.1 * s : 1.1) + 0.1;
}

function buildPlant(root: THREE.Group, def: Def, e: Entity, mats: THREE.MeshStandardMaterial[]): number {
  const warchief = def.variant === 'warchief';
  const thorny = def.variant === 'thorny' || warchief;
  const bark = makeMat(def.color);
  const leaf = makeMat(def.accent);
  mats.push(bark, leaf);
  const s = warchief ? 1.25 : 1;
  // Bulbous bark body.
  part(root, new THREE.IcosahedronGeometry(0.5 * s, 0), bark, e, 0, 0.95 * s, 0);
  // Head knot.
  part(root, new THREE.BoxGeometry(0.34, 0.32, 0.32), bark, e, 0, 1.5 * s, 0);
  eyes(root, def, e, 1.52 * s, 0.09, 0.18);
  // Leafy crown / thorns.
  const crownMat = thorny ? leaf : makeMat(def.accent);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const spike = part(root, new THREE.ConeGeometry(0.1, thorny ? 0.4 : 0.3, 5), crownMat, e, Math.cos(a) * 0.4 * s, 1.3 * s, Math.sin(a) * 0.4 * s);
    spike.rotation.x = Math.sin(a) * 0.6;
    spike.rotation.z = -Math.cos(a) * 0.6;
  }
  // Stubby legs + arms (branches).
  part(root, new THREE.BoxGeometry(0.16, 0.5, 0.18), bark, e, 0.2, 0.3, 0);
  part(root, new THREE.BoxGeometry(0.16, 0.5, 0.18), bark, e, -0.2, 0.3, 0);
  // Warchief banner.
  if (warchief) {
    part(root, new THREE.CylinderGeometry(0.04, 0.04, 1.4, 5), makeMat(0x4a3826), e, 0.5, 1.4, -0.2);
    part(root, new THREE.BoxGeometry(0.02, 0.4, 0.5), glowMat(def.accent), e, 0.5, 1.9, -0.42);
  }
  return (warchief ? 2.1 : 1.75);
}

function buildConstruct(root: THREE.Group, def: Def, e: Entity, mats: THREE.MeshStandardMaterial[]): number {
  const ice = def.variant === 'ice';
  const main = ice
    ? new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.85, emissive: def.glow ?? 0x000000, emissiveIntensity: 0.25 })
    : makeMat(def.color, 0.6);
  const accent = makeMat(def.accent, ice ? 0.2 : 0.6);
  mats.push(accent);
  if (!ice) mats.push(main);
  // Stacked angular core (crystal / bone pile).
  const core = part(root, new THREE.IcosahedronGeometry(0.5, 0), main, e, 0, 1.0, 0);
  core.rotation.set(0.4, 0.5, 0.2);
  part(root, new THREE.IcosahedronGeometry(0.32, 0), main, e, 0, 1.55, 0);
  eyes(root, def, e, 1.55, 0.1, 0.2);
  // Shoulder shards / ribs.
  for (const sx of [-1, 1]) {
    const shard = part(root, new THREE.ConeGeometry(0.16, 0.6, 5), main, e, sx * 0.5, 1.2, 0);
    shard.rotation.z = sx * 0.6;
  }
  // Legs / base.
  part(root, new THREE.BoxGeometry(0.22, 0.7, 0.24), accent, e, 0.22, 0.38, 0);
  part(root, new THREE.BoxGeometry(0.22, 0.7, 0.24), accent, e, -0.22, 0.38, 0);
  return 1.9;
}

const BUILDERS: Record<BodyType, (r: THREE.Group, d: Def, e: Entity, m: THREE.MeshStandardMaterial[]) => number> = {
  humanoid: buildHumanoid,
  beast: buildBeast,
  floating: buildFloating,
  spider: buildSpider,
  mushroom: buildMushroom,
  plant: buildPlant,
  construct: buildConstruct,
};

/** Build a unique low-poly model for an enemy family/role. Feet at local y=0. */
export function buildEnemyModel(family: string, archetype: string, e: Entity): EnemyModel {
  const def = DEFS[kindFor(family, archetype)] ?? DEFS.drudge;
  const root = new THREE.Group();
  const flashMats: THREE.MeshStandardMaterial[] = [];
  const top = BUILDERS[def.type](root, def, e, flashMats);
  return { root, flashMats, top, bob: def.type === 'floating' };
}
