/** Storage type of a grid field. */
export type FieldType = 'u8' | 'u16' | 'f32';

/** Field name -> storage type, passed at Grid construction. */
export type FieldSpec = Record<string, FieldType>;

type FieldArray = Uint8Array | Uint16Array | Float32Array;

/** JSON-able snapshot of a Grid. Revisions are not saved; they restart at 0. */
export interface GridData {
  id: number;
  width: number;
  height: number;
  fields: Record<string, { type: FieldType; data: string }>;
}

/** Chunk edge length in tiles, for per-chunk revision tracking. */
export const CHUNK_SIZE = 16;

function allocate(type: FieldType, n: number): FieldArray {
  if (type === 'u8') return new Uint8Array(n);
  if (type === 'u16') return new Uint16Array(n);
  return new Float32Array(n);
}

function toBase64(arr: FieldArray): string {
  const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

function fromBase64(type: FieldType, b64: string, n: number): FieldArray {
  const bin = atob(b64);
  const arr = allocate(type, n);
  const bytes = new Uint8Array(arr.buffer);
  if (bin.length !== bytes.length) throw new Error('Grid: field data length mismatch');
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return arr;
}

/**
 * A rectangular tile grid with named typed-array field layers. All writes go through set(),
 * which bumps a per-field revision and a per-chunk revision so the renderer can diff cheaply.
 */
export class Grid {
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
  static deserialize(data: GridData): Grid {
    const spec: FieldSpec = {};
    for (const [name, f] of Object.entries(data.fields)) spec[name] = f.type;
    const grid = new Grid(data.id, data.width, data.height, spec);
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
