// The heads-up display (DOM overlay): player frame (HP/resource/XP/level), the class
// ability hotbar with cooldown + affordability state, a gold counter, a loot prompt,
// and a transient toast stack. Reads sim state each frame; never mutates it. ADR-002.

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
  type PlayerClass,
} from '../core/ecs/components';
import { getClass } from '../sim/classes';
import { hasStatus, Status } from '../sim/combat/statuses';

const KEYS = ['1', '2', '3', '4', '5', '6'];
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
  private readonly resFill: HTMLDivElement;
  private readonly resText: HTMLDivElement;
  private readonly xpFill: HTMLDivElement;
  private readonly nameEl: HTMLDivElement;
  private readonly stateEl: HTMLDivElement;
  private readonly hotbar: HTMLDivElement;
  private slots: { wrap: HTMLDivElement; cd: HTMLDivElement }[] = [];
  private hotbarSig = '';
  private readonly goldEl: HTMLDivElement;
  private readonly promptEl: HTMLDivElement;
  private readonly toastWrap: HTMLDivElement;
  private readonly toasts: Toast[] = [];
  private lastMs = performance.now();

  constructor(parent: HTMLElement) {
    const frame = div('player-frame', parent);
    const header = div('player-header', frame);
    this.nameEl = div('player-name', header);
    this.stateEl = div('player-state', header);

    const hp = div('bar hp', frame);
    this.hpFill = div('bar-fill', hp);
    this.hpText = div('bar-text', hp);
    const resBar = div('bar fury', frame);
    this.resFill = div('bar-fill', resBar);
    this.resText = div('bar-text', resBar);
    const xp = div('bar xp', frame);
    this.xpFill = div('bar-fill', xp);

    this.hotbar = div('hotbar', parent);
    this.goldEl = div('gold', parent);
    this.goldEl.textContent = '0 g';
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

  private rebuildHotbar(names: readonly string[]): void {
    this.hotbar.replaceChildren();
    this.slots = [];
    for (let i = 0; i < names.length; i++) {
      const wrap = div('slot', this.hotbar);
      div('slot-key', wrap).textContent = KEYS[i] ?? '';
      div('slot-name', wrap).textContent = names[i];
      const cd = div('slot-cd', wrap);
      this.slots.push({ wrap, cd });
    }
  }

  update(world: World, player: Entity): void {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastMs) / 1000);
    this.lastMs = now;

    const cls = getClass(world.get<PlayerClass>(player, C.PlayerClass)?.id ?? 'warrior');
    const abilities = cls.abilities;
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
      this.resFill.style.width = `${(res.current / res.max) * 100}%`;
      this.resText.textContent = `${Math.floor(res.current)} ${cls.resource.name}`;
    }
    if (prog) {
      const r = prog.xpToNext === Infinity ? 1 : prog.xp / prog.xpToNext;
      this.xpFill.style.width = `${Math.min(1, r) * 100}%`;
      this.nameEl.textContent = `${cls.name} · Lv ${prog.level}`;
    }
    if (cs) {
      const shaken = hasStatus(st, Status.Shaken);
      this.stateEl.textContent = shaken ? 'Shaken' : cs.inCombat ? 'In combat' : 'Rested';
      this.stateEl.className = `player-state ${shaken ? 'shaken' : cs.inCombat ? 'combat' : 'rested'}`;
    }

    // Hotbar (rebuilt only when the kit changes, e.g. class switch).
    const sig = abilities.map((a) => a.id).join(',');
    if (sig !== this.hotbarSig) {
      this.hotbarSig = sig;
      this.rebuildHotbar(abilities.map((a) => a.name));
    }
    if (ab && res) {
      for (let i = 0; i < this.slots.length; i++) {
        const def = abilities[i];
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
