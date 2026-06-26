// Pure collision helpers (no Three.js) so they are unit-testable.

import type { CylinderCollider } from '../world/heightfield';

/**
 * Push a horizontal circle (px, pz, radius) out of any overlapping cylinder
 * colliders. Returns the corrected position. Resolves each collider once, which
 * is sufficient for the sparse static props in the greybox.
 */
export function resolveCircleVsCylinders(
  px: number,
  pz: number,
  radius: number,
  cols: readonly CylinderCollider[],
): { x: number; z: number } {
  let x = px;
  let z = pz;
  for (const c of cols) {
    const dx = x - c.x;
    const dz = z - c.z;
    const distSq = dx * dx + dz * dz;
    const minDist = radius + c.radius;
    if (distSq > minDist * minDist) continue;
    if (distSq > 1e-9) {
      const dist = Math.sqrt(distSq);
      const push = (minDist - dist) / dist;
      x += dx * push;
      z += dz * push;
    } else {
      // Degenerate: exactly at the centre — push along +x deterministically.
      x = c.x + minDist;
      z = c.z;
    }
  }
  return { x, z };
}
