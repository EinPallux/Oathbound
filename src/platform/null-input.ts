// A no-op ControlState: reports no movement and no queued actions. It implements the exact
// same intent contract the keyboard/mouse InputController does, so the simulation can be
// ticked with a "player who does nothing" — used by the headless server (M0: no gameplay is
// sent over the wire yet, so players don't move and only enemy AI runs) and by unit tests
// that boot the real sim on Node. In later phases the server replaces this with a
// network-driven ControlState filled from each client's input packets.

import type { ControlState } from './input';

/** Create a fresh ControlState that never moves and never queues an action. */
export function createNullControlState(): ControlState {
  return {
    forward: false,
    back: false,
    left: false,
    right: false,
    yaw: 0,
    pitch: 0.5,
    dist: 10,
    consumeJump: () => false,
    consumeMount: () => false,
    consumeAbility: () => null,
    consumeTargetCycle: () => false,
    consumeEscape: () => false,
    consumeClick: () => null,
    consumeInteract: () => false,
    consumeToggleInventory: () => false,
    consumeToggleCharacter: () => false,
    consumeToggleTravel: () => false,
    consumeToggleMap: () => false,
    consumeToggleSettings: () => false,
  };
}
