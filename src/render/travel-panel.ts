// Fast-travel panel (DOM, interactive — opened with T). Lists the activated Oathstone
// network with a Travel action per destination (a small gold toll, out-of-combat only).
// The destination you're standing at and unaffordable / in-combat travel are disabled.
// Mutations go through the onTravel callback so the sim stays authoritative.

import type { World, Entity } from '../core/ecs/world';
import { C, type Transform, type Inventory, type CombatState } from '../core/ecs/components';
import { activatedOathstones, TRAVEL_TOLL } from '../sim/travel';
import { icon } from './ui/icons';

const HERE_RADIUS = 4;

export class TravelPanel {
  private readonly root: HTMLDivElement;
  private readonly status: HTMLDivElement;
  private readonly list: HTMLDivElement;
  private visible = false;
  private lastSig = '';

  onTravel: (dest: Entity) => void = () => {};

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'shop-panel travel-panel';
    this.root.style.display = 'none';

    const title = document.createElement('div');
    title.className = 'inv-title';
    title.innerHTML = `${icon('map')}Fast Travel — T to close`;
    this.root.appendChild(title);

    this.status = document.createElement('div');
    this.status.className = 'inv-wallet';
    this.root.appendChild(this.status);

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
  toggle(): void {
    if (this.visible) this.close();
    else this.open();
  }
  get isOpen(): boolean {
    return this.visible;
  }

  update(world: World, player: Entity): void {
    if (!this.visible) return;
    const pt = world.get<Transform>(player, C.Transform);
    const inv = world.get<Inventory>(player, C.Inventory);
    const cs = world.get<CombatState>(player, C.CombatState);
    if (!pt || !inv) return;

    const dests = activatedOathstones(world, player);
    const inCombat = cs?.inCombat ?? false;
    const gold = inv.gold;

    const sig =
      dests.map((d) => d.id).join(',') +
      `|${gold}|${inCombat}|${Math.round(pt.x)},${Math.round(pt.z)}`;
    if (sig === this.lastSig) return;
    this.lastSig = sig;

    this.status.textContent = inCombat
      ? 'Cannot travel while in combat.'
      : `${gold} gold   ·   ${TRAVEL_TOLL} g per trip`;

    this.list.replaceChildren();
    if (dests.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'inv-empty';
      empty.textContent = 'No Oathstones discovered yet — explore to find them.';
      this.list.appendChild(empty);
      return;
    }

    for (const d of dests) {
      const here = Math.hypot(pt.x - d.x, pt.z - d.z) <= HERE_RADIUS;
      const row = document.createElement('div');
      row.className = 'inv-row';

      const name = document.createElement('span');
      name.className = 'inv-name';
      name.textContent = d.name;
      row.appendChild(name);

      const btn = document.createElement('button');
      btn.className = 'inv-btn small';
      if (here) {
        btn.textContent = 'You are here';
        btn.disabled = true;
      } else {
        btn.textContent = `Travel (${TRAVEL_TOLL} g)`;
        btn.disabled = inCombat || gold < TRAVEL_TOLL;
        btn.onclick = () => this.onTravel(d.entity);
      }
      row.appendChild(btn);

      this.list.appendChild(row);
    }
  }
}
