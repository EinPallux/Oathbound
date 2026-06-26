// Seedable pseudo-random number generator (mulberry32).
// Deterministic for a given seed so loot/affix/spawn rolls and tests are reproducible.
// See docs/technical/CONTENT_DATA_STRATEGY.md#determinism--rng

export class Rng {
  private state: number;

  constructor(seed = 0x9e3779b9) {
    this.state = seed >>> 0;
  }

  /** Next float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [0, maxExclusive). */
  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Derive an independent stream from this one (e.g., per-entity rolls). */
  fork(salt: number): Rng {
    return new Rng((this.state ^ Math.imul(salt | 0, 0x85ebca6b)) >>> 0);
  }
}
