import { describe, it, expect } from 'vitest';
import { World, type Entity } from '../../src/core/ecs/world';
import { C, type Inventory, type LootDrop, type Transform } from '../../src/core/ecs/components';
import { createLootSystem, pickUpNearest } from '../../src/sim/systems/loot';
import { createPlayer } from '../../src/sim/factory';
import { generateItem } from '../../src/sim/loot/items';
import { Rng } from '../../src/core/rng';
import { DT } from '../../src/core/time';
import { flatField } from './helpers';

const FIELD = flatField();

function makeDrop(world: World, x: number, z: number, gold: number, item: Entity | null, ttl: number): Entity {
  const e = world.createEntity();
  world.set<Transform>(e, C.Transform, { x, y: 0, z, yaw: 0, prevX: x, prevY: 0, prevZ: z, prevYaw: 0 });
  world.set<LootDrop>(e, C.LootDrop, {
    item: item ? generateItem(new Rng(1), { ilvl: 5, slot: 'chest', rarity: 'common' }) : null,
    gold,
    owner: 1,
    ttl,
  });
  return e;
}

describe('loot system', () => {
  it('despawns uncollected drops after their TTL (no unbounded growth)', () => {
    const world = new World();
    createPlayer(world, FIELD, 0, 0);
    const sys = createLootSystem();

    const baseline = world.entityCount;
    for (let i = 0; i < 40; i++) makeDrop(world, 100 + i, 100, 5, null, 2); // far away
    expect(world.entityCount).toBe(baseline + 40);

    for (let i = 0; i < Math.ceil(3 / DT); i++) sys.update(world, DT);
    expect(world.entityCount).toBe(baseline); // all despawned
  });

  it('auto-collects gold and picks up the nearest item on interact', () => {
    const world = new World();
    const player = createPlayer(world, FIELD, 0, 0);
    const sys = createLootSystem();
    const inv = world.get<Inventory>(player, C.Inventory)!;

    makeDrop(world, 1, 0, 7, null, 120); // gold within auto-radius
    const itemDrop = makeDrop(world, 1.5, 0, 0, 1, 120); // item within pickup radius

    sys.update(world, DT); // gold auto-collected
    expect(inv.gold).toBe(7);

    const picked = pickUpNearest(world); // centralized F interact
    expect(picked).not.toBeNull();
    expect(inv.items.length).toBe(1);
    expect(world.has(itemDrop)).toBe(false);
  });

  it('pickUpNearest returns null when no item drop is in range', () => {
    const world = new World();
    createPlayer(world, FIELD, 0, 0);
    makeDrop(world, 50, 50, 0, 1, 120); // far away
    expect(pickUpNearest(world)).toBeNull();
  });
});
