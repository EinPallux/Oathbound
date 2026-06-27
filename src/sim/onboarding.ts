// Onboarding tracker: the short "teach the loop" checklist (≤2 min to first kill —
// move, target, use an ability, loot, equip, recover). Pure (no three/DOM): it
// subscribes to sim events and polls player state, exactly like Telemetry. The render
// layer (GoalTracker) draws it and persists completion. See CORE_GAMEPLAY_LOOP.md.

import type { World, Entity } from '../core/ecs/world';
import {
  C,
  type Transform,
  type Target,
  type Equipment,
  type CombatState,
  type Health,
} from '../core/ecs/components';
import { CombatEvent, type DeathEvent, type LootPickedEvent } from './combat/events';

export interface OnboardStep {
  id: string;
  text: string;
  hint: string;
  done: boolean;
}

/** Distance the player must travel for the "move" step (m). */
const MOVE_DIST = 4;

export class Onboarding {
  readonly steps: OnboardStep[] = [
    { id: 'move', text: 'Move with WASD', hint: 'Walk toward the camp ahead (+Z).', done: false },
    { id: 'target', text: 'Select a target', hint: 'Press Tab, or click an enemy.', done: false },
    { id: 'defeat', text: 'Defeat an enemy', hint: 'Press 1 to strike; repeat to finish it.', done: false },
    { id: 'loot', text: 'Pick up the loot', hint: 'Stand on the drop and press F.', done: false },
    { id: 'equip', text: 'Equip an item', hint: 'Open the bag (I), then Equip.', done: false },
    { id: 'recover', text: 'Recover out of combat', hint: 'Stay out of combat to heal to full.', done: false },
  ];

  private startX = 0;
  private startZ = 0;
  private haveStart = false;
  private killed = false;
  private looted = false;
  private wasInCombat = false;
  private complete = false;
  private readonly unsubs: (() => void)[] = [];

  /** Subscribe to the events that drive kill/loot steps for the given player. */
  attach(world: World, player: Entity): void {
    const bus = world.events;
    this.unsubs.push(
      bus.on<DeathEvent>(CombatEvent.Death, (ev) => {
        if (ev.killer === player) this.killed = true;
      }),
      bus.on<LootPickedEvent>(CombatEvent.LootPicked, () => {
        this.looted = true;
      }),
    );
  }

  detach(): void {
    for (const u of this.unsubs) u();
    this.unsubs.length = 0;
  }

  /** First incomplete step index, or -1 when finished. */
  get currentIndex(): number {
    return this.steps.findIndex((s) => !s.done);
  }

  get isComplete(): boolean {
    return this.complete;
  }

  /** Mark the whole tutorial done (returning player who already knows the ropes). */
  skip(): void {
    for (const s of this.steps) s.done = true;
    this.complete = true;
  }

  private mark(id: string, value: boolean): void {
    if (!value) return;
    const step = this.steps.find((s) => s.id === id);
    if (step) step.done = true;
  }

  /** Advance step completion from current world state. Call once per frame. */
  update(world: World, player: Entity): void {
    if (this.complete) return;
    const tr = world.get<Transform>(player, C.Transform);
    if (!tr) return;
    const tgt = world.get<Target>(player, C.Target);
    const eq = world.get<Equipment>(player, C.Equipment);
    const cs = world.get<CombatState>(player, C.CombatState);
    const h = world.get<Health>(player, C.Health);

    if (!this.haveStart) {
      this.startX = tr.x;
      this.startZ = tr.z;
      this.haveStart = true;
    }
    if (cs?.inCombat) this.wasInCombat = true;

    this.mark('move', Math.hypot(tr.x - this.startX, tr.z - this.startZ) > MOVE_DIST);
    this.mark('target', tgt?.entity != null);
    this.mark('defeat', this.killed);
    this.mark('loot', this.looted);
    this.mark('equip', !!eq && Object.keys(eq.slots).length > 0);
    this.mark('recover', this.wasInCombat && !cs?.inCombat && !!h && h.current >= h.max);

    if (this.steps.every((s) => s.done)) this.complete = true;
  }
}
