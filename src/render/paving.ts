// Procedural, tileable ground textures (cobblestone paving + grass / rock / sand grain) laid on
// the voxel cube tops so each cube reads as its material — small crisp detail no matter how coarse
// the terrain mesh is. Drawn once on a canvas and repeat-wrapped. Duplicated in the Map Builder
// (engine/paving) — keep in sync.

import * as THREE from 'three';

/** Small deterministic PRNG so both repos draw the same texture (no per-load flicker). */
function makeRng(seed: number): () => number {
  let s = seed | 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 0x10000; };
}

/** Finish a 128px canvas into a repeat-wrapped sRGB texture. */
function finishTexture(canvas: HTMLCanvasElement): THREE.Texture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Tileable grayscale-ish DETAIL texture for a natural ground material — mostly light (so a per-cube
 * biome-colour tint shows through) with darker grain marks: grassy blades, craggy stone, sandy
 * grit. Multiplied by the cube's biome colour in the overlay, so grass reads green, rock grey, etc.
 */
export function makeGroundTexture(kind: 'grass' | 'rock' | 'grit'): THREE.Texture {
  const S = 128;
  const canvas = document.createElement('canvas');
  canvas.width = S; canvas.height = S;
  const g = canvas.getContext('2d')!;
  const rnd = makeRng(kind === 'grass' ? 12347 : kind === 'rock' ? 555 : 98765);
  // Draw `draw` at the 9 wrap offsets so marks crossing the seam tile cleanly.
  const wrapped = (draw: (ox: number, oy: number) => void): void => {
    for (const ox of [0, S, -S]) for (const oy of [0, S, -S]) draw(ox, oy);
  };

  if (kind === 'grass') {
    g.fillStyle = 'rgb(214,224,200)'; g.fillRect(0, 0, S, S);
    // Soft lighter/darker meadow blotches for large-scale life.
    for (let n = 0; n < 26; n++) {
      const x = rnd() * S, y = rnd() * S, r = 10 + rnd() * 20, up = rnd() > 0.5;
      g.fillStyle = up ? 'rgba(235,240,215,0.5)' : 'rgba(150,168,120,0.5)';
      wrapped((ox, oy) => { g.beginPath(); g.ellipse(x + ox, y + oy, r, r * 0.8, 0, 0, 7); g.fill(); });
    }
    // Blades: many short near-vertical strokes in varied green-greys.
    for (let n = 0; n < 1500; n++) {
      const x = rnd() * S, y = rnd() * S, len = 3 + rnd() * 7, lean = (rnd() - 0.5) * 3;
      const v = 110 + rnd() * 90;
      g.strokeStyle = `rgb(${(v * 0.82) | 0},${v | 0},${(v * 0.68) | 0})`;
      g.lineWidth = 1;
      wrapped((ox, oy) => { g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + lean, y + oy - len); g.stroke(); });
    }
  } else if (kind === 'rock') {
    g.fillStyle = 'rgb(150,150,156)'; g.fillRect(0, 0, S, S);
    // Irregular rock chunks (varied grey), then dark cracks between them.
    for (let n = 0; n < 55; n++) {
      const x = rnd() * S, y = rnd() * S, r = 8 + rnd() * 14, v = 150 + rnd() * 85;
      g.fillStyle = `rgb(${v | 0},${v | 0},${(v + 5) | 0})`;
      wrapped((ox, oy) => { g.beginPath(); g.ellipse(x + ox, y + oy, r, r * (0.6 + rnd() * 0.6), rnd() * 6, 0, 7); g.fill(); });
    }
    for (let n = 0; n < 70; n++) {
      const x = rnd() * S, y = rnd() * S, len = 6 + rnd() * 16, a = rnd() * 6;
      g.strokeStyle = `rgba(70,70,76,${0.4 + rnd() * 0.4})`;
      g.lineWidth = 1 + rnd();
      wrapped((ox, oy) => { g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + Math.cos(a) * len, y + oy + Math.sin(a) * len); g.stroke(); });
    }
  } else { // grit — fine granular sand/snow speckle
    g.fillStyle = 'rgb(224,220,210)'; g.fillRect(0, 0, S, S);
    for (let n = 0; n < 6000; n++) {
      const x = rnd() * S, y = rnd() * S, v = 150 + rnd() * 90, s = 0.8 + rnd() * 1.1;
      g.fillStyle = `rgb(${v | 0},${(v - 3) | 0},${(v - 10) | 0})`;
      g.fillRect(x, y, s, s);
    }
  }
  return finishTexture(canvas);
}

export function makePavingTexture(): THREE.Texture {
  const S = 128;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#3d3d40'; // mortar
  g.fillRect(0, 0, S, S);

  const N = 5; // stones per side → ~0.44 m stones at a 2.2 m repeat
  const cell = S / N;
  const rnd = (i: number, j: number): number => {
    let h = (i * 374761393 + j * 668265263) | 0;
    h = ((h ^ (h >>> 13)) * 1274126177) | 0;
    return ((h >>> 0) % 1000) / 1000;
  };
  const round = (x: number, y: number, w: number, h: number, r: number): void => {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  };

  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const off = (j % 2) * cell * 0.5; // running-bond offset (wraps across the seam)
      const cx = (i * cell + off) % S;
      const pad = cell * 0.12;
      const shade = 150 + Math.floor(rnd(i, j) * 80); // 150..230 grey
      for (const dx of [0, S, -S]) {
        const x = cx + dx + pad;
        if (x + (cell - 2 * pad) < 0 || x > S) continue;
        const y = j * cell + pad;
        const w = cell - 2 * pad;
        const h = cell - 2 * pad;
        g.fillStyle = `rgb(${shade},${shade},${shade + 3})`;
        round(x, y, w, h, cell * 0.22);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.05)'; // subtle top highlight
        round(x, y, w, h * 0.45, cell * 0.22);
        g.fill();
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Full-colour, tileable ROAD surface texture for the three environmental road styles, drawn on a
 * 128px canvas and repeat-wrapped (the ribbon's world-scaled UVs tile it every ~4 m). Unlike
 * makeGroundTexture — a grey detail multiplied by a biome tint — these carry their own colour so a
 * road reads right on its own:
 *   • 'city'  — cobbled stone street: warm-grey setts in running bond over dark mortar
 *   • 'grass' — grassland dirt road: mottled packed earth, worn wheel ruts, scattered pebbles
 *   • 'sand'  — desert sand road: rippled tan sand with compacted wheel tracks and fine grit
 */
export function makeRoadTexture(kind: 'city' | 'grass' | 'sand'): THREE.Texture {
  const S = 128;
  const canvas = document.createElement('canvas');
  canvas.width = S; canvas.height = S;
  const g = canvas.getContext('2d')!;
  const rnd = makeRng(kind === 'city' ? 7331 : kind === 'grass' ? 4242 : 90901);
  // Draw at the 9 wrap offsets so marks crossing a seam tile cleanly (all randomness resolved
  // BEFORE the callback so every wrapped copy is identical).
  const wrapped = (draw: (ox: number, oy: number) => void): void => {
    for (const ox of [0, S, -S]) for (const oy of [0, S, -S]) draw(ox, oy);
  };
  const roundRect = (x: number, y: number, w: number, h: number, r: number): void => {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  };

  if (kind === 'city') {
    g.fillStyle = 'rgb(50,48,46)'; g.fillRect(0, 0, S, S);           // dark mortar
    const N = 6;                                                     // ~0.66 m setts at a 4 m tile
    const cell = S / N;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const off = (j % 2) * cell * 0.5;                           // running-bond offset (wraps the seam)
        const cx = (i * cell + off) % S;
        const pad = cell * 0.1;
        const base = 112 + rnd() * 74;                              // grey 112..186
        const warm = (rnd() - 0.35) * 26;                           // some setts browner, some cooler
        const cr = Math.max(0, Math.min(230, (base + warm) | 0));
        const cg = Math.max(0, Math.min(230, (base + warm * 0.35) | 0));
        const cb = Math.max(0, Math.min(230, (base - warm * 0.8) | 0));
        for (const dx of [0, S, -S]) {
          const x = cx + dx + pad;
          if (x + (cell - 2 * pad) < 0 || x > S) continue;
          const y = j * cell + pad;
          const w = cell - 2 * pad, h = cell - 2 * pad;
          g.fillStyle = `rgb(${cr},${cg},${cb})`;
          roundRect(x, y, w, h, cell * 0.3); g.fill();
          g.fillStyle = 'rgba(255,252,244,0.07)';                   // top highlight
          roundRect(x, y, w, h * 0.42, cell * 0.3); g.fill();
          g.fillStyle = 'rgba(0,0,0,0.13)';                         // bottom contact shadow
          roundRect(x, y + h * 0.58, w, h * 0.42, cell * 0.3); g.fill();
        }
      }
    }
  } else if (kind === 'grass') {
    // Packed-earth dirt road: fine grain carries it; only very gentle large-scale variation so it
    // never reads as a repeating motif when tiled down a long road.
    g.fillStyle = 'rgb(122,94,60)'; g.fillRect(0, 0, S, S);
    for (let n = 0; n < 10; n++) {                                  // soft broad tone unevenness
      const x = rnd() * S, y = rnd() * S, r = 16 + rnd() * 24, rot = rnd() * 6, dark = rnd() > 0.5;
      g.fillStyle = dark ? 'rgba(96,72,44,0.22)' : 'rgba(150,120,80,0.22)';
      wrapped((ox, oy) => { g.beginPath(); g.ellipse(x + ox, y + oy, r, r * 0.8, rot, 0, 7); g.fill(); });
    }
    for (const rx of [0.3, 0.7]) {                                  // soft worn wheel lanes (no hard edge)
      const cxr = rx * S, w = S * 0.18;
      const grad = g.createLinearGradient(cxr - w / 2, 0, cxr + w / 2, 0);
      grad.addColorStop(0, 'rgba(70,50,30,0)');
      grad.addColorStop(0.5, 'rgba(70,50,30,0.22)');
      grad.addColorStop(1, 'rgba(70,50,30,0)');
      g.fillStyle = grad; g.fillRect(cxr - w / 2, 0, w, S);
    }
    for (let n = 0; n < 55; n++) {                                  // pebbles
      const x = rnd() * S, y = rnd() * S, r = 1 + rnd() * 2.2, v = 118 + rnd() * 84;
      g.fillStyle = `rgb(${v | 0},${(v - 14) | 0},${(v - 32) | 0})`;
      wrapped((ox, oy) => { g.beginPath(); g.ellipse(x + ox, y + oy, r, r * 0.85, 0, 0, 7); g.fill(); });
    }
    for (let n = 0; n < 3800; n++) {                                // dense fine grit — the packed grain
      const x = rnd() * S, y = rnd() * S, v = 100 + rnd() * 70, light = rnd() > 0.5;
      g.fillStyle = light
        ? `rgba(${(v + 30) | 0},${(v + 4) | 0},${(v - 22) | 0},0.4)`
        : `rgba(${(v - 32) | 0},${(v - 48) | 0},${(v - 64) | 0},0.5)`;
      g.fillRect(x, y, 1, 1);
    }
  } else {
    // Desert sand road: fine grit + short wind-ripple streaks; only very soft compacted tracks and
    // no hard bands, so it reads as drifting sand rather than a woven pattern.
    g.fillStyle = 'rgb(212,186,140)'; g.fillRect(0, 0, S, S);
    for (let n = 0; n < 10; n++) {                                  // soft broad tone unevenness
      const x = rnd() * S, y = rnd() * S, r = 18 + rnd() * 26, rot = rnd() * 6, light = rnd() > 0.5;
      g.fillStyle = light ? 'rgba(230,208,164,0.22)' : 'rgba(186,158,112,0.22)';
      wrapped((ox, oy) => { g.beginPath(); g.ellipse(x + ox, y + oy, r, r * 0.8, rot, 0, 7); g.fill(); });
    }
    for (const rx of [0.32, 0.68]) {                               // very soft compacted wheel tracks
      const cxr = rx * S, w = S * 0.16;
      const grad = g.createLinearGradient(cxr - w / 2, 0, cxr + w / 2, 0);
      grad.addColorStop(0, 'rgba(150,124,84,0)');
      grad.addColorStop(0.5, 'rgba(150,124,84,0.2)');
      grad.addColorStop(1, 'rgba(150,124,84,0)');
      g.fillStyle = grad; g.fillRect(cxr - w / 2, 0, w, S);
    }
    for (let n = 0; n < 90; n++) {                                 // short near-horizontal wind-ripple streaks
      const x = rnd() * S, y = rnd() * S, len = 10 + rnd() * 16, ang = (rnd() - 0.5) * 0.5, light = rnd() > 0.5;
      g.strokeStyle = light ? 'rgba(232,212,170,0.5)' : 'rgba(184,156,110,0.45)';
      g.lineWidth = 1 + rnd();
      wrapped((ox, oy) => { g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + Math.cos(ang) * len, y + oy + Math.sin(ang) * len); g.stroke(); });
    }
    for (let n = 0; n < 4800; n++) {                               // dense fine sand grit
      const x = rnd() * S, y = rnd() * S, v = 190 + rnd() * 50, light = rnd() > 0.5;
      g.fillStyle = light
        ? 'rgba(255,248,220,0.35)'
        : `rgba(${(v - 40) | 0},${(v - 58) | 0},${(v - 82) | 0},0.4)`;
      g.fillRect(x, y, 1, 1);
    }
    for (let n = 0; n < 16; n++) {                                 // a few small pebbles
      const x = rnd() * S, y = rnd() * S, r = 1 + rnd() * 2, v = 150 + rnd() * 70;
      g.fillStyle = `rgb(${v | 0},${(v - 16) | 0},${(v - 40) | 0})`;
      wrapped((ox, oy) => { g.beginPath(); g.ellipse(x + ox, y + oy, r, r * 0.8, 0, 0, 7); g.fill(); });
    }
  }
  return finishTexture(canvas);
}

/** Cached road materials keyed by style so every road ribbon of a style shares one texture. */
const _roadMats: { [k in 'city' | 'grass' | 'sand']?: THREE.Material } = {};
export function roadMaterial(style: 'city' | 'grass' | 'sand'): THREE.Material {
  let m = _roadMats[style];
  if (!m) {
    m = new THREE.MeshLambertMaterial({
      map: makeRoadTexture(style),
      side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
    });
    _roadMats[style] = m;
  }
  return m;
}
