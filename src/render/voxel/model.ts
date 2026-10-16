/** Voxels per tile edge. One voxel is 1 / VOXELS_PER_TILE world units. */
export const VOXELS_PER_TILE = 16;
export const VOXEL_SIZE = 1 / VOXELS_PER_TILE;

/** Dense voxel grid of palette indices (0 = empty). Y is up. Index = x + sx * (y + sy * z). */
export class VoxelModel {
  readonly data: Uint8Array;

  constructor(
    readonly sx: number,
    readonly sy: number,
    readonly sz: number,
  ) {
    this.data = new Uint8Array(sx * sy * sz);
  }

  inBounds(x: number, y: number, z: number): boolean {
    return x >= 0 && y >= 0 && z >= 0 && x < this.sx && y < this.sy && z < this.sz;
  }

  get(x: number, y: number, z: number): number {
    return this.inBounds(x, y, z) ? (this.data[x + this.sx * (y + this.sy * z)] as number) : 0;
  }

  /** Out-of-bounds writes are ignored, so generators can overshoot safely. */
  set(x: number, y: number, z: number, c: number): this {
    if (this.inBounds(x, y, z)) this.data[x + this.sx * (y + this.sy * z)] = c;
    return this;
  }

  /** Fill [x0,x1) x [y0,y1) x [z0,z1) with a colour, or a per-voxel function (returning 0 skips the voxel). */
  box(
    x0: number, y0: number, z0: number, x1: number, y1: number, z1: number,
    c: number | ((x: number, y: number, z: number) => number),
  ): this {
    for (let z = z0; z < z1; z++)
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const v = typeof c === 'number' ? c : c(x, y, z);
          if (v) this.set(x, y, z, v);
        }
    return this;
  }

  /** Box shell with the given wall thickness (all six faces). */
  hollowBox(
    x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: number, t = 1,
  ): this {
    return this.box(x0, y0, z0, x1, y1, z1, (x, y, z) =>
      x < x0 + t || x >= x1 - t || y < y0 + t || y >= y1 - t || z < z0 + t || z >= z1 - t ? c : 0,
    );
  }

  /** Copy the x < sx/2 half onto the mirrored x >= sx/2 half. */
  mirrorX(): this {
    for (let z = 0; z < this.sz; z++)
      for (let y = 0; y < this.sy; y++)
        for (let x = 0; x < this.sx >> 1; x++) {
          const v = this.get(x, y, z);
          if (v) this.set(this.sx - 1 - x, y, z, v);
        }
    return this;
  }

  /** Clear everything inside the box. */
  clear(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): this {
    for (let z = z0; z < z1; z++)
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) this.set(x, y, z, 0);
    return this;
  }

  count(): number {
    let n = 0;
    for (const v of this.data) if (v) n++;
    return n;
  }
}
