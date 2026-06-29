// Inventory + equipment panel (DOM, interactive — toggled with I/C). Lists equipped
// gear and bagged items (sorted by power) with upgrade deltas, equip / lock / salvage
// actions, a salvage-commons button, and the gold + whetstone wallet. Rebuilds only
// when contents change. Mutations go through callbacks so the sim stays authoritative.

import type { World, Entity } from '../core/ecs/world';
import {
  C,
  type Item,
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
import { isRarePlus } from '../sim/loot/droptable';
import { tierTag, type Settings } from '../game/settings';
import { SALVAGE_LEVEL } from '../sim/salvage';
import { canReinforce, reinforceCost } from '../sim/reinforce';
import { getClass } from '../sim/classes';
import { ItemTooltip } from './item-tooltip';
import { icon } from './ui/icons';

/** ` +N` reinforcement suffix for an item name, or '' if unreinforced. */
function reinSuffix(item: Item): string {
  const n = item.reinforced ?? 0;
  return n > 0 ? ` +${n}` : '';
}

/** Map an equipment slot label to a game-icon. */
function slotIcon(label: string): string {
  const l = label.toLowerCase();
  if (l.includes('weapon') || l.includes('main')) return 'sword';
  if (l.includes('off')) return 'shield';
  if (l.includes('head') || l.includes('helm')) return 'helmet';
  if (l.includes('chest') || l.includes('body') || l.includes('torso')) return 'chest';
  if (l.includes('hand') || l.includes('glove')) return 'gauntlet';
  if (l.includes('feet') || l.includes('boot')) return 'boots';
  if (l.includes('leg')) return 'belt';
  if (l.includes('amulet') || l.includes('neck')) return 'amulet';
  if (l.includes('ring')) return 'ring';
  if (l.includes('cape') || l.includes('back') || l.includes('shoulder')) return 'cape';
  if (l.includes('belt') || l.includes('waist')) return 'belt';
  return 'crossed-swords';
}

export class InventoryPanel {
  private readonly root: HTMLDivElement;
  private readonly wallet: HTMLDivElement;
  private readonly stats: HTMLDivElement;
  private readonly talents: HTMLDivElement;
  private readonly actions: HTMLDivElement;
  private readonly equipList: HTMLDivElement;
  private readonly invList: HTMLDivElement;
  private readonly tooltip: ItemTooltip;
  private visible = false;
  private lastSig = '';

  onEquip: (item: Item) => void = () => {};
  onSalvage: (item: Item) => void = () => {};
  onSalvageCommons: () => void = () => {};
  onToggleLock: (item: Item) => void = () => {};
  onReinforce: (item: Item) => void = () => {};
  onChooseTalent: (nodeId: string, option: number) => void = () => {};

  constructor(parent: HTMLElement, private readonly settings?: Settings) {
    this.root = document.createElement('div');
    this.root.className = 'inv-panel';
    this.root.style.display = 'none';

    const title = document.createElement('div');
    title.className = 'inv-title';
    title.textContent = 'Inventory / Character — I/C to close';
    this.root.appendChild(title);

    this.wallet = document.createElement('div');
    this.wallet.className = 'inv-wallet';
    this.root.appendChild(this.wallet);

    this.stats = document.createElement('div');
    this.stats.className = 'inv-stats';
    this.root.appendChild(this.stats);

    // Hover tooltips live on <body> so they aren't clipped by the panel or UI zoom.
    this.tooltip = new ItemTooltip(document.body);

    this.talents = document.createElement('div');
    this.talents.className = 'inv-talents';
    this.root.appendChild(this.talents);

    this.actions = document.createElement('div');
    this.actions.className = 'inv-actions';
    this.root.appendChild(this.actions);

    const cols = document.createElement('div');
    cols.className = 'inv-cols';
    const left = document.createElement('div');
    left.className = 'inv-col';
    const leftH = document.createElement('div');
    leftH.className = 'inv-col-head';
    leftH.textContent = 'Equipped';
    this.equipList = document.createElement('div');
    left.append(leftH, this.equipList);

    const right = document.createElement('div');
    right.className = 'inv-col';
    const rightH = document.createElement('div');
    rightH.className = 'inv-col-head';
    rightH.textContent = 'Backpack';
    this.invList = document.createElement('div');
    right.append(rightH, this.invList);

    cols.append(left, right);
    this.root.appendChild(cols);
    parent.appendChild(this.root);
  }

  toggle(): void {
    this.visible = !this.visible;
    this.root.style.display = this.visible ? 'block' : 'none';
    if (!this.visible) this.tooltip.hide();
    this.lastSig = '';
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

    const sig =
      EQUIP_SLOTS.map((s) => {
        const it = eq.slots[s];
        return it ? `${it.uid}r${it.reinforced ?? 0}` : '-';
      }).join(',') +
      '|' +
      inv.items.map((i) => `${i.uid}${i.locked ? 'L' : ''}r${i.reinforced ?? 0}`).join(',') +
      `|${inv.gold}|${inv.materials}|${prog.level}` +
      `|${pc?.id ?? ''}|${JSON.stringify(pc?.choices ?? {})}|${cs?.inCombat ? 'c' : ''}`;
    if (sig === this.lastSig) return;
    this.lastSig = sig;
    this.tooltip.hide(); // a rebuild invalidates row anchors

    this.renderStats(world, player, pc);
    this.renderTalents(pc, prog.level, cs?.inCombat ?? false);

    const canSalvage = prog.level >= SALVAGE_LEVEL;

    this.wallet.innerHTML =
      `<span class="currency coin">${icon('coin')}${inv.gold} gold</span>` +
      `<span class="currency mat">${icon('gem')}${inv.materials} whetstones</span>`;

    this.actions.replaceChildren();
    const salvageBtn = document.createElement('button');
    salvageBtn.className = 'inv-btn';
    salvageBtn.innerHTML = `${icon('recycle')}Salvage all Common`;
    salvageBtn.disabled = !canSalvage;
    salvageBtn.onclick = () => this.onSalvageCommons();
    this.actions.appendChild(salvageBtn);
    if (!canSalvage) {
      const hint = document.createElement('span');
      hint.className = 'inv-hint';
      hint.textContent = `Salvage unlocks at Lv ${SALVAGE_LEVEL}`;
      this.actions.appendChild(hint);
    }

    this.equipList.replaceChildren();
    for (const slot of EQUIP_SLOTS) {
      const it = eq.slots[slot];
      const row = document.createElement('div');
      row.className = 'inv-row';
      row.innerHTML =
        `<span class="inv-slot">${icon(slotIcon(SLOT_LABEL[slot]))}</span>` +
        `<span class="eq-label">${SLOT_LABEL[slot]}</span>`;
      const name = document.createElement('span');
      name.className = it ? `inv-name ${it.rarity}` : 'inv-name empty';
      name.textContent = it ? `${tierTag(it.rarity)} ${it.name}${reinSuffix(it)} (${it.score})` : '—';
      if (it?.relic) name.title = relicEffectDesc(it.relic);
      row.appendChild(name);
      if (it) {
        row.appendChild(this.reinforceButton(it, inv.gold, inv.materials));
        this.hover(row, it, null); // it's equipped → show its own stats, no comparison
      }
      this.equipList.appendChild(row);
    }

    this.invList.replaceChildren();
    if (inv.items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'inv-empty';
      empty.textContent = 'Empty — kill Bloomhusks and press F on drops.';
      this.invList.appendChild(empty);
    }
    const sorted = [...inv.items].sort((a, b) => b.score - a.score);
    for (const item of sorted) {
      const equipped = eq.slots[item.slot];
      const delta = item.score - (equipped?.score ?? 0);
      const row = document.createElement('div');
      row.className = 'inv-row';

      const name = document.createElement('span');
      name.className = `inv-name ${item.rarity}`;
      name.textContent = `${item.locked ? '🔒 ' : ''}${tierTag(item.rarity)} ${item.name}${reinSuffix(item)} · ${SLOT_LABEL[item.slot]}`;
      if (item.relic) name.title = relicEffectDesc(item.relic);
      row.appendChild(name);

      const d = document.createElement('span');
      d.className = `inv-delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}`;
      d.textContent = delta > 0 ? `+${delta}` : `${delta}`;
      row.appendChild(d);

      row.appendChild(this.button('Equip', 'inv-equip', () => this.onEquip(item), 'check'));
      row.appendChild(this.reinforceButton(item, inv.gold, inv.materials));
      const lockBtn = document.createElement('button');
      lockBtn.className = `inv-btn small iconbtn${item.locked ? ' chosen' : ''}`;
      lockBtn.innerHTML = icon('lock');
      lockBtn.title = item.locked ? 'Unlock' : 'Lock';
      lockBtn.onclick = () => this.onToggleLock(item);
      row.appendChild(lockBtn);

      // Salvage — Rare+ asks for a one-click confirm when "Confirm destructive actions" is on.
      const needConfirm = (this.settings?.confirmDestructive ?? true) && isRarePlus(item.rarity);
      const salv = document.createElement('button');
      salv.className = 'inv-btn small danger';
      salv.innerHTML = icon('recycle');
      salv.appendChild(Object.assign(document.createElement('span'), { textContent: 'Salvage' }));
      salv.disabled = !canSalvage || item.locked;
      let armed = false;
      salv.onclick = () => {
        if (needConfirm && !armed) {
          armed = true;
          salv.textContent = 'Confirm?';
          return;
        }
        this.onSalvage(item);
      };
      row.appendChild(salv);

      this.hover(row, item, equipped ?? null);
      this.invList.appendChild(row);
    }
  }

  /** Choice-node talents: pick one of two per node (out of combat). */
  private renderTalents(pc: PlayerClass | undefined, level: number, inCombat: boolean): void {
    this.talents.replaceChildren();
    if (!pc) return;
    const nodes = getClass(pc.id).choiceNodes;
    if (nodes.length === 0) return;

    const head = document.createElement('div');
    head.className = 'inv-col-head';
    head.textContent = 'Talents';
    this.talents.appendChild(head);

    for (const node of nodes) {
      const row = document.createElement('div');
      row.className = 'inv-row';

      if (level < node.unlockLevel) {
        const lbl = document.createElement('span');
        lbl.className = 'inv-name empty';
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
      el.className = 'inv-stat';
      el.title = tip;
      el.textContent = `${label} ${value}`;
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

  /** Show the item tooltip (with comparison vs `equipped`) while hovering `row`. */
  private hover(row: HTMLElement, item: Item, equipped: Item | null): void {
    row.addEventListener('mouseenter', () => this.tooltip.show(item, equipped, row.getBoundingClientRect()));
    row.addEventListener('mouseleave', () => this.tooltip.hide());
  }

  private button(label: string, cls: string, onclick: () => void, iconName?: string): HTMLButtonElement {
    const b = document.createElement('button');
    b.className = cls;
    if (iconName) {
      b.innerHTML = icon(iconName);
      const t = document.createElement('span');
      t.textContent = label;
      b.appendChild(t);
    } else {
      b.textContent = label;
    }
    b.onclick = onclick;
    return b;
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
