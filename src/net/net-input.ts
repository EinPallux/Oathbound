// A ControlState driven by network input packets instead of a keyboard/mouse. The server owns
// one of these per controlled player and folds each `input` message into it; the movement (and
// later combat) systems then read it exactly like they read the browser's InputController — the
// whole point of the ControlState seam. Isomorphic (no three/DOM/Node): only the ControlState +
// InputMessage types, both erased at runtime.

import type { ControlState } from '../platform/input';
import type { InputMessage } from './protocol';

export class NetworkControlState implements ControlState {
  forward = false;
  back = false;
  left = false;
  right = false;
  yaw = 0;
  pitch = 0.5; // camera-only; the server never uses pitch/dist
  dist = 10;

  private jumpQueued = false;
  private abilityQueued: number | null = null;
  private interactQueued = false;
  private cycleQueued = false;
  private appliedSeq = 0;

  /** The last input sequence number folded in — echoed to the client as snapshot `ack`. */
  get seq(): number {
    return this.appliedSeq;
  }

  /** Fold a client input packet into the control state. Older/duplicate packets are ignored. */
  applyInput(msg: InputMessage): void {
    if (msg.seq <= this.appliedSeq) return;
    this.appliedSeq = msg.seq;
    this.forward = msg.forward;
    this.back = msg.back;
    this.left = msg.left;
    this.right = msg.right;
    this.yaw = msg.yaw;
    // Edge-triggered intents buffer until consumed (a packet with the intent set queues it).
    if (msg.jump) this.jumpQueued = true;
    if (msg.ability != null) this.abilityQueued = msg.ability;
    if (msg.interact) this.interactQueued = true;
    if (msg.cycle) this.cycleQueued = true;
  }

  consumeJump(): boolean {
    const j = this.jumpQueued;
    this.jumpQueued = false;
    return j;
  }

  consumeAbility(): number | null {
    const a = this.abilityQueued;
    this.abilityQueued = null;
    return a;
  }

  consumeTargetCycle(): boolean {
    const c = this.cycleQueued;
    this.cycleQueued = false;
    return c;
  }

  consumeInteract(): boolean {
    const i = this.interactQueued;
    this.interactQueued = false;
    return i;
  }

  // Mount (Shift) isn't wired over the wire yet.
  consumeMount(): boolean {
    return false;
  }
  consumeEscape(): boolean {
    return false;
  }
  consumeClick(): { ndcX: number; ndcY: number } | null {
    return null;
  }
  consumeToggleInventory(): boolean {
    return false;
  }
  consumeToggleCharacter(): boolean {
    return false;
  }
  consumeToggleTravel(): boolean {
    return false;
  }
  consumeToggleMap(): boolean {
    return false;
  }
  consumeToggleSettings(): boolean {
    return false;
  }
}
