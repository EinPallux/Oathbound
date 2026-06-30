// ─────────────────────────────────────────────────────────────────────────────
// Oathbound map format (v1) — the contract between the Map Builder and the game.
//
// This module is PURE: no three.js, no DOM. The exact same types + helpers are
// mirrored in the Admin Tools repo (src/format/map.ts) so the builder's export and
// this loader agree byte-for-byte. Keep the two copies in sync; bump
// MAP_FORMAT_VERSION on any breaking change and add a migration.
//
// Coordinate space matches the game: XZ ground plane, Y up, world centred on the
// origin, playable area ±size/2. Heights are a row-major grid sampled bilinearly.
// ─────────────────────────────────────────────────────────────────────────────

export const MAP_FORMAT_VERSION = 1;

/** Biome ids — same set as the game (src/world/biomes.ts). Index = paint value. */
export const BIOME_IDS = [
  'greenmarch',
  'thornwood',
  'fen',
  'ember',
  'riven',
  'gravereach',
  'hub',
] as const;
export type BiomeId = (typeof BIOME_IDS)[number];

/** Enemy template ids (mirror of EnemyTemplateId in the game). */
export const ENEMY_IDS = [
  'bloomhusk', 'reaver', 'wisp', 'weaver', 'bramblekin', 'sporeling', 'sporemother',
  'warchief', 'drudge', 'fenstalker', 'mireling', 'magmaw', 'ashreaver', 'cinderborn',
  'emberwarlord', 'rimebound', 'frostfang', 'revenant', 'wraith', 'bonewrought', 'forsworn',
] as const;
export type EnemyId = (typeof ENEMY_IDS)[number];

export const ENEMY_TIERS = ['standard', 'elite', 'rare'] as const;
export type EnemyTier = (typeof ENEMY_TIERS)[number];

/** Boss ids (mirror of BossId in the game). */
export const BOSS_IDS = ['emberhorn', 'rimewyrm', 'maelgrith'] as const;
export type BossId = (typeof BOSS_IDS)[number];

/** A polyline path (rivers, roads) — a list of XZ points + a width in metres. */
export interface MapPath {
  points: { x: number; z: number }[];
  width: number;
}

/** A circular water body. `y` is the water-surface height (the editor sets it; the
 *  loader renders a flat disc there). Sculpt a basin under it for a proper lake. */
export interface MapLake {
  x: number;
  z: number;
  r: number;
  y?: number;
}

/** A flat shelf levelled into the terrain (boss arenas, the town). */
export interface MapFlat {
  x: number;
  z: number;
  r: number;
}

/**
 * A placed prop. `asset` is a catalog id:
 *   - built-in:  "<kind>:<variant>"  e.g. "tree:1", "boulder:2", "bush:0"
 *   - custom:    "custom:<assetId>"  resolved against the map's customAssets[]
 */
export interface PlacedAsset {
  asset: string;
  x: number;
  z: number;
  /** Uniform scale multiplier. */
  scale: number;
  /** Y rotation (radians). */
  rot: number;
  /** Additive vertical offset (m) on top of the terrain seating — raise/lower the prop. */
  y?: number;
}

export interface MapSpawn {
  id: EnemyId;
  x: number;
  z: number;
  level: number;
  tier?: EnemyTier;
  /** Display-name override for unique/named spawns. */
  name?: string;
}

export interface MapBoss {
  id: BossId;
  x: number;
  z: number;
}

export interface MapOathstone {
  id: string;
  name: string;
  x: number;
  z: number;
  /** Frontier stones double as road destinations from the hub. */
  road?: boolean;
}

/** Ambient wildlife types (decorative, render-only): wheeling birds, ground critters
 *  (rats/rabbits), drifting butterflies, glowing fireflies. */
export const CRITTER_TYPES = ['birds', 'critters', 'butterflies', 'fireflies'] as const;
export type CritterType = (typeof CRITTER_TYPES)[number];

/** A zone that spawns `count` ambient creatures of `type` wandering within `radius`. */
export interface MapCritter {
  type: CritterType;
  x: number;
  z: number;
  radius: number;
  count: number;
}

/** A friendly, non-hostile NPC that idles or strolls a closed patrol route. */
export interface MapNpc {
  /** Stable id referenced by quests/dialog (auto-assigned by the editor). */
  id?: string;
  name: string;
  /** Home / spawn position (also the first route point). */
  x: number;
  z: number;
  /** Patrol waypoints (looped). Empty = stands idle at the home position. */
  route: { x: number; z: number }[];
  /** Walk speed (m/s). */
  speed: number;
  /** Appearance variant — 0 villager · 1 guard · 2 merchant · 3 elder. */
  variant?: number;
  /** Role/subtitle shown in the dialog header (e.g. "Blacksmith"). */
  title?: string;
  /** Lines shown when the player talks to this NPC (one per click-through). */
  dialog?: string[];
}

// ── Quests / dialog ──────────────────────────────────────────────────────────

export type QuestObjective =
  | { type: 'kill'; enemyId: EnemyId; count: number }
  | { type: 'talk'; npcId: string };

/** Equipment slots a gear reward can target (mirror of EquipSlot in the game). */
export const ITEM_SLOTS = [
  'weapon', 'offhand', 'head', 'chest', 'hands', 'legs', 'feet', 'amulet', 'ring1', 'ring2',
] as const;
export type ItemSlot = (typeof ITEM_SLOTS)[number];

/** Rarities a rolled gear reward can take (relics are awarded by id, not rolled). */
export const ITEM_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;
export type ItemRarity = (typeof ITEM_RARITIES)[number];

/** Primary-stat bias for a rolled weapon/jewellery reward (armour ignores it). */
export const ITEM_PRIMARY_STATS = ['STR', 'DEX', 'SPR'] as const;
export type ItemPrimaryStat = (typeof ITEM_PRIMARY_STATS)[number];

/** Named end-game relics that can be handed out whole (mirror of RelicId in the game). */
export const RELIC_IDS = ['ashbrand', 'rimewyrm-heart', 'hollow-crown', 'bloodroot-sigil'] as const;
export type RelicRewardId = (typeof RELIC_IDS)[number];

/**
 * An item handed out on quest turn-in: either a piece of gear *rolled* from a spec
 * (slot + rarity + item level, like all loot) or a fixed, hand-designed relic by id.
 */
export type QuestItemReward =
  | { kind: 'gear'; slot: ItemSlot; rarity: ItemRarity; ilvl: number; primaryStat?: ItemPrimaryStat }
  | { kind: 'relic'; relicId: RelicRewardId };

/** A quest's payout: gold + XP, and optionally one item. */
export interface QuestReward {
  gold: number;
  xp: number;
  item?: QuestItemReward;
}

/** A quest accepted at `giver`, completed at `turnIn`, with one objective + a reward. */
export interface MapQuest {
  id: string;
  name: string;
  description: string;
  /** NPC id that offers the quest. */
  giver: string;
  /** NPC id where it's turned in (can equal the giver). */
  turnIn: string;
  /**
   * Quest ids that must be completed (turned in) before this one is offered — the
   * backbone of questlines. Empty/absent = available from the start. All listed
   * prerequisites must be done (AND), enabling simple chains and convergent lines.
   */
  requires?: string[];
  objective: QuestObjective;
  reward: QuestReward;
  /** Dialog shown when offering / while in progress / on completion. */
  offerText?: string;
  progressText?: string;
  completeText?: string;
}

// ── Custom assets (Asset Builder output) ─────────────────────────────────────

export type PrimitiveShape = 'box' | 'cylinder' | 'cone' | 'sphere' | 'icosahedron';

/**
 * One primitive in a custom asset. `dims` is interpreted per shape:
 *   box        → [width, height, depth]
 *   cylinder   → [radiusTop, radiusBottom, height]
 *   cone       → [radius, height, _]
 *   sphere     → [radius, _, _]
 *   icosahedron→ [radius, detail(0–2), _]
 * `pos`/`rot` place the part within the asset's local space (base at y=0).
 */
export interface AssetPart {
  shape: PrimitiveShape;
  color: number; // 0xRRGGBB
  dims: [number, number, number];
  pos: [number, number, number];
  rot: [number, number, number];
  /** Use flat shading (faceted) instead of smooth. */
  flat?: boolean;
}

export type AssetCategory = 'tree' | 'rock' | 'plant' | 'structure' | 'misc';

export interface AssetDef {
  id: string;
  name: string;
  category: AssetCategory;
  parts: AssetPart[];
  /** Round physical collider radius (metres), or null for none (decor). */
  collider: number | null;
  /**
   * Rectangular footprint collider (half-extents, metres) — for buildings/walls so they
   * block movement precisely. Rotated by the placement's rotation, scaled by its scale.
   * null/absent = no box.
   */
  box?: { hw: number; hd: number } | null;
}

// ── The map ──────────────────────────────────────────────────────────────────

export interface OathboundMap {
  version: number;
  name: string;
  /** World extent (square, metres), centred on the origin. */
  size: number;
  /** Heightfield resolution (samples per side); heights.length === res*res. */
  res: number;
  /**
   * Row-major heights. Stored either as a plain array (authorable by hand) or a
   * packed base64 Int16-centimetre string in `heightsPacked` (compact export).
   * Exactly one is present; use unpackHeights() to read.
   */
  heights?: number[];
  heightsPacked?: string;
  /** Row-major biome index (into BIOME_IDS), one per height sample. */
  biomes: number[];
  /**
   * Optional painted water: a row-major grid (same res) of water-surface heights, packed as
   * base64 Int16-cm with a "dry" sentinel. Read with unpackWater(). Newer than `lakes`, which
   * remain for back-compat.
   */
  waterPacked?: string;
  lakes: MapLake[];
  rivers: MapPath[];
  roads: MapPath[];
  assets: PlacedAsset[];
  /** Definitions referenced by "custom:<id>" placements. */
  customAssets: AssetDef[];
  spawns: MapSpawn[];
  bosses: MapBoss[];
  oathstones: MapOathstone[];
  /** Friendly NPCs (idle/patrolling). */
  npcs: MapNpc[];
  /** Quests offered/turned in at NPCs. */
  quests: MapQuest[];
  /** Ambient wildlife zones (decorative). */
  critters: MapCritter[];
  /** Where a fresh character spawns. */
  playerSpawn: { x: number; z: number };
  /** Flat shelves levelled into the terrain (arenas, town pad). */
  flats: MapFlat[];
  /** Place the existing Oathhold town as a unit, or null to omit it. */
  village: { x: number; z: number; rot: number } | null;
  /** Optional decorative seed (unused by gameplay; reserved). */
  seed?: number;
}

// ── Height packing (compact, exact-to-the-centimetre) ────────────────────────

/** Pack a row-major height grid into a base64 Int16 (cm) string. */
export function packHeights(heights: ArrayLike<number>): string {
  const n = heights.length;
  const ints = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    // Clamp to the Int16 cm range (±327 m) — far beyond any sane terrain.
    const cm = Math.round(heights[i] * 100);
    ints[i] = cm < -32768 ? -32768 : cm > 32767 ? 32767 : cm;
  }
  const bytes = new Uint8Array(ints.buffer);
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return base64Encode(bin);
}

/** Unpack a base64 Int16-cm string back into a Float32Array of metres. */
export function unpackHeightsPacked(packed: string): Float32Array {
  const bin = base64Decode(packed);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const ints = new Int16Array(bytes.buffer);
  const out = new Float32Array(ints.length);
  for (let i = 0; i < ints.length; i++) out[i] = ints[i] / 100;
  return out;
}

/** Read a map's heights regardless of which representation it used. */
export function unpackHeights(map: OathboundMap): Float32Array {
  if (map.heightsPacked) return unpackHeightsPacked(map.heightsPacked);
  if (map.heights) return Float32Array.from(map.heights);
  return new Float32Array(map.res * map.res);
}

// ── Painted water (per-cell surface height, parallel to the height grid) ─────────
//
// A row-major grid (same res as heights) of water *surface* heights in metres; a cell whose
// value is NaN has no water. Packed like heights but reserving the minimum Int16 as a "dry"
// sentinel. Use unpackWater() to read (null = the map has no painted water).

const WATER_DRY_CM = -32768; // packed sentinel meaning "no water here"

/** Pack a row-major water-level grid (NaN = dry) into a base64 Int16-cm string. */
export function packWater(levels: ArrayLike<number>): string {
  const n = levels.length;
  const ints = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const v = levels[i];
    if (!Number.isFinite(v)) { ints[i] = WATER_DRY_CM; continue; }
    const cm = Math.round(v * 100);
    // Keep WATER_DRY_CM reserved; clamp real levels to just inside the Int16 cm range.
    ints[i] = cm <= -32767 ? -32767 : cm > 32767 ? 32767 : cm;
  }
  const bytes = new Uint8Array(ints.buffer);
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return base64Encode(bin);
}

/** Unpack a base64 Int16-cm water string into a Float32Array of metres (NaN where dry). */
export function unpackWaterPacked(packed: string): Float32Array {
  const bin = base64Decode(packed);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const ints = new Int16Array(bytes.buffer);
  const out = new Float32Array(ints.length);
  for (let i = 0; i < ints.length; i++) out[i] = ints[i] === WATER_DRY_CM ? NaN : ints[i] / 100;
  return out;
}

/** A map's painted water grid (NaN = dry cells), or null if it has none. */
export function unpackWater(map: OathboundMap): Float32Array | null {
  return map.waterPacked ? unpackWaterPacked(map.waterPacked) : null;
}

/** True if a water-level grid has at least one wet (finite) cell. */
export function hasWater(levels: ArrayLike<number>): boolean {
  for (let i = 0; i < levels.length; i++) if (Number.isFinite(levels[i])) return true;
  return false;
}

/**
 * Build a water-surface geometry from a painted water grid. Each grid cell (between four
 * samples) gets a quad at its painted level — but only where the water sits *above* the
 * terrain, so it fills basins/gorges up to the level and hides where the ground pokes
 * through. Pure (no three): returns triangle data the renderer wraps in a BufferGeometry.
 */
export function waterSurfaceGeometry(
  water: ArrayLike<number>,
  heights: ArrayLike<number>,
  res: number,
  size: number,
): { positions: Float32Array; indices: number[] } {
  const half = size / 2;
  const cell = size / (res - 1);
  const pos: number[] = [];
  const indices: number[] = [];
  const EPS = 0.02;
  for (let z = 0; z < res - 1; z++) {
    for (let x = 0; x < res - 1; x++) {
      const i00 = z * res + x, i10 = i00 + 1, i01 = i00 + res, i11 = i01 + 1;
      const w00 = water[i00], w10 = water[i10], w01 = water[i01], w11 = water[i11];
      let sum = 0, cnt = 0;
      if (Number.isFinite(w00)) { sum += w00; cnt++; }
      if (Number.isFinite(w10)) { sum += w10; cnt++; }
      if (Number.isFinite(w01)) { sum += w01; cnt++; }
      if (Number.isFinite(w11)) { sum += w11; cnt++; }
      if (cnt === 0) continue; // no water touches this cell
      const avg = sum / cnt;
      const l00 = Number.isFinite(w00) ? w00 : avg;
      const l10 = Number.isFinite(w10) ? w10 : avg;
      const l01 = Number.isFinite(w01) ? w01 : avg;
      const l11 = Number.isFinite(w11) ? w11 : avg;
      // Skip cells where the water is at/below the ground on all corners (nothing to show).
      if (l00 <= heights[i00] + EPS && l10 <= heights[i10] + EPS && l01 <= heights[i01] + EPS && l11 <= heights[i11] + EPS) continue;
      const wx0 = -half + x * cell, wx1 = -half + (x + 1) * cell;
      const wz0 = -half + z * cell, wz1 = -half + (z + 1) * cell;
      const b = pos.length / 3;
      pos.push(wx0, l00, wz0, wx1, l10, wz0, wx0, l01, wz1, wx1, l11, wz1);
      indices.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    }
  }
  return { positions: Float32Array.from(pos), indices };
}

// base64 that works in both the browser (btoa/atob) and Node (Buffer), so the
// format module is usable from the game's tests too.
function base64Encode(bin: string): string {
  if (typeof btoa === 'function') return btoa(bin);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (globalThis as any).Buffer.from(bin, 'binary').toString('base64');
}
function base64Decode(b64: string): string {
  if (typeof atob === 'function') return atob(b64);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (globalThis as any).Buffer.from(b64, 'base64').toString('binary');
}

// ── Validation / normalisation on import ─────────────────────────────────────

/** A blank map of the given size/resolution (flat terrain, greenmarch biome). */
export function blankMap(name: string, size: number, res: number): OathboundMap {
  const cells = res * res;
  return {
    version: MAP_FORMAT_VERSION,
    name,
    size,
    res,
    heights: new Array(cells).fill(0),
    biomes: new Array(cells).fill(0), // greenmarch
    lakes: [],
    rivers: [],
    roads: [],
    assets: [],
    customAssets: [],
    spawns: [],
    bosses: [],
    oathstones: [],
    npcs: [],
    quests: [],
    critters: [],
    playerSpawn: { x: 0, z: 0 },
    flats: [],
    village: null,
  };
}

/**
 * Coerce an unknown parsed object into a valid OathboundMap, filling defaults for
 * any missing fields so older/partial exports still load. Throws only if the core
 * terrain shape is unusable.
 */
export function normalizeMap(raw: unknown): OathboundMap {
  if (!raw || typeof raw !== 'object') throw new Error('Not a map object');
  const m = raw as Partial<OathboundMap>;
  const size = num(m.size, 680);
  const res = Math.max(2, Math.floor(num(m.res, 257)));
  const cells = res * res;

  let heights: number[] | undefined = Array.isArray(m.heights) ? m.heights.map((h) => num(h, 0)) : undefined;
  if (!heights && !m.heightsPacked) heights = new Array(cells).fill(0);

  let biomes = Array.isArray(m.biomes) ? m.biomes.map((b) => Math.max(0, Math.floor(num(b, 0)))) : [];
  if (biomes.length !== cells) {
    const filled = new Array(cells).fill(0);
    for (let i = 0; i < Math.min(cells, biomes.length); i++) filled[i] = biomes[i];
    biomes = filled;
  }

  return {
    version: num(m.version, MAP_FORMAT_VERSION),
    name: typeof m.name === 'string' ? m.name : 'Untitled Map',
    size,
    res,
    heights,
    heightsPacked: typeof m.heightsPacked === 'string' ? m.heightsPacked : undefined,
    biomes,
    waterPacked: typeof m.waterPacked === 'string' ? m.waterPacked : undefined,
    lakes: arr(m.lakes),
    rivers: arr(m.rivers),
    roads: arr(m.roads),
    assets: arr(m.assets),
    customAssets: arr(m.customAssets),
    spawns: arr(m.spawns),
    bosses: arr(m.bosses),
    oathstones: arr(m.oathstones),
    npcs: ensureNpcIds(arr<MapNpc>(m.npcs)),
    quests: arr(m.quests),
    critters: arr(m.critters),
    playerSpawn: m.playerSpawn && typeof m.playerSpawn === 'object'
      ? { x: num(m.playerSpawn.x, 0), z: num(m.playerSpawn.z, 0) }
      : { x: 0, z: 0 },
    flats: arr(m.flats),
    village: m.village && typeof m.village === 'object'
      ? { x: num(m.village.x, 0), z: num(m.village.z, 0), rot: num(m.village.rot, 0) }
      : null,
    seed: typeof m.seed === 'number' ? m.seed : undefined,
  };
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}
function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

/** Backfill stable ids onto NPCs that don't have one (quests reference them by id). */
function ensureNpcIds(npcs: MapNpc[]): MapNpc[] {
  const used = new Set(npcs.map((n) => n.id).filter(Boolean) as string[]);
  let counter = 1;
  for (const n of npcs) {
    if (!n.id) {
      let id = `npc-${counter++}`;
      while (used.has(id)) id = `npc-${counter++}`;
      n.id = id;
      used.add(id);
    }
  }
  return npcs;
}

/** Generate a fresh unique NPC id given the existing NPCs. */
export function nextNpcId(npcs: MapNpc[]): string {
  const used = new Set(npcs.map((n) => n.id).filter(Boolean) as string[]);
  let counter = 1;
  let id = `npc-${counter}`;
  while (used.has(id)) id = `npc-${++counter}`;
  return id;
}

/** Serialize a map for export — packs heights and drops the bulky plain array. */
export function serializeMap(map: OathboundMap, heights: ArrayLike<number>): string {
  const out: OathboundMap = {
    ...map,
    heights: undefined,
    heightsPacked: packHeights(heights),
  };
  return JSON.stringify(out);
}
