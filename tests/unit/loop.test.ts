import { describe, it, expect } from 'vitest';
import { simSteps } from '../../src/core/loop';
import { DT, MAX_FRAME } from '../../src/core/time';

describe('fixed-timestep accumulator (simSteps)', () => {
  it('runs exactly one step per DT', () => {
    const { steps, remainder } = simSteps(0, DT);
    expect(steps).toBe(1);
    expect(remainder).toBeCloseTo(0, 6);
  });

  it('accumulates fractional time without stepping early', () => {
    const { steps, remainder } = simSteps(0, DT * 0.5);
    expect(steps).toBe(0);
    expect(remainder).toBeCloseTo(DT * 0.5, 6);
  });

  it('carries the remainder forward across calls', () => {
    const first = simSteps(0, DT * 0.6);
    expect(first.steps).toBe(0);
    const second = simSteps(first.remainder, DT * 0.6);
    expect(second.steps).toBe(1); // 0.6 + 0.6 = 1.2 DT => one step
  });

  it('runs multiple steps for a long frame', () => {
    expect(simSteps(0, DT * 3).steps).toBe(3);
  });

  it('clamps huge frames to MAX_FRAME to avoid a spiral of death', () => {
    const { steps } = simSteps(0, 100);
    expect(steps).toBe(Math.floor(MAX_FRAME / DT));
  });
});
