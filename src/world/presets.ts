// Pre-made asset library (pure data, no three.js) — built from the same primitive parts
// the Asset Builder produces, so they render via the shared custom-asset geometry path in
// both the editor and the game. Placed by id "preset:<id>"; resolved against this list in
// both repos (mirrored from the Admin Tools repo's src/format/presets.ts). Add more freely.

import type { AssetDef, AssetPart, AssetCategory, PrimitiveShape } from './map-format';

type V3 = [number, number, number];
const part = (shape: PrimitiveShape, color: number, dims: V3, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0]): AssetPart =>
  ({ shape, color, dims, pos, rot, flat: true });
const box = (color: number, w: number, h: number, d: number, x = 0, y = 0, z = 0, ry = 0): AssetPart =>
  part('box', color, [w, h, d], [x, y, z], [0, ry, 0]);
const cyl = (color: number, rt: number, rb: number, h: number, x = 0, y = 0, z = 0): AssetPart =>
  part('cylinder', color, [rt, rb, h], [x, y, z]);
const cone = (color: number, r: number, h: number, x = 0, y = 0, z = 0, rx = 0, rz = 0): AssetPart =>
  part('cone', color, [r, h, 0], [x, y, z], [rx, 0, rz]);
const sph = (color: number, r: number, x = 0, y = 0, z = 0): AssetPart => part('sphere', color, [r, 0, 0], [x, y, z]);
const ico = (color: number, r: number, detail: number, x = 0, y = 0, z = 0): AssetPart =>
  part('icosahedron', color, [r, detail, 0], [x, y, z]);

const def = (
  id: string,
  name: string,
  category: AssetCategory,
  parts: AssetPart[],
  collider: number | null = null,
  boxC: { hw: number; hd: number } | null = null,
): AssetDef => ({ id, name, category, parts, collider, box: boxC });

// Palette.
const PLASTER = 0xd8cba6;
const PLASTER2 = 0xcdb78c;
const STONE = 0x9a948a;
const STONE_DK = 0x7d7870;
const WOOD = 0x6e4a2e;
const WOOD_DK = 0x4f3622;
const WOOD_LT = 0x8a6a45;
const ROOF_RED = 0x9c4631;
const ROOF_SLATE = 0x5b5566;
const THATCH = 0xb5965a;
const DOOR = 0x5a3b22;
const WINDOW = 0x7fb0c0;
const PLASTER_W = 0xe8e2d2;
const ROOF_BLUE = 0x4a5a78;
const ROOF_GREEN = 0x47683f;
const ROOF_DARK = 0x39343f;
const BARN_RED = 0x8c4030;

function merlons(y: number, half: number, color: number): AssetPart[] {
  const xs = [-half + 0.4, -half * 0.34, half * 0.34, half - 0.4];
  return xs.map((x) => box(color, 0.55, 0.5, 0.95, x, y, 0));
}

export const PRESET_ASSETS: AssetDef[] = [
  // ── Buildings ──────────────────────────────────────────────────────────────
  def('house-small', 'Small House', 'structure', [
    box(PLASTER, 3.2, 2.0, 2.6, 0, 1.0, 0),
    cone(ROOF_RED, 2.5, 1.5, 0, 2.75, 0),
    box(DOOR, 0.8, 1.3, 0.14, 0, 0.65, 1.3),
    box(WINDOW, 0.55, 0.55, 0.14, -1.0, 1.25, 1.3),
    box(WINDOW, 0.55, 0.55, 0.14, 1.0, 1.25, 1.3),
  ], null, { hw: 1.6, hd: 1.3 }),
  def('cottage', 'Cottage', 'structure', [
    box(PLASTER2, 2.6, 1.7, 2.2, 0, 0.85, 0),
    cone(THATCH, 2.2, 1.4, 0, 2.05, 0),
    box(DOOR, 0.7, 1.1, 0.14, 0, 0.55, 1.1),
    cyl(STONE_DK, 0.18, 0.2, 1.1, 0.9, 1.95, -0.4),
  ], null, { hw: 1.3, hd: 1.1 }),
  def('house-tall', 'Two-Story House', 'structure', [
    box(PLASTER, 3.0, 3.6, 2.8, 0, 1.8, 0),
    box(WOOD, 3.05, 0.25, 2.85, 0, 1.95, 0), // floor band
    cone(ROOF_RED, 2.7, 1.8, 0, 4.5, 0),
    box(DOOR, 0.8, 1.3, 0.14, 0, 0.65, 1.4),
    box(WINDOW, 0.55, 0.55, 0.14, -1.0, 1.2, 1.4),
    box(WINDOW, 0.55, 0.55, 0.14, 1.0, 1.2, 1.4),
    box(WINDOW, 0.55, 0.55, 0.14, -1.0, 2.9, 1.4),
    box(WINDOW, 0.55, 0.55, 0.14, 1.0, 2.9, 1.4),
  ], null, { hw: 1.5, hd: 1.4 }),
  def('longhouse', 'Longhouse', 'structure', [
    box(WOOD, 6.0, 2.2, 3.2, 0, 1.1, 0),
    cone(THATCH, 3.6, 1.8, -1.4, 2.5, 0),
    cone(THATCH, 3.6, 1.8, 1.4, 2.5, 0),
    box(DOOR, 0.9, 1.4, 0.14, 0, 0.7, 1.6),
  ], null, { hw: 3.0, hd: 1.6 }),
  def('house-blue', 'Blue-Roof House', 'structure', [
    box(PLASTER_W, 3.0, 2.1, 2.6, 0, 1.05, 0),
    cone(ROOF_BLUE, 2.45, 1.5, 0, 2.85, 0),
    box(DOOR, 0.8, 1.3, 0.14, 0, 0.65, 1.3),
    box(WINDOW, 0.55, 0.55, 0.14, -1.0, 1.3, 1.3),
    box(WINDOW, 0.55, 0.55, 0.14, 1.0, 1.3, 1.3),
    cyl(STONE_DK, 0.16, 0.18, 1.0, 1.0, 2.5, -0.5),
  ], null, { hw: 1.5, hd: 1.3 }),
  def('house-green', 'Green-Roof House', 'structure', [
    box(PLASTER2, 2.8, 2.0, 2.4, 0, 1.0, 0),
    cone(ROOF_GREEN, 2.35, 1.4, 0, 2.7, 0),
    box(DOOR, 0.75, 1.2, 0.14, 0.4, 0.6, 1.2),
    box(WINDOW, 0.5, 0.5, 0.14, -0.7, 1.2, 1.2),
  ], null, { hw: 1.4, hd: 1.2 }),
  def('house-stone', 'Stone House', 'structure', [
    box(STONE, 3.0, 2.2, 2.6, 0, 1.1, 0),
    cone(ROOF_DARK, 2.5, 1.4, 0, 2.9, 0),
    box(DOOR, 0.8, 1.3, 0.14, 0, 0.65, 1.3),
    box(WINDOW, 0.5, 0.6, 0.14, -1.0, 1.3, 1.3),
    box(WINDOW, 0.5, 0.6, 0.14, 1.0, 1.3, 1.3),
  ], null, { hw: 1.5, hd: 1.3 }),
  def('townhouse', 'Townhouse', 'structure', [
    box(PLASTER_W, 2.4, 4.2, 2.4, 0, 2.1, 0),
    box(WOOD, 2.45, 0.2, 2.45, 0, 1.5, 0),
    box(WOOD, 2.45, 0.2, 2.45, 0, 2.9, 0),
    cone(ROOF_RED, 2.1, 1.5, 0, 4.95, 0),
    box(DOOR, 0.7, 1.3, 0.14, 0, 0.65, 1.2),
    box(WINDOW, 0.45, 0.5, 0.14, 0, 1.9, 1.2),
    box(WINDOW, 0.45, 0.5, 0.14, 0, 3.3, 1.2),
  ], null, { hw: 1.2, hd: 1.2 }),
  def('manor', 'Manor House', 'structure', [
    box(PLASTER_W, 5.2, 2.6, 3.6, 0, 1.3, 0),
    box(PLASTER_W, 2.2, 3.4, 3.0, 0, 1.7, 0.3),
    cone(ROOF_SLATE, 4.2, 1.7, 0, 3.5, 0),
    cone(ROOF_SLATE, 2.2, 1.2, 0, 4.0, 0.3),
    box(DOOR, 1.0, 1.6, 0.16, 0, 0.8, 1.85),
    box(WINDOW, 0.55, 0.6, 0.14, -1.6, 1.4, 1.82),
    box(WINDOW, 0.55, 0.6, 0.14, 1.6, 1.4, 1.82),
    box(WINDOW, 0.55, 0.6, 0.14, -2.2, 1.4, 0),
  ], null, { hw: 2.6, hd: 1.8 }),
  def('inn', 'Inn / Tavern', 'structure', [
    box(PLASTER2, 4.0, 4.0, 3.2, 0, 2.0, 0),
    box(WOOD, 4.05, 0.22, 3.25, 0, 2.0, 0),
    cone(ROOF_RED, 3.3, 1.8, 0, 4.9, 0),
    box(DOOR, 0.9, 1.5, 0.16, 0, 0.75, 1.6),
    box(WINDOW, 0.5, 0.55, 0.14, -1.2, 1.3, 1.6),
    box(WINDOW, 0.5, 0.55, 0.14, 1.2, 1.3, 1.6),
    box(WINDOW, 0.5, 0.55, 0.14, -1.2, 3.0, 1.6),
    box(WINDOW, 0.5, 0.55, 0.14, 1.2, 3.0, 1.6),
    box(WOOD_DK, 0.1, 0.1, 0.9, 2.0, 2.6, 1.7),
    box(WOOD_LT, 0.08, 0.7, 0.7, 2.0, 2.2, 2.1),
  ], null, { hw: 2.0, hd: 1.6 }),
  def('barn', 'Barn', 'structure', [
    box(BARN_RED, 4.4, 3.0, 5.2, 0, 1.5, 0),
    cone(ROOF_DARK, 3.6, 1.8, 0, 3.6, 0),
    box(WOOD_DK, 1.8, 2.2, 0.16, 0, 1.1, 2.62),
    box(WOOD_LT, 0.12, 2.2, 0.16, 0, 1.1, 2.66),
    box(WINDOW, 0.6, 0.7, 0.14, 0, 2.6, 2.6),
  ], null, { hw: 2.2, hd: 2.6 }),
  def('chapel', 'Chapel', 'structure', [
    box(PLASTER_W, 2.8, 2.6, 4.0, 0, 1.3, 0),
    cone(ROOF_SLATE, 2.6, 1.4, 0, 3.3, 0),
    box(STONE, 1.4, 4.2, 1.4, 0, 2.1, -2.2),
    cone(ROOF_SLATE, 1.3, 1.6, 0, 4.9, -2.2),
    box(0xe9e2cf, 0.16, 0.7, 0.16, 0, 5.9, -2.2),
    box(0xe9e2cf, 0.5, 0.16, 0.16, 0, 5.95, -2.2),
    box(DOOR, 0.8, 1.5, 0.16, 0, 0.75, -2.92),
    box(WINDOW, 0.4, 1.0, 0.14, -1.0, 1.4, 2.02),
    box(WINDOW, 0.4, 1.0, 0.14, 1.0, 1.4, 2.02),
  ], null, { hw: 1.4, hd: 2.0 }),
  def('windmill', 'Windmill', 'structure', [
    cyl(PLASTER_W, 1.3, 1.7, 5.0, 0, 2.5, 0),
    cone(ROOF_DARK, 1.7, 1.4, 0, 5.7, 0),
    box(DOOR, 0.8, 1.4, 0.2, 0, 0.7, 1.6),
    box(WOOD, 0.18, 5.2, 0.12, 0, 4.4, 1.75),
    box(WOOD, 5.2, 0.18, 0.12, 0, 4.4, 1.75),
    box(0xd8cba6, 0.7, 2.0, 0.04, 0, 5.4, 1.78),
    box(0xd8cba6, 0.7, 2.0, 0.04, 0, 3.4, 1.78),
    box(0xd8cba6, 2.0, 0.7, 0.04, 1.4, 4.4, 1.78),
    box(0xd8cba6, 2.0, 0.7, 0.04, -1.4, 4.4, 1.78),
  ], 1.6),
  def('hut', 'Round Hut', 'structure', [
    cyl(0x8a6f4e, 1.5, 1.6, 1.6, 0, 0.8, 0),
    cone(THATCH, 1.9, 1.6, 0, 2.0, 0),
    box(DOOR, 0.7, 1.1, 0.14, 0, 0.55, 1.5),
  ], 1.5),
  def('smithy', 'Blacksmith', 'structure', [
    box(STONE, 3.2, 2.4, 2.8, 0, 1.2, 0),
    cone(ROOF_DARK, 2.7, 1.3, 0, 3.05, 0),
    cyl(STONE_DK, 0.35, 0.4, 2.2, 1.1, 2.4, -0.9),
    box(0xff7a1e, 0.5, 0.4, 0.5, 1.1, 0.5, 1.3),
    box(DOOR, 1.4, 1.6, 0.16, -0.4, 0.8, 1.42),
    box(WOOD, 1.0, 0.2, 0.8, -0.4, 0.9, 1.9),
  ], null, { hw: 1.6, hd: 1.4 }),
  def('shop', 'Shop', 'structure', [
    box(PLASTER2, 3.0, 2.4, 2.6, 0, 1.2, 0),
    cone(ROOF_GREEN, 2.5, 1.3, 0, 3.05, 0),
    box(DOOR, 0.8, 1.4, 0.14, -0.8, 0.7, 1.3),
    box(0x101418, 1.2, 1.0, 0.1, 0.7, 1.3, 1.31),
    box(0xb5462f, 1.5, 0.12, 0.9, 0.7, 1.95, 1.7),
    box(WOOD_DK, 0.1, 0.1, 0.9, 0.0, 1.95, 1.7),
    box(WOOD_DK, 0.1, 0.1, 0.9, 1.4, 1.95, 1.7),
    box(WOOD_LT, 0.9, 0.4, 0.08, 0.7, 2.25, 1.32),
  ], null, { hw: 1.5, hd: 1.3 }),
  def('storehouse', 'Storehouse', 'structure', [
    box(STONE, 4.5, 2.4, 3.0, 0, 1.2, 0),
    box(STONE_DK, 4.6, 0.4, 3.1, 0, 2.4, 0),
    box(WOOD_DK, 1.6, 1.8, 0.16, 0, 0.9, 1.52),
    box(WOOD_LT, 0.12, 1.8, 0.16, 0, 0.9, 1.56),
  ], null, { hw: 2.25, hd: 1.5 }),
  def('guardhouse', 'Guard House', 'structure', [
    box(STONE, 2.6, 2.6, 2.6, 0, 1.3, 0),
    box(STONE_DK, 2.9, 0.4, 2.9, 0, 2.6, 0),
    ...[-0.95, 0, 0.95].flatMap((x) => [
      box(STONE_DK, 0.5, 0.5, 0.5, x, 3.0, -0.95),
      box(STONE_DK, 0.5, 0.5, 0.5, x, 3.0, 0.95),
    ]),
    box(DOOR, 0.8, 1.4, 0.16, 0, 0.7, 1.32),
  ], null, { hw: 1.3, hd: 1.3 }),
  def('fountain', 'Town Fountain', 'structure', [
    cyl(STONE, 1.8, 1.9, 0.6, 0, 0.3, 0),
    cyl(0x356f96, 1.6, 1.6, 0.1, 0, 0.55, 0),
    cyl(STONE_DK, 0.35, 0.4, 1.4, 0, 0.9, 0),
    sph(0x8fd0e8, 0.35, 0, 1.7, 0),
  ], 1.9),

  // ── Towers ───────────────────────────────────────────────────────────────-
  def('tower-round', 'Round Tower', 'structure', [
    cyl(STONE, 1.4, 1.6, 6.0, 0, 3.0, 0),
    cyl(STONE_DK, 1.75, 1.75, 0.6, 0, 6.0, 0),
    cone(ROOF_SLATE, 1.95, 2.2, 0, 7.4, 0),
    box(DOOR, 0.8, 1.4, 0.2, 0, 0.7, 1.55),
  ], 1.7),
  def('tower-square', 'Square Tower', 'structure', [
    box(STONE, 2.4, 6.0, 2.4, 0, 3.0, 0),
    box(STONE_DK, 2.8, 0.7, 2.8, 0, 6.0, 0),
    box(STONE_DK, 0.5, 0.6, 0.5, -1.05, 6.6, -1.05),
    box(STONE_DK, 0.5, 0.6, 0.5, 1.05, 6.6, -1.05),
    box(STONE_DK, 0.5, 0.6, 0.5, -1.05, 6.6, 1.05),
    box(STONE_DK, 0.5, 0.6, 0.5, 1.05, 6.6, 1.05),
    box(DOOR, 0.8, 1.4, 0.2, 0, 0.7, 1.25),
  ], null, { hw: 1.2, hd: 1.2 }),
  def('watchtower', 'Wooden Watchtower', 'structure', [
    cyl(WOOD_DK, 0.13, 0.17, 3.6, -0.95, 1.8, -0.95),
    cyl(WOOD_DK, 0.13, 0.17, 3.6, 0.95, 1.8, -0.95),
    cyl(WOOD_DK, 0.13, 0.17, 3.6, -0.95, 1.8, 0.95),
    cyl(WOOD_DK, 0.13, 0.17, 3.6, 0.95, 1.8, 0.95),
    box(WOOD, 2.4, 0.3, 2.4, 0, 3.6, 0),
    box(WOOD, 2.4, 0.6, 0.12, 0, 4.0, 1.15),
    box(WOOD, 2.4, 0.6, 0.12, 0, 4.0, -1.15),
    cone(ROOF_RED, 1.95, 1.3, 0, 4.95, 0),
  ], 1.1),
  def('wall-tower', 'Wall Tower', 'structure', [
    cyl(STONE, 1.0, 1.1, 2.8, 0, 1.4, 0),
    cyl(STONE_DK, 1.25, 1.25, 0.5, 0, 2.8, 0),
    ...[-0.85, 0, 0.85].flatMap((a) => [box(STONE_DK, 0.4, 0.5, 0.4, Math.cos(a) * 0.95, 3.1, Math.sin(a) * 0.95)]),
  ], 1.15),

  // ── Walls & fortifications ───────────────────────────────────────────────-
  def('wall-straight', 'Stone Wall', 'structure', [
    box(STONE, 6.0, 2.2, 0.7, 0, 1.1, 0),
    box(STONE_DK, 6.0, 0.3, 0.95, 0, 2.2, 0),
    ...merlons(2.5, 3.0, STONE_DK),
  ], null, { hw: 3.0, hd: 0.45 }),
  def('wall-low', 'Low Wall', 'structure', [
    box(STONE, 5.0, 1.0, 0.6, 0, 0.5, 0),
    box(STONE_DK, 5.0, 0.2, 0.8, 0, 1.0, 0),
  ], null, { hw: 2.5, hd: 0.4 }),
  def('gate', 'Gatehouse Arch', 'structure', [
    box(STONE, 0.9, 3.2, 1.0, -1.7, 1.6, 0),
    box(STONE, 0.9, 3.2, 1.0, 1.7, 1.6, 0),
    box(STONE, 4.4, 0.9, 1.0, 0, 3.4, 0),
    box(STONE_DK, 4.6, 0.4, 1.2, 0, 4.0, 0),
  ]),
  def('fence', 'Wooden Fence', 'structure', [
    box(WOOD, 0.14, 0.95, 0.14, -1.4, 0.47, 0),
    box(WOOD, 0.14, 0.95, 0.14, 1.4, 0.47, 0),
    box(WOOD_LT, 3.0, 0.12, 0.1, 0, 0.7, 0),
    box(WOOD_LT, 3.0, 0.12, 0.1, 0, 0.35, 0),
  ], null, { hw: 1.5, hd: 0.12 }),
  def('palisade', 'Palisade', 'structure', [
    ...[-1.6, -0.8, 0, 0.8, 1.6].flatMap((x) => [cyl(WOOD, 0.22, 0.24, 2.4, x, 1.2, 0), cone(WOOD_DK, 0.24, 0.3, x, 2.45, 0)]),
    box(WOOD_DK, 3.4, 0.18, 0.16, 0, 1.7, 0.18),
  ], null, { hw: 1.7, hd: 0.22 }),

  // ── Town props ───────────────────────────────────────────────────────────-
  def('well', 'Stone Well', 'structure', [
    cyl(STONE, 0.95, 1.05, 1.0, 0, 0.5, 0),
    cyl(0x356f96, 0.8, 0.8, 0.06, 0, 0.95, 0),
    cyl(WOOD, 0.12, 0.12, 1.5, -0.8, 1.25, 0),
    cyl(WOOD, 0.12, 0.12, 1.5, 0.8, 1.25, 0),
    box(ROOF_RED, 2.1, 0.2, 1.3, 0, 2.05, 0),
  ], 1.0),
  def('market-stall', 'Market Stall', 'structure', [
    cyl(WOOD, 0.08, 0.1, 2.0, -1.0, 1.0, -0.7),
    cyl(WOOD, 0.08, 0.1, 2.0, 1.0, 1.0, -0.7),
    cyl(WOOD, 0.08, 0.1, 2.0, -1.0, 1.0, 0.7),
    cyl(WOOD, 0.08, 0.1, 2.0, 1.0, 1.0, 0.7),
    box(0xb5462f, 2.4, 0.18, 1.8, 0, 2.05, 0),
    box(WOOD_LT, 2.2, 0.8, 0.5, 0, 0.4, 0.7),
  ], 1.1),
  def('tent', 'Tent', 'structure', [
    cone(0xb89a6a, 1.7, 2.2, 0, 1.1, 0),
    box(WOOD_DK, 0.7, 1.0, 0.06, 0, 0.5, 1.45),
  ], 1.2),
  def('signpost', 'Signpost', 'misc', [
    cyl(WOOD, 0.08, 0.1, 1.8, 0, 0.9, 0),
    box(WOOD_LT, 0.95, 0.42, 0.08, 0.28, 1.5, 0),
  ]),
  def('lamp-post', 'Lamp Post', 'misc', [
    cyl(0x3a3a40, 0.08, 0.1, 2.6, 0, 1.3, 0),
    box(0xffe0a0, 0.32, 0.42, 0.32, 0, 2.65, 0),
    cone(0x2a2a30, 0.26, 0.3, 0, 2.95, 0),
  ]),
  def('crate', 'Crate', 'misc', [
    box(0x8a5a32, 0.9, 0.9, 0.9, 0, 0.45, 0),
    box(WOOD_DK, 0.96, 0.12, 0.96, 0, 0.9, 0),
    box(WOOD_DK, 0.96, 0.12, 0.96, 0, 0.02, 0),
  ], 0.6),
  def('barrel', 'Barrel', 'misc', [
    cyl(0x7a5230, 0.42, 0.5, 1.0, 0, 0.5, 0),
    cyl(0x4a3420, 0.52, 0.52, 0.12, 0, 0.3, 0),
    cyl(0x4a3420, 0.52, 0.52, 0.12, 0, 0.7, 0),
    cyl(0x5a3f26, 0.42, 0.42, 0.06, 0, 1.0, 0),
  ], 0.52),
  def('campfire', 'Campfire', 'misc', [
    ...[0, 1.25, 2.5, 3.75, 5.0].map((a) => ico(0x6f6a63, 0.22, 0, Math.cos(a) * 0.55, 0.15, Math.sin(a) * 0.55)),
    part('cylinder', 0x5a4327, [0.09, 0.11, 0.95], [0, 0.18, 0], [0, 0, 1.4]),
    part('cylinder', 0x5a4327, [0.08, 0.1, 0.95], [0, 0.2, 0], [1.4, 0.6, 0]),
    cone(0xff7a1e, 0.35, 0.85, 0, 0.55, 0),
  ]),

  // ── Ruins ────────────────────────────────────────────────────────────────-
  def('ruined-pillar', 'Ruined Pillar', 'structure', [
    cyl(STONE, 0.45, 0.55, 2.2, 0, 1.1, 0),
    box(STONE, 0.7, 0.4, 0.7, 0.1, 2.3, 0, 0.4),
  ], 0.55),
  def('ruined-wall', 'Ruined Wall', 'structure', [
    box(0x8e887e, 3.0, 1.5, 0.7, 0, 0.75, 0),
    box(0x8e887e, 1.0, 0.9, 0.7, -1.0, 1.95, 0),
    box(0x837d73, 0.7, 0.5, 0.72, 1.2, 1.45, 0),
  ], null, { hw: 1.5, hd: 0.35 }),

  // ── Trees & nature ─────────────────────────────────────────────────────────
  def('pine-tall', 'Tall Pine', 'tree', [
    cyl(0x5a4632, 0.1, 0.17, 2.0, 0, 1.0, 0),
    cone(0x2f5640, 0.95, 1.6, 0, 1.9, 0),
    cone(0x346450, 0.72, 1.5, 0, 2.85, 0),
    cone(0x3f7058, 0.5, 1.3, 0, 3.7, 0),
  ]),
  def('pine-snowy', 'Snowy Pine', 'tree', [
    cyl(0x5a4632, 0.1, 0.17, 1.9, 0, 0.95, 0),
    cone(0x2f5640, 0.9, 1.5, 0, 1.8, 0),
    cone(0xeef3f8, 0.7, 0.5, 0, 2.45, 0),
    cone(0x346450, 0.68, 1.3, 0, 2.7, 0),
    cone(0xeef3f8, 0.46, 0.45, 0, 3.3, 0),
  ]),
  def('tree-autumn', 'Autumn Tree', 'tree', [
    cyl(0x5b4329, 0.13, 0.22, 1.6, 0, 0.8, 0),
    ico(0xc8742a, 1.05, 0, 0, 2.1, 0),
    ico(0xd98f3a, 0.7, 0, 0.5, 2.4, 0.2),
    ico(0xb35e22, 0.66, 0, -0.45, 2.3, -0.3),
  ]),
  def('tree-dead-large', 'Dead Tree', 'tree', [
    cyl(0x4a423a, 0.16, 0.24, 2.7, 0, 1.35, 0),
    part('cylinder', 0x443c34, [0.06, 0.1, 1.2], [0.4, 2.4, 0], [0, 0, 0.8]),
    part('cylinder', 0x443c34, [0.05, 0.09, 1.1], [-0.4, 2.5, 0.1], [0, 0, -0.7]),
    part('cylinder', 0x443c34, [0.05, 0.09, 1.0], [0.35, 2.7, -0.2], [0.6, 0, 0.6]),
  ]),
  def('tree-stump', 'Tree Stump', 'plant', [
    cyl(0x5b4329, 0.4, 0.46, 0.7, 0, 0.35, 0),
    ico(0x6b5236, 0.42, 0, 0, 0.72, 0),
  ]),
  def('rock-spire', 'Rock Spire', 'rock', [
    ico(0x8a8a92, 1.0, 0, 0, 0.8, 0),
    ico(0x80808a, 0.7, 0, 0.12, 2.0, 0),
    ico(0x9aa0aa, 0.45, 0, -0.1, 3.0, 0),
  ], 1.0),
  def('boulder-cluster', 'Boulder Cluster', 'rock', [
    ico(0x80858f, 1.0, 0, -0.6, 0.5, -0.3),
    ico(0x8a8f99, 0.7, 0, 0.7, 0.4, 0.4),
    ico(0x767b85, 0.55, 0, 0.1, 0.35, -0.8),
  ], 1.3),
  def('crystal-cluster', 'Crystal Cluster', 'rock', [
    part('cone', 0x6fd3e0, [0.24, 1.3, 0], [0, 0.65, 0], [0, 0, 0]),
    part('cone', 0x8ae3ee, [0.16, 0.9, 0], [0.32, 0.45, 0.1], [0, 0, 0.4]),
    part('cone', 0x57b6cf, [0.18, 1.0, 0], [-0.3, 0.5, -0.12], [0.3, 0, -0.35]),
    ico(0x4a6a72, 0.4, 0, 0, 0.12, 0),
  ]),
  def('reeds', 'Reed Clump', 'plant', [
    ...[-0.3, -0.1, 0.1, 0.3, 0].map((x, i) => part('cone', 0x6f8a3a, [0.06, 1.1, 0], [x, 0.55, (i - 2) * 0.12], [0.08 * (i - 2), 0, 0.05 * x])),
  ]),
  def('flower-patch', 'Flower Patch', 'plant', [
    ico(0x3c6b34, 0.5, 0, 0, 0.14, 0),
    ...[[0xe0556a, -0.25, 0.18], [0xf2c84a, 0.2, -0.15], [0x9a6fd0, 0.05, 0.25], [0xf2eef0, -0.18, -0.2]].map(
      ([c, x, z]) => sph(c as number, 0.1, x as number, 0.4, z as number),
    ),
  ]),
  def('bush-large', 'Large Bush', 'plant', [
    ico(0x3c6b34, 0.8, 0, 0, 0.6, 0),
    ico(0x42703a, 0.6, 0, 0.55, 0.5, 0.15),
    ico(0x386630, 0.55, 0, -0.5, 0.55, -0.15),
  ]),
];

const BY_ID = new Map(PRESET_ASSETS.map((d) => [d.id, d]));
export function presetById(id: string): AssetDef | undefined {
  return BY_ID.get(id);
}
