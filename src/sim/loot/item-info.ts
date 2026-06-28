// Item presentation helpers (pure, no DOM): human-readable stat lines for an item, and
// an attribute-level comparison ("what changes if I equip this over what's in the slot").
// Used by the inventory tooltip (src/render/item-tooltip.ts) and unit-tested directly.

import type { Item, Affix, AffixId, EquipSlot } from '../../core/ecs/components';

/** Combat attributes an item can contribute to (primary stat + armor + affix effects). */
export type AttrKey =
  | 'STR'
  | 'DEX'
  | 'SPR'
  | 'VIT'
  | 'armor'
  | 'crit'
  | 'haste'
  | 'leech'
  | 'healing'
  | 'resistFire'
  | 'resistFrost'
  | 'resistBlight';

export const ATTR_LABEL: Record<AttrKey, string> = {
  STR: 'Strength',
  DEX: 'Dexterity',
  SPR: 'Spirit',
  VIT: 'Vitality',
  armor: 'Armor',
  crit: 'Crit',
  haste: 'Haste',
  leech: 'Leech',
  healing: 'Healing',
  resistFire: 'Fire Resist',
  resistFrost: 'Frost Resist',
  resistBlight: 'Blight Resist',
};

/** A stable display order for stat lines / comparisons. */
const ATTR_ORDER: AttrKey[] = [
  'STR', 'DEX', 'SPR', 'VIT', 'armor', 'crit', 'haste', 'leech', 'healing',
  'resistFire', 'resistFrost', 'resistBlight',
];

const AFFIX_ATTR: Record<AffixId, AttrKey> = {
  crit: 'crit',
  haste: 'haste',
  leech: 'leech',
  armor: 'armor',
  vit: 'VIT',
  healing: 'healing',
  resistFire: 'resistFire',
  resistFrost: 'resistFrost',
  resistBlight: 'resistBlight',
};

/** Percent-valued attributes are stored as fractions (0.05 = 5%); the rest are flat. */
const PERCENT = new Set<AttrKey>(['crit', 'haste', 'leech']);

export const SLOT_LABEL: Record<EquipSlot, string> = {
  weapon: 'Weapon',
  offhand: 'Off-hand',
  head: 'Head',
  chest: 'Chest',
  hands: 'Hands',
  legs: 'Legs',
  feet: 'Feet',
  amulet: 'Amulet',
  ring1: 'Ring 1',
  ring2: 'Ring 2',
};

/** Format an attribute value (signed if asked), as a percent or a flat integer. */
export function formatAttr(key: AttrKey, value: number, signed = false): string {
  if (PERCENT.has(key)) {
    const p = value * 100;
    const sign = signed && p >= 0 ? '+' : '';
    return `${sign}${p.toFixed(1)}%`;
  }
  const v = Math.round(value);
  const sign = signed && v >= 0 ? '+' : '';
  return `${sign}${v}`;
}

/** "Crit +5.3%", "Armor +30" — one affix as a labelled line. */
export function affixText(a: Affix): string {
  const key = AFFIX_ATTR[a.id];
  return `${ATTR_LABEL[key]} ${formatAttr(key, a.value, true)}`;
}

/** All of an item's own stat lines (primary, base armor, then affixes) for a tooltip. */
export function itemStatLines(item: Item): string[] {
  const lines: string[] = [];
  lines.push(`${ATTR_LABEL[item.primary.stat]} ${formatAttr(item.primary.stat, item.primary.value, true)}`);
  if (item.armor > 0) lines.push(`${ATTR_LABEL.armor} ${formatAttr('armor', item.armor, true)}`);
  for (const a of item.affixes) lines.push(affixText(a));
  return lines;
}

/** Roll an item's total contribution per attribute (primary + base armor + affixes). */
export function itemContributions(item: Item): Partial<Record<AttrKey, number>> {
  const c: Partial<Record<AttrKey, number>> = {};
  const add = (k: AttrKey, v: number): void => {
    c[k] = (c[k] ?? 0) + v;
  };
  add(item.primary.stat, item.primary.value);
  if (item.armor) add('armor', item.armor);
  for (const a of item.affixes) add(AFFIX_ATTR[a.id], a.value);
  return c;
}

export interface StatDelta {
  key: AttrKey;
  label: string;
  /** Signed, formatted change (e.g. "+12", "-2.1%"). */
  text: string;
  /** -1 / 0 / +1 — for colouring. */
  sign: number;
}

/** Net per-attribute change from equipping `item` in place of `equipped` (or nothing). */
export function compareItems(item: Item, equipped: Item | null): StatDelta[] {
  const a = itemContributions(item);
  const b = equipped ? itemContributions(equipped) : {};
  const out: StatDelta[] = [];
  for (const key of ATTR_ORDER) {
    const delta = (a[key] ?? 0) - (b[key] ?? 0);
    if (Math.abs(delta) < 1e-9) continue;
    out.push({ key, label: ATTR_LABEL[key], text: formatAttr(key, delta, true), sign: Math.sign(delta) });
  }
  return out;
}
