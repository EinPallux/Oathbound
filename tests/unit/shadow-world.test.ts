// The online client's shadow world: local player state synced from `self`, and replicas
// created/updated/removed from snapshot entities. Drives the reused offline HUD/minimap.

import { describe, it, expect } from 'vitest';
import { ShadowWorld } from '../../src/net/shadow-world';
import {
  C,
  type Health,
  type Resource,
  type Progression,
  type AbilityState,
  type PlayerClass,
  type Inventory,
  type Statuses,
  type CastState,
  type Shield,
  type Target,
} from '../../src/core/ecs/components';
import type { SelfState, SnapshotEntity } from '../../src/net/protocol';
import { flatField } from './helpers';

const FIELD = flatField();

function baseSelf(over: Partial<SelfState> = {}): SelfState {
  return {
    cls: 'warrior', ch: {}, hp: 80, mhp: 120, res: 30, mres: 100, lvl: 7, xp: 50, xpNext: 200,
    gcd: 0, cds: new Array(10).fill(0), st: [], inC: true, shield: 0, gold: 42, cast: null, mount: 0, tgt: null,
    ...over,
  };
}

describe('ShadowWorld', () => {
  it('syncs the local player HUD state from self', () => {
    const sw = new ShadowWorld(FIELD, 10, 'warrior', { x: 0, z: 0 });
    sw.applySelf(baseSelf());
    const w = sw.world;
    const p = sw.localPlayer;
    expect(w.get<Health>(p, C.Health)!.current).toBe(80);
    expect(w.get<Health>(p, C.Health)!.max).toBe(120);
    expect(w.get<Resource>(p, C.Resource)!.max).toBe(100);
    expect(w.get<Progression>(p, C.Progression)!.level).toBe(7);
    expect(w.get<Inventory>(p, C.Inventory)!.gold).toBe(42);
    expect(w.get<AbilityState>(p, C.AbilityState)!.cooldowns.length).toBe(10);
  });

  it('reflects class + capped XP + statuses + shield + cast', () => {
    const sw = new ShadowWorld(FIELD, 10, 'warrior', { x: 0, z: 0 });
    sw.applySelf(baseSelf({ cls: 'priest', xpNext: null, st: [{ id: 'shaken', r: 3 }], shield: 25, cast: { idx: 2, remaining: 1.1 } }));
    const w = sw.world;
    const p = sw.localPlayer;
    expect(w.get<PlayerClass>(p, C.PlayerClass)!.id).toBe('priest');
    expect(w.get<Progression>(p, C.Progression)!.xpToNext).toBe(Infinity);
    expect(w.get<Statuses>(p, C.Statuses)!.list[0].id).toBe('shaken');
    expect(w.get<Shield>(p, C.Shield)!.amount).toBe(25);
    expect(w.get<CastState>(p, C.CastState)!.index).toBe(2);
    // Cast + shield clear when no longer present.
    sw.applySelf(baseSelf({ shield: 0, cast: null }));
    expect(w.get<Shield>(p, C.Shield)).toBeUndefined();
    expect(w.get<CastState>(p, C.CastState)).toBeUndefined();
  });

  it('creates, updates, and removes replicas from snapshots (self excluded)', () => {
    const sw = new ShadowWorld(FIELD, 10, 'warrior', { x: 0, z: 0 });
    const ents: SnapshotEntity[] = [
      { id: 10, k: 'player', x: 0, z: 0, yaw: 0, hp: 100, mhp: 100, name: 'Me' }, // self → skipped
      { id: 11, k: 'enemy', x: 5, z: 0, yaw: 0, hp: 40, mhp: 60, st: 'engage', name: 'Bloomhusk' },
      { id: 12, k: 'oathstone', x: -3, z: 2, yaw: 0, name: 'Oathhold' },
    ];
    sw.applySnapshot(ents);
    // The enemy replica is queryable (minimap reads C.Enemy + Health + Transform).
    const enemies = [...sw.world.query(C.Enemy, C.Health, C.Transform)];
    expect(enemies.length).toBe(1);
    expect(sw.world.get<Health>(enemies[0], C.Health)!.current).toBe(40);
    expect(sw.nameFor(11)).toBe('Bloomhusk');
    expect([...sw.world.query(C.Oathstone)].length).toBe(1);

    // Update: enemy took damage; removal: it despawns.
    sw.applySnapshot([{ id: 11, k: 'enemy', x: 5, z: 0, yaw: 0, hp: 10, mhp: 60, st: 'engage' }]);
    expect(sw.world.get<Health>(enemies[0], C.Health)!.current).toBe(10);
    expect([...sw.world.query(C.Oathstone)].length).toBe(0); // oathstone dropped
    sw.applySnapshot([]);
    expect([...sw.world.query(C.Enemy)].length).toBe(0);
    expect(sw.nameFor(11)).toBeUndefined();
  });

  it('resolves the target to the local replica entity', () => {
    const sw = new ShadowWorld(FIELD, 10, 'warrior', { x: 0, z: 0 });
    sw.applySnapshot([{ id: 11, k: 'enemy', x: 5, z: 0, yaw: 0, hp: 40, mhp: 60, name: 'Reaver' }]);
    sw.applySelf(baseSelf({ tgt: { id: 11, name: 'Reaver', lvl: 3, hp: 40, mhp: 60 } }));
    const localTarget = sw.world.get<Target>(sw.localPlayer, C.Target)!.entity;
    expect(localTarget).toBe(sw.replicaFor(11));
  });
});
