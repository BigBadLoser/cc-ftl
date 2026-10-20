/** Storage type of a grid field. */
export type FieldType = 'u8' | 'u16' | 'u32' | 'f32';

/** Field name -> storage type, passed at Grid construction. */
export type FieldSpec = Record<string, FieldType>;

export type FieldArray = Uint8Array | Uint16Array | Uint32Array | Float32Array;

/** JSON-able snapshot of a Grid. Revisions are not saved; they restart at 0. */
export interface GridData {
  id: number;
  width: number;
  height: number;
  fields: Record<string, { type: FieldType; data: string }>;
}

/** A rectangle of tiles: top-left (x, y), size w x h. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Chunk edge length in tiles, for per-chunk revision tracking. */
export const CHUNK_SIZE = 16;

/**
 * What systems and render use of a tile grid. Implemented by the dense `Grid` and by `GridWindow`, a rectangle of a
 * `SectorGrid` in local coordinates. `raw` is a temporary escape hatch: on a window it is a dense copy.
 */
export interface GridLike {
  readonly id: number;
  /**
   * Top-left of the grid's bounds in its own coordinates: 0 for a dense grid, the region's sector top-left for a sector
   * window (step 6: windows use sector coordinates). Tiles run x0 .. x0 + width - 1, y0 .. y0 + height - 1.
   */
  readonly x0: number;
  readonly y0: number;
  readonly width: number;
  readonly height: number;
  has(field: string): boolean;
  fieldNames(): string[];
  inBounds(x: number, y: number): boolean;
  get(field: string, x: number, y: number): number;
  set(field: string, x: number, y: number, value: number): void;
  revision(field: string): number;
  chunkRevision(field: string, cx: number, cy: number): number;
  /** Scratch copy of a field over `rect` (default: the whole grid), row-major w*h. Writes to it change nothing. */
  load(field: string, rect?: Rect): Float64Array;
  raw(field: string): Readonly<FieldArray>;
}

export function allocate(type: FieldType, n: number): FieldArray {
  if (type === 'u8') return new Uint8Array(n);
  if (type === 'u16') return new Uint16Array(n);
  if (type === 'u32') return new Uint32Array(n);
  return new Float32Array(n);
}

export function toBase64(arr: FieldArray): string {
  const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

export function fromBase64(type: FieldType, b64: string, n: number): FieldArray {
  const bin = atob(b64);
  const arr = allocate(type, n);
  const bytes = new Uint8Array(arr.buffer);
  if (bin.length !== bytes.length) throw new Error('Grid: field data length mismatch');
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return arr;
}

/**
 * A dense rectangular tile grid with named typed-array field layers. All writes go through set(),
 * which bumps a per-field revision and a per-chunk revision so the renderer can diff cheaply.
 * Since the sector grid (step 2) live ships are `GridWindow`s into `sim.sector.grid`; a dense grid is a build scratch
 * (templates, tests) that `sim.grids.set` stamps into the sector.
 */
export class DenseGrid implements GridLike {
  readonly x0 = 0;
  readonly y0 = 0;
  readonly chunksX: number;
  readonly chunksY: number;
  private readonly types = new Map<string, FieldType>();
  private readonly arrays = new Map<string, FieldArray>();
  private readonly revisions = new Map<string, number>();
  private readonly chunkRevs = new Map<string, Uint32Array>();

  constructor(
    readonly id: number,
    readonly width: number,
    readonly height: number,
    spec: FieldSpec,
  ) {
    this.chunksX = Math.ceil(width / CHUNK_SIZE);
    this.chunksY = Math.ceil(height / CHUNK_SIZE);
    for (const [name, type] of Object.entries(spec)) {
      this.types.set(name, type);
      this.arrays.set(name, allocate(type, width * height));
      this.revisions.set(name, 0);
      this.chunkRevs.set(name, new Uint32Array(this.chunksX * this.chunksY));
    }
  }

  /** Add a zero-filled field to an existing grid (save migrations). No-op if it exists. */
  addField(name: string, type: FieldType): void {
    if (this.arrays.has(name)) return;
    this.types.set(name, type);
    this.arrays.set(name, allocate(type, this.width * this.height));
    this.revisions.set(name, 0);
    this.chunkRevs.set(name, new Uint32Array(this.chunksX * this.chunksY));
  }

  /** True if the grid has this field. */
  has(field: string): boolean {
    return this.arrays.has(field);
  }

  /** Names of all fields, in definition order. */
  fieldNames(): string[] {
    return [...this.arrays.keys()];
  }

  /** True if (x, y) lies inside the grid. */
  inBounds(x: number, y: number): boolean {
    return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  /** Read a tile value. Throws on unknown field or out-of-bounds. */
  get(field: string, x: number, y: number): number {
    return this.array(field)[this.index(x, y)] as number;
  }

  /** Write a tile value and bump revisions. Throws on unknown field or out-of-bounds. */
  set(field: string, x: number, y: number, value: number): void {
    const arr = this.array(field);
    arr[this.index(x, y)] = value;
    this.revisions.set(field, (this.revisions.get(field) as number) + 1);
    const chunks = this.chunkRevs.get(field) as Uint32Array;
    const ci = Math.floor(y / CHUNK_SIZE) * this.chunksX + Math.floor(x / CHUNK_SIZE);
    chunks[ci] = (chunks[ci] as number) + 1;
  }

  /** Whole-field revision; changes whenever any tile of the field is set. */
  revision(field: string): number {
    this.array(field);
    return this.revisions.get(field) as number;
  }

  /** Revision of one 16x16 chunk of a field. */
  chunkRevision(field: string, cx: number, cy: number): number {
    this.array(field);
    if (cx < 0 || cy < 0 || cx >= this.chunksX || cy >= this.chunksY) {
      throw new RangeError(`Grid chunk (${cx}, ${cy}) out of bounds`);
    }
    return (this.chunkRevs.get(field) as Uint32Array)[cy * this.chunksX + cx] as number;
  }

  load(field: string, rect: Rect = { x: 0, y: 0, w: this.width, h: this.height }): Float64Array {
    const arr = this.array(field);
    const { x, y, w, h } = rect;
    if (w > 0 && h > 0 && (!this.inBounds(x, y) || !this.inBounds(x + w - 1, y + h - 1))) {
      throw new RangeError(`Grid: load rect (${x}, ${y}, ${w}x${h}) out of bounds`);
    }
    const out = new Float64Array(Math.max(0, w) * Math.max(0, h));
    if (out.length === 0) return out;
    if (x === 0 && w === this.width) {
      out.set(arr.subarray(y * w, (y + h) * w));
      return out;
    }
    for (let ty = 0; ty < h; ty++) out.set(arr.subarray((y + ty) * this.width + x, (y + ty) * this.width + x + w), ty * w);
    return out;
  }

  /** Read-only access to a field's raw array, for renderers and overlays. Do not write to it. */
  raw(field: string): Readonly<FieldArray> {
    return this.array(field);
  }

  /** JSON-able snapshot with typed arrays as base64. */
  serialize(): GridData {
    const fields: GridData['fields'] = {};
    for (const name of [...this.types.keys()].sort()) {
      fields[name] = { type: this.types.get(name) as FieldType, data: toBase64(this.array(name)) };
    }
    return { id: this.id, width: this.width, height: this.height, fields };
  }

  /** Rebuild a Grid from serialize() output. */
  static deserialize(data: GridData): DenseGrid {
    const spec: FieldSpec = {};
    for (const [name, f] of Object.entries(data.fields)) spec[name] = f.type;
    const grid = new DenseGrid(data.id, data.width, data.height, spec);
    for (const [name, f] of Object.entries(data.fields)) {
      grid.arrays.set(name, fromBase64(f.type, f.data, data.width * data.height));
    }
    return grid;
  }

  private array(field: string): FieldArray {
    const arr = this.arrays.get(field);
    if (!arr) throw new Error(`Grid: unknown field "${field}"`);
    return arr;
  }

  private index(x: number, y: number): number {
    if (!this.inBounds(x, y)) throw new RangeError(`Grid: (${x}, ${y}) out of bounds`);
    return y * this.width + x;
  }
}

/**
 * `Grid` as a type is any grid systems and render see (`GridLike`: a dense grid or a window into the sector). As a value
 * it builds a dense grid, so `new Grid(...)` keeps working. Both go away with `sim.grids` (sector step 7).
 */
export type Grid = GridLike;
export const Grid = DenseGrid;
