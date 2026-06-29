// World spawn table (pure data): every authored enemy placement across the six
// regions, Lv 1–30. Bootstrap places these; tests assert coverage (no level gaps).
// Keeping it as pure content (no Three.js) makes the world data testable.
//
// Round-2 spread: each region's camps now fan out along a depth gradient — lower levels
// near the region's threshold (closer to the hub), higher levels (and the elite camp +
// rare-named boss-guard) deep in the frontier near the world boss — so exploring further
// out is rewarded and the whole large map (layout.ts) is used. The Greenmarch starter
// ring right outside town is unchanged (the first mob stays within melee of spawn —
// onboarding + the boot e2e depend on this). Region boundaries are regions.ts (±120 by
// direction); every position below resolves to its intended region via regionAt.

import type { EnemyTemplateId, Tier } from './enemies';

export interface Spawn {
  id: EnemyTemplateId;
  x: number;
  z: number;
  level: number;
  tier?: Tier;
  /** Display name override (unique rare/elite-named spawns). */
  name?: string;
}

export const WORLD_SPAWNS: Spawn[] = [
  // ── The Greenmarch (Lv 1–5, the heartland around Oathhold) ──
  // Starter ring — right outside town, +Z. Keep the nearest mob within melee of spawn.
  { id: 'bloomhusk', x: 0, z: 6, level: 1 },
  { id: 'bloomhusk', x: 3, z: 9, level: 1 },
  { id: 'reaver', x: -3, z: 9, level: 1 },
  { id: 'bloomhusk', x: 6, z: 12, level: 2 },
  { id: 'wisp', x: -6, z: 12, level: 2 },
  { id: 'reaver', x: 0, z: 14, level: 2 },
  { id: 'bloomhusk', x: 9, z: 16, level: 4 },
  { id: 'wisp', x: -9, z: 15, level: 4 },
  { id: 'reaver', x: 4, z: 17, level: 5 },
  // Greenmarch elite anchor.
  { id: 'bloomhusk', x: 12, z: 18, level: 3, tier: 'elite', name: 'Bloomhusk Matriarch' },
  // Heartland camps spread across the wider Greenmarch (radius ~55–115, fields to explore).
  { id: 'bloomhusk', x: 58, z: 36, level: 2 },
  { id: 'reaver', x: 86, z: 14, level: 3 },
  { id: 'wisp', x: 98, z: -28, level: 4 },
  { id: 'bloomhusk', x: 72, z: -68, level: 3 },
  { id: 'reaver', x: 34, z: -86, level: 4 },
  { id: 'wisp', x: -34, z: -84, level: 3 },
  { id: 'reaver', x: -72, z: -62, level: 4 },
  { id: 'bloomhusk', x: -98, z: -16, level: 4 },
  { id: 'wisp', x: -104, z: 38, level: 5 },
  { id: 'reaver', x: -58, z: 84, level: 4 },
  { id: 'bloomhusk', x: 24, z: 100, level: 5 },
  { id: 'wisp', x: 92, z: 86, level: 5 },

  // ── Thornwood Vale (Lv 6–10, far NE): Weavers + Sporeling swarms + Bramblekin ──
  { id: 'weaver', x: 126, z: 127, level: 6 },
  { id: 'sporeling', x: 136, z: 124, level: 6 },
  { id: 'weaver', x: 124, z: 138, level: 6 },
  { id: 'sporeling', x: 148, z: 132, level: 7 },
  { id: 'bramblekin', x: 140, z: 158, level: 7 },
  { id: 'reaver', x: 166, z: 142, level: 8 },
  // Pack support deep in the vale.
  { id: 'sporemother', x: 160, z: 164, level: 8 },
  { id: 'sporeling', x: 178, z: 150, level: 8 },
  { id: 'warchief', x: 192, z: 178, level: 9 },
  { id: 'weaver', x: 176, z: 206, level: 10 },
  { id: 'bramblekin', x: 212, z: 162, level: 10 },
  // Rare-named, deep in Thornwood.
  { id: 'bramblekin', x: 214, z: 206, level: 10, tier: 'rare', name: 'Old Thornback' },

  // ── The Sunken Fen (Lv 11–15, far south): Drudge + Fenstalker + Mireling; blight. ──
  { id: 'drudge', x: 12, z: -128, level: 11 },
  { id: 'drudge', x: -16, z: -134, level: 11 },
  { id: 'fenstalker', x: 36, z: -132, level: 12 },
  { id: 'mireling', x: -34, z: -150, level: 12 },
  { id: 'fenstalker', x: 90, z: -150, level: 12 },
  { id: 'mireling', x: -60, z: -178, level: 13 },
  { id: 'drudge', x: -22, z: -196, level: 13 },
  { id: 'fenstalker', x: 46, z: -222, level: 14 },
  { id: 'mireling', x: -44, z: -236, level: 14 },
  { id: 'drudge', x: 16, z: -258, level: 15 },
  // Fen elite camp (the crypt approach): an elite Crypt Drudge backed by a Sporemother.
  { id: 'drudge', x: -76, z: -210, level: 13, tier: 'elite', name: 'Crypt Drudge' },
  { id: 'sporemother', x: -84, z: -204, level: 13 },
  { id: 'drudge', x: -68, z: -218, level: 13 },
  // Rare: the Henge-Keeper, deep in the bog.
  { id: 'mireling', x: -6, z: -288, level: 15, tier: 'rare', name: 'The Henge-Keeper' },

  // ── The Emberreach (Lv 16–20, far west): Magmaw + Ashen Reavers + Cinderborn; fire. ──
  { id: 'magmaw', x: -128, z: -8, level: 16 },
  { id: 'ashreaver', x: -134, z: 16, level: 16 },
  { id: 'cinderborn', x: -140, z: -30, level: 17 },
  { id: 'magmaw', x: -162, z: 30, level: 17 },
  { id: 'ashreaver', x: -176, z: -40, level: 17 },
  { id: 'cinderborn', x: -188, z: 22, level: 18 },
  { id: 'magmaw', x: -204, z: -22, level: 19 },
  { id: 'ashreaver', x: -228, z: 36, level: 19 },
  { id: 'magmaw', x: -242, z: -30, level: 20 },
  // Ember elite camp (the warcamp): an Ember Warlord (pack-leader) + an elite caster.
  { id: 'emberwarlord', x: -210, z: 6, level: 19 },
  { id: 'cinderborn', x: -200, z: 20, level: 18, tier: 'elite', name: 'Cult Pyremaster' },
  { id: 'cinderborn', x: -218, z: -10, level: 18 },
  // Rare: Scorchmaw, deep west on the road to Emberhorn's caldera.
  { id: 'magmaw', x: -272, z: 2, level: 20, tier: 'rare', name: 'Scorchmaw' },

  // ── The Riven Peaks (Lv 21–25, far east): Rimebound + Frostfang + Revenant; frost.
  //    Revenants are holy-weak. ──
  { id: 'frostfang', x: 128, z: 18, level: 21 },
  { id: 'frostfang', x: 134, z: -26, level: 21 },
  { id: 'rimebound', x: 146, z: 30, level: 22 },
  { id: 'revenant', x: 158, z: -10, level: 22 },
  { id: 'frostfang', x: 168, z: 44, level: 23 },
  { id: 'rimebound', x: 182, z: 12, level: 23 },
  { id: 'revenant', x: 186, z: 62, level: 24 },
  { id: 'frostfang', x: 200, z: -34, level: 24 },
  { id: 'rimebound', x: 216, z: 30, level: 25 },
  // Riven elite camp (the frozen battlefield): an elite Frost Revenant Lord + a guard.
  { id: 'revenant', x: 206, z: 4, level: 24, tier: 'elite', name: 'Frost Revenant Lord' },
  { id: 'rimebound', x: 214, z: -8, level: 24 },
  // Rare: Hoarfang, alpha of the Frostfang packs, deep east.
  { id: 'frostfang', x: 240, z: 2, level: 25, tier: 'rare', name: 'Hoarfang the White' },

  // ── Gravereach (Lv 26–30, far north): Wraith + Bonewrought + Forsworn; undead, holy-weak. ──
  { id: 'wraith', x: 10, z: 128, level: 26 },
  { id: 'bonewrought', x: -18, z: 134, level: 26 },
  { id: 'wraith', x: 40, z: 144, level: 27 },
  { id: 'bonewrought', x: -40, z: 156, level: 27 },
  { id: 'forsworn', x: 64, z: 168, level: 28 },
  { id: 'bonewrought', x: -56, z: 184, level: 28 },
  { id: 'wraith', x: 24, z: 200, level: 28 },
  { id: 'forsworn', x: -28, z: 224, level: 29 },
  { id: 'bonewrought', x: 48, z: 240, level: 30 },
  { id: 'wraith', x: -10, z: 258, level: 30 },
  // Gravereach inner-court elite camp: a Forsworn Knight-Captain + bone constructs.
  { id: 'forsworn', x: -64, z: 224, level: 29, tier: 'elite', name: 'Forsworn Knight-Captain' },
  { id: 'bonewrought', x: -56, z: 234, level: 29 },
  // Rare: Gravewarden Sael, a named Forsworn deep in the Hollow Crown.
  { id: 'forsworn', x: 6, z: 282, level: 30, tier: 'rare', name: 'Gravewarden Sael' },
];
