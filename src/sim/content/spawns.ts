// World spawn table (pure data): every authored enemy placement across the six
// regions, Lv 1–30. Bootstrap places these; tests assert coverage (no level gaps).
// Keeping it as pure content (no Three.js) makes the world data testable.
//
// 0.6.0 map expansion: the world grew from a 100 m greybox into a large open world
// (layout.ts / regions.ts). The Greenmarch starter camp still sits right outside town
// (the first mob is within melee range of spawn — onboarding + the boot e2e depend on
// this), while the five higher regions are now spread far out in their directions, each
// a distinct frontier with several camps. Enemy families, levels, tiers and named
// spawns are unchanged from the validated 1→30 layout — only their world positions and
// camp count grew. (World bosses are added per-zone in 0.6.0 CP2; not placed here.)

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
  // Heartland camps — Lv 1–5 spread across the wider Greenmarch (fields to explore).
  { id: 'bloomhusk', x: 28, z: 24, level: 2 },
  { id: 'reaver', x: 40, z: 32, level: 4 },
  { id: 'bloomhusk', x: 56, z: 24, level: 5 },
  { id: 'wisp', x: 33, z: 44, level: 5 },
  { id: 'bloomhusk', x: -22, z: 34, level: 3 },
  { id: 'reaver', x: -32, z: 40, level: 3 },
  { id: 'wisp', x: -40, z: 18, level: 4 },
  { id: 'reaver', x: -44, z: -10, level: 5 },
  { id: 'bloomhusk', x: 18, z: -30, level: 3 },
  { id: 'wisp', x: 10, z: -46, level: 5 },
  // ── Thornwood Vale (Lv 6–10, far NE): fast Weavers + Sporeling swarms + Bramblekin ──
  { id: 'weaver', x: 130, z: 134, level: 6 },
  { id: 'weaver', x: 136, z: 140, level: 6 },
  { id: 'sporeling', x: 128, z: 144, level: 6 },
  { id: 'sporeling', x: 140, z: 150, level: 6 },
  { id: 'sporeling', x: 126, z: 132, level: 6 },
  { id: 'bramblekin', x: 146, z: 138, level: 7 },
  { id: 'reaver', x: 138, z: 152, level: 7 },
  // Thornwood support/pack-leader: a Sporemother healing the swarm + a Warchief.
  { id: 'sporemother', x: 132, z: 140, level: 8 },
  { id: 'warchief', x: 150, z: 148, level: 9 },
  { id: 'weaver', x: 144, z: 162, level: 10 },
  { id: 'bramblekin', x: 160, z: 144, level: 10 },
  { id: 'sporeling', x: 170, z: 158, level: 9 },
  // Rare-named, deep in Thornwood.
  { id: 'bramblekin', x: 166, z: 168, level: 8, tier: 'rare', name: 'Old Thornback' },
  // ── The Sunken Fen (Lv 11–15, far south): Drudge + Fenstalker + Mireling; blight. ──
  { id: 'drudge', x: 8, z: -132, level: 11 },
  { id: 'drudge', x: -12, z: -138, level: 11 },
  { id: 'fenstalker', x: 22, z: -146, level: 12 },
  { id: 'mireling', x: -24, z: -150, level: 12 },
  { id: 'fenstalker', x: -40, z: -160, level: 12 },
  { id: 'fenstalker', x: -6, z: -160, level: 13 },
  { id: 'mireling', x: 14, z: -172, level: 14 },
  { id: 'drudge', x: 24, z: -178, level: 14 },
  { id: 'drudge', x: -18, z: -186, level: 15 },
  // Fen elite camp (crypt approach): an elite Crypt Drudge backed by a Sporemother.
  { id: 'drudge', x: 44, z: -150, level: 13, tier: 'elite', name: 'Crypt Drudge' },
  { id: 'sporemother', x: 50, z: -146, level: 13 },
  { id: 'drudge', x: 38, z: -152, level: 13 },
  // Rare: the Henge-Keeper, deep in the bog.
  { id: 'mireling', x: 0, z: -198, level: 15, tier: 'rare', name: 'The Henge-Keeper' },
  // ── The Emberreach (Lv 16–20, far west): Magmaw + Ashen Reavers + Cinderborn; fire. ──
  { id: 'magmaw', x: -132, z: -6, level: 16 },
  { id: 'ashreaver', x: -140, z: 12, level: 16 },
  { id: 'cinderborn', x: -148, z: -8, level: 17 },
  { id: 'magmaw', x: -156, z: -18, level: 17 },
  { id: 'ashreaver', x: -138, z: -34, level: 17 },
  { id: 'ashreaver', x: -150, z: 24, level: 18 },
  { id: 'magmaw', x: -184, z: -16, level: 20 },
  { id: 'magmaw', x: -178, z: 32, level: 19 },
  // Ember elite camp (the warcamp): an Ember Warlord (pack-leader) + an elite caster.
  { id: 'emberwarlord', x: -168, z: 4, level: 19 },
  { id: 'cinderborn', x: -160, z: 18, level: 18, tier: 'elite', name: 'Cult Pyremaster' },
  { id: 'cinderborn', x: -176, z: -10, level: 18 },
  // Rare: Scorchmaw, a roaming Magmaw alpha, deep west (the road to Emberhorn's caldera).
  { id: 'magmaw', x: -202, z: 0, level: 20, tier: 'rare', name: 'Scorchmaw' },
  // ── The Riven Peaks (Lv 21–25, far east): Rimebound + Frostfang + Revenant; frost.
  //    Revenants are holy-weak. ──
  { id: 'frostfang', x: 132, z: 16, level: 21 },
  { id: 'frostfang', x: 138, z: 26, level: 21 },
  { id: 'frostfang', x: 140, z: -30, level: 22 },
  { id: 'rimebound', x: 146, z: 8, level: 22 },
  { id: 'revenant', x: 152, z: 22, level: 22 },
  { id: 'frostfang', x: 150, z: 34, level: 23 },
  { id: 'rimebound', x: 162, z: 14, level: 23 },
  { id: 'revenant', x: 158, z: 40, level: 25 },
  { id: 'revenant', x: 168, z: 60, level: 24 },
  // Riven elite camp (the frozen battlefield): an elite Frost Revenant Lord + a guard.
  { id: 'revenant', x: 172, z: 6, level: 24, tier: 'elite', name: 'Frost Revenant Lord' },
  { id: 'rimebound', x: 180, z: 16, level: 24 },
  // Rare: Hoarfang, alpha of the Frostfang packs, deep east.
  { id: 'frostfang', x: 200, z: -12, level: 25, tier: 'rare', name: 'Hoarfang the White' },
  // ── Gravereach (Lv 26–30, far north): Wraith + Bonewrought + Forsworn; undead, holy-weak. ──
  { id: 'wraith', x: 8, z: 132, level: 26 },
  { id: 'bonewrought', x: -16, z: 138, level: 26 },
  { id: 'wraith', x: 20, z: 146, level: 27 },
  { id: 'bonewrought', x: -26, z: 150, level: 27 },
  { id: 'bonewrought', x: -44, z: 160, level: 27 },
  { id: 'forsworn', x: 0, z: 160, level: 28 },
  { id: 'forsworn', x: 60, z: 150, level: 28 },
  { id: 'bonewrought', x: -12, z: 186, level: 30 },
  { id: 'wraith', x: 16, z: 192, level: 30 },
  // Gravereach inner-court elite camp: a Forsworn Knight-Captain + bone constructs.
  { id: 'forsworn', x: 42, z: 168, level: 29, tier: 'elite', name: 'Forsworn Knight-Captain' },
  { id: 'bonewrought', x: 50, z: 160, level: 29 },
  { id: 'wraith', x: 32, z: 178, level: 29 },
  // Rare: Gravewarden Sael, a named Forsworn deep in the Hollow Crown.
  { id: 'forsworn', x: 0, z: 204, level: 30, tier: 'rare', name: 'Gravewarden Sael' },
];
