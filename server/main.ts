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
  const wss = new WebSocketServer({ port: config.port, path: config.wsPath });
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
    console.log(`[oathbound] tick ${game.tick} · ${rate.toFixed(1)} Hz · clients ${game.playerCount}`);
    lastTicks = game.tick;
    lastAt = now;
  }, 5000);

  const shutdown = (signal: string): void => {
    console.log(`[oathbound] ${signal} — shutting down`);
    clearInterval(heartbeat);
    clock.stop();
    wss.close();
    // (M3 will flush characters to SQLite here before exit.)
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main();
