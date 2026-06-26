// Composition root for Phase 0.0.4 "First Contact": terrain + a player capsule
// (WASD, chase camera, collision) plus combat — target dummies, soft tab-targeting,
// a basic attack + one ability on the GCD, the canonical damage formula, and pooled
// floating damage numbers.

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
import { createDummySystem } from '../sim/systems/dummy';
import {
  C,
  type Transform,
  type Character,
  type Offense,
  type Defense,
  type Health,
  type AbilityState,
  type Target,
  type Targetable,
  type EnemyInfo,
  type Dummy,
} from '../core/ecs/components';
import { ABILITIES } from '../sim/combat/abilities';
import {
  CombatEvent,
  type DamageEvent,
  type DeathEvent,
  type RespawnEvent,
} from '../sim/combat/events';
import { Rng } from '../core/rng';
import { buildTerrainMesh, buildProps } from '../render/terrain-mesh';
import { PlayerView } from '../render/player-view';
import { CameraRig } from '../render/camera-rig';
import { EnemyView } from '../render/enemy-view';
import { DamageNumbers } from '../render/damage-numbers';
import { TargetFrame } from '../render/target-frame';
import { lerp, lerpAngle } from '../core/math';

const WORLD_SIZE = 100;
const WORLD_RES = 129;

const DUMMY_HALF = 0.9;
const DUMMY_HP = 120;
const DUMMY_SPOTS = [
  { x: 0, z: 5, name: 'Training Dummy' },
  { x: 4, z: 5, name: 'Training Dummy' },
  { x: -4, z: 5, name: 'Battered Dummy' },
];

export interface EnemySnapshot {
  id: number;
  name: string;
  hp: number;
  max: number;
}

export interface Game {
  readonly world: World;
  readonly renderer: Renderer;
  readonly loop: GameLoop;
  player(): { x: number; y: number; z: number; yaw: number };
  target(): number | null;
  enemies(): EnemySnapshot[];
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

  // World data (pure) + meshes (render).
  const field = generateHeightfield(WORLD_SIZE, WORLD_RES, 1337);
  const colliders = generateColliders(WORLD_SIZE, 24, 99);
  renderer.scene.add(buildTerrainMesh(field));
  const props = buildProps(colliders, field);
  renderer.scene.add(props);
  const terrain = renderer.scene.getObjectByName('terrain')!;

  const world = new World();

  // Player entity.
  const halfHeight = 0.9;
  const startY = field.sample(0, 0) + halfHeight;
  const player = world.createEntity();
  world.set<Transform>(player, C.Transform, {
    x: 0,
    y: startY,
    z: 0,
    yaw: 0,
    prevX: 0,
    prevY: startY,
    prevZ: 0,
    prevYaw: 0,
  });
  world.set(player, C.Velocity, { x: 0, y: 0, z: 0 });
  world.set<Character>(player, C.Character, {
    radius: 0.4,
    halfHeight,
    runSpeed: 6,
    sprintSpeed: 9.5,
    jumpSpeed: 7,
    grounded: true,
  });
  world.set(player, C.PlayerControlled, true);
  world.set<Health>(player, C.Health, { current: 200, max: 200 });
  world.set<Offense>(player, C.Offense, {
    primaryStat: 10,
    level: 1,
    critChance: 0.15,
    critMult: 1.5,
  });
  world.set<AbilityState>(player, C.AbilityState, {
    gcdRemaining: 0,
    cooldowns: ABILITIES.map(() => 0),
    bufferedIndex: -1,
    bufferRemaining: 0,
  });
  const playerTarget = world.set<Target>(player, C.Target, { entity: null });

  // Target dummies.
  const enemyView = new EnemyView(renderer.scene);
  const dummyIds: number[] = [];
  for (const spot of DUMMY_SPOTS) {
    const y = field.sample(spot.x, spot.z) + DUMMY_HALF;
    const e = world.createEntity();
    world.set<Transform>(e, C.Transform, {
      x: spot.x,
      y,
      z: spot.z,
      yaw: Math.atan2(-spot.x, -spot.z), // face the spawn point
      prevX: spot.x,
      prevY: y,
      prevZ: spot.z,
      prevYaw: 0,
    });
    world.set<Health>(e, C.Health, { current: DUMMY_HP, max: DUMMY_HP });
    world.set<Defense>(e, C.Defense, {
      armor: 40,
      resist: { fire: 0, frost: 0, blight: 0 },
      weakness: {},
    });
    world.set<Targetable>(e, C.Targetable, true);
    world.set<EnemyInfo>(e, C.EnemyInfo, { name: spot.name, level: 1 });
    world.set<Dummy>(e, C.Dummy, { respawnDelay: 3, deadFor: 0, dead: false });
    enemyView.add(e, spot.x, y, spot.z, DUMMY_HALF);
    dummyIds.push(e);
  }

  // Systems run in order: movement → combat → dummy upkeep.
  world.addSystem(createMovementSystem({ input, field, colliders }));
  world.addSystem(createCombatSystem({ input, rng: new Rng(0xc0ffee), colliders }));
  world.addSystem(createDummySystem());

  // Combat feedback (render/UI subscribes to sim events).
  const damageNumbers = new DamageNumbers(uiRoot);
  const targetFrame = new TargetFrame(uiRoot);
  world.events.on<DamageEvent>(CombatEvent.Damage, (ev) => {
    damageNumbers.spawn(ev.x, ev.y + 1.2, ev.z, ev.amount, ev.isCrit);
    enemyView.onHit(ev.target);
    const h = world.get<Health>(ev.target, C.Health);
    if (h) enemyView.setHealthRatio(ev.target, h.current / h.max);
  });
  world.events.on<DeathEvent>(CombatEvent.Death, (ev) => {
    enemyView.setDead(ev.entity, true);
  });
  world.events.on<RespawnEvent>(CombatEvent.Respawn, (ev) => {
    enemyView.setDead(ev.entity, false);
    enemyView.setHealthRatio(ev.entity, 1);
  });

  const playerView = new PlayerView(renderer.scene);
  const cameraRig = new CameraRig(renderer.camera, input, [terrain, props]);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  const t = world.get<Transform>(player, C.Transform)!;
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

      // Left-click select: raycast against living dummy meshes.
      const click = input.consumeClick();
      if (click) {
        pointer.set(click.ndcX, click.ndcY);
        raycaster.setFromCamera(pointer, renderer.camera);
        const hits = raycaster.intersectObjects(enemyView.pickables(), false);
        if (hits.length > 0) {
          const ent = hits[0].object.userData.entity as number | undefined;
          if (ent != null) {
            const h = world.get<Health>(ent, C.Health);
            if (h && h.current > 0) playerTarget.entity = ent;
          }
        }
      }

      const x = lerp(t.prevX, t.x, alpha);
      const y = lerp(t.prevY, t.y, alpha);
      const z = lerp(t.prevZ, t.z, alpha);
      const yaw = lerpAngle(t.prevYaw, t.yaw, alpha);
      playerView.update(x, y, z, yaw);
      cameraRig.update(x, y, z);

      enemyView.setTarget(playerTarget.entity);
      enemyView.update(renderer.camera, rdt);

      const te = playerTarget.entity;
      if (te != null && world.has(te)) {
        const info = world.get<EnemyInfo>(te, C.EnemyInfo);
        const h = world.get<Health>(te, C.Health);
        if (info && h) targetFrame.set(info.name, info.level, h.current, h.max);
        else targetFrame.clear();
      } else {
        targetFrame.clear();
      }

      renderer.render();
      damageNumbers.update(renderer.camera, window.innerWidth, window.innerHeight);
    },
    onFrame: (frameMs, steps) => {
      const state = paused ? GameState.Paused : GameState.Playing;
      const tgt = playerTarget.entity != null ? `→${playerTarget.entity}` : '—';
      const extra = `pos ${t.x.toFixed(1)}, ${t.z.toFixed(1)}   target ${tgt}   [${state}]`;
      overlay.update(frameMs, renderer.drawCalls, world.entityCount, steps, extra);
    },
  });
  loop.start();

  const game: Game = {
    world,
    renderer,
    loop,
    player: () => ({ x: t.x, y: t.y, z: t.z, yaw: t.yaw }),
    target: () => playerTarget.entity,
    enemies: () =>
      dummyIds.map((id) => {
        const h = world.get<Health>(id, C.Health)!;
        const info = world.get<EnemyInfo>(id, C.EnemyInfo)!;
        return { id, name: info.name, hp: h.current, max: h.max };
      }),
    stop: () => {
      loop.stop();
      input.dispose();
    },
  };

  (window as unknown as { __oathbound?: Game }).__oathbound = game;
  return game;
}
