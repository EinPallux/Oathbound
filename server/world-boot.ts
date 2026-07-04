// Boots the authoritative sim world on the server. Reads the authored map file from disk,
// builds the render-free world data with the game's own map pipeline (the same
// normalizeMap/custom-map code the browser uses — so the server and client agree on the
// world byte-for-byte), and assembles the sim via the shared createSimWorld. The player is
// driven by a null input in M0 (no gameplay is sent over the wire yet); network-driven input
// arrives in M1/M2.

import { readFileSync } from 'node:fs';
import { normalizeMap } from '../src/world/map-format';
import { buildCustomWorldData } from '../src/world/custom-map';
import { createSimWorld, type SimWorld } from '../src/sim/boot/sim-world';
import { createNullControlState } from '../src/platform/null-input';
import type { ServerConfig } from './config';

export interface ServerWorld {
  /** The assembled simulation (ECS world, player entity, rng, grid, projectiles, telemetry). */
  sim: SimWorld;
  /** The map name that was loaded (for the welcome message / logging). */
  mapName: string;
}

export function bootServerWorld(config: ServerConfig): ServerWorld {
  const raw = readFileSync(config.mapPath, 'utf8');
  const map = normalizeMap(JSON.parse(raw));
  const data = buildCustomWorldData(map);
  const sim = createSimWorld({
    ...data,
    input: createNullControlState(),
    seed: config.seed,
  });
  return { sim, mapName: config.mapName };
}
