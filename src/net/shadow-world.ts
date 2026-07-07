// Client-side "shadow" ECS world for the online client. The server is authoritative; this is a
// read-model the offline render/HUD layer can be pointed at. The local player is a real
// `createPlayer` entity whose dynamic state is synced from the snapshot's `self` block; every
// other replicated entity is a lightweight stand-in carrying just the components the UI reads
// (Transform/Health/Enemy/EnemyInfo/Vendor/Oathstone/LootDrop). No systems ever run on this
// world — it's data only — so it stays free of three/DOM/Node (unit-testable, isomorphic).

import { World, type Entity } from '../core/ecs/world';
import {
  C,
  type ClassId,
  type PlayerClass,
  type Health,
  type Resource,
  type Progression,
  type AbilityState,
  type Statuses,
  type CombatState,
  type Shield,
  type Inventory,
  type Equipment,
  type Character,
  type CastState,
  type Target,
  type Transform,
  type Enemy,
  type EnemyInfo,
  type Vendor,
  type Oathstone,
  type LootDrop,
  type Item,
  type EquipSlot,
} from '../core/ecs/components';
import { createPlayer } from '../sim/factory';
import type { Heightfield } from '../world/heightfield';
import type { SnapshotEntity, SelfState } from './protocol';

export class ShadowWorld {
  readonly world = new World();
  readonly localPlayer: Entity;
  /** server entity id → local replica entity. */
  private readonly replicas = new Map<number, Entity>();
  /** server entity id → display name (players + enemies + landmarks), for nameplates. */
  private readonly names = new Map<number, string>();

  constructor(
    field: Heightfield,
    private readonly selfServerId: number,
    classId: ClassId,
    spawn: { x: number; z: number },
  ) {
    this.localPlayer = createPlayer(this.world, field, spawn.x, spawn.z, classId);
  }

  /** The display name a server entity id maps to (or undefined). */
  nameFor(serverId: number): string | undefined {
    return this.names.get(serverId);
  }

  /** The local replica entity for a server id (e.g. to highlight the current target). */
  replicaFor(serverId: number): Entity | undefined {
    return this.replicas.get(serverId);
  }

  /** Drive the local player's position from prediction/interpolation (not from a replica). */
  setLocalTransform(x: number, y: number, z: number, yaw: number): void {
    const t = this.world.get<Transform>(this.localPlayer, C.Transform);
    if (!t) return;
    t.prevX = t.x;
    t.prevY = t.y;
    t.prevZ = t.z;
    t.prevYaw = t.yaw;
    t.x = x;
    t.y = y;
    t.z = z;
    t.yaw = yaw;
  }

  /** Sync the authoritative HUD state onto the local player entity. */
  applySelf(s: SelfState): void {
    const w = this.world;
    const p = this.localPlayer;
    const pc = w.get<PlayerClass>(p, C.PlayerClass);
    if (pc) {
      pc.id = s.cls;
      pc.choices = s.ch ?? {};
    }
    const h = w.get<Health>(p, C.Health);
    if (h) {
      h.current = s.hp;
      h.max = s.mhp;
    }
    const res = w.get<Resource>(p, C.Resource);
    if (res) {
      res.current = s.res;
      res.max = s.mres;
    }
    const prog = w.get<Progression>(p, C.Progression);
    if (prog) {
      prog.level = s.lvl;
      prog.xp = s.xp;
      prog.xpToNext = s.xpNext ?? Infinity;
    }
    const ab = w.get<AbilityState>(p, C.AbilityState);
    if (ab) {
      ab.gcdRemaining = s.gcd;
      ab.cooldowns = s.cds.slice();
    }
    const st = w.get<Statuses>(p, C.Statuses);
    if (st) st.list = s.st.map((x) => ({ id: x.id, remaining: x.r, magnitude: 0 }));
    const cs = w.get<CombatState>(p, C.CombatState);
    if (cs) cs.inCombat = s.inC;
    const inv = w.get<Inventory>(p, C.Inventory);
    if (inv) inv.gold = s.gold;
    const ch = w.get<Character>(p, C.Character);
    if (ch) ch.mountCast = s.mount;

    // Shield: present only while active.
    if (s.shield > 0) w.set<Shield>(p, C.Shield, { amount: s.shield, remaining: 999 });
    else w.remove(p, C.Shield);
    // Cast: present only while casting.
    if (s.cast) w.set<CastState>(p, C.CastState, { index: s.cast.idx, remaining: s.cast.remaining, target: null });
    else w.remove(p, C.CastState);
    // Target: map the server target id to a local replica (null if not present locally yet).
    const tgt = w.get<Target>(p, C.Target);
    if (tgt) tgt.entity = s.tgt ? (this.replicas.get(s.tgt.id) ?? null) : null;
  }

  /** Populate the local player's bag + equipped gear from the server (for the inventory panel). */
  applyInventory(items: Item[], equipment: Partial<Record<EquipSlot, Item>>, gold: number, materials: number, capacity: number): void {
    const inv = this.world.get<Inventory>(this.localPlayer, C.Inventory);
    if (inv) {
      inv.items = items;
      inv.gold = gold;
      inv.materials = materials;
      inv.capacity = capacity;
    }
    const eq = this.world.get<Equipment>(this.localPlayer, C.Equipment);
    if (eq) eq.slots = equipment;
  }

  /** Reconcile replicas against the latest snapshot (create/update/remove). */
  applySnapshot(ents: SnapshotEntity[]): void {
    const seen = new Set<number>();
    for (const e of ents) {
      if (e.id === this.selfServerId) continue; // the local player is `localPlayer`, not a replica
      seen.add(e.id);
      let le = this.replicas.get(e.id);
      if (le === undefined) {
        le = this.spawnReplica(e);
        this.replicas.set(e.id, le);
      }
      this.updateReplica(le, e);
      if (e.name) this.names.set(e.id, e.name);
    }
    for (const [id, le] of this.replicas) {
      if (seen.has(id)) continue;
      this.world.destroyEntity(le);
      this.replicas.delete(id);
      this.names.delete(id);
    }
  }

  private spawnReplica(e: SnapshotEntity): Entity {
    const le = this.world.createEntity();
    this.world.set<Transform>(le, C.Transform, {
      x: e.x, y: 0, z: e.z, yaw: e.yaw, prevX: e.x, prevY: 0, prevZ: e.z, prevYaw: e.yaw,
    });
    if (e.hp != null && e.mhp != null) this.world.set<Health>(le, C.Health, { current: e.hp, max: e.mhp });
    switch (e.k) {
      case 'enemy':
      case 'boss':
        // Minimal Enemy stand-in — only its existence + Health are read (minimap). Cast is safe:
        // no system runs on this world, and no UI reads the other Enemy fields.
        this.world.set<Enemy>(le, C.Enemy, { state: e.st ?? 'idle' } as Enemy);
        this.world.set<EnemyInfo>(le, C.EnemyInfo, { name: e.name ?? 'Enemy', level: 0 });
        break;
      case 'player':
        this.world.set(le, C.PlayerControlled, true);
        break;
      case 'vendor':
        this.world.set<Vendor>(le, C.Vendor, { name: e.name ?? 'Vendor' });
        break;
      case 'oathstone':
        // `activated` is per-player and not replicated yet → shown dim; fast-travel UI is a follow-up.
        this.world.set<Oathstone>(le, C.Oathstone, { id: String(e.id), name: e.name ?? 'Oathstone', activated: false });
        break;
      case 'loot':
        this.world.set<LootDrop>(le, C.LootDrop, { item: e.name ? ({ name: e.name } as LootDrop['item']) : null, gold: 0, owner: 0, ttl: 0 });
        break;
    }
    return le;
  }

  private updateReplica(le: Entity, e: SnapshotEntity): void {
    const t = this.world.get<Transform>(le, C.Transform);
    if (t) {
      t.prevX = t.x;
      t.prevZ = t.z;
      t.prevYaw = t.yaw;
      t.x = e.x;
      t.z = e.z;
      t.yaw = e.yaw;
    }
    const h = this.world.get<Health>(le, C.Health);
    if (h && e.hp != null && e.mhp != null) {
      h.current = e.hp;
      h.max = e.mhp;
    }
    const en = this.world.get<Enemy>(le, C.Enemy);
    if (en && e.st) (en as Enemy).state = e.st as Enemy['state'];
  }
}
