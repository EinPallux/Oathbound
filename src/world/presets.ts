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
// City / grand-building palette (Stormwind-ish stonework, blue slate, gold trim, banners).
const STONE_LT = 0xb2ab9c;
const STORM_BLUE = 0x3f63a0;
const GOLD = 0xc9a94e;
const BANNER_RED = 0x9a2f2f;
const BANNER_BLUE = 0x2f4f9a;
// Blue-Roof Tavern palette (warm lit windows, slate-blue ridge cap, timber, props).
const ROOF_BLUE_DK = 0x39445e;
const WIN_LIT = 0xffcf87, WIN_FRAME = 0x2e2216;
const IRON = 0x24242a;
const MUG_AMBER = 0xd9a441, MUG_FOAM = 0xf2ead2, MUG_HANDLE = 0xb07a2a;
const BARREL = 0x7a5230, BARREL_HOOP = 0x4a3420, CRATE = 0x8a5a32, CRATE_DK = 0x5a3a1e;
const LEAF = 0x4f7a34;
// City buildings voxelised from docs/assets/reference art (Tudor: stone base, half-timber
// upper, warm terracotta tiled roofs, leaded glass, stone chimneys).
const TILE = 0xa5513a, TILE_DK = 0x7f3b2b;      // terracotta roof tiles + ridge/shadow
const TIMBER = 0x6a4630, TIMBER_DK = 0x47301f;  // half-timber frame
const WATTLE = 0xe7dfca;                          // plaster / wattle infill
const CHIM_POT = 0xb0563a;                        // terracotta chimney pot
const LEAD = 0x39423f, LEAD_LIT = 0xf0c079;       // leaded glass / warm-lit window
const PETAL = 0xf1ecdd;                            // white window-box flowers
const FOUNT_WATER = 0x4f9fc9, JET = 0xbfeaf7;     // fountain water + jets
const STEAM = 0xeef2f5;                            // steam / smoke
const HAY = 0xc9a24a;                              // straw / hay
const SIGNBOARD = 0x37271a;                        // hanging sign board

function merlons(y: number, half: number, color: number): AssetPart[] {
  const xs = [-half + 0.4, -half * 0.34, half * 0.34, half - 0.4];
  return xs.map((x) => box(color, 0.55, 0.5, 0.95, x, y, 0));
}

// A realistic pitched gable roof: two tilted slate planes meeting at a ridge running along Z.
// `baseY` = eave height (top of the walls), `rise` = ridge height above the eaves, `cx` shifts
// the whole roof in X (for side wings). Looks far crisper than a pyramid cone on long buildings.
function gableRoof(color: number, width: number, length: number, rise: number, baseY: number, z = 0, cx = 0): AssetPart[] {
  const halfW = width / 2;
  const slope = Math.atan2(rise, halfW);
  const planeLen = Math.hypot(halfW, rise);
  const y = baseY + rise / 2;
  return [
    part('box', color, [planeLen, 0.18, length], [cx - halfW / 2, y, z], [0, 0, slope]),
    part('box', color, [planeLen, 0.18, length], [cx + halfW / 2, y, z], [0, 0, -slope]),
  ];
}

// ── Blue-Roof Tavern helpers (warm lattice windows + a barrel) ────────────────
// A tall lit lattice window on a +Z-facing wall (dark frame + warm glass + mullion cross).
function litWindow(w: number, h: number, x: number, y: number, z: number, depth = 0.12): AssetPart[] {
  return [
    box(WIN_FRAME, w + 0.16, h + 0.16, depth - 0.02, x, y, z - 0.01),
    box(WIN_LIT, w, h, depth, x, y, z),
    box(WIN_FRAME, w + 0.02, 0.06, depth + 0.02, x, y, z + 0.005),
    box(WIN_FRAME, 0.06, h + 0.02, depth + 0.02, x, y, z + 0.005),
  ];
}
// A lit window on an X-facing side wall (thin in X; glass sits slightly proud).
function sideWindow(w: number, h: number, x: number, y: number, z: number, depth = 0.12): AssetPart[] {
  const s = x >= 0 ? 1 : -1;
  return [
    box(WIN_FRAME, depth - 0.02, h + 0.16, w + 0.16, x, y, z),
    box(WIN_LIT, depth, h, w, x + s * 0.03, y, z),
    box(WIN_FRAME, depth + 0.02, 0.06, w + 0.02, x + s * 0.04, y, z),
    box(WIN_FRAME, depth + 0.02, h + 0.02, 0.06, x + s * 0.04, y, z),
  ];
}
// A barrel (body + two hoops + lid).
function barrel(x: number, y0: number, z: number, s = 1): AssetPart[] {
  return [
    cyl(BARREL, 0.4 * s, 0.48 * s, 1.0 * s, x, y0 + 0.5 * s, z),
    cyl(BARREL_HOOP, 0.5 * s, 0.5 * s, 0.12 * s, x, y0 + 0.3 * s, z),
    cyl(BARREL_HOOP, 0.5 * s, 0.5 * s, 0.12 * s, x, y0 + 0.72 * s, z),
    cyl(0x5a3f26, 0.4 * s, 0.4 * s, 0.06 * s, x, y0 + 1.0 * s, z),
  ];
}

// ── City-building helpers (chimney, leaded window, flower box, timber studs) ───
// A stone chimney stack from `baseY` up to `top`, capped with a terracotta pot.
function chimney(x: number, z: number, baseY: number, top: number, pot = CHIM_POT): AssetPart[] {
  const h = top - baseY;
  return [
    box(STONE, 0.92, h, 0.92, x, baseY + h / 2, z),
    box(STONE_DK, 1.02, 0.2, 1.02, x, top - 0.08, z),
    box(pot, 0.34, 0.5, 0.34, x, top + 0.26, z),
  ];
}
// A leaded (latticed) window on the +Z front: dark frame + glass (warm-lit optional) + mullions.
function leadWin(w: number, h: number, x: number, y: number, z: number, lit = false): AssetPart[] {
  return [
    box(TIMBER_DK, w + 0.18, h + 0.18, 0.1, x, y, z - 0.03),
    box(lit ? LEAD_LIT : LEAD, w, h, 0.12, x, y, z),
    box(TIMBER_DK, w + 0.04, 0.06, 0.14, x, y, z + 0.01),
    box(TIMBER_DK, 0.06, h + 0.04, 0.14, x, y, z + 0.01),
  ];
}
// A window flower box on the +Z wall (wood trough + green + white blooms).
function flowerBox(x: number, y: number, z: number): AssetPart[] {
  return [
    box(TIMBER, 0.88, 0.24, 0.28, x, y, z),
    box(LEAF, 0.76, 0.18, 0.22, x, y + 0.2, z),
    box(PETAL, 0.58, 0.1, 0.16, x, y + 0.3, z + 0.02),
  ];
}
// Evenly-spaced vertical half-timber studs across a +Z wall face (the Tudor look), centred on `cx`.
function studs(halfW: number, y: number, h: number, z: number, n = 4, cx = 0): AssetPart[] {
  const out: AssetPart[] = [];
  for (let i = 0; i < n; i++) {
    const x = cx + (n === 1 ? 0 : -halfW + 0.2 + (i / (n - 1)) * (halfW * 2 - 0.4));
    out.push(box(TIMBER, 0.16, h, 0.08, x, y, z));
  }
  return out;
}
// Fill a triangular gable end (front/back face of a gable roof) with stepped plaster so the
// roof reads as a solid house, not an open shell. `halfW` = eave half-width, `rise` = ridge height.
function gableEnd(halfW: number, baseY: number, rise: number, z: number, cx = 0, color = WATTLE): AssetPart[] {
  const steps = 5, out: AssetPart[] = [];
  for (let i = 0; i < steps; i++) {
    const f = i / steps;
    out.push(box(color, halfW * 2 * (1 - f) + 0.1, rise / steps + 0.03, 0.3, cx, baseY + (rise / steps) * (i + 0.5), z));
  }
  return out;
}
// Like gableRoof but with the ridge running along X (for wide buildings whose long side faces
// front). `depth` = the Z span the planes cover, `length` = the X extent (ridge length).
function gableRoofX(color: number, depth: number, length: number, rise: number, baseY: number, cx = 0, z = 0): AssetPart[] {
  const halfD = depth / 2;
  const slope = Math.atan2(rise, halfD);
  const planeLen = Math.hypot(halfD, rise);
  const y = baseY + rise / 2;
  return [
    part('box', color, [length, 0.18, planeLen], [cx, y, z - halfD / 2], [-slope, 0, 0]),
    part('box', color, [length, 0.18, planeLen], [cx, y, z + halfD / 2], [slope, 0, 0]),
  ];
}
// Triangular gable-end fill for an X-ridge roof (faces ±X). `halfD` = eave half-depth.
function gableEndX(halfD: number, baseY: number, rise: number, x: number, cz = 0, color = WATTLE): AssetPart[] {
  const steps = 5, out: AssetPart[] = [];
  for (let i = 0; i < steps; i++) {
    const f = i / steps;
    out.push(box(color, 0.3, rise / steps + 0.03, halfD * 2 * (1 - f) + 0.1, x, baseY + (rise / steps) * (i + 0.5), cz));
  }
  return out;
}
// A small hanging lantern (iron case + warm glow).
function lantern(x: number, y: number, z: number): AssetPart[] {
  return [box(IRON, 0.16, 0.3, 0.16, x, y, z), box(LEAD_LIT, 0.1, 0.18, 0.1, x, y, z + 0.03)];
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
  // A grand two-storey timber-framed tavern with a steep blue-slate roof, glowing lattice
  // windows, a stone chimney, a covered porch (barrels + crate) and a hanging beer-mug sign.
  // (front = +Z; big roof planes face ±X; front gable + attic window face +Z.)
  def('tavern-blueroof', 'Blue-Roof Tavern', 'structure', [
    // Stone ground floor + darker plinth + corner quoins
    box(STONE_DK, 4.8, 0.36, 3.98, 0, 0.18, 0),
    box(STONE, 4.6, 2.1, 3.8, 0, 1.25, 0),
    box(STONE_LT, 0.42, 2.1, 0.42, -2.2, 1.25, 1.8),
    box(STONE_LT, 0.42, 2.1, 0.42, 2.2, 1.25, 1.8),
    // Iron-strapped door + stone surround (jambs, lintel, keystone) + steps
    box(DOOR, 1.0, 1.5, 0.16, 0, 0.85, 1.94),
    box(0x2a211a, 1.04, 0.1, 0.2, 0, 1.2, 2.0),
    box(0x2a211a, 0.1, 1.4, 0.2, 0, 0.85, 2.0),
    sph(0x1c1c22, 0.07, 0.3, 0.9, 2.02),
    box(STONE_DK, 0.24, 1.7, 0.32, -0.62, 0.85, 1.98),
    box(STONE_DK, 0.24, 1.7, 0.32, 0.62, 0.85, 1.98),
    box(STONE_DK, 1.5, 0.34, 0.34, 0, 1.7, 1.98),
    box(STONE_LT, 0.24, 0.36, 0.36, 0, 1.78, 2.0),
    box(STONE, 1.6, 0.34, 0.42, 0, 0.17, 2.12),
    box(STONE, 2.0, 0.2, 0.55, 0, 0.1, 2.42),
    // Ground-floor lit windows (flank the door) + one on the left side, and door lanterns
    ...litWindow(0.55, 0.72, -1.55, 1.3, 1.96),
    ...litWindow(0.55, 0.72, 1.55, 1.3, 1.96),
    ...sideWindow(0.5, 0.66, -2.32, 1.3, -0.4),
    box(IRON, 0.16, 0.34, 0.16, -0.98, 1.55, 2.05),
    box(0xffd27a, 0.1, 0.18, 0.1, -0.98, 1.55, 2.09),
    box(IRON, 0.16, 0.34, 0.16, 0.98, 1.55, 2.05),
    box(0xffd27a, 0.1, 0.18, 0.1, 0.98, 1.55, 2.09),
    // Jettied (overhanging) upper timber floor: joist band + corbels + plaster block
    box(WOOD_DK, 4.96, 0.28, 4.12, 0, 2.28, 0),
    box(WOOD, 0.28, 0.28, 0.6, -1.9, 2.15, 2.05),
    box(WOOD, 0.28, 0.28, 0.6, 0, 2.15, 2.05),
    box(WOOD, 0.28, 0.28, 0.6, 1.9, 2.15, 2.05),
    box(PLASTER_W, 4.8, 2.4, 4.0, 0, 3.6, 0),
    // Timber frame: corner posts, front rails/studs, chevron braces, side rails
    box(WOOD_DK, 0.22, 2.4, 0.22, -2.3, 3.6, 1.9),
    box(WOOD_DK, 0.22, 2.4, 0.22, 2.3, 3.6, 1.9),
    box(WOOD_DK, 0.22, 2.4, 0.22, -2.3, 3.6, -1.9),
    box(WOOD_DK, 0.22, 2.4, 0.22, 2.3, 3.6, -1.9),
    box(WOOD_DK, 4.7, 0.2, 0.12, 0, 4.7, 2.02),
    box(WOOD_DK, 4.7, 0.18, 0.12, 0, 3.55, 2.02),
    box(WOOD_DK, 4.7, 0.2, 0.12, 0, 2.45, 2.02),
    box(WOOD_DK, 0.14, 2.4, 0.1, -0.75, 3.6, 2.03),
    box(WOOD_DK, 0.14, 2.4, 0.1, 0.75, 3.6, 2.03),
    box(WOOD_DK, 1.1, 0.13, 0.1, -1.5, 4.2, 2.03),
    box(WOOD_DK, 1.1, 0.13, 0.1, 1.5, 4.2, 2.03),
    part('box', WOOD_DK, [0.12, 0.18, 3.9], [2.42, 4.55, 0], [0, 0, 0]),
    part('box', WOOD_DK, [0.12, 0.18, 3.9], [2.42, 2.5, 0], [0, 0, 0]),
    // Upper lit windows: two tall on the front, one on each side
    ...litWindow(0.72, 1.15, -1.5, 3.55, 2.04),
    ...litWindow(0.72, 1.15, 1.5, 3.55, 2.04),
    ...sideWindow(0.66, 1.05, 2.44, 3.55, 0.6),
    ...sideWindow(0.66, 1.05, -2.44, 3.55, -0.5),
    // Steep blue-slate roof (ridge along Z) + ridge cap + timber fascia
    ...gableRoof(ROOF_BLUE, 5.4, 4.4, 2.8, 4.6, 0),
    box(ROOF_BLUE_DK, 0.34, 0.2, 4.5, 0, 7.35, 0),
    box(WOOD_DK, 0.14, 0.22, 4.5, -2.72, 4.55, 0),
    box(WOOD_DK, 0.14, 0.22, 4.5, 2.72, 4.55, 0),
    // Front gable (attic): stepped plaster (kept under the roof slope) + bargeboards +
    // king post + tie beam + a glowing diamond window
    box(PLASTER_W, 3.2, 1.0, 0.3, 0, 5.1, 2.0),
    box(PLASTER_W, 2.0, 0.6, 0.3, 0, 5.9, 2.0),
    box(PLASTER_W, 0.9, 0.55, 0.3, 0, 6.475, 2.0),
    part('box', WOOD_DK, [Math.hypot(2.7, 2.8), 0.2, 0.34], [-1.35, 6.0, 2.16], [0, 0, Math.atan2(2.8, 2.7)]),
    part('box', WOOD_DK, [Math.hypot(2.7, 2.8), 0.2, 0.34], [1.35, 6.0, 2.16], [0, 0, -Math.atan2(2.8, 2.7)]),
    box(WOOD_DK, 0.18, 2.5, 0.3, 0, 5.85, 2.04),
    box(WOOD_DK, 3.3, 0.18, 0.3, 0, 4.72, 2.04),
    part('box', WIN_FRAME, [0.66, 0.66, 0.12], [0, 5.5, 2.16], [0, 0, Math.PI / 4]),
    part('box', WIN_LIT, [0.5, 0.5, 0.14], [0, 5.5, 2.2], [0, 0, Math.PI / 4]),
    part('box', WIN_FRAME, [0.9, 0.05, 0.16], [0, 5.5, 2.22], [0, 0, 0]),
    part('box', WIN_FRAME, [0.05, 0.9, 0.16], [0, 5.5, 2.22], [0, 0, 0]),
    // Back gable — matching stepped plaster fill so it isn't hollow from behind
    box(PLASTER_W, 3.2, 1.0, 0.3, 0, 5.1, -2.0),
    box(PLASTER_W, 2.0, 0.6, 0.3, 0, 5.9, -2.0),
    box(PLASTER_W, 0.9, 0.55, 0.3, 0, 6.475, -2.0),
    // Stone chimney (right, toward the back) with cap + flue pots
    box(STONE, 0.95, 6.0, 0.95, 2.0, 5.3, -0.9),
    box(STONE_LT, 0.5, 0.5, 0.5, 2.0, 6.2, -0.68),
    box(STONE_LT, 0.45, 0.45, 0.45, 1.8, 7.2, -0.9),
    box(STONE_DK, 1.06, 0.3, 1.06, 2.0, 6.5, -0.9),
    box(STONE_DK, 1.2, 0.42, 1.2, 2.0, 8.4, -0.9),
    box(0x322e28, 0.28, 0.42, 0.28, 1.82, 8.75, -0.9),
    box(0x322e28, 0.28, 0.42, 0.28, 2.18, 8.75, -0.9),
    // Covered porch (right): deck, posts, beam, blue lean-to roof, barrels + a crate
    box(WOOD_LT, 1.7, 0.16, 3.4, 3.35, 0.1, 0.2),
    box(WOOD, 0.18, 2.3, 0.18, 4.1, 1.25, 1.6),
    box(WOOD, 0.18, 2.3, 0.18, 4.1, 1.25, 0.0),
    box(WOOD, 0.18, 2.3, 0.18, 4.1, 1.25, -1.5),
    box(WOOD, 0.16, 0.22, 3.5, 4.1, 2.3, 0.05),
    part('box', ROOF_BLUE, [2.4, 0.16, 3.6], [3.28, 3.0, 0.15], [0, 0, -Math.atan2(1.2, 1.9)]),
    part('box', WOOD_DK, [0.14, 0.2, 3.6], [4.32, 2.35, 0.15], [0, 0, 0]),
    ...barrel(3.85, 0.18, 1.35, 1.0),
    ...barrel(3.95, 0.18, -1.1, 0.9),
    box(CRATE, 0.8, 0.8, 0.8, 3.35, 0.6, -0.3),
    box(CRATE_DK, 0.86, 0.12, 0.86, 3.35, 1.02, -0.3),
    // Front dressing: a leafy planter + a barrel by the steps
    box(WOOD, 0.72, 0.42, 0.72, -1.85, 0.31, 2.25),
    box(LEAF, 0.62, 0.22, 0.62, -1.85, 0.6, 2.25),
    ...barrel(1.75, 0.0, 2.25, 0.85),
    // Hanging tavern sign (front-left): bracket + chains + board with a foaming-mug emblem
    box(WOOD_DK, 0.12, 0.12, 1.25, -2.5, 3.95, 2.45),
    box(WOOD_DK, 0.12, 0.55, 0.12, -2.5, 3.65, 1.95),
    part('cylinder', IRON, [0.028, 0.028, 0.5], [-2.72, 3.4, 2.95], [0, 0, 0]),
    part('cylinder', IRON, [0.028, 0.028, 0.5], [-2.28, 3.4, 2.95], [0, 0, 0]),
    box(0x2e2016, 1.02, 0.9, 0.06, -2.5, 2.95, 2.95),
    box(0x4a3626, 0.86, 0.74, 0.08, -2.5, 2.95, 2.96),
    box(MUG_AMBER, 0.34, 0.42, 0.06, -2.55, 2.86, 3.0),
    box(MUG_FOAM, 0.34, 0.14, 0.06, -2.55, 3.14, 3.0),
    box(MUG_HANDLE, 0.1, 0.24, 0.06, -2.3, 2.88, 3.0),
  ], null, { hw: 2.5, hd: 2.1 }),
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

  // ── City & grand buildings (Stormwind-style: big stone, blue slate, spires, banners) ──
  def('cathedral', 'Cathedral', 'structure', [
    box(STONE_LT, 5.4, 6.5, 9.0, 0, 3.25, -0.5),
    ...gableRoof(STORM_BLUE, 5.9, 9.1, 2.6, 6.5, -0.5),
    box(STONE_LT, 6.0, 5.2, 1.4, 0, 2.6, 4.2),
    box(STONE, 1.9, 11.0, 1.9, -2.4, 5.5, 4.6),
    box(STONE, 1.9, 11.0, 1.9, 2.4, 5.5, 4.6),
    box(STONE_DK, 2.1, 0.5, 2.1, -2.4, 11.0, 4.6),
    box(STONE_DK, 2.1, 0.5, 2.1, 2.4, 11.0, 4.6),
    cone(STORM_BLUE, 1.55, 3.4, -2.4, 12.95, 4.6),
    cone(STORM_BLUE, 1.55, 3.4, 2.4, 12.95, 4.6),
    sph(GOLD, 0.24, -2.4, 14.85, 4.6),
    sph(GOLD, 0.24, 2.4, 14.85, 4.6),
    part('cylinder', WINDOW, [1.2, 1.2, 0.2], [0, 4.4, 4.94], [Math.PI / 2, 0, 0]),
    box(DOOR, 1.8, 2.8, 0.24, 0, 1.4, 4.94),
    box(STONE_DK, 2.4, 0.4, 0.5, 0, 2.95, 4.96),
    ...[-3.2, -0.9, 1.4].flatMap((z) => [
      box(WINDOW, 0.5, 2.2, 0.14, -2.72, 3.4, z),
      box(WINDOW, 0.5, 2.2, 0.14, 2.72, 3.4, z),
    ]),
  ], null, { hw: 3.3, hd: 5.2 }),
  def('castle-keep', 'Castle Keep', 'structure', [
    box(STONE, 7.0, 8.0, 7.0, 0, 4.0, 0),
    box(STONE_DK, 7.3, 0.5, 7.3, 0, 8.0, 0),
    ...([[-3.5, -3.5], [3.5, -3.5], [-3.5, 3.5], [3.5, 3.5]] as [number, number][]).flatMap(([x, z]) => [
      cyl(STONE, 1.15, 1.25, 10.5, x, 5.25, z),
      cyl(STONE_DK, 1.4, 1.4, 0.5, x, 10.5, z),
      cone(STORM_BLUE, 1.55, 2.6, x, 12.05, z),
      sph(GOLD, 0.16, x, 13.5, z),
    ]),
    ...merlons(8.35, 3.0, STONE_DK).map((p) => ({ ...p, pos: [p.pos[0], p.pos[1], -3.4] as V3 })),
    ...merlons(8.35, 3.0, STONE_DK).map((p) => ({ ...p, pos: [p.pos[0], p.pos[1], 3.4] as V3 })),
    box(DOOR, 1.6, 2.6, 0.24, 0, 1.3, 3.62),
    box(STONE_DK, 2.2, 0.5, 0.4, 0, 2.8, 3.66),
    ...[2.0, 4.5, 6.5].flatMap((y) => [
      box(WINDOW, 0.5, 0.9, 0.14, -1.4, y, 3.52),
      box(WINDOW, 0.5, 0.9, 0.14, 1.4, y, 3.52),
    ]),
  ], null, { hw: 4.7, hd: 4.7 }),
  def('town-hall', 'Town Hall', 'structure', [
    box(PLASTER_W, 8.0, 4.6, 5.0, 0, 2.3, 0),
    box(STONE_LT, 8.3, 0.5, 5.3, 0, 4.6, 0),
    ...gableRoof(ROOF_RED, 8.5, 5.3, 2.2, 4.85, 0),
    box(STONE_LT, 2.6, 9.5, 2.6, 0, 4.75, 0.4),
    box(STONE_DK, 2.9, 0.5, 2.9, 0, 9.5, 0.4),
    part('cylinder', 0xf2ecd8, [0.7, 0.7, 0.2], [0, 7.6, 1.72], [Math.PI / 2, 0, 0]),
    cone(STORM_BLUE, 2.0, 3.0, 0, 11.25, 0.4),
    sph(GOLD, 0.24, 0, 13.0, 0.4),
    ...[-2.6, -1.3, 1.3, 2.6].map((x) => cyl(STONE_LT, 0.28, 0.3, 3.4, x, 1.7, 3.0)),
    box(STONE_LT, 6.0, 0.4, 1.4, 0, 3.6, 3.0),
    box(DOOR, 1.8, 2.6, 0.2, 0, 1.3, 2.54),
    box(STONE_LT, 5.0, 0.3, 1.0, 0, 0.15, 3.8),
    box(STONE_LT, 4.4, 0.3, 0.7, 0, 0.45, 3.6),
    box(BANNER_BLUE, 0.5, 1.6, 0.08, -2.4, 3.2, 2.55),
    box(BANNER_RED, 0.5, 1.6, 0.08, 2.4, 3.2, 2.55),
    ...[-3.2, 3.2].flatMap((x) => [
      box(WINDOW, 0.6, 1.0, 0.14, x, 1.7, 2.52),
      box(WINDOW, 0.6, 1.0, 0.14, x, 3.3, 2.52),
    ]),
  ], null, { hw: 4.0, hd: 2.6 }),
  def('guildhall', 'Guildhall', 'structure', [
    box(STONE_LT, 5.5, 3.0, 4.5, 0, 1.5, 0),
    box(WOOD_DK, 5.6, 0.3, 4.6, 0, 3.0, 0),
    box(PLASTER_W, 5.8, 2.8, 4.8, 0, 4.4, 0),
    box(WOOD_DK, 5.8, 0.16, 0.1, 0, 4.4, 2.42),
    ...[-2.5, -1.25, 0, 1.25, 2.5].map((x) => box(WOOD_DK, 0.12, 2.8, 0.1, x, 4.4, 2.42)),
    ...gableRoof(ROOF_SLATE, 6.2, 5.0, 2.6, 5.8, 0),
    box(PLASTER_W, 1.2, 1.0, 0.8, -1.4, 6.4, 2.0),
    box(PLASTER_W, 1.2, 1.0, 0.8, 1.4, 6.4, 2.0),
    cone(ROOF_SLATE, 0.9, 0.8, -1.4, 7.3, 2.0),
    cone(ROOF_SLATE, 0.9, 0.8, 1.4, 7.3, 2.0),
    box(DOOR, 1.4, 2.2, 0.2, 0, 1.1, 2.34),
    box(WOOD_DK, 0.1, 0.7, 0.9, 2.4, 2.5, 2.6),
    box(GOLD, 0.06, 0.5, 0.7, 2.42, 2.5, 2.6),
    ...[-1.8, 1.8].map((x) => box(WINDOW, 0.7, 0.9, 0.14, x, 1.9, 2.28)),
    ...[-1.8, 0, 1.8].map((x) => box(WINDOW, 0.6, 0.9, 0.14, x, 4.4, 2.44)),
  ], null, { hw: 2.9, hd: 2.4 }),
  def('city-manor', 'City Manor', 'structure', [
    box(PLASTER_W, 6.0, 4.0, 4.0, 0, 2.0, 0),
    ...gableRoof(STORM_BLUE, 6.4, 4.2, 2.0, 4.0, 0),
    box(PLASTER_W, 2.6, 3.2, 3.4, -4.0, 1.6, 0),
    box(PLASTER_W, 2.6, 3.2, 3.4, 4.0, 1.6, 0),
    ...gableRoof(STORM_BLUE, 3.0, 3.6, 1.4, 3.2, 0, -4.0),
    ...gableRoof(STORM_BLUE, 3.0, 3.6, 1.4, 3.2, 0, 4.0),
    box(STONE_DK, 0.6, 1.4, 0.6, -1.8, 6.0, 0),
    box(STONE_DK, 0.6, 1.4, 0.6, 1.8, 6.0, 0),
    cyl(STONE_LT, 0.2, 0.22, 2.4, -0.9, 1.2, 2.4),
    cyl(STONE_LT, 0.2, 0.22, 2.4, 0.9, 1.2, 2.4),
    box(STONE_LT, 2.4, 0.3, 1.0, 0, 2.5, 2.4),
    box(DOOR, 1.4, 2.2, 0.2, 0, 1.1, 2.04),
    ...[-2.0, 2.0].flatMap((x) => [
      box(WINDOW, 0.7, 0.9, 0.14, x, 1.6, 2.04),
      box(WINDOW, 0.7, 0.9, 0.14, x, 3.0, 2.04),
    ]),
    box(WINDOW, 0.6, 0.8, 0.14, -4.0, 1.7, 1.74),
    box(WINDOW, 0.6, 0.8, 0.14, 4.0, 1.7, 1.74),
  ], null, { hw: 5.2, hd: 2.1 }),
  def('grand-gatehouse', 'Grand Gatehouse', 'structure', [
    box(STONE, 3.0, 8.0, 3.0, -3.5, 4.0, 0),
    box(STONE, 3.0, 8.0, 3.0, 3.5, 4.0, 0),
    box(STONE_DK, 3.3, 0.5, 3.3, -3.5, 8.0, 0),
    box(STONE_DK, 3.3, 0.5, 3.3, 3.5, 8.0, 0),
    box(STONE, 4.0, 2.4, 3.0, 0, 6.8, 0),
    ...merlons(8.35, 1.5, STONE_DK).map((p) => ({ ...p, pos: [p.pos[0] - 3.5, p.pos[1], p.pos[2]] as V3 })),
    ...merlons(8.35, 1.5, STONE_DK).map((p) => ({ ...p, pos: [p.pos[0] + 3.5, p.pos[1], p.pos[2]] as V3 })),
    ...merlons(8.35, 2.0, STONE_DK),
    box(0x1a1712, 3.0, 4.8, 0.5, 0, 2.4, 0),
    ...[-1.2, -0.6, 0, 0.6, 1.2].map((x) => box(WOOD_DK, 0.12, 4.4, 0.12, x, 2.3, 1.4)),
    box(WOOD_DK, 2.8, 0.12, 0.12, 0, 3.8, 1.4),
    box(WOOD_DK, 2.8, 0.12, 0.12, 0, 1.4, 1.4),
    box(BANNER_RED, 0.7, 2.4, 0.08, -3.5, 5.0, 1.55),
    box(BANNER_BLUE, 0.7, 2.4, 0.08, 3.5, 5.0, 1.55),
    box(0x1a1712, 0.2, 1.0, 0.14, -3.5, 5.5, 1.52),
    box(0x1a1712, 0.2, 1.0, 0.14, 3.5, 5.5, 1.52),
  ]),
  def('mage-tower', 'Mage Tower', 'structure', [
    cyl(STONE_LT, 1.3, 1.7, 9.0, 0, 4.5, 0),
    cyl(STONE_DK, 1.5, 2.1, 0.6, 0, 9.3, 0),
    cyl(STONE, 2.1, 2.1, 1.6, 0, 9.8, 0),
    cone(STORM_BLUE, 2.3, 3.6, 0, 12.4, 0),
    cyl(GOLD, 0.05, 0.05, 1.0, 0, 14.7, 0),
    sph(0x9fe8ff, 0.3, 0, 15.4, 0),
    box(DOOR, 0.9, 1.8, 0.2, 0, 0.9, 1.62),
    sph(0x9fe8ff, 0.22, 0, 3.0, 1.55),
    sph(0x9fe8ff, 0.22, 1.25, 4.6, 1.0),
    sph(0x9fe8ff, 0.22, -1.3, 6.2, 0.9),
    sph(0x9fe8ff, 0.22, 0.4, 7.6, 1.45),
    box(0x9fe8ff, 0.5, 0.8, 0.14, 0, 9.8, 2.04),
    box(0x9fe8ff, 0.5, 0.8, 0.14, 0, 9.8, -2.04),
  ], 1.9),
  def('barracks', 'City Barracks', 'structure', [
    box(STONE_LT, 9.0, 3.4, 4.5, 0, 1.7, 0),
    box(WOOD_DK, 9.1, 0.3, 4.6, 0, 3.4, 0),
    ...gableRoof(ROOF_DARK, 9.3, 4.7, 2.0, 3.55, 0),
    box(STONE, 2.0, 3.0, 0.8, 0, 1.5, 2.25),
    box(DOOR, 1.4, 2.2, 0.2, 0, 1.1, 2.68),
    box(STONE_DK, 0.6, 1.0, 0.6, -3.0, 5.4, 0),
    box(BANNER_RED, 0.6, 1.8, 0.08, -3.6, 2.4, 2.3),
    box(BANNER_BLUE, 0.6, 1.8, 0.08, 3.6, 2.4, 2.3),
    ...[-3.2, -1.6, 1.6, 3.2].map((x) => box(WINDOW, 0.6, 0.9, 0.14, x, 2.0, 2.28)),
  ], null, { hw: 4.6, hd: 2.3 }),
  def('city-townhouse', 'City Townhouse', 'structure', [
    box(STONE_LT, 3.0, 2.6, 3.0, 0, 1.3, 0),
    box(WOOD_DK, 3.25, 0.2, 3.25, 0, 2.6, 0),
    box(PLASTER_W, 3.2, 2.4, 3.2, 0, 3.8, 0),
    box(WOOD_DK, 3.45, 0.2, 3.45, 0, 5.0, 0),
    box(PLASTER_W, 3.4, 2.4, 3.4, 0, 6.2, 0),
    ...[-1.4, 0, 1.4].map((x) => box(WOOD_DK, 0.14, 2.4, 0.1, x, 3.8, 1.62)),
    ...[-1.4, 0, 1.4].map((x) => box(WOOD_DK, 0.14, 2.4, 0.1, x, 6.2, 1.72)),
    ...gableRoof(ROOF_RED, 3.8, 3.6, 1.8, 7.4, 0),
    box(0x2a2018, 1.8, 1.3, 0.1, 0, 1.2, 1.52),
    box(BANNER_RED, 2.0, 0.1, 0.6, 0, 1.95, 1.75),
    box(DOOR, 0.8, 1.7, 0.16, 1.05, 0.85, 1.52),
    box(WINDOW, 0.7, 0.9, 0.14, 0, 3.8, 1.63),
    box(WINDOW, 0.7, 0.9, 0.14, 0, 6.2, 1.73),
  ], null, { hw: 1.7, hd: 1.7 }),
  def('bell-tower', 'Bell Tower', 'structure', [
    box(STONE_LT, 2.6, 10.0, 2.6, 0, 5.0, 0),
    box(STONE_DK, 2.8, 0.3, 2.8, 0, 3.5, 0),
    box(STONE_DK, 2.8, 0.3, 2.8, 0, 6.8, 0),
    box(STONE, 3.0, 2.4, 3.0, 0, 11.2, 0),
    box(0x1a1712, 1.4, 1.8, 0.4, 0, 11.2, 1.35),
    box(0x1a1712, 1.4, 1.8, 0.4, 0, 11.2, -1.35),
    cyl(0x8a6a2a, 0.55, 0.75, 0.9, 0, 11.0, 0),
    box(STONE_DK, 3.3, 0.5, 3.3, 0, 12.4, 0),
    cone(STORM_BLUE, 2.4, 3.4, 0, 14.35, 0),
    sph(GOLD, 0.26, 0, 16.3, 0),
    box(DOOR, 1.0, 2.0, 0.2, 0, 1.0, 1.32),
    box(WINDOW, 0.5, 1.6, 0.14, 0, 4.6, 1.32),
    box(WINDOW, 0.5, 1.6, 0.14, 0, 7.6, 1.32),
    part('cylinder', 0xf2ecd8, [0.55, 0.55, 0.2], [0, 8.9, 1.32], [Math.PI / 2, 0, 0]),
  ], null, { hw: 1.5, hd: 1.5 }),
  def('market-hall', 'Market Hall', 'structure', [
    box(STONE_LT, 8.0, 0.4, 5.0, 0, 0.2, 0),
    ...([-3.2, -1.6, 0, 1.6, 3.2] as number[]).flatMap((x) => [
      cyl(STONE, 0.35, 0.4, 3.2, x, 2.0, -2.0),
      cyl(STONE, 0.35, 0.4, 3.2, x, 2.0, 2.0),
    ]),
    box(WOOD_DK, 8.2, 0.4, 5.2, 0, 3.8, 0),
    box(PLASTER_W, 7.2, 1.6, 4.2, 0, 4.8, 0),
    ...gableRoof(ROOF_RED, 8.4, 5.4, 2.4, 5.6, 0),
    box(BANNER_RED, 2.0, 0.15, 1.4, -2.4, 2.4, 1.6),
    box(BANNER_BLUE, 2.0, 0.15, 1.4, 2.4, 2.4, -1.6),
    box(WOOD, 0.7, 0.7, 0.7, -2.4, 0.75, 1.6),
    box(WOOD, 0.7, 0.7, 0.7, 2.4, 0.75, -1.6),
  ], null, { hw: 4.0, hd: 2.6 }),
  def('citadel-tower', 'Citadel Tower', 'structure', [
    cyl(STONE_DK, 3.2, 3.8, 2.0, 0, 1.0, 0),
    cyl(STONE, 2.8, 3.0, 9.0, 0, 6.5, 0),
    cyl(STONE_DK, 3.0, 3.0, 0.4, 0, 8.0, 0),
    cyl(STONE_DK, 3.4, 3.0, 1.0, 0, 11.2, 0),
    cyl(STONE, 3.4, 3.4, 1.0, 0, 12.0, 0),
    ...Array.from({ length: 8 }, (_, k) => {
      const a = (k / 8) * Math.PI * 2;
      return box(STONE_DK, 0.7, 0.7, 0.5, Math.cos(a) * 3.1, 12.7, Math.sin(a) * 3.1);
    }),
    cone(STORM_BLUE, 3.0, 3.2, 0, 14.1, 0),
    cyl(WOOD, 0.06, 0.06, 2.0, 0, 18.0, 0),
    box(BANNER_RED, 0.06, 0.9, 0.6, 0.35, 18.6, 0),
    box(DOOR, 1.2, 2.2, 0.24, 0, 1.1, 3.55),
    ...[4.0, 6.0, 8.0].map((y) => box(0x1a1712, 0.24, 1.2, 0.14, 0, y, 2.9)),
  ], 3.4),

  // ── City buildings (voxelised from docs/assets/reference art) ──────────
  // Half-timbered Tudor houses, an inn, a church, a stable, a bathhouse, grand manors and a
  // stone fountain — stone ground floors, jettied timber upper storeys, warm terracotta roofs.
  def('city-house-1', 'Timbered House', 'structure', [
    box(STONE, 3.6, 2.1, 3.0, 0, 1.05, 0),                     // stone ground floor
    box(WOOD_DK, 3.75, 0.24, 3.15, 0, 2.16, 0),                // jetty band
    box(WATTLE, 3.7, 2.0, 3.25, 0, 3.25, 0),                   // half-timber upper
    ...[-1.78, 1.78].map((x) => box(TIMBER, 0.2, 2.0, 3.25, x, 3.25, 0)),
    box(TIMBER, 3.7, 0.18, 3.28, 0, 4.25, 0),                  // top plate
    box(TIMBER, 3.7, 0.16, 0.1, 0, 3.25, 1.64),                // mid rail
    ...studs(1.85, 3.25, 2.0, 1.64, 4),
    ...gableEnd(2.0, 4.25, 1.75, 1.66),
    ...gableRoof(TILE, 4.3, 3.5, 1.75, 4.25, 0),
    box(TILE_DK, 0.36, 0.24, 3.5, 0, 6.0, 0),                  // ridge
    box(TIMBER_DK, 4.4, 0.18, 0.18, 0, 4.28, 1.75),            // front eave
    ...chimney(1.2, -0.75, 3.0, 6.7),
    box(TIMBER_DK, 1.15, 1.75, 0.14, -0.7, 0.88, 1.46),        // door frame
    box(DOOR, 0.82, 1.5, 0.16, -0.7, 0.75, 1.53),
    box(TILE, 1.35, 0.18, 0.55, -0.7, 1.98, 1.74),             // door awning
    box(STONE_LT, 1.2, 0.2, 0.5, -0.7, 0.1, 1.86),             // step
    ...lantern(-1.5, 1.45, 1.55),
    ...leadWin(0.7, 0.85, 0.9, 1.25, 1.52, true),
    ...leadWin(0.72, 0.95, -0.75, 3.3, 1.66),
    ...leadWin(0.72, 0.95, 0.85, 3.3, 1.66, true),
    ...flowerBox(0.85, 2.82, 1.72),
  ], null, { hw: 1.9, hd: 1.6 }),
  def('city-house-2', 'Tall Townhouse', 'structure', [
    box(STONE, 3.2, 2.2, 2.9, 0, 1.1, 0),
    box(WOOD_DK, 3.35, 0.22, 3.0, 0, 2.2, 0),
    box(WATTLE, 3.3, 2.1, 3.05, 0, 3.3, 0),                    // 2nd storey
    box(WOOD_DK, 3.5, 0.22, 3.2, 0, 4.4, 0),
    box(WATTLE, 3.5, 2.1, 3.2, 0, 5.5, 0),                     // 3rd storey (jetty out)
    ...[-1.68, 1.68].map((x) => box(TIMBER, 0.2, 2.1, 3.05, x, 3.3, 0)),
    ...[-1.73, 1.73].map((x) => box(TIMBER, 0.2, 2.1, 3.2, x, 5.5, 0)),
    ...studs(1.55, 3.3, 2.1, 1.56, 3),
    ...studs(1.65, 5.5, 2.1, 1.63, 3),
    box(TIMBER, 3.5, 0.2, 3.2, 0, 6.55, 0),
    ...gableEnd(1.9, 6.55, 1.7, 1.62),
    ...gableRoof(TILE, 4.0, 3.4, 1.7, 6.55, 0),
    box(TILE_DK, 0.34, 0.22, 3.4, 0, 8.25, 0),
    box(WATTLE, 0.9, 0.8, 0.5, 0, 7.35, 1.5),                  // dormer
    ...gableRoof(TILE, 1.2, 0.7, 0.5, 7.75, 1.5),
    ...leadWin(0.4, 0.5, 0, 7.4, 1.72, true),
    ...chimney(1.15, -0.7, 3.0, 8.9),
    box(TIMBER_DK, 1.1, 1.7, 0.14, -0.6, 0.85, 1.42),
    box(DOOR, 0.82, 1.5, 0.16, -0.6, 0.75, 1.48),
    box(STONE_LT, 1.1, 0.2, 0.5, -0.6, 0.1, 1.8),
    ...lantern(-1.35, 1.4, 1.5),
    ...leadWin(0.7, 0.8, 0.85, 1.3, 1.48, true),
    ...leadWin(0.75, 0.95, -0.7, 3.35, 1.6, true),
    ...leadWin(0.75, 0.95, 0.8, 3.35, 1.6),
    ...leadWin(0.75, 0.95, 0, 5.55, 1.75, true),
    ...flowerBox(-0.7, 2.85, 1.55),
    ...flowerBox(0.8, 5.05, 1.78),
    box(TIMBER_DK, 0.9, 0.12, 0.1, 2.05, 2.5, 0),              // sign bracket
    box(SIGNBOARD, 0.1, 0.7, 0.6, 2.5, 2.1, 0),
    box(MUG_AMBER, 0.06, 0.34, 0.3, 2.56, 2.1, 0),
  ], null, { hw: 1.7, hd: 1.55 }),
  def('city-house-3', 'Tudor Cottage', 'structure', [
    box(STONE, 3.4, 2.0, 3.0, 0, 1.0, 0),
    box(WOOD_DK, 3.55, 0.24, 3.15, 0, 2.05, 0),
    box(WATTLE, 3.5, 1.9, 3.25, 0, 3.1, 0),
    ...[-1.68, 1.68].map((x) => box(TIMBER, 0.2, 1.9, 3.25, x, 3.1, 0)),
    box(TIMBER, 3.5, 0.18, 3.28, 0, 4.05, 0),
    box(TIMBER, 3.5, 0.16, 0.1, 0, 3.1, 1.64),
    ...studs(1.75, 3.1, 1.9, 1.64, 4),
    ...gableEnd(1.9, 4.05, 2.0, 1.66),
    ...gableRoof(TILE, 4.1, 3.5, 2.0, 4.05, 0),                // steeper roof
    box(TILE_DK, 0.34, 0.24, 3.5, 0, 6.05, 0),
    box(WATTLE, 0.9, 0.75, 0.5, 0.6, 4.9, 1.5),                // dormer
    ...gableRoof(TILE, 1.15, 0.7, 0.45, 5.25, 1.5, 0.6),
    ...leadWin(0.4, 0.45, 0.6, 4.95, 1.72),
    ...chimney(1.15, -0.7, 3.0, 6.8),
    box(STONE_LT, 1.25, 1.9, 0.2, 0, 0.95, 1.46),              // stone door surround
    box(DOOR, 0.82, 1.45, 0.16, 0, 0.73, 1.55),
    box(TILE, 1.4, 0.18, 0.55, 0, 1.95, 1.75),                 // awning
    box(STONE_LT, 1.1, 0.2, 0.5, 0, 0.1, 1.9),
    ...lantern(0.9, 1.4, 1.55),
    ...leadWin(0.6, 0.7, -1.0, 1.35, 1.52),
    ...leadWin(0.7, 0.9, -0.7, 3.15, 1.66),
    ...leadWin(0.7, 0.9, 0.9, 3.15, 1.66, true),
    ...flowerBox(-0.7, 2.72, 1.72),
  ], null, { hw: 1.8, hd: 1.6 }),
  def('city-house-4', 'Corner House', 'structure', [
    box(STONE, 3.0, 2.2, 3.0, -0.8, 1.1, 0),                   // main block (left)
    box(WOOD_DK, 3.2, 0.24, 3.2, -0.8, 2.2, 0),
    box(WATTLE, 3.2, 2.0, 3.3, -0.8, 3.3, 0),                  // jettied upper
    ...[-2.3, 0.7].map((x) => box(TIMBER, 0.2, 2.0, 3.3, x, 3.3, 0)),
    box(TIMBER, 3.2, 0.18, 3.3, -0.8, 4.3, 0),
    ...studs(1.4, 3.3, 2.0, 1.68, 3, -0.8),
    ...gableEnd(1.7, 4.3, 1.8, 1.7, -0.8),
    ...gableRoof(TILE, 3.7, 3.5, 1.8, 4.3, 0, -0.8),
    box(TILE_DK, 0.34, 0.24, 3.5, -0.8, 6.1, 0),
    ...chimney(-0.8, -0.9, 3.0, 6.8),
    box(STONE, 2.2, 1.5, 2.4, 1.9, 0.75, 0.3),                 // side wing (right, lower)
    box(WATTLE, 2.1, 1.0, 2.5, 1.9, 2.0, 0.3),
    ...gableRoof(TILE, 2.6, 2.7, 1.1, 2.5, 0.3, 1.9),
    box(TILE_DK, 0.3, 0.2, 2.7, 1.9, 3.6, 0.3),
    ...leadWin(0.6, 0.7, 1.9, 1.9, 1.56, true),
    ...flowerBox(1.9, 1.35, 1.56),
    box(STONE_LT, 1.3, 2.0, 0.24, -0.8, 1.0, 1.46),            // arched stone door
    box(DOOR, 0.85, 1.5, 0.18, -0.8, 0.75, 1.56),
    box(STONE_DK, 0.95, 0.3, 0.2, -0.8, 1.65, 1.5),
    box(STONE_LT, 1.2, 0.2, 0.5, -0.8, 0.1, 1.85),
    ...lantern(0.05, 1.4, 1.5),
    ...leadWin(0.7, 0.9, -0.7, 3.35, 1.7, true),
    ...leadWin(0.7, 0.9, 0.1, 3.35, 1.7),
    ...flowerBox(-0.7, 2.85, 1.68),
  ], null, { hw: 2.6, hd: 1.7 }),
  def('city-worker-hut', "Worker's Hut", 'structure', [
    box(STONE, 3.6, 1.4, 2.8, 0, 0.7, 0),
    box(WOOD_DK, 3.7, 0.2, 2.9, 0, 1.4, 0),
    box(WATTLE, 3.6, 1.3, 2.95, 0, 2.05, 0),
    ...[-1.75, 1.75].map((x) => box(TIMBER, 0.18, 1.3, 2.95, x, 2.05, 0)),
    ...studs(1.75, 2.05, 1.3, 1.5, 4),
    ...gableEnd(1.85, 2.7, 1.5, 1.5),
    ...gableRoof(TILE, 4.0, 3.3, 1.5, 2.7, 0),
    box(TILE_DK, 0.32, 0.22, 3.3, 0, 4.2, 0),
    ...chimney(1.2, -0.6, 2.5, 5.0),
    box(WOOD, 0.16, 1.6, 0.16, -1.9, 0.8, 1.7),                // porch posts
    box(WOOD, 0.16, 1.6, 0.16, -0.9, 0.8, 1.7),
    ...gableRoof(TILE, 1.5, 1.2, 0.5, 1.6, 1.85, -1.4),
    box(DOOR, 0.78, 1.3, 0.16, -1.4, 0.65, 1.44),
    box(STONE_LT, 1.0, 0.18, 0.5, -1.4, 0.1, 1.9),
    ...leadWin(0.55, 0.6, 0.4, 1.55, 1.44),
    ...leadWin(0.55, 0.6, 1.3, 1.55, 1.44, true),
    box(WOOD_LT, 0.9, 0.5, 0.5, 2.2, 0.9, 1.2),                // wood pile
    box(WOOD, 0.9, 0.16, 0.5, 2.2, 1.2, 1.2),
    ...barrel(2.3, 0, 0.1, 0.55),
  ], null, { hw: 1.9, hd: 1.5 }),
  def('city-stable', 'Stable', 'structure', [
    box(STONE, 5.4, 1.2, 3.4, 0, 0.6, 0),
    box(WATTLE, 5.2, 1.8, 3.5, 0, 2.1, 0),
    ...[-2.5, -0.9, 0.9, 2.5].map((x) => box(TIMBER, 0.2, 3.0, 3.5, x, 1.5, 0)),
    box(TIMBER, 5.2, 0.2, 3.55, 0, 3.0, 0),
    ...gableEnd(2.7, 3.0, 1.9, 1.72),
    ...gableRoof(TILE, 5.8, 4.0, 1.9, 3.0, 0),
    box(TILE_DK, 0.4, 0.24, 4.0, 0, 4.9, 0),
    ...chimney(1.6, -1.0, 3.4, 5.6),
    box(TIMBER_DK, 2.4, 2.6, 0.3, 0, 1.3, 1.6),                // barn door surround
    box(WOOD, 1.05, 2.3, 0.16, -0.55, 1.15, 1.72),
    box(WOOD, 1.05, 2.3, 0.16, 0.55, 1.15, 1.72),
    box(WOOD_DK, 0.1, 2.3, 0.18, 0, 1.15, 1.74),
    box(HAY, 1.6, 0.3, 0.6, 0, 0.15, 1.9),                     // hay at the doors
    box(0x1a1712, 1.0, 0.9, 0.4, 0, 3.4, 1.7),                 // loft opening
    box(WOOD, 0.5, 0.12, 0.5, 0, 4.0, 1.85),                   // loft beam
    ...leadWin(0.6, 0.7, -1.9, 1.85, 1.76, true),
    ...leadWin(0.6, 0.7, 1.9, 1.85, 1.76, true),
    ...flowerBox(-1.9, 1.3, 1.76),
    box(WOOD, 0.16, 1.6, 0.16, 3.2, 0.8, 1.4),                 // lean-to posts
    box(WOOD, 0.16, 1.6, 0.16, 3.2, 0.8, -1.4),
    box(TILE, 2.0, 0.18, 3.2, 3.6, 1.65, 0),                   // lean-to roof
    ...[1.2, 0, -1.2].map((z) => box(WOOD, 1.6, 0.12, 0.12, 3.6, 0.7, z)), // fence rails
    box(HAY, 0.9, 0.6, 0.9, 3.5, 0.3, 0.8),                    // hay bale
  ], null, { hw: 3.4, hd: 1.8 }),
  def('city-bathhouse', 'Bathhouse', 'structure', [
    box(STONE, 3.8, 2.0, 3.2, -0.4, 1.0, 0),
    box(WOOD_DK, 3.95, 0.24, 3.35, -0.4, 2.05, 0),
    box(WATTLE, 3.9, 2.0, 3.4, -0.4, 3.1, 0),
    ...[-2.3, 1.5].map((x) => box(TIMBER, 0.2, 2.0, 3.4, x, 3.1, 0)),
    ...studs(1.9, 3.1, 2.0, 1.74, 4, -0.4),
    box(TIMBER, 3.9, 0.2, 3.4, -0.4, 4.1, 0),
    ...gableEnd(2.0, 4.1, 1.8, 1.76, -0.4),
    ...gableRoof(TILE, 4.4, 3.7, 1.8, 4.1, 0, -0.4),
    box(TILE_DK, 0.36, 0.24, 3.7, -0.4, 5.9, 0),
    ...chimney(-1.6, -0.9, 3.0, 6.5),
    ...[6.8, 7.3, 7.8].map((y, i) => sph(STEAM, 0.3 + i * 0.08, -1.6, y, -0.9)), // chimney steam
    box(SIGNBOARD, 1.7, 0.7, 0.16, -0.4, 2.75, 1.78),          // BATHHOUSE sign
    box(TIMBER_DK, 1.85, 0.14, 0.2, -0.4, 3.15, 1.78),
    box(STEAM, 0.5, 0.14, 0.06, -0.4, 2.82, 1.88),
    box(0x2f3f5f, 0.9, 1.6, 0.14, -0.9, 0.8, 1.62),            // blue curtain door
    box(STONE_LT, 1.1, 0.2, 0.5, -0.9, 0.1, 1.95),
    ...lantern(-1.9, 1.5, 1.66),
    ...leadWin(0.6, 0.7, 0.7, 1.3, 1.62, true),
    ...leadWin(0.65, 0.85, -1.3, 3.15, 1.74, true),
    ...leadWin(0.65, 0.85, 0.6, 3.15, 1.74, true),
    ...flowerBox(0.7, 0.95, 1.62),
    box(STONE, 2.4, 0.9, 2.4, 2.4, 0.45, 0.2),                 // outdoor hot tub
    box(FOUNT_WATER, 1.9, 0.35, 1.9, 2.4, 0.85, 0.2),
    ...[1.2, 1.7, 2.2].map((y, i) => sph(STEAM, 0.3 + i * 0.07, 2.4, y, 0.2)), // tub steam
    ...barrel(3.9, 0, 1.7, 0.5),
  ], null, { hw: 2.7, hd: 1.8 }),
  def('city-inn', 'Inn', 'structure', [
    box(STONE, 4.0, 2.2, 3.4, -1.2, 1.1, 0),                   // main block (left)
    box(WOOD_DK, 4.2, 0.24, 3.55, -1.2, 2.2, 0),
    box(WATTLE, 4.1, 2.2, 3.6, -1.2, 3.35, 0),
    ...[-3.15, 0.75].map((x) => box(TIMBER, 0.2, 2.2, 3.6, x, 3.35, 0)),
    ...studs(1.9, 3.35, 2.2, 1.82, 4, -1.2),
    box(TIMBER, 4.1, 0.2, 3.6, -1.2, 4.45, 0),
    ...gableEnd(2.1, 4.45, 2.0, 1.84, -1.2),
    ...gableRoof(TILE, 4.6, 3.8, 2.0, 4.45, 0, -1.2),
    box(TILE_DK, 0.38, 0.24, 3.8, -1.2, 6.45, 0),
    box(WATTLE, 0.9, 0.8, 0.5, -1.2, 5.4, 1.55),               // dormer
    ...gableRoof(TILE, 1.2, 0.7, 0.5, 5.8, 1.55, -1.2),
    ...leadWin(0.4, 0.5, -1.2, 5.45, 1.77, true),
    ...chimney(0.5, -1.2, 3.2, 7.0),
    box(STONE_LT, 1.4, 2.2, 0.24, -1.5, 1.1, 1.66),            // arched door
    box(DOOR, 0.95, 1.6, 0.18, -1.5, 0.8, 1.76),
    box(STONE_DK, 1.0, 0.34, 0.2, -1.5, 1.8, 1.7),
    box(STONE_LT, 1.4, 0.2, 0.5, -1.5, 0.1, 2.05),
    ...leadWin(0.6, 0.7, -2.6, 1.4, 1.72, true),
    ...leadWin(0.7, 0.9, -2.2, 3.4, 1.86),
    ...leadWin(0.7, 0.9, -0.4, 3.4, 1.86, true),
    ...flowerBox(-0.4, 2.9, 1.84),
    box(TIMBER_DK, 0.9, 0.14, 0.14, -3.5, 2.7, 0),             // mug sign
    box(SIGNBOARD, 0.12, 0.8, 0.7, -4.0, 2.2, 0),
    box(MUG_AMBER, 0.06, 0.4, 0.34, -4.07, 2.1, 0),
    box(MUG_FOAM, 0.06, 0.12, 0.34, -4.07, 2.38, 0),
    box(STONE, 3.4, 0.4, 3.4, 2.4, 0.2, 0),                    // porch platform (right)
    ...[0.9, 3.9].flatMap((x) => [1.4, -1.4].map((z) => box(WOOD, 0.2, 2.2, 0.2, x, 1.3, z))),
    box(TIMBER, 3.6, 0.3, 3.5, 2.4, 2.5, 0),                   // porch beam
    ...gableRoof(TILE, 4.0, 3.6, 1.2, 2.65, 0, 2.4),
    box(TILE_DK, 0.3, 0.2, 3.6, 2.4, 3.85, 0),
    box(WATTLE, 3.0, 1.6, 0.2, 2.4, 1.3, -1.5),                // porch back wall
    ...[1.2, 2.4, 3.6].flatMap((x) => lantern(x, 1.9, 1.4)),
    ...[0.9, 1.9, 2.9, 3.9].map((x) => box(WOOD, 0.6, 0.7, 0.12, x, 0.75, 1.5)), // railing
  ], null, { hw: 3.6, hd: 1.8 }),
  def('city-church', 'Church', 'structure', [
    box(STONE_LT, 4.0, 4.0, 6.0, -1.0, 2.0, 0),                // nave
    box(STONE_DK, 4.3, 0.4, 6.3, -1.0, 0.2, 0),                // plinth
    ...gableEnd(2.0, 4.0, 2.2, 3.02, -1.0, STONE_LT),
    ...gableRoof(TILE, 4.4, 6.4, 2.2, 4.0, 0, -1.0),
    box(TILE_DK, 0.4, 0.26, 6.4, -1.0, 6.2, 0),
    box(STONE_DK, 0.2, 0.95, 0.2, -1.0, 6.75, 3.0),            // front cross
    box(STONE_DK, 0.65, 0.2, 0.2, -1.0, 6.95, 3.0),
    cyl(STONE_DK, 0.72, 0.72, 0.2, -1.0, 4.7, 3.02),           // rose window
    cyl(LEAD, 0.55, 0.55, 0.18, -1.0, 4.7, 3.06),
    ...[-2.4, -0.8, 0.8].flatMap((z) => [                       // gothic side windows (+X wall)
      box(LEAD, 0.5, 1.8, 0.3, 1.05, 2.4, z),
      box(STONE_DK, 0.72, 0.4, 0.32, 1.05, 3.4, z),
    ]),
    ...[-2.6, -1.0, 0.6, 2.2].map((z) => box(STONE, 0.5, 3.2, 0.5, 1.2, 1.6, z)), // buttresses
    box(STONE, 1.9, 2.2, 1.3, -1.0, 1.1, 3.35),                // entrance porch
    box(DOOR, 1.0, 1.7, 0.18, -1.0, 0.85, 4.02),
    box(STONE_DK, 1.2, 0.4, 0.3, -1.0, 1.95, 4.0),
    ...gableRoof(TILE, 2.3, 1.5, 0.9, 2.2, 4.0, -1.0),
    ...lantern(-2.05, 1.6, 3.5),
    ...lantern(0.05, 1.6, 3.5),
    box(STONE_LT, 2.0, 0.3, 0.6, -1.0, 0.15, 4.35),            // steps
    box(STONE_LT, 3.0, 9.0, 3.0, 2.4, 4.5, -2.0),              // bell tower
    box(STONE_DK, 3.2, 0.4, 3.2, 2.4, 3.0, -2.0),
    box(STONE_DK, 3.2, 0.4, 3.2, 2.4, 7.2, -2.0),
    box(0x1a1712, 1.0, 1.6, 0.4, 2.4, 8.4, -0.55),             // bell openings
    box(0x1a1712, 0.4, 1.6, 1.0, 3.85, 8.4, -2.0),
    cyl(0x8a6a2a, 0.5, 0.62, 0.85, 2.4, 8.15, -0.55),          // bell
    box(STONE_DK, 3.4, 0.5, 3.4, 2.4, 9.25, -2.0),
    cone(TILE, 2.4, 3.4, 2.4, 11.15, -2.0),                    // spire
    box(STONE_DK, 0.2, 1.0, 0.2, 2.4, 13.3, -2.0),             // tower cross
    box(STONE_DK, 0.62, 0.2, 0.2, 2.4, 13.5, -2.0),
    box(LEAD, 0.5, 1.4, 0.3, 2.4, 5.6, -0.55),                 // tower window
  ], 3.6, { hw: 3.4, hd: 3.2 }),
  def('city-manor-tower', 'Tower Manor', 'structure', [
    box(STONE, 5.0, 2.4, 4.2, 0.6, 1.2, 0),                    // main manor block
    box(WOOD_DK, 5.2, 0.24, 4.35, 0.6, 2.4, 0),
    box(WATTLE, 5.1, 2.4, 4.4, 0.6, 3.7, 0),
    ...[-1.9, 3.1].map((x) => box(TIMBER, 0.18, 2.4, 4.4, x, 3.7, 0)),
    ...studs(2.3, 3.7, 2.4, 2.24, 5, 0.6),
    box(TIMBER, 5.1, 0.2, 4.4, 0.6, 4.9, 0),
    ...gableEnd(2.55, 4.9, 2.2, 2.26, 0.6),
    ...gableRoof(TILE, 5.5, 4.6, 2.2, 4.9, 0, 0.6),
    box(TILE_DK, 0.4, 0.26, 4.6, 0.6, 7.1, 0),
    box(WATTLE, 2.0, 1.6, 0.6, 0.6, 5.5, 2.0),                 // front cross-gable
    ...gableRoof(TILE, 2.4, 1.0, 1.2, 6.3, 2.0, 0.6),
    ...leadWin(0.7, 0.9, 0.6, 5.6, 2.24, true),
    ...chimney(2.6, -1.2, 3.4, 7.6),
    box(STONE, 2.6, 6.0, 2.6, -2.8, 3.0, -0.2),                // tall tower (left)
    box(WOOD_DK, 2.75, 0.22, 2.75, -2.8, 5.2, -0.2),
    box(WATTLE, 2.7, 2.4, 2.7, -2.8, 6.4, -0.2),
    ...[-4.0, -1.6].map((x) => box(TIMBER, 0.18, 2.4, 2.7, x, 6.4, -0.2)),
    box(TIMBER, 2.7, 0.2, 2.7, -2.8, 7.6, -0.2),
    cone(TILE, 2.1, 3.2, -2.8, 9.3, -0.2),                     // tower spire
    box(STONE_DK, 0.16, 0.7, 0.16, -2.8, 11.2, -0.2),
    ...leadWin(0.6, 1.0, -2.8, 5.0, 1.15, true),
    ...leadWin(0.6, 0.9, -2.8, 6.4, 1.16, true),
    box(WOOD, 0.16, 1.8, 0.16, -0.4, 0.9, 2.4),                // entrance porch
    box(WOOD, 0.16, 1.8, 0.16, 1.6, 0.9, 2.4),
    ...gableRoof(TILE, 1.8, 1.4, 0.6, 1.85, 2.4, 0.6),
    box(DOOR, 0.9, 1.5, 0.16, 0.6, 0.75, 2.16),
    box(STONE_LT, 1.4, 0.24, 0.6, 0.6, 0.12, 2.5),
    ...lantern(-0.4, 1.5, 2.3),
    ...leadWin(0.7, 0.9, 2.2, 1.4, 2.12, true),
    ...leadWin(0.7, 0.9, 2.2, 3.7, 2.24),
    ...leadWin(0.7, 0.9, -1.0, 3.7, 2.24, true),
    ...flowerBox(2.2, 2.9, 2.2),
  ], 3.6, { hw: 3.6, hd: 2.3 }),
  def('city-grand-manor', 'Grand Manor', 'structure', [
    box(STONE, 9.0, 2.4, 4.0, 0, 1.2, 0),                      // wide stone ground floor
    box(WOOD_DK, 9.2, 0.24, 4.2, 0, 2.4, 0),
    box(WATTLE, 9.0, 2.2, 4.25, 0, 3.6, 0),                    // timber upper
    ...[-4.4, -1.5, 1.5, 4.4].map((x) => box(TIMBER, 0.2, 2.2, 4.25, x, 3.6, 0)),
    ...studs(4.2, 3.6, 2.2, 2.15, 8),
    box(TIMBER, 9.0, 0.2, 4.25, 0, 4.7, 0),
    ...gableRoofX(TILE, 4.25, 9.0, 2.0, 4.7, 0, 0),            // main roof (ridge along the wide X axis)
    box(TILE_DK, 9.0, 0.24, 0.36, 0, 6.7, 0),                 // ridge cap
    ...gableEndX(2.12, 4.7, 2.0, -4.5),                        // left gable end
    ...gableEndX(2.12, 4.7, 2.0, 4.5),                         // right gable end
    // three front cross-gables (left, centre, right)
    ...[-3.0, 0, 3.0].flatMap((cx) => [
      box(WATTLE, 2.0, 1.7, 0.6, cx, 5.4, 1.9),
      ...gableRoof(TILE, 2.4, 1.1, 1.1, 6.2, 1.9, cx),
      ...gableEnd(1.0, 5.4, 1.1, 1.92, cx),
      ...leadWin(0.6, 0.8, cx, 5.5, 2.14, true),
    ]),
    ...chimney(-3.6, -1.4, 3.4, 7.8),                          // two chimneys
    ...chimney(3.6, -1.4, 3.4, 7.8),
    box(WATTLE, 2.4, 2.4, 0.8, 0, 1.2, 2.1),                   // central entrance projection
    box(STONE_LT, 1.6, 2.2, 0.3, 0, 1.1, 2.5),
    box(DOOR, 1.0, 1.7, 0.18, 0, 0.85, 2.66),
    box(STONE_DK, 1.2, 0.36, 0.24, 0, 1.9, 2.6),
    ...gableRoof(TILE, 2.8, 1.6, 0.9, 2.5, 2.5, 0),            // porch roof
    box(STONE_LT, 1.8, 0.3, 0.7, 0, 0.15, 2.8),               // steps
    ...lantern(-1.2, 1.5, 2.55),
    ...lantern(1.2, 1.5, 2.55),
    ...[-3.6, -2.2].flatMap((x) => leadWin(0.7, 0.9, x, 1.4, 2.02, true)),
    ...[2.2, 3.6].flatMap((x) => leadWin(0.7, 0.9, x, 1.4, 2.02, true)),
    ...[-3.6, -2.0, 2.0, 3.6].flatMap((x) => leadWin(0.7, 0.9, x, 3.6, 2.16, x < 0)),
    ...flowerBox(-3.6, 0.95, 2.02),
    ...flowerBox(3.6, 0.95, 2.02),
  ], 4.2, { hw: 4.6, hd: 2.2 }),
  def('city-fountain', 'Stone Fountain', 'structure', [
    cyl(STONE_LT, 3.0, 3.2, 0.9, 0, 0.45, 0),                  // basin outer wall
    cyl(STONE_DK, 3.05, 3.25, 0.14, 0, 0.9, 0),                // rim cap
    cyl(FOUNT_WATER, 2.8, 2.8, 0.7, 0, 0.62, 0),               // water (raised so it reads blue)
    ...Array.from({ length: 6 }, (_, k) => {                    // rim corner posts
      const a = (k / 6) * Math.PI * 2;
      return box(STONE, 0.5, 0.35, 0.5, Math.cos(a) * 2.95, 1.0, Math.sin(a) * 2.95);
    }),
    ...Array.from({ length: 6 }, (_, k) => {                    // gold quatrefoils on the wall
      const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
      return box(GOLD, 0.34, 0.34, 0.1, Math.cos(a) * 3.05, 0.5, Math.sin(a) * 3.05, a);
    }),
    box(STONE, 1.8, 1.4, 1.8, 0, 1.2, 0),                      // central column base
    box(STONE_DK, 2.0, 0.2, 2.0, 0, 1.95, 0),
    box(STONE, 1.4, 1.3, 1.4, 0, 2.6, 0),                      // column mid
    ...Array.from({ length: 4 }, (_, k) => {                    // gold medallions on the column
      const a = (k / 4) * Math.PI * 2;
      return box(GOLD, 0.3, 0.4, 0.1, Math.cos(a) * 0.72, 2.6, Math.sin(a) * 0.72, a);
    }),
    box(STONE_DK, 1.6, 0.2, 1.6, 0, 3.3, 0),
    box(STONE, 1.0, 0.9, 1.0, 0, 3.85, 0),                     // column top
    ...Array.from({ length: 4 }, (_, k) => {                    // crenellations
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      return box(STONE_LT, 0.4, 0.4, 0.4, Math.cos(a) * 0.5, 4.4, Math.sin(a) * 0.5);
    }),
    cone(STONE, 0.7, 1.0, 0, 4.9, 0),                          // finial cap
    box(STONE_DK, 0.16, 0.7, 0.16, 0, 5.6, 0),                 // cross finial
    box(STONE_DK, 0.5, 0.16, 0.16, 0, 5.75, 0),
    ...Array.from({ length: 4 }, (_, k) => {                    // water jets from the column
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      return part('box', JET, [0.12, 0.9, 0.12], [Math.cos(a) * 1.3, 1.5, Math.sin(a) * 1.3], [Math.cos(a) * -0.5, 0, Math.sin(a) * -0.5]);
    }),
  ], 3.2, { hw: 3.2, hd: 3.2 }),

  // ── Bridges (decorative — walk across on the terrain beneath; raise via Height offset) ──
  def('wooden-bridge', 'Wooden Bridge', 'structure', [
    box(WOOD_LT, 2.4, 0.16, 7.0, 0, 0.4, 0),
    box(WOOD, 0.12, 0.5, 7.0, 1.1, 0.7, 0),
    box(WOOD, 0.12, 0.5, 7.0, -1.1, 0.7, 0),
    box(WOOD_DK, 2.5, 0.16, 0.25, 0, 0.25, 2.6),
    box(WOOD_DK, 2.5, 0.16, 0.25, 0, 0.25, -2.6),
    box(WOOD_DK, 0.18, 1.0, 0.18, 1.0, -0.1, 2.6),
    box(WOOD_DK, 0.18, 1.0, 0.18, -1.0, -0.1, 2.6),
    box(WOOD_DK, 0.18, 1.0, 0.18, 1.0, -0.1, -2.6),
    box(WOOD_DK, 0.18, 1.0, 0.18, -1.0, -0.1, -2.6),
  ]),
  def('rope-bridge', 'Rope Bridge', 'structure', [
    box(WOOD, 1.8, 0.12, 6.0, 0, 0.35, 0),
    part('cylinder', 0x6a5a3a, [0.04, 0.04, 6.4], [0.9, 1.05, 0], [Math.PI / 2, 0, 0]),
    part('cylinder', 0x6a5a3a, [0.04, 0.04, 6.4], [-0.9, 1.05, 0], [Math.PI / 2, 0, 0]),
    box(WOOD_DK, 0.18, 1.4, 0.18, 0.9, 0.4, 3.0),
    box(WOOD_DK, 0.18, 1.4, 0.18, -0.9, 0.4, 3.0),
    box(WOOD_DK, 0.18, 1.4, 0.18, 0.9, 0.4, -3.0),
    box(WOOD_DK, 0.18, 1.4, 0.18, -0.9, 0.4, -3.0),
  ]),
  def('stone-bridge', 'Stone Bridge', 'structure', [
    box(STONE, 2.6, 0.3, 7.0, 0, 0.45, 0),
    box(STONE_DK, 0.3, 0.6, 7.0, 1.15, 0.85, 0),
    box(STONE_DK, 0.3, 0.6, 7.0, -1.15, 0.85, 0),
  ]),
  def('stone-arch-bridge', 'Stone Arch Bridge', 'structure', [
    box(STONE, 2.6, 0.35, 7.0, 0, 0.95, 0),
    box(STONE_DK, 0.3, 0.55, 7.0, 1.15, 1.3, 0),
    box(STONE_DK, 0.3, 0.55, 7.0, -1.15, 1.3, 0),
    box(STONE, 2.6, 1.5, 0.9, 0, 0.2, 2.7),
    box(STONE, 2.6, 1.5, 0.9, 0, 0.2, -2.7),
    box(STONE_DK, 2.7, 0.45, 0.5, 0, 0.75, 0),
  ]),

  // ── More world & town props ──────────────────────────────────────────────-
  def('dock', 'Dock / Pier', 'structure', [
    box(WOOD_LT, 2.0, 0.16, 4.2, 0, 0.4, 0),
    box(WOOD_DK, 0.16, 1.2, 0.16, 0.8, -0.1, 1.8),
    box(WOOD_DK, 0.16, 1.2, 0.16, -0.8, -0.1, 1.8),
    box(WOOD_DK, 0.16, 1.2, 0.16, 0.8, -0.1, -1.8),
    box(WOOD_DK, 0.16, 1.2, 0.16, -0.8, -0.1, -1.8),
  ]),
  def('rowboat', 'Rowboat', 'misc', [
    box(0x6e4a2e, 1.1, 0.45, 2.8, 0, 0.25, 0),
    box(0x4f3622, 0.9, 0.35, 2.5, 0, 0.32, 0),
    box(WOOD_LT, 0.9, 0.08, 0.28, 0, 0.4, 0.7),
    box(WOOD_LT, 0.9, 0.08, 0.28, 0, 0.4, -0.7),
  ]),
  def('haystack', 'Haystack', 'misc', [
    cyl(0xc9a94a, 1.1, 1.3, 0.9, 0, 0.45, 0),
    cone(0xc9a94a, 1.35, 1.6, 0, 1.3, 0),
  ], 1.1),
  def('wood-pile', 'Wood Pile', 'misc', [
    part('cylinder', 0x6e4a2e, [0.22, 0.22, 1.8], [0, 0.22, -0.25], [Math.PI / 2, 0, 0]),
    part('cylinder', 0x7a5230, [0.22, 0.22, 1.8], [0, 0.22, 0.25], [Math.PI / 2, 0, 0]),
    part('cylinder', 0x6e4a2e, [0.22, 0.22, 1.8], [0, 0.62, 0], [Math.PI / 2, 0, 0]),
  ], 0.9),
  def('cart', 'Hand Cart', 'misc', [
    box(WOOD, 1.7, 0.5, 1.0, 0, 0.75, 0),
    box(WOOD_DK, 1.7, 0.4, 0.1, 0, 0.95, -0.5),
    part('cylinder', 0x3a2f24, [0.5, 0.5, 0.16], [0.95, 0.5, 0], [0, 0, Math.PI / 2]),
    part('cylinder', 0x3a2f24, [0.5, 0.5, 0.16], [-0.95, 0.5, 0], [0, 0, Math.PI / 2]),
    box(WOOD, 0.1, 0.1, 1.2, 0.7, 0.7, 1.0),
    box(WOOD, 0.1, 0.1, 1.2, -0.7, 0.7, 1.0),
  ], 1.1),
  def('bench', 'Bench', 'misc', [
    box(WOOD_LT, 1.6, 0.12, 0.5, 0, 0.5, 0),
    box(WOOD_LT, 1.6, 0.5, 0.1, 0, 0.78, -0.2),
    box(WOOD_DK, 0.1, 0.5, 0.4, 0.7, 0.25, 0),
    box(WOOD_DK, 0.1, 0.5, 0.4, -0.7, 0.25, 0),
  ]),
  def('table', 'Table', 'misc', [
    box(WOOD_LT, 1.6, 0.14, 1.0, 0, 0.9, 0),
    box(WOOD_DK, 0.12, 0.9, 0.12, 0.65, 0.45, 0.35),
    box(WOOD_DK, 0.12, 0.9, 0.12, -0.65, 0.45, 0.35),
    box(WOOD_DK, 0.12, 0.9, 0.12, 0.65, 0.45, -0.35),
    box(WOOD_DK, 0.12, 0.9, 0.12, -0.65, 0.45, -0.35),
  ], 0.8),
  def('statue', 'Statue', 'structure', [
    box(STONE_DK, 1.3, 1.0, 1.3, 0, 0.5, 0),
    box(STONE, 0.6, 1.1, 0.4, 0, 1.55, 0),
    sph(STONE, 0.26, 0, 2.25, 0),
    box(STONE, 0.2, 0.7, 0.2, 0.45, 1.6, 0),
    box(STONE, 0.2, 0.7, 0.2, -0.45, 1.6, 0),
  ], 0.9),
  def('obelisk', 'Obelisk', 'structure', [
    box(STONE_DK, 1.4, 0.5, 1.4, 0, 0.25, 0),
    box(STONE, 0.8, 4.6, 0.8, 0, 2.8, 0),
    cone(STONE, 0.6, 0.8, 0, 5.5, 0),
  ], 0.8),
  def('tombstone', 'Tombstone', 'misc', [
    box(0x5a4a38, 1.2, 0.2, 1.8, 0, 0.1, 0.4),
    box(STONE, 0.8, 1.1, 0.18, 0, 0.55, -0.3),
    box(STONE, 0.5, 0.16, 0.18, 0, 1.0, -0.3),
  ]),
  def('standing-torch', 'Standing Torch', 'misc', [
    cyl(WOOD, 0.08, 0.1, 1.8, 0, 0.9, 0),
    cyl(0x3a3a40, 0.2, 0.14, 0.25, 0, 1.85, 0),
    cone(0xff7a1e, 0.18, 0.55, 0, 2.15, 0),
  ]),
  def('brazier', 'Brazier', 'misc', [
    cyl(0x3a3a40, 0.45, 0.3, 0.32, 0, 0.8, 0),
    part('cylinder', 0x2a2a30, [0.05, 0.06, 0.9], [0.3, 0.4, 0.2], [0.3, 0, -0.3]),
    part('cylinder', 0x2a2a30, [0.05, 0.06, 0.9], [-0.3, 0.4, 0.2], [0.3, 0, 0.3]),
    part('cylinder', 0x2a2a30, [0.05, 0.06, 0.9], [0, 0.4, -0.35], [-0.3, 0, 0]),
    cone(0xff7a1e, 0.4, 0.75, 0, 1.15, 0),
  ], 0.45),
  def('scarecrow', 'Scarecrow', 'misc', [
    cyl(WOOD, 0.08, 0.1, 2.0, 0, 1.0, 0),
    box(WOOD, 1.4, 0.1, 0.1, 0, 1.5, 0),
    box(0x8a7a4a, 0.4, 0.6, 0.3, 0, 1.2, 0),
    sph(0xcaa34a, 0.25, 0, 1.95, 0),
    cone(0x6e4a2e, 0.38, 0.32, 0, 2.2, 0),
  ]),
  def('hedge', 'Hedge', 'plant', [
    box(0x35602f, 3.0, 1.2, 0.9, 0, 0.6, 0),
    box(0x3c6b34, 3.0, 0.25, 0.95, 0, 1.2, 0),
  ], null, { hw: 1.5, hd: 0.45 }),
  def('berry-bush', 'Berry Bush', 'plant', [
    ico(0x355c2b, 0.7, 0, 0, 0.55, 0),
    ico(0x3c6b34, 0.5, 0, 0.45, 0.5, 0.1),
    sph(0xc0303a, 0.08, 0.3, 0.7, 0.4),
    sph(0xc0303a, 0.08, -0.35, 0.6, -0.2),
    sph(0xc0303a, 0.08, 0.1, 0.85, -0.3),
  ]),
  def('rock-pile', 'Rock Pile', 'rock', [
    ico(0x80858f, 0.6, 0, -0.4, 0.3, -0.2),
    ico(0x8a8f99, 0.45, 0, 0.45, 0.25, 0.3),
    ico(0x767b85, 0.4, 0, 0.05, 0.4, -0.5),
    ico(0x80858f, 0.35, 0, 0.1, 0.55, 0.1),
  ], 0.8),
  def('ice-spikes', 'Ice Spikes', 'rock', [
    cone(0xcfe6f2, 0.3, 1.6, 0, 0.8, 0),
    cone(0xbfe0ee, 0.22, 1.1, 0.4, 0.55, 0.1),
    cone(0xdaeef7, 0.18, 0.9, -0.35, 0.45, -0.15),
  ], 0.6),
  def('lava-rock', 'Lava Rock', 'rock', [
    ico(0x2e2a2c, 1.0, 0, 0, 0.5, 0),
    ico(0x35302f, 0.6, 0, 0.5, 0.4, 0.3),
    box(0xff5a1e, 0.5, 0.08, 0.12, 0.2, 0.7, 0.4),
    box(0xff7a2e, 0.12, 0.08, 0.5, -0.3, 0.6, -0.2),
  ], 0.9),
  def('chest', 'Treasure Chest', 'misc', [
    box(0x6e4a2e, 0.9, 0.5, 0.6, 0, 0.3, 0),
    box(0x5a3a1e, 0.92, 0.26, 0.62, 0, 0.62, 0),
    box(0xc9a94a, 0.12, 0.18, 0.66, 0, 0.45, 0),
    box(0xc9a94a, 0.92, 0.06, 0.06, 0, 0.5, 0.3),
  ], 0.5),
  def('banner-pole', 'Banner Pole', 'misc', [
    cyl(WOOD, 0.08, 0.1, 3.2, 0, 1.6, 0),
    box(WOOD_DK, 0.06, 0.06, 0.9, 0, 3.0, 0.45),
    box(0x8a3b3b, 0.06, 1.5, 0.8, 0, 2.3, 0.5),
  ]),

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
