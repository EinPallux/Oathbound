// Shared test helpers (not a suite). A flat heightfield and a scriptable input.

import { Heightfield } from '../../src/world/heightfield';
import type { ControlState } from '../../src/platform/input';

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
    sprint: false,
    yaw: 0,
    pitch: 0.5,
    dist: 10,
    consumeJump: () => false,
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
    consumeClearTarget: () => {
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
  };
  return { ctrl, state };
}
