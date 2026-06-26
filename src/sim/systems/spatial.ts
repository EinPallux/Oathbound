// Rebuilds the spatial grid each tick from live, targetable entities so other
// systems (targeting, social aggro) can do cheap neighbour queries. Runs first.

import type { System, World } from '../../core/ecs/world';
import { C, type Transform, type Health } from '../../core/ecs/components';
import type { SpatialGrid } from '../spatial-grid';

export function createSpatialSystem(grid: SpatialGrid): System {
  return {
    name: 'spatial',
    update(world: World): void {
      grid.clear();
      for (const e of world.query(C.Targetable, C.Transform, C.Health)) {
        if (world.get<Health>(e, C.Health)!.current <= 0) continue;
        const tr = world.get<Transform>(e, C.Transform)!;
        grid.insert(e, tr.x, tr.z);
      }
    },
  };
}
