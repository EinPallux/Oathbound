// Pure collision helpers (no Three.js) so they are unit-testable.

import type { CylinderCollider, BoxCollider } from '../world/heightfield';

export type { BoxCollider };

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

/**
 * Push a horizontal circle (px, pz, radius) out of any overlapping oriented boxes
 * (building footprints). Each box is resolved once. Returns the corrected position.
 */
export function resolveCircleVsBoxes(
  px: number,
  pz: number,
  radius: number,
  boxes: readonly BoxCollider[],
): { x: number; z: number } {
  let x = px;
  let z = pz;
  for (const b of boxes) {
    const c = Math.cos(b.rot);
    const s = Math.sin(b.rot);
    // World → box-local (rotate the relative vector by -rot).
    const dx = x - b.x;
    const dz = z - b.z;
    const lx = dx * c + dz * s;
    const lz = -dx * s + dz * c;
    // Closest point on the box to the circle centre (clamped to the half-extents).
    const clx = lx < -b.hw ? -b.hw : lx > b.hw ? b.hw : lx;
    const clz = lz < -b.hd ? -b.hd : lz > b.hd ? b.hd : lz;
    const ddx = lx - clx;
    const ddz = lz - clz;
    const distSq = ddx * ddx + ddz * ddz;
    if (distSq > radius * radius) continue; // no overlap

    let nlx: number;
    let nlz: number;
    if (distSq > 1e-9) {
      // Centre outside the box: push out along the surface normal.
      const dist = Math.sqrt(distSq);
      const push = (radius - dist) / dist;
      nlx = lx + ddx * push;
      nlz = lz + ddz * push;
    } else {
      // Centre inside the box: eject along the axis of least penetration.
      const penX = b.hw - Math.abs(lx);
      const penZ = b.hd - Math.abs(lz);
      if (penX <= penZ) {
        nlx = (lx >= 0 ? b.hw : -b.hw) + (lx >= 0 ? radius : -radius);
        nlz = lz;
      } else {
        nlx = lx;
        nlz = (lz >= 0 ? b.hd : -b.hd) + (lz >= 0 ? radius : -radius);
      }
    }
    // Box-local → world (rotate back by +rot).
    x = b.x + nlx * c - nlz * s;
    z = b.z + nlx * s + nlz * c;
  }
  return { x, z };
}
