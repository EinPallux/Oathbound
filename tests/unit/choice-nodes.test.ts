import { describe, it, expect } from 'vitest';
import { World } from '../../src/core/ecs/world';
import {
  C,
  type Health,
  type Resource,
  type Statuses,
  type PlayerClass,
} from '../../src/core/ecs/components';
import { createCombatSystem } from '../../src/sim/systems/combat';
import { createPlayer, createBloomhusk } from '../../src/sim/factory';
import { getClass, resolveKit, kitLength } from '../../src/sim/classes';
import { serialize, applySave } from '../../src/sim/save';
import { Status, hasStatus } from '../../src/sim/combat/statuses';
import { Projectiles } from '../../src/sim/projectiles';
import { Rng } from '../../src/core/rng';
import { DT } from '../../src/core/time';
import { flatField, makeInput, setLevel } from './helpers';

const FIELD = flatField();
const WAR_A_SLOT = 8; // 8 base abilities, then choice node A

function combatSetup(level: number, choices?: Record<string, number>) {
  const world = new World();
  const { ctrl, state } = makeInput();
  const player = createPlayer(world, FIELD, 0, 0);
  setLevel(world, player, level);
  if (choices) world.get<PlayerClass>(player, C.PlayerClass)!.choices = choices;
  const sys = createCombatSystem({
    input: ctrl,
    rng: new Rng(5),
    colliders: [],
    field: FIELD,
    projectiles: new Projectiles(),
  });
  return { world, state, player, sys };
}

describe('choice nodes — resolveKit', () => {
  it('appends one selected option per node (default = option 0)', () => {
    const cls = getClass('warrior');
    const kit = resolveKit(cls);
    expect(kit.length).toBe(kitLength(cls)); // 8 base + 2 nodes
    expect(kit[WAR_A_SLOT].id).toBe('rallying-cry');
    expect(kit[WAR_A_SLOT + 1].id).toBe('unbreakable');
  });

  it('selecting option 1 swaps that slot', () => {
    const cls = getClass('warrior');
    const kit = resolveKit(cls, { 'war-a': 1, 'war-b': 1 });
    expect(kit[WAR_A_SLOT].id).toBe('bloodthirst');
    expect(kit[WAR_A_SLOT + 1].id).toBe('ravager');
  });
});

describe('choice nodes — distinct play', () => {
  it('default node A (Rallying Cry) buffs the Warrior and deals no damage', () => {
    const { world, state, player, sys } = combatSetup(14);
    const enemy = createBloomhusk(world, FIELD, 0, 3);
    const h = world.get<Health>(enemy, C.Health)!;

    state.ability = WAR_A_SLOT;
    sys.update(world, DT);

    expect(hasStatus(world.get<Statuses>(player, C.Statuses), Status.Bulwark)).toBe(true);
    expect(h.current).toBe(h.max); // self-buff, the enemy is untouched
  });

  it('node A option 1 (Bloodthirst) damages the target instead', () => {
    const { world, state, player, sys } = combatSetup(14, { 'war-a': 1 });
    const enemy = createBloomhusk(world, FIELD, 0, 3);
    world.get<Resource>(player, C.Resource)!.current = 40; // Fury for Bloodthirst
    const h = world.get<Health>(enemy, C.Health)!;

    state.ability = WAR_A_SLOT;
    sys.update(world, DT);

    expect(h.current).toBeLessThan(h.max);
    expect(hasStatus(world.get<Statuses>(player, C.Statuses), Status.Bulwark)).toBe(false);
  });

  it('a choice slot is gated until its unlock level', () => {
    const { world, state, player, sys } = combatSetup(13); // node A unlocks at 14
    state.ability = WAR_A_SLOT;
    sys.update(world, DT);
    expect(hasStatus(world.get<Statuses>(player, C.Statuses), Status.Bulwark)).toBe(false);
  });
});

describe('choice nodes — persistence', () => {
  it('survives a save round-trip', () => {
    const w1 = new World();
    const p1 = createPlayer(w1, FIELD, 0, 0);
    setLevel(w1, p1, 18);
    w1.get<PlayerClass>(p1, C.PlayerClass)!.choices = { 'war-a': 1, 'war-b': 1 };

    const data = serialize(w1, p1);
    expect(data.choices).toEqual({ 'war-a': 1, 'war-b': 1 });

    const w2 = new World();
    const p2 = createPlayer(w2, FIELD, 0, 0);
    applySave(w2, p2, data);
    expect(w2.get<PlayerClass>(p2, C.PlayerClass)!.choices).toEqual({ 'war-a': 1, 'war-b': 1 });
  });
});
