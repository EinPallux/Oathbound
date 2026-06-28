// Relics (0.6.0 CP3): the aspirational apex of the gear chase. Unlike rolled gear,
// each Relic is a hand-designed *unique* (rarity `relic`) with strong fixed stats AND a
// build-enabling effect. They are the rarest drops — one pool per world boss. Pure data
// + helpers (no Three.js/DOM). Effects are realised by a small, shared hook layer:
//   - equipped relics aggregate into a `RelicMods` bundle (recomputeDerived),
//   - combat reads it in src/sim/combat/apply.ts (damage) and src/sim/rewards.ts (kills).
// See docs/design/ENDGAME_FOUNDATION.md#relics and docs/design/ITEMS_AND_EQUIPMENT.md.

import type { Item, EquipSlot, Affix, Equipment, RelicMods, PrimaryStatId } from '../../core/ecs/components';
import type { Rng } from '../../core/rng';
import type { BossId } from '../content/bosses';
import { scoreItem } from './items';

export type RelicId = 'ashbrand' | 'rimewyrm-heart' | 'hollow-crown' | 'bloodroot-sigil';

/** The fixed effect a relic grants (keys the RelicMods contribution + the hooks). */
export type RelicEffectId = 'execute' | 'boss-slayer' | 'reaper' | 'bloodcrit';

export interface RelicDef {
  id: RelicId;
  name: string;
  slot: EquipSlot;
  ilvl: number;
  primary: { stat: PrimaryStatId; value: number };
  armor: number;
  affixes: Affix[];
  effect: RelicEffectId;
  /** One-line player-facing effect text (HUD toast + inventory tooltip). */
  effectDesc: string;
  flavor: string;
}

// All relics sit at the apex item level (≈ a Reinforced Legendary) with three strong
// fixed affixes; the unique effect is the real draw. Stats aren't class-locked, so an
// off-stat class still equips a relic for its effect (a real, build-shaping trade-off).
export const RELICS: Record<RelicId, RelicDef> = {
  ashbrand: {
    id: 'ashbrand',
    name: "Ashbrand, the Tyrant's Horn",
    slot: 'weapon',
    ilvl: 33,
    primary: { stat: 'STR', value: 60 },
    armor: 0,
    affixes: [
      { id: 'crit', value: 0.053 },
      { id: 'haste', value: 0.041 },
      { id: 'leech', value: 0.041 },
    ],
    effect: 'execute',
    effectDesc: 'Execute: +50% damage to targets below 35% health.',
    flavor: "Snapped from Emberhorn's skull, it still smoulders with the tyrant's fury.",
  },
  'rimewyrm-heart': {
    id: 'rimewyrm-heart',
    name: 'Heart of the Rimewyrm',
    slot: 'amulet',
    ilvl: 33,
    primary: { stat: 'VIT', value: 28 },
    armor: 0,
    affixes: [
      { id: 'vit', value: 20 },
      { id: 'resistFrost', value: 131 },
      { id: 'armor', value: 30 },
    ],
    effect: 'boss-slayer',
    effectDesc: 'Boss-slayer: +20% damage to world bosses, −15% damage taken from them.',
    flavor: 'The frozen heart of the wyrm never stops beating — and it hungers for greater prey.',
  },
  'hollow-crown': {
    id: 'hollow-crown',
    name: 'Crown of the Hollow King',
    slot: 'head',
    ilvl: 33,
    primary: { stat: 'VIT', value: 24 },
    armor: 60,
    affixes: [
      { id: 'vit', value: 20 },
      { id: 'leech', value: 0.041 },
      { id: 'resistBlight', value: 131 },
    ],
    effect: 'reaper',
    effectDesc: 'Reaper: each kill heals 8% of max health and cuts all cooldowns by 1.5s.',
    flavor: 'Maelgrith wore it through a hundred deaths. It remembers every one.',
  },
  'bloodroot-sigil': {
    id: 'bloodroot-sigil',
    name: "Sael's Bloodroot Sigil",
    slot: 'ring1',
    ilvl: 33,
    primary: { stat: 'STR', value: 40 },
    armor: 0,
    affixes: [
      { id: 'crit', value: 0.053 },
      { id: 'leech', value: 0.041 },
      { id: 'vit', value: 20 },
    ],
    effect: 'bloodcrit',
    effectDesc: 'Bloodroot: critical hits leech 25% of the damage dealt as health.',
    flavor: 'Gravewarden Sael fed it on the fallen. It drinks still.',
  },
};

/** Which relics each world boss can drop (its relic pool). */
export const RELIC_DROPS: Record<BossId, RelicId[]> = {
  emberhorn: ['ashbrand'],
  rimewyrm: ['rimewyrm-heart'],
  maelgrith: ['hollow-crown', 'bloodroot-sigil'],
};

/** Chance a qualifying world-boss kill drops a relic (replacing the normal roll). */
export const RELIC_DROP_CHANCE = 0.08;

export const EMPTY_RELIC_MODS: RelicMods = {
  executeThreshold: 0,
  executeMult: 0,
  bossDamageBonus: 0,
  bossDamageResist: 0,
  critLeech: 0,
  killHealFrac: 0,
  killCdr: 0,
};

let relicUid = 0;
function makeUid(rng: Rng): string {
  relicUid = (relicUid + 1) % 1_000_000;
  return `rel_${Math.floor(rng.next() * 1e9).toString(36)}${relicUid.toString(36)}`;
}

/** Instantiate a relic as a concrete (locked) inventory item. Deterministic per RNG. */
export function makeRelic(rng: Rng, id: RelicId): Item {
  const def = RELICS[id];
  const item: Item = {
    uid: makeUid(rng),
    name: def.name,
    slot: def.slot,
    rarity: 'relic',
    ilvl: def.ilvl,
    primary: { ...def.primary },
    armor: def.armor,
    affixes: def.affixes.map((a) => ({ ...a })),
    score: 0,
    locked: true, // protect the apex drop from accidental salvage/sell
    reinforced: 0,
    relic: id,
  };
  item.score = scoreItem(item);
  return item;
}

/** Fold one relic's effect into a mods bundle (mutates + returns it). */
function applyEffect(mods: RelicMods, effect: RelicEffectId): RelicMods {
  switch (effect) {
    case 'execute':
      mods.executeThreshold = Math.max(mods.executeThreshold, 0.35);
      mods.executeMult += 0.5;
      break;
    case 'boss-slayer':
      mods.bossDamageBonus += 0.2;
      mods.bossDamageResist += 0.15;
      break;
    case 'reaper':
      mods.killHealFrac += 0.08;
      mods.killCdr += 1.5;
      break;
    case 'bloodcrit':
      mods.critLeech += 0.25;
      break;
  }
  return mods;
}

/** Aggregate the effects of all equipped relics into a fresh RelicMods bundle. */
export function relicModsFromEquipment(eq: Equipment): RelicMods {
  const mods: RelicMods = { ...EMPTY_RELIC_MODS };
  for (const item of Object.values(eq.slots)) {
    if (item?.relic && item.relic in RELICS) applyEffect(mods, RELICS[item.relic as RelicId].effect);
  }
  return mods;
}

/** Roll whether a boss kill yields a relic; returns the chosen RelicId or null. */
export function rollRelicDrop(rng: Rng, bossId: string, chance = RELIC_DROP_CHANCE): RelicId | null {
  const pool = RELIC_DROPS[bossId as BossId];
  if (!pool || pool.length === 0) return null;
  if (rng.next() >= chance) return null;
  return pool[rng.int(pool.length)];
}

/** Player-facing effect text for a relic id (HUD/inventory). '' if unknown. */
export function relicEffectDesc(id: string): string {
  return id in RELICS ? RELICS[id as RelicId].effectDesc : '';
}
