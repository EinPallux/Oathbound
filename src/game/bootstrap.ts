// Composition root for Phase 0.2.0 "The Hunter": two classes (Warrior melee/Fury,
// Hunter ranged/Focus), a mixed Greenmarch camp (melee Bloomhusks + ranged Reavers),
// pooled projectiles, traps, class-select, XP/loot/equip/salvage, and a persisted run.

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
import { createSpatialSystem } from '../sim/systems/spatial';
import { createProjectileSystem } from '../sim/systems/projectile';
import { createTrapSystem } from '../sim/systems/trap';
import { SpatialGrid } from '../sim/spatial-grid';
import { Projectiles } from '../sim/projectiles';
import { Telemetry, createTelemetrySystem } from '../sim/telemetry';
import { createPlayer, setPlayerClass } from '../sim/factory';
import { spawnEnemy, type EnemyTemplateId, type Tier } from '../sim/content/enemies';
import { equipItem } from '../sim/inventory';
import { salvageItem, salvageAllBelow } from '../sim/salvage';
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
  type Resource,
  type PlayerClass,
  type ClassId,
} from '../core/ecs/components';
import {
  CombatEvent,
  type DamageEvent,
  type HealEvent,
  type LevelUpEvent,
  type LootPickedEvent,
  type PlayerDiedEvent,
  type ItemSalvagedEvent,
} from '../sim/combat/events';
import type { TelemetrySnapshot } from '../sim/telemetry';
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
import { ProjectileView } from '../render/projectile-view';
import { TrapView } from '../render/trap-view';
import { ClassSelect } from '../render/class-select';
import { Sfx } from '../platform/audio';
import { loadSave, writeSave } from '../platform/save-store';
import { lerp, lerpAngle } from '../core/math';

const WORLD_SIZE = 100;
const WORLD_RES = 129;

// Enemy spawns. Greenmarch (Lv 1–2) ahead of spawn; an elite anchor; Thornwood Vale
// (Lv 6–8) out to the north-east; a rare-named deep in Thornwood.
interface Spawn {
  id: EnemyTemplateId;
  x: number;
  z: number;
  level: number;
  tier?: Tier;
  name?: string;
}
const SPAWNS: Spawn[] = [
  // Greenmarch camp (+Z).
  { id: 'bloomhusk', x: 0, z: 6, level: 1 },
  { id: 'bloomhusk', x: 3, z: 9, level: 1 },
  { id: 'reaver', x: -3, z: 9, level: 1 },
  { id: 'bloomhusk', x: 6, z: 12, level: 2 },
  { id: 'wisp', x: -6, z: 12, level: 2 },
  { id: 'reaver', x: 0, z: 14, level: 2 },
  // Greenmarch elite anchor.
  { id: 'bloomhusk', x: 12, z: 18, level: 3, tier: 'elite', name: 'Bloomhusk Matriarch' },
  // Thornwood Vale (north-east): fast Weavers + Sporeling swarms + a tanky Bramblekin.
  { id: 'weaver', x: 30, z: 30, level: 6 },
  { id: 'weaver', x: 33, z: 32, level: 6 },
  { id: 'sporeling', x: 28, z: 34, level: 6 },
  { id: 'sporeling', x: 31, z: 36, level: 6 },
  { id: 'sporeling', x: 27, z: 31, level: 6 },
  { id: 'bramblekin', x: 36, z: 34, level: 7 },
  { id: 'reaver', x: 34, z: 39, level: 7 },
  // Rare-named, deep in Thornwood.
  { id: 'bramblekin', x: 41, z: 41, level: 8, tier: 'rare', name: 'Old Thornback' },
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
  materials(): number;
  bagCount(): number;
  classId(): ClassId;
  resource(): { current: number; max: number };
  telemetry(): TelemetrySnapshot;
  debugAddXp(n: number): void;
  debugSetClass(id: ClassId): void;
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
  const grid = new SpatialGrid(8);
  const projectiles = new Projectiles();
  const telemetry = new Telemetry();
  const player = createPlayer(world, field, 0, 0);
  for (const s of SPAWNS) {
    spawnEnemy(world, field, s.id, s.x, s.z, { level: s.level, tier: s.tier, name: s.name });
  }
  telemetry.attach(world, player);

  // Systems: spatial → movement → combat → enemy AI → projectiles → traps → loot → recovery → telemetry.
  world.addSystem(createSpatialSystem(grid));
  world.addSystem(createMovementSystem({ input, field, colliders }));
  world.addSystem(createCombatSystem({ input, rng, colliders, field, projectiles, grid }));
  world.addSystem(createEnemyAiSystem({ field, colliders, rng, grid, projectiles }));
  world.addSystem(createProjectileSystem(projectiles, rng));
  world.addSystem(createTrapSystem(rng));
  world.addSystem(createLootSystem({ input }));
  world.addSystem(createRecoverySystem({ field, spawnX: 0, spawnZ: 0 }));
  world.addSystem(createTelemetrySystem(telemetry));

  // Render / UI.
  const playerView = new PlayerView(renderer.scene);
  const cameraRig = new CameraRig(renderer.camera, input, [terrain, props]);
  const enemyView = new EnemyView(renderer.scene);
  const lootView = new LootView(renderer.scene);
  const projectileView = new ProjectileView(renderer.scene, projectiles);
  const trapView = new TrapView(renderer.scene);
  const damageNumbers = new DamageNumbers(uiRoot);
  const targetFrame = new TargetFrame(uiRoot);
  const hud = new Hud(uiRoot);
  const invPanel = new InventoryPanel(uiRoot);
  const classSelect = new ClassSelect(uiRoot);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  const playerTarget = world.get<Target>(player, C.Target)!;
  const playerTransform = world.get<Transform>(player, C.Transform)!;

  invPanel.onEquip = (item) => {
    equipItem(world, player, item);
    autosave();
  };
  invPanel.onSalvage = (item) => {
    if (salvageItem(world, player, item.uid)) autosave();
  };
  invPanel.onSalvageCommons = () => {
    if (salvageAllBelow(world, player, 'common') > 0) autosave();
  };
  invPanel.onToggleLock = (item) => {
    item.locked = !item.locked;
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
  world.events.on<HealEvent>(CombatEvent.Heal, (ev) => {
    damageNumbers.spawn(ev.x, ev.y + 1.2, ev.z, ev.amount, false, true);
  });
  world.events.on<LevelUpEvent>(CombatEvent.LevelUp, (ev) => {
    hud.toast(`Level ${ev.level}!`, 'good');
    sfx.levelUp();
    autosave();
  });
  world.events.on<LootPickedEvent>(CombatEvent.LootPicked, (ev) => {
    hud.toast(`Looted ${ev.item.name}`, ev.item.rarity === 'common' ? 'info' : 'rare');
    sfx.loot();
    autosave();
  });
  world.events.on<PlayerDiedEvent>(CombatEvent.PlayerDied, () => {
    hud.toast('You were defeated — respawning…');
    sfx.hurt();
  });
  world.events.on<ItemSalvagedEvent>(CombatEvent.ItemSalvaged, (ev) => {
    hud.toast(`Salvaged ${ev.itemName} (+${ev.whetstones} whetstones)`);
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
  classSelect.onChoose = (id) => {
    setPlayerClass(world, player, id);
    autosave();
  };
  void loadSave()
    .then((data) => {
      if (data) applySave(world, player, data);
      else classSelect.show(); // fresh character → pick a class
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
      projectileView.update();
      trapView.update(world);

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
      const tel = telemetry.snapshot();
      const extra =
        `Lv ${prog.level}  HP ${Math.ceil(h.current)}/${h.max}  [${state}]\n` +
        `kills ${tel.kills}  ttk ${tel.avgTtk.toFixed(1)}s  ` +
        `down ${tel.avgDowntime.toFixed(1)}s  deaths ${tel.deaths}`;
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
    materials: () => world.get<Inventory>(player, C.Inventory)!.materials,
    bagCount: () => world.get<Inventory>(player, C.Inventory)!.items.length,
    classId: () => world.get<PlayerClass>(player, C.PlayerClass)!.id,
    resource: () => {
      const r = world.get<Resource>(player, C.Resource)!;
      return { current: r.current, max: r.max };
    },
    telemetry: () => telemetry.snapshot(),
    debugAddXp: (n) => grantXp(world, player, n),
    debugSetClass: (id) => {
      setPlayerClass(world, player, id);
      classSelect.hide();
    },
    save: () => writeSave(serialize(world, player)),
    stop: () => {
      loop.stop();
      input.dispose();
      telemetry.detach();
      window.clearInterval(saveTimer);
      window.removeEventListener('beforeunload', onHide);
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };

  (window as unknown as { __oathbound?: Game }).__oathbound = game;
  return game;
}
