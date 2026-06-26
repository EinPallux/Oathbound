// A uniform-cell spatial hash for cheap broad-phase neighbour queries (aggro,
// social, targeting) so they stay near-O(1) instead of O(n²) as enemy counts grow.
// Pure: no Three.js/DOM. Rebuilt each tick from entity positions.

import type { Entity } from '../core/ecs/world';

export class SpatialGrid {
  private readonly cells = new Map<number, Entity[]>();
  private readonly cell: number;

  constructor(cellSize = 8) {
    this.cell = cellSize;
  }

  clear(): void {
    this.cells.clear();
  }

  private key(cx: number, cz: number): number {
    // Pack two signed cell coords into one number key (offset to stay non-negative).
    return (cx + 4096) * 8192 + (cz + 4096);
  }

  insert(entity: Entity, x: number, z: number): void {
    const cx = Math.floor(x / this.cell);
    const cz = Math.floor(z / this.cell);
    const k = this.key(cx, cz);
    let bucket = this.cells.get(k);
    if (!bucket) {
      bucket = [];
      this.cells.set(k, bucket);
    }
    bucket.push(entity);
  }

  /**
   * Append entities in cells overlapping the query circle into `out` (cleared
   * first). Broad-phase: may include entities just outside `radius`; callers do the
   * exact distance check. Returns `out`.
   */
  queryCircle(x: number, z: number, radius: number, out: Entity[]): Entity[] {
    out.length = 0;
    const minX = Math.floor((x - radius) / this.cell);
    const maxX = Math.floor((x + radius) / this.cell);
    const minZ = Math.floor((z - radius) / this.cell);
    const maxZ = Math.floor((z + radius) / this.cell);
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cz = minZ; cz <= maxZ; cz++) {
        const bucket = this.cells.get(this.key(cx, cz));
        if (bucket) for (const e of bucket) out.push(e);
      }
    }
    return out;
  }
}
