// WebSocket handling: the M3 connection flow. A client authenticates (register/login/resume),
// gets its character roster, then enters the world with a character (select existing / create /
// import). Only once in-world does `input` flow. Every frame is zod-validated; a bad frame gets
// a coded `error`, never a crash. The server is authoritative and untrusting.

import { WebSocket, type WebSocketServer, type RawData } from 'ws';
import {
  PROTOCOL_VERSION,
  decodeClientMessage,
  encode,
  type ServerMessage,
} from '../src/net/protocol';
import type { GameServer, EnterResult } from './game';

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(encode(msg));
}

export function attachNet(wss: WebSocketServer, game: GameServer): void {
  wss.on('connection', (ws: WebSocket) => {
    let accountId: number | null = null;
    let inWorld = false;

    const dropIfInWorld = (): void => {
      if (inWorld) {
        game.leave(ws);
        inWorld = false;
      }
    };
    ws.on('close', dropIfInWorld);
    ws.on('error', dropIfInWorld);

    const sendCharList = (): void => {
      if (accountId != null) send(ws, { t: 'charList', chars: game.characters(accountId) });
    };

    const finishEnter = (res: EnterResult): void => {
      if (!res.ok) {
        send(ws, { t: 'error', code: res.code, message: res.message });
        return;
      }
      inWorld = true;
      send(ws, {
        t: 'welcome',
        protocol: PROTOCOL_VERSION,
        entityId: res.entity,
        map: game.mapName,
        tick: game.tick,
        tickHz: game.tickHz,
        snapshotHz: game.snapshotHz,
        players: game.playerCount,
      });
      game.sendSnapshotTo(ws);
    };

    ws.on('message', (data: RawData) => {
      const parsed = decodeClientMessage(typeof data === 'string' ? data : data.toString());
      if (!parsed.ok) {
        send(ws, { t: 'error', code: 'bad_message', message: parsed.error });
        return;
      }
      const msg = parsed.msg;

      switch (msg.t) {
        case 'ping':
          send(ws, { t: 'pong', time: msg.time, serverTick: game.tick });
          return;

        case 'register':
        case 'login': {
          if (msg.protocol !== PROTOCOL_VERSION) {
            send(ws, {
              t: 'error',
              code: 'bad_protocol',
              message: `server speaks protocol ${PROTOCOL_VERSION}, client sent ${msg.protocol}`,
            });
            return;
          }
          const r =
            msg.t === 'register'
              ? game.register(msg.username, msg.password, msg.joinPassword)
              : game.login(msg.username, msg.password);
          if (!r.ok) {
            send(ws, { t: 'error', code: r.code, message: r.message });
            return;
          }
          accountId = r.accountId;
          send(ws, { t: 'authOk', token: r.token, username: r.username });
          sendCharList();
          return;
        }

        case 'resume': {
          if (msg.protocol !== PROTOCOL_VERSION) {
            send(ws, { t: 'error', code: 'bad_protocol', message: 'protocol mismatch' });
            return;
          }
          const r = game.resume(msg.token);
          if (!r) {
            send(ws, { t: 'error', code: 'bad_session', message: 'session expired — log in again' });
            return;
          }
          accountId = r.accountId;
          send(ws, { t: 'authOk', token: msg.token, username: r.username });
          sendCharList();
          return;
        }

        // Everything below requires an authenticated account.
        case 'selectChar':
        case 'createChar':
        case 'importChar':
        case 'deleteChar':
          if (accountId == null) {
            send(ws, { t: 'error', code: 'auth_required', message: 'log in first' });
            return;
          }
          if (inWorld && msg.t !== 'deleteChar') {
            send(ws, { t: 'error', code: 'already_in_world', message: 'already playing' });
            return;
          }
          if (msg.t === 'selectChar') finishEnter(game.enterExisting(ws, accountId, msg.slot));
          else if (msg.t === 'createChar') finishEnter(game.enterNew(ws, accountId, msg.slot, msg.name, msg.classId));
          else if (msg.t === 'importChar') finishEnter(game.enterImport(ws, accountId, msg.slot, msg.name, msg.save));
          else {
            game.deleteChar(accountId, msg.slot);
            sendCharList();
          }
          return;

        case 'input':
          if (inWorld) game.onInput(ws, msg);
          return;
      }
    });
  });
}
