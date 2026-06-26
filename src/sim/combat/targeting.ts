// Soft tab-target acquisition — pure geometry, no Three.js. The forward direction
// follows the camera yaw (sin, cos), matching the movement convention. Used for Tab
// cycling and for single-target abilities' soft auto-acquire.
// See docs/design/COMBAT_DESIGN.md#1-targeting-model--decision.

import { clamp } from '../../core/math';
import type { CylinderCollider } from '../../world/heightfield';

export interface Candidate {
  entity: number;
  x: number;
  z: number;
}

export interface Acquired {
  entity: number;
  dist: number;
}

/**
 * Hostiles within `range` and inside the forward cone (half-angle `coneHalfRad`),
 * sorted nearest-first. A candidate at the origin is always considered in-cone.
 */
export function hostilesInCone(
  ox: number,
  oz: number,
  yaw: number,
  range: number,
  coneHalfRad: number,
  candidates: readonly Candidate[],
): Acquired[] {
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const cosHalf = Math.cos(coneHalfRad);
  const out: Acquired[] = [];
  for (const c of candidates) {
    const dx = c.x - ox;
    const dz = c.z - oz;
    const dist = Math.hypot(dx, dz);
    if (dist > range) continue;
    if (dist > 1e-6) {
      const dot = (dx * fx + dz * fz) / dist;
      if (dot < cosHalf) continue;
    }
    out.push({ entity: c.entity, dist });
  }
  out.sort((a, b) => a.dist - b.dist);
  return out;
}

/** The nearest hostile in the forward cone within range, or null. */
export function nearestInCone(
  ox: number,
  oz: number,
  yaw: number,
  range: number,
  coneHalfRad: number,
  candidates: readonly Candidate[],
): number | null {
  const list = hostilesInCone(ox, oz, yaw, range, coneHalfRad, candidates);
  return list.length > 0 ? list[0].entity : null;
}

/**
 * Advance a Tab cycle through an ordered hostile list. Null/unknown current →
 * first; otherwise the next entry, wrapping around.
 */
export function cycleTarget(current: number | null, ordered: readonly number[]): number | null {
  if (ordered.length === 0) return null;
  if (current == null) return ordered[0];
  const i = ordered.indexOf(current);
  if (i === -1) return ordered[0];
  return ordered[(i + 1) % ordered.length];
}

/**
 * Line-of-sight: is the horizontal segment A→B blocked by any cylinder collider?
 * A single cheap segment-vs-cylinder test (the `v1` LoS check); `pad` shrinks the
 * effective radius so grazing edges don't block.
 */
export function segmentBlockedByCylinders(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  cols: readonly CylinderCollider[],
  pad = 0,
): boolean {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  for (const c of cols) {
    const t = len2 > 1e-9 ? clamp(((c.x - ax) * dx + (c.z - az) * dz) / len2, 0, 1) : 0;
    const px = ax + dx * t;
    const pz = az + dz * t;
    const d = Math.hypot(c.x - px, c.z - pz);
    if (d < c.radius - pad) return true;
  }
  return false;
}
