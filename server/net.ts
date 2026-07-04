// WebSocket handling. M0 scope is deliberately tiny: validate every incoming frame with the
// shared protocol schemas, answer `ping` with `pong`, and answer `hello` with `welcome`. No
// gameplay is sent yet (input/snapshots/events land in M1). Every message is zod-validated on
// receipt — a malformed frame gets a coded `error`, never a crash.

import type { WebSocketServer, WebSocket, RawData } from 'ws';
import {
  PROTOCOL_VERSION,
  decodeClientMessage,
  encode,
  type ServerMessage,
} from '../src/net/protocol';
import type { ServerConfig } from './config';
import type { ServerWorld } from './world-boot';
import type { ServerClock } from './clock';

export interface NetDeps {
  config: ServerConfig;
  world: ServerWorld;
  clock: ServerClock;
  /** Current connected-client count (M0's stand-in for "players online"). */
  playerCount: () => number;
}

function send(ws: WebSocket, msg: ServerMessage): void {
  ws.send(encode(msg));
}

export function attachNet(wss: WebSocketServer, deps: NetDeps): void {
  wss.on('connection', (ws: WebSocket) => {
    ws.on('message', (data: RawData) => {
      const raw = typeof data === 'string' ? data : data.toString();
      const res = decodeClientMessage(raw);
      if (!res.ok) {
        send(ws, { t: 'error', code: 'bad_message', message: res.error });
        return;
      }
      const msg = res.msg;
      switch (msg.t) {
        case 'ping':
          send(ws, { t: 'pong', time: msg.time, serverTick: deps.clock.ticks });
          break;
        case 'hello':
          if (msg.protocol !== PROTOCOL_VERSION) {
            send(ws, {
              t: 'error',
              code: 'bad_protocol',
              message: `server speaks protocol ${PROTOCOL_VERSION}, client sent ${msg.protocol}`,
            });
            return;
          }
          // M0: there is one shared world player; every client is told about it. Per-connection
          // player entities (a createPlayer per session) arrive in M1.
          send(ws, {
            t: 'welcome',
            protocol: PROTOCOL_VERSION,
            entityId: deps.world.sim.player,
            map: deps.world.mapName,
            tick: deps.clock.ticks,
            tickHz: deps.config.tickHz,
            snapshotHz: deps.config.snapshotHz,
            players: deps.playerCount(),
          });
          break;
      }
    });
  });
}
