// The authoritative game: owns the sim world, the connected clients, and the network-driven
// player input, and drives the tick → snapshot-broadcast loop. M1 has ONE shared world player
// controlled by whoever is connected (movement over the wire); per-connection players + threat
// arrive in M2. Node-only glue — the reusable pieces (NetworkControlState, buildSnapshot) are
// isomorphic and unit-tested in src/net.

import { WebSocket } from 'ws';
import { NetworkControlState } from '../src/net/net-input';
import { buildSnapshot } from '../src/net/snapshot';
import { encode, type InputMessage } from '../src/net/protocol';
import { DT } from '../src/core/time';
import { bootServerWorld, type ServerWorld } from './world-boot';
import type { ServerConfig } from './config';

export class GameServer {
  readonly world: ServerWorld;
  private readonly input = new NetworkControlState();
  private readonly clients = new Set<WebSocket>();
  private readonly snapshotEvery: number;
  private sinceSnapshot = 0;
  private tickCount = 0;

  constructor(private readonly config: ServerConfig) {
    this.world = bootServerWorld(config, this.input);
    this.snapshotEvery = Math.max(1, Math.round(config.tickHz / config.snapshotHz));
  }

  get tick(): number {
    return this.tickCount;
  }
  get playerCount(): number {
    return this.clients.size;
  }
  get playerEntity(): number {
    return this.world.sim.player;
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

  /** Advance one authoritative sim tick (reads the current network input), then broadcast a
   *  snapshot on the configured cadence. Driven by the ServerClock. */
  step(dt: number = DT): void {
    this.world.sim.world.update(dt);
    this.tickCount++;
    if (++this.sinceSnapshot >= this.snapshotEvery) {
      this.sinceSnapshot = 0;
      this.broadcast();
    }
  }

  addClient(ws: WebSocket): void {
    this.clients.add(ws);
  }
  removeClient(ws: WebSocket): void {
    this.clients.delete(ws);
  }

  /** Fold a client input packet into the shared player's control state (applied next tick). */
  onInput(msg: InputMessage): void {
    this.input.applyInput(msg);
  }

  /** Send the current snapshot to one client (used to seed a freshly-welcomed client). */
  sendSnapshotTo(ws: WebSocket): void {
    if (ws.readyState === WebSocket.OPEN) ws.send(encode(this.snapshot()));
  }

  private snapshot() {
    return buildSnapshot(this.world.sim.world, this.tickCount, this.input.seq);
  }

  private broadcast(): void {
    if (this.clients.size === 0) return;
    const frame = encode(this.snapshot());
    for (const ws of this.clients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(frame);
    }
  }
}
