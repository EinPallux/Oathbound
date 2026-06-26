// Keyboard + mouse input, exposed as plain control state the simulation can read.
// Owns the camera-orbit angles (yaw/pitch/distance) since movement is camera-relative;
// the camera rig is a pure consumer of these. See docs/design/COMBAT_DESIGN.md (controls).

import { clamp } from '../core/math';

/** The subset of control state the simulation reads (no DOM concepts). */
export interface ControlState {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  /** Camera/movement yaw (radians). */
  yaw: number;
  /** Camera pitch (radians). */
  pitch: number;
  /** Camera follow distance (m). */
  dist: number;
  /** Returns true once if a jump was requested since the last call. */
  consumeJump(): boolean;
  /** Returns a queued ability index (0-based) requested since the last call, or null. */
  consumeAbility(): number | null;
  /** Returns true once if Tab (cycle target) was pressed since the last call. */
  consumeTargetCycle(): boolean;
  /** Returns true once if Esc (clear target) was pressed since the last call. */
  consumeClearTarget(): boolean;
  /** Returns a queued left-click in normalized device coords [-1, 1], or null. */
  consumeClick(): { ndcX: number; ndcY: number } | null;
  /** Returns true once if the interact key (F) was pressed since the last call. */
  consumeInteract(): boolean;
  /** Returns true once if the inventory toggle (I) was pressed. */
  consumeToggleInventory(): boolean;
  /** Returns true once if the character toggle (C) was pressed. */
  consumeToggleCharacter(): boolean;
}

export class InputController implements ControlState {
  forward = false;
  back = false;
  left = false;
  right = false;
  sprint = false;
  yaw = 0;
  pitch = 0.5;
  dist = 10;

  private jumpQueued = false;
  private pauseQueued = false;
  private abilityQueued: number | null = null;
  private cycleQueued = false;
  private clearQueued = false;
  private clickQueued: { ndcX: number; ndcY: number } | null = null;
  private interactQueued = false;
  private toggleInvQueued = false;
  private toggleCharQueued = false;
  private dragging = false;
  private readonly lookSensitivity = 0.0035;

  private readonly onKeyDown = (e: KeyboardEvent): void => this.setKey(e, true);
  private readonly onKeyUp = (e: KeyboardEvent): void => this.setKey(e, false);
  private readonly onContextMenu = (e: Event): void => e.preventDefault();
  private readonly onMouseDown = (e: MouseEvent): void => {
    if (e.button === 2) {
      this.dragging = true;
    } else if (e.button === 0) {
      // Left-click selects: stash the click in normalized device coords for the
      // renderer to raycast against enemy meshes.
      const rect = this.el.getBoundingClientRect();
      this.clickQueued = {
        ndcX: ((e.clientX - rect.left) / rect.width) * 2 - 1,
        ndcY: -(((e.clientY - rect.top) / rect.height) * 2 - 1),
      };
    }
  };
  private readonly onMouseUp = (e: MouseEvent): void => {
    if (e.button === 2) this.dragging = false;
  };
  private readonly onMouseLeave = (): void => {
    this.dragging = false;
  };
  private readonly onMouseMove = (e: MouseEvent): void => {
    if (!this.dragging) return;
    this.yaw -= e.movementX * this.lookSensitivity;
    this.pitch = clamp(this.pitch + e.movementY * this.lookSensitivity, 0.15, 1.3);
  };
  private readonly onWheel = (e: WheelEvent): void => {
    this.dist = clamp(this.dist + Math.sign(e.deltaY) * 1, 4, 22);
  };

  constructor(private readonly el: HTMLElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    el.addEventListener('contextmenu', this.onContextMenu);
    el.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    el.addEventListener('mouseleave', this.onMouseLeave);
    window.addEventListener('mousemove', this.onMouseMove);
    el.addEventListener('wheel', this.onWheel, { passive: true });
  }

  private setKey(e: KeyboardEvent, down: boolean): void {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.forward = down;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.back = down;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.left = down;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.right = down;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.sprint = down;
        break;
      case 'Space':
        if (down) this.jumpQueued = true;
        e.preventDefault();
        break;
      case 'KeyP':
        if (down) this.pauseQueued = true;
        break;
      case 'Digit1':
      case 'Numpad1':
        if (down) this.abilityQueued = 0;
        break;
      case 'Digit2':
      case 'Numpad2':
        if (down) this.abilityQueued = 1;
        break;
      case 'Digit3':
      case 'Numpad3':
        if (down) this.abilityQueued = 2;
        break;
      case 'Digit4':
      case 'Numpad4':
        if (down) this.abilityQueued = 3;
        break;
      case 'Digit5':
      case 'Numpad5':
        if (down) this.abilityQueued = 4;
        break;
      case 'KeyF':
        if (down) this.interactQueued = true;
        break;
      case 'KeyI':
        if (down) this.toggleInvQueued = true;
        break;
      case 'KeyC':
        if (down) this.toggleCharQueued = true;
        break;
      case 'Tab':
        if (down) this.cycleQueued = true;
        e.preventDefault(); // keep keyboard focus on the game
        break;
      case 'Escape':
        if (down) this.clearQueued = true;
        break;
      default:
        return;
    }
  }

  consumeJump(): boolean {
    const j = this.jumpQueued;
    this.jumpQueued = false;
    return j;
  }

  consumePauseToggle(): boolean {
    const p = this.pauseQueued;
    this.pauseQueued = false;
    return p;
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

  consumeClearTarget(): boolean {
    const c = this.clearQueued;
    this.clearQueued = false;
    return c;
  }

  consumeClick(): { ndcX: number; ndcY: number } | null {
    const c = this.clickQueued;
    this.clickQueued = null;
    return c;
  }

  consumeInteract(): boolean {
    const v = this.interactQueued;
    this.interactQueued = false;
    return v;
  }

  consumeToggleInventory(): boolean {
    const v = this.toggleInvQueued;
    this.toggleInvQueued = false;
    return v;
  }

  consumeToggleCharacter(): boolean {
    const v = this.toggleCharQueued;
    this.toggleCharQueued = false;
    return v;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.el.removeEventListener('contextmenu', this.onContextMenu);
    this.el.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.el.removeEventListener('mouseleave', this.onMouseLeave);
    window.removeEventListener('mousemove', this.onMouseMove);
    this.el.removeEventListener('wheel', this.onWheel);
  }
}
