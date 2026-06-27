// World spawn table (pure data): every authored enemy placement across the six
// regions, Lv 1–30. Bootstrap places these; tests assert coverage (no level gaps).
// Keeping it as pure content (no Three.js) makes the world data testable.

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
  // ── Greenmarch (Lv 1–5, +Z near the hub) ──
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
  // ── Thornwood Vale (Lv 6–10, north-east): fast Weavers + Sporeling swarms + Bramblekin ──
  { id: 'weaver', x: 30, z: 30, level: 6 },
  { id: 'weaver', x: 33, z: 32, level: 6 },
  { id: 'sporeling', x: 28, z: 34, level: 6 },
  { id: 'sporeling', x: 31, z: 36, level: 6 },
  { id: 'sporeling', x: 27, z: 31, level: 6 },
  { id: 'bramblekin', x: 36, z: 34, level: 7 },
  { id: 'reaver', x: 34, z: 39, level: 7 },
  // Thornwood support/pack-leader: a Sporemother healing the swarm + a Warchief.
  { id: 'sporemother', x: 29, z: 33, level: 8 },
  { id: 'warchief', x: 38, z: 37, level: 9 },
  { id: 'weaver', x: 35, z: 43, level: 10 },
  { id: 'bramblekin', x: 43, z: 36, level: 10 },
  // Rare-named, deep in Thornwood.
  { id: 'bramblekin', x: 41, z: 41, level: 8, tier: 'rare', name: 'Old Thornback' },
  // ── The Sunken Fen (Lv 11–15, south): Drudge + Fenstalker + Mireling; blight. ──
  { id: 'drudge', x: 2, z: -26, level: 11 },
  { id: 'drudge', x: -4, z: -28, level: 11 },
  { id: 'fenstalker', x: 7, z: -30, level: 12 },
  { id: 'mireling', x: -8, z: -31, level: 12 },
  { id: 'fenstalker', x: -2, z: -34, level: 13 },
  { id: 'mireling', x: 5, z: -38, level: 14 },
  { id: 'drudge', x: -6, z: -40, level: 15 },
  // Fen elite camp (crypt approach): an elite Crypt Drudge backed by a Sporemother.
  { id: 'drudge', x: 14, z: -34, level: 13, tier: 'elite', name: 'Crypt Drudge' },
  { id: 'sporemother', x: 16, z: -31, level: 13 },
  { id: 'drudge', x: 11, z: -33, level: 13 },
  // Rare: the Henge-Keeper, deep in the bog.
  { id: 'mireling', x: 0, z: -44, level: 15, tier: 'rare', name: 'The Henge-Keeper' },
  // ── The Emberreach (Lv 16–20, west): Magmaw + Ashen Reavers + Cinderborn; fire. ──
  { id: 'magmaw', x: -26, z: -6, level: 16 },
  { id: 'ashreaver', x: -30, z: 2, level: 16 },
  { id: 'cinderborn', x: -32, z: -3, level: 17 },
  { id: 'magmaw', x: -34, z: -9, level: 17 },
  { id: 'ashreaver', x: -33, z: 8, level: 18 },
  { id: 'magmaw', x: -42, z: -8, level: 20 },
  // Ember elite camp (the warcamp): an Ember Warlord (pack-leader) + an elite caster.
  { id: 'emberwarlord', x: -38, z: 1, level: 19 },
  { id: 'cinderborn', x: -36, z: 5, level: 18, tier: 'elite', name: 'Cult Pyremaster' },
  { id: 'cinderborn', x: -40, z: -3, level: 18 },
  // Rare: Emberhorn, a roaming Magmaw mini-boss, deep west.
  { id: 'magmaw', x: -45, z: 0, level: 20, tier: 'rare', name: 'Emberhorn' },
  // ── The Riven Peaks (Lv 21–25, east): Rimebound + Frostfang + Revenant; frost.
  //    Revenants are holy-weak. ──
  { id: 'frostfang', x: 26, z: 6, level: 21 },
  { id: 'frostfang', x: 29, z: 10, level: 21 },
  { id: 'rimebound', x: 31, z: 4, level: 22 },
  { id: 'revenant', x: 34, z: 9, level: 22 },
  { id: 'frostfang', x: 33, z: 13, level: 23 },
  { id: 'rimebound', x: 38, z: 6, level: 23 },
  { id: 'revenant', x: 36, z: 14, level: 25 },
  // Riven elite camp (the frozen battlefield): an elite Frost Revenant Lord + a guard.
  { id: 'revenant', x: 41, z: 2, level: 24, tier: 'elite', name: 'Frost Revenant Lord' },
  { id: 'rimebound', x: 43, z: 6, level: 24 },
  // Rare: Hoarfang, alpha of the Frostfang packs, deep east.
  { id: 'frostfang', x: 46, z: -4, level: 25, tier: 'rare', name: 'Hoarfang the White' },
  // ── Gravereach (Lv 26–30, north): Wraith + Bonewrought + Forsworn; undead, holy-weak. ──
  { id: 'wraith', x: 2, z: 26, level: 26 },
  { id: 'bonewrought', x: -5, z: 28, level: 26 },
  { id: 'wraith', x: 6, z: 30, level: 27 },
  { id: 'bonewrought', x: -9, z: 31, level: 27 },
  { id: 'forsworn', x: 0, z: 34, level: 28 },
  { id: 'bonewrought', x: -3, z: 43, level: 30 },
  { id: 'wraith', x: 4, z: 44, level: 30 },
  // Gravereach inner-court elite camp: a Forsworn Knight-Captain + bone constructs.
  { id: 'forsworn', x: 11, z: 39, level: 29, tier: 'elite', name: 'Forsworn Knight-Captain' },
  { id: 'bonewrought', x: 14, z: 36, level: 29 },
  { id: 'wraith', x: 8, z: 41, level: 29 },
  // Rare: Gravewarden Sael, a named Forsworn deep in the Hollow Crown.
  { id: 'forsworn', x: 0, z: 46, level: 30, tier: 'rare', name: 'Gravewarden Sael' },
];
