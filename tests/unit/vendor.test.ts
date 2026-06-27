import { describe, it, expect } from 'vitest';
import { World } from '../../src/core/ecs/world';
import { C, type Inventory, type Transform } from '../../src/core/ecs/components';
import { createPlayer, createVendor } from '../../src/sim/factory';
import { addItem } from '../../src/sim/inventory';
import { vendorValue, sellItem, sellAllBelow, nearestVendor } from '../../src/sim/vendor';
import { generateItem } from '../../src/sim/loot/items';
import { Rng } from '../../src/core/rng';
import { flatField } from './helpers';

const FIELD = flatField();

describe('vendor (selling)', () => {
  it('values rarer gear higher', () => {
    const common = generateItem(new Rng(1), { ilvl: 10, slot: 'chest', rarity: 'common' });
    const uncommon = generateItem(new Rng(2), { ilvl: 10, slot: 'chest', rarity: 'uncommon' });
    const rare = generateItem(new Rng(3), { ilvl: 10, slot: 'chest', rarity: 'rare' });
    expect(vendorValue(common)).toBeGreaterThan(0);
    expect(vendorValue(uncommon)).toBeGreaterThan(vendorValue(common));
    expect(vendorValue(rare)).toBeGreaterThan(vendorValue(uncommon));
  });

  it('sells a bagged item for gold and removes it from the bag', () => {
    const world = new World();
    const player = createPlayer(world, FIELD, 0, 0);
    const item = generateItem(new Rng(1), { ilvl: 8, slot: 'weapon', rarity: 'common' });
    addItem(world, player, item);
    const inv = world.get<Inventory>(player, C.Inventory)!;

    const expected = vendorValue(item);
    expect(sellItem(world, player, item.uid)).toBe(true);
    expect(inv.items.length).toBe(0);
    expect(inv.gold).toBe(expected);
  });

  it('never sells a locked item', () => {
    const world = new World();
    const player = createPlayer(world, FIELD, 0, 0);
    const item = generateItem(new Rng(1), { ilvl: 8, slot: 'weapon', rarity: 'rare' });
    item.locked = true;
    addItem(world, player, item);

    expect(sellItem(world, player, item.uid)).toBe(false);
    expect(world.get<Inventory>(player, C.Inventory)!.items.length).toBe(1);
  });

  it('sell-all-commons spares uncommon+ and locked gear', () => {
    const world = new World();
    const player = createPlayer(world, FIELD, 0, 0);
    addItem(world, player, generateItem(new Rng(1), { ilvl: 5, slot: 'head', rarity: 'common' }));
    addItem(world, player, generateItem(new Rng(2), { ilvl: 5, slot: 'legs', rarity: 'common' }));
    addItem(world, player, generateItem(new Rng(3), { ilvl: 5, slot: 'feet', rarity: 'uncommon' }));
    const locked = generateItem(new Rng(4), { ilvl: 5, slot: 'hands', rarity: 'common' });
    locked.locked = true;
    addItem(world, player, locked);

    const sold = sellAllBelow(world, player, 'common');
    expect(sold).toBe(2);
    expect(world.get<Inventory>(player, C.Inventory)!.items.length).toBe(2); // uncommon + locked common
  });

  it('finds the nearest vendor only within range', () => {
    const world = new World();
    const player = createPlayer(world, FIELD, 0, 0);
    const vendor = createVendor(world, FIELD, 'Quartermaster', 2, 0);
    expect(nearestVendor(world, player)).toBe(vendor);

    world.get<Transform>(player, C.Transform)!.x = 50;
    expect(nearestVendor(world, player)).toBeNull();
  });
});
