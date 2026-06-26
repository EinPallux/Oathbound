// The heads-up display (DOM overlay): player frame (HP/Fury/XP/level), the ability
// hotbar with cooldown + affordability state, a gold counter, a loot prompt, and a
// transient toast stack. Reads sim state each frame; never mutates it. ADR-002.

import type { World, Entity } from '../core/ecs/world';
import {
  C,
  type Transform,
  type Health,
  type Resource,
  type AbilityState,
  type Progression,
  type Inventory,
  type CombatState,
  type Statuses,
  type LootDrop,
} from '../core/ecs/components';
import { ABILITIES } from '../sim/combat/abilities';
import { hasStatus, Status } from '../sim/combat/statuses';

const KEYS = ['1', '2', '3', '4'];
const PICKUP_RADIUS = 2.5;

interface Toast {
  el: HTMLDivElement;
  life: number;
  ttl: number;
}

function div(cls: string, parent: HTMLElement): HTMLDivElement {
  const el = document.createElement('div');
  el.className = cls;
  parent.appendChild(el);
  return el;
}

export class Hud {
  private readonly hpFill: HTMLDivElement;
  private readonly hpText: HTMLDivElement;
  private readonly furyFill: HTMLDivElement;
  private readonly furyText: HTMLDivElement;
  private readonly xpFill: HTMLDivElement;
  private readonly nameEl: HTMLDivElement;
  private readonly stateEl: HTMLDivElement;
  private readonly slots: { wrap: HTMLDivElement; cd: HTMLDivElement }[] = [];
  private readonly goldEl: HTMLDivElement;
  private readonly promptEl: HTMLDivElement;
  private readonly toastWrap: HTMLDivElement;
  private readonly toasts: Toast[] = [];
  private lastMs = performance.now();

  constructor(parent: HTMLElement) {
    // Player frame (bottom-left).
    const frame = div('player-frame', parent);
    const header = div('player-header', frame);
    this.nameEl = div('player-name', header);
    this.nameEl.textContent = 'Warrior';
    this.stateEl = div('player-state', header);

    const hp = div('bar hp', frame);
    this.hpFill = div('bar-fill', hp);
    this.hpText = div('bar-text', hp);
    const fury = div('bar fury', frame);
    this.furyFill = div('bar-fill', fury);
    this.furyText = div('bar-text', fury);
    const xp = div('bar xp', frame);
    this.xpFill = div('bar-fill', xp);

    // Hotbar (bottom-centre).
    const hotbar = div('hotbar', parent);
    for (let i = 0; i < ABILITIES.length; i++) {
      const wrap = div('slot', hotbar);
      div('slot-key', wrap).textContent = KEYS[i] ?? '';
      div('slot-name', wrap).textContent = ABILITIES[i].name;
      const cd = div('slot-cd', wrap);
      this.slots.push({ wrap, cd });
    }

    // Gold (top-right).
    this.goldEl = div('gold', parent);
    this.goldEl.textContent = '0 g';

    // Loot prompt + toasts.
    this.promptEl = div('loot-prompt', parent);
    this.promptEl.style.display = 'none';
    this.toastWrap = div('toast-wrap', parent);
  }

  toast(text: string, kind: 'info' | 'good' | 'rare' = 'info'): void {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = text;
    this.toastWrap.appendChild(el);
    this.toasts.push({ el, life: 0, ttl: 2.6 });
  }

  update(world: World, player: Entity): void {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastMs) / 1000);
    this.lastMs = now;

    const h = world.get<Health>(player, C.Health);
    const res = world.get<Resource>(player, C.Resource);
    const prog = world.get<Progression>(player, C.Progression);
    const ab = world.get<AbilityState>(player, C.AbilityState);
    const inv = world.get<Inventory>(player, C.Inventory);
    const cs = world.get<CombatState>(player, C.CombatState);
    const st = world.get<Statuses>(player, C.Statuses);

    if (h) {
      const r = h.max > 0 ? h.current / h.max : 0;
      this.hpFill.style.width = `${Math.max(0, r) * 100}%`;
      this.hpText.textContent = `${Math.ceil(Math.max(0, h.current))} / ${h.max}`;
    }
    if (res) {
      this.furyFill.style.width = `${(res.current / res.max) * 100}%`;
      this.furyText.textContent = `${Math.floor(res.current)} Fury`;
    }
    if (prog) {
      const r = prog.xpToNext === Infinity ? 1 : prog.xp / prog.xpToNext;
      this.xpFill.style.width = `${Math.min(1, r) * 100}%`;
      this.nameEl.textContent = `Warrior · Lv ${prog.level}`;
    }
    if (cs) {
      const shaken = hasStatus(st, Status.Shaken);
      this.stateEl.textContent = shaken ? 'Shaken' : cs.inCombat ? 'In combat' : 'Rested';
      this.stateEl.className = `player-state ${shaken ? 'shaken' : cs.inCombat ? 'combat' : 'rested'}`;
    }

    // Hotbar state.
    if (ab && res) {
      for (let i = 0; i < this.slots.length; i++) {
        const def = ABILITIES[i];
        const cd = ab.cooldowns[i] ?? 0;
        const onGcd = def.triggersGcd && ab.gcdRemaining > 0;
        const unaffordable = res.current < def.cost;
        const slot = this.slots[i];
        if (cd > 0.05) {
          slot.cd.textContent = cd.toFixed(1);
          slot.cd.style.opacity = '1';
        } else {
          slot.cd.textContent = '';
          slot.cd.style.opacity = '0';
        }
        slot.wrap.classList.toggle('disabled', unaffordable || onGcd);
      }
    }

    if (inv) this.goldEl.textContent = `${inv.gold} g`;

    // Loot prompt: nearest item drop in range.
    this.promptEl.style.display = 'none';
    const pt = world.get<Transform>(player, C.Transform);
    if (pt) {
      let nearest: { name: string; dist: number } | null = null;
      for (const e of world.query(C.LootDrop, C.Transform)) {
        const ld = world.get<LootDrop>(e, C.LootDrop)!;
        if (!ld.item) continue;
        const lt = world.get<Transform>(e, C.Transform)!;
        const dist = Math.hypot(lt.x - pt.x, lt.z - pt.z);
        if (dist <= PICKUP_RADIUS && (!nearest || dist < nearest.dist)) {
          nearest = { name: ld.item.name, dist };
        }
      }
      if (nearest) {
        this.promptEl.style.display = 'block';
        this.promptEl.textContent = `Press F — ${nearest.name}`;
      }
    }

    // Toasts.
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      const t = this.toasts[i];
      t.life += dt;
      if (t.life >= t.ttl) {
        t.el.remove();
        this.toasts.splice(i, 1);
        continue;
      }
      t.el.style.opacity = String(1 - Math.max(0, (t.life - t.ttl + 0.6) / 0.6));
    }
  }
}
