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

    // Open-world depth: distant terrain/mountains fade into the sky's horizon haze (the
    // colour is kept in sync with the sky dome's horizon in sky.ts), so the enlarged world
    // reads as a big landscape under an open sky rather than ending at a dark fog wall.
    this.scene.background = new THREE.Color(0xc4ddf3);
    this.scene.fog = new THREE.Fog(0xc4ddf3, 150, 640);

    // Far plane sits just past where fog is fully opaque (620): everything beyond is solid
    // background colour anyway, so clipping it there saves rasterising invisible distance.
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 680);
    this.camera.position.set(0, 9, 16);
    this.camera.lookAt(0, 0, 0);

    // One directional "sun" + hemisphere fill, per the lighting budget. The hemisphere
    // sky tint matches the new sky dome so ambient bounce reads as open-sky daylight.
    const sun = new THREE.DirectionalLight(0xfff2e0, 2.2);
    sun.position.set(6, 12, 8);
    this.scene.add(sun);
    this.scene.add(new THREE.HemisphereLight(0xaecdf0, 0x222a20, 0.8));

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

  /** Adjust the distance fog. Voxel mode pulls it in so the cube bubble's edge is hidden. */
  setFogRange(near: number, far: number): void {
    const fog = this.scene.fog as THREE.Fog | null;
    if (fog) {
      fog.near = near;
      fog.far = far;
    }
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
