// ECS-lite: entities are numeric ids, components are plain data stored per type,
// systems are functions that iterate matching entities. No framework.
// See docs/technical/ARCHITECTURE_PLAN.md#ecs-lite-model--adr-006 and ADR-006.

import { EventBus } from '../events';

export type Entity = number;

export interface System {
  readonly name: string;
  update(world: World, dt: number): void;
}

export class World {
  private nextId: Entity = 1;
  private readonly entities = new Set<Entity>();
  private readonly stores = new Map<string, Map<Entity, unknown>>();
  private readonly systems: System[] = [];
  readonly events = new EventBus();

  createEntity(): Entity {
    const e = this.nextId++;
    this.entities.add(e);
    return e;
  }

  destroyEntity(e: Entity): void {
    this.entities.delete(e);
    for (const store of this.stores.values()) store.delete(e);
  }

  has(e: Entity): boolean {
    return this.entities.has(e);
  }

  get entityCount(): number {
    return this.entities.size;
  }

  private store(name: string): Map<Entity, unknown> {
    let s = this.stores.get(name);
    if (!s) {
      s = new Map();
      this.stores.set(name, s);
    }
    return s;
  }

  /** Attach (or overwrite) a component on an entity; returns the data for chaining. */
  set<T>(e: Entity, name: string, data: T): T {
    this.store(name).set(e, data);
    return data;
  }

  get<T>(e: Entity, name: string): T | undefined {
    return this.store(name).get(e) as T | undefined;
  }

  remove(e: Entity, name: string): void {
    this.store(name).delete(e);
  }

  /** Iterate entities that have *all* of the named components (smallest-store first). */
  *query(...names: string[]): Iterable<Entity> {
    if (names.length === 0) {
      yield* this.entities;
      return;
    }
    const stores = names.map((n) => this.store(n));
    let smallest = stores[0];
    for (const s of stores) if (s.size < smallest.size) smallest = s;
    outer: for (const e of smallest.keys()) {
      for (const s of stores) {
        if (s !== smallest && !s.has(e)) continue outer;
      }
      yield e;
    }
  }

  addSystem(system: System): void {
    this.systems.push(system);
  }

  /** Run every registered system once for this fixed timestep. */
  update(dt: number): void {
    for (const system of this.systems) system.update(this, dt);
  }
}
