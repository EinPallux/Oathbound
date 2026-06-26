import { describe, it, expect } from 'vitest';
import { World } from '../../src/core/ecs/world';
import { C, type Enemy, type Health, type Transform } from '../../src/core/ecs/components';
import { createEnemyAiSystem } from '../../src/sim/systems/enemy-ai';
import { createPlayer, createBloomhusk } from '../../src/sim/factory';
import { Rng } from '../../src/core/rng';
import { DT } from '../../src/core/time';
import { flatField } from './helpers';

const FIELD = flatField();

function sys() {
  return createEnemyAiSystem({ field: FIELD, colliders: [], rng: new Rng(5) });
}

describe('melee enemy AI', () => {
  it('aggros when the player is within radius, then closes and attacks', () => {
    const world = new World();
    createPlayer(world, FIELD, 0, 0);
    const enemy = createBloomhusk(world, FIELD, 0, 3); // dist 3 < aggro 10
    const ai = sys();
    const ph = world.get<Health>(findPlayer(world), C.Health)!;

    const en = world.get<Enemy>(enemy, C.Enemy)!;
    for (let i = 0; i < Math.ceil(2 / DT); i++) ai.update(world, DT);

    expect(en.state === 'attack' || en.state === 'engage').toBe(true);
    expect(ph.current).toBeLessThan(ph.max); // landed at least one hit
  });

  it('rallies idle packmates within social range (social aggro)', () => {
    const world = new World();
    createPlayer(world, FIELD, 0, 0);
    const a = createBloomhusk(world, FIELD, 0, 5); // dist 5 < aggro 10
    const b = createBloomhusk(world, FIELD, 0, 10.5); // dist 10.5 > aggro, but 5.5 from A < social 6
    const ai = sys();

    ai.update(world, DT);

    expect(world.get<Enemy>(a, C.Enemy)!.state).not.toBe('idle');
    expect(world.get<Enemy>(b, C.Enemy)!.state).toBe('engage'); // joined via social aggro
  });

  it('leashes when dragged past its leash range, then resets + heals at home', () => {
    const world = new World();
    createPlayer(world, FIELD, 100, 100); // far away
    const enemy = createBloomhusk(world, FIELD, 5, 5);
    const en = world.get<Enemy>(enemy, C.Enemy)!;
    const tr = world.get<Transform>(enemy, C.Transform)!;
    const h = world.get<Health>(enemy, C.Health)!;
    const ai = sys();

    // Pretend it chased far from home and got hurt.
    en.state = 'engage';
    tr.x = 45;
    tr.z = 5; // distHome 40 > leash 35
    h.current = 5;

    ai.update(world, DT);
    expect(en.state).toBe('leash');

    // Arrive home.
    tr.x = 5.1;
    tr.z = 5;
    ai.update(world, DT);
    expect(en.state).toBe('idle');
    expect(h.current).toBe(h.max); // reset to full
  });
});

function findPlayer(world: World): number {
  for (const p of world.query(C.PlayerControlled)) return p;
  return 0;
}
