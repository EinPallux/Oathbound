// Builds a wire snapshot from the authoritative ECS world — the "what the world looks like now"
// message the server broadcasts to clients. Isomorphic (no three/DOM/Node): reads only the ECS.
// Replicates every positioned gameplay entity (players, enemies, bosses, vendors, oathstones,
// loot) with position/facing + HP + a name + an enemy state tag, PLUS a per-client `self` block
// carrying the receiving player's full HUD state (resource/xp/cooldowns/buffs/target) so the
// client can drive the whole offline HUD without re-simulating combat. Interest management (only
// sending what's near each client) is a later lever; at friends-scale one client gets the whole
// world cheaply.

import type { World, Entity } from '../core/ecs/world';
import {
  C,
  type Transform,
  type Health,
  type Enemy,
  type EnemyInfo,
  type Vendor,
  type Oathstone,
  type PlayerClass,
  type Resource,
  type Progression,
  type AbilityState,
  type Statuses,
  type CombatState,
  type Shield,
  type Inventory,
  type Target,
  type CastState,
  type Character,
} from '../core/ecs/components';
import type { SnapshotEntity, SnapshotMessage, SelfState } from './protocol';

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

/** A display name for an entity: players from the supplied name map, others from their components. */
function nameOf(world: World, e: number, kind: string, names?: Map<number, string>): string | undefined {
  if (kind === 'player') return names?.get(e);
  if (kind === 'enemy' || kind === 'boss') return world.get<EnemyInfo>(e, C.EnemyInfo)?.name;
  if (kind === 'vendor') return world.get<Vendor>(e, C.Vendor)?.name;
  if (kind === 'oathstone') return world.get<Oathstone>(e, C.Oathstone)?.name;
  return undefined;
}

export interface SnapshotOpts {
  /** The receiving client's own player entity (drives the `self` HUD block). */
  self?: Entity;
  /** Player entity → character name, for player nameplates. */
  names?: Map<number, string>;
}

export function buildSnapshot(world: World, tick: number, ack: number, opts: SnapshotOpts = {}): SnapshotMessage {
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
    if (en) {
      // Enemy visual identity so the client renders the real creature model (family+archetype),
      // scaled by tier, with the correct level on its nameplate — matching the offline game.
      ent.st = en.state;
      ent.fam = en.family;
      ent.arch = en.archetype;
      ent.tier = en.tier;
      ent.lvl = world.get<EnemyInfo>(e, C.EnemyInfo)?.level;
    }
    if (kind === 'player') {
      // Player class + level, so remote players show the right humanoid + nameplate.
      ent.cls = world.get<PlayerClass>(e, C.PlayerClass)?.id;
      ent.lvl = world.get<Progression>(e, C.Progression)?.level;
    }
    const name = nameOf(world, e, kind, opts.names);
    if (name) ent.name = name;
    ents.push(ent);
  }
  const self = opts.self != null ? buildSelfState(world, opts.self) : undefined;
  return { t: 'snapshot', tick, ack, ents, self };
}

/** The receiving player's authoritative HUD state. */
export function buildSelfState(world: World, player: Entity): SelfState | undefined {
  const pc = world.get<PlayerClass>(player, C.PlayerClass);
  const h = world.get<Health>(player, C.Health);
  const res = world.get<Resource>(player, C.Resource);
  const prog = world.get<Progression>(player, C.Progression);
  const ab = world.get<AbilityState>(player, C.AbilityState);
  if (!pc || !h || !res || !prog || !ab) return undefined; // not a fully-formed player entity

  const st = world.get<Statuses>(player, C.Statuses);
  const cs = world.get<CombatState>(player, C.CombatState);
  const shield = world.get<Shield>(player, C.Shield);
  const inv = world.get<Inventory>(player, C.Inventory);
  const cast = world.get<CastState>(player, C.CastState);
  const ch = world.get<Character>(player, C.Character);

  return {
    cls: pc.id,
    ch: pc.choices,
    hp: q(h.current),
    mhp: q(h.max),
    res: q(res.current),
    mres: q(res.max),
    lvl: prog.level,
    xp: q(prog.xp),
    xpNext: Number.isFinite(prog.xpToNext) ? q(prog.xpToNext) : null,
    gcd: q(ab.gcdRemaining),
    cds: ab.cooldowns.map(q),
    st: (st?.list ?? []).map((s) => ({ id: s.id, r: q(s.remaining) })),
    inC: cs?.inCombat ?? false,
    shield: shield && shield.amount > 0 ? q(shield.amount) : 0,
    gold: inv?.gold ?? 0,
    cast: cast ? { idx: cast.index, remaining: q(cast.remaining) } : null,
    mount: ch && ch.mountCast > 0 ? q(ch.mountCast) : 0,
    tgt: targetOf(world, player),
  };
}

/** Resolve the player's current target into frame data (name/level/hp), or null. */
function targetOf(world: World, player: Entity): SelfState['tgt'] {
  const tgt = world.get<Target>(player, C.Target)?.entity;
  if (tgt == null) return null;
  const h = world.get<Health>(tgt, C.Health);
  const info = world.get<EnemyInfo>(tgt, C.EnemyInfo);
  if (!h) return null;
  return { id: tgt, name: info?.name ?? 'Enemy', lvl: info?.level ?? 1, hp: q(h.current), mhp: q(h.max) };
}
