// Advances pooled projectiles each tick (movement + hit resolution live in the pool).

import type { System, World } from '../../core/ecs/world';
import type { Rng } from '../../core/rng';
import type { Projectiles } from '../projectiles';

export function createProjectileSystem(projectiles: Projectiles, rng: Rng): System {
  return {
    name: 'projectile',
    update(world: World, dt: number): void {
      projectiles.update(world, dt, rng);
    },
  };
}
