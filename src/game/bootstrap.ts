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
import { generateHeightfield, generateColliders, type Heightfield, type CylinderCollider } from '../world/heightfield';
import { WORLD_SIZE, WORLD_RES } from '../world/layout';
import { generateScenery, type Clearing, type Scenery } from '../world/scenery';
import { getActiveMap } from '../world/active-map';
import {
  buildCustomHeightfield,
  customColliders,
  customBoxColliders,
  customSpawns,
  customBosses,
  customSceneryForMinimap,
  biomeIndexAt,
} from '../world/custom-map';
import { dominantBiome } from '../world/biomes';
import {
  VILLAGE_FLAT,
  VILLAGE_CLEARING,
  villageBoxes,
  villageCylinders,
} from '../world/village';
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
import { createBossAiSystem } from '../sim/systems/boss-ai';
import { SpatialGrid } from '../sim/spatial-grid';
import { Projectiles } from '../sim/projectiles';
import { Telemetry, createTelemetrySystem } from '../sim/telemetry';
import { createPlayer, setPlayerClass, createOathstone, createVendor, PLAYER_HALF } from '../sim/factory';
import { spawnEnemy } from '../sim/content/enemies';
import { WORLD_SPAWNS } from '../sim/content/spawns';
import { spawnBoss, BOSS_SPAWNS } from '../sim/content/bosses';
import { relicEffectDesc } from '../sim/loot/relics';
import { addItem, equipItem, recomputeDerived } from '../sim/inventory';
import { generateItem } from '../sim/loot/items';
import { makeRelic } from '../sim/loot/relics';
import { salvageItem, salvageAllBelow } from '../sim/salvage';
import { reinforceItem } from '../sim/reinforce';
import { nearestVendor, sellItem, sellAllBelow } from '../sim/vendor';
import { fastTravel } from '../sim/travel';
import { regionAt, regionLabel } from '../sim/content/regions';
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
  type Rarity,
  type Oathstone,
  type AbilityState,
  type Velocity,
  type Character,
} from '../core/ecs/components';
import {
  CombatEvent,
  type DamageEvent,
  type DeathEvent,
  type HealEvent,
  type AbilityUsedEvent,
  type LevelUpEvent,
  type LootPickedEvent,
  type PlayerDiedEvent,
  type BossPhaseEvent,
  type ItemSalvagedEvent,
  type ItemSoldEvent,
  type ItemReinforcedEvent,
  type OathstoneActivatedEvent,
} from '../sim/combat/events';
import type { TelemetrySnapshot } from '../sim/telemetry';
import { Rng } from '../core/rng';
import { buildProps, terrainColorRGB, VOXEL_CUBE, VOXEL_STEP, VOXEL_VIEW } from '../render/terrain-mesh';
import { VoxelTerrain } from '../render/voxel-terrain';
import { buildScenery } from '../render/scenery-view';
import { buildCustomScenery, colorForBiome } from '../render/custom-map-view';
import { CustomNpcs } from '../render/custom-npcs';
import { CustomCritters } from '../render/custom-critters';
import { QuestLog } from './quests';
import { DialogPanel } from '../render/dialog-panel';
import { QuestTracker } from '../render/quest-tracker';
import { Sky } from '../render/sky';
import { VillageView } from '../render/village-view';
import { AmbientLife } from '../render/ambient-life';
import { PlayerView } from '../render/player-view';
import { CameraRig } from '../render/camera-rig';
import { EnemyView } from '../render/enemy-view';
import { LootView } from '../render/loot-view';
import { DamageNumbers } from '../render/damage-numbers';
import { TargetFrame } from '../render/target-frame';
import { Hud } from '../render/hud';
import { InventoryPanel } from '../render/inventory-panel';
import { CharacterPanel } from '../render/character-panel';
import { ItemTooltip } from '../render/item-tooltip';
import { ProjectileView } from '../render/projectile-view';
import { TrapView } from '../render/trap-view';
import { GroundAoeView } from '../render/ground-aoe-view';
import { InteractableView } from '../render/interactable-view';
import { VendorPanel } from '../render/vendor-panel';
import { TravelPanel } from '../render/travel-panel';
import { Minimap } from '../render/minimap';
import { ClassSelect } from '../render/class-select';
import { SettingsPanel } from '../render/settings-panel';
import { MicroBar } from '../render/micro-bar';
import { Vignette } from '../render/vignette';
import { loadSettings, saveSettings, applySettings, tierTag } from './settings';
import { loadKeybinds, saveKeybinds } from './keybinds';
import { Sfx } from '../platform/audio';
import { Music } from '../platform/music';
import { loadSave, writeSave, getActiveSlot } from '../platform/save-store';
import { getCharacterName } from '../platform/account-store';
import { lerp, lerpAngle } from '../core/math';

// World dimensions + the directional zone layout live in src/world/layout.ts so the
// sim, the region atlas, the biome field, and the renderer share one coordinate space.

// Enemy spawns live in src/sim/content/spawns.ts (pure, testable content).
const SPAWNS = WORLD_SPAWNS;

// Oathstone waypoint network (~one per region + the hub). The hub sits next to spawn so
// it auto-activates on the first tick (binding the starting respawn); the others are
// discovered by walking out to each frontier zone. Positions match the spread-out
// 0.6.0 world (layout.ts); each frontier stone also anchors a road from the hub.
interface OathstoneSpawn {
  id: string;
  name: string;
  x: number;
  z: number;
  /** Frontier stones double as road destinations from the hub. */
  road?: boolean;
}
const OATHSTONES: OathstoneSpawn[] = [
  { id: 'oathhold', name: 'Oathhold', x: 0, z: -3 }, // hub — auto-activates at spawn
  { id: 'millford', name: 'Millford Waystation', x: 35, z: 38, road: true }, // Greenmarch heartland
  { id: 'thornlodge', name: 'Thornwood Lodge', x: 158, z: 156, road: true }, // Thornwood Vale (NE)
  { id: 'fenhollow', name: 'Fenhollow Camp', x: -14, z: -182, road: true }, // Sunken Fen (south)
  { id: 'windbreak', name: 'Windbreak Outpost', x: -188, z: 8, road: true }, // Emberreach (west)
  { id: 'frostgate', name: 'Frostgate Keep', x: 176, z: 14, road: true }, // The Riven Peaks (east)
  { id: 'gravegate', name: 'Reclaimed Gatehouse', x: 6, z: 188, road: true }, // Gravereach (north)
  // Deep-frontier shrines (discovered on foot) — fast-travel hubs near each world boss.
  { id: 'emberwatch', name: 'Emberwatch Shrine', x: -256, z: 2 }, // deep Emberreach
  { id: 'frostpeak', name: 'Frostpeak Cairn', x: 230, z: 10 }, // deep Riven Peaks
  { id: 'gravecourt', name: 'Hollow Court', x: 8, z: 262 }, // deep Gravereach
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
  debugGiveItem(rarity?: Rarity): void;
  save(): Promise<boolean>;
  stop(): void;
}

export interface BootOptions {
  /** When set, start a fresh character of this class/name instead of loading a save. */
  newCharacter?: { name: string; classId: ClassId };
  /** Invoked when the player chooses "log out / character select" in-game. */
  onLogout?: () => void;
}

export function boot(options: BootOptions = {}): Game {
  const canvas = document.getElementById('game') as HTMLCanvasElement | null;
  const uiRoot = document.getElementById('ui-root') as HTMLElement | null;
  if (!canvas || !uiRoot) {
    throw new Error('Oathbound: missing #game canvas or #ui-root element');
  }

  const renderer = new Renderer(canvas);
  const keybinds = loadKeybinds();
  const input = new InputController(canvas, keybinds);
  const overlay = new PerfOverlay(uiRoot);
  const sfx = new Sfx();
  const music = new Music();

  // The active character's display name (for the unit-frame + overhead plate). Drawn from
  // the new-character choice, else the account roster for the active slot.
  const playerName =
    (options.newCharacter?.name ?? getCharacterName(getActiveSlot()) ?? 'Adventurer').trim() ||
    'Adventurer';

  // Player settings & accessibility (device-local, persisted) — applied live to the UI.
  const settings = loadSettings();
  applySettings(uiRoot, settings);
  renderer.setMaxPixelRatio(settings.maxPixelRatio);
  const applyVolume = (): void => {
    const v = settings.muteAudio ? 0 : settings.masterVolume;
    sfx.setVolume(v);
    music.setVolume(v * 0.5); // background music mixed under the SFX
  };
  applyVolume();
  input.setLook(settings.mouseSensitivity, settings.invertY);
  // Background music (optional — plays only if public/bgm.{mp3,ogg,wav} exists). Starts on
  // the enter-world gesture; if autoplay is blocked it resumes on the next interaction.
  void music.start();

  // World data (pure) + meshes (render). Boss arenas are levelled into flat shelves so the
  // giant frontier mountains/plateau don't drop a fight onto an impossible slope.
  // World data (pure) + meshes (render). A custom map (authored in the Admin Tools Map
  // Builder, selected via ?map=) replaces the procedural world *non-destructively*: with no
  // ?map=, getActiveMap() is null and the default world below is built exactly as before.
  const customMap = getActiveMap();
  let field: Heightfield;
  let colliders: CylinderCollider[];
  let scenery: Scenery;
  let props: THREE.Object3D;
  let movementBoxes = villageBoxes();
  let villageEnabled = true;
  let mapSize = WORLD_SIZE;
  const playerStart = customMap ? customMap.playerSpawn : { x: 0, z: 0 };

  if (customMap) {
    field = buildCustomHeightfield(customMap);
    const assetCols = customColliders(customMap);
    const boxCols = customBoxColliders(customMap); // building/wall footprints
    const customSceneryGroup = buildCustomScenery(customMap, field);
    renderer.scene.add(customSceneryGroup);
    // Always Cube World: the voxel bubble draws per-cube paved-stone tops, so hide the smooth
    // authoring-res paving overlay that buildCustomScenery adds.
    const smoothPaving = customSceneryGroup.getObjectByName('paving');
    if (smoothPaving) smoothPaving.visible = false;
    scenery = customSceneryForMinimap(customMap);
    props = new THREE.Group(); // custom maps add no separate collidable-rock mesh
    mapSize = customMap.size;
    if (customMap.village != null) {
      // Town included: the standard Oathhold town renders at the world origin (v1 — the
      // marker's position/rotation isn't applied yet). Keep the player spawn near origin.
      colliders = [...assetCols, ...villageCylinders()];
      movementBoxes = [...boxCols, ...villageBoxes()];
    } else {
      colliders = assetCols;
      movementBoxes = boxCols;
      villageEnabled = false;
    }
  } else {
    // Boss arenas + the starting village are levelled into flat shelves.
    const flats = [...BOSS_SPAWNS.map((b) => ({ x: b.x, z: b.z, r: 17 })), VILLAGE_FLAT];
    field = generateHeightfield(WORLD_SIZE, WORLD_RES, 1337, flats);
    // Collidable rocks (the only physical props — scenery below is purely visual). Count
    // scales with the larger world; the generator keeps them clear of the spawn.
    colliders = [...generateColliders(WORLD_SIZE, 160, 99), ...villageCylinders()];
    const rocks = buildProps(colliders, field);
    renderer.scene.add(rocks);
    props = rocks;
    // Decorative scenery (pure data → instanced meshes): trees, boulders, pebbles, bushes,
    // grass, flowers, rivers, roads — biome-aware, deterministic, no colliders. Keep large
    // props clear of camps, waypoints and the vendor so nothing covers an enemy or stall.
    const clearings: Clearing[] = [
      ...SPAWNS.map((s) => ({ x: s.x, z: s.z, r: 7 })),
      ...BOSS_SPAWNS.map((b) => ({ x: b.x, z: b.z, r: 14 })), // wide arenas for the bosses
      ...OATHSTONES.map((o) => ({ x: o.x, z: o.z, r: 9 })),
      VILLAGE_CLEARING, // keep trees/rocks out of the starting town
    ];
    const roadTargets = OATHSTONES.filter((o) => o.road).map((o) => ({ x: o.x, z: o.z }));
    scenery = generateScenery(WORLD_SIZE, { clearings, roadTargets, seed: 7777 });
    renderer.scene.add(buildScenery(scenery, field));
  }
  // Terrain — the game renders in "Cube World" style: a bubble of fine cubes that follows the
  // player (the map is too big to voxelize whole, but the fog only shows a few hundred metres, so
  // we build just the visible square and rebuild as the player roams). The heightfield's collision
  // grid is switched on to match (field.voxelCube/Step) and the fog pulled in to hide the bubble
  // edge; render + collision share field.voxelHeightAt, so the cubes you see are the cubes you
  // stand on. The smooth ground overlays (paving from buildCustomScenery) are hidden — the bubble
  // draws its own per-cube paved-stone tops.
  field.voxelCube = VOXEL_CUBE;
  field.voxelStep = VOXEL_STEP;
  renderer.setFogRange(60, VOXEL_VIEW);
  const _terrCol = new THREE.Color();
  const cm = customMap; // non-null capture for the colour closure
  const voxelColorAt: (x: number, z: number, h: number, out: [number, number, number]) => void = cm
    ? (x, z, h, out) => {
        colorForBiome(biomeIndexAt(cm, x, z), h, x, z, _terrCol);
        out[0] = _terrCol.r; out[1] = _terrCol.g; out[2] = _terrCol.b;
      }
    : terrainColorRGB;
  // Ground code per position → picks each cube's detail texture (grass/rock/grit/paved). Custom
  // maps use the painted index; the procedural world maps its dominant biome to a stand-in index.
  const groundAt: (x: number, z: number) => number = cm
    ? (x, z) => biomeIndexAt(cm, x, z)
    : (x, z) => { const b = dominantBiome(x, z); return b === 'ember' || b === 'riven' || b === 'gravereach' ? 20 : 0; };
  const voxelTerrain = new VoxelTerrain(field, voxelColorAt, VOXEL_CUBE, VOXEL_VIEW, groundAt);
  voxelTerrain.rebuildAt(playerStart.x, playerStart.z);
  renderer.scene.add(voxelTerrain.group);

  // Entities.
  const world = new World();
  const rng = new Rng(0xc0ffee);
  const grid = new SpatialGrid(8);
  const projectiles = new Projectiles();
  const telemetry = new Telemetry();
  const player = createPlayer(world, field, playerStart.x, playerStart.z);
  const spawnList = customMap ? customSpawns(customMap) : SPAWNS;
  for (const s of spawnList) {
    spawnEnemy(world, field, s.id, s.x, s.z, { level: s.level, tier: s.tier, name: s.name });
  }
  // World bosses (0.6.0 CP2): one solo boss deep in each of the three highest frontiers.
  const bossList = customMap ? customBosses(customMap) : BOSS_SPAWNS;
  for (const b of bossList) spawnBoss(world, field, b.id, b.x, b.z);
  // Oathstones (fast-travel network). For a custom map with none placed, drop a "Home"
  // stone at the spawn so the player's respawn binds and travel still works.
  const stoneList = customMap
    ? customMap.oathstones.length
      ? customMap.oathstones
      : [{ id: 'home', name: 'Home', x: playerStart.x, z: playerStart.z }]
    : OATHSTONES;
  for (const o of stoneList) createOathstone(world, field, o.id, o.name, o.x, o.z);
  // Vendor: at the town when present; otherwise just beside the player spawn so the
  // sell/buy loop works on a wilderness map.
  const vendorPos = customMap && customMap.village == null
    ? { x: playerStart.x + 3, z: playerStart.z - 3 }
    : { x: 3, z: -3 };
  createVendor(world, field, 'Quartermaster', vendorPos.x, vendorPos.z);
  telemetry.attach(world, player);

  // Systems: spatial → movement → combat → enemy AI → projectiles → traps → loot →
  // waypoint → recovery → telemetry. Waypoint runs after movement so it sees the
  // updated position, and before recovery so respawn binds to the stone just visited.
  world.addSystem(createSpatialSystem(grid));
  world.addSystem(createMovementSystem({ input, field, colliders, boxes: movementBoxes }));
  world.addSystem(createCombatSystem({ input, rng, colliders, field, projectiles, grid }));
  world.addSystem(createEnemyAiSystem({ field, colliders, rng, grid, projectiles }));
  world.addSystem(createBossAiSystem({ field }));
  world.addSystem(createProjectileSystem(projectiles, rng));
  world.addSystem(createTrapSystem(rng));
  world.addSystem(createGroundAoeSystem(rng));
  world.addSystem(createLootSystem());
  world.addSystem(createWaypointSystem());
  world.addSystem(createRecoverySystem({ field, spawnX: playerStart.x, spawnZ: playerStart.z }));
  world.addSystem(createTelemetrySystem(telemetry));

  // Render / UI.
  const sky = new Sky(renderer.scene);
  const village = villageEnabled ? new VillageView(renderer.scene, field) : null;
  const customNpcs = customMap ? new CustomNpcs(renderer.scene, field, customMap.npcs) : null;
  const customCritters = customMap ? new CustomCritters(renderer.scene, field, customMap.critters) : null;

  // Dialog + quests (custom maps only). NPCs become clickable/interactable; quest progress
  // tracks the sim's Death events and persists in the save. Rewards are granted here.
  const quests = customMap?.quests ?? [];
  const questLog = new QuestLog(quests);
  const npcName = (id: string): string => customMap?.npcs.find((n) => n.id === id)?.name ?? id;
  const dialogPanel = new DialogPanel(uiRoot);
  const questTracker = new QuestTracker(uiRoot);
  // Float "!" (quest available) / "?" (ready to turn in) markers over the right NPCs.
  const refreshQuestMarkers = (): void => {
    customMap?.npcs.forEach((n, i) => customNpcs?.setMarker(i, n.id ? questLog.markerFor(n.id) : null));
  };
  questLog.onChange = () => {
    questTracker.update(questLog, npcName);
    refreshQuestMarkers();
  };
  refreshQuestMarkers();
  function openDialog(npcIndex: number): void {
    const npc = customMap?.npcs[npcIndex];
    if (!npc || !npc.id) return;
    questLog.onTalk(npc.id);
    invPanel.close();
    charPanel.close();
    vendorPanel.close();
    travelPanel.close();
    dialogPanel.open(npc, {
      quests,
      questLog,
      npcName,
      onAccept: (qid) => {
        questLog.accept(qid);
        hud.toast(`Quest accepted: ${questLog.byId(qid)?.name ?? ''}`, 'good');
        autosave();
      },
      onTurnIn: (qid) => {
        const q = questLog.complete(qid);
        if (!q) return;
        const inv = world.get<Inventory>(player, C.Inventory);
        if (inv) inv.gold += q.reward.gold;
        if (q.reward.xp > 0) grantXp(world, player, q.reward.xp);
        const parts = [`+${q.reward.gold}g`, `+${q.reward.xp} XP`];
        const ri = q.reward.item;
        if (ri) {
          // Gear is rolled from its spec like any loot; a relic is built whole by id.
          const item = ri.kind === 'relic'
            ? makeRelic(rng, ri.relicId)
            : generateItem(rng, { slot: ri.slot, rarity: ri.rarity, ilvl: ri.ilvl, primaryStat: ri.primaryStat });
          parts.push(addItem(world, player, item) ? item.name : `${item.name} (bag full!)`);
        }
        hud.toast(`Quest complete: ${q.name}  (${parts.join(', ')})`, 'good');
        autosave();
      },
    });
  }
  const playerView = new PlayerView(renderer.scene);
  const ambientLife = new AmbientLife(renderer.scene);
  // Buildings join the camera's occlusion obstacles so the chase camera springs off walls.
  // (The voxel cube mesh is the terrain obstacle — raycast the mesh, not its wrapper group.)
  const cameraObstacles: THREE.Object3D[] = [voxelTerrain.mesh, props, ...(village ? [village.buildings] : [])];
  const cameraRig = new CameraRig(renderer.camera, input, cameraObstacles);
  const enemyView = new EnemyView(renderer.scene);
  const lootView = new LootView(renderer.scene);
  const projectileView = new ProjectileView(renderer.scene, projectiles);
  const trapView = new TrapView(renderer.scene);
  const groundAoeView = new GroundAoeView(renderer.scene);
  const interactableView = new InteractableView(renderer.scene);
  const damageNumbers = new DamageNumbers(uiRoot, settings);
  const targetFrame = new TargetFrame(uiRoot);
  const hud = new Hud(uiRoot);
  hud.setPlayerName(playerName);
  const vignette = new Vignette(uiRoot);
  const minimap = new Minimap(uiRoot, mapSize, field, scenery);
  // One shared item tooltip on <body> (outside the zoom-scaled #ui-root), used by both
  // the inventory bag and the character sheet — only one panel is open at a time.
  const itemTooltip = new ItemTooltip(document.body);
  const invPanel = new InventoryPanel(uiRoot, itemTooltip, settings);
  const charPanel = new CharacterPanel(uiRoot, itemTooltip);
  const vendorPanel = new VendorPanel(uiRoot);
  const travelPanel = new TravelPanel(uiRoot);
  const classSelect = new ClassSelect(uiRoot);
  const settingsPanel = new SettingsPanel(uiRoot, settings, keybinds);
  settingsPanel.onChange = () => {
    saveSettings(settings);
    applySettings(uiRoot, settings);
    renderer.setMaxPixelRatio(settings.maxPixelRatio);
    applyVolume();
    input.setLook(settings.mouseSensitivity, settings.invertY);
  };
  settingsPanel.onKeybindsChange = () => {
    saveKeybinds(keybinds);
    input.setKeybinds(keybinds);
  };

  // Micro-bar (bottom-right): click-to-open shortcuts mirroring the hotkeys.
  const microBar = new MicroBar(uiRoot);
  microBar.onInventory = () => {
    charPanel.close();
    vendorPanel.close();
    travelPanel.close();
    invPanel.toggle();
  };
  microBar.onCharacter = () => {
    invPanel.close();
    vendorPanel.close();
    travelPanel.close();
    charPanel.toggle();
  };
  microBar.onTravel = () => {
    invPanel.close();
    charPanel.close();
    vendorPanel.close();
    travelPanel.toggle();
  };
  microBar.onMap = () => minimap.toggleMap();
  microBar.onSettings = () => settingsPanel.toggle();
  microBar.onFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void document.documentElement.requestFullscreen().catch(() => {});
  };
  microBar.onLogout = () => options.onLogout?.();

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
  invPanel.onSettings = () => settingsPanel.toggle();

  charPanel.onReinforce = (item) => {
    if (reinforceItem(world, player, item.uid)) autosave();
  };
  charPanel.onChooseTalent = (nodeId, option) => {
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
  // Play the player-model swing/draw/cast motion when an ability fires.
  world.events.on<AbilityUsedEvent>(CombatEvent.AbilityUsed, (ev) => {
    if (ev.entity === player) playerView.triggerAction(ev.targeting, ev.castTime);
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
    const r = ev.item.rarity;
    // Lead with a colour-independent tier tag so rarity reads without relying on colour.
    hud.toast(`${tierTag(r)} Looted ${ev.item.name}`, r === 'common' || r === 'uncommon' ? 'info' : r);
    if (ev.item.relic) hud.toast(relicEffectDesc(ev.item.relic), 'relic'); // apex: show its effect
    sfx.loot();
    autosave();
  });
  world.events.on<PlayerDiedEvent>(CombatEvent.PlayerDied, () => {
    hud.toast('You were defeated — respawning…');
    sfx.hurt();
  });
  world.events.on(CombatEvent.Death, () => sfx.death()); // enemy slain — a short thud
  world.events.on<BossPhaseEvent>(CombatEvent.BossPhase, (ev) => {
    hud.toast(`${ev.name} — Phase ${ev.phase}/${ev.totalPhases}!`, 'epic');
    sfx.crit();
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
  // Quest kill-objective tracking: read the dead enemy's template id (still on the entity
  // when the Death event fires) and advance any matching active kill quests.
  world.events.on<DeathEvent>(CombatEvent.Death, (ev) => {
    const tmpl = world.get<Enemy>(ev.entity, C.Enemy)?.template;
    if (tmpl) questLog.onKill(tmpl);
  });

  // Persistence: load the saved run, then autosave on key events + a timer + unload.
  // `loaded` gates autosave so the first-tick Oathstone attune doesn't write a default
  // snapshot over the real save before loadSave's read resolves.
  let saving = false;
  let loaded = false;
  function autosave(): void {
    if (saving || !loaded) return;
    saving = true;
    const data = serialize(world, player);
    data.quests = questLog.toSave();
    void writeSave(data).finally(() => {
      saving = false;
    });
  }
  classSelect.onChoose = (id) => {
    setPlayerClass(world, player, id);
    autosave();
  };
  void loadSave()
    .then((data) => {
      if (options.newCharacter) {
        // Brand-new character: the player entity was just created at defaults, so we only
        // need to apply the chosen class. Its first save is written in finally() below so
        // the character slot immediately shows as occupied on the select screen.
        setPlayerClass(world, player, options.newCharacter.classId);
      } else if (data) {
        applySave(world, player, data);
        questLog.load(data.quests);
      } else {
        classSelect.show(); // legacy/fallback: no save and no chosen class → pick one
      }
    })
    .catch(() => {})
    .finally(() => {
      loaded = true;
      if (options.newCharacter) autosave();
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

      // Keep the cube bubble centred on the player (rebuilds only when they've drifted far
      // enough, so most frames this is a cheap distance check).
      voxelTerrain.update(playerTransform.x, playerTransform.z);

      // Centre panels are mutually exclusive (inventory / character / vendor / travel).
      if (input.consumeToggleInventory()) {
        charPanel.close();
        vendorPanel.close();
        travelPanel.close();
        invPanel.toggle();
      }
      if (input.consumeToggleCharacter()) {
        invPanel.close();
        vendorPanel.close();
        travelPanel.close();
        charPanel.toggle();
      }
      if (input.consumeToggleTravel()) {
        invPanel.close();
        charPanel.close();
        vendorPanel.close();
        travelPanel.toggle();
      }
      if (input.consumeToggleMap()) minimap.toggleMap();
      if (input.consumeToggleSettings()) settingsPanel.toggle();
      // Esc, layered: close the topmost panel → else clear the target → else open the menu.
      if (input.consumeEscape()) {
        if (dialogPanel.isOpen) dialogPanel.close();
        else if (settingsPanel.isOpen) settingsPanel.close();
        else if (invPanel.isOpen) invPanel.close();
        else if (charPanel.isOpen) charPanel.close();
        else if (vendorPanel.isOpen) vendorPanel.close();
        else if (travelPanel.isOpen) travelPanel.close();
        else if (minimap.isMapOpen) minimap.closeMap();
        else if (playerTarget.entity != null) playerTarget.entity = null;
        else settingsPanel.open();
      }
      // F interact: close an open vendor panel, else grab nearby loot, else open the
      // vendor panel when standing by a vendor. (Centralized interact key.)
      if (input.consumeInteract()) {
        if (dialogPanel.isOpen) {
          dialogPanel.close();
        } else if (vendorPanel.isOpen) {
          vendorPanel.close();
        } else if (!pickUpNearest(world) && nearestVendor(world, player) != null) {
          invPanel.close();
          charPanel.close();
          travelPanel.close();
          vendorPanel.open();
        } else {
          const ni = customNpcs?.nearest(playerTransform.x, playerTransform.z, 3.6) ?? null;
          if (ni != null) openDialog(ni);
        }
      }
      // Auto-close the vendor panel once you walk away from the stall.
      if (vendorPanel.isOpen && nearestVendor(world, player) == null) vendorPanel.close();

      // Left-click select.
      const click = input.consumeClick();
      if (click) {
        pointer.set(click.ndcX, click.ndcY);
        raycaster.setFromCamera(pointer, renderer.camera);
        // Click an NPC → talk; otherwise click an enemy → target it.
        const npcHit = customNpcs?.pick(raycaster) ?? null;
        if (npcHit != null) {
          openDialog(npcHit);
        } else {
          const hits = raycaster.intersectObjects(enemyView.pickables(), false);
          if (hits.length > 0) {
            const ent = hits[0].object.userData.entity as number | undefined;
            if (ent != null && world.has(ent)) {
              const h = world.get<Health>(ent, C.Health);
              if (h && h.current > 0) playerTarget.entity = ent;
            }
          }
        }
      }

      const t = playerTransform;
      const x = lerp(t.prevX, t.x, alpha);
      const y = lerp(t.prevY, t.y, alpha);
      const z = lerp(t.prevZ, t.z, alpha);
      const yaw = lerpAngle(t.prevYaw, t.yaw, alpha);
      const pv = world.get<Velocity>(player, C.Velocity)!;
      const speed = Math.hypot(pv.x, pv.z);
      const pcId = world.get<PlayerClass>(player, C.PlayerClass)?.id ?? 'warrior';
      const mounted = world.get<Character>(player, C.Character)?.mounted ?? false;
      playerView.setLabel(playerName, world.get<Progression>(player, C.Progression)?.level ?? 1);
      playerView.update(x, y, z, yaw, rdt, speed, pcId, mounted);
      ambientLife.update(rdt, x, z, field);
      village?.update(rdt);
      customNpcs?.update(rdt);
      customCritters?.update(rdt);
      cameraRig.update(x, y, z);
      sky.update(renderer.camera, rdt);

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
      const phv = world.get<Health>(player, C.Health)!;
      vignette.update(phv.max > 0 ? phv.current / phv.max : 0, settings.reducedEffects);
      invPanel.update(world, player);
      charPanel.update(world, player);
      vendorPanel.update(world, player);
      travelPanel.update(world, player);

      minimap.update(world, player);

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
    debugGiveItem: (rarity = 'rare') => {
      const prog = world.get<Progression>(player, C.Progression)!;
      const cls = getClass(world.get<PlayerClass>(player, C.PlayerClass)?.id ?? 'warrior');
      const primary = cls.primaryStatId === 'VIT' ? 'STR' : cls.primaryStatId;
      addItem(world, player, generateItem(rng, { ilvl: prog.level, slot: 'weapon', rarity, primaryStat: primary }));
    },
    save: () => writeSave(serialize(world, player)),
    stop: () => {
      loop.stop();
      input.dispose();
      music.stop();
      telemetry.detach();
      window.clearInterval(saveTimer);
      window.removeEventListener('beforeunload', onHide);
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };

  (window as unknown as { __oathbound?: Game }).__oathbound = game;
  return game;
}
