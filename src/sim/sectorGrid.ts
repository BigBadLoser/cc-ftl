import {
  allocate,
  CHUNK_SIZE,
  fromBase64,
  toBase64,
  type FieldArray,
  type FieldSpec,
  type FieldType,
  type GridLike,
  type Rect,
} from './grid';

/** Field name -> value a tile has when no chunk holds it (vacuum). */
export type EmptySpec = Record<string, number>;

export type { Rect };

/** JSON-able snapshot of a SectorGrid. Chunks are sorted by key; revisions are not saved. */
export interface SectorGridData {
  spec: FieldSpec;
  empty: EmptySpec;
  occupancy: string | null;
  chunks: { cx: number; cy: number; fields: Record<string, string> }[];
}

export interface SectorGridOptions {
  /** Field whose non-empty tiles keep a chunk alive (default `struct` when the spec has it, else none: never released). */
  occupancyField?: string | null;
}

const CHUNK_AREA = CHUNK_SIZE * CHUNK_SIZE;
const CHUNK_SHIFT = 4;
const CHUNK_MASK = CHUNK_SIZE - 1;
const CHUNK_OFFSET = 32768;
const CHUNK_RANGE = 65536;

interface Chunk {
  /** One array per field, in field order. */
  arrays: FieldArray[];
  /** Count of tiles whose occupancy field differs from its empty value. */
  solid: number;
}

/** Directory key of a chunk. Sorting keys sorts by cy, then cx. */
export function chunkKey(cx: number, cy: number): number {
  return (cy + CHUNK_OFFSET) * CHUNK_RANGE + (cx + CHUNK_OFFSET);
}

function keyCx(key: number): number {
  return (key % CHUNK_RANGE) - CHUNK_OFFSET;
}

function keyCy(key: number): number {
  return Math.floor(key / CHUNK_RANGE) - CHUNK_OFFSET;
}

/**
 * One large sparse tile grid in sector-tile coordinates (negative allowed). Tiles live in 16x16 chunks that exist only
 * where something is. A missing chunk reads as each field's empty value; writing any other value allocates it, and a
 * chunk is released when its last non-empty occupancy tile is cleared. Revisions are monotone: they survive release.
 */
export class SectorGrid implements GridLike {
  private readonly names: string[];
  private readonly types: FieldType[];
  private readonly empties: number[];
  private readonly index = new Map<string, number>();
  private readonly occ: number;
  private readonly dir = new Map<number, Chunk>();
  private readonly chunkRevs = new Map<number, Uint32Array>();
  private readonly fieldRevs: number[];
  private sorted: number[] | null = null;

  constructor(
    readonly id: number,
    readonly spec: FieldSpec,
    empty: EmptySpec,
    opts: SectorGridOptions = {},
  ) {
    this.names = Object.keys(spec);
    this.types = this.names.map((n) => spec[n] as FieldType);
    this.empties = this.names.map((n) => {
      const e = empty[n];
      if (e === undefined) throw new Error(`SectorGrid: no empty value for field "${n}"`);
      // Round through the field's storage type so get() on a missing chunk matches get() on a stored empty.
      const probe = allocate(spec[n] as FieldType, 1);
      probe[0] = e;
      return probe[0] as number;
    });
    this.names.forEach((n, i) => this.index.set(n, i));
    const occName = opts.occupancyField === undefined ? ('struct' in spec ? 'struct' : null) : opts.occupancyField;
    if (occName !== null && !this.index.has(occName)) throw new Error(`SectorGrid: unknown occupancy field "${occName}"`);
    this.occ = occName === null ? -1 : (this.index.get(occName) as number);
    this.fieldRevs = this.names.map(() => 0);
  }

  /** Informational extent of the allocated chunks, in tiles. */
  extent(): Rect {
    const keys = this.chunkKeys();
    if (keys.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const k of keys) {
      x0 = Math.min(x0, keyCx(k)); x1 = Math.max(x1, keyCx(k));
      y0 = Math.min(y0, keyCy(k)); y1 = Math.max(y1, keyCy(k));
    }
    return { x: x0 * CHUNK_SIZE, y: y0 * CHUNK_SIZE, w: (x1 - x0 + 1) * CHUNK_SIZE, h: (y1 - y0 + 1) * CHUNK_SIZE };
  }

  get x0(): number {
    return this.extent().x;
  }

  get y0(): number {
    return this.extent().y;
  }

  get width(): number {
    return this.extent().w;
  }

  get height(): number {
    return this.extent().h;
  }

  has(field: string): boolean {
    return this.index.has(field);
  }

  fieldNames(): string[] {
    return [...this.names];
  }

  /** Empty value of a field. */
  emptyValue(field: string): number {
    return this.empties[this.field(field)] as number;
  }

  /** True for any integer inside the directory's coordinate range (about +-524k tiles). */
  inBounds(x: number, y: number): boolean {
    const lim = CHUNK_OFFSET * CHUNK_SIZE;
    return Number.isInteger(x) && Number.isInteger(y) && x >= -lim && y >= -lim && x < lim && y < lim;
  }

  get(field: string, x: number, y: number): number {
    const f = this.field(field);
    this.check(x, y);
    const chunk = this.dir.get(chunkKey(x >> CHUNK_SHIFT, y >> CHUNK_SHIFT));
    if (!chunk) return this.empties[f] as number;
    return (chunk.arrays[f] as FieldArray)[((y & CHUNK_MASK) << CHUNK_SHIFT) + (x & CHUNK_MASK)] as number;
  }

  set(field: string, x: number, y: number, value: number): void {
    const f = this.field(field);
    this.check(x, y);
    const key = chunkKey(x >> CHUNK_SHIFT, y >> CHUNK_SHIFT);
    let chunk = this.dir.get(key);
    if (!chunk) {
      if (value === this.empties[f]) return;
      chunk = this.allocChunk();
      this.dir.set(key, chunk);
      this.sorted = null;
    }
    const arr = chunk.arrays[f] as FieldArray;
    const i = ((y & CHUNK_MASK) << CHUNK_SHIFT) + (x & CHUNK_MASK);
    const before = arr[i] as number;
    arr[i] = value;
    this.bump(key, f);
    if (f === this.occ) {
      const e = this.empties[f];
      chunk.solid += Number((arr[i] as number) !== e) - Number(before !== e);
      if (chunk.solid === 0 && before !== e) this.release(key);
    }
  }

  /** Sector-wide revision of a field: changes whenever any tile of it is written. */
  revision(field: string): number {
    return this.fieldRevs[this.field(field)] as number;
  }

  /** Revision of one chunk of a field; 0 if the chunk was never written. */
  chunkRevision(field: string, cx: number, cy: number): number {
    const f = this.field(field);
    return this.chunkRevs.get(chunkKey(cx, cy))?.[f] ?? 0;
  }

  /** Read-only view of one chunk's 256 tiles (row-major), or undefined if it is not allocated. Do not write to it. */
  chunkData(field: string, cx: number, cy: number): Readonly<FieldArray> | undefined {
    const f = this.field(field);
    return this.dir.get(chunkKey(cx, cy))?.arrays[f];
  }

  /** Scratch copy of a field over a rectangle (default: the allocated extent; row-major, w*h). Missing chunks read empty. */
  load(field: string, rect: Rect = this.extent()): Float64Array {
    const f = this.field(field);
    const { x, y, w, h } = rect;
    const out = new Float64Array(Math.max(0, w) * Math.max(0, h));
    if (w <= 0 || h <= 0) return out;
    const e = this.empties[f] as number;
    if (e !== 0) out.fill(e);
    for (let cy = y >> CHUNK_SHIFT; cy <= (y + h - 1) >> CHUNK_SHIFT; cy++) {
      for (let cx = x >> CHUNK_SHIFT; cx <= (x + w - 1) >> CHUNK_SHIFT; cx++) {
        const arr = this.dir.get(chunkKey(cx, cy))?.arrays[f];
        if (!arr) continue;
        const tx0 = Math.max(x, cx * CHUNK_SIZE), tx1 = Math.min(x + w, cx * CHUNK_SIZE + CHUNK_SIZE);
        const ty0 = Math.max(y, cy * CHUNK_SIZE), ty1 = Math.min(y + h, cy * CHUNK_SIZE + CHUNK_SIZE);
        for (let ty = ty0; ty < ty1; ty++) {
          for (let tx = tx0; tx < tx1; tx++) {
            out[(ty - y) * w + (tx - x)] = arr[((ty & CHUNK_MASK) << CHUNK_SHIFT) + (tx & CHUNK_MASK)] as number;
          }
        }
      }
    }
    return out;
  }

  /** Allocated chunks, sorted by key (rows of cy, then cx). A snapshot: safe to mutate the grid while iterating. */
  chunks(): { cx: number; cy: number }[] {
    return this.chunkKeys().map((k) => ({ cx: keyCx(k), cy: keyCy(k) }));
  }

  /** Number of allocated chunks. */
  get chunkCount(): number {
    return this.dir.size;
  }

  /** Not available on a sector: use chunkData() or load(). Exists only to satisfy GridLike. */
  raw(field: string): Readonly<FieldArray> {
    throw new Error(`SectorGrid has no dense raw("${field}"); use chunkData() or load()`);
  }

  /** JSON-able snapshot: chunks sorted by key, field data as base64. Round trips byte-identically. */
  serialize(): SectorGridData {
    const empty: EmptySpec = {};
    this.names.forEach((n, i) => (empty[n] = this.empties[i] as number));
    const chunks = this.chunkKeys().map((k) => {
      const chunk = this.dir.get(k) as Chunk;
      const fields: Record<string, string> = {};
      for (const n of [...this.names].sort()) fields[n] = toBase64(chunk.arrays[this.index.get(n) as number] as FieldArray);
      return { cx: keyCx(k), cy: keyCy(k), fields };
    });
    return { spec: { ...this.spec }, empty, occupancy: this.occ < 0 ? null : (this.names[this.occ] as string), chunks };
  }

  static deserialize(id: number, data: SectorGridData): SectorGrid {
    const grid = new SectorGrid(id, data.spec, data.empty, { occupancyField: data.occupancy });
    for (const c of data.chunks) {
      const chunk = grid.allocChunk();
      grid.names.forEach((n, f) => {
        const b64 = c.fields[n];
        if (b64 === undefined) throw new Error(`SectorGrid: chunk (${c.cx}, ${c.cy}) lacks field "${n}"`);
        chunk.arrays[f] = fromBase64(grid.types[f] as FieldType, b64, CHUNK_AREA);
      });
      if (grid.occ >= 0) {
        const e = grid.empties[grid.occ];
        for (const v of chunk.arrays[grid.occ] as FieldArray) if (v !== e) chunk.solid++;
      }
      grid.dir.set(chunkKey(c.cx, c.cy), chunk);
    }
    return grid;
  }

  private allocChunk(): Chunk {
    const arrays = this.types.map((t, f) => {
      const a = allocate(t, CHUNK_AREA);
      if (this.empties[f] !== 0) a.fill(this.empties[f] as number);
      return a;
    });
    return { arrays, solid: 0 };
  }

  private release(key: number): void {
    this.dir.delete(key);
    this.sorted = null;
    // The data changed (to empty): bump every field so revision sums never go backwards.
    for (let f = 0; f < this.names.length; f++) this.bump(key, f);
  }

  private bump(key: number, f: number): void {
    let revs = this.chunkRevs.get(key);
    if (!revs) this.chunkRevs.set(key, (revs = new Uint32Array(this.names.length)));
    revs[f] = (revs[f] as number) + 1;
    this.fieldRevs[f] = (this.fieldRevs[f] as number) + 1;
  }

  private chunkKeys(): number[] {
    return (this.sorted ??= [...this.dir.keys()].sort((a, b) => a - b));
  }

  private field(name: string): number {
    const f = this.index.get(name);
    if (f === undefined) throw new Error(`SectorGrid: unknown field "${name}"`);
    return f;
  }

  private check(x: number, y: number): void {
    if (!this.inBounds(x, y)) throw new RangeError(`SectorGrid: (${x}, ${y}) out of range`);
  }
}
