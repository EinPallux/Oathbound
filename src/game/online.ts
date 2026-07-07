// Online client (M3/M4). Flow: connect → authenticate (login/register) → pick a character
// (select / create / import an offline save) → enter the world. Only the world half runs a
// scene; before that it's a small login + character panel. The server owns gameplay truth, but
// M4 hides latency: the LOCAL player is client-side predicted (its movement runs locally through
// the same sim code and is reconciled to the server's authoritative snapshots), while REMOTE
// entities are rendered from a small interpolation-delay buffer for smooth motion. Terrain is
// deterministic (same map as the server), so only entities cross the wire. Reuses the game's
// Renderer / CameraRig / Sky + terrain mesh; entity visuals are simple stand-in meshes.

import * as THREE from 'three';
import { Renderer } from '../render/renderer';
import { CameraRig } from '../render/camera-rig';
import { buildWorldScene } from '../render/world-scene';
import { PlayerView } from '../render/player-view';
import { buildEnemyModel } from '../render/enemy-models';
import { GameLoop } from '../core/loop';
import { lerpAngle } from '../core/math';
import { InputController } from '../platform/input';
import { loadKeybinds } from './keybinds';
import { loadSave } from '../platform/save-store';
import { generateHeightfield, type Heightfield, type CylinderCollider } from '../world/heightfield';
import { WORLD_SIZE, WORLD_RES, VOXEL_CUBE, VOXEL_STEP } from '../world/layout';
import { getActiveMap } from '../world/active-map';
import { buildCustomWorldData } from '../world/custom-map';
import type { BoxCollider } from '../sim/collision';
import { PLAYER_HALF } from '../sim/factory';
import { PredictedPlayer } from '../net/prediction';
import { ShadowWorld } from '../net/shadow-world';
import { Hud } from '../render/hud';
import { TargetFrame } from '../render/target-frame';
import { Minimap } from '../render/minimap';
import { DamageNumbers } from '../render/damage-numbers';
import { Nameplates, type NameplateEntry } from '../render/nameplates';
import { InventoryPanel } from '../render/inventory-panel';
import { ItemTooltip } from '../render/item-tooltip';
import type { Item, EquipSlot } from '../core/ecs/components';
import { customSceneryForMinimap } from '../world/custom-map';
import { generateScenery, type Scenery } from '../world/scenery';
import {
  PROTOCOL_VERSION,
  encode,
  decodeServerMessage,
  type SnapshotMessage,
  type CharSummary,
} from '../net/protocol';

type ClassId = 'warrior' | 'hunter' | 'priest';

interface Sample {
  t: number;
  x: number;
  z: number;
  yaw: number;
}

/** Interpolate a buffered entity's position at render time `t` (ms). */
function sampleAt(samples: Sample[], t: number): [number, number, number] {
  if (samples.length === 0) return [0, 0, 0];
  if (t <= samples[0].t) return [samples[0].x, samples[0].z, samples[0].yaw];
  const newest = samples[samples.length - 1];
  if (t >= newest.t) return [newest.x, newest.z, newest.yaw];
  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i];
    const b = samples[i + 1];
    if (t >= a.t && t <= b.t) {
      const f = (t - a.t) / (b.t - a.t || 1);
      return [a.x + (b.x - a.x) * f, a.z + (b.z - a.z) * f, lerpAngle(a.yaw, b.yaw, f)];
    }
  }
  return [newest.x, newest.z, newest.yaw];
}

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
  /** Players: the animated figure. */
  view?: PlayerView;
  /** Enemies/bosses (model root) + vendor/oathstone/loot (simple markers). */
  object?: THREE.Object3D;
  /** Model height (m) for nameplate placement. */
  top?: number;
  /** Recent authoritative samples (for interpolation-delay rendering of remote entities). */
  samples: Sample[];
  seen: number;
  name?: string;
  hp?: number;
  mhp?: number;
  cls?: string;
  lvl?: number;
  /** Last render position, for the walk-speed estimate. */
  rx?: number;
  rz?: number;
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
  if (!document.getElementById('ob-online-style')) {
    const style = document.createElement('style');
    style.id = 'ob-online-style';
    style.textContent =
      '.ob-panel button:hover{filter:brightness(1.12)}.ob-panel button:active{filter:brightness(.95)}' +
      '.ob-panel input:focus,.ob-panel select:focus{border-color:#5a9bd6;box-shadow:0 0 0 2px rgba(90,155,214,.25)}';
    document.head.appendChild(style);
  }
  const root = document.createElement('div');
  root.style.cssText =
    'position:fixed;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;' +
    'background:radial-gradient(120% 120% at 50% 0%, #12202e 0%, #0a0e14 70%);' +
    'backdrop-filter:blur(2px);font:14px/1.5 system-ui,sans-serif;color:#e8eef6';
  const body = document.createElement('div');
  body.className = 'ob-panel';
  body.style.cssText =
    'min-width:300px;max-width:380px;background:linear-gradient(#1e2836,#161e28);' +
    'border:1px solid #34506e;border-radius:14px;padding:24px;display:flex;flex-direction:column;gap:12px;' +
    'box-shadow:0 18px 60px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.05)';
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
  let stopping = false;
  let world: { stop(): void } | null = null;
  /** Teardown callbacks registered by resource-creating sites, run by stop(). */
  const cleanups: Array<() => void> = [];
  /** The pending "reconnect via reload" timer, so stop() can cancel it. */
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, css: string, text?: string): HTMLElementTagNameMap[K] => {
    const n = document.createElement(tag);
    n.style.cssText = css;
    if (text != null) n.textContent = text;
    return n;
  };
  const btnCss =
    'padding:9px 14px;border:0;border-radius:8px;background:linear-gradient(#4076ad,#325f8c);color:#fff;' +
    'font-weight:600;cursor:pointer;transition:filter .12s;box-shadow:0 2px 6px rgba(0,0,0,.35)';
  const inputCss =
    'padding:9px 10px;border-radius:8px;border:1px solid #34506e;background:#0d131b;color:#e8eef6;outline:none';

  const send = (m: unknown): void => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m));
  };

  // ── Login screen ──
  function showLogin(err?: string): void {
    panel.show();
    panel.body.replaceChildren();
    panel.body.appendChild(el('h2', 'margin:0;font-size:22px;letter-spacing:.5px;font-weight:800', 'Oathbound'));
    panel.body.appendChild(el('div', 'margin:-6px 0 6px;font-size:12px;color:#8aa0b8', 'Online — enter the realm of Aldermere'));
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
  function startWorld(selfId: number): void {
    if (started) return;
    started = true;
    panel.hide();
    const canvas = document.getElementById('game') as HTMLCanvasElement | null;
    if (!canvas) throw new Error('Oathbound: missing #game canvas');
    const renderer = new Renderer(canvas);
    const keybinds = loadKeybinds();
    const input = new InputController(canvas, keybinds);
    cleanups.push(() => input.dispose(), () => renderer.dispose());

    // Build the SAME field + colliders the server used (deterministic) so client-side prediction
    // resolves collision identically. Custom map (Talar) → full world data; else procedural.
    const map = getActiveMap();
    let field: Heightfield;
    let colliders: CylinderCollider[];
    let boxes: BoxCollider[];
    if (map) {
      const data = buildCustomWorldData(map);
      field = data.field;
      colliders = data.colliders;
      boxes = data.boxes;
    } else {
      field = generateHeightfield(WORLD_SIZE, WORLD_RES, 1337, []);
      field.voxelCube = VOXEL_CUBE;
      field.voxelStep = VOXEL_STEP;
      colliders = [];
      boxes = [];
    }
    // The full visual world (Cube-World voxel terrain, scenery, village, NPCs/critters, ambient
    // life, sky) — identical to the offline game, built from the same map/heightfield.
    const worldScene = buildWorldScene(
      renderer.scene,
      field,
      map,
      (n, f) => renderer.setFogRange(n, f),
      map ? map.playerSpawn : { x: 0, z: 0 },
    );
    // Terrain collision is analytic (heightfield); no mesh raycast, no prop obstacles online yet.
    const cameraRig = new CameraRig(renderer.camera, input, [], field);

    // Players use the real animated PlayerView figure; enemies/bosses use the low-poly
    // buildEnemyModel; only the incidental markers (vendor stall, oathstone obelisk, loot) use
    // simple meshes here.
    const mat = (hex: number): THREE.Material => new THREE.MeshLambertMaterial({ color: hex });
    const GEO = {
      marker: new THREE.CylinderGeometry(0.35, 0.35, 2.4, 8),
      box: new THREE.BoxGeometry(0.9, 1.4, 0.9),
      loot: new THREE.BoxGeometry(0.4, 0.4, 0.4),
    };
    const MAT = { vendor: mat(0xf1c40f), oathstone: mat(0x39c3d6), loot: mat(0xf5c542) };
    const buildMarker = (kind: string): THREE.Object3D => {
      if (kind === 'vendor') return new THREE.Mesh(GEO.box, MAT.vendor);
      if (kind === 'oathstone') return new THREE.Mesh(GEO.marker, MAT.oathstone);
      return new THREE.Mesh(GEO.loot, MAT.loot);
    };
    /** Free a built model's geometry + materials on despawn. */
    const disposeObject = (obj: THREE.Object3D): void => {
      obj.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mm = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mm)) mm.forEach((x) => x.dispose());
        else mm?.dispose();
      });
    };
    /** Estimate a replica's move speed (m/s) from its render-position delta, for walk animation. */
    const speedOf = (r: Replica, x: number, z: number, dt: number): number => {
      const dx = x - (r.rx ?? x);
      const dz = z - (r.rz ?? z);
      r.rx = x;
      r.rz = z;
      return dt > 0 ? Math.hypot(dx, dz) / dt : 0;
    };

    const replicas = new Map<number, Replica>();
    let snapIndex = 0;
    let seq = 0;
    let pred: PredictedPlayer | null = null;
    const INTERP_DELAY_MS = 100; // render remote entities this far in the past → smooth motion
    let camX = 0;
    let camZ = 0;
    let camY = field.sample(0, 0) + PLAYER_HALF;

    // Full HUD: reuse the entire offline UI (unit frames, ability hotbar with cooldowns, cast bar,
    // buffs, target frame, minimap, floating damage numbers), driven by a client-side shadow ECS
    // world synced from the snapshot's `self` block + replicated entities. All UI lives under one
    // root so stop() removes it in one go.
    const hudRoot = document.createElement('div');
    document.body.appendChild(hudRoot);
    cleanups.push(() => hudRoot.remove());
    const hud = new Hud(hudRoot);
    const targetFrame = new TargetFrame(hudRoot);
    const dmgNumbers = new DamageNumbers(hudRoot);
    const scenery: Scenery = map ? customSceneryForMinimap(map) : generateScenery(WORLD_SIZE, { seed: 7777 });
    const minimap = new Minimap(hudRoot, field.size, field, scenery);
    const nameplates = new Nameplates(hudRoot);
    // Inventory bag (B) + item tooltips. Equip/salvage go to the server as commands; the resulting
    // bag change comes back as an `inventory` message.
    const tooltip = new ItemTooltip(hudRoot);
    const invPanel = new InventoryPanel(hudRoot, tooltip);
    invPanel.onEquip = (item) => send({ t: 'equip', uid: item.uid });
    invPanel.onSalvage = (item) => send({ t: 'salvage', uid: item.uid });
    invPanel.onSalvageCommons = () => send({ t: 'salvageCommons' });
    let shadow: ShadowWorld | null = null;
    onInventory = (items, equipment, gold, materials, capacity): void => {
      shadow?.applyInventory(items, equipment, gold, materials, capacity);
    };

    const applySnapshot = (msg: SnapshotMessage): void => {
      const ents = msg.ents;
      const ack = msg.ack;
      snapIndex++;
      const now = performance.now();
      // Local player: reconcile prediction to the server's authoritative state (create it on the
      // first snapshot that includes us).
      const self = ents.find((e) => e.id === selfId);
      if (self) {
        if (!pred) pred = new PredictedPlayer(field, colliders, boxes, { x: self.x, z: self.z });
        else pred.reconcile(self.x, self.z, self.yaw, ack);
        // Spin up the shadow world once we know our class (from the self block).
        if (!shadow && msg.self) {
          shadow = new ShadowWorld(field, selfId, msg.self.cls, { x: self.x, z: self.z });
          if (self.name) hud.setPlayerName(self.name);
        }
      }
      // Sync HUD state + replicas into the shadow world.
      if (shadow) {
        shadow.applySnapshot(ents);
        if (msg.self) shadow.applySelf(msg.self);
      }
      // Target frame (data-driven from the self block).
      if (msg.self?.tgt) {
        const tg = msg.self.tgt;
        targetFrame.set(tg.name, tg.lvl, tg.hp, tg.mhp);
      } else {
        targetFrame.clear();
      }
      // Floating combat text.
      if (msg.fx) for (const f of msg.fx) dmgNumbers.spawn(f.x, f.y + 1.2, f.z, f.amount, f.crit, f.heal);
      for (const e of ents) {
        let r = replicas.get(e.id);
        if (!r) {
          r = { kind: e.k, samples: [], seen: snapIndex };
          if (e.k === 'player') {
            r.view = new PlayerView(renderer.scene);
          } else if (e.k === 'enemy' || e.k === 'boss') {
            const m = buildEnemyModel(e.fam ?? 'Sporelings', e.arch ?? 'melee_bruiser', e.id);
            m.root.scale.setScalar(e.k === 'boss' ? 2.0 : 1);
            renderer.scene.add(m.root);
            r.object = m.root;
            r.top = m.top * (e.k === 'boss' ? 2.0 : 1);
          } else {
            r.object = buildMarker(e.k);
            renderer.scene.add(r.object);
          }
          replicas.set(e.id, r);
        }
        r.samples.push({ t: now, x: e.x, z: e.z, yaw: e.yaw });
        if (r.samples.length > 6) r.samples.shift();
        r.seen = snapIndex;
        if (e.name) r.name = e.name;
        if (e.cls) r.cls = e.cls;
        if (e.lvl != null) r.lvl = e.lvl;
        r.hp = e.hp;
        r.mhp = e.mhp;
        if (r.object && (e.k === 'enemy' || e.k === 'boss')) r.object.visible = e.st !== 'dead';
      }
      for (const [id, r] of replicas) {
        // Never prune ourselves just because one snapshot omitted us (death / interest cull /
        // grace-window quirk) — that would make the local player vanish. Cleaned up on stop().
        if (r.seen !== snapIndex && id !== selfId) {
          if (r.view) r.view.dispose();
          if (r.object) {
            renderer.scene.remove(r.object);
            disposeObject(r.object);
          }
          replicas.delete(id);
        }
      }
    };
    // Route snapshots from the shared socket into this scene.
    onSnapshot = applySnapshot;

    // Chat overlay: a scrolling log + an input. Enter focuses/sends, Esc blurs back to the game.
    const chatWrap = document.createElement('div');
    chatWrap.style.cssText =
      'position:fixed;left:12px;bottom:44px;width:min(46vw,420px);z-index:9;display:flex;' +
      'flex-direction:column;gap:4px;font:13px/1.4 system-ui,sans-serif;pointer-events:none';
    const chatLog = document.createElement('div');
    chatLog.style.cssText = 'max-height:26vh;overflow-y:auto;display:flex;flex-direction:column;gap:2px';
    const chatInput = document.createElement('input');
    chatInput.type = 'text';
    chatInput.maxLength = 200;
    chatInput.placeholder = 'Press Enter to chat…  (/who, /me)';
    chatInput.style.cssText =
      'pointer-events:auto;padding:6px 8px;border-radius:6px;border:1px solid #33445a;' +
      'background:rgba(15,21,29,.85);color:#e8eef6;opacity:.35';
    chatWrap.append(chatLog, chatInput);
    document.body.appendChild(chatWrap);

    pushChat = (text: string, system: boolean): void => {
      const line = document.createElement('div');
      line.textContent = text;
      line.style.cssText =
        `padding:2px 8px;border-radius:5px;background:rgba(15,21,29,.6);align-self:flex-start;` +
        `max-width:100%;word-break:break-word;color:${system ? '#9fd6ff' : '#e8eef6'};` +
        (system ? 'font-style:italic' : '');
      chatLog.appendChild(line);
      while (chatLog.childElementCount > 60 && chatLog.firstChild) chatLog.removeChild(chatLog.firstChild);
      chatLog.scrollTop = chatLog.scrollHeight;
    };
    chatInput.addEventListener('focus', () => {
      chatFocused = true;
      chatInput.style.opacity = '1';
    });
    chatInput.addEventListener('blur', () => {
      chatFocused = false;
      chatInput.style.opacity = '.35';
    });
    chatInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        const text = chatInput.value.trim();
        chatInput.value = '';
        if (text) send({ t: 'chat', text }); // guarded (readyState) so a drop can't throw
        chatInput.blur();
      } else if (e.key === 'Escape') {
        chatInput.value = '';
        chatInput.blur();
      }
    });
    const onEnterChat = (e: KeyboardEvent): void => {
      if (e.key === 'Enter' && !chatFocused) {
        e.preventDefault();
        chatInput.focus();
      }
    };
    window.addEventListener('keydown', onEnterChat);
    cleanups.push(() => window.removeEventListener('keydown', onEnterChat), () => chatWrap.remove());

    const sendInput = (): void => {
      if (ws.readyState !== WebSocket.OPEN) return;
      if (input.consumeToggleMap()) minimap.toggleMap(); // M toggles the big map (client-only UI)
      if (input.consumeToggleInventory()) invPanel.toggle(); // B toggles the bag
      if (chatFocused) {
        // While typing in chat, don't drive the player — drain edge-triggers so nothing fires on
        // blur, and send a neutral (idle) input this tick.
        input.consumeJump();
        input.consumeAbility();
        input.consumeInteract();
        input.consumeTargetCycle();
        const idle = {
          t: 'input' as const,
          seq: ++seq,
          forward: false,
          back: false,
          left: false,
          right: false,
          yaw: input.yaw,
          jump: false,
          ability: null,
          interact: false,
          cycle: false,
        };
        pred?.predict(idle);
        ws.send(encode(idle));
        return;
      }
      const msg = {
        t: 'input' as const,
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
      };
      pred?.predict(msg); // move the local player immediately (reconciled against snapshots)
      ws.send(encode(msg));
    };

    let lastFrameMs = performance.now();
    const renderFrame = (alpha: number): void => {
      const nowMs = performance.now();
      const rdt = Math.min(0.1, (nowMs - lastFrameMs) / 1000);
      lastFrameMs = nowMs;
      // Remote entities: render at a fixed delay from their sample buffer (smooth under jitter).
      const renderT = nowMs - INTERP_DELAY_MS;
      for (const [id, r] of replicas) {
        if (id === selfId) continue; // the local player is drawn from prediction, below
        const [x, z, yaw] = sampleAt(r.samples, renderT);
        const gy = field.sample(x, z);
        if (r.view) {
          r.view.update(x, gy + PLAYER_HALF, z, yaw, rdt, speedOf(r, x, z, rdt), (r.cls as ClassId) ?? 'warrior', false);
          r.view.setLabel(r.name ?? 'Player', r.lvl ?? 1);
        } else if (r.object) {
          r.object.position.set(x, gy + (r.kind === 'loot' ? 0.3 : 0.4), z);
          r.object.rotation.y = yaw;
        }
      }
      // Local player: predicted, sub-tick-interpolated between the last two ticks by alpha.
      const me = replicas.get(selfId);
      if (pred && me) {
        const tr = pred.transform;
        const x = tr.prevX + (tr.x - tr.prevX) * alpha;
        const z = tr.prevZ + (tr.z - tr.prevZ) * alpha;
        camX = x;
        camZ = z;
        camY = field.sample(x, z) + PLAYER_HALF;
        const yaw = lerpAngle(tr.prevYaw, tr.yaw, alpha);
        if (me.view) {
          me.view.update(x, camY, z, yaw, rdt, speedOf(me, x, z, rdt), (me.cls as ClassId) ?? 'warrior', false);
          me.view.setLabel(me.name ?? 'Adventurer', me.lvl ?? 1);
        }
      }
      cameraRig.update(camX, camY, camZ);
      // Roam the Cube-World voxel bubble + animate scenery/village/NPCs/ambient life + sky.
      worldScene.update(rdt, renderer.camera, camX, camZ, field);
      // Reused offline HUD + minimap, driven off the shadow world (local player position from
      // prediction); floating damage numbers project through the now-positioned camera.
      if (shadow) {
        shadow.setLocalTransform(camX, camY, camZ, pred ? pred.transform.yaw : 0);
        hud.update(shadow.world, shadow.localPlayer);
        minimap.update(shadow.world, shadow.localPlayer);
        invPanel.update(shadow.world, shadow.localPlayer);
      }
      // Nameplates (name + HP bar) over living enemies/bosses; players carry their own overhead
      // name/level plate via PlayerView. Nearest first, headroom above the model.
      const plates: Array<{ e: NameplateEntry; d: number }> = [];
      for (const [id, r] of replicas) {
        if (id === selfId || !r.name || !r.object || !r.object.visible) continue;
        if (r.kind !== 'enemy' && r.kind !== 'boss') continue;
        if (r.hp != null && r.hp <= 0) continue;
        const pos = r.object.position;
        const head = pos.y + (r.top ?? 1.6) + 0.5;
        const d = (pos.x - camX) ** 2 + (pos.z - camZ) ** 2;
        plates.push({ e: { x: pos.x, y: head, z: pos.z, name: r.name, hp: r.hp ?? 1, mhp: r.mhp ?? 1, kind: r.kind }, d });
      }
      plates.sort((a, b) => a.d - b.d);
      nameplates.render(renderer.camera, window.innerWidth, window.innerHeight, plates.map((p) => p.e));
      dmgNumbers.update(renderer.camera, window.innerWidth, window.innerHeight);
      renderer.render();
    };

    const loop = new GameLoop({ step: () => sendInput(), render: (alpha) => renderFrame(alpha) });
    loop.start();
    setStatus(`playing — WASD move · 1-6 abilities · F loot`);
    world = { stop: () => loop.stop() };
  }

  // Snapshot handler is set once the world scene exists.
  let onSnapshot: ((msg: SnapshotMessage) => void) | null = null;
  // Inventory handler (bag + equipped gear), set once the world scene exists.
  let onInventory:
    | ((items: Item[], equipment: Partial<Record<EquipSlot, Item>>, gold: number, materials: number, capacity: number) => void)
    | null = null;
  // Chat overlay hooks (wired once the world scene exists).
  let pushChat: ((text: string, system: boolean) => void) | null = null;
  let chatFocused = false;

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
    ws.onclose = () => {
      if (stopping) return;
      if (started) {
        // Dropped mid-session: reload to re-enter. The server keeps our entity alive for a short
        // grace window, so re-selecting the same character resumes it in place (M4 reconnect).
        setStatus('connection lost — reconnecting…');
        reconnectTimer = setTimeout(() => location.reload(), 800);
      } else {
        setStatus('disconnected');
      }
    };
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
          startWorld(m.entityId);
          break;
        case 'snapshot':
          onSnapshot?.(m);
          break;
        case 'inventory':
          onInventory?.(
            m.items as Item[],
            m.equipment as Partial<Record<EquipSlot, Item>>,
            m.gold,
            m.materials,
            m.capacity,
          );
          break;
        case 'chatLine':
          pushChat?.(m.me ? `• ${m.from} ${m.text}` : `${m.from}: ${m.text}`, false);
          break;
        case 'system':
          pushChat?.(m.text, true);
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
      stopping = true;
      if (reconnectTimer != null) clearTimeout(reconnectTimer); // don't reload after an intentional stop
      world?.stop();
      for (const c of cleanups) {
        try {
          c();
        } catch {
          /* best-effort teardown */
        }
      }
      cleanups.length = 0;
      ws.close();
    },
  };
}
