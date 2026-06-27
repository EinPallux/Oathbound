import { describe, it, expect } from 'vitest';
import { World } from '../../src/core/ecs/world';
import { C, type Health, type Enemy, type EnemyInfo } from '../../src/core/ecs/components';
import { spawnEnemy } from '../../src/sim/content/enemies';
import { flatField } from './helpers';

const FIELD = flatField();

describe('data-driven enemies', () => {
  it('spawns Greenmarch + Thornwood templates with the right archetype/family', () => {
    const world = new World();
    const checks: [Parameters<typeof spawnEnemy>[2], string, Enemy['archetype']][] = [
      ['bloomhusk', 'Bloomhusks', 'melee_bruiser'],
      ['reaver', 'Reavers', 'ranged_skirmisher'],
      ['wisp', 'Wisps', 'caster'],
      ['weaver', 'Weavers', 'melee_bruiser'],
      ['bramblekin', 'Bramblekin', 'melee_bruiser'],
      ['sporeling', 'Sporelings', 'melee_bruiser'],
    ];
    for (const [id, family, archetype] of checks) {
      const e = spawnEnemy(world, FIELD, id, 0, 5, { level: 6 });
      const en = world.get<Enemy>(e, C.Enemy)!;
      expect(en.family).toBe(family);
      expect(en.archetype).toBe(archetype);
      expect(en.tier).toBe('standard');
    }
  });

  it('the Wisp casts armour-piercing blight', () => {
    const world = new World();
    const e = spawnEnemy(world, FIELD, 'wisp', 0, 5);
    expect(world.get<Enemy>(e, C.Enemy)!.attackType).toBe('blight');
  });

  it('elite/rare tiers scale HP, XP, and damage above standard', () => {
    const world = new World();
    const std = spawnEnemy(world, FIELD, 'bloomhusk', 0, 5, { level: 5 });
    const elite = spawnEnemy(world, FIELD, 'bloomhusk', 2, 5, { level: 5, tier: 'elite' });
    const rare = spawnEnemy(world, FIELD, 'bloomhusk', 4, 5, {
      level: 5,
      tier: 'rare',
      name: 'Old Thornback',
    });

    const stdHp = world.get<Health>(std, C.Health)!.max;
    const eliteHp = world.get<Health>(elite, C.Health)!.max;
    const rareHp = world.get<Health>(rare, C.Health)!.max;
    expect(eliteHp).toBeGreaterThan(stdHp * 3);
    expect(rareHp).toBeGreaterThan(eliteHp);

    const stdEn = world.get<Enemy>(std, C.Enemy)!;
    const eliteEn = world.get<Enemy>(elite, C.Enemy)!;
    expect(eliteEn.xpBase).toBeGreaterThan(stdEn.xpBase * 3);
    expect(eliteEn.attackBase).toBeGreaterThan(stdEn.attackBase);

    expect(world.get<EnemyInfo>(elite, C.EnemyInfo)!.name).toContain('Elite');
    expect(world.get<EnemyInfo>(rare, C.EnemyInfo)!.name).toBe('Old Thornback');
    expect(world.get<Enemy>(rare, C.Enemy)!.tier).toBe('rare');
  });
});
