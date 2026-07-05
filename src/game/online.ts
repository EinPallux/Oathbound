// Online client (M3). Flow: connect → authenticate (login/register) → pick a character
// (select / create / import an offline save) → enter the world. Only the world half runs a
// scene; before that it's a small login + character panel. There is NO local simulation — the
// server owns gameplay truth; this client sends intents and renders replicated snapshots with
// interpolation (the local player moves by server echo; prediction is M4). Terrain is
// deterministic (same map as the server), so only entities cross the wire. Reuses the game's
// Renderer / CameraRig / Sky + terrain mesh; entity visuals are simple stand-in meshes.

import * as THREE from 'three';
import { Renderer } from '../render/renderer';
import { CameraRig } from '../render/camera-rig';
import { Sky } from '../render/sky';
import { buildTerrainMesh } from '../render/terrain-mesh';
import { GameLoop } from '../core/loop';
import { lerpAngle } from '../core/math';
import { InputController } from '../platform/input';
import { loadKeybinds } from './keybinds';
import { loadSave } from '../platform/save-store';
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
  type CharSummary,
} from '../net/protocol';

type ClassId = 'warrior' | 'hunter' | 'priest';

export interface OnlineOptions {
  /** WebSocket URL, e.g. wss://play.example.com/ws or ws://127.0.0.1:8080/ws. */
  url: string;
  /** Optional auto-login credentials (from ?user=&pass=). */
  user?: string;
  pass?: string;
  /** Optional auto-enter character slot + class (from ?char=&class=). */
  char?: number;
  className?: ClassId;
}

interface Replica {
  kind: string;
  mesh: THREE.Object3D;
  px: number;
  pz: number;
  pyaw: number;
  cx: number;
  cz: number;
  cyaw: number;
  seen: number;
}

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

/** A centred overlay panel for the login + character screens. */
function makePanel(): { root: HTMLDivElement; body: HTMLDivElement; show(): void; hide(): void } {
  const root = document.createElement('div');
  root.style.cssText =
    'position:fixed;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;' +
    'background:rgba(10,14,20,.72);font:14px/1.5 system-ui,sans-serif;color:#e8eef6';
  const body = document.createElement('div');
  body.style.cssText =
    'min-width:280px;max-width:360px;background:#1b2430;border:1px solid #33445a;border-radius:10px;' +
    'padding:20px;display:flex;flex-direction:column;gap:10px';
  root.appendChild(body);
  document.body.appendChild(root);
  return {
    root,
    body,
    show: () => (root.style.display = 'flex'),
    hide: () => (root.style.display = 'none'),
  };
}

export function bootOnline(opts: OnlineOptions): { stop(): void } {
  const setStatus = statusBar();
  const panel = makePanel();
  let ws: WebSocket;
  let started = false;
  let world: { stop(): void } | null = null;

  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, css: string, text?: string): HTMLElementTagNameMap[K] => {
    const n = document.createElement(tag);
    n.style.cssText = css;
    if (text != null) n.textContent = text;
    return n;
  };
  const btnCss =
    'padding:8px 12px;border:0;border-radius:6px;background:#3a6ea5;color:#fff;font-weight:600;cursor:pointer';
  const inputCss = 'padding:8px;border-radius:6px;border:1px solid #33445a;background:#0f151d;color:#e8eef6';

  const send = (m: unknown): void => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m));
  };

  // ── Login screen ──
  function showLogin(err?: string): void {
    panel.show();
    panel.body.replaceChildren();
    panel.body.appendChild(el('h2', 'margin:0 0 4px;font-size:18px', 'Oathbound Online'));
    if (err) panel.body.appendChild(el('div', 'color:#ff9a8a;font-size:13px', err));
    const user = el('input', inputCss) as HTMLInputElement;
    user.placeholder = 'username';
    user.value = opts.user ?? '';
    const pass = el('input', inputCss) as HTMLInputElement;
    pass.type = 'password';
    pass.placeholder = 'password';
    pass.value = opts.pass ?? '';
    const row = el('div', 'display:flex;gap:8px');
    const login = el('button', btnCss + ';flex:1', 'Log in');
    const register = el('button', btnCss + ';flex:1;background:#4a7', 'Register');
    login.onclick = () => send({ t: 'login', protocol: PROTOCOL_VERSION, username: user.value, password: pass.value });
    register.onclick = () =>
      send({ t: 'register', protocol: PROTOCOL_VERSION, username: user.value, password: pass.value });
    row.append(login, register);
    panel.body.append(user, pass, row);
  }

  // ── Character screen ──
  function showChars(chars: CharSummary[]): void {
    panel.show();
    panel.body.replaceChildren();
    panel.body.appendChild(el('h2', 'margin:0;font-size:18px', 'Choose your character'));
    for (let slot = 0; slot < 3; slot++) {
      const existing = chars.find((c) => c.slot === slot);
      const row = el('div', 'display:flex;gap:8px;align-items:center');
      if (existing) {
        const play = el('button', btnCss + ';flex:1', `Play ${existing.name} — Lv ${existing.level} ${existing.classId}`);
        play.onclick = () => send({ t: 'selectChar', slot });
        const del = el('button', btnCss + ';background:#a44', '✕');
        del.onclick = () => send({ t: 'deleteChar', slot });
        row.append(play, del);
      } else {
        const name = el('input', inputCss + ';flex:1') as HTMLInputElement;
        name.placeholder = `slot ${slot + 1} name`;
        const cls = el('select', inputCss) as HTMLSelectElement;
        for (const c of ['warrior', 'hunter', 'priest']) {
          const o = document.createElement('option');
          o.value = c;
          o.textContent = c;
          cls.appendChild(o);
        }
        const create = el('button', btnCss, 'Create');
        create.onclick = () =>
          send({ t: 'createChar', slot, name: name.value || `Hero${slot + 1}`, classId: cls.value });
        row.append(name, cls, create);
      }
      panel.body.appendChild(row);
    }
    // One-time import of an offline single-player save into the first free slot.
    const freeSlot = [0, 1, 2].find((s) => !chars.some((c) => c.slot === s));
    if (freeSlot != null) {
      const imp = el('button', btnCss + ';background:#666', 'Import my offline character');
      imp.onclick = () => {
        void loadSave().then((save) => {
          if (!save) {
            setStatus('no offline save found in this browser');
            return;
          }
          send({ t: 'importChar', slot: freeSlot, name: `Imported${freeSlot + 1}`, save });
        });
      };
      panel.body.appendChild(imp);
    }
  }

  // ── Auto-enter (URL-driven), when ?char= is given ──
  function autoEnter(chars: CharSummary[]): boolean {
    if (opts.char == null) return false;
    const slot = opts.char;
    if (chars.some((c) => c.slot === slot)) {
      send({ t: 'selectChar', slot });
    } else {
      send({ t: 'createChar', slot, name: `${opts.user ?? 'Hero'}${slot + 1}`, classId: opts.className ?? 'warrior' });
    }
    return true;
  }

  // ── The 3D world (built once, on welcome) ──
  function startWorld(selfId: number, snapshotHz: number): void {
    if (started) return;
    started = true;
    panel.hide();
    const canvas = document.getElementById('game') as HTMLCanvasElement | null;
    if (!canvas) throw new Error('Oathbound: missing #game canvas');
    const renderer = new Renderer(canvas);
    const keybinds = loadKeybinds();
    const input = new InputController(canvas, keybinds);
    new Sky(renderer.scene);

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
    const buildMesh = (kind: string, isSelf: boolean): THREE.Object3D => {
      switch (kind) {
        case 'player': {
          const g = new THREE.Group();
          g.add(new THREE.Mesh(GEO.player, isSelf ? MAT.self : MAT.other));
          const nose = new THREE.Mesh(GEO.nose, MAT.nose);
          nose.rotation.x = Math.PI / 2;
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
    };

    const replicas = new Map<number, Replica>();
    let snapIndex = 0;
    let lastSnapAt = performance.now();
    const snapIntervalMs = 1000 / (snapshotHz || 15);
    let seq = 0;
    let camX = 0;
    let camZ = 0;
    let camY = field.sample(0, 0) + PLAYER_HALF;

    const applySnapshot = (ents: SnapshotEntity[]): void => {
      snapIndex++;
      lastSnapAt = performance.now();
      for (const e of ents) {
        let r = replicas.get(e.id);
        if (!r) {
          const mesh = buildMesh(e.k, e.id === selfId);
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
      for (const [id, r] of replicas) {
        if (r.seen !== snapIndex) {
          renderer.scene.remove(r.mesh);
          replicas.delete(id);
        }
      }
    };
    // Route snapshots from the shared socket into this scene.
    onSnapshot = applySnapshot;

    const sendInput = (): void => {
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
          ability: input.consumeAbility(),
          interact: input.consumeInteract(),
          cycle: input.consumeTargetCycle(),
        }),
      );
    };

    const renderFrame = (): void => {
      const t = Math.min(1, (performance.now() - lastSnapAt) / snapIntervalMs);
      for (const r of replicas.values()) {
        const x = r.px + (r.cx - r.px) * t;
        const z = r.pz + (r.cz - r.pz) * t;
        const groundY = field.sample(x, z);
        r.mesh.position.set(x, groundY + (r.kind === 'player' ? PLAYER_HALF : 0.4), z);
        r.mesh.rotation.y = lerpAngle(r.pyaw, r.cyaw, t);
      }
      const me = replicas.get(selfId);
      if (me) {
        camX = me.mesh.position.x;
        camZ = me.mesh.position.z;
        camY = field.sample(camX, camZ) + PLAYER_HALF;
      }
      cameraRig.update(camX, camY, camZ);
      renderer.render();
    };

    const loop = new GameLoop({ step: () => sendInput(), render: () => renderFrame() });
    loop.start();
    setStatus(`playing — WASD move · 1-6 abilities · F loot`);
    world = { stop: () => loop.stop() };
  }

  // Snapshot handler is set once the world scene exists.
  let onSnapshot: ((ents: SnapshotEntity[]) => void) | null = null;

  // ── WebSocket lifecycle ──
  function connect(): void {
    ws = new WebSocket(opts.url);
    setStatus('connecting…');
    ws.onopen = () => {
      // Auto-login when credentials were supplied; otherwise show the form.
      if (opts.user && opts.pass) {
        send({ t: 'login', protocol: PROTOCOL_VERSION, username: opts.user, password: opts.pass });
        setStatus('logging in…');
      } else {
        showLogin();
      }
    };
    ws.onclose = () => setStatus('disconnected');
    ws.onerror = () => setStatus('connection error');
    ws.onmessage = (ev: MessageEvent) => {
      const res = decodeServerMessage(typeof ev.data === 'string' ? ev.data : String(ev.data));
      if (!res.ok) return;
      const m = res.msg;
      switch (m.t) {
        case 'authOk':
          setStatus(`logged in as ${m.username}`);
          break;
        case 'charList':
          if (!autoEnter(m.chars)) showChars(m.chars);
          break;
        case 'welcome':
          startWorld(m.entityId, m.snapshotHz);
          break;
        case 'snapshot':
          onSnapshot?.(m.ents);
          break;
        case 'error':
          // A failed auto-login falls back to the register/login form.
          if (m.code === 'bad_credentials' && opts.user && opts.pass && !started) {
            send({ t: 'register', protocol: PROTOCOL_VERSION, username: opts.user, password: opts.pass });
          } else if (!started) {
            showLogin(m.message);
          } else {
            setStatus(`error: ${m.message}`);
          }
          break;
      }
    };
  }
  connect();

  return {
    stop(): void {
      world?.stop();
      ws.close();
    },
  };
}
