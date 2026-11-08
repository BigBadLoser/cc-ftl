import { CHUNK_SIZE, type FieldArray, type Rect } from './grid';
import type { SectorGrid } from './sectorGrid';

/**
 * Bulk reads and writes of a `SectorGrid` field over a rectangle, a chunk at a time, for the field solvers (diffusion.ts). Each
 * is exactly equivalent to the per-tile `get` / `set` calls it replaces; it only saves the directory lookup per tile.
 */

const CHUNK_SHIFT = Math.log2(CHUNK_SIZE);
const CHUNK_MASK = CHUNK_SIZE - 1;

/** The tiles of chunk (cx, cy) inside `rect`, as tile ranges [tx0, tx1) x [ty0, ty1). */
function span(rect: Rect, cx: number, cy: number): { tx0: number; tx1: number; ty0: number; ty1: number } {
  const { x, y, w, h } = rect;
  return {
    tx0: Math.max(x, cx * CHUNK_SIZE), tx1: Math.min(x + w, cx * CHUNK_SIZE + CHUNK_SIZE),
    ty0: Math.max(y, cy * CHUNK_SIZE), ty1: Math.min(y + h, cy * CHUNK_SIZE + CHUNK_SIZE),
  };
}

/** Chunk (cx, cy)'s part of `grid.load(field, rect)`, into `out` (row-major over `rect`): empty values where it is not allocated. */
export function loadChunkInto(grid: SectorGrid, field: string, rect: Rect, out: Float64Array, cx: number, cy: number): void {
  const { tx0, tx1, ty0, ty1 } = span(rect, cx, cy);
  if (tx0 >= tx1 || ty0 >= ty1) return;
  const arr = grid.chunkData(field, cx, cy);
  const empty = grid.emptyValue(field);
  const lx = tx0 & CHUNK_MASK, n = tx1 - tx0;
  for (let ty = ty0; ty < ty1; ty++) {
    const at = (ty - rect.y) * rect.w + (tx0 - rect.x);
    if (!arr) {
      out.fill(empty, at, at + n);
      continue;
    }
    const src = ((ty & CHUNK_MASK) << CHUNK_SHIFT) + lx;
    for (let k = 0; k < n; k++) out[at + k] = arr[src + k] as number;
  }
}

const rounded = (v: number): number => Math.min(255, Math.max(0, Math.round(v)));

/** `writeDelta` for one chunk the fast path cannot take (not allocated, or the occupancy field): a plain `set` per changed tile. */
function writeTiles(grid: SectorGrid, field: string, rect: Rect, cx: number, cy: number, vals: Float64Array, before: Float64Array, eps: number, round: boolean, sync: boolean): number {
  const { tx0, tx1, ty0, ty1 } = span(rect, cx, cy);
  let wrote = 0;
  for (let ty = ty0; ty < ty1; ty++) {
    for (let tx = tx0; tx < tx1; tx++) {
      const i = (ty - rect.y) * rect.w + (tx - rect.x);
      const v = round ? rounded(vals[i] as number) : (vals[i] as number);
      if (Math.abs(v - (before[i] as number)) > eps) {
        grid.set(field, tx, ty, v);
        if (sync) before[i] = grid.get(field, tx, ty);
        wrote++;
      }
    }
  }
  return wrote;
}

/**
 * Write `vals` (row-major over `rect`) where a value differs from `before` by more than `eps` (`round`: rounded and clamped to
 * 0..255 first), exactly as a `set` per such tile would: same stored values, revisions, watch count and chunk allocation.
 * Returns how many tiles it wrote. `sync`: also store each written tile's new value (as the field holds it) in `before`, which
 * then mirrors the field over `rect`.
 */
export function writeDelta(grid: SectorGrid, field: string, rect: Rect, vals: Float64Array, before: Float64Array, eps: number, round: boolean, sync: boolean): number {
  const { x, y, w, h } = rect;
  if (w <= 0 || h <= 0) return 0;
  if (!grid.inBounds(x, y) || !grid.inBounds(x + w - 1, y + h - 1)) throw new RangeError(`SectorGrid: write rect (${x}, ${y}, ${w}x${h}) out of range`);
  const watch = grid.watch();
  const watched = watch?.field === field, below = watch?.below ?? 0;
  let wrote = 0;
  for (let cy = y >> CHUNK_SHIFT; cy <= (y + h - 1) >> CHUNK_SHIFT; cy++) {
    for (let cx = x >> CHUNK_SHIFT; cx <= (x + w - 1) >> CHUNK_SHIFT; cx++) {
      const arr: FieldArray | undefined = grid.bulkChunk(field, cx, cy);
      if (!arr) {
        wrote += writeTiles(grid, field, rect, cx, cy, vals, before, eps, round, sync);
        continue;
      }
      const { tx0, tx1, ty0, ty1 } = span(rect, cx, cy);
      let n = 0, crossed = 0;
      for (let ty = ty0; ty < ty1; ty++) {
        const row = (ty - y) * w - x, crow = (ty & CHUNK_MASK) << CHUNK_SHIFT;
        for (let tx = tx0; tx < tx1; tx++) {
          const i = row + tx;
          const v = round ? rounded(vals[i] as number) : (vals[i] as number);
          const d = v - (before[i] as number);
          // |d| > eps, without the call (NaN fails both, as it fails Math.abs(d) > eps).
          if (d > eps || -d > eps) {
            const j = crow + (tx & CHUNK_MASK);
            const was = arr[j] as number;
            arr[j] = v;
            if (sync) before[i] = arr[j] as number;
            if (watched && was < below !== (arr[j] as number) < below) crossed++;
            n++;
          }
        }
      }
      if (n > 0) grid.bulkWrote(field, cx, cy, n, crossed);
      wrote += n;
    }
  }
  return wrote;
}
