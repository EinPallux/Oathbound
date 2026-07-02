// Keyboard + mouse input, exposed as plain control state the simulation can read.
// Owns the camera-orbit angles (yaw/pitch/distance) since movement is camera-relative;
// the camera rig is a pure consumer of these. See docs/design/COMBAT_DESIGN.md (controls).

import { clamp } from '../core/math';
import { DEFAULT_KEYBINDS, ACTION_ORDER, type Keybinds, type BindableAction } from '../game/keybinds';

/** The subset of control state the simulation reads (no DOM concepts). */
export interface ControlState {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  /** Camera/movement yaw (radians). */
  yaw: number;
  /** Camera pitch (radians). */
  pitch: number;
  /** Camera follow distance (m). */
  dist: number;
  /** Returns true once if a jump was requested since the last call. */
  consumeJump(): boolean;
  /** Returns true once if the mount toggle (Shift) was pressed (summon / dismount). */
  consumeMount(): boolean;
  /** Returns a queued ability index (0-based) requested since the last call, or null. */
  consumeAbility(): number | null;
  /** Returns true once if Tab (cycle target) was pressed since the last call. */
  consumeTargetCycle(): boolean;
  /** Returns true once if Esc was pressed since the last call (handled by the bootstrap:
   *  close a panel → clear target → open the menu). */
  consumeEscape(): boolean;
  /** Returns a queued left-click in normalized device coords [-1, 1], or null. */
  consumeClick(): { ndcX: number; ndcY: number } | null;
  /** Returns true once if the interact key (F) was pressed since the last call. */
  consumeInteract(): boolean;
  /** Returns true once if the inventory toggle (I) was pressed. */
  consumeToggleInventory(): boolean;
  /** Returns true once if the character toggle (C) was pressed. */
  consumeToggleCharacter(): boolean;
  /** Returns true once if the travel toggle (T) was pressed. */
  consumeToggleTravel(): boolean;
  /** Returns true once if the map toggle (M) was pressed. */
  consumeToggleMap(): boolean;
  /** Returns true once if the settings toggle (O) was pressed. */
  consumeToggleSettings(): boolean;
}

export class InputController implements ControlState {
  forward = false;
  back = false;
  left = false;
  right = false;
  yaw = 0;
  pitch = 0.5;
  dist = 10;

  private jumpQueued = false;
  private mountQueued = false;
  private pauseQueued = false;
  private abilityQueued: number | null = null;
  private cycleQueued = false;
  private clearQueued = false;
  private clickQueued: { ndcX: number; ndcY: number } | null = null;
  private interactQueued = false;
  private toggleInvQueued = false;
  private toggleCharQueued = false;
  private toggleTravelQueued = false;
  private toggleMapQueued = false;
  private toggleSettingsQueued = false;
  private dragging = false;
  /** Base look sensitivity; scaled by the user's mouseSensitivity setting. */
  private readonly baseSensitivity = 0.0035;
  private sensitivity = 1;
  private invertY = false;
  private bindings: Keybinds = { ...DEFAULT_KEYBINDS };
  private readonly codeToAction = new Map<string, BindableAction>();

  private readonly onKeyDown = (e: KeyboardEvent): void => this.setKey(e, true);
  private readonly onKeyUp = (e: KeyboardEvent): void => this.setKey(e, false);
  private readonly onContextMenu = (e: Event): void => e.preventDefault();
  private readonly onMouseDown = (e: MouseEvent): void => {
    if (e.button === 2) {
      this.dragging = true;
      this.el.style.cursor = 'none'; // hide the cursor while looking around
      // Pointer Lock pins the OS cursor where the look began: dragging the camera can no
      // longer fling the pointer off-window, and movementX/Y still drives yaw/pitch. If
      // the browser refuses the lock we fall back to the bare cursor:none behaviour.
      this.requestLook();
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
    if (e.button === 2) {
      this.dragging = false;
      this.el.style.cursor = ''; // restore the cursor when the look ends
      if (document.pointerLockElement === this.el) document.exitPointerLock();
    }
  };
  private readonly onMouseLeave = (): void => {
    this.dragging = false;
    this.el.style.cursor = '';
  };
  // Pointer Lock dropping out from under us (the user pressed Esc, tabbed away, etc.)
  // must stop the drag, or the camera would keep slewing after the cursor reappears.
  private readonly onPointerLockChange = (): void => {
    if (document.pointerLockElement !== this.el) {
      this.dragging = false;
      this.el.style.cursor = '';
    }
  };
  private readonly onPointerLockError = (): void => {
    // Lock was refused (e.g. the engage-too-soon throttle); the cursor:none drag still
    // works, just without the pin. Swallow so it never surfaces as a console error.
  };
  private readonly onMouseMove = (e: MouseEvent): void => {
    if (!this.dragging) return;
    const s = this.baseSensitivity * this.sensitivity;
    this.yaw -= e.movementX * s;
    this.pitch = clamp(this.pitch + e.movementY * s * (this.invertY ? -1 : 1), 0.15, 1.3);
  };
  private readonly onWheel = (e: WheelEvent): void => {
    this.dist = clamp(this.dist + Math.sign(e.deltaY) * 1, 4, 22);
  };

  constructor(private readonly el: HTMLElement, keybinds: Keybinds = DEFAULT_KEYBINDS) {
    this.setKeybinds(keybinds);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    // Block the browser context menu everywhere (not just over the canvas): right-drag is
    // the camera-look control, and the menu must never interrupt it — even if the press
    // strays over a UI panel. Panels with their own right-click menus still work; they
    // run their handlers and preventDefault independently.
    window.addEventListener('contextmenu', this.onContextMenu);
    el.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    el.addEventListener('mouseleave', this.onMouseLeave);
    window.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('pointerlockerror', this.onPointerLockError);
    el.addEventListener('wheel', this.onWheel, { passive: true });
  }

  /** Ask the browser to pin the cursor for camera-look. No-op / silent if unsupported. */
  private requestLook(): void {
    if (document.pointerLockElement === this.el) return;
    try {
      // Newer browsers return a Promise; older ones return void — handle both.
      const r = this.el.requestPointerLock() as unknown as Promise<void> | undefined;
      if (r && typeof r.catch === 'function') r.catch(() => {});
    } catch {
      // Unsupported → the cursor:none drag still works, just without the pin.
    }
  }

  /** Apply a new keybind map live and rebuild the code→action lookup. */
  setKeybinds(keybinds: Keybinds): void {
    this.bindings = { ...keybinds };
    this.codeToAction.clear();
    for (const action of ACTION_ORDER) {
      const code = this.bindings[action];
      if (code) this.codeToAction.set(code, action);
    }
    // Drop any held movement so a rebind mid-press can't leave a key stuck "down".
    this.forward = this.back = this.left = this.right = false;
  }

  /** Mouse-look options: sensitivity multiplier + invert vertical axis. */
  setLook(sensitivityMult: number, invertY: boolean): void {
    this.sensitivity = sensitivityMult;
    this.invertY = invertY;
  }

  private setKey(e: KeyboardEvent, down: boolean): void {
    // Fixed (non-rebindable): target cycle/clear + an always-on arrow-key move fallback.
    switch (e.code) {
      case 'Tab':
        if (down) this.cycleQueued = true;
        e.preventDefault(); // keep keyboard focus on the game
        return;
      case 'Escape':
        if (down) this.clearQueued = true;
        return;
      case 'ArrowUp':
        this.forward = down;
        return;
      case 'ArrowDown':
        this.back = down;
        return;
      case 'ArrowLeft':
        this.left = down;
        return;
      case 'ArrowRight':
        this.right = down;
        return;
    }

    const action = this.codeToAction.get(e.code);
    if (!action) return;
    this.dispatch(action, down);
    if (action === 'jump') e.preventDefault(); // Space shouldn't scroll the page
  }

  private dispatch(action: BindableAction, down: boolean): void {
    if (action.startsWith('ability')) {
      if (down) this.abilityQueued = parseInt(action.slice(7), 10) - 1;
      return;
    }
    switch (action) {
      case 'forward':
        this.forward = down;
        break;
      case 'back':
        this.back = down;
        break;
      case 'left':
        this.left = down;
        break;
      case 'right':
        this.right = down;
        break;
      case 'mount':
        if (down) this.mountQueued = true;
        break;
      case 'jump':
        if (down) this.jumpQueued = true;
        break;
      case 'pause':
        if (down) this.pauseQueued = true;
        break;
      case 'interact':
        if (down) this.interactQueued = true;
        break;
      case 'inventory':
        if (down) this.toggleInvQueued = true;
        break;
      case 'character':
        if (down) this.toggleCharQueued = true;
        break;
      case 'travel':
        if (down) this.toggleTravelQueued = true;
        break;
      case 'map':
        if (down) this.toggleMapQueued = true;
        break;
      case 'settings':
        if (down) this.toggleSettingsQueued = true;
        break;
    }
  }

  consumeJump(): boolean {
    const j = this.jumpQueued;
    this.jumpQueued = false;
    return j;
  }

  consumeMount(): boolean {
    const m = this.mountQueued;
    this.mountQueued = false;
    return m;
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

  consumeEscape(): boolean {
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

  consumeToggleTravel(): boolean {
    const v = this.toggleTravelQueued;
    this.toggleTravelQueued = false;
    return v;
  }

  consumeToggleMap(): boolean {
    const v = this.toggleMapQueued;
    this.toggleMapQueued = false;
    return v;
  }

  consumeToggleSettings(): boolean {
    const v = this.toggleSettingsQueued;
    this.toggleSettingsQueued = false;
    return v;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('contextmenu', this.onContextMenu);
    this.el.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.el.removeEventListener('mouseleave', this.onMouseLeave);
    window.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    document.removeEventListener('pointerlockerror', this.onPointerLockError);
    this.el.removeEventListener('wheel', this.onWheel);
    if (document.pointerLockElement === this.el) document.exitPointerLock();
    this.el.style.cursor = '';
  }
}
