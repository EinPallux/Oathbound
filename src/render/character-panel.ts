// Character sheet (DOM, interactive — toggled with C). A modern paper-doll layout: a
// class header, the equipped gear (with reinforce + hover comparison), the live derived
// combat stats, and the talent choices. Currencies now live in the Inventory bag. Reads
// sim state; all mutations go through callbacks so the sim stays authoritative. ADR-002.

import type { World, Entity } from '../core/ecs/world';
import {
  C,
  type Item,
  type EquipSlot,
  type Inventory,
  type Equipment,
  type Progression,
  type PlayerClass,
  type CombatState,
  type Offense,
  type Defense,
  type Health,
} from '../core/ecs/components';
import { EQUIP_SLOTS } from '../sim/loot/items';
import { relicEffectDesc } from '../sim/loot/relics';
import { SLOT_LABEL, ATTR_LABEL } from '../sim/loot/item-info';
import { tierTag } from '../game/settings';
import { canReinforce, reinforceCost } from '../sim/reinforce';
import { getClass } from '../sim/classes';
import { ItemTooltip } from './item-tooltip';
import { icon } from './ui/icons';

const CLASS_ICON: Record<string, string> = { warrior: 'sword', hunter: 'bow', priest: 'staff' };

/** Map an equipment slot to a game-icon. */
function slotIcon(slot: EquipSlot): string {
  switch (slot) {
    case 'weapon': return 'sword';
    case 'offhand': return 'shield';
    case 'head': return 'helmet';
    case 'chest': return 'chest';
    case 'hands': return 'gauntlet';
    case 'feet': return 'boots';
    case 'legs': return 'belt';
    case 'amulet': return 'amulet';
    case 'ring1':
    case 'ring2': return 'ring';
    default: return 'crossed-swords';
  }
}

/** ` +N` reinforcement suffix for an item name, or '' if unreinforced. */
function reinSuffix(item: Item): string {
  const n = item.reinforced ?? 0;
  return n > 0 ? ` +${n}` : '';
}

export class CharacterPanel {
  private readonly root: HTMLDivElement;
  private readonly portraitEl: HTMLDivElement;
  private readonly nameEl: HTMLDivElement;
  private readonly subEl: HTMLDivElement;
  private readonly equipList: HTMLDivElement;
  private readonly stats: HTMLDivElement;
  private readonly talents: HTMLDivElement;
  private readonly tooltip: ItemTooltip;
  private visible = false;
  private lastSig = '';

  onReinforce: (item: Item) => void = () => {};
  onChooseTalent: (nodeId: string, option: number) => void = () => {};

  constructor(parent: HTMLElement, tooltip: ItemTooltip) {
    this.tooltip = tooltip;
    this.root = document.createElement('div');
    this.root.className = 'char-panel';
    this.root.style.display = 'none';

    // Header.
    const header = document.createElement('div');
    header.className = 'char-head';
    const title = document.createElement('div');
    title.className = 'char-title';
    title.innerHTML = `${icon('person')}<span>Character</span>`;
    const spacer = document.createElement('div');
    spacer.className = 'char-spacer';
    const close = document.createElement('button');
    close.className = 'char-icon-btn';
    close.title = 'Close (C)';
    close.textContent = '✕';
    close.onclick = () => this.close();
    header.append(title, spacer, close);
    this.root.appendChild(header);

    // Identity strip: portrait + class name + level/state.
    const ident = document.createElement('div');
    ident.className = 'char-ident';
    this.portraitEl = document.createElement('div');
    this.portraitEl.className = 'char-portrait';
    const idText = document.createElement('div');
    idText.className = 'char-idtext';
    this.nameEl = document.createElement('div');
    this.nameEl.className = 'char-name';
    this.subEl = document.createElement('div');
    this.subEl.className = 'char-sub';
    idText.append(this.nameEl, this.subEl);
    ident.append(this.portraitEl, idText);
    this.root.appendChild(ident);

    // Body: equipment column + stats/talents column.
    const body = document.createElement('div');
    body.className = 'char-body';

    const left = document.createElement('div');
    left.className = 'char-col';
    left.appendChild(sectionHead('Equipment'));
    this.equipList = document.createElement('div');
    this.equipList.className = 'char-equip';
    left.appendChild(this.equipList);

    const right = document.createElement('div');
    right.className = 'char-col';
    right.appendChild(sectionHead('Attributes'));
    this.stats = document.createElement('div');
    this.stats.className = 'char-stats';
    right.appendChild(this.stats);
    this.talents = document.createElement('div');
    this.talents.className = 'char-talents';
    right.appendChild(this.talents);

    body.append(left, right);
    this.root.appendChild(body);

    // Hover tooltips live on <body> so they aren't clipped by the panel or UI zoom.
    parent.appendChild(this.root);
  }

  toggle(): void {
    this.visible = !this.visible;
    this.root.style.display = this.visible ? 'block' : 'none';
    if (!this.visible) this.tooltip.hide();
    this.lastSig = '';
  }

  close(): void {
    if (!this.visible) return;
    this.visible = false;
    this.root.style.display = 'none';
    this.tooltip.hide();
  }

  get isOpen(): boolean {
    return this.visible;
  }

  update(world: World, player: Entity): void {
    if (!this.visible) return;
    const inv = world.get<Inventory>(player, C.Inventory);
    const eq = world.get<Equipment>(player, C.Equipment);
    const prog = world.get<Progression>(player, C.Progression);
    if (!inv || !eq || !prog) return;
    const pc = world.get<PlayerClass>(player, C.PlayerClass);
    const cs = world.get<CombatState>(player, C.CombatState);
    const cls = getClass(pc?.id ?? 'warrior');

    const sig =
      EQUIP_SLOTS.map((s) => {
        const it = eq.slots[s];
        return it ? `${it.uid}r${it.reinforced ?? 0}` : '-';
      }).join(',') +
      `|${inv.gold}|${inv.materials}|${prog.level}` +
      `|${pc?.id ?? ''}|${JSON.stringify(pc?.choices ?? {})}|${cs?.inCombat ? 'c' : ''}`;
    if (sig === this.lastSig) return;
    this.lastSig = sig;
    this.tooltip.hide();

    // Identity.
    this.portraitEl.innerHTML = icon(CLASS_ICON[cls.id] ?? 'sword');
    this.nameEl.textContent = cls.name;
    const state = cs?.inCombat ? 'In combat' : 'Rested';
    this.subEl.textContent = `Level ${prog.level} · ${state}`;

    // Equipment.
    this.equipList.replaceChildren();
    for (const slot of EQUIP_SLOTS) {
      const it = eq.slots[slot];
      const row = document.createElement('div');
      row.className = it ? `char-slot filled ${it.rarity}` : 'char-slot empty';
      row.innerHTML =
        `<span class="char-slot-ico">${icon(slotIcon(slot))}</span>` +
        `<span class="char-slot-meta">` +
        `<span class="char-slot-label">${SLOT_LABEL[slot]}</span>` +
        `<span class="char-slot-name ${it ? it.rarity : 'empty'}">${
          it ? `${tierTag(it.rarity)} ${it.name}${reinSuffix(it)}` : 'Empty'
        }</span>` +
        `</span>`;
      if (it) {
        const score = document.createElement('span');
        score.className = 'char-slot-score';
        score.textContent = `${it.score}`;
        row.appendChild(score);
        row.appendChild(this.reinforceButton(it, inv.gold, inv.materials));
        this.hover(row, it);
      }
      this.equipList.appendChild(row);
    }

    this.renderStats(world, player, pc);
    this.renderTalents(pc, prog.level, cs?.inCombat ?? false);
  }

  /** Character stats: the live derived combat stats, each with an explanatory tooltip. */
  private renderStats(world: World, player: Entity, pc: PlayerClass | undefined): void {
    this.stats.replaceChildren();
    const off = world.get<Offense>(player, C.Offense);
    const def = world.get<Defense>(player, C.Defense);
    const h = world.get<Health>(player, C.Health);
    if (!off || !def || !h) return;
    const primaryId = getClass(pc?.id ?? 'warrior').primaryStatId;

    const chip = (label: string, value: string, tip: string): void => {
      const el = document.createElement('span');
      el.className = 'char-stat';
      el.title = tip;
      el.innerHTML = `<span class="cs-k">${label}</span><span class="cs-v">${value}</span>`;
      this.stats.appendChild(el);
    };

    chip(ATTR_LABEL[primaryId] ?? 'Power', String(Math.round(off.primaryStat)), 'Scales your ability damage.');
    chip('Max HP', String(Math.round(h.max)), 'Maximum health (Vitality adds HP).');
    chip('Armor', String(Math.round(def.armor)), 'Reduces physical damage taken (diminishing returns).');
    chip('Crit', `${(off.critChance * 100).toFixed(1)}%`, 'Chance for a hit to deal ×1.5 damage.');
    chip('Haste', `${(off.haste * 100).toFixed(1)}%`, 'Reduces the global cooldown and cast time.');
    if (off.leech > 0) chip('Leech', `${(off.leech * 100).toFixed(1)}%`, 'Heals you for a fraction of damage dealt.');
    if (off.healPower > 0) chip('Healing', `+${Math.round(off.healPower)}`, 'Increases the healing you do.');
    const resists: [keyof Defense['resist'], string][] = [
      ['fire', 'Fire Resist'],
      ['frost', 'Frost Resist'],
      ['blight', 'Blight Resist'],
    ];
    for (const [k, label] of resists) {
      if (def.resist[k] > 0) chip(label, String(Math.round(def.resist[k])), `Reduces ${k} damage taken.`);
    }
  }

  /** Choice-node talents: pick one of two per node (out of combat). */
  private renderTalents(pc: PlayerClass | undefined, level: number, inCombat: boolean): void {
    this.talents.replaceChildren();
    if (!pc) return;
    const nodes = getClass(pc.id).choiceNodes;
    if (nodes.length === 0) return;

    this.talents.appendChild(sectionHead('Talents'));

    for (const node of nodes) {
      const row = document.createElement('div');
      row.className = 'char-talent';

      if (level < node.unlockLevel) {
        const lbl = document.createElement('span');
        lbl.className = 'char-slot-name empty';
        lbl.textContent = `${node.options[0].name} / ${node.options[1].name}`;
        row.appendChild(lbl);
        const hint = document.createElement('span');
        hint.className = 'inv-hint';
        hint.textContent = `Lv ${node.unlockLevel}`;
        row.appendChild(hint);
        this.talents.appendChild(row);
        continue;
      }

      const picked = pc.choices?.[node.id] === 1 ? 1 : 0;
      for (let i = 0; i < node.options.length; i++) {
        const b = document.createElement('button');
        b.className = `inv-btn small${picked === i ? ' chosen' : ''}`;
        b.textContent = node.options[i].name;
        b.disabled = inCombat || picked === i;
        b.onclick = () => this.onChooseTalent(node.id, i);
        row.appendChild(b);
      }
      if (inCombat) {
        const hint = document.createElement('span');
        hint.className = 'inv-hint';
        hint.textContent = 'Out of combat only';
        row.appendChild(hint);
      }
      this.talents.appendChild(row);
    }
  }

  /** Show the item tooltip while hovering an equipped slot (its own stats, no comparison). */
  private hover(row: HTMLElement, item: Item): void {
    row.addEventListener('mouseenter', () => this.tooltip.show(item, null, row.getBoundingClientRect()));
    row.addEventListener('mouseleave', () => this.tooltip.hide());
    if (item.relic) row.title = relicEffectDesc(item.relic);
  }

  /** Reinforcement button: shows the next step + cost (in a tooltip), or "Max". */
  private reinforceButton(item: Item, gold: number, materials: number): HTMLButtonElement {
    const b = document.createElement('button');
    b.className = 'inv-btn small reinforce';
    if (!canReinforce(item)) {
      b.innerHTML = `${icon('anvil')}Max`;
      b.disabled = true;
      return b;
    }
    const cost = reinforceCost(item);
    b.innerHTML = `${icon('anvil')}+${(item.reinforced ?? 0) + 1}`;
    b.title = `Reinforce: ${cost.gold} gold + ${cost.whetstones} whetstones`;
    b.disabled = gold < cost.gold || materials < cost.whetstones;
    b.onclick = () => this.onReinforce(item);
    return b;
  }
}

/** A small uppercase section heading. */
function sectionHead(text: string): HTMLDivElement {
  const h = document.createElement('div');
  h.className = 'char-section';
  h.textContent = text;
  return h;
}
