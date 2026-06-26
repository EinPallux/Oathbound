// Composition root for Phase 0.0.3 "Greybox Movement": terrain + a player capsule
// driven by WASD, a third-person chase camera, collision, and ground-snap.

import { Renderer } from '../render/renderer';
import { World } from '../core/ecs/world';
import { GameLoop } from '../core/loop';
import { PerfOverlay } from '../devtools/perf-overlay';
import { GameState } from './states';
import { InputController } from '../platform/input';
import { generateHeightfield, generateColliders } from '../world/heightfield';
import { createMovementSystem } from '../sim/systems/movement';
import { C, type Transform, type Character } from '../core/ecs/components';
import { buildTerrainMesh, buildProps } from '../render/terrain-mesh';
import { PlayerView } from '../render/player-view';
import { CameraRig } from '../render/camera-rig';
import { lerp, lerpAngle } from '../core/math';

const WORLD_SIZE = 100;
const WORLD_RES = 129;

export interface Game {
  readonly world: World;
  readonly renderer: Renderer;
  readonly loop: GameLoop;
  player(): { x: number; y: number; z: number; yaw: number };
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

  // Player entity.
  const world = new World();
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
  world.addSystem(createMovementSystem({ input, field, colliders }));

  const playerView = new PlayerView(renderer.scene);
  const cameraRig = new CameraRig(renderer.camera, input, [terrain, props]);

  const t = world.get<Transform>(player, C.Transform)!;
  let paused = false;

  const loop = new GameLoop({
    step: (dt) => {
      if (input.consumePauseToggle()) paused = !paused;
      if (!paused) world.update(dt);
    },
    render: (alpha) => {
      const x = lerp(t.prevX, t.x, alpha);
      const y = lerp(t.prevY, t.y, alpha);
      const z = lerp(t.prevZ, t.z, alpha);
      const yaw = lerpAngle(t.prevYaw, t.yaw, alpha);
      playerView.update(x, y, z, yaw);
      cameraRig.update(x, y, z);
      renderer.render();
    },
    onFrame: (frameMs, steps) => {
      const state = paused ? GameState.Paused : GameState.Playing;
      const extra = `pos ${t.x.toFixed(1)}, ${t.z.toFixed(1)}   [${state}]`;
      overlay.update(frameMs, renderer.drawCalls, world.entityCount, steps, extra);
    },
  });
  loop.start();

  const game: Game = {
    world,
    renderer,
    loop,
    player: () => ({ x: t.x, y: t.y, z: t.z, yaw: t.yaw }),
    stop: () => {
      loop.stop();
      input.dispose();
    },
  };

  (window as unknown as { __oathbound?: Game }).__oathbound = game;
  return game;
}
