// A beautiful daytime sky to replace the flat background. Three layers, all procedural
// (no texture assets — canvas-drawn), centred on the camera so it reads as infinitely far:
//   1. a gradient atmosphere dome (horizon → mid → zenith) with a warm sun halo baked in;
//   2. a bright sun disc with a soft additive bloom;
//   3. drifting puffy clouds (soft, volume-shaded canvas sprites) crossing the sky.
// Render-only; the simulation never sees it. The horizon colour matches the scene fog
// (set in renderer.ts) so distant terrain melts seamlessly into the sky.

import * as THREE from 'three';

const DOME_R = 600; // < camera far (680); the dome follows the camera each frame

// Visual sun direction. Sits much lower than the scene's directional "sun" light (6,12,8)
// so the disc sits in the sky band the third-person camera actually frames (it mostly
// looks toward the horizon); both point the same way (south-east), which reads naturally
// on the low-poly art.
export const SUN_DIR = new THREE.Vector3(6, 4, 9).normalize();

// Palette (the horizon colour is mirrored by the fog in renderer.ts).
const ZENITH = new THREE.Color(0x2b6fd6);
const MID = new THREE.Color(0x6ea3e0);
const HORIZON = new THREE.Color(0xc4ddf3);
const HAZE = new THREE.Color(0xeaf3fb);
const SUN_COL = new THREE.Color(0xfff2d0);

function domeMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    uniforms: {
      uZenith: { value: ZENITH.clone() },
      uMid: { value: MID.clone() },
      uHorizon: { value: HORIZON.clone() },
      uHaze: { value: HAZE.clone() },
      uSunColor: { value: SUN_COL.clone() },
      uSunDir: { value: SUN_DIR.clone() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      uniform vec3 uZenith, uMid, uHorizon, uHaze, uSunColor, uSunDir;
      void main() {
        float h = vDir.y;
        float t = clamp(h, 0.0, 1.0);
        // Three-stop vertical gradient: horizon → mid sky → deep zenith blue.
        vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.34, t));
        col = mix(col, uZenith, smoothstep(0.30, 0.92, t));
        // A bright hazy band hugging the horizon line.
        col = mix(col, uHaze, smoothstep(0.10, -0.06, h) * 0.7);
        // Sun: a broad warm halo (atmospheric scatter) plus a soft disc.
        float c = max(dot(vDir, uSunDir), 0.0);
        col += uSunColor * (pow(c, 4.0) * 0.34 + pow(c, 220.0) * 1.1);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

/** Radial white-to-transparent sprite, for the sun glow/core (additive). */
function radialSprite(size: number, inner: string, mid: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner);
  g.addColorStop(0.45, mid);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      fog: false,
    }),
  );
  sprite.scale.setScalar(size);
  return sprite;
}

/** A soft puffy cloud built from blurred white blobs, with a shaded (volume) underside. */
function cloudTexture(variant: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const rng = mulberry32(0x9e37 + variant * 101);

  // Fluffy silhouette: several overlapping soft-edged ellipses, denser toward the top.
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = 22;
  const lobes = 6 + Math.floor(rng() * 3);
  for (let i = 0; i < lobes; i++) {
    const x = 54 + rng() * 148;
    const y = 58 + rng() * 24;
    const rx = 26 + rng() * 32;
    const ry = 17 + rng() * 13;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Volume: shade only the lower half bluish-grey (composited onto the cloud's alpha).
  ctx.shadowBlur = 0;
  ctx.globalCompositeOperation = 'source-atop';
  const grad = ctx.createLinearGradient(0, 44, 0, 108);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(1, 'rgba(120,150,184,0.55)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 128);
  ctx.globalCompositeOperation = 'source-over';

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

export class Sky {
  private readonly group = new THREE.Group();
  private readonly clouds = new THREE.Group();

  constructor(scene: THREE.Scene) {
    // Atmosphere dome.
    const dome = new THREE.Mesh(new THREE.SphereGeometry(DOME_R, 32, 16), domeMaterial());
    dome.frustumCulled = false;
    dome.renderOrder = -10;
    this.group.add(dome);

    // Sun: a soft broad glow + a bright tight core, placed in the sun's direction.
    const sunPos = SUN_DIR.clone().multiplyScalar(DOME_R * 0.94);
    const glow = radialSprite(200, 'rgba(255,245,214,0.92)', 'rgba(255,232,176,0.34)');
    const core = radialSprite(62, 'rgba(255,255,255,1)', 'rgba(255,245,216,0.68)');
    glow.position.copy(sunPos);
    core.position.copy(sunPos);
    glow.renderOrder = -9;
    core.renderOrder = -9;
    glow.frustumCulled = core.frustumCulled = false;
    this.group.add(glow, core);

    // Clouds: puffy sprites scattered around the sky, drifting slowly on a prevailing wind.
    const textures = [cloudTexture(0), cloudTexture(1), cloudTexture(2), cloudTexture(3)];
    const rng = mulberry32(0x51b3);
    const COUNT = 20;
    for (let i = 0; i < COUNT; i++) {
      const az = (i / COUNT) * Math.PI * 2 + rng() * 0.45;
      const el = 0.03 + rng() * 0.55; // radians above the horizon
      const dist = DOME_R * (0.7 + rng() * 0.16);
      const tex = textures[i % textures.length];
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: tex,
          transparent: true,
          opacity: 0.82 + rng() * 0.18,
          depthWrite: false,
          depthTest: true,
          fog: false,
        }),
      );
      const w = 180 + rng() * 180;
      sprite.scale.set(w, w * 0.5, 1);
      sprite.position.set(
        Math.cos(az) * Math.cos(el) * dist,
        Math.sin(el) * dist,
        Math.sin(az) * Math.cos(el) * dist,
      );
      sprite.renderOrder = -8;
      sprite.frustumCulled = false;
      this.clouds.add(sprite);
    }
    this.group.add(this.clouds);

    scene.add(this.group);
  }

  /** Keep the sky centred on the camera and drift the clouds. */
  update(camera: THREE.Camera, dt: number): void {
    this.group.position.copy(camera.position);
    this.clouds.rotation.y += dt * 0.004; // a gentle prevailing wind
  }
}

/** Tiny deterministic PRNG so cloud / sun placement is stable within a session. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
