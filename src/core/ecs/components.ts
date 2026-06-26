// Component registry. Components are plain data keyed by a string name.
// Phase 0.0.3 introduces the first real gameplay components for movement.

export const C = {
  Transform: 'transform',
  Velocity: 'velocity',
  Character: 'character',
  PlayerControlled: 'playerControlled',
} as const;

/**
 * Position + yaw, with the previous sim values retained so the renderer can
 * interpolate between fixed simulation steps.
 */
export interface Transform {
  x: number;
  y: number;
  z: number;
  /** Facing angle in radians (rotation about +Y). */
  yaw: number;
  prevX: number;
  prevY: number;
  prevZ: number;
  prevYaw: number;
}

export interface Velocity {
  x: number;
  y: number;
  z: number;
}

/** Kinematic capsule controller parameters and runtime state. */
export interface Character {
  /** Horizontal collision radius (m). */
  radius: number;
  /** Half the capsule height (m); the Transform.y is the capsule centre. */
  halfHeight: number;
  runSpeed: number;
  sprintSpeed: number;
  jumpSpeed: number;
  grounded: boolean;
}

/** Marker component: this entity is driven by player input. */
export type PlayerControlled = true;
