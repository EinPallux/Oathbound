// "Cube World" terrain rendered as a bubble of fine cubes around the player, rebuilt as they
// roam. The map is far too large to voxelize whole at a fine cube size, but the scene fog only
// shows ~a few hundred metres, so we build just the visible square around the player and let the
// fog hide the edge. Cubes are aligned to the exact fixed world grid that Heightfield.voxelHeightAt
// snaps collision to (same cube size + origin), so what you see is what you stand on.

import * as THREE from 'three';
import type { Heightfield } from '../world/heightfield';

type ColorAt = (x: number, z: number, h: number, out: [number, number, number]) => void;

export class VoxelTerrain {
  readonly mesh: THREE.Mesh;
  private cx = Infinity;
  private cz = Infinity;
  private readonly moveThreshold: number;

  constructor(
    private readonly field: Heightfield,
    private readonly colorAt: ColorAt,
    private readonly cube: number,
    private readonly radius: number,
    private readonly sideDarken = 0.72,
  ) {
    // DoubleSide so cube walls never cull to see-through gaps regardless of view angle.
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    this.mesh.name = 'terrain';
    this.mesh.frustumCulled = false; // it always surrounds the camera
    this.moveThreshold = Math.max(cube, radius * 0.3); // rebuild after the player drifts this far
  }

  /** Rebuild the bubble if the player has moved far enough from its centre. Call each frame. */
  update(px: number, pz: number): void {
    if (Math.abs(px - this.cx) < this.moveThreshold && Math.abs(pz - this.cz) < this.moveThreshold) return;
    this.rebuild(px, pz);
  }

  /** Force a rebuild at the given centre (e.g. right after enabling voxel mode). */
  rebuildAt(px: number, pz: number): void {
    this.rebuild(px, pz);
  }

  private rebuild(px: number, pz: number): void {
    const { field, cube, radius, sideDarken } = this;
    const i0 = Math.floor((px - radius) / cube), i1 = Math.ceil((px + radius) / cube);
    const j0 = Math.floor((pz - radius) / cube), j1 = Math.ceil((pz + radius) / cube);
    const nx = i1 - i0 + 1, nz = j1 - j0 + 1;

    // Height + colour per cell (cell centre = (index + 0.5)·cube — the same grid collision uses).
    const H = new Float32Array(nx * nz);
    const CR = new Float32Array(nx * nz), CG = new Float32Array(nx * nz), CB = new Float32Array(nx * nz);
    const rgb: [number, number, number] = [0, 0, 0];
    for (let jz = 0; jz < nz; jz++) {
      for (let ix = 0; ix < nx; ix++) {
        const wx = (i0 + ix + 0.5) * cube, wz = (j0 + jz + 0.5) * cube;
        const h = field.voxelHeightAt(wx, wz);
        const k = jz * nx + ix;
        H[k] = h;
        this.colorAt(wx, wz, h, rgb);
        CR[k] = rgb[0]; CG[k] = rgb[1]; CB[k] = rgb[2];
      }
    }
    // Neighbour height (falls back to the field beyond the built rect so edge walls are correct).
    const neigh = (ix: number, jz: number): number =>
      ix >= 0 && ix < nx && jz >= 0 && jz < nz
        ? H[jz * nx + ix]
        : field.voxelHeightAt((i0 + ix + 0.5) * cube, (j0 + jz + 0.5) * cube);

    const pos: number[] = [], nrm: number[] = [], col: number[] = [], idx: number[] = [];
    const quad = (
      ax: number, ay: number, az: number, bx: number, by: number, bz: number,
      cxx: number, cyy: number, czz: number, dx: number, dy: number, dz: number,
      nx2: number, ny2: number, nz2: number, r: number, g: number, b: number,
    ): void => {
      const base = pos.length / 3;
      pos.push(ax, ay, az, bx, by, bz, cxx, cyy, czz, dx, dy, dz);
      for (let i = 0; i < 4; i++) { nrm.push(nx2, ny2, nz2); col.push(r, g, b); }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };

    for (let jz = 0; jz < nz; jz++) {
      for (let ix = 0; ix < nx; ix++) {
        const k = jz * nx + ix;
        const y = H[k];
        const x0 = (i0 + ix) * cube, x1 = x0 + cube;
        const z0 = (j0 + jz) * cube, z1 = z0 + cube;
        const r = CR[k], g = CG[k], b = CB[k];
        const dr = r * sideDarken, dg = g * sideDarken, db = b * sideDarken;
        quad(x0, y, z0, x0, y, z1, x1, y, z1, x1, y, z0, 0, 1, 0, r, g, b);
        const hxp = neigh(ix + 1, jz);
        if (y > hxp) quad(x1, y, z0, x1, y, z1, x1, hxp, z1, x1, hxp, z0, 1, 0, 0, dr, dg, db);
        const hxn = neigh(ix - 1, jz);
        if (y > hxn) quad(x0, y, z1, x0, y, z0, x0, hxn, z0, x0, hxn, z1, -1, 0, 0, dr, dg, db);
        const hzp = neigh(ix, jz + 1);
        if (y > hzp) quad(x1, y, z1, x0, y, z1, x0, hzp, z1, x1, hzp, z1, 0, 0, 1, dr, dg, db);
        const hzn = neigh(ix, jz - 1);
        if (y > hzn) quad(x0, y, z0, x1, y, z0, x1, hzn, z0, x0, hzn, z0, 0, 0, -1, dr, dg, db);
      }
    }

    const geo = this.mesh.geometry;
    geo.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(pos), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(Float32Array.from(nrm), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(Float32Array.from(col), 3));
    geo.setIndex(new THREE.BufferAttribute(Uint32Array.from(idx), 1));
    geo.computeBoundingSphere();
    this.cx = px;
    this.cz = pz;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
