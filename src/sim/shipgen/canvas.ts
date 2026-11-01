import { isContainerCell } from './containerCells';
import type { ChunkDef, RoomRole } from './types';

const ROLES: Record<string, RoomRole> = {
  b: 'bridge', e: 'engine', r: 'reactor', w: 'weapons', s: 'shields', c: 'cargo', q: 'quarters', a: 'core', g: 'hangar', h: 'hall',
  k: 'dock', u: 'support', f: 'farm', i: 'industry', m: 'armoury', p: 'plaza', y: 'garden', x: 'drill',
};

/** Floor letter of a role (inverse of roleOfLetter). */
export const letterOf = (role: RoomRole): string => Object.keys(ROLES).find((k) => ROLES[k] === role) ?? 'h';

/** Role of a fixed-role floor letter (upper case = a second room of the same role), or undefined for a slot digit. */
export const roleOfLetter = (letter: string): RoomRole | undefined => ROLES[letter.toLowerCase()];

/** A room label on the canvas: which chunk instance and which letter of it. */
export interface Label {
  /** Chunk instance key, e.g. 'pod.n.2'. */
  chunk: string;
  letter: string;
}

/**
 * A scratch drawing surface for assembling chunks. Cells hold struct chars ('.', '#', '_', 'D'); floor cells also
 * carry a room label index. Coordinates may be negative: the canvas is offset so stamping anywhere near the origin
 * fits, and `crop` trims it to the used area plus a one-tile space margin.
 */
export class Canvas {
  readonly size: number;
  readonly cells: string[];
  readonly label: Int16Array;
  readonly labels: Label[] = [];
  private readonly labelIds = new Map<string, number>();

  /** Lowest and highest cell index written through this class (a pooled canvas clears only that range). */
  /** Set for pooled canvases (see `acquireCanvas`): every write goes through this class, so `lo`..`hi` bounds the drawing. */
  tracked = false;
  private lo = Infinity;
  private hi = -1;
  private touch(k: number): void {
    if (k < this.lo) this.lo = k;
    if (k > this.hi) this.hi = k;
  }

  /**
   * Back to blank for reuse. Only valid for a canvas whose cells were written through stamp / put / setDoor / fixDoors:
   * the local builders of blocks, never the main ship canvas (thinWalls and the station passes write `cells` directly).
   */
  clear(): void {
    if (this.hi >= 0) {
      this.cells.fill('.', this.lo, this.hi + 1);
      this.label.fill(-1, this.lo, this.hi + 1);
    }
    this.lo = Infinity;
    this.hi = -1;
    this.labels.length = 0;
    this.labelIds.clear();
    this.stamped.length = 0;
  }

  constructor(size = 220) {
    this.size = size;
    this.cells = new Array<string>(size * size).fill('.');
    this.label = new Int16Array(size * size).fill(-1);
  }

  private idx(x: number, y: number): number {
    const o = this.size >> 1;
    const cx = x + o;
    const cy = y + o;
    if (cx < 0 || cy < 0 || cx >= this.size || cy >= this.size) return -1;
    return cy * this.size + cx;
  }

  at(x: number, y: number): string {
    const i = this.idx(x, y);
    return i < 0 ? '.' : (this.cells[i] as string);
  }

  /**
   * Stamp chunk rows with their top-left at (ox, oy), or return false and change nothing if they clash: floor may
   * only land on space, walls and doors never on floor. Doors overwrite walls (a door on a shared edge).
   */
  stamp(rows: readonly string[], ox: number, oy: number, chunk: string): boolean {
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j] as string;
      for (let i = 0; i < row.length; i++) {
        const c = row[i] as string;
        if (c === '.') continue;
        const k = this.idx(ox + i, oy + j);
        if (k < 0) return false;
        const cur = this.cells[k] as string;
        // A container lands only on space; walls and doors never land on a container (beams just pass under it).
        if (isContainerCell(c)) {
          if (cur !== '.') return false;
        } else if (c === '#' || c === 'D' || c === '=') {
          if (cur === '_' || (c !== '=' && isContainerCell(cur))) return false;
        } else if (cur !== '.') return false;
      }
    }
    this.stamped.push(chunk);
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j] as string;
      for (let i = 0; i < row.length; i++) {
        const c = row[i] as string;
        if (c === '.') continue;
        const k = this.idx(ox + i, oy + j);
        const cur = this.cells[k] as string;
        this.touch(k);
        if (isContainerCell(c)) this.cells[k] = c;
        else if (c === '#') {
          if (cur !== 'D') this.cells[k] = '#';
        } else if (c === '=') {
          if (cur === '.') this.cells[k] = '=';
        } else if (c === 'D') this.cells[k] = 'D';
        else {
          this.cells[k] = '_';
          this.label[k] = this.labelOf(chunk, c);
        }
      }
    }
    return true;
  }

  private labelOf(chunk: string, letter: string): number {
    const key = `${chunk}:${letter}`;
    let id = this.labelIds.get(key);
    if (id === undefined) {
      id = this.labels.length;
      this.labels.push({ chunk, letter });
      this.labelIds.set(key, id);
    }
    return id;
  }

  /** Every chunk key stamped so far, in order (parts and hand-made chunks). */
  readonly stamped: string[] = [];

  /** Overwrite one cell (salvage cuts and damage); anything but floor drops the room label. */
  put(x: number, y: number, c: string): void {
    const k = this.idx(x, y);
    if (k < 0) return;
    this.touch(k);
    this.cells[k] = c;
    if (c !== '_') this.label[k] = -1;
  }

  /** Room label index of a cell (-1: none). */
  labelAt(x: number, y: number): number {
    const k = this.idx(x, y);
    return k < 0 ? -1 : (this.label[k] as number);
  }

  /** Put a door on a wall tile (callers check it joins two floors). */
  setDoor(x: number, y: number): void {
    const k = this.idx(x, y);
    if (k >= 0 && this.cells[k] === '#') { this.touch(k); this.cells[k] = 'D'; }
  }

  /** Turn doors that do not join floor on two opposite sides back into walls. */
  fixDoors(): void {
    const o = this.size >> 1;
    for (let k = this.cells.indexOf('D'); k >= 0; k = this.cells.indexOf('D', k + 1)) {
      const x = (k % this.size) - o;
      const y = Math.floor(k / this.size) - o;
      const ns = this.at(x, y - 1) === '_' && this.at(x, y + 1) === '_';
      const ew = this.at(x - 1, y) === '_' && this.at(x + 1, y) === '_';
      if (!ns && !ew) this.cells[k] = '#'; // a door was already there, so the cell is inside the dirty range
    }
  }

  /** Rows of the used area with a one-tile space margin, and the label of every cell in that frame. */
  crop(): { rows: string[]; labels: Int16Array; width: number; height: number; ox: number; oy: number } {
    let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
    // A tracked (pooled) canvas has only been written through this class, so everything drawn lies in [lo, hi].
    const first = this.tracked ? Math.max(0, this.lo) : 0;
    const last = this.tracked ? this.hi + 1 : this.cells.length;
    for (let k = first, x = first % this.size, y = Math.floor(first / this.size); k < last; k++) {
      if (this.cells[k] !== '.') {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
      if (++x === this.size) { x = 0; y++; }
    }
    const width = x1 - x0 + 3;
    const height = y1 - y0 + 3;
    const rows: string[] = [];
    const labels = new Int16Array(width * height).fill(-1);
    for (let y = 0; y < height; y++) {
      let row = '';
      for (let x = 0; x < width; x++) {
        const sx = x0 + x - 1;
        const sy = y0 + y - 1;
        const inside = sx >= 0 && sy >= 0 && sx < this.size && sy < this.size;
        const k = sy * this.size + sx;
        row += inside ? this.cells[k] : '.';
        if (inside) labels[y * width + x] = this.label[k] as number;
      }
      rows.push(row);
    }
    const o = this.size >> 1;
    return { rows, labels, width, height, ox: x0 - 1 - o, oy: y0 - 1 - o };
  }
}

/** Chunk rows flipped top to bottom (a north pod becomes a south pod). */
export function flipRows(rows: readonly string[]): string[] {
  return [...rows].reverse();
}

export const chunkWidth = (c: ChunkDef): number => Math.max(...c.rows.map((r) => r.length));

/** Row indices with a door in column `col` (bow: last column, stern: first column). */
export function doorRows(c: ChunkDef, col: 'first' | 'last'): number[] {
  const w = chunkWidth(c);
  const out: number[] = [];
  c.rows.forEach((r, j) => { if (r[col === 'first' ? 0 : w - 1] === 'D') out.push(j); });
  return out;
}

/** Column indices with a door in the bottom row (pods and nubs). */
export function doorCols(c: ChunkDef): number[] {
  const last = c.rows[c.rows.length - 1] ?? '';
  const out: number[] = [];
  for (let i = 0; i < last.length; i++) if (last[i] === 'D') out.push(i);
  return out;
}

/** Spare blank 220-tile canvases: local builders draw a block, freeze it, and give the canvas back. */
const pool: Canvas[] = [];

export function acquireCanvas(): Canvas {
  const c = pool.pop() ?? new Canvas();
  c.tracked = true;
  return c;
}

export function releaseCanvas(c: Canvas): void {
  c.clear();
  pool.push(c);
}
