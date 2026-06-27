import { describe, it, expect } from 'vitest';
import { World } from '../../src/core/ecs/world';
import { C, type Transform } from '../../src/core/ecs/components';
import { createMovementSystem } from '../../src/sim/systems/movement';
import { createPlayer } from '../../src/sim/factory';
import { flatField, makeInput } from './helpers';

// At yaw 0 the chase camera sits south of the player looking north (+z). Three's lookAt
// makes the camera's right axis = world −x, so screen-right is −x and screen-forward is
// +z. These tests pin WASD to the *camera*, guarding against strafe (A/D) inversion.
describe('movement (camera-relative WASD)', () => {
  function step(keys: Partial<{ forward: boolean; back: boolean; left: boolean; right: boolean }>) {
    const world = new World();
    const field = flatField();
    const player = createPlayer(world, field, 0, 0);
    const { ctrl } = makeInput(); // yaw 0
    Object.assign(ctrl, keys);
    const sys = createMovementSystem({ input: ctrl, field, colliders: [] });
    sys.update(world, 0.1);
    const t = world.get<Transform>(player, C.Transform)!;
    return { x: t.x, z: t.z };
  }

  it('W moves the player forward (toward +z, where the camera looks)', () => {
    const { x, z } = step({ forward: true });
    expect(z).toBeGreaterThan(0.2);
    expect(Math.abs(x)).toBeLessThan(0.01);
  });

  it('S moves the player back (toward −z)', () => {
    expect(step({ back: true }).z).toBeLessThan(-0.2);
  });

  it('D strafes to the screen-right (world −x), NOT inverted', () => {
    const { x, z } = step({ right: true });
    expect(x).toBeLessThan(-0.2); // screen-right is world −x at yaw 0
    expect(Math.abs(z)).toBeLessThan(0.01);
  });

  it('A strafes to the screen-left (world +x)', () => {
    expect(step({ left: true }).x).toBeGreaterThan(0.2);
  });

  it('W+D moves forward-and-right on screen (+z and −x)', () => {
    const { x, z } = step({ forward: true, right: true });
    expect(z).toBeGreaterThan(0.1);
    expect(x).toBeLessThan(-0.1);
  });
});
