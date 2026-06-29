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
  type Shield,
  type CastState,
} from '../core/ecs/components';
import { getClass, resolveKit, empowerKit } from '../sim/classes';
import { hasStatus, Status } from '../sim/combat/statuses';
import { icon } from './ui/icons';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const PICKUP_RADIUS = 2.5;
/** Class portrait icon for the unit-frame (game-icons SVG). */
const CLASS_ICON: Record<string, string> = { warrior: 'sword', hunter: 'bow', priest: 'staff' };
const RES_ICON: Record<string, string> = { Fury: 'flame', Focus: 'focus', Mana: 'droplet' };
const RES_MOD: Record<string, string> = { Fury: 'fury', Focus: 'focus', Mana: 'mana' };
const TOAST_ICON: Record<string, string> = {
  good: 'check',
  rare: 'gem',
  epic: 'gem',
  legendary: 'sparkles',
  relic: 'crown',
};

/** Map an ability (by display name) to a game-icon. Keyword-matched, order matters. */
function abilityIcon(name: string): string {
  const n = name.toLowerCase();
  const h = (s: string): boolean => n.includes(s);
  if (h('cleav')) return 'saber-slash';
  if (h('sunder')) return 'sword-wound';
  if (h('whirl') || h('wrath') || h('oathbreak')) return 'spinning-sword';
  if (h('charge')) return 'run';
  if (h('second wind') || h('mend')) return 'healing';
  if (h('pommel') || h('silence') || h('scatter shot')) return 'sword-clash';
  if (h('rallying') || h('cry')) return 'horn';
  if (h('bloodthirst') || h('ravager')) return 'blood';
  if (h('holy fire')) return 'flame';
  if (h('smite')) return 'holy-symbol';
  if (h('searing') || h('dawnbreak')) return 'sunbeams';
  if (h('nova') || h('consecr') || h('divine star')) return 'beams-aura';
  if (h('atonement') || h('penance') || h('prayer')) return 'prayer';
  if (h('aegis') || h('bulwark') || h('unbreak')) return 'shield';
  if (h('quick shot') || h('aimed')) return 'broadhead';
  if (h('piercing')) return 'striking-arrows';
  if (h('volley') || h('barrage') || h('rain of arrows') || h('fusillade')) return 'arrow-cluster';
  if (h('disengage') || h('camouflage')) return 'wingfoot';
  if (h('trap')) return 'trap';
  if (h('mark')) return 'target';
  if (h('earthsplit')) return 'magic-swirl';
  if (h('star')) return 'star';
  return 'crossed-swords';
}

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
  private readonly resBar: HTMLDivElement;
  private readonly resFill: HTMLDivElement;
  private readonly resText: HTMLDivElement;
  private readonly resIco: HTMLDivElement;
  private readonly xpFill: HTMLDivElement;
  private readonly xpCur: HTMLDivElement;
  private readonly xpPct: HTMLDivElement;
  private readonly goldVal: HTMLSpanElement;
  private resIcoKey = '';
  private portraitKey = '';
  private readonly nameEl: HTMLDivElement;
  private readonly levelEl: HTMLDivElement;
  private readonly portraitEl: HTMLDivElement;
  private readonly stateEl: HTMLDivElement;
  private readonly hotbar: HTMLDivElement;
  private slots: { wrap: HTMLDivElement; cd: HTMLDivElement }[] = [];
  private hotbarSig = '';
  private readonly castBar: HTMLDivElement;
  private readonly castFill: HTMLDivElement;
  private readonly goldEl: HTMLDivElement;
  private readonly promptEl: HTMLDivElement;
  private readonly toastWrap: HTMLDivElement;
  private readonly toasts: Toast[] = [];
  private lastMs = performance.now();

  constructor(parent: HTMLElement) {
    // Player unit-frame (top-centre, left of the target): portrait + name/level + bars.
    const frame = div('unit-frame player', parent);
    this.portraitEl = div('unit-portrait', frame);
    const body = div('unit-body', frame);

    const top = div('unit-top', body);
    this.nameEl = div('unit-name', top);
    this.stateEl = div('player-state', top);

    const hp = div('bar hp', body);
    this.hpFill = div('bar-fill', hp);
    div('bar-ico', hp).innerHTML = icon('heart');
    this.hpText = div('bar-text', hp);
    this.levelEl = div('unit-level', body);
    this.resBar = div('bar fury', body);
    this.resFill = div('bar-fill', this.resBar);
    this.resIco = div('bar-ico', this.resBar);
    this.resText = div('bar-text', this.resBar);

    this.castBar = div('cast-bar', parent);
    this.castFill = div('cast-fill', this.castBar);
    this.castBar.style.display = 'none';

    this.hotbar = div('hotbar', parent);
    this.goldEl = div('gold', parent);
    this.goldEl.innerHTML = `${icon('coin')}<span class="gv">0</span>`;
    this.goldVal = this.goldEl.querySelector('.gv') as HTMLSpanElement;
    this.promptEl = div('loot-prompt', parent);
    this.promptEl.style.display = 'none';
    this.toastWrap = div('toast-wrap', parent);

    // Full-width XP bar pinned to the very bottom of the screen, below the hotbar.
    const xpBar = div('xp-bar', parent);
    this.xpFill = div('xp-fill', xpBar);
    this.xpCur = div('xp-cur', xpBar);
    this.xpPct = div('xp-pct', xpBar);
  }

  toast(text: string, kind: 'info' | 'good' | 'rare' | 'epic' | 'legendary' | 'relic' = 'info'): void {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.innerHTML = icon(TOAST_ICON[kind] ?? 'info');
    const t = document.createElement('span');
    t.textContent = text;
    el.appendChild(t);
    this.toastWrap.appendChild(el);
    this.toasts.push({ el, life: 0, ttl: 2.6 });
  }

  private rebuildHotbar(names: readonly string[]): void {
    this.hotbar.replaceChildren();
    this.slots = [];
    for (let i = 0; i < names.length; i++) {
      const wrap = div('slot', this.hotbar);
      div('slot-key', wrap).textContent = KEYS[i] ?? '';
      div('slot-icon', wrap).innerHTML = icon(abilityIcon(names[i]));
      div('slot-name', wrap).textContent = names[i];
      const cd = div('slot-cd', wrap);
      this.slots.push({ wrap, cd });
    }
  }

  update(world: World, player: Entity): void {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastMs) / 1000);
    this.lastMs = now;

    const pc = world.get<PlayerClass>(player, C.PlayerClass);
    const cls = getClass(pc?.id ?? 'warrior');
    const h = world.get<Health>(player, C.Health);
    const res = world.get<Resource>(player, C.Resource);
    const prog = world.get<Progression>(player, C.Progression);
    // At Lv 30 the capstone empowers a signature ability (name + power); reflect it here.
    const abilities = empowerKit(cls, resolveKit(cls, pc?.choices), prog?.level ?? 1);
    const ab = world.get<AbilityState>(player, C.AbilityState);
    const inv = world.get<Inventory>(player, C.Inventory);
    const cs = world.get<CombatState>(player, C.CombatState);
    const st = world.get<Statuses>(player, C.Statuses);

    // Portrait/name only change on a class switch — avoid re-parsing the SVG every frame.
    if (cls.id !== this.portraitKey) {
      this.portraitKey = cls.id;
      this.portraitEl.innerHTML = icon(CLASS_ICON[cls.id] ?? 'sword');
      this.nameEl.textContent = cls.name;
    }
    const shield = world.get<Shield>(player, C.Shield);
    if (h) {
      const r = h.max > 0 ? h.current / h.max : 0;
      this.hpFill.style.width = `${Math.max(0, r) * 100}%`;
      const shieldTxt = shield && shield.amount > 0 ? ` (+${Math.ceil(shield.amount)})` : '';
      this.hpText.textContent = `${Math.ceil(Math.max(0, h.current))}/${h.max}${shieldTxt}`;
    }
    if (res) {
      const rname = cls.resource.name;
      if (rname !== this.resIcoKey) {
        this.resIcoKey = rname;
        this.resBar.className = `bar ${RES_MOD[rname] ?? 'fury'}`;
        this.resIco.innerHTML = icon(RES_ICON[rname] ?? 'flame');
      }
      this.resFill.style.width = `${(res.current / res.max) * 100}%`;
      this.resText.textContent = `${Math.floor(res.current)}/${res.max}`;
    }
    if (prog) {
      const capped = prog.xpToNext === Infinity;
      const r = capped ? 1 : prog.xp / prog.xpToNext;
      this.xpFill.style.width = `${Math.min(1, r) * 100}%`;
      this.levelEl.textContent = `Lv ${prog.level}`;
      if (capped) {
        this.xpCur.textContent = 'MAX LEVEL';
        this.xpPct.textContent = '100%';
      } else {
        this.xpCur.textContent = `${prog.xp.toLocaleString()} / ${prog.xpToNext.toLocaleString()} EXP`;
        this.xpPct.textContent = `${(r * 100).toFixed(2)}%`;
      }
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
      const level = prog?.level ?? 1;
      for (let i = 0; i < this.slots.length; i++) {
        const def = abilities[i];
        const unlock = def.unlockLevel ?? 1;
        const locked = unlock > level;
        const cd = ab.cooldowns[i] ?? 0;
        const onGcd = def.triggersGcd && ab.gcdRemaining > 0;
        const unaffordable = res.current < def.cost;
        const slot = this.slots[i];
        if (locked) {
          slot.cd.textContent = `Lv ${unlock}`;
          slot.cd.style.opacity = '1';
        } else if (cd > 0.05) {
          slot.cd.textContent = cd.toFixed(1);
          slot.cd.style.opacity = '1';
        } else {
          slot.cd.textContent = '';
          slot.cd.style.opacity = '0';
        }
        slot.wrap.classList.toggle('disabled', locked || unaffordable || onGcd);
        slot.wrap.classList.toggle('ready', !locked && !unaffordable && !onGcd && cd <= 0.05);
      }
    }

    // Cast bar (Searing Light etc.).
    const castState = world.get<CastState>(player, C.CastState);
    if (castState) {
      const ct = abilities[castState.index]?.castTime ?? 1;
      this.castBar.style.display = 'block';
      this.castFill.style.width = `${Math.min(1, 1 - castState.remaining / ct) * 100}%`;
    } else {
      this.castBar.style.display = 'none';
    }

    if (inv) this.goldVal.textContent = `${inv.gold}`;

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
        this.promptEl.style.display = 'flex';
        this.promptEl.innerHTML = `<span class="key">F</span>`;
        const t = document.createElement('span');
        t.textContent = nearest.name;
        this.promptEl.appendChild(t);
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
