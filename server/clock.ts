// The server's fixed-timestep tick loop — the headless replacement for the browser's
// requestAnimationFrame GameLoop (src/core/loop.ts). It advances the sim by exactly DT each
// tick at SIM_HZ, drift-corrected: the next tick is scheduled by absolute target time, not by
// "period after the last callback ran", so setTimeout jitter doesn't accumulate. If the
// process stalls (GC, disk), catch-up is bounded by MAX_FRAME to avoid a spiral of death.

import { DT, SIM_HZ, MAX_FRAME } from '../src/core/time';

export type StepFn = (dt: number) => void;

export class ServerClock {
  private running = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private nextTickAt = 0;
  private tickCount = 0;

  constructor(
    private readonly step: StepFn,
    private readonly hz: number = SIM_HZ,
  ) {}

  /** Total ticks advanced since start (also the authoritative server tick number). */
  get ticks(): number {
    return this.tickCount;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.nextTickAt = performance.now();
    this.loop();
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private loop = (): void => {
    if (!this.running) return;
    const period = 1000 / this.hz;
    const maxCatchUp = Math.max(1, Math.ceil(MAX_FRAME * this.hz)); // spiral-of-death guard
    const now = performance.now();

    let ran = 0;
    while (now >= this.nextTickAt && ran < maxCatchUp) {
      this.step(DT);
      this.tickCount++;
      this.nextTickAt += period;
      ran++;
    }
    // If we're still behind after the catch-up cap, we stalled hard — resync to now so we
    // don't try to replay minutes of ticks at once.
    if (now >= this.nextTickAt) this.nextTickAt = now + period;

    const delay = Math.max(0, this.nextTickAt - performance.now());
    this.timer = setTimeout(this.loop, delay);
  };
}
