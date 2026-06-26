// Fixed-timestep game loop with interpolated rendering.
// The simulation advances in fixed DT steps; rendering happens once per animation
// frame and interpolates between the previous and current sim states.
// See docs/technical/ARCHITECTURE_PLAN.md#fixed-timestep-simulation-decoupled-rendering

import { DT, MAX_FRAME } from './time';

export interface LoopCallbacks {
  /** Advance the simulation by one fixed timestep. */
  step: (dt: number) => void;
  /** Render, interpolating by alpha in [0, 1) between the last two sim states. */
  render: (alpha: number) => void;
  /** Per-frame hook for diagnostics (frame time in ms, sim steps run this frame). */
  onFrame?: (frameMs: number, steps: number) => void;
}

/**
 * Pure accumulator math, extracted for unit testing.
 * Given the current accumulator and the real frame time (seconds), returns how many
 * fixed steps to run and the leftover remainder. Clamps frame time to MAX_FRAME.
 */
export function simSteps(
  accumulator: number,
  frameTime: number,
): { steps: number; remainder: number } {
  let acc = accumulator + Math.min(frameTime, MAX_FRAME);
  let steps = 0;
  while (acc >= DT) {
    acc -= DT;
    steps++;
  }
  return { steps, remainder: acc };
}

export class GameLoop {
  private accumulator = 0;
  private last = 0;
  private running = false;
  private rafId = 0;

  constructor(private readonly cb: LoopCallbacks) {}

  start(now: number = performance.now()): void {
    if (this.running) return;
    this.running = true;
    this.last = now;
    const frame = (t: number): void => {
      if (!this.running) return;
      this.tick(t);
      this.rafId = requestAnimationFrame(frame);
    };
    this.rafId = requestAnimationFrame(frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  get isRunning(): boolean {
    return this.running;
  }

  /** Advance the loop given an absolute timestamp (ms). Exposed for tests. */
  tick(now: number): void {
    const frameTime = (now - this.last) / 1000;
    this.last = now;

    const { steps, remainder } = simSteps(this.accumulator, frameTime);
    for (let i = 0; i < steps; i++) this.cb.step(DT);
    this.accumulator = remainder;

    const alpha = this.accumulator / DT;
    this.cb.render(alpha);
    this.cb.onFrame?.(Math.min(frameTime, MAX_FRAME) * 1000, steps);
  }
}
