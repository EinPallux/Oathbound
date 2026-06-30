// Quest progress tracking for a custom map (game layer — not the sim). Holds which quests
// are active (+ objective progress) and which are completed, and the rules for advancing
// them. Kill objectives advance from the sim's Death events; talk objectives advance when
// you talk to the target NPC. Reward granting + persistence live in the bootstrap.

import type { MapQuest } from '../world/map-format';

export interface QuestState {
  active: { id: string; progress: number }[];
  completed: string[];
}

export interface ActiveQuestView {
  quest: MapQuest;
  progress: number;
  done: boolean;
}

export class QuestLog {
  private readonly active = new Map<string, number>(); // quest id → objective progress
  private readonly completed = new Set<string>();
  /** Fired whenever quest state changes (drives the tracker UI). */
  onChange: (() => void) | null = null;

  constructor(private readonly quests: MapQuest[]) {}

  byId(id: string): MapQuest | undefined {
    return this.quests.find((q) => q.id === id);
  }
  isActive(id: string): boolean {
    return this.active.has(id);
  }
  isCompleted(id: string): boolean {
    return this.completed.has(id);
  }
  progress(id: string): number {
    return this.active.get(id) ?? 0;
  }

  objectiveDone(q: MapQuest): boolean {
    const p = this.active.get(q.id) ?? 0;
    return q.objective.type === 'kill' ? p >= q.objective.count : p >= 1;
  }

  accept(id: string): void {
    if (this.active.has(id) || this.completed.has(id)) return;
    if (!this.byId(id)) return;
    this.active.set(id, 0);
    this.onChange?.();
  }

  /** Complete a quest if it's active + its objective is met; returns it (for the reward). */
  complete(id: string): MapQuest | null {
    const q = this.byId(id);
    if (!q || !this.active.has(id) || !this.objectiveDone(q)) return null;
    this.active.delete(id);
    this.completed.add(id);
    this.onChange?.();
    return q;
  }

  /** Advance kill objectives for the given enemy template id. */
  onKill(templateId: string): void {
    let changed = false;
    for (const q of this.quests) {
      if (q.objective.type === 'kill' && q.objective.enemyId === templateId && this.active.has(q.id)) {
        const p = this.active.get(q.id)!;
        if (p < q.objective.count) {
          this.active.set(q.id, p + 1);
          changed = true;
        }
      }
    }
    if (changed) this.onChange?.();
  }

  /** Advance talk objectives that target the given NPC id. */
  onTalk(npcId: string): void {
    let changed = false;
    for (const q of this.quests) {
      if (q.objective.type === 'talk' && q.objective.npcId === npcId && this.active.has(q.id) && (this.active.get(q.id) ?? 0) < 1) {
        this.active.set(q.id, 1);
        changed = true;
      }
    }
    if (changed) this.onChange?.();
  }

  activeList(): ActiveQuestView[] {
    const out: ActiveQuestView[] = [];
    for (const [id, progress] of this.active) {
      const quest = this.byId(id);
      if (quest) out.push({ quest, progress, done: this.objectiveDone(quest) });
    }
    return out;
  }

  toSave(): QuestState {
    return {
      active: [...this.active].map(([id, progress]) => ({ id, progress })),
      completed: [...this.completed],
    };
  }
  load(state: QuestState | undefined): void {
    this.active.clear();
    this.completed.clear();
    if (state) {
      for (const a of state.active ?? []) if (this.byId(a.id)) this.active.set(a.id, a.progress);
      for (const id of state.completed ?? []) this.completed.add(id);
    }
    this.onChange?.();
  }
}
