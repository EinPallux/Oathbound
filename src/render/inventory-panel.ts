// Inventory + equipment panel (DOM, interactive — toggled with I/C). Lists equipped
// gear and bagged items with an upgrade delta vs. the equipped piece and an Equip
// action. Rebuilds only when the contents change. Reads sim state; equipping goes
// through a callback so the sim stays the source of truth.

import type { World, Entity } from '../core/ecs/world';
import {
  C,
  type Item,
  type EquipSlot,
  type Inventory,
  type Equipment,
} from '../core/ecs/components';
import { EQUIP_SLOTS } from '../sim/loot/items';

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

export class InventoryPanel {
  private readonly root: HTMLDivElement;
  private readonly equipList: HTMLDivElement;
  private readonly invList: HTMLDivElement;
  private visible = false;
  private lastSig = '';
  onEquip: (item: Item) => void = () => {};

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'inv-panel';
    this.root.style.display = 'none';

    const title = document.createElement('div');
    title.className = 'inv-title';
    title.textContent = 'Inventory — I/C to close';
    this.root.appendChild(title);

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
    this.lastSig = ''; // force a rebuild on next update
  }

  get isOpen(): boolean {
    return this.visible;
  }

  update(world: World, player: Entity): void {
    if (!this.visible) return;
    const inv = world.get<Inventory>(player, C.Inventory);
    const eq = world.get<Equipment>(player, C.Equipment);
    if (!inv || !eq) return;

    const sig =
      EQUIP_SLOTS.map((s) => eq.slots[s]?.uid ?? '-').join(',') +
      '|' +
      inv.items.map((i) => i.uid).join(',') +
      '|' +
      inv.gold;
    if (sig === this.lastSig) return;
    this.lastSig = sig;

    this.equipList.replaceChildren();
    for (const slot of EQUIP_SLOTS) {
      const it = eq.slots[slot];
      const row = document.createElement('div');
      row.className = 'inv-row';
      row.innerHTML = `<span class="inv-slot">${SLOT_LABEL[slot]}</span>`;
      const name = document.createElement('span');
      name.className = it ? `inv-name ${it.rarity}` : 'inv-name empty';
      name.textContent = it ? `${it.name} (${it.score})` : '—';
      row.appendChild(name);
      this.equipList.appendChild(row);
    }

    this.invList.replaceChildren();
    if (inv.items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'inv-empty';
      empty.textContent = 'Empty — kill Bloomhusks and press F on drops.';
      this.invList.appendChild(empty);
    }
    for (const item of inv.items) {
      const equipped = eq.slots[item.slot];
      const delta = item.score - (equipped?.score ?? 0);
      const row = document.createElement('div');
      row.className = 'inv-row';

      const name = document.createElement('span');
      name.className = `inv-name ${item.rarity}`;
      name.textContent = `${item.name} · ${SLOT_LABEL[item.slot]}`;
      row.appendChild(name);

      const d = document.createElement('span');
      d.className = `inv-delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}`;
      d.textContent = delta > 0 ? `+${delta}` : `${delta}`;
      row.appendChild(d);

      const btn = document.createElement('button');
      btn.className = 'inv-equip';
      btn.textContent = 'Equip';
      btn.onclick = () => this.onEquip(item);
      row.appendChild(btn);

      this.invList.appendChild(row);
    }
  }
}
