import { describe, it, expect } from 'vitest';
import { World } from '../../src/core/ecs/world';

describe('World (ECS-lite)', () => {
  it('creates unique entities and tracks the count', () => {
    const w = new World();
    const a = w.createEntity();
    const b = w.createEntity();
    expect(a).not.toBe(b);
    expect(w.entityCount).toBe(2);
  });

  it('destroys entities and forgets them', () => {
    const w = new World();
    const a = w.createEntity();
    w.destroyEntity(a);
    expect(w.has(a)).toBe(false);
    expect(w.entityCount).toBe(0);
  });

  it('sets, gets, and removes components', () => {
    const w = new World();
    const e = w.createEntity();
    w.set(e, 'pos', { x: 1 });
    expect(w.get<{ x: number }>(e, 'pos')).toEqual({ x: 1 });
    w.remove(e, 'pos');
    expect(w.get(e, 'pos')).toBeUndefined();
  });

  it('queries entities that have all named components', () => {
    const w = new World();
    const e1 = w.createEntity();
    const e2 = w.createEntity();
    w.set(e1, 'a', 1);
    w.set(e1, 'b', 1);
    w.set(e2, 'a', 1);
    expect([...w.query('a', 'b')]).toEqual([e1]);
    expect([...w.query('a')].sort()).toEqual([e1, e2]);
  });

  it('clears components from all stores when an entity is destroyed', () => {
    const w = new World();
    const e = w.createEntity();
    w.set(e, 'a', 1);
    w.destroyEntity(e);
    expect([...w.query('a')]).toEqual([]);
  });

  it('runs registered systems each update', () => {
    const w = new World();
    const e = w.createEntity();
    w.set(e, 'n', { v: 0 });
    w.addSystem({
      name: 'inc',
      update: (world, dt) => {
        for (const x of world.query('n')) world.get<{ v: number }>(x, 'n')!.v += dt;
      },
    });
    w.update(0.5);
    w.update(0.5);
    expect(w.get<{ v: number }>(e, 'n')!.v).toBe(1);
  });
});
