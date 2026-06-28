// Goal Tracker (DOM overlay): during onboarding it shows the "teach the loop" checklist
// (move → target → defeat → loot → equip → recover); once that's done it becomes the
// lightweight "what now?" panel — level + XP to next, current zone + level range, and a
// few soft goals. Reads sim state; never mutates it. See CORE_GAMEPLAY_LOOP.md.

import type { World, Entity } from '../core/ecs/world';
import { C, type Progression, type Transform, type RelicCollection } from '../core/ecs/components';
import { regionAt, regionLabel } from '../sim/content/regions';
import { LEVEL_CAP } from '../sim/stats';
import { relicProgress, nextRelicTarget, uncollectedRelics } from '../sim/content/endgame';
import type { Onboarding } from '../sim/onboarding';

export class GoalTracker {
  private readonly root: HTMLDivElement;
  private readonly title: HTMLDivElement;
  private readonly body: HTMLDivElement;
  private lastSig = '';

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'goal-tracker';
    this.title = document.createElement('div');
    this.title.className = 'goal-title';
    this.body = document.createElement('div');
    this.body.className = 'goal-body';
    this.root.append(this.title, this.body);
    parent.appendChild(this.root);
  }

  update(world: World, player: Entity, onboarding: Onboarding): void {
    if (!onboarding.isComplete) {
      this.renderOnboarding(onboarding);
      return;
    }
    this.renderGoals(world, player);
  }

  private renderOnboarding(onboarding: Onboarding): void {
    const sig = 'ob|' + onboarding.steps.map((s) => (s.done ? '1' : '0')).join('');
    if (sig === this.lastSig) return;
    this.lastSig = sig;

    this.title.textContent = 'Getting Started';
    this.body.replaceChildren();
    const current = onboarding.currentIndex;
    for (let i = 0; i < onboarding.steps.length; i++) {
      const s = onboarding.steps[i];
      const row = document.createElement('div');
      row.className = `goal-step${s.done ? ' done' : ''}${i === current ? ' current' : ''}`;
      const mark = document.createElement('span');
      mark.className = 'goal-mark';
      mark.textContent = s.done ? '✓' : i === current ? '▸' : '·';
      const label = document.createElement('span');
      label.textContent = i === current ? `${s.text} — ${s.hint}` : s.text;
      row.append(mark, label);
      this.body.appendChild(row);
    }
  }

  private renderGoals(world: World, player: Entity): void {
    const prog = world.get<Progression>(player, C.Progression);
    const tr = world.get<Transform>(player, C.Transform);
    if (!prog || !tr) return;
    const region = regionAt(tr.x, tr.z);
    const atCap = prog.level >= LEVEL_CAP;

    const discovered = atCap
      ? (world.get<RelicCollection>(player, C.RelicCollection)?.discovered ?? [])
      : [];
    const goals = atCap ? this.endgameGoals(discovered) : this.softGoals(prog.level);
    const sig = `go|${prog.level}|${Math.round(prog.xp)}|${region.id}|${discovered.slice().sort().join(',')}|${goals.join('§')}`;
    if (sig === this.lastSig) return;
    this.lastSig = sig;

    this.title.textContent = atCap ? 'Endgame' : 'Goals';
    this.body.replaceChildren();

    const head = document.createElement('div');
    head.className = 'goal-head';
    if (atCap) {
      const { have, total } = relicProgress(discovered);
      head.textContent = `Lv 30 · max · Relics ${have}/${total}`;
    } else {
      const toNext =
        prog.xpToNext === Infinity ? 'max' : `${Math.max(0, Math.ceil(prog.xpToNext - prog.xp))} XP to next`;
      head.textContent = `Lv ${prog.level} · ${toNext}`;
    }
    this.body.appendChild(head);

    const zone = document.createElement('div');
    zone.className = 'goal-zone';
    zone.textContent = regionLabel(region);
    this.body.appendChild(zone);

    for (const g of goals) {
      const row = document.createElement('div');
      row.className = 'goal-step';
      const mark = document.createElement('span');
      mark.className = 'goal-mark';
      mark.textContent = '◦';
      const label = document.createElement('span');
      label.textContent = g;
      row.append(mark, label);
      this.body.appendChild(row);
    }
  }

  /** Lv-30 chase guidance: collection progress + the next relic to hunt + gear goals. */
  private endgameGoals(discovered: readonly string[]): string[] {
    const goals: string[] = [];
    const next = nextRelicTarget(discovered);
    if (next) {
      const relics = uncollectedRelics(next, discovered)
        .map((r) => r.name)
        .join(', ');
      goals.push(`Hunt ${next.name} — ${next.where}`);
      goals.push(`↳ for the ${relics}`);
    } else {
      goals.push('All Relics claimed — chase perfect Legendary affixes');
    }
    goals.push('Reinforce your best gear toward the cap (⚒ in the bag)');
    goals.push('World bosses respawn ~5 min — farm Relics, Epics & Legendaries');
    return goals;
  }

  private softGoals(level: number): string[] {
    const goals: string[] = [];
    if (level < 6) goals.push('Reach Lv 6 → the Thornwood Vale');
    else if (level < 11) goals.push('Reach Lv 11 → the Sunken Fen');
    else if (level < 16) goals.push('Reach Lv 16 → the Emberreach');
    else if (level < 21) goals.push('Reach Lv 21 → the Riven Peaks');
    else if (level < 26) goals.push('Reach Lv 26 → Gravereach');
    else goals.push('Reach Lv 30 — clear Gravereach, the Hollow Crown');
    goals.push('Upgrade your gear from drops or the vendor (F)');
    goals.push(
      level < 11
        ? 'Attune Oathstones for fast travel (T)'
        : level < 16
          ? 'Bring blight resist into the Sunken Fen'
          : level < 21
            ? 'Bring fire resist into the Emberreach'
            : level < 26
              ? 'Bring frost resist into the Riven Peaks'
              : 'Gravereach: the undead are weak to holy (Priests shine)',
    );
    return goals;
  }
}
