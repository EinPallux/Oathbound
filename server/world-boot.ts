// Boots the authoritative sim world on the server. Reads the authored map file from disk,
// builds the render-free world data with the game's own map pipeline (the same
// normalizeMap/custom-map code the browser uses — so the server and client agree on the world),
// and assembles the sim via the shared createSimWorld. M2: the world is built WITHOUT a primary
// player — the GameServer adds one player per connection (each with its own input) via addPlayer.

import { readFileSync } from 'node:fs';
import { normalizeMap } from '../src/world/map-format';
import { buildCustomWorldData } from '../src/world/custom-map';
import { createSimWorld, type SimWorld } from '../src/sim/boot/sim-world';
import type { Heightfield } from '../src/world/heightfield';
import type { ServerConfig } from './config';

export interface ServerWorld {
  /** The assembled simulation (ECS world, enemies/bosses/etc; no primary player). */
  sim: SimWorld;
  /** The map name that was loaded (for the welcome message / logging). */
  mapName: string;
  /** The gameplay heightfield — needed to add per-connection players at runtime. */
  field: Heightfield;
  /** Where connecting players spawn. */
  playerStart: { x: number; z: number };
}

export function bootServerWorld(config: ServerConfig): ServerWorld {
  const raw = readFileSync(config.mapPath, 'utf8');
  const map = normalizeMap(JSON.parse(raw));
  const data = buildCustomWorldData(map);
  const sim = createSimWorld({ ...data, seed: config.seed }); // no input → no primary player
  return { sim, mapName: config.mapName, field: data.field, playerStart: data.playerStart };
}
