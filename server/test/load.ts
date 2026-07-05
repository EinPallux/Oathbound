// Headless bot load test (run with `npm run server:loadtest`). Spawns N bots that authenticate,
// create/select a character, and drive random movement + occasional abilities against a RUNNING
// server, then reports per-bot downstream bandwidth. The server's own heartbeat log reports the
// sim step time (the real capacity metric). Point it at a throwaway DB + a raised per-IP cap:
//
//   OATHBOUND_PORT=8080 OATHBOUND_DB=/tmp/load.db OATHBOUND_MAX_CONN_PER_IP=100 npm run server:dev
//   OATHBOUND_LOAD_BOTS=20 OATHBOUND_LOAD_SECONDS=15 npm run server:loadtest

import WebSocket from 'ws';

const URL = process.env.OATHBOUND_LOAD_URL ?? 'ws://127.0.0.1:8080/ws';
const N = Math.max(1, Number(process.env.OATHBOUND_LOAD_BOTS ?? 20));
const SECONDS = Math.max(1, Number(process.env.OATHBOUND_LOAD_SECONDS ?? 15));
const PROTOCOL = 1;

interface Bot {
  ws: WebSocket;
  self: number | null;
  seq: number;
  bytes: number;
  snaps: number;
  yaw: number;
  timer: ReturnType<typeof setInterval> | null;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function makeBot(i: number): Bot {
  const ws = new WebSocket(URL);
  const bot: Bot = { ws, self: null, seq: 0, bytes: 0, snaps: 0, yaw: Math.random() * 6.28, timer: null };
  const send = (m: unknown): void => {
    try {
      ws.send(JSON.stringify(m));
    } catch {
      /* closing */
    }
  };
  ws.on('open', () => send({ t: 'register', protocol: PROTOCOL, username: `bot${i}`, password: 'loadtest1' }));
  ws.on('message', (data: WebSocket.RawData) => {
    const s = typeof data === 'string' ? data : data.toString();
    bot.bytes += s.length;
    let m: { t: string; code?: string; chars?: { slot: number }[]; entityId?: number };
    try {
      m = JSON.parse(s);
    } catch {
      return;
    }
    if (m.t === 'error' && m.code === 'username_taken') {
      send({ t: 'login', protocol: PROTOCOL, username: `bot${i}`, password: 'loadtest1' });
    } else if (m.t === 'charList') {
      const has = (m.chars ?? []).some((c) => c.slot === 0);
      send(has ? { t: 'selectChar', slot: 0 } : { t: 'createChar', slot: 0, name: `Bot${i}`, classId: 'warrior' });
    } else if (m.t === 'welcome') {
      bot.self = m.entityId ?? null;
      bot.timer = setInterval(() => {
        if (Math.random() < 0.03) bot.yaw = Math.random() * 6.28; // occasionally turn
        send({
          t: 'input',
          seq: ++bot.seq,
          forward: true,
          back: false,
          left: false,
          right: false,
          yaw: bot.yaw,
          jump: false,
          ability: Math.random() < 0.1 ? 0 : null, // sometimes swing (generate combat load)
          interact: false,
          cycle: false,
        });
      }, 33);
    } else if (m.t === 'snapshot') {
      bot.snaps++;
    }
  });
  ws.on('error', () => {});
  return bot;
}

async function main(): Promise<void> {
  console.log(`[loadtest] ${N} bots × ${SECONDS}s → ${URL}`);
  const bots: Bot[] = [];
  for (let i = 0; i < N; i++) {
    bots.push(makeBot(i));
    await sleep(40); // stagger connects so auth/char-create don't thundering-herd
  }
  await sleep(SECONDS * 1000);

  let connected = 0;
  let totalBytes = 0;
  let totalSnaps = 0;
  for (const b of bots) {
    if (b.timer) clearInterval(b.timer);
    if (b.self != null) connected++;
    totalBytes += b.bytes;
    totalSnaps += b.snaps;
    try {
      b.ws.close();
    } catch {
      /* ignore */
    }
  }
  const kbitPerBot = connected ? (totalBytes * 8) / 1000 / connected / SECONDS : 0;
  const snapRate = connected ? totalSnaps / connected / SECONDS : 0;
  console.log(`[loadtest] connected ${connected}/${N}`);
  console.log(
    `[loadtest] downstream: ${(totalBytes / 1024).toFixed(0)} KiB total · ` +
      `~${kbitPerBot.toFixed(1)} kbit/s per bot · ${snapRate.toFixed(1)} snapshots/s per bot`,
  );
  console.log('[loadtest] server sim step time is in the server log heartbeat (step avg/max ms).');
  await sleep(200);
  process.exit(0);
}

void main();
