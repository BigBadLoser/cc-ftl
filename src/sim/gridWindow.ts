import { allocate, CHUNK_SIZE, type FieldArray, type FieldType, type GridLike, type Rect } from './grid';
import type { SectorGrid } from './sectorGrid';

/**
 * A rectangle of a SectorGrid (one ship's bbox) seen in **sector coordinates** (step 6, the coordinate flip): `get(x, y)`
 * reads sector tile (x, y), and the window only adds the bounds of its rectangle (`x0`, `y0`, `width`, `height`), so
 * `inBounds` and the edge checks of Grid-shaped code keep their meaning. Writes go straight through to the sector.
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

  get x0(): number {
    return this.ox;
  }

  get y0(): number {
    return this.oy;
  }

  has(field: string): boolean {
    return this.sector.has(field);
  }

  fieldNames(): string[] {
    return this.sector.fieldNames();
  }

  inBounds(x: number, y: number): boolean {
    return Number.isInteger(x) && Number.isInteger(y) && x >= this.ox && y >= this.oy && x < this.ox + this.width && y < this.oy + this.height;
  }

  get(field: string, x: number, y: number): number {
    this.check(x, y);
    return this.sector.get(field, x, y);
  }

  set(field: string, x: number, y: number, value: number): void {
    this.check(x, y);
    this.sector.set(field, x, y, value);
  }

  /** Sum of the revisions of the sector chunks the window overlaps; changes whenever a tile in them is written. */
  revision(field: string): number {
    return this.sumRevisions(field, this.ox, this.oy, this.width, this.height);
  }

  /** Revision of sector chunk (cx, cy), which must overlap the window. */
  chunkRevision(field: string, cx: number, cy: number): number {
    const x = cx * CHUNK_SIZE, y = cy * CHUNK_SIZE;
    const x0 = Math.max(x, this.ox), y0 = Math.max(y, this.oy);
    const x1 = Math.min(x + CHUNK_SIZE, this.ox + this.width), y1 = Math.min(y + CHUNK_SIZE, this.oy + this.height);
    if (x0 >= x1 || y0 >= y1) throw new RangeError(`GridWindow chunk (${cx}, ${cy}) out of bounds`);
    return this.sumRevisions(field, x0, y0, x1 - x0, y1 - y0);
  }

  /**
   * Scratch copy of a field over a sector rectangle (default: the window). The rectangle may reach past the window
   * (a padded region frame): those tiles read straight from the sector.
   */
  load(field: string, rect: Rect = { x: this.ox, y: this.oy, w: this.width, h: this.height }): Float64Array {
    return this.sector.load(field, rect);
  }

  /**
   * Temporary dense copy of a field over the window, cached on the window revision, row-major from (x0, y0): tile (x, y)
   * is at `(y - y0) * width + (x - x0)`. Refreshed in place; writes to it are lost.
   */
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

  private sumRevisions(field: string, x0: number, y0: number, w: number, h: number): number {
    if (!this.sector.has(field)) throw new Error(`GridWindow: unknown field "${field}"`);
    if (w <= 0 || h <= 0) return 0;
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
