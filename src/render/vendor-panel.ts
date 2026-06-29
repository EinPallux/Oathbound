// Vendor sell panel (DOM, interactive — opened with F near a vendor). Lists bagged
// items with their gold value and a Sell action, plus a "sell all Common" button and
// the gold wallet. Mutations go through callbacks so the sim stays authoritative.

import type { World, Entity } from '../core/ecs/world';
import { C, type Item, type EquipSlot, type Inventory } from '../core/ecs/components';
import { vendorValue } from '../sim/vendor';
import { icon } from './ui/icons';

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

export class VendorPanel {
  private readonly root: HTMLDivElement;
  private readonly wallet: HTMLDivElement;
  private readonly actions: HTMLDivElement;
  private readonly list: HTMLDivElement;
  private visible = false;
  private lastSig = '';

  onSell: (item: Item) => void = () => {};
  onSellCommons: () => void = () => {};

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'shop-panel vendor-panel';
    this.root.style.display = 'none';

    const title = document.createElement('div');
    title.className = 'inv-title';
    title.innerHTML = `${icon('shop')}Vendor — F to close`;
    this.root.appendChild(title);

    this.wallet = document.createElement('div');
    this.wallet.className = 'inv-wallet';
    this.root.appendChild(this.wallet);

    this.actions = document.createElement('div');
    this.actions.className = 'inv-actions';
    this.root.appendChild(this.actions);

    this.list = document.createElement('div');
    this.root.appendChild(this.list);
    parent.appendChild(this.root);
  }

  open(): void {
    this.visible = true;
    this.root.style.display = 'block';
    this.lastSig = '';
  }
  close(): void {
    this.visible = false;
    this.root.style.display = 'none';
  }
  get isOpen(): boolean {
    return this.visible;
  }

  update(world: World, player: Entity): void {
    if (!this.visible) return;
    const inv = world.get<Inventory>(player, C.Inventory);
    if (!inv) return;

    const sig =
      inv.items.map((i) => `${i.uid}${i.locked ? 'L' : ''}`).join(',') + `|${inv.gold}`;
    if (sig === this.lastSig) return;
    this.lastSig = sig;

    this.wallet.innerHTML = `<span class="currency coin">${icon('coin')}${inv.gold} gold</span>`;

    this.actions.replaceChildren();
    const sellCommons = document.createElement('button');
    sellCommons.className = 'inv-btn';
    sellCommons.textContent = 'Sell all Common';
    sellCommons.disabled = !inv.items.some((i) => !i.locked && i.rarity === 'common');
    sellCommons.onclick = () => this.onSellCommons();
    this.actions.appendChild(sellCommons);

    this.list.replaceChildren();
    if (inv.items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'inv-empty';
      empty.textContent = 'Nothing to sell.';
      this.list.appendChild(empty);
    }
    const sorted = [...inv.items].sort((a, b) => a.score - b.score);
    for (const item of sorted) {
      const row = document.createElement('div');
      row.className = 'inv-row';

      const name = document.createElement('span');
      name.className = `inv-name ${item.rarity}`;
      name.textContent = `${item.locked ? '🔒 ' : ''}${item.name} · ${SLOT_LABEL[item.slot]}`;
      row.appendChild(name);

      const value = document.createElement('span');
      value.className = 'inv-delta';
      value.textContent = `${vendorValue(item)} g`;
      row.appendChild(value);

      const sell = document.createElement('button');
      sell.className = 'inv-btn small danger';
      sell.textContent = 'Sell';
      sell.disabled = item.locked;
      sell.onclick = () => this.onSell(item);
      row.appendChild(sell);

      this.list.appendChild(row);
    }
  }
}
