// WebSocket handling. Validates every incoming frame with the shared protocol schemas and
// routes it: `ping`→`pong`, `hello`→`welcome` (+ an initial snapshot), `input`→the game. Each
// connection is registered with the GameServer so it receives broadcast snapshots. A malformed
// frame gets a coded `error`, never a crash — the server stays authoritative and untrusting.

import { WebSocket, type WebSocketServer, type RawData } from 'ws';
import {
  PROTOCOL_VERSION,
  decodeClientMessage,
  encode,
  type ServerMessage,
} from '../src/net/protocol';
import type { GameServer } from './game';

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(encode(msg));
}

export function attachNet(wss: WebSocketServer, game: GameServer): void {
  wss.on('connection', (ws: WebSocket) => {
    let joined = false;
    ws.on('close', () => {
      if (joined) game.leave(ws);
    });
    ws.on('error', () => {
      if (joined) game.leave(ws);
    });

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
          send(ws, { t: 'pong', time: msg.time, serverTick: game.tick });
          break;
        case 'hello': {
          if (msg.protocol !== PROTOCOL_VERSION) {
            send(ws, {
              t: 'error',
              code: 'bad_protocol',
              message: `server speaks protocol ${PROTOCOL_VERSION}, client sent ${msg.protocol}`,
            });
            return;
          }
          if (joined) return; // already joined; ignore a duplicate hello
          // M2: each connection gets its own player entity to drive.
          const entity = game.join(ws);
          joined = true;
          send(ws, {
            t: 'welcome',
            protocol: PROTOCOL_VERSION,
            entityId: entity,
            map: game.mapName,
            tick: game.tick,
            tickHz: game.tickHz,
            snapshotHz: game.snapshotHz,
            players: game.playerCount,
          });
          game.sendSnapshotTo(ws); // seed the client with the current world immediately
          break;
        }
        case 'input':
          game.onInput(ws, msg);
          break;
      }
    });
  });
}
