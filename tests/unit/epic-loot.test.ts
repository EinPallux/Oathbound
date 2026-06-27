import { describe, it, expect } from 'vitest';
import { World } from '../../src/core/ecs/world';
import { C, type Enemy, type LootLuck, type Item } from '../../src/core/ecs/components';
import { createPlayer, createBloomhusk } from '../../src/sim/factory';
import { rewardKill } from '../../src/sim/rewards';
import { generateItem, slotBudget } from '../../src/sim/loot/items';
import { rollLoot, pityMultiplier, isRarePlus } from '../../src/sim/loot/droptable';
import { CombatEvent, type LootDroppedEvent } from '../../src/sim/combat/events';
import { Rng } from '../../src/core/rng';
import { flatField } from './helpers';

const FIELD = flatField();

describe('Epic rarity', () => {
  it('generates 3 affixes and out-budgets a Rare of the same ilvl/slot', () => {
    const epic = generateItem(new Rng(1), { ilvl: 20, slot: 'chest', rarity: 'epic' });
    expect(epic.rarity).toBe('epic');
    expect(epic.affixes).toHaveLength(3);
    expect(slotBudget('chest', 'epic', 20)).toBeGreaterThan(slotBudget('chest', 'rare', 20));
    const rare = generateItem(new Rng(1), { ilvl: 20, slot: 'chest', rarity: 'rare' });
    expect(epic.score).toBeGreaterThan(rare.score);
  });

  it('drops from rare-tier enemies but never from standards', () => {
    const rng = new Rng(7);
    let epicFromRare = 0;
    for (let i = 0; i < 400; i++) {
      if (rollLoot(rng, 18, 'rare', 1, 'STR').item?.rarity === 'epic') epicFromRare++;
    }
    expect(epicFromRare).toBeGreaterThan(0);

    let epicFromStd = 0;
    for (let i = 0; i < 1000; i++) {
      if (rollLoot(rng, 18, 'standard', 1, 'STR').item?.rarity === 'epic') epicFromStd++;
    }
    expect(epicFromStd).toBe(0);
  });
});

describe('bad-luck protection', () => {
  it('pityMultiplier rises with pity and is capped', () => {
    expect(pityMultiplier(0)).toBe(1);
    expect(pityMultiplier(5)).toBeGreaterThan(pityMultiplier(0));
    expect(pityMultiplier(10)).toBeGreaterThan(pityMultiplier(5));
    expect(pityMultiplier(1000)).toBe(pityMultiplier(25)); // capped
  });

  it('a high pity boosts rare+ frequency from elites', () => {
    const countRarePlus = (pity: number): number => {
      const rng = new Rng(11);
      let n = 0;
      for (let i = 0; i < 3000; i++) {
        const r = rollLoot(rng, 18, 'elite', 1, 'STR', pityMultiplier(pity));
        if (r.item && isRarePlus(r.item.rarity)) n++;
      }
      return n;
    };
    expect(countRarePlus(20)).toBeGreaterThan(countRarePlus(0));
  });

  it('rewardKill raises pity on unlucky kills and resets it on a rare+ drop', () => {
    const world = new World();
    const player = createPlayer(world, FIELD, 0, 0);
    const luck = world.get<LootLuck>(player, C.LootLuck)!;

    // Standard kills can never drop rare+, so pity only climbs.
    const std = createBloomhusk(world, FIELD, 5, 0, 5);
    const rng = new Rng(2024);
    for (let i = 1; i <= 4; i++) {
      rewardKill(world, player, std, rng);
      expect(luck.pity).toBe(i);
    }

    // A rare-tier enemy will eventually drop rare+, which resets pity to 0.
    const named = createBloomhusk(world, FIELD, 6, 0, 5);
    world.get<Enemy>(named, C.Enemy)!.tier = 'rare';
    const captured: { item: Item | null } = { item: null };
    const off = world.events.on<LootDroppedEvent>(CombatEvent.LootDropped, (ev) => {
      captured.item = ev.item;
    });

    let didReset = false;
    for (let i = 0; i < 60; i++) {
      const before = luck.pity;
      rewardKill(world, player, named, rng);
      if (captured.item && isRarePlus(captured.item.rarity)) {
        expect(before).toBeGreaterThan(0);
        expect(luck.pity).toBe(0);
        didReset = true;
        break;
      }
      expect(luck.pity).toBe(before + 1);
    }
    off();
    expect(didReset).toBe(true);
  });
});
