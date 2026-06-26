// Fixed-timestep simulation constants.
// See docs/technical/ARCHITECTURE_PLAN.md#fixed-timestep-simulation-decoupled-rendering

/** Simulation tick rate (Hz). The sim runs at a fixed rate for stable combat math. */
export const SIM_HZ = 30;

/** Fixed simulation timestep, in seconds. */
export const DT = 1 / SIM_HZ;

/** Maximum real frame time we will integrate, in seconds (avoids the "spiral of death"). */
export const MAX_FRAME = 0.25;
