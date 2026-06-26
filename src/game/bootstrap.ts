// Composition root for Phase 0.1.0 "Vertical Slice": the first complete grinding loop.
// A Warrior fights a Greenmarch camp of Bloomhusks (melee AI), gains XP/levels, loots
// gear, equips upgrades, recovers, and the run persists to IndexedDB.

import * as THREE from 'three';
import { Renderer } from '../render/renderer';
import { World } from '../core/ecs/world';
import { GameLoop } from '../core/loop';
import { PerfOverlay } from '../devtools/perf-overlay';
import { GameState } from './states';
import { InputController } from '../platform/input';
import { generateHeightfield, generateColliders } from '../world/heightfield';
import { createMovementSystem } from '../sim/systems/movement';
import { createCombatSystem } from '../sim/systems/combat';
import { createEnemyAiSystem } from '../sim/systems/enemy-ai';
import { createLootSystem } from '../sim/systems/loot';
import { createRecoverySystem } from '../sim/systems/recovery';
import { createPlayer, createBloomhusk } from '../sim/factory';
import { equipItem } from '../sim/inventory';
import { grantXp } from '../sim/progression';
import { serialize, applySave } from '../sim/save';
import { conColor } from '../sim/stats';
import {
  C,
  type Transform,
  type Health,
  type Target,
  type Enemy,
  type EnemyInfo,
  type Progression,
  type Inventory,
} from '../core/ecs/components';
import {
  CombatEvent,
  type DamageEvent,
  type LevelUpEvent,
  type LootPickedEvent,
  type PlayerDiedEvent,
} from '../sim/combat/events';
import { Rng } from '../core/rng';
import { buildTerrainMesh, buildProps } from '../render/terrain-mesh';
import { PlayerView } from '../render/player-view';
import { CameraRig } from '../render/camera-rig';
import { EnemyView } from '../render/enemy-view';
import { LootView } from '../render/loot-view';
import { DamageNumbers } from '../render/damage-numbers';
import { TargetFrame } from '../render/target-frame';
import { Hud } from '../render/hud';
import { InventoryPanel } from '../render/inventory-panel';
import { Sfx } from '../platform/audio';
import { loadSave, writeSave } from '../platform/save-store';
import { lerp, lerpAngle } from '../core/math';

const WORLD_SIZE = 100;
const WORLD_RES = 129;

// A small Greenmarch camp ahead of spawn (+Z). The first is nearest.
const CAMP: { x: number; z: number; level: number }[] = [
  { x: 0, z: 6, level: 1 },
  { x: 3, z: 9, level: 1 },
  { x: -3, z: 9, level: 1 },
  { x: 6, z: 12, level: 2 },
  { x: -6, z: 12, level: 2 },
  { x: 0, z: 14, level: 2 },
];

export interface EnemySnapshot {
  id: number;
  name: string;
  hp: number;
  max: number;
  state: string;
}

export interface Game {
  readonly world: World;
  readonly renderer: Renderer;
  readonly loop: GameLoop;
  player(): { x: number; y: number; z: number; yaw: number };
  target(): number | null;
  enemies(): EnemySnapshot[];
  level(): number;
  xp(): number;
  gold(): number;
  bagCount(): number;
  debugAddXp(n: number): void;
  save(): Promise<boolean>;
  stop(): void;
}

export function boot(): Game {
  const canvas = document.getElementById('game') as HTMLCanvasElement | null;
  const uiRoot = document.getElementById('ui-root') as HTMLElement | null;
  if (!canvas || !uiRoot) {
    throw new Error('Oathbound: missing #game canvas or #ui-root element');
  }

  const renderer = new Renderer(canvas);
  const input = new InputController(canvas);
  const overlay = new PerfOverlay(uiRoot);
  const sfx = new Sfx();

  // World data (pure) + meshes (render).
  const field = generateHeightfield(WORLD_SIZE, WORLD_RES, 1337);
  const colliders = generateColliders(WORLD_SIZE, 24, 99);
  renderer.scene.add(buildTerrainMesh(field));
  const props = buildProps(colliders, field);
  renderer.scene.add(props);
  const terrain = renderer.scene.getObjectByName('terrain')!;

  // Entities.
  const world = new World();
  const rng = new Rng(0xc0ffee);
  const player = createPlayer(world, field, 0, 0);
  for (const c of CAMP) createBloomhusk(world, field, c.x, c.z, c.level);

  // Systems: movement → combat → enemy AI → loot pickup → recovery.
  world.addSystem(createMovementSystem({ input, field, colliders }));
  world.addSystem(createCombatSystem({ input, rng, colliders }));
  world.addSystem(createEnemyAiSystem({ field, colliders, rng }));
  world.addSystem(createLootSystem({ input }));
  world.addSystem(createRecoverySystem({ field, spawnX: 0, spawnZ: 0 }));

  // Render / UI.
  const playerView = new PlayerView(renderer.scene);
  const cameraRig = new CameraRig(renderer.camera, input, [terrain, props]);
  const enemyView = new EnemyView(renderer.scene);
  const lootView = new LootView(renderer.scene);
  const damageNumbers = new DamageNumbers(uiRoot);
  const targetFrame = new TargetFrame(uiRoot);
  const hud = new Hud(uiRoot);
  const invPanel = new InventoryPanel(uiRoot);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  const playerTarget = world.get<Target>(player, C.Target)!;
  const playerTransform = world.get<Transform>(player, C.Transform)!;

  invPanel.onEquip = (item) => {
    equipItem(world, player, item);
    autosave();
  };

  // Combat/loot feedback.
  world.events.on<DamageEvent>(CombatEvent.Damage, (ev) => {
    damageNumbers.spawn(ev.x, ev.y + 1.2, ev.z, ev.amount, ev.isCrit);
    if (world.get<Enemy>(ev.target, C.Enemy)) {
      enemyView.onHit(ev.target);
      if (ev.isCrit) sfx.crit();
      else sfx.hit();
    } else {
      sfx.hurt();
    }
  });
  world.events.on<LevelUpEvent>(CombatEvent.LevelUp, (ev) => {
    hud.toast(`Level ${ev.level}!`, 'good');
    sfx.levelUp();
    autosave();
  });
  world.events.on<LootPickedEvent>(CombatEvent.LootPicked, (ev) => {
    hud.toast(`Looted ${ev.item.name}`, ev.item.rarity === 'uncommon' ? 'rare' : 'info');
    sfx.loot();
    autosave();
  });
  world.events.on<PlayerDiedEvent>(CombatEvent.PlayerDied, () => {
    hud.toast('You were defeated — respawning…');
    sfx.hurt();
  });

  // Persistence: load the saved run, then autosave on key events + a timer + unload.
  let saving = false;
  function autosave(): void {
    if (saving) return;
    saving = true;
    void writeSave(serialize(world, player)).finally(() => {
      saving = false;
    });
  }
  void loadSave()
    .then((data) => {
      if (data) applySave(world, player, data);
    })
    .catch(() => {});
  const saveTimer = window.setInterval(autosave, 30_000);
  const onHide = (): void => autosave();
  const onVisibility = (): void => {
    if (document.visibilityState === 'hidden') autosave();
  };
  window.addEventListener('beforeunload', onHide);
  document.addEventListener('visibilitychange', onVisibility);

  let paused = false;
  let lastRender = performance.now();

  const loop = new GameLoop({
    step: (dt) => {
      if (input.consumePauseToggle()) paused = !paused;
      if (!paused) world.update(dt);
    },
    render: (alpha) => {
      const now = performance.now();
      const rdt = Math.min(0.1, (now - lastRender) / 1000);
      lastRender = now;

      // Toggle the inventory/character panel.
      if (input.consumeToggleInventory() || input.consumeToggleCharacter()) invPanel.toggle();

      // Left-click select.
      const click = input.consumeClick();
      if (click) {
        pointer.set(click.ndcX, click.ndcY);
        raycaster.setFromCamera(pointer, renderer.camera);
        const hits = raycaster.intersectObjects(enemyView.pickables(), false);
        if (hits.length > 0) {
          const ent = hits[0].object.userData.entity as number | undefined;
          if (ent != null && world.has(ent)) {
            const h = world.get<Health>(ent, C.Health);
            if (h && h.current > 0) playerTarget.entity = ent;
          }
        }
      }

      const t = playerTransform;
      const x = lerp(t.prevX, t.x, alpha);
      const y = lerp(t.prevY, t.y, alpha);
      const z = lerp(t.prevZ, t.z, alpha);
      const yaw = lerpAngle(t.prevYaw, t.yaw, alpha);
      playerView.update(x, y, z, yaw);
      cameraRig.update(x, y, z);

      enemyView.update(world, renderer.camera, alpha, rdt, playerTarget.entity);
      lootView.update(world);

      // Target frame (with con colour).
      const te = playerTarget.entity;
      if (te != null && world.has(te)) {
        const info = world.get<EnemyInfo>(te, C.EnemyInfo);
        const h = world.get<Health>(te, C.Health);
        const prog = world.get<Progression>(player, C.Progression);
        if (info && h && prog) {
          targetFrame.set(info.name, info.level, h.current, h.max, conColor(prog.level, info.level));
        } else {
          targetFrame.clear();
        }
      } else {
        targetFrame.clear();
      }

      hud.update(world, player);
      invPanel.update(world, player);

      renderer.render();
      damageNumbers.update(renderer.camera, window.innerWidth, window.innerHeight);
    },
    onFrame: (frameMs, steps) => {
      const state = paused ? GameState.Paused : GameState.Playing;
      const prog = world.get<Progression>(player, C.Progression)!;
      const h = world.get<Health>(player, C.Health)!;
      const extra =
        `Lv ${prog.level}  HP ${Math.ceil(h.current)}/${h.max}  ` +
        `pos ${playerTransform.x.toFixed(0)},${playerTransform.z.toFixed(0)}   [${state}]`;
      overlay.update(frameMs, renderer.drawCalls, world.entityCount, steps, extra);
    },
  });
  loop.start();

  const game: Game = {
    world,
    renderer,
    loop,
    player: () => ({ x: playerTransform.x, y: playerTransform.y, z: playerTransform.z, yaw: playerTransform.yaw }),
    target: () => playerTarget.entity,
    enemies: () => {
      const out: EnemySnapshot[] = [];
      for (const e of world.query(C.Enemy, C.Health, C.EnemyInfo)) {
        const h = world.get<Health>(e, C.Health)!;
        const info = world.get<EnemyInfo>(e, C.EnemyInfo)!;
        const en = world.get<Enemy>(e, C.Enemy)!;
        out.push({ id: e, name: info.name, hp: h.current, max: h.max, state: en.state });
      }
      return out;
    },
    level: () => world.get<Progression>(player, C.Progression)!.level,
    xp: () => world.get<Progression>(player, C.Progression)!.xp,
    gold: () => world.get<Inventory>(player, C.Inventory)!.gold,
    bagCount: () => world.get<Inventory>(player, C.Inventory)!.items.length,
    debugAddXp: (n) => grantXp(world, player, n),
    save: () => writeSave(serialize(world, player)),
    stop: () => {
      loop.stop();
      input.dispose();
      window.clearInterval(saveTimer);
      window.removeEventListener('beforeunload', onHide);
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };

  (window as unknown as { __oathbound?: Game }).__oathbound = game;
  return game;
}
