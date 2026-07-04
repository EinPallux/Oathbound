// "Cube World" terrain rendered as a bubble of fine cubes around the player, rebuilt as they
// roam. The map is far too large to voxelize whole at a fine cube size, but the scene fog only
// shows ~a few hundred metres, so we build just the visible square around the player and let the
// fog hide the edge. Cubes are aligned to the exact fixed world grid that Heightfield.voxelHeightAt
// snaps collision to (same cube size + origin), so what you see is what you stand on.
//
// Paved ground (City/Cobblestone) gets a second overlay mesh: one flat, stone-textured quad per
// paved cube top, so the paving reads as textured cubes matching the terrain (not a smooth sheet).

import * as THREE from 'three';
import type { Heightfield } from '../world/heightfield';
import { makePavingTexture, makeGroundTexture } from './paving';
import { groundMaterial, type GroundMaterial } from './custom-map-view';

type ColorAt = (x: number, z: number, h: number, out: [number, number, number]) => void;
/** Ground code at a world position (biome index for custom maps; a representative index for the
 *  procedural world) → picks the cube-top detail texture via {@link groundMaterial}. */
type GroundAt = (x: number, z: number) => number;

const GROUND_LIFT = 0.06; // sit the detail overlay just above the cube top to beat z-fighting
/** World tile size (repeats/m) per material — a smaller number ⇒ bigger stones/blades on the ground. */
const GROUND_TILE: Record<GroundMaterial, number> = { grass: 1 / 2.4, rock: 1 / 2.8, grit: 1 / 1.8, paved: 1 / 2.2 };
/** Tint boost per material so (light detail texture × biome tint) averages near the base colour. */
const GROUND_BOOST: Record<GroundMaterial, number> = { grass: 1.34, rock: 1.24, grit: 1.2, paved: 1 };
/** All ground materials, in a stable order for overlay iteration. */
const GROUND_MATERIALS: GroundMaterial[] = ['grass', 'rock', 'grit', 'paved'];

export class VoxelTerrain {
  /** Add THIS to the scene: the cube mesh + (for custom maps) the paved-stone overlay. */
  readonly group: THREE.Group;
  /** The cube mesh — also the camera-occlusion obstacle (raycast target). */
  readonly mesh: THREE.Mesh;
  /** Per-material detail overlays (one textured quad per cube top, keyed by ground material). */
  private readonly overlays: Record<GroundMaterial, THREE.Mesh> | null;
  private cx = Infinity;
  private cz = Infinity;
  private readonly moveThreshold: number;

  constructor(
    private readonly field: Heightfield,
    private readonly colorAt: ColorAt,
    private readonly cube: number,
    private readonly radius: number,
    /** Ground index at a world position (custom maps) → City/Cobblestone tops get the stone texture. */
    private readonly groundAt: GroundAt | null = null,
    private readonly sideDarken = 0.72,
  ) {
    // DoubleSide so cube walls never cull to see-through gaps regardless of view angle.
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    this.mesh.name = 'terrain';
    this.mesh.frustumCulled = false; // it always surrounds the camera
    this.group = new THREE.Group();
    this.group.name = 'terrain-group';
    this.group.add(this.mesh);
    if (groundAt) {
      const mk = (map: THREE.Texture): THREE.Mesh => {
        const m = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshLambertMaterial({
          map, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
        }));
        m.frustumCulled = false;
        return m;
      };
      this.overlays = {
        grass: mk(makeGroundTexture('grass')), rock: mk(makeGroundTexture('rock')),
        grit: mk(makeGroundTexture('grit')), paved: mk(makePavingTexture()),
      };
      for (const g of GROUND_MATERIALS) { this.overlays[g].name = `voxel-${g}`; this.group.add(this.overlays[g]); }
    } else {
      this.overlays = null;
    }
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
    const { field, cube, radius, sideDarken, groundAt } = this;
    const i0 = Math.floor((px - radius) / cube), i1 = Math.ceil((px + radius) / cube);
    const j0 = Math.floor((pz - radius) / cube), j1 = Math.ceil((pz + radius) / cube);
    const nx = i1 - i0 + 1, nz = j1 - j0 + 1;

    // Height + colour (+ ground index) per cell. Cell centre = (index + 0.5)·cube — the grid collision uses.
    const H = new Float32Array(nx * nz);
    const CR = new Float32Array(nx * nz), CG = new Float32Array(nx * nz), CB = new Float32Array(nx * nz);
    const PV = groundAt ? new Uint8Array(nx * nz) : null;
    const rgb: [number, number, number] = [0, 0, 0];
    for (let jz = 0; jz < nz; jz++) {
      for (let ix = 0; ix < nx; ix++) {
        const wx = (i0 + ix + 0.5) * cube, wz = (j0 + jz + 0.5) * cube;
        const h = field.voxelHeightAt(wx, wz);
        const k = jz * nx + ix;
        H[k] = h;
        this.colorAt(wx, wz, h, rgb);
        CR[k] = rgb[0]; CG[k] = rgb[1]; CB[k] = rgb[2];
        if (PV) PV[k] = groundAt!(wx, wz);
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
    // Per-material overlay buckets: a textured, biome-tinted quad on every cube top.
    const OV = groundAt
      ? {
          grass: { pos: [] as number[], uv: [] as number[], col: [] as number[], idx: [] as number[] },
          rock: { pos: [] as number[], uv: [] as number[], col: [] as number[], idx: [] as number[] },
          grit: { pos: [] as number[], uv: [] as number[], col: [] as number[], idx: [] as number[] },
          paved: { pos: [] as number[], uv: [] as number[], col: [] as number[], idx: [] as number[] },
        }
      : null;

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

        // Detail overlay on the cube top: pick the material's texture, tint by the biome colour
        // (paving keeps its own grey/warm tint), world-UV so the grain tiles seamlessly.
        if (OV && PV) {
          const code = PV[k], mat = groundMaterial(code);
          const tile = GROUND_TILE[mat], py = y + GROUND_LIFT;
          let tr: number, tg: number, tb: number;
          if (mat === 'paved') { const warm = code === 15; tr = warm ? 0.74 : 0.68; tg = 0.68; tb = warm ? 0.58 : 0.71; }
          else { const bo = GROUND_BOOST[mat]; tr = Math.min(1, r * bo); tg = Math.min(1, g * bo); tb = Math.min(1, b * bo); }
          const o = OV[mat], ob = o.pos.length / 3;
          o.pos.push(x0, py, z0, x0, py, z1, x1, py, z1, x1, py, z0);
          o.uv.push(x0 * tile, z0 * tile, x0 * tile, z1 * tile, x1 * tile, z1 * tile, x1 * tile, z0 * tile);
          for (let i = 0; i < 4; i++) o.col.push(tr, tg, tb);
          o.idx.push(ob, ob + 1, ob + 2, ob, ob + 2, ob + 3);
        }
      }
    }

    const geo = this.mesh.geometry;
    geo.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(pos), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(Float32Array.from(nrm), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(Float32Array.from(col), 3));
    geo.setIndex(new THREE.BufferAttribute(Uint32Array.from(idx), 1));
    geo.computeBoundingSphere();

    if (OV && this.overlays) {
      for (const g of GROUND_MATERIALS) {
        const o = OV[g], mesh = this.overlays[g], pg = mesh.geometry;
        pg.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(o.pos), 3));
        pg.setAttribute('uv', new THREE.BufferAttribute(Float32Array.from(o.uv), 2));
        pg.setAttribute('color', new THREE.BufferAttribute(Float32Array.from(o.col), 3));
        pg.setIndex(new THREE.BufferAttribute(Uint32Array.from(o.idx), 1));
        pg.computeVertexNormals();
        pg.computeBoundingSphere();
        mesh.visible = o.pos.length > 0;
      }
    }

    this.cx = px;
    this.cz = pz;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    if (this.overlays) {
      for (const g of GROUND_MATERIALS) {
        this.overlays[g].geometry.dispose();
        (this.overlays[g].material as THREE.Material).dispose();
      }
    }
  }
}
