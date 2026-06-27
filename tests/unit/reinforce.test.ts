import { describe, it, expect } from 'vitest';
import { World, type Entity } from '../../src/core/ecs/world';
import { C, type Inventory, type Defense, type LootLuck } from '../../src/core/ecs/components';
import { createPlayer } from '../../src/sim/factory';
import { addItem, equipItem } from '../../src/sim/inventory';
import { generateItem } from '../../src/sim/loot/items';
import { reinforceItem, reinforceCost, canReinforce, MAX_REINFORCE } from '../../src/sim/reinforce';
import { serialize, applySave } from '../../src/sim/save';
import { Rng } from '../../src/core/rng';
import { flatField } from './helpers';

const FIELD = flatField();

function fund(world: World, player: Entity, gold: number, materials: number): void {
  const inv = world.get<Inventory>(player, C.Inventory)!;
  inv.gold = gold;
  inv.materials = materials;
}

describe('Reinforcement', () => {
  it('cost rises with each step', () => {
    const item = generateItem(new Rng(1), { ilvl: 10, slot: 'chest', rarity: 'rare' });
    const c1 = reinforceCost(item);
    item.reinforced = 2;
    const c3 = reinforceCost(item);
    expect(c3.gold).toBeGreaterThan(c1.gold);
    expect(c3.whetstones).toBeGreaterThan(c1.whetstones);
  });

  it('spends currency and boosts a bagged item base stats + score', () => {
    const world = new World();
    const player = createPlayer(world, FIELD, 0, 0);
    fund(world, player, 1000, 50);
    const item = generateItem(new Rng(2), { ilvl: 10, slot: 'chest', rarity: 'rare' });
    addItem(world, player, item);
    const beforeScore = item.score;
    const beforeArmor = item.armor;
    const cost = reinforceCost(item);

    expect(reinforceItem(world, player, item.uid)).toBe(true);
    const inv = world.get<Inventory>(player, C.Inventory)!;
    expect(inv.gold).toBe(1000 - cost.gold);
    expect(inv.materials).toBe(50 - cost.whetstones);
    expect(item.reinforced).toBe(1);
    expect(item.armor).toBeGreaterThan(beforeArmor);
    expect(item.score).toBeGreaterThan(beforeScore);
  });

  it('caps at MAX_REINFORCE', () => {
    const world = new World();
    const player = createPlayer(world, FIELD, 0, 0);
    fund(world, player, 1_000_000, 1_000_000);
    const item = generateItem(new Rng(3), { ilvl: 8, slot: 'weapon', rarity: 'uncommon' });
    addItem(world, player, item);
    for (let i = 0; i < MAX_REINFORCE; i++) {
      expect(reinforceItem(world, player, item.uid)).toBe(true);
    }
    expect(item.reinforced).toBe(MAX_REINFORCE);
    expect(canReinforce(item)).toBe(false);
    expect(reinforceItem(world, player, item.uid)).toBe(false); // already maxed
  });

  it('fails when the player cannot afford it', () => {
    const world = new World();
    const player = createPlayer(world, FIELD, 0, 0);
    fund(world, player, 0, 0);
    const item = generateItem(new Rng(4), { ilvl: 10, slot: 'legs', rarity: 'common' });
    addItem(world, player, item);
    expect(reinforceItem(world, player, item.uid)).toBe(false);
    expect(item.reinforced ?? 0).toBe(0);
  });

  it('reinforcing equipped armor raises derived armor', () => {
    const world = new World();
    const player = createPlayer(world, FIELD, 0, 0);
    fund(world, player, 1000, 50);
    const chest = generateItem(new Rng(5), { ilvl: 12, slot: 'chest', rarity: 'rare' });
    addItem(world, player, chest);
    equipItem(world, player, chest);
    const beforeArmor = world.get<Defense>(player, C.Defense)!.armor;
    expect(reinforceItem(world, player, chest.uid)).toBe(true);
    expect(world.get<Defense>(player, C.Defense)!.armor).toBeGreaterThan(beforeArmor);
  });

  it('reinforced items and pity persist across a save round-trip', () => {
    const world = new World();
    const player = createPlayer(world, FIELD, 0, 0);
    fund(world, player, 1000, 50);
    const item = generateItem(new Rng(6), { ilvl: 10, slot: 'hands', rarity: 'rare' });
    addItem(world, player, item);
    reinforceItem(world, player, item.uid);
    reinforceItem(world, player, item.uid);
    world.get<LootLuck>(player, C.LootLuck)!.pity = 7;

    const data = serialize(world, player);
    const w2 = new World();
    const p2 = createPlayer(w2, FIELD, 0, 0);
    applySave(w2, p2, data);

    expect(w2.get<Inventory>(p2, C.Inventory)!.items[0].reinforced).toBe(2);
    expect(w2.get<LootLuck>(p2, C.LootLuck)!.pity).toBe(7);
  });
});
