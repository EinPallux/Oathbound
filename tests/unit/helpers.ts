// Shared test helpers (not a suite). A flat heightfield, a scriptable input, and a
// level setter.

import { Heightfield } from '../../src/world/heightfield';
import type { ControlState } from '../../src/platform/input';
import type { World, Entity } from '../../src/core/ecs/world';
import { C, type Progression, type Health } from '../../src/core/ecs/components';
import { recomputeDerived } from '../../src/sim/inventory';
import { xpToNext } from '../../src/sim/stats';

/** Set a player's level (unlocks abilities, rebuilds derived stats, heals to full). */
export function setLevel(world: World, player: Entity, level: number): void {
  const prog = world.get<Progression>(player, C.Progression)!;
  prog.level = level;
  prog.xp = 0;
  prog.xpToNext = xpToNext(level);
  recomputeDerived(world, player);
  const h = world.get<Health>(player, C.Health)!;
  h.current = h.max;
}

/** A cheap perfectly-flat heightfield (sample === 0 everywhere). */
export function flatField(size = 200): Heightfield {
  return new Heightfield(size, 2, new Float32Array(4));
}

export interface InputState {
  ability: number | null;
  cycle: boolean;
  clear: boolean;
  interact: boolean;
}

/** A ControlState whose queued actions can be set directly by tests. */
export function makeInput(): { ctrl: ControlState; state: InputState } {
  const state: InputState = { ability: null, cycle: false, clear: false, interact: false };
  const ctrl: ControlState = {
    forward: false,
    back: false,
    left: false,
    right: false,
    yaw: 0,
    pitch: 0.5,
    dist: 10,
    consumeJump: () => false,
    consumeMount: () => false,
    consumeAbility: () => {
      const a = state.ability;
      state.ability = null;
      return a;
    },
    consumeTargetCycle: () => {
      const c = state.cycle;
      state.cycle = false;
      return c;
    },
    consumeEscape: () => {
      const c = state.clear;
      state.clear = false;
      return c;
    },
    consumeClick: () => null,
    consumeInteract: () => {
      const v = state.interact;
      state.interact = false;
      return v;
    },
    consumeToggleInventory: () => false,
    consumeToggleCharacter: () => false,
    consumeToggleTravel: () => false,
    consumeToggleMap: () => false,
    consumeToggleSettings: () => false,
  };
  return { ctrl, state };
}
