// Minimal online client (M1 "First Connection"). Connects to the authoritative server, sends
// the local player's movement intent every tick, and renders the replicated world from the
// server's snapshots with interpolation. There is deliberately NO local simulation here — the
// server owns gameplay truth; this client only sends intents and draws what it's told (the
// local player therefore moves by server echo, which M4 will hide with client-side prediction).
//
// Scope is intentionally tight: walk around a shared world and see the other entities move. HUD,
// inventory, combat UI, targeting and audio are wired as online is fleshed out (M2/M5). Terrain
// is deterministic (same map as the server), so only entities cross the wire. Reuses the game's
// Renderer / CameraRig / Sky and terrain mesh; entity visuals are simple stand-in meshes.

import * as THREE from 'three';
import { Renderer } from '../render/renderer';
import { CameraRig } from '../render/camera-rig';
import { Sky } from '../render/sky';
import { buildTerrainMesh } from '../render/terrain-mesh';
import { GameLoop } from '../core/loop';
import { lerpAngle } from '../core/math';
import { InputController } from '../platform/input';
import { loadKeybinds } from './keybinds';
import { generateHeightfield, type Heightfield } from '../world/heightfield';
import { WORLD_SIZE, WORLD_RES, VOXEL_CUBE, VOXEL_STEP } from '../world/layout';
import { getActiveMap } from '../world/active-map';
import { buildCustomHeightfield } from '../world/custom-map';
import { PLAYER_HALF } from '../sim/factory';
import {
  PROTOCOL_VERSION,
  encode,
  decodeServerMessage,
  type SnapshotEntity,
} from '../net/protocol';

export interface OnlineOptions {
  /** WebSocket URL, e.g. wss://play.example.com/ws or ws://127.0.0.1:8080/ws. */
  url: string;
  /** Display name sent in the hello (cosmetic in M1). */
  name?: string;
}

interface Replica {
  kind: string;
  mesh: THREE.Object3D;
  // Interpolate from prev → cur between snapshots.
  px: number;
  pz: number;
  pyaw: number;
  cx: number;
  cz: number;
  cyaw: number;
  seen: number;
}

/** A tiny status line so the player gets connection feedback without a full HUD. */
function statusBar(): (text: string) => void {
  const el = document.createElement('div');
  el.style.cssText =
    'position:fixed;left:12px;bottom:12px;z-index:10;font:600 13px/1.4 system-ui,sans-serif;' +
    'color:#e8eef6;background:rgba(20,26,34,.72);padding:6px 10px;border-radius:6px;pointer-events:none';
  document.body.appendChild(el);
  return (text: string) => {
    el.textContent = `Oathbound Online — ${text}`;
  };
}

export function bootOnline(opts: OnlineOptions): { stop(): void } {
  const canvas = document.getElementById('game') as HTMLCanvasElement | null;
  if (!canvas) throw new Error('Oathbound: missing #game canvas');

  const setStatus = statusBar();
  const renderer = new Renderer(canvas);
  const keybinds = loadKeybinds();
  const input = new InputController(canvas, keybinds);
  new Sky(renderer.scene);

  // Heightfield: build the SAME terrain the server used (deterministic) so entities sit on the
  // right ground. Custom map when one is active (Talar by default), else the procedural world.
  const map = getActiveMap();
  const field: Heightfield = map
    ? buildCustomHeightfield(map)
    : generateHeightfield(WORLD_SIZE, WORLD_RES, 1337, []);
  field.voxelCube = VOXEL_CUBE;
  field.voxelStep = VOXEL_STEP;
  const terrain = buildTerrainMesh(field);
  renderer.scene.add(terrain);
  renderer.setFogRange(60, 340);

  const cameraRig = new CameraRig(renderer.camera, input, [terrain]);

  // ── Shared entity visuals (stand-in meshes; one geometry/material per kind) ──
  const cap = (r: number, h: number): THREE.CapsuleGeometry => new THREE.CapsuleGeometry(r, h, 4, 10);
  const mat = (hex: number): THREE.Material => new THREE.MeshLambertMaterial({ color: hex });
  const GEO = {
    player: cap(0.4, 1.0),
    enemy: cap(0.45, 0.7),
    boss: cap(1.1, 1.6),
    marker: new THREE.CylinderGeometry(0.35, 0.35, 2.4, 8),
    box: new THREE.BoxGeometry(0.9, 1.4, 0.9),
    loot: new THREE.BoxGeometry(0.4, 0.4, 0.4),
    nose: new THREE.ConeGeometry(0.16, 0.5, 8),
  };
  const MAT = {
    self: mat(0x4aa3ff),
    other: mat(0x5fd18b),
    enemy: mat(0xc0392b),
    boss: mat(0x7a1f1f),
    vendor: mat(0xf1c40f),
    oathstone: mat(0x39c3d6),
    loot: mat(0xf5c542),
    nose: mat(0xf0f4ff),
  };

  function buildMesh(kind: string, isSelf: boolean): THREE.Object3D {
    switch (kind) {
      case 'player': {
        const g = new THREE.Group();
        g.add(new THREE.Mesh(GEO.player, isSelf ? MAT.self : MAT.other));
        const nose = new THREE.Mesh(GEO.nose, MAT.nose);
        nose.rotation.x = Math.PI / 2; // point +Z (forward)
        nose.position.set(0, 0.2, 0.55);
        g.add(nose);
        return g;
      }
      case 'enemy':
        return new THREE.Mesh(GEO.enemy, MAT.enemy);
      case 'boss':
        return new THREE.Mesh(GEO.boss, MAT.boss);
      case 'vendor':
        return new THREE.Mesh(GEO.box, MAT.vendor);
      case 'oathstone':
        return new THREE.Mesh(GEO.marker, MAT.oathstone);
      default:
        return new THREE.Mesh(GEO.loot, MAT.loot);
    }
  }

  // ── Replicated world state ──
  const replicas = new Map<number, Replica>();
  let self: number | null = null;
  let snapIndex = 0;
  let lastSnapAt = performance.now();
  let snapIntervalMs = 1000 / 15;
  let seq = 0;
  // Camera target — the local player's interpolated position (origin until first snapshot).
  let camX = 0;
  let camZ = 0;
  let camY = field.sample(0, 0) + PLAYER_HALF;

  function applySnapshot(ents: SnapshotEntity[]): void {
    snapIndex++;
    lastSnapAt = performance.now();
    for (const e of ents) {
      let r = replicas.get(e.id);
      if (!r) {
        const mesh = buildMesh(e.k, e.id === self);
        renderer.scene.add(mesh);
        r = { kind: e.k, mesh, px: e.x, pz: e.z, pyaw: e.yaw, cx: e.x, cz: e.z, cyaw: e.yaw, seen: snapIndex };
        replicas.set(e.id, r);
      } else {
        r.px = r.cx;
        r.pz = r.cz;
        r.pyaw = r.cyaw;
        r.cx = e.x;
        r.cz = e.z;
        r.cyaw = e.yaw;
        r.seen = snapIndex;
      }
      r.mesh.visible = !(e.k === 'enemy' && e.st === 'dead');
    }
    // Drop replicas that vanished from the world (despawned loot, removed entities).
    for (const [id, r] of replicas) {
      if (r.seen !== snapIndex) {
        renderer.scene.remove(r.mesh);
        replicas.delete(id);
      }
    }
  }

  // ── WebSocket ──
  setStatus('connecting…');
  const ws = new WebSocket(opts.url);
  ws.onopen = () => {
    setStatus('connected — handshaking…');
    ws.send(encode({ t: 'hello', protocol: PROTOCOL_VERSION, name: opts.name }));
  };
  ws.onclose = () => setStatus('disconnected');
  ws.onerror = () => setStatus('connection error');
  ws.onmessage = (ev: MessageEvent) => {
    const res = decodeServerMessage(typeof ev.data === 'string' ? ev.data : String(ev.data));
    if (!res.ok) return;
    const m = res.msg;
    if (m.t === 'welcome') {
      self = m.entityId;
      snapIntervalMs = 1000 / (m.snapshotHz || 15);
      setStatus(`playing on "${m.map}" — WASD to move, click to look`);
    } else if (m.t === 'snapshot') {
      applySnapshot(m.ents);
    }
  };

  function sendInput(): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(
      encode({
        t: 'input',
        seq: ++seq,
        forward: input.forward,
        back: input.back,
        left: input.left,
        right: input.right,
        yaw: input.yaw,
        jump: input.consumeJump(),
        // M2: fight + loot over the wire. Abilities auto-acquire a target in the facing cone.
        ability: input.consumeAbility(),
        interact: input.consumeInteract(),
        cycle: input.consumeTargetCycle(),
      }),
    );
  }

  function renderFrame(): void {
    const t = Math.min(1, (performance.now() - lastSnapAt) / snapIntervalMs);
    for (const r of replicas.values()) {
      const x = r.px + (r.cx - r.px) * t;
      const z = r.pz + (r.cz - r.pz) * t;
      const groundY = field.sample(x, z);
      r.mesh.position.set(x, groundY + (r.kind === 'player' ? PLAYER_HALF : 0.4), z);
      r.mesh.rotation.y = lerpAngle(r.pyaw, r.cyaw, t);
    }
    if (self != null) {
      const me = replicas.get(self);
      if (me) {
        camX = me.mesh.position.x;
        camZ = me.mesh.position.z;
        camY = field.sample(camX, camZ) + PLAYER_HALF;
      }
    }
    cameraRig.update(camX, camY, camZ);
    renderer.render();
  }

  // Fixed-step input send (30 Hz) + per-frame interpolated render.
  const loop = new GameLoop({ step: () => sendInput(), render: () => renderFrame() });
  loop.start();

  return {
    stop(): void {
      loop.stop();
      ws.close();
    },
  };
}
