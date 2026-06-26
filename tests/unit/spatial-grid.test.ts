import { describe, it, expect } from 'vitest';
import { SpatialGrid } from '../../src/sim/spatial-grid';

describe('SpatialGrid', () => {
  it('returns entities near a query point and excludes far ones', () => {
    const g = new SpatialGrid(8);
    g.insert(1, 0, 0);
    g.insert(2, 3, 1);
    g.insert(3, 50, 50);

    const out: number[] = [];
    g.queryCircle(0, 0, 5, out);
    expect(out).toContain(1);
    expect(out).toContain(2);
    expect(out).not.toContain(3);
  });

  it('reuses (clears) the out array each query', () => {
    const g = new SpatialGrid(8);
    g.insert(1, 0, 0);
    g.insert(3, 50, 50);
    const out: number[] = [];
    g.queryCircle(0, 0, 4, out);
    expect(out).toEqual([1]);
    g.queryCircle(50, 50, 4, out);
    expect(out).toEqual([3]);
  });

  it('handles negative coordinates', () => {
    const g = new SpatialGrid(8);
    g.insert(7, -20, -20);
    const out: number[] = [];
    g.queryCircle(-20, -20, 3, out);
    expect(out).toContain(7);
  });

  it('clear empties the grid', () => {
    const g = new SpatialGrid(8);
    g.insert(1, 0, 0);
    g.clear();
    const out: number[] = [];
    g.queryCircle(0, 0, 100, out);
    expect(out.length).toBe(0);
  });
});
