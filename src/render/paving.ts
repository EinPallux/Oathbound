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
