import { describe, it, expect } from 'vitest';
import { World } from '../../src/core/ecs/world';
import {
  C,
  type Item,
  type Defense,
  type Offense,
  type Enemy,
} from '../../src/core/ecs/components';
import { deriveStats } from '../../src/sim/stats';
import { createPlayer } from '../../src/sim/factory';
import { addItem, equipItem } from '../../src/sim/inventory';
import { spawnEnemy } from '../../src/sim/content/enemies';
import { applyDamage } from '../../src/sim/combat/apply';
import { generateItem } from '../../src/sim/loot/items';
import { Rng } from '../../src/core/rng';
import { flatField } from './helpers';

const FIELD = flatField();

describe('endgame zones (Riven Peaks + Gravereach)', () => {
  it('Riven Peaks families deal frost; Revenants are holy-weak', () => {
    const world = new World();
    const rimebound = spawnEnemy(world, FIELD, 'rimebound', 5, 0, { level: 22 });
    const frostfang = spawnEnemy(world, FIELD, 'frostfang', 6, 0, { level: 22 });
    expect(world.get<Enemy>(rimebound, C.Enemy)!.attackType).toBe('frost');
    expect(world.get<Enemy>(frostfang, C.Enemy)!.attackType).toBe('frost');

    const revenant = spawnEnemy(world, FIELD, 'revenant', 7, 0, { level: 22 });
    expect(world.get<Enemy>(revenant, C.Enemy)!.attackType).toBe('frost');
    expect(world.get<Defense>(revenant, C.Defense)!.weakness.holy ?? 1).toBeGreaterThan(1);
  });

  it('Gravereach undead are all holy-weak', () => {
    const world = new World();
    for (const id of ['wraith', 'bonewrought', 'forsworn'] as const) {
      const e = spawnEnemy(world, FIELD, id, 5, 0, { level: 28 });
      expect(world.get<Defense>(e, C.Defense)!.weakness.holy ?? 1).toBeGreaterThan(1);
    }
  });

  it('holy damage is amplified against a holy-weak undead (the Priest lever)', () => {
    const world = new World();
    const player = createPlayer(world, FIELD, 0, 0);
    world.get<Offense>(player, C.Offense)!.critChance = 0;

    const weak = spawnEnemy(world, FIELD, 'wraith', 0, 3, { level: 28 });
    const plain = spawnEnemy(world, FIELD, 'wraith', 0, 4, { level: 28 });
    world.get<Defense>(plain, C.Defense)!.weakness = {}; // strip the holy weakness

    const hitWeak = applyDamage(
      world, player, weak, { base: 50, coeff: 0, damageType: 'holy' }, new Rng(1),
    ).amount;
    const hitPlain = applyDamage(
      world, player, plain, { base: 50, coeff: 0, damageType: 'holy' }, new Rng(1),
    ).amount;
    expect(hitWeak).toBeGreaterThan(hitPlain);
  });

  it('frost resist derives from gear, equips, and mitigates frost damage', () => {
    const item: Item = {
      uid: 'rf',
      name: 'Rimeguard Plate',
      slot: 'chest',
      rarity: 'rare',
      ilvl: 23,
      primary: { stat: 'VIT', value: 5 },
      armor: 0,
      affixes: [{ id: 'resistFrost', value: 55 }],
      score: 0,
      locked: false,
    };
    expect(deriveStats(23, { slots: { chest: item } }, 'STR').resist.frost).toBe(55);

    const world = new World();
    const player = createPlayer(world, FIELD, 0, 0);
    addItem(world, player, item);
    equipItem(world, player, item);
    expect(world.get<Defense>(player, C.Defense)!.resist.frost).toBe(55);

    const frostHit = (resistFrost: number): number => {
      const w = new World();
      const p = createPlayer(w, FIELD, 0, 0);
      const src = spawnEnemy(w, FIELD, 'frostfang', 0, 3, { level: 23 });
      w.get<Offense>(src, C.Offense)!.critChance = 0;
      w.get<Defense>(p, C.Defense)!.resist.frost = resistFrost;
      return applyDamage(w, src, p, { base: 12, coeff: 1, damageType: 'frost' }, new Rng(7)).amount;
    };
    expect(frostHit(200)).toBeLessThan(frostHit(0));
    expect(frostHit(200)).toBeGreaterThan(0); // resist never fully negates
  });

  it('high-ilvl armor can roll the new frost-resist affix', () => {
    const rng = new Rng(3);
    let sawFrost = false;
    for (let i = 0; i < 400 && !sawFrost; i++) {
      const it = generateItem(rng, { ilvl: 25, slot: 'chest', rarity: 'rare' });
      if (it.affixes.some((a) => a.id === 'resistFrost')) sawFrost = true;
    }
    expect(sawFrost).toBe(true);
  });
});
