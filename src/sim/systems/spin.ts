// Demo system: advances each Spinner's angle by a fixed step.
// Saves the previous angle first so rendering can interpolate between sim ticks.

import type { System } from '../../core/ecs/world';
import { C, type Spinner } from '../../core/ecs/components';

export const SpinSystem: System = {
  name: 'spin',
  update(world, dt) {
    for (const e of world.query(C.Spinner)) {
      const s = world.get<Spinner>(e, C.Spinner)!;
      s.prevAngle = s.angle;
      s.angle += s.speed * dt;
    }
  },
};
