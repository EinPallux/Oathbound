import { describe, it, expect } from 'vitest';
import { Rng } from '../../src/core/rng';

describe('Rng (seedable)', () => {
  it('is deterministic for a given seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const seqA = Array.from({ length: 8 }, () => a.next());
    const seqB = Array.from({ length: 8 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces different streams for different seeds', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it('next() stays within [0, 1)', () => {
    const r = new Rng(7);
    for (let i = 0; i < 2000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int(n) returns integers within [0, n)', () => {
    const r = new Rng(123);
    for (let i = 0; i < 2000; i++) {
      const v = r.int(10);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(10);
    }
  });

  it('range(min, max) stays within bounds', () => {
    const r = new Rng(99);
    for (let i = 0; i < 2000; i++) {
      const v = r.range(5, 8);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThan(8);
    }
  });

  it('fork() yields an independent but reproducible stream', () => {
    const a = new Rng(5).fork(11);
    const b = new Rng(5).fork(11);
    expect(a.next()).toBe(b.next());
  });
});
