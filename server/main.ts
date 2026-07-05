// Oathbound Online — server entry point.
//
// M1 "First Connection": boots the authoritative sim world, ticks it at 30 Hz, and lets a
// connected client drive the (shared, M1) player over the wire — sending `input`, receiving
// `snapshot`s. This is the process a friends server runs on a Linux VPS
// (docs/technical/VPS_HOSTING_GUIDE.md); the phased plan is docs/production/MMO_ROADMAP.md.

import { WebSocketServer } from 'ws';
import { loadConfig } from './config';
import { GameServer } from './game';
import { ServerClock } from './clock';
import { attachNet } from './net';

function main(): void {
  const config = loadConfig();

  console.log(`[oathbound] booting world from ${config.mapPath} …`);
  const game = new GameServer(config);
  console.log(`[oathbound] map "${game.mapName}" ready — players join per connection`);

  // Tick the authoritative simulation (each tick also broadcasts a snapshot on cadence).
  const clock = new ServerClock((dt) => game.step(dt), config.tickHz);
  clock.start();

  // Accept connections. In production Caddy terminates TLS and proxies wss://host/ws here.
  // Cap inbound frames well below the ws default (100 MiB). The largest legitimate message is an
  // imported save; 256 KiB is generous for that and stops a client from shipping huge blobs.
  const wss = new WebSocketServer({ port: config.port, path: config.wsPath, maxPayload: 256 * 1024 });
  attachNet(wss, game);
  console.log(
    `[oathbound] listening on ws://0.0.0.0:${config.port}${config.wsPath}` +
      ` · snapshots ${config.snapshotHz} Hz`,
  );

  // Heartbeat: log the measured tick rate every 5 s (should sit at ~config.tickHz with no drift).
  let lastTicks = game.tick;
  let lastAt = performance.now();
  const heartbeat = setInterval(() => {
    const now = performance.now();
    const elapsed = (now - lastAt) / 1000;
    const rate = (game.tick - lastTicks) / elapsed;
    const s = clock.takeStats();
    console.log(
      `[oathbound] tick ${game.tick} · ${rate.toFixed(1)} Hz · clients ${game.playerCount}` +
        ` · step avg ${s.avgMs.toFixed(2)}ms max ${s.maxMs.toFixed(2)}ms (budget ${(1000 / config.tickHz).toFixed(0)}ms)`,
    );
    lastTicks = game.tick;
    lastAt = now;
  }, 5000);

  // Write-behind persistence: periodically flush every in-world character to SQLite.
  const saver = setInterval(() => game.flushAll(), config.saveIntervalS * 1000);
  console.log(`[oathbound] persisting to ${config.dbPath} · autosave every ${config.saveIntervalS}s`);

  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[oathbound] ${signal} — flushing characters and shutting down`);
    clearInterval(heartbeat);
    clearInterval(saver);
    clock.stop();
    game.flushAll(); // graceful: persist everyone before exit
    game.close();
    wss.close();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Last-resort guards: an unexpected throw/rejection anywhere must not silently kill the
  // process and disconnect everyone (with Restart=always that would crash-loop on a bad input).
  // The tick loop and ws handlers already catch in-context; log anything that still escapes and
  // stay up. A genuinely fatal, repeating fault is still visible in journald for the operator.
  process.on('uncaughtException', (err) => {
    console.error('[oathbound] uncaughtException — staying up:', err);
  });
  process.on('unhandledRejection', (reason) => {
    console.error('[oathbound] unhandledRejection — staying up:', reason);
  });
  // `/admin shutdown [s]` schedules a graceful exit after the warning window.
  game.onShutdown = (seconds) => setTimeout(() => shutdown('admin shutdown'), seconds * 1000);
}

main();
