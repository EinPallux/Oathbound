// Inventory bag (DOM, interactive — toggled with B). A grid of item cells sorted by
// power: hover for a comparison tooltip, left-click to equip, right-click for a context
// menu (reinforce / lock / salvage). A filter box narrows the grid, a salvage-commons
// button clears clutter, and the footer holds the gold + whetstone wallet. Equipment,
// stats and talents now live in the Character panel. Mutations go through callbacks so
// the sim stays authoritative; rebuilds only when contents (or the filter) change.

import type { World, Entity } from '../core/ecs/world';
import {
  C,
  type Item,
  type EquipSlot,
  type Inventory,
  type Equipment,
  type Progression,
} from '../core/ecs/components';
import { SLOT_LABEL } from '../sim/loot/item-info';
import { isRarePlus } from '../sim/loot/droptable';
import { tierTag, type Settings } from '../game/settings';
import { SALVAGE_LEVEL } from '../sim/salvage';
import { canReinforce, reinforceCost } from '../sim/reinforce';
import { ItemTooltip } from './item-tooltip';
import { icon } from './ui/icons';

/** ` +N` reinforcement suffix for an item name, or '' if unreinforced. */
function reinSuffix(item: Item): string {
  const n = item.reinforced ?? 0;
  return n > 0 ? ` +${n}` : '';
}

/** Map an equipment slot to a game-icon (used as the bag-cell artwork). */
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

export class InventoryPanel {
  private readonly root: HTMLDivElement;
  private readonly grid: HTMLDivElement;
  private readonly filterInput: HTMLInputElement;
  private readonly foot: HTMLDivElement;
  private readonly actions: HTMLDivElement;
  private readonly tooltip: ItemTooltip;
  private menu: HTMLDivElement | null = null;
  private filter = '';
  private visible = false;
  private lastSig = '';

  onEquip: (item: Item) => void = () => {};
  onSalvage: (item: Item) => void = () => {};
  onSalvageCommons: () => void = () => {};
  onToggleLock: (item: Item) => void = () => {};
  onReinforce: (item: Item) => void = () => {};
  onSettings: () => void = () => {};

  constructor(parent: HTMLElement, tooltip: ItemTooltip, private readonly settings?: Settings) {
    this.tooltip = tooltip;
    this.root = document.createElement('div');
    this.root.className = 'inv-panel bag';
    this.root.style.display = 'none';

    // Header: title + gear (→ settings) + close.
    const header = document.createElement('div');
    header.className = 'bag-head';
    const title = document.createElement('div');
    title.className = 'bag-title';
    title.innerHTML = `${icon('bag')}<span>Inventory</span>`;
    const spacer = document.createElement('div');
    spacer.className = 'bag-spacer';
    const gear = document.createElement('button');
    gear.className = 'bag-icon-btn';
    gear.title = 'Settings';
    gear.innerHTML = icon('gears');
    gear.onclick = () => this.onSettings();
    const close = document.createElement('button');
    close.className = 'bag-icon-btn';
    close.title = 'Close (B)';
    close.textContent = '✕';
    close.onclick = () => this.close();
    header.append(title, spacer, gear, close);
    this.root.appendChild(header);

    // Filter box.
    const filterRow = document.createElement('div');
    filterRow.className = 'bag-filter';
    this.filterInput = document.createElement('input');
    this.filterInput.type = 'text';
    this.filterInput.placeholder = 'Filter';
    this.filterInput.spellcheck = false;
    this.filterInput.oninput = () => {
      this.filter = this.filterInput.value.trim().toLowerCase();
      this.lastSig = ''; // force a rebuild on the next update tick
    };
    filterRow.appendChild(this.filterInput);
    this.root.appendChild(filterRow);

    // Item grid.
    this.grid = document.createElement('div');
    this.grid.className = 'bag-grid';
    this.root.appendChild(this.grid);

    // Actions (salvage all Common).
    this.actions = document.createElement('div');
    this.actions.className = 'bag-actions';
    this.root.appendChild(this.actions);

    // Footer wallet + item count.
    this.foot = document.createElement('div');
    this.foot.className = 'bag-foot';
    this.root.appendChild(this.foot);

    // Hover tooltips + context menu live on <body> so they aren't clipped or zoomed.
    parent.appendChild(this.root);
    // Dismiss the context menu on any outside interaction.
    window.addEventListener('pointerdown', (e) => {
      if (this.menu && !this.menu.contains(e.target as Node)) this.closeMenu();
    });
  }

  toggle(): void {
    this.visible = !this.visible;
    this.root.style.display = this.visible ? 'block' : 'none';
    if (!this.visible) {
      this.tooltip.hide();
      this.closeMenu();
    }
    this.lastSig = '';
  }

  close(): void {
    if (!this.visible) return;
    this.visible = false;
    this.root.style.display = 'none';
    this.tooltip.hide();
    this.closeMenu();
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

    const sig =
      inv.items.map((i) => `${i.uid}${i.locked ? 'L' : ''}r${i.reinforced ?? 0}`).join(',') +
      '|' +
      Object.values(eq.slots).map((it) => (it ? `${it.uid}r${it.reinforced ?? 0}` : '-')).join(',') +
      `|${inv.gold}|${inv.materials}|${inv.capacity}|${prog.level}|${this.filter}`;
    if (sig === this.lastSig) return;
    this.lastSig = sig;
    this.tooltip.hide(); // a rebuild invalidates cell anchors
    this.closeMenu();

    const canSalvage = prog.level >= SALVAGE_LEVEL;

    // ── Grid ────────────────────────────────────────────────────────────────
    this.grid.replaceChildren();
    const sorted = [...inv.items].sort((a, b) => b.score - a.score);
    const shown = this.filter
      ? sorted.filter(
          (i) => i.name.toLowerCase().includes(this.filter) || SLOT_LABEL[i.slot].toLowerCase().includes(this.filter),
        )
      : sorted;

    for (const item of shown) {
      const equipped = eq.slots[item.slot] ?? null;
      const delta = item.score - (equipped?.score ?? 0);
      const cell = document.createElement('div');
      cell.className = `bag-cell ${item.rarity}`;
      cell.innerHTML = `<span class="bag-cell-ico">${icon(slotIcon(item.slot))}</span>`;
      if (item.locked) cell.appendChild(badge('bag-lock', icon('lock')));
      if ((item.reinforced ?? 0) > 0) cell.appendChild(badge('bag-rein', `+${item.reinforced}`));
      if (delta > 0) cell.appendChild(badge('bag-up', '▲'));
      if (item.relic) cell.classList.add('relic-glow');

      this.hover(cell, item, equipped);
      cell.onclick = () => this.onEquip(item);
      cell.oncontextmenu = (e) => {
        e.preventDefault();
        this.openMenu(e.clientX, e.clientY, item, inv, canSalvage);
      };
      this.grid.appendChild(cell);
    }

    // Pad with empty slots up to capacity (only in the unfiltered view).
    if (!this.filter) {
      for (let i = shown.length; i < inv.capacity; i++) {
        this.grid.appendChild(Object.assign(document.createElement('div'), { className: 'bag-cell empty' }));
      }
    } else if (shown.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'bag-none';
      empty.textContent = 'No items match the filter.';
      this.grid.appendChild(empty);
    }

    // ── Actions ─────────────────────────────────────────────────────────────
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

    // ── Footer wallet ───────────────────────────────────────────────────────
    this.foot.innerHTML =
      `<span class="bag-cur coin" title="Gold">${icon('coin')}${inv.gold.toLocaleString()}</span>` +
      `<span class="bag-cur gem" title="Whetstones">${icon('gem')}${inv.materials}</span>` +
      `<span class="bag-cur count" title="Bag space">${icon('bag')}${inv.items.length}/${inv.capacity}</span>`;
  }

  // ── Right-click context menu ────────────────────────────────────────────────
  private openMenu(x: number, y: number, item: Item, inv: Inventory, canSalvage: boolean): void {
    this.closeMenu();
    const menu = document.createElement('div');
    menu.className = 'bag-menu';

    const head = document.createElement('div');
    head.className = `bag-menu-head ${item.rarity}`;
    head.textContent = `${tierTag(item.rarity)} ${item.name}${reinSuffix(item)}`;
    menu.appendChild(head);

    // Equip.
    menu.appendChild(
      menuItem(icon('check'), 'Equip', false, () => {
        this.onEquip(item);
        this.closeMenu();
      }),
    );

    // Reinforce (with the next step's cost).
    if (canReinforce(item)) {
      const cost = reinforceCost(item);
      const affordable = inv.gold >= cost.gold && inv.materials >= cost.whetstones;
      const label = `Reinforce +${(item.reinforced ?? 0) + 1}  ·  ${cost.gold}g, ${cost.whetstones} whetstones`;
      menu.appendChild(
        menuItem(icon('anvil'), label, !affordable, () => {
          this.onReinforce(item);
          this.closeMenu();
        }),
      );
    } else {
      menu.appendChild(menuItem(icon('anvil'), 'Reinforced (max)', true, () => {}));
    }

    // Lock / Unlock.
    menu.appendChild(
      menuItem(icon('lock'), item.locked ? 'Unlock' : 'Lock', false, () => {
        this.onToggleLock(item);
        this.closeMenu();
      }),
    );

    // Salvage — Rare+ asks for a one-click confirm when "Confirm destructive actions" is on.
    const needConfirm = (this.settings?.confirmDestructive ?? true) && isRarePlus(item.rarity);
    const salv = menuItem(icon('recycle'), 'Salvage', !canSalvage || item.locked, () => {});
    salv.classList.add('danger');
    let armed = false;
    salv.onclick = () => {
      if (item.locked || !canSalvage) return;
      if (needConfirm && !armed) {
        armed = true;
        const lbl = salv.querySelector('span');
        if (lbl) lbl.textContent = 'Confirm salvage?';
        salv.classList.add('armed');
        return;
      }
      this.onSalvage(item);
      this.closeMenu();
    };
    menu.appendChild(salv);

    document.body.appendChild(menu);
    // Clamp to the viewport so the menu never spills off-screen.
    const r = menu.getBoundingClientRect();
    const px = Math.min(x, window.innerWidth - r.width - 8);
    const py = Math.min(y, window.innerHeight - r.height - 8);
    menu.style.left = `${Math.max(8, px)}px`;
    menu.style.top = `${Math.max(8, py)}px`;
    this.menu = menu;
    this.tooltip.hide();
  }

  private closeMenu(): void {
    this.menu?.remove();
    this.menu = null;
  }

  /** Show the item tooltip (with comparison vs `equipped`) while hovering `cell`. */
  private hover(cell: HTMLElement, item: Item, equipped: Item | null): void {
    cell.addEventListener('mouseenter', () => {
      if (this.menu) return;
      this.tooltip.show(item, equipped, cell.getBoundingClientRect());
    });
    cell.addEventListener('mouseleave', () => this.tooltip.hide());
  }
}

/** A small corner badge on a bag cell. */
function badge(cls: string, html: string): HTMLSpanElement {
  const b = document.createElement('span');
  b.className = `bag-badge ${cls}`;
  b.innerHTML = html;
  return b;
}

/** One row of the right-click context menu. */
function menuItem(iconHtml: string, label: string, disabled: boolean, onclick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'bag-menu-item';
  b.disabled = disabled;
  b.innerHTML = iconHtml;
  const t = document.createElement('span');
  t.textContent = label;
  b.appendChild(t);
  b.onclick = onclick;
  return b;
}
