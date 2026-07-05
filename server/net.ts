// WebSocket handling: the M3 connection flow. A client authenticates (register/login/resume),
// gets its character roster, then enters the world with a character (select existing / create /
// import). Only once in-world does `input` flow. Every frame is zod-validated; a bad frame gets
// a coded `error`, never a crash. The server is authoritative and untrusting.

import type { IncomingMessage } from 'node:http';
import { WebSocket, type WebSocketServer, type RawData } from 'ws';
import {
  PROTOCOL_VERSION,
  decodeClientMessage,
  encode,
  type ServerMessage,
} from '../src/net/protocol';
import { RateLimiter } from '../src/net/rate-limit';
import type { GameServer, EnterResult } from './game';

/** Per-connection message budget: comfortably above the 30 Hz input stream, with burst room. */
const RL_CAPACITY = 60;
const RL_REFILL_PER_SEC = 45;
/** Drop this many over-rate messages from one connection, then disconnect the flooder. */
const RL_MAX_DROPPED = 200;
/** Max simultaneous connections from a single IP. */
const MAX_CONN_PER_IP = 8;

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(encode(msg));
}

export function attachNet(wss: WebSocketServer, game: GameServer): void {
  const ipCounts = new Map<string, number>();

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const ip = req.socket.remoteAddress ?? 'unknown';
    if ((ipCounts.get(ip) ?? 0) >= MAX_CONN_PER_IP) {
      ws.close(1008, 'too many connections');
      return;
    }
    ipCounts.set(ip, (ipCounts.get(ip) ?? 0) + 1);

    const limiter = new RateLimiter(RL_CAPACITY, RL_REFILL_PER_SEC, Date.now());
    let dropped = 0;
    let accountId: number | null = null;
    let inWorld = false;
    let cleanedUp = false;

    const cleanup = (): void => {
      if (cleanedUp) return;
      cleanedUp = true;
      const c = (ipCounts.get(ip) ?? 1) - 1;
      if (c <= 0) ipCounts.delete(ip);
      else ipCounts.set(ip, c);
      if (inWorld) {
        game.leave(ws);
        inWorld = false;
      }
    };
    ws.on('close', cleanup);
    ws.on('error', cleanup);

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
      game.announceJoin(ws); // MOTD to us + "joined" to everyone else
    };

    ws.on('message', (data: RawData) => {
      // Rate limit: drop over-budget messages; disconnect a persistent flooder.
      if (!limiter.tryConsume(Date.now())) {
        if (++dropped > RL_MAX_DROPPED) ws.close(1008, 'rate limit exceeded');
        return;
      }
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

        case 'chat':
          if (inWorld) game.chat(ws, msg.text);
          return;
      }
    });
  });
}
