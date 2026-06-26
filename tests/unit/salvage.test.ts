import { describe, it, expect } from 'vitest';
import { World } from '../../src/core/ecs/world';
import { C, type Inventory } from '../../src/core/ecs/components';
import { createPlayer } from '../../src/sim/factory';
import { addItem } from '../../src/sim/inventory';
import { grantXp } from '../../src/sim/progression';
import { generateItem } from '../../src/sim/loot/items';
import {
  salvageItem,
  salvageAllBelow,
  salvageYield,
  canSalvage,
  SALVAGE_LEVEL,
} from '../../src/sim/salvage';
import { Rng } from '../../src/core/rng';
import { flatField } from './helpers';

const FIELD = flatField();

function levelTo(world: World, player: number, level: number): void {
  // Plenty of XP to reach the target level.
  grantXp(world, player, 100000);
  // (createPlayer starts at 1; 100k XP caps out well past level 3)
  void level;
}

describe('salvage v1', () => {
  it('is gated until the unlock level', () => {
    expect(canSalvage(SALVAGE_LEVEL - 1)).toBe(false);
    expect(canSalvage(SALVAGE_LEVEL)).toBe(true);

    const world = new World();
    const player = createPlayer(world, FIELD, 0, 0); // level 1
    const item = generateItem(new Rng(1), { ilvl: 3, slot: 'chest', rarity: 'common' });
    addItem(world, player, item);

    expect(salvageItem(world, player, item.uid)).toBe(false); // below Lv 3
    expect(world.get<Inventory>(player, C.Inventory)!.items.length).toBe(1);
  });

  it('yields whetstones + gold and removes the item', () => {
    const world = new World();
    const player = createPlayer(world, FIELD, 0, 0);
    levelTo(world, player, SALVAGE_LEVEL);
    const item = generateItem(new Rng(2), { ilvl: 10, slot: 'legs', rarity: 'uncommon' });
    addItem(world, player, item);

    const inv = world.get<Inventory>(player, C.Inventory)!;
    const y = salvageYield(item);
    expect(y.whetstones).toBeGreaterThan(0);

    expect(salvageItem(world, player, item.uid)).toBe(true);
    expect(inv.items.length).toBe(0);
    expect(inv.materials).toBe(y.whetstones);
    expect(inv.gold).toBe(y.gold);
  });

  it('refuses to salvage locked items', () => {
    const world = new World();
    const player = createPlayer(world, FIELD, 0, 0);
    levelTo(world, player, SALVAGE_LEVEL);
    const item = generateItem(new Rng(3), { ilvl: 5, slot: 'head', rarity: 'common' });
    item.locked = true;
    addItem(world, player, item);
    expect(salvageItem(world, player, item.uid)).toBe(false);
    expect(world.get<Inventory>(player, C.Inventory)!.items.length).toBe(1);
  });

  it('salvage-all-below keeps uncommons and locked items', () => {
    const world = new World();
    const player = createPlayer(world, FIELD, 0, 0);
    levelTo(world, player, SALVAGE_LEVEL);
    const inv = world.get<Inventory>(player, C.Inventory)!;

    const common1 = generateItem(new Rng(4), { ilvl: 5, slot: 'feet', rarity: 'common' });
    const common2 = generateItem(new Rng(5), { ilvl: 5, slot: 'hands', rarity: 'common' });
    const lockedCommon = generateItem(new Rng(6), { ilvl: 5, slot: 'head', rarity: 'common' });
    lockedCommon.locked = true;
    const uncommon = generateItem(new Rng(7), { ilvl: 5, slot: 'weapon', rarity: 'uncommon' });
    for (const it of [common1, common2, lockedCommon, uncommon]) addItem(world, player, it);

    const count = salvageAllBelow(world, player, 'common');
    expect(count).toBe(2); // the two unlocked commons
    const remaining = inv.items.map((i) => i.uid);
    expect(remaining).toContain(lockedCommon.uid);
    expect(remaining).toContain(uncommon.uid);
    expect(remaining.length).toBe(2);
  });
});
