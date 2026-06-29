// Thin wrapper around the Three.js WebGLRenderer: owns the scene, camera, lights,
// and resize handling. Rendering is decoupled from the simulation (ADR-001).

import * as THREE from 'three';

export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;

  private maxPixelRatio = 1.5;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    // Cap the render pixel-ratio (default 1.5, not the display's native 2–3×): on hi-DPI
    // screens this is the single biggest fill-rate saving — ~45% fewer pixels shaded at 2×
    // — for a small sharpness cost the low-poly art barely shows. The Graphics quality
    // setting drives this live (Performance renders below native for the most FPS).
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.maxPixelRatio));

    // Open-world depth: distant terrain/mountains fade into haze rather than a near
    // fog wall, so the enlarged world (layout.ts) reads as a big landscape.
    this.scene.background = new THREE.Color(0x141a22);
    this.scene.fog = new THREE.Fog(0x141a22, 120, 620);

    // Far plane sits just past where fog is fully opaque (620): everything beyond is solid
    // background colour anyway, so clipping it there saves rasterising invisible distance.
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 680);
    this.camera.position.set(0, 9, 16);
    this.camera.lookAt(0, 0, 0);

    // One directional "sun" + hemisphere fill, per the lighting budget.
    const sun = new THREE.DirectionalLight(0xfff2e0, 2.2);
    sun.position.set(6, 12, 8);
    this.scene.add(sun);
    this.scene.add(new THREE.HemisphereLight(0x88aaff, 0x202820, 0.7));

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Set the render resolution cap (Graphics quality). Applied live, never above native. */
  setMaxPixelRatio(mpr: number): void {
    this.maxPixelRatio = mpr;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, mpr));
    this.resize(); // re-apply the drawing-buffer size at the new ratio
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  /** Draw calls issued on the most recent render (for the perf overlay). */
  get drawCalls(): number {
    return this.renderer.info.render.calls;
  }

  dispose(): void {
    this.renderer.dispose();
  }
}
