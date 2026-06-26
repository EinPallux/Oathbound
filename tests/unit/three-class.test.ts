import { describe, it, expect } from 'vitest';
import { World } from '../../src/core/ecs/world';
import { C, type Health, type Resource, type Offense, type ClassId } from '../../src/core/ecs/components';
import { createCombatSystem } from '../../src/sim/systems/combat';
import { createPlayer, createBloomhusk } from '../../src/sim/factory';
import { Projectiles } from '../../src/sim/projectiles';
import { Rng } from '../../src/core/rng';
import { DT } from '../../src/core/time';
import { flatField, makeInput } from './helpers';

const FIELD = flatField();

// Spender index per class (else the slot-0 filler).
const SPENDER: Record<ClassId, { index: number; cost: number }> = {
  warrior: { index: 1, cost: 30 }, // Sunder
  hunter: { index: 1, cost: 35 }, // Piercing Arrow
  priest: { index: 0, cost: 0 }, // Smite is the main holy filler/spender
};

/** Time-to-kill a same-level standard Bloomhusk with a representative rotation
 *  (no resource regen → burst + filler only; crit disabled for determinism). */
function ttk(classId: ClassId): number {
  const world = new World();
  const { ctrl, state } = makeInput();
  const player = createPlayer(world, FIELD, 0, 0, classId);
  world.get<Offense>(player, C.Offense)!.critChance = 0;
  const enemy = createBloomhusk(world, FIELD, 0, 3, 1);
  const projectiles = new Projectiles();
  const combat = createCombatSystem({
    input: ctrl,
    rng: new Rng(7),
    colliders: [],
    field: FIELD,
    projectiles,
  });
  const prng = new Rng(11);
  const h = world.get<Health>(enemy, C.Health)!;
  const res = world.get<Resource>(player, C.Resource)!;
  const sp = SPENDER[classId];

  let seconds = 0;
  for (let i = 0; i < Math.ceil(12 / DT) && h.current > 0; i++) {
    state.ability = res.current >= sp.cost ? sp.index : 0;
    combat.update(world, DT);
    projectiles.update(world, DT, prng);
    seconds += DT;
  }
  expect(h.current).toBe(0);
  return seconds;
}

describe('Three-Class Gate — solo TTK', () => {
  it('every class kills a same-level standard, within band and ±20% of each other', () => {
    const w = ttk('warrior');
    const h = ttk('hunter');
    const p = ttk('priest');

    for (const [name, t] of [
      ['warrior', w],
      ['hunter', h],
      ['priest', p],
    ] as const) {
      expect(t, `${name} TTK ${t}s in 3–6s band`).toBeGreaterThanOrEqual(3);
      expect(t, `${name} TTK ${t}s in 3–6s band`).toBeLessThanOrEqual(6);
    }

    const max = Math.max(w, h, p);
    const min = Math.min(w, h, p);
    // ±20% target (slack for sim granularity; strict balance is telemetry-tuned).
    expect(max / min).toBeLessThanOrEqual(1.25);
  });
});
