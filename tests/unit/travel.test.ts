import { describe, it, expect } from 'vitest';
import { World, type Entity } from '../../src/core/ecs/world';
import {
  C,
  type Transform,
  type Inventory,
  type CombatState,
  type Respawn,
  type WaypointUnlocks,
} from '../../src/core/ecs/components';
import { createPlayer, createOathstone } from '../../src/sim/factory';
import { activatedOathstones, fastTravel, TRAVEL_TOLL } from '../../src/sim/travel';
import { flatField } from './helpers';

const FIELD = flatField();

function giveGold(world: World, player: number, gold: number): void {
  world.get<Inventory>(player, C.Inventory)!.gold = gold;
}

/** Activation is per-player now: add a stone id to this player's own unlock set. */
function unlock(world: World, player: Entity, ...ids: string[]): void {
  world.get<WaypointUnlocks>(player, C.WaypointUnlocks)!.ids.push(...ids);
}

describe('fast travel', () => {
  it('lists only the stones THIS player has activated', () => {
    const world = new World();
    const player = createPlayer(world, FIELD, 0, 0);
    createOathstone(world, FIELD, 'a', 'Stone A', 10, 0);
    createOathstone(world, FIELD, 'b', 'Stone B', 20, 0);
    unlock(world, player, 'a');

    const list = activatedOathstones(world, player);
    expect(list.map((d) => d.id)).toEqual(['a']);
  });

  it('teleports to a stone, charges the toll, and rebinds respawn', () => {
    const world = new World();
    const player = createPlayer(world, FIELD, 0, 0);
    const dest = createOathstone(world, FIELD, 'frostgate', 'Frostgate Keep', 40, 40);
    unlock(world, player, 'frostgate');
    giveGold(world, player, 50);

    const res = fastTravel(world, player, dest, FIELD);
    expect(res.ok).toBe(true);

    const pt = world.get<Transform>(player, C.Transform)!;
    expect(pt.x).toBe(40);
    expect(pt.z).toBe(40);
    expect(world.get<Inventory>(player, C.Inventory)!.gold).toBe(50 - TRAVEL_TOLL);
    const respawn = world.get<Respawn>(player, C.Respawn)!;
    expect(respawn.x).toBe(40);
    expect(respawn.z).toBe(40);
  });

  it('refuses to travel while in combat', () => {
    const world = new World();
    const player = createPlayer(world, FIELD, 0, 0);
    const dest = createOathstone(world, FIELD, 'frostgate', 'Frostgate Keep', 40, 40);
    unlock(world, player, 'frostgate');
    giveGold(world, player, 50);
    world.get<CombatState>(player, C.CombatState)!.inCombat = true;

    const res = fastTravel(world, player, dest, FIELD);
    expect(res).toEqual({ ok: false, reason: 'combat' });
    expect(world.get<Transform>(player, C.Transform)!.x).toBe(0);
  });

  it('refuses to travel without the toll', () => {
    const world = new World();
    const player = createPlayer(world, FIELD, 0, 0);
    const dest = createOathstone(world, FIELD, 'frostgate', 'Frostgate Keep', 40, 40);
    unlock(world, player, 'frostgate');
    giveGold(world, player, TRAVEL_TOLL - 1);

    const res = fastTravel(world, player, dest, FIELD);
    expect(res).toEqual({ ok: false, reason: 'gold' });
  });

  it('refuses a dormant (undiscovered) Oathstone', () => {
    const world = new World();
    const player = createPlayer(world, FIELD, 0, 0);
    const dest = createOathstone(world, FIELD, 'frostgate', 'Frostgate Keep', 40, 40);
    giveGold(world, player, 50);

    const res = fastTravel(world, player, dest, FIELD);
    expect(res).toEqual({ ok: false, reason: 'invalid' });
  });

  it("refuses to travel to the stone you're standing on", () => {
    const world = new World();
    const player = createPlayer(world, FIELD, 0, 0);
    const dest = createOathstone(world, FIELD, 'spawn', 'Oathhold', 0, 0);
    unlock(world, player, 'spawn');
    giveGold(world, player, 50);

    const res = fastTravel(world, player, dest, FIELD);
    expect(res).toEqual({ ok: false, reason: 'here' });
  });

  // H2/H4 regression: two players in the same world have INDEPENDENT networks — one player's
  // unlock is invisible to (and not usable by) another, even though the stone is globally lit.
  it('keeps each player fast-travel network independent (no cross-player leak)', () => {
    const world = new World();
    const alice = createPlayer(world, FIELD, 0, 0);
    const bob = createPlayer(world, FIELD, 5, 5);
    const dest = createOathstone(world, FIELD, 'frostgate', 'Frostgate Keep', 40, 40);
    unlock(world, alice, 'frostgate'); // only Alice discovered it
    giveGold(world, alice, 50);
    giveGold(world, bob, 50);

    expect(activatedOathstones(world, alice).map((d) => d.id)).toEqual(['frostgate']);
    expect(activatedOathstones(world, bob)).toEqual([]); // Bob sees nothing
    expect(fastTravel(world, bob, dest, FIELD)).toEqual({ ok: false, reason: 'invalid' });
    expect(fastTravel(world, alice, dest, FIELD).ok).toBe(true);
  });
});
