import { describe, it, expect } from 'vitest';
import { World } from '../../src/core/ecs/world';
import {
  C,
  type Transform,
  type Inventory,
  type CombatState,
  type Respawn,
  type Oathstone,
} from '../../src/core/ecs/components';
import { createPlayer, createOathstone } from '../../src/sim/factory';
import { activatedOathstones, fastTravel, TRAVEL_TOLL } from '../../src/sim/travel';
import { flatField } from './helpers';

const FIELD = flatField();

function giveGold(world: World, player: number, gold: number): void {
  world.get<Inventory>(player, C.Inventory)!.gold = gold;
}

describe('fast travel', () => {
  it('lists only activated Oathstones', () => {
    const world = new World();
    createPlayer(world, FIELD, 0, 0);
    const a = createOathstone(world, FIELD, 'a', 'Stone A', 10, 0);
    createOathstone(world, FIELD, 'b', 'Stone B', 20, 0);
    world.get<Oathstone>(a, C.Oathstone)!.activated = true;

    const list = activatedOathstones(world);
    expect(list.map((d) => d.id)).toEqual(['a']);
  });

  it('teleports to a stone, charges the toll, and rebinds respawn', () => {
    const world = new World();
    const player = createPlayer(world, FIELD, 0, 0);
    const dest = createOathstone(world, FIELD, 'frostgate', 'Frostgate Keep', 40, 40);
    world.get<Oathstone>(dest, C.Oathstone)!.activated = true;
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
    world.get<Oathstone>(dest, C.Oathstone)!.activated = true;
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
    world.get<Oathstone>(dest, C.Oathstone)!.activated = true;
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
    world.get<Oathstone>(dest, C.Oathstone)!.activated = true;
    giveGold(world, player, 50);

    const res = fastTravel(world, player, dest, FIELD);
    expect(res).toEqual({ ok: false, reason: 'here' });
  });
});
