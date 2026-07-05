// The authoritative game: owns the sim world and one player entity per connection, and drives
// the tick → snapshot-broadcast loop. M2 "Shared World": every connection gets its OWN player
// (its own PlayerInput), so N players move, fight and loot independently in one world. The sim
// is the authority — cooldowns, collision, aggro, loot rolls and XP all run server-side. Node
// glue only; the reusable pieces (NetworkControlState, buildSnapshot, addPlayer) are shared.

import { WebSocket } from 'ws';
import { NetworkControlState } from '../src/net/net-input';
import { buildSnapshot } from '../src/net/snapshot';
import { encode, type InputMessage } from '../src/net/protocol';
import { addPlayer } from '../src/sim/boot/sim-world';
import { pickUpNearest } from '../src/sim/systems/loot';
import { DT } from '../src/core/time';
import type { Entity } from '../src/core/ecs/world';
import { bootServerWorld, type ServerWorld } from './world-boot';
import type { ServerConfig } from './config';

interface ConnectedPlayer {
  entity: Entity;
  input: NetworkControlState;
}

export class GameServer {
  readonly world: ServerWorld;
  private readonly clients = new Map<WebSocket, ConnectedPlayer>();
  private readonly snapshotEvery: number;
  private sinceSnapshot = 0;
  private tickCount = 0;

  constructor(private readonly config: ServerConfig) {
    this.world = bootServerWorld(config);
    this.snapshotEvery = Math.max(1, Math.round(config.tickHz / config.snapshotHz));
  }

  get tick(): number {
    return this.tickCount;
  }
  get playerCount(): number {
    return this.clients.size;
  }
  get mapName(): string {
    return this.world.mapName;
  }
  get tickHz(): number {
    return this.config.tickHz;
  }
  get snapshotHz(): number {
    return this.config.snapshotHz;
  }

  /** Spawn a player entity for a new connection; returns its entity id (sent in the welcome). */
  join(ws: WebSocket): Entity {
    const input = new NetworkControlState();
    const { x, z } = this.world.playerStart;
    const entity = addPlayer(this.world.sim.world, this.world.field, input, { x, z });
    this.clients.set(ws, { entity, input });
    return entity;
  }

  /** Remove a disconnected player's entity from the world. */
  leave(ws: WebSocket): void {
    const p = this.clients.get(ws);
    if (!p) return;
    this.world.sim.world.destroyEntity(p.entity);
    this.clients.delete(ws);
  }

  /** Fold a client input packet into that connection's player control state. */
  onInput(ws: WebSocket, msg: InputMessage): void {
    this.clients.get(ws)?.input.applyInput(msg);
  }

  /** Advance one authoritative tick, apply interacts, and broadcast snapshots on cadence. */
  step(dt: number = DT): void {
    this.world.sim.world.update(dt);
    // Server-side interact (loot pickup) — offline the browser bootstrap does this on F.
    for (const p of this.clients.values()) {
      if (p.input.consumeInteract()) pickUpNearest(this.world.sim.world, p.entity);
    }
    this.tickCount++;
    if (++this.sinceSnapshot >= this.snapshotEvery) {
      this.sinceSnapshot = 0;
      this.broadcast();
    }
  }

  /** Send the current snapshot to one client (seeds a freshly-welcomed client). */
  sendSnapshotTo(ws: WebSocket): void {
    const p = this.clients.get(ws);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(encode(buildSnapshot(this.world.sim.world, this.tickCount, p?.input.seq ?? 0)));
    }
  }

  private broadcast(): void {
    if (this.clients.size === 0) return;
    for (const [ws, p] of this.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        // Each client's snapshot carries its own input `ack` (its last applied seq).
        ws.send(encode(buildSnapshot(this.world.sim.world, this.tickCount, p.input.seq)));
      }
    }
  }
}
