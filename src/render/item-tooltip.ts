// Hover tooltip for inventory items (DOM overlay): full stat breakdown, the relic
// effect, salvage value, and a "vs equipped" comparison (per-attribute deltas + score).
// Reads pure formatters from src/sim/loot/item-info.ts. Appended to <body> (outside the
// zoom-scaled #ui-root) so screen-space positioning stays correct at any UI scale.

import type { Item } from '../core/ecs/components';
import { itemStatLines, compareItems, SLOT_LABEL } from '../sim/loot/item-info';
import { effectiveIlvl } from '../sim/loot/items';
import { relicEffectDesc } from '../sim/loot/relics';
import { salvageYield } from '../sim/salvage';
import { tierTag } from '../game/settings';

export class ItemTooltip {
  private readonly el: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'item-tooltip';
    this.el.style.display = 'none';
    parent.appendChild(this.el);
  }

  /** Show the tooltip for `item`, comparing against the slot's `equipped` piece. */
  show(item: Item, equipped: Item | null, anchor: DOMRect): void {
    this.el.replaceChildren();

    const title = document.createElement('div');
    title.className = `tt-title ${item.rarity}`;
    const rein = (item.reinforced ?? 0) > 0 ? ` +${item.reinforced}` : '';
    title.textContent = `${tierTag(item.rarity)} ${item.name}${rein}`;
    this.el.appendChild(title);

    const sub = document.createElement('div');
    sub.className = 'tt-sub';
    sub.textContent = `${SLOT_LABEL[item.slot]} · ilvl ${effectiveIlvl(item)} · ${item.rarity}`;
    this.el.appendChild(sub);

    for (const line of itemStatLines(item)) {
      const r = document.createElement('div');
      r.className = 'tt-stat';
      r.textContent = line;
      this.el.appendChild(r);
    }

    if (item.relic) {
      const fx = document.createElement('div');
      fx.className = 'tt-relic';
      fx.textContent = relicEffectDesc(item.relic);
      this.el.appendChild(fx);
    }

    const sv = salvageYield(item);
    const salv = document.createElement('div');
    salv.className = 'tt-salvage';
    salv.textContent = `Salvage: ${sv.whetstones} whetstones, ${sv.gold} g`;
    this.el.appendChild(salv);

    // Comparison vs the equipped piece in this slot (skip when hovering it directly).
    if (equipped && equipped.uid !== item.uid) {
      const head = document.createElement('div');
      head.className = 'tt-cmp-head';
      head.textContent = 'vs equipped';
      this.el.appendChild(head);

      const deltas = compareItems(item, equipped);
      if (deltas.length === 0) {
        const same = document.createElement('div');
        same.className = 'tt-stat';
        same.textContent = 'No stat change';
        this.el.appendChild(same);
      }
      for (const d of deltas) {
        const r = document.createElement('div');
        r.className = `tt-cmp ${d.sign > 0 ? 'up' : d.sign < 0 ? 'down' : ''}`;
        r.textContent = `${d.label} ${d.text}`;
        this.el.appendChild(r);
      }
      const scoreDelta = item.score - equipped.score;
      const sc = document.createElement('div');
      sc.className = `tt-cmp ${scoreDelta > 0 ? 'up' : scoreDelta < 0 ? 'down' : ''}`;
      sc.textContent = `Score ${scoreDelta >= 0 ? '+' : ''}${scoreDelta}`;
      this.el.appendChild(sc);
    }

    // Position: to the right of the row, flipping/clamping to stay on-screen.
    this.el.style.display = 'block';
    this.el.style.left = `${anchor.right + 12}px`;
    this.el.style.top = `${anchor.top}px`;
    const r = this.el.getBoundingClientRect();
    if (r.right > window.innerWidth - 8) {
      this.el.style.left = `${Math.max(8, anchor.left - r.width - 12)}px`;
    }
    if (r.bottom > window.innerHeight - 8) {
      this.el.style.top = `${Math.max(8, window.innerHeight - r.height - 8)}px`;
    }
  }

  hide(): void {
    this.el.style.display = 'none';
  }
}
