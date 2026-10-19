import { allocate, CHUNK_SIZE, type FieldArray, type FieldType, type GridLike } from './grid';
import type { SectorGrid } from './sectorGrid';

/**
 * A rectangle of a SectorGrid seen in local coordinates (0,0 = the rectangle's top-left), so Grid-shaped code runs
 * unchanged on a ship stamped into the sector. Writes go straight through to the sector.
 */
export class GridWindow implements GridLike {
  private readonly dense = new Map<string, { rev: number; arr: FieldArray }>();

  constructor(
    readonly id: number,
    readonly sector: SectorGrid,
    /** Sector coordinates of the window's top-left tile. */
    readonly ox: number,
    readonly oy: number,
    readonly width: number,
    readonly height: number,
  ) {}

  has(field: string): boolean {
    return this.sector.has(field);
  }

  fieldNames(): string[] {
    return this.sector.fieldNames();
  }

  inBounds(x: number, y: number): boolean {
    return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  get(field: string, x: number, y: number): number {
    this.check(x, y);
    return this.sector.get(field, this.ox + x, this.oy + y);
  }

  set(field: string, x: number, y: number, value: number): void {
    this.check(x, y);
    this.sector.set(field, this.ox + x, this.oy + y, value);
  }

  /** Sum of the revisions of the sector chunks the window overlaps; changes whenever a tile in them is written. */
  revision(field: string): number {
    return this.sumRevisions(field, 0, 0, this.width, this.height);
  }

  /** Revision of one 16x16 chunk of the window's local grid (summed over the sector chunks it overlaps). */
  chunkRevision(field: string, cx: number, cy: number): number {
    const chunksX = Math.ceil(this.width / CHUNK_SIZE);
    const chunksY = Math.ceil(this.height / CHUNK_SIZE);
    if (cx < 0 || cy < 0 || cx >= chunksX || cy >= chunksY) {
      throw new RangeError(`GridWindow chunk (${cx}, ${cy}) out of bounds`);
    }
    const x = cx * CHUNK_SIZE, y = cy * CHUNK_SIZE;
    return this.sumRevisions(field, x, y, Math.min(CHUNK_SIZE, this.width - x), Math.min(CHUNK_SIZE, this.height - y));
  }

  /** Temporary dense copy of a field, cached on the window revision. Refreshed in place; writes to it are lost. */
  raw(field: string): Readonly<FieldArray> {
    if (!this.sector.has(field)) throw new Error(`GridWindow: unknown field "${field}"`);
    const rev = this.revision(field);
    let entry = this.dense.get(field);
    if (entry && entry.rev === rev) return entry.arr;
    const src = this.sector.load(field, { x: this.ox, y: this.oy, w: this.width, h: this.height });
    if (!entry) {
      entry = { rev, arr: allocate(this.sector.spec[field] as FieldType, this.width * this.height) };
      this.dense.set(field, entry);
    }
    entry.arr.set(src);
    entry.rev = rev;
    return entry.arr;
  }

  private sumRevisions(field: string, lx: number, ly: number, w: number, h: number): number {
    if (!this.sector.has(field)) throw new Error(`GridWindow: unknown field "${field}"`);
    if (w <= 0 || h <= 0) return 0;
    const x0 = this.ox + lx, y0 = this.oy + ly;
    let sum = 0;
    for (let cy = Math.floor(y0 / CHUNK_SIZE); cy <= Math.floor((y0 + h - 1) / CHUNK_SIZE); cy++) {
      for (let cx = Math.floor(x0 / CHUNK_SIZE); cx <= Math.floor((x0 + w - 1) / CHUNK_SIZE); cx++) {
        sum += this.sector.chunkRevision(field, cx, cy);
      }
    }
    return sum;
  }

  private check(x: number, y: number): void {
    if (!this.inBounds(x, y)) throw new RangeError(`GridWindow: (${x}, ${y}) out of bounds`);
  }
}
