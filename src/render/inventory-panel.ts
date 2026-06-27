// Inventory + equipment panel (DOM, interactive — toggled with I/C). Lists equipped
// gear and bagged items (sorted by power) with upgrade deltas, equip / lock / salvage
// actions, a salvage-commons button, and the gold + whetstone wallet. Rebuilds only
// when contents change. Mutations go through callbacks so the sim stays authoritative.

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
} from '../core/ecs/components';
import { EQUIP_SLOTS } from '../sim/loot/items';
import { SALVAGE_LEVEL } from '../sim/salvage';
import { canReinforce, reinforceCost } from '../sim/reinforce';
import { getClass } from '../sim/classes';

const SLOT_LABEL: Record<EquipSlot, string> = {
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

/** ` +N` reinforcement suffix for an item name, or '' if unreinforced. */
function reinSuffix(item: Item): string {
  const n = item.reinforced ?? 0;
  return n > 0 ? ` +${n}` : '';
}

export class InventoryPanel {
  private readonly root: HTMLDivElement;
  private readonly wallet: HTMLDivElement;
  private readonly talents: HTMLDivElement;
  private readonly actions: HTMLDivElement;
  private readonly equipList: HTMLDivElement;
  private readonly invList: HTMLDivElement;
  private visible = false;
  private lastSig = '';

  onEquip: (item: Item) => void = () => {};
  onSalvage: (item: Item) => void = () => {};
  onSalvageCommons: () => void = () => {};
  onToggleLock: (item: Item) => void = () => {};
  onReinforce: (item: Item) => void = () => {};
  onChooseTalent: (nodeId: string, option: number) => void = () => {};

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'inv-panel';
    this.root.style.display = 'none';

    const title = document.createElement('div');
    title.className = 'inv-title';
    title.textContent = 'Inventory — I/C to close';
    this.root.appendChild(title);

    this.wallet = document.createElement('div');
    this.wallet.className = 'inv-wallet';
    this.root.appendChild(this.wallet);

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

    this.renderTalents(pc, prog.level, cs?.inCombat ?? false);

    const canSalvage = prog.level >= SALVAGE_LEVEL;

    this.wallet.textContent = `${inv.gold} gold   ·   ${inv.materials} whetstones`;

    this.actions.replaceChildren();
    const salvageBtn = document.createElement('button');
    salvageBtn.className = 'inv-btn';
    salvageBtn.textContent = 'Salvage all Common';
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
      row.innerHTML = `<span class="inv-slot">${SLOT_LABEL[slot]}</span>`;
      const name = document.createElement('span');
      name.className = it ? `inv-name ${it.rarity}` : 'inv-name empty';
      name.textContent = it ? `${it.name}${reinSuffix(it)} (${it.score})` : '—';
      row.appendChild(name);
      if (it) row.appendChild(this.reinforceButton(it, inv.gold, inv.materials));
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
      name.textContent = `${item.locked ? '🔒 ' : ''}${item.name}${reinSuffix(item)} · ${SLOT_LABEL[item.slot]}`;
      row.appendChild(name);

      const d = document.createElement('span');
      d.className = `inv-delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}`;
      d.textContent = delta > 0 ? `+${delta}` : `${delta}`;
      row.appendChild(d);

      row.appendChild(this.button('Equip', 'inv-equip', () => this.onEquip(item)));
      row.appendChild(this.reinforceButton(item, inv.gold, inv.materials));
      row.appendChild(
        this.button(item.locked ? 'Unlock' : 'Lock', 'inv-btn small', () => this.onToggleLock(item)),
      );
      const salv = this.button('Salvage', 'inv-btn small danger', () => this.onSalvage(item));
      salv.disabled = !canSalvage || item.locked;
      row.appendChild(salv);

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

  private button(label: string, cls: string, onclick: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.className = cls;
    b.textContent = label;
    b.onclick = onclick;
    return b;
  }

  /** Reinforcement button: shows the next step + cost (in a tooltip), or "Max". */
  private reinforceButton(item: Item, gold: number, materials: number): HTMLButtonElement {
    const b = document.createElement('button');
    b.className = 'inv-btn small reinforce';
    if (!canReinforce(item)) {
      b.textContent = '⚒ Max';
      b.disabled = true;
      return b;
    }
    const cost = reinforceCost(item);
    b.textContent = `⚒ +${(item.reinforced ?? 0) + 1}`;
    b.title = `Reinforce: ${cost.gold} gold + ${cost.whetstones} whetstones`;
    b.disabled = gold < cost.gold || materials < cost.whetstones;
    b.onclick = () => this.onReinforce(item);
    return b;
  }
}
