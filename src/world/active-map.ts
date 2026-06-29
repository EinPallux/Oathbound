// Holds the custom map selected for this session (set once at startup from ?map=, before
// the world boots). Pure module-level state so both the pure builders and the renderer
// can read it without threading it through every call. Null = the default procedural world.

import type { OathboundMap } from './map-format';

let active: OathboundMap | null = null;

export function setActiveMap(map: OathboundMap | null): void {
  active = map;
}

export function getActiveMap(): OathboundMap | null {
  return active;
}
