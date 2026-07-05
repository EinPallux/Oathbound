// Builds a wire snapshot from the authoritative ECS world — the "what the world looks like now"
// message the server broadcasts to clients. Isomorphic (no three/DOM/Node): reads only the ECS.
// M1 replicates every positioned gameplay entity (players, enemies, bosses, vendors, oathstones,
// loot) with position/facing + HP + an enemy state tag. Interest management (only sending what's
// near each client) is a later lever; at friends-scale one client gets the whole world cheaply.

import type { World } from '../core/ecs/world';
import { C, type Transform, type Health, type Enemy } from '../core/ecs/components';
import type { SnapshotEntity, SnapshotMessage } from './protocol';

/** Quantize to 2 decimals — plenty for rendering, and it keeps frames small. */
function q(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Classify a positioned entity into a replicated kind, or null to skip it. */
function kindOf(world: World, e: number): string | null {
  if (world.get(e, C.PlayerControlled) !== undefined) return 'player';
  if (world.get(e, C.Boss) !== undefined) return 'boss';
  if (world.get(e, C.Enemy) !== undefined) return 'enemy';
  if (world.get(e, C.Vendor) !== undefined) return 'vendor';
  if (world.get(e, C.Oathstone) !== undefined) return 'oathstone';
  if (world.get(e, C.LootDrop) !== undefined) return 'loot';
  return null;
}

export function buildSnapshot(world: World, tick: number, ack: number): SnapshotMessage {
  const ents: SnapshotEntity[] = [];
  for (const e of world.query(C.Transform)) {
    const kind = kindOf(world, e);
    if (kind === null) continue;
    const t = world.get<Transform>(e, C.Transform)!;
    const ent: SnapshotEntity = { id: e, k: kind, x: q(t.x), z: q(t.z), yaw: q(t.yaw) };
    const hp = world.get<Health>(e, C.Health);
    if (hp) {
      ent.hp = q(hp.current);
      ent.mhp = q(hp.max);
    }
    const en = world.get<Enemy>(e, C.Enemy);
    if (en) ent.st = en.state;
    ents.push(ent);
  }
  return { t: 'snapshot', tick, ack, ents };
}
