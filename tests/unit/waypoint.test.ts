import { describe, it, expect } from 'vitest';
import { World } from '../../src/core/ecs/world';
import {
  C,
  type Transform,
  type Respawn,
  type Oathstone,
  type Health,
} from '../../src/core/ecs/components';
import { createPlayer, createOathstone } from '../../src/sim/factory';
import { createWaypointSystem } from '../../src/sim/systems/waypoint';
import { createRecoverySystem } from '../../src/sim/systems/recovery';
import { serialize, applySave } from '../../src/sim/save';
import { CombatEvent } from '../../src/sim/combat/events';
import { flatField } from './helpers';

const FIELD = flatField();

describe('Oathstones (waypoint system)', () => {
  it('activates on proximity and binds the respawn to the stone', () => {
    const world = new World();
    const player = createPlayer(world, FIELD, 0, 0);
    const stone = createOathstone(world, FIELD, 'millford', 'Millford Waystation', 10, 0);
    const sys = createWaypointSystem();

    let activatedName = '';
    world.events.on(CombatEvent.OathstoneActivated, (e: { name: string }) => {
      activatedName = e.name;
    });

    // Out of range → stays dormant.
    sys.update(world, 0);
    expect(world.get<Oathstone>(stone, C.Oathstone)!.activated).toBe(false);

    // Walk onto it → activates + binds respawn.
    const pt = world.get<Transform>(player, C.Transform)!;
    pt.x = 10;
    pt.z = 0;
    sys.update(world, 0);
    expect(world.get<Oathstone>(stone, C.Oathstone)!.activated).toBe(true);
    expect(activatedName).toBe('Millford Waystation');
    const respawn = world.get<Respawn>(player, C.Respawn)!;
    expect(respawn.x).toBe(10);
    expect(respawn.z).toBe(0);
  });

  it('respawns the player at the bound Oathstone, not the world spawn', () => {
    const world = new World();
    const player = createPlayer(world, FIELD, 0, 0);
    createOathstone(world, FIELD, 'ranger-lodge', 'Ranger Lodge', 20, 5);
    const waypoint = createWaypointSystem();
    const recovery = createRecoverySystem({ field: FIELD, spawnX: 0, spawnZ: 0 });

    // Visit the stone to bind respawn.
    const pt = world.get<Transform>(player, C.Transform)!;
    pt.x = 20;
    pt.z = 5;
    waypoint.update(world, 0);

    // Die and run out the respawn timer.
    const h = world.get<Health>(player, C.Health)!;
    h.current = 0;
    for (let i = 0; i < 100; i++) recovery.update(world, 0.1);

    expect(h.current).toBe(h.max);
    expect(pt.x).toBe(20);
    expect(pt.z).toBe(5);
  });

  it('persists activated Oathstones + the bound respawn across a save', () => {
    const w1 = new World();
    const p1 = createPlayer(w1, FIELD, 0, 0);
    createOathstone(w1, FIELD, 'spawn', 'Oathhold', 0, 0);
    const far = createOathstone(w1, FIELD, 'frostgate', 'Frostgate Keep', 40, 40);
    const sys = createWaypointSystem();

    // Activate the spawn stone (player starts on it), leave Frostgate dormant.
    sys.update(w1, 0);
    expect(w1.get<Oathstone>(far, C.Oathstone)!.activated).toBe(false);

    const data = serialize(w1, p1);
    expect(data.oathstones).toContain('spawn');
    expect(data.oathstones).not.toContain('frostgate');

    // Fresh world with dormant stones → applySave re-marks the discovered one.
    const w2 = new World();
    const p2 = createPlayer(w2, FIELD, 0, 0);
    const spawn2 = createOathstone(w2, FIELD, 'spawn', 'Oathhold', 0, 0);
    const frost2 = createOathstone(w2, FIELD, 'frostgate', 'Frostgate Keep', 40, 40);
    applySave(w2, p2, data);

    expect(w2.get<Oathstone>(spawn2, C.Oathstone)!.activated).toBe(true);
    expect(w2.get<Oathstone>(frost2, C.Oathstone)!.activated).toBe(false);
    const respawn = w2.get<Respawn>(p2, C.Respawn)!;
    expect(respawn.x).toBe(data.respawn.x);
    expect(respawn.z).toBe(data.respawn.z);
  });
});
