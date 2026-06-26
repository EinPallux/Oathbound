// Component registry. Components are plain data keyed by a string name.
// Phase 0.0.2 only needs the demonstration `Spinner` component; gameplay components
// (Health, Resource, CombatStats, AIState, …) arrive in later phases per the roadmap.

export const C = {
  Spinner: 'spinner',
} as const;

/**
 * Demo component: a cube that rotates about Y at a fixed placement.
 * Stores both the current and previous sim angle so the renderer can interpolate
 * between fixed simulation steps (proves the fixed-timestep + render-interpolation
 * architecture without any gameplay).
 */
export interface Spinner {
  px: number;
  py: number;
  pz: number;
  angle: number;
  prevAngle: number;
  /** Radians per second. */
  speed: number;
}
