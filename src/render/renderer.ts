// Thin wrapper around the Three.js WebGLRenderer: owns the scene, camera, lights,
// and resize handling. Rendering is decoupled from the simulation (ADR-001).

import * as THREE from 'three';

export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene.background = new THREE.Color(0x0e1116);
    this.scene.fog = new THREE.Fog(0x0e1116, 30, 80);

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
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
