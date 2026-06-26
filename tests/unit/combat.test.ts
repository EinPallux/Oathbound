import { describe, it, expect } from 'vitest';
import { World, type Entity } from '../../src/core/ecs/world';
import {
  C,
  type Health,
  type AbilityState,
  type Target,
  type Targetable,
} from '../../src/core/ecs/components';
import { createCombatSystem } from '../../src/sim/systems/combat';
import { Rng } from '../../src/core/rng';
import { GCD } from '../../src/sim/combat/abilities';
import type { ControlState } from '../../src/platform/input';
import { DT } from '../../src/core/time';

// A minimal scriptable ControlState for the sim, with mutable queued actions.
function makeInput(): {
  ctrl: ControlState;
  state: { ability: number | null; cycle: boolean; clear: boolean };
} {
  const state = { ability: null as number | null, cycle: false, clear: false };
  const ctrl: ControlState = {
    forward: false,
    back: false,
    left: false,
    right: false,
    sprint: false,
    yaw: 0,
    pitch: 0.5,
    dist: 10,
    consumeJump: () => false,
    consumeAbility: () => {
      const a = state.ability;
      state.ability = null;
      return a;
    },
    consumeTargetCycle: () => {
      const c = state.cycle;
      state.cycle = false;
      return c;
    },
    consumeClearTarget: () => {
      const c = state.clear;
      state.clear = false;
      return c;
    },
    consumeClick: () => null,
  };
  return { ctrl, state };
}

function addPlayer(world: World): Entity {
  const e = world.createEntity();
  world.set(e, C.Transform, { x: 0, y: 1, z: 0, yaw: 0, prevX: 0, prevY: 1, prevZ: 0, prevYaw: 0 });
  world.set(e, C.PlayerControlled, true);
  world.set(e, C.Offense, { primaryStat: 10, level: 1, critChance: 0, critMult: 1.5 });
  world.set<AbilityState>(e, C.AbilityState, {
    gcdRemaining: 0,
    cooldowns: [0, 0],
    bufferedIndex: -1,
    bufferRemaining: 0,
  });
  world.set<Target>(e, C.Target, { entity: null });
  return e;
}

function addDummy(world: World, x: number, z: number, hp = 120): Entity {
  const e = world.createEntity();
  world.set(e, C.Transform, { x, y: 1, z, yaw: 0, prevX: x, prevY: 1, prevZ: z, prevYaw: 0 });
  world.set<Health>(e, C.Health, { current: hp, max: hp });
  world.set(e, C.Defense, { armor: 40, resist: { fire: 0, frost: 0, blight: 0 }, weakness: {} });
  world.set<Targetable>(e, C.Targetable, true);
  return e;
}

describe('combat system', () => {
  it('soft-acquires a hostile in front and applies damage', () => {
    const world = new World();
    const { ctrl, state } = makeInput();
    const player = addPlayer(world);
    const dummy = addDummy(world, 0, 3);
    const sys = createCombatSystem({ input: ctrl, rng: new Rng(1), colliders: [] });

    state.ability = 0; // Strike
    sys.update(world, DT);

    const h = world.get<Health>(dummy, C.Health)!;
    const tgt = world.get<Target>(player, C.Target)!;
    expect(h.current).toBeLessThan(120);
    expect(tgt.entity).toBe(dummy); // locked onto the soft target
  });

  it('enforces the global cooldown between casts', () => {
    const world = new World();
    const { ctrl, state } = makeInput();
    addPlayer(world);
    const dummy = addDummy(world, 0, 3);
    const sys = createCombatSystem({ input: ctrl, rng: new Rng(1), colliders: [] });
    const h = world.get<Health>(dummy, C.Health)!;

    state.ability = 0;
    sys.update(world, DT);
    const afterFirst = h.current;
    expect(afterFirst).toBeLessThan(120);

    // Immediate second press lands inside the GCD → swallowed.
    state.ability = 0;
    sys.update(world, DT);
    expect(h.current).toBe(afterFirst);

    // Let the GCD (and the input buffer) expire, then a press lands again.
    for (let i = 0; i < Math.ceil(GCD / DT) + 2; i++) sys.update(world, DT);
    expect(h.current).toBe(afterFirst); // nothing fired while idle
    state.ability = 0;
    sys.update(world, DT);
    expect(h.current).toBeLessThan(afterFirst);
  });

  it('does not hit hostiles outside the forward cone', () => {
    const world = new World();
    const { ctrl, state } = makeInput();
    const player = addPlayer(world);
    const behind = addDummy(world, 0, -3); // directly behind (yaw 0 faces +Z)
    const sys = createCombatSystem({ input: ctrl, rng: new Rng(1), colliders: [] });

    state.ability = 0;
    sys.update(world, DT);

    expect(world.get<Health>(behind, C.Health)!.current).toBe(120);
    expect(world.get<Target>(player, C.Target)!.entity).toBeNull();
  });

  it('Tab cycles to a hostile and Esc clears it', () => {
    const world = new World();
    const { ctrl, state } = makeInput();
    const player = addPlayer(world);
    const dummy = addDummy(world, 0, 4);
    const sys = createCombatSystem({ input: ctrl, rng: new Rng(1), colliders: [] });
    const tgt = world.get<Target>(player, C.Target)!;

    state.cycle = true;
    sys.update(world, DT);
    expect(tgt.entity).toBe(dummy);

    state.clear = true;
    sys.update(world, DT);
    expect(tgt.entity).toBeNull();
  });

  it('drops a target when it dies and stops dealing damage', () => {
    const world = new World();
    const { ctrl, state } = makeInput();
    const player = addPlayer(world);
    const dummy = addDummy(world, 0, 3, 10); // low HP: dies in one hit
    const sys = createCombatSystem({ input: ctrl, rng: new Rng(1), colliders: [] });

    state.ability = 0;
    sys.update(world, DT);
    const h = world.get<Health>(dummy, C.Health)!;
    expect(h.current).toBe(0);

    // Next step: the dead target is cleared.
    sys.update(world, DT);
    expect(world.get<Target>(player, C.Target)!.entity).toBeNull();
  });
});
