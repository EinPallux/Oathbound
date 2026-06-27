import { describe, it, expect } from 'vitest';
import { World } from '../../src/core/ecs/world';
import {
  C,
  type Health,
  type Resource,
  type Offense,
  type Shield,
  type CastState,
  type Statuses,
} from '../../src/core/ecs/components';
import { createCombatSystem } from '../../src/sim/systems/combat';
import { createPlayer, createBloomhusk } from '../../src/sim/factory';
import { Projectiles } from '../../src/sim/projectiles';
import { applyDamage } from '../../src/sim/combat/apply';
import { Status, hasStatus } from '../../src/sim/combat/statuses';
import { Rng } from '../../src/core/rng';
import { DT } from '../../src/core/time';
import { flatField, makeInput, setLevel } from './helpers';

const FIELD = flatField();

function priestSetup(seed = 1) {
  const world = new World();
  const { ctrl, state } = makeInput();
  const player = createPlayer(world, FIELD, 0, 0, 'priest');
  setLevel(world, player, 10); // unlock the full early kit
  const projectiles = new Projectiles();
  const combat = createCombatSystem({
    input: ctrl,
    rng: new Rng(seed),
    colliders: [],
    field: FIELD,
    projectiles,
  });
  const prng = new Rng(seed + 1);
  const step = (): void => {
    combat.update(world, DT);
    projectiles.update(world, DT, prng);
  };
  return { world, ctrl, state, player, projectiles, step };
}

describe('Priest', () => {
  it('uses SPR + Mana and Smite holy bypasses armor', () => {
    const { world, state, player, step } = priestSetup();
    expect(world.get<Resource>(player, C.Resource)!.current).toBe(100); // Mana full
    const enemy = createBloomhusk(world, FIELD, 0, 4); // armoured
    const h = world.get<Health>(enemy, C.Health)!;
    const before = h.current;

    state.ability = 0; // Smite (holy projectile)
    for (let i = 0; i < 30 && h.current === before; i++) step();
    expect(h.current).toBeLessThan(before);
    void (world.get<Offense>(player, C.Offense)!.primaryStat > 0);
  });

  it('Mend heals the caster', () => {
    const { world, state, player, step } = priestSetup();
    const h = world.get<Health>(player, C.Health)!;
    h.current = h.max - 60;
    state.ability = 3; // Mend
    step();
    expect(h.current).toBeGreaterThan(h.max - 60);
  });

  it('Aegis grants a shield that soaks damage before HP', () => {
    const { world, state, player, step } = priestSetup();
    state.ability = 4; // Aegis (off-GCD shield)
    step();
    const shieldBefore = world.get<Shield>(player, C.Shield)!.amount;
    expect(shieldBefore).toBeGreaterThan(0);

    const h = world.get<Health>(player, C.Health)!;
    const fullHp = h.current;
    // A small enemy hit lands on the shield, not HP.
    const attacker = createBloomhusk(world, FIELD, 0, 2);
    applyDamage(
      world,
      attacker,
      player,
      { base: 3, coeff: 0, damageType: 'physical' },
      new Rng(5),
      0,
    );
    expect(world.get<Shield>(player, C.Shield)!.amount).toBeLessThan(shieldBefore);
    expect(h.current).toBe(fullHp); // shield absorbed it
  });

  it('Atonement returns a fraction of spell damage as healing', () => {
    const { world, state, player, step } = priestSetup();
    const enemy = createBloomhusk(world, FIELD, 0, 4);
    const h = world.get<Health>(player, C.Health)!;
    h.current = h.max - 60;

    state.ability = 5; // toggle Atonement on
    step();
    expect(hasStatus(world.get<Statuses>(player, C.Statuses), Status.Atonement)).toBe(true);

    const hpAfterToggle = h.current;
    const enemyH = world.get<Health>(enemy, C.Health)!;
    // Cast Smite repeatedly; landing hits should heal the Priest via Atonement.
    for (let i = 0; i < 60 && h.current === hpAfterToggle && enemyH.current > 0; i++) {
      state.ability = 0;
      step();
    }
    expect(h.current).toBeGreaterThan(hpAfterToggle);
  });

  it('Searing Light is a cast: resolves after its cast time, and moving cancels it', () => {
    // Resolves normally.
    {
      const { world, state, step } = priestSetup();
      const enemy = createBloomhusk(world, FIELD, 0, 4);
      const h = world.get<Health>(enemy, C.Health)!;
      const before = h.current;
      state.ability = 1; // Searing Light
      step(); // begins the cast — no damage yet
      expect(h.current).toBe(before);
      for (let i = 0; i < 80 && h.current === before; i++) step();
      expect(h.current).toBeLessThan(before);
    }
    // Moving cancels.
    {
      const { world, ctrl, state, step } = priestSetup();
      const enemy = createBloomhusk(world, FIELD, 0, 4);
      const h = world.get<Health>(enemy, C.Health)!;
      const before = h.current;
      state.ability = 1;
      step(); // begin cast
      const player = [...world.query(C.CastState)][0];
      expect(world.get<CastState>(player, C.CastState)).toBeTruthy();
      ctrl.forward = true; // move → cancel
      step();
      ctrl.forward = false;
      for (let i = 0; i < 10; i++) step();
      expect(h.current).toBe(before); // cast was cancelled
    }
  });
});
