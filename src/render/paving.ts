// Procedural, tileable cobblestone/paving texture for the City & Cobblestone grounds. Drawn
// once on a canvas and repeat-wrapped, so the paving overlay shows small crisp stones no
// matter how coarse the terrain mesh is. Duplicated in the Map Builder (engine/paving) — keep in sync.

import * as THREE from 'three';

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
