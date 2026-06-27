// Composition root for Phase 0.3.0 "First Ten Levels": three classes, the Greenmarch +
// Thornwood Vale regions with enemy tiers/rares, the full grind loop (XP/loot/equip/
// salvage), and — this checkpoint — the Oathstone network: waypoints that activate on
// proximity, bind your respawn, fast-travel for a toll (T), plus vendors to sell to (F).

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
import { createLootSystem, pickUpNearest } from '../sim/systems/loot';
import { createRecoverySystem } from '../sim/systems/recovery';
import { createWaypointSystem } from '../sim/systems/waypoint';
import { createSpatialSystem } from '../sim/systems/spatial';
import { createProjectileSystem } from '../sim/systems/projectile';
import { createTrapSystem } from '../sim/systems/trap';
import { createGroundAoeSystem } from '../sim/systems/ground-aoe';
import { SpatialGrid } from '../sim/spatial-grid';
import { Projectiles } from '../sim/projectiles';
import { Telemetry, createTelemetrySystem } from '../sim/telemetry';
import { createPlayer, setPlayerClass, createOathstone, createVendor, PLAYER_HALF } from '../sim/factory';
import { spawnEnemy } from '../sim/content/enemies';
import { WORLD_SPAWNS } from '../sim/content/spawns';
import { equipItem, recomputeDerived } from '../sim/inventory';
import { salvageItem, salvageAllBelow } from '../sim/salvage';
import { reinforceItem } from '../sim/reinforce';
import { nearestVendor, sellItem, sellAllBelow } from '../sim/vendor';
import { fastTravel } from '../sim/travel';
import { regionAt, regionLabel } from '../sim/content/regions';
import { Onboarding } from '../sim/onboarding';
import { getClass, CAPSTONE_LEVEL } from '../sim/classes';
import { grantXp } from '../sim/progression';
import { serialize, applySave } from '../sim/save';
import { conColor, xpToNext } from '../sim/stats';
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
  type Oathstone,
  type AbilityState,
} from '../core/ecs/components';
import {
  CombatEvent,
  type DamageEvent,
  type HealEvent,
  type LevelUpEvent,
  type LootPickedEvent,
  type PlayerDiedEvent,
  type ItemSalvagedEvent,
  type ItemSoldEvent,
  type ItemReinforcedEvent,
  type OathstoneActivatedEvent,
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
import { GroundAoeView } from '../render/ground-aoe-view';
import { InteractableView } from '../render/interactable-view';
import { VendorPanel } from '../render/vendor-panel';
import { TravelPanel } from '../render/travel-panel';
import { GoalTracker } from '../render/goal-tracker';
import { Minimap } from '../render/minimap';
import { ClassSelect } from '../render/class-select';
import { Sfx } from '../platform/audio';
import { loadSave, writeSave } from '../platform/save-store';
import { lerp, lerpAngle } from '../core/math';

const WORLD_SIZE = 100;
const WORLD_RES = 129;

// Enemy spawns live in src/sim/content/spawns.ts (pure, testable content).
const SPAWNS = WORLD_SPAWNS;

// Oathstone waypoint network (~one per region + the hub). The hub sits next to spawn
// so it auto-activates on the first tick (binding the starting respawn); the others are
// discovered by walking. Vendor row at the hub.
interface OathstoneSpawn {
  id: string;
  name: string;
  x: number;
  z: number;
}
const OATHSTONES: OathstoneSpawn[] = [
  { id: 'oathhold', name: 'Oathhold', x: 0, z: -3 }, // hub — auto-activates at spawn
  { id: 'millford', name: 'Millford Waystation', x: 14, z: 16 }, // Greenmarch
  { id: 'thornlodge', name: 'Thornwood Lodge', x: 30, z: 28 }, // Thornwood Vale
  { id: 'fenhollow', name: 'Fenhollow Camp', x: 0, z: -24 }, // Sunken Fen (south)
  { id: 'windbreak', name: 'Windbreak Outpost', x: -24, z: 2 }, // Emberreach (west)
  { id: 'frostgate', name: 'Frostgate Keep', x: 24, z: 2 }, // The Riven Peaks (east)
  { id: 'gravegate', name: 'Reclaimed Gatehouse', x: 0, z: 24 }, // Gravereach (north)
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
  oathstones(): { name: string; activated: boolean }[];
  telemetry(): TelemetrySnapshot;
  debugAddXp(n: number): void;
  debugSetLevel(n: number): void;
  debugTeleport(x: number, z: number): void;
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
  for (const o of OATHSTONES) createOathstone(world, field, o.id, o.name, o.x, o.z);
  createVendor(world, field, 'Quartermaster', 3, -3);
  telemetry.attach(world, player);

  // Onboarding: the "teach the loop" checklist. Returning players (flagged in
  // localStorage) skip it. Completion is persisted in the render loop.
  const onboarding = new Onboarding();
  onboarding.attach(world, player);
  let onboardingSaved = false;
  try {
    if (localStorage.getItem('oathbound.onboarded')) {
      onboarding.skip();
      onboardingSaved = true;
    }
  } catch {
    // localStorage unavailable → the tutorial simply shows.
  }

  // Systems: spatial → movement → combat → enemy AI → projectiles → traps → loot →
  // waypoint → recovery → telemetry. Waypoint runs after movement so it sees the
  // updated position, and before recovery so respawn binds to the stone just visited.
  world.addSystem(createSpatialSystem(grid));
  world.addSystem(createMovementSystem({ input, field, colliders }));
  world.addSystem(createCombatSystem({ input, rng, colliders, field, projectiles, grid }));
  world.addSystem(createEnemyAiSystem({ field, colliders, rng, grid, projectiles }));
  world.addSystem(createProjectileSystem(projectiles, rng));
  world.addSystem(createTrapSystem(rng));
  world.addSystem(createGroundAoeSystem(rng));
  world.addSystem(createLootSystem());
  world.addSystem(createWaypointSystem());
  world.addSystem(createRecoverySystem({ field, spawnX: 0, spawnZ: 0 }));
  world.addSystem(createTelemetrySystem(telemetry));

  // Render / UI.
  const playerView = new PlayerView(renderer.scene);
  const cameraRig = new CameraRig(renderer.camera, input, [terrain, props]);
  const enemyView = new EnemyView(renderer.scene);
  const lootView = new LootView(renderer.scene);
  const projectileView = new ProjectileView(renderer.scene, projectiles);
  const trapView = new TrapView(renderer.scene);
  const groundAoeView = new GroundAoeView(renderer.scene);
  const interactableView = new InteractableView(renderer.scene);
  const damageNumbers = new DamageNumbers(uiRoot);
  const targetFrame = new TargetFrame(uiRoot);
  const hud = new Hud(uiRoot);
  const goalTracker = new GoalTracker(uiRoot);
  const minimap = new Minimap(uiRoot, WORLD_SIZE);
  const invPanel = new InventoryPanel(uiRoot);
  const vendorPanel = new VendorPanel(uiRoot);
  const travelPanel = new TravelPanel(uiRoot);
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
  invPanel.onReinforce = (item) => {
    if (reinforceItem(world, player, item.uid)) autosave();
  };
  invPanel.onChooseTalent = (nodeId, option) => {
    const pc = world.get<PlayerClass>(player, C.PlayerClass);
    if (!pc) return;
    if (!pc.choices) pc.choices = {};
    pc.choices[nodeId] = option;
    // Reset the swapped slot's cooldown so the new pick is ready to use.
    const cls = getClass(pc.id);
    const nodeIdx = cls.choiceNodes.findIndex((n) => n.id === nodeId);
    const ab = world.get<AbilityState>(player, C.AbilityState);
    if (nodeIdx >= 0 && ab) ab.cooldowns[cls.abilities.length + nodeIdx] = 0;
    autosave();
  };

  vendorPanel.onSell = (item) => {
    if (sellItem(world, player, item.uid)) autosave();
  };
  vendorPanel.onSellCommons = () => {
    if (sellAllBelow(world, player, 'common') > 0) autosave();
  };
  travelPanel.onTravel = (dest) => {
    const res = fastTravel(world, player, dest, field);
    if (res.ok) {
      travelPanel.close();
      hud.toast(`Travelled to ${res.name} (−${res.cost} g)`);
      sfx.loot();
      autosave();
    } else {
      hud.toast(
        res.reason === 'combat'
          ? 'Cannot travel while in combat'
          : res.reason === 'gold'
            ? 'Not enough gold for the toll'
            : 'Cannot travel there',
      );
    }
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
    if (ev.level === CAPSTONE_LEVEL) {
      const cap = getClass(world.get<PlayerClass>(player, C.PlayerClass)?.id ?? 'warrior').capstone;
      hud.toast(`Capstone unlocked — ${cap.name}: ${cap.desc}`, 'good');
    }
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
  world.events.on<ItemSoldEvent>(CombatEvent.ItemSold, (ev) => {
    hud.toast(`Sold ${ev.itemName} (+${ev.gold} g)`);
    sfx.loot();
  });
  world.events.on<ItemReinforcedEvent>(CombatEvent.ItemReinforced, (ev) => {
    hud.toast(`Reinforced ${ev.itemName} → +${ev.level}`, 'good');
    sfx.levelUp();
  });
  world.events.on<OathstoneActivatedEvent>(CombatEvent.OathstoneActivated, (ev) => {
    hud.toast(`Oathstone attuned — ${ev.name}`, 'good');
    sfx.levelUp();
    autosave();
  });

  // Persistence: load the saved run, then autosave on key events + a timer + unload.
  // `loaded` gates autosave so the first-tick Oathstone attune doesn't write a default
  // snapshot over the real save before loadSave's read resolves.
  let saving = false;
  let loaded = false;
  function autosave(): void {
    if (saving || !loaded) return;
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
    .catch(() => {})
    .finally(() => {
      loaded = true;
    });
  const saveTimer = window.setInterval(autosave, 30_000);
  const onHide = (): void => autosave();
  const onVisibility = (): void => {
    if (document.visibilityState === 'hidden') autosave();
  };
  window.addEventListener('beforeunload', onHide);
  document.addEventListener('visibilitychange', onVisibility);

  let paused = false;
  let lastRender = performance.now();
  let lastRegionId = '';

  const loop = new GameLoop({
    step: (dt) => {
      if (input.consumePauseToggle()) paused = !paused;
      if (!paused) world.update(dt);
    },
    render: (alpha) => {
      const now = performance.now();
      const rdt = Math.min(0.1, (now - lastRender) / 1000);
      lastRender = now;

      // Centre panels are mutually exclusive (inventory / vendor / travel).
      if (input.consumeToggleInventory() || input.consumeToggleCharacter()) {
        vendorPanel.close();
        travelPanel.close();
        invPanel.toggle();
      }
      if (input.consumeToggleTravel()) {
        if (invPanel.isOpen) invPanel.toggle();
        vendorPanel.close();
        travelPanel.toggle();
      }
      if (input.consumeToggleMap()) minimap.toggleMap();
      // F interact: close an open vendor panel, else grab nearby loot, else open the
      // vendor panel when standing by a vendor. (Centralized interact key.)
      if (input.consumeInteract()) {
        if (vendorPanel.isOpen) {
          vendorPanel.close();
        } else if (!pickUpNearest(world) && nearestVendor(world, player) != null) {
          if (invPanel.isOpen) invPanel.toggle();
          travelPanel.close();
          vendorPanel.open();
        }
      }
      // Auto-close the vendor panel once you walk away from the stall.
      if (vendorPanel.isOpen && nearestVendor(world, player) == null) vendorPanel.close();

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
      groundAoeView.update(world);
      interactableView.update(world);

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
      vendorPanel.update(world, player);
      travelPanel.update(world, player);

      // Onboarding + Goal Tracker + minimap.
      onboarding.update(world, player);
      goalTracker.update(world, player, onboarding);
      minimap.update(world, player);
      if (onboarding.isComplete && !onboardingSaved) {
        onboardingSaved = true;
        try {
          localStorage.setItem('oathbound.onboarded', '1');
        } catch {
          // ignore — persistence is best-effort
        }
      }

      // Zone-discovery prompt on crossing a region boundary.
      const region = regionAt(playerTransform.x, playerTransform.z);
      if (region.id !== lastRegionId) {
        if (lastRegionId !== '') hud.toast(`Entering ${regionLabel(region)}`);
        lastRegionId = region.id;
      }

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
    oathstones: () => {
      const out: { name: string; activated: boolean }[] = [];
      for (const e of world.query(C.Oathstone)) {
        const os = world.get<Oathstone>(e, C.Oathstone)!;
        out.push({ name: os.name, activated: os.activated });
      }
      return out;
    },
    telemetry: () => telemetry.snapshot(),
    debugAddXp: (n) => grantXp(world, player, n),
    debugSetLevel: (n) => {
      const prog = world.get<Progression>(player, C.Progression)!;
      prog.level = Math.max(1, Math.floor(n));
      prog.xp = 0;
      prog.xpToNext = xpToNext(prog.level);
      recomputeDerived(world, player);
      const h = world.get<Health>(player, C.Health)!;
      h.current = h.max;
    },
    debugTeleport: (x, z) => {
      playerTransform.x = x;
      playerTransform.z = z;
      playerTransform.y = field.sample(x, z) + PLAYER_HALF;
      playerTransform.prevX = x;
      playerTransform.prevY = playerTransform.y;
      playerTransform.prevZ = z;
    },
    debugSetClass: (id) => {
      setPlayerClass(world, player, id);
      classSelect.hide();
    },
    save: () => writeSave(serialize(world, player)),
    stop: () => {
      loop.stop();
      input.dispose();
      telemetry.detach();
      onboarding.detach();
      window.clearInterval(saveTimer);
      window.removeEventListener('beforeunload', onHide);
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };

  (window as unknown as { __oathbound?: Game }).__oathbound = game;
  return game;
}
