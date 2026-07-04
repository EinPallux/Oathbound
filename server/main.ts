// Oathbound Online — server entry point (M0 "Server Scaffold").
//
// Boots the authoritative sim world, ticks it at 30 Hz on a headless clock, and accepts
// WebSocket connections (handshake + ping only, for now). This is the process a friends
// server runs on a Linux VPS (docs/technical/VPS_HOSTING_GUIDE.md); the phased plan to grow
// it into real multiplayer is docs/production/MMO_ROADMAP.md.

import { WebSocketServer } from 'ws';
import { loadConfig } from './config';
import { bootServerWorld } from './world-boot';
import { ServerClock } from './clock';
import { attachNet } from './net';

function main(): void {
  const config = loadConfig();

  console.log(`[oathbound] booting world from ${config.mapPath} …`);
  const world = bootServerWorld(config);
  console.log(`[oathbound] map "${world.mapName}" ready — player entity ${world.sim.player}`);

  // Tick the authoritative simulation at a fixed rate.
  const clock = new ServerClock((dt) => world.sim.world.update(dt), config.tickHz);
  clock.start();

  // Accept connections. In production Caddy terminates TLS and proxies wss://host/ws here.
  const wss = new WebSocketServer({ port: config.port, path: config.wsPath });
  attachNet(wss, { config, world, clock, playerCount: () => wss.clients.size });
  console.log(`[oathbound] listening on ws://0.0.0.0:${config.port}${config.wsPath}`);

  // Heartbeat: log the measured tick rate every 5 s (should sit at ~config.tickHz with no drift).
  let lastTicks = clock.ticks;
  let lastAt = performance.now();
  const heartbeat = setInterval(() => {
    const now = performance.now();
    const elapsed = (now - lastAt) / 1000;
    const rate = (clock.ticks - lastTicks) / elapsed;
    console.log(
      `[oathbound] tick ${clock.ticks} · ${rate.toFixed(1)} Hz · clients ${wss.clients.size}`,
    );
    lastTicks = clock.ticks;
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
