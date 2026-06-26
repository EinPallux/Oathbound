// Wires the scaffold together: renderer + ECS world + demo scene + perf overlay,
// driven by the fixed-timestep loop. This is the composition root.

import { Renderer } from '../render/renderer';
import { DemoScene } from '../render/demo-scene';
import { World } from '../core/ecs/world';
import { GameLoop } from '../core/loop';
import { PerfOverlay } from '../devtools/perf-overlay';
import { SpinSystem } from '../sim/systems/spin';
import { GameState } from './states';

export interface Game {
  readonly world: World;
  readonly renderer: Renderer;
  readonly loop: GameLoop;
  stop(): void;
}

export function boot(): Game {
  const canvas = document.getElementById('game') as HTMLCanvasElement | null;
  const uiRoot = document.getElementById('ui-root') as HTMLElement | null;
  if (!canvas || !uiRoot) {
    throw new Error('Oathbound: missing #game canvas or #ui-root element');
  }

  const renderer = new Renderer(canvas);
  const world = new World();
  world.addSystem(SpinSystem);

  const demo = new DemoScene(world, renderer.scene, 144);
  const overlay = new PerfOverlay(uiRoot);

  const state: GameState = GameState.Playing;

  const loop = new GameLoop({
    step: (dt) => {
      if (state === GameState.Playing) world.update(dt);
    },
    render: (alpha) => {
      demo.sync(world, alpha);
      renderer.render();
    },
    onFrame: (frameMs, steps) => {
      overlay.update(frameMs, renderer.drawCalls, world.entityCount, steps);
    },
  });
  loop.start();

  const game: Game = {
    world,
    renderer,
    loop,
    stop: () => loop.stop(),
  };

  // Debug/e2e hook (dev only).
  (window as unknown as { __oathbound?: Game }).__oathbound = game;
  return game;
}
