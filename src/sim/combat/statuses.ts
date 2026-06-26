// Timed buff/debuff helpers. Pure data operations on the Statuses component.

import type { Statuses } from '../../core/ecs/components';

export const Status = {
  /** On an enemy: reduces effective armor by `magnitude`. */
  ArmorBreak: 'armorBreak',
  /** On the player: incoming damage reduced by `magnitude` (fraction). */
  Bulwark: 'bulwark',
  /** On the player: outgoing damage reduced by `magnitude` (fraction) after death. */
  Shaken: 'shaken',
} as const;

/** Add or refresh a status (keeps the longer remaining time). */
export function addStatus(s: Statuses, id: string, durationSec: number, magnitude: number): void {
  const existing = s.list.find((x) => x.id === id);
  if (existing) {
    existing.remaining = Math.max(existing.remaining, durationSec);
    existing.magnitude = magnitude;
  } else {
    s.list.push({ id, remaining: durationSec, magnitude });
  }
}

export function hasStatus(s: Statuses | undefined, id: string): boolean {
  return !!s && s.list.some((e) => e.id === id);
}

/** Magnitude of an active status, or 0 if absent. */
export function statusMagnitude(s: Statuses | undefined, id: string): number {
  if (!s) return 0;
  const x = s.list.find((e) => e.id === id);
  return x ? x.magnitude : 0;
}

/** Advance all statuses by dt, removing any that expire. */
export function tickStatuses(s: Statuses, dt: number): void {
  for (let i = s.list.length - 1; i >= 0; i--) {
    s.list[i].remaining -= dt;
    if (s.list[i].remaining <= 0) s.list.splice(i, 1);
  }
}
