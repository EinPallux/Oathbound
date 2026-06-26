import { describe, it, expect } from 'vitest';
import { getClass } from '../../src/sim/classes';

describe('class registry', () => {
  it('defines the Warrior (melee/STR/Fury)', () => {
    const w = getClass('warrior');
    expect(w.primaryStatId).toBe('STR');
    expect(w.resource.name).toBe('Fury');
    expect(w.resource.startsFull).toBe(false);
    expect(w.abilities.length).toBe(4);
  });

  it('defines the Hunter (ranged/DEX/Focus)', () => {
    const h = getClass('hunter');
    expect(h.primaryStatId).toBe('DEX');
    expect(h.resource.name).toBe('Focus');
    expect(h.resource.startsFull).toBe(true);
    expect(h.resource.regenPerSec).toBeGreaterThan(0);
    expect(h.abilities.length).toBe(5);
    expect(h.abilities.map((a) => a.targeting)).toContain('projectile');
    expect(h.abilities.map((a) => a.targeting)).toContain('trap');
  });
});
