import { CHUNK_SIZE, type FieldArray, type Grid } from '../sim/grid';
import { ShipGrid } from '../sim/shipGrid';
import { Struct } from '../sim/structure';
import { artKind } from './tiles';

/**
 * Chunk tile views (ARCHITECTURE "Sector grid" §7 step 5b). Per-tile render layers (floors, walls, roofs, cracks, fire,
 * overlays) read a region's tiles straight from the `SectorGrid` chunks (`chunkData`), never through a dense `raw()` copy
 * of the ship window, and key their views per sector chunk on `chunkRevision`.
 *
 * Positions stay region-local (the region's containers sit at its sector offset) until the coordinate flip (step 6): a
 * view converts a sector tile to local by subtracting the region rectangle's top-left (`ox`, `oy`).
 */

/** What a sector chunk store offers the renderer (`SectorGrid` has all of it). */
export interface ChunkSource {
  chunkData(field: string, cx: number, cy: number): Readonly<FieldArray> | undefined;
  chunkRevision(field: string, cx: number, cy: number): number;
  /** What a tile of an unallocated chunk reads as. */
  emptyValue(field: string): number;
}

/** A sector chunk, in chunk coordinates. */
export interface ChunkRef {
  cx: number;
  cy: number;
}

/** One region's tiles as the renderer reads them: a rectangle of a chunk store, with local (window) coordinates. */
export interface RegionTiles {
  readonly src: ChunkSource;
  /** Sector tile of local (0, 0). */
  readonly ox: number;
  readonly oy: number;
  readonly width: number;
  readonly height: number;
  inside(lx: number, ly: number): boolean;
  /**
   * A field at a local tile (the field's empty value in an unallocated chunk); tiles outside the region read 0 (Space
   * for `struct`), as the bounds checks of the dense code did.
   */
  get(field: string, lx: number, ly: number): number;
  /** `struct` at a local tile, Space outside the region. */
  kindAt(lx: number, ly: number): number;
  /** The sector chunks under the region grown by `pad` tiles, in row-major chunk order (cy, then cx). */
  chunks(pad?: number): ChunkRef[];
  /** Local tile rectangle of a sector chunk: [x0, x1) x [y0, y1). */
  chunkRect(c: ChunkRef): { x0: number; y0: number; x1: number; y1: number };
  /**
   * Sum of `field`'s revisions over the chunks within `ring` chunks of `c` (ring 1 = the 3 x 3 block). Chunk revisions only
   * grow, so the sum changes exactly when one of them does.
   */
  rev(field: string, c: ChunkRef, ring?: number): number;
  /**
   * Visit the region's tiles row by row (local y, then x: the order a dense sweep had) whose `struct` is not Space (or
   * every tile of an allocated chunk with `all`), with their local index (`y * width + x`) and position inside their chunk (`ci`, for `chunkData` arrays). Chunks that
   * are not allocated are skipped whole.
   */
  scan(fn: (lx: number, ly: number, idx: number, ci: number, c: ChunkRef) => void, all?: boolean): void;
  /**
   * Change key of `field` for a view of chunk `c` whose tiles look up to `margin` (at most 16) tiles past it: the chunk's
   * own revision plus a hash of the margin strip in the neighbouring chunks (region tiles only). A write deep inside a
   * neighbour leaves it alone, so a tile edit rebuilds one chunk unless it is near a chunk edge. The hash is recomputed
   * only when a neighbour's revision moves.
   */
  key(field: string, c: ChunkRef, margin?: number): string;
  /** `chunkData` of a field, or undefined for an unallocated chunk. */
  data(field: string, c: ChunkRef): Readonly<FieldArray> | undefined;
}

const C = CHUNK_SIZE;
const chunkOf = (t: number): number => Math.floor(t / C);
/** Index of sector tile (sx, sy) inside its chunk's arrays. */
export const inChunk = (sx: number, sy: number): number => (sy - chunkOf(sy) * C) * C + (sx - chunkOf(sx) * C);

/** The chunk tiles of a grid: a window reads its sector's chunks; a plain dense grid (test fixtures) is wrapped at (0, 0). */
export function regionTiles(grid: Grid): RegionTiles {
  let t = cache.get(grid);
  if (!t) {
    t = grid instanceof ShipGrid ? createRegionTiles(grid.sector, grid.x0, grid.y0, grid.width, grid.height) : createRegionTiles(denseChunks(grid), 0, 0, grid.width, grid.height);
    cache.set(grid, t);
  }
  return t;
}
const cache = new WeakMap<Grid, RegionTiles>();

export function createRegionTiles(src: ChunkSource, ox: number, oy: number, width: number, height: number): RegionTiles {
  const inside = (lx: number, ly: number): boolean => lx >= 0 && ly >= 0 && lx < width && ly < height;
  const get = (field: string, lx: number, ly: number): number => {
    if (!inside(lx, ly)) return 0;
    const sx = ox + lx, sy = oy + ly;
    const d = src.chunkData(field, chunkOf(sx), chunkOf(sy));
    return d ? (d[inChunk(sx, sy)] as number) : src.emptyValue(field);
  };
  const strips = new Map<string, { rev: number; hash: number }>();
  const strip = (field: string, c: ChunkRef, m: number): number => {
    const k = `${field}|${m}|${c.cx},${c.cy}`;
    const rev = self.rev(field, c, 1) - src.chunkRevision(field, c.cx, c.cy);
    const e = strips.get(k);
    if (e && e.rev === rev) return e.hash;
    const r = self.chunkRect(c);
    let h = 0x811c9dc5;
    for (let y = r.y0 - m; y < r.y1 + m; y++)
      for (let x = r.x0 - m; x < r.x1 + m; x++) {
        if (x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1) {
          x = r.x1 - 1; // skip the chunk's own tiles
          continue;
        }
        h = Math.imul(h ^ (get(field, x, y) * 2654435761 + 1), 16777619) >>> 0;
      }
    strips.set(k, { rev, hash: h });
    return h;
  };
  const self: RegionTiles = {
    src,
    ox,
    oy,
    width,
    height,
    inside,
    get,
    // asteroid rock (mass and ground) inside a region is drawn by asteroidView: the region's tile art sees it as Space
    kindAt: (lx, ly) => { const k = inside(lx, ly) ? get('struct', lx, ly) : Struct.Space; return k === Struct.Rock || k === Struct.Ground ? Struct.Space : artKind(k); },
    chunks(pad = 0) {
      const out: ChunkRef[] = [];
      if (width <= 0 || height <= 0) return out;
      for (let cy = chunkOf(oy - pad); cy <= chunkOf(oy + height - 1 + pad); cy++)
        for (let cx = chunkOf(ox - pad); cx <= chunkOf(ox + width - 1 + pad); cx++) out.push({ cx, cy });
      return out;
    },
    chunkRect: ({ cx, cy }) => ({ x0: cx * C - ox, y0: cy * C - oy, x1: cx * C + C - ox, y1: cy * C + C - oy }),
    rev(field, { cx, cy }, ring = 0) {
      let sum = 0;
      for (let y = cy - ring; y <= cy + ring; y++) for (let x = cx - ring; x <= cx + ring; x++) sum += src.chunkRevision(field, x, y);
      return sum;
    },
    data: (field, { cx, cy }) => src.chunkData(field, cx, cy),
    key: (field, c, margin = 2) => `${src.chunkRevision(field, c.cx, c.cy)}:${strip(field, c, margin)}`,
    scan(fn, all = false) {
      const cx0 = chunkOf(ox), cx1 = chunkOf(ox + width - 1);
      for (let ly = 0; ly < height; ly++) {
        const sy = oy + ly;
        const cy = chunkOf(sy);
        const row = (sy - cy * C) * C;
        for (let cx = cx0; cx <= cx1; cx++) {
          const struct = src.chunkData('struct', cx, cy);
          if (!struct) continue;
          const c = { cx, cy };
          const lx0 = Math.max(0, cx * C - ox), lx1 = Math.min(width, cx * C + C - ox);
          for (let lx = lx0; lx < lx1; lx++) {
            const ci = row + (ox + lx - cx * C);
            if (!all && struct[ci] === Struct.Space) continue;
            fn(lx, ly, ly * width + lx, ci, c);
          }
        }
      }
    },
  };
  return self;
}

/** Chunks of a dense grid at sector (0, 0), copied on demand and cached on the chunk revision (fixtures only). */
function denseChunks(grid: Grid): ChunkSource {
  const cache = new Map<string, { rev: number; arr: Float32Array }>();
  return {
    emptyValue: () => 0,
    chunkRevision: (field, cx, cy) => {
      const nx = Math.ceil(grid.width / C), ny = Math.ceil(grid.height / C);
      return cx < 0 || cy < 0 || cx >= nx || cy >= ny ? 0 : grid.chunkRevision(field, cx, cy);
    },
    chunkData(field, cx, cy) {
      if (cx < 0 || cy < 0 || cx * C >= grid.width || cy * C >= grid.height) return undefined;
      const k = `${field}|${cx}|${cy}`;
      const rev = grid.chunkRevision(field, cx, cy);
      let e = cache.get(k);
      if (!e || e.rev !== rev) {
        const arr = new Float32Array(C * C);
        for (let y = 0; y < C; y++)
          for (let x = 0; x < C; x++) {
            const gx = cx * C + x, gy = cy * C + y;
            if (grid.inBounds(gx, gy)) arr[y * C + x] = grid.get(field, gx, gy);
          }
        e = { rev, arr };
        cache.set(k, e);
      }
      return e.arr;
    },
  };
}

/**
 * Views keyed per sector chunk. `sync` keeps one view per wanted chunk: it (re)builds a chunk whose key is new or changed
 * (`build` gets the chunk's previous view to clear or reuse) and drops chunks no longer wanted. Returns how many chunks
 * it (re)built.
 */
export interface ChunkViews<V> {
  sync(want: readonly ChunkRef[], key: (c: ChunkRef) => string, build: (c: ChunkRef, old: V | undefined) => V): number;
  /** Views in chunk order (row-major, as `want` listed them). */
  views(): V[];
  get(c: ChunkRef): V | undefined;
  clear(): void;
}

export function createChunkViews<V>(drop: (v: V) => void): ChunkViews<V> {
  const map = new Map<string, { key: string; view: V }>();
  let order: V[] = [];
  const id = (c: ChunkRef) => `${c.cx},${c.cy}`;
  return {
    sync(want, key, build) {
      let built = 0;
      const live = new Set<string>();
      const next: V[] = [];
      for (const c of want) {
        const k = id(c);
        live.add(k);
        const kk = key(c);
        const e = map.get(k);
        if (!e || e.key !== kk) {
          const view = build(c, e?.view);
          map.set(k, { key: kk, view });
          built++;
          next.push(view);
        } else next.push(e.view);
      }
      for (const [k, e] of map)
        if (!live.has(k)) {
          drop(e.view);
          map.delete(k);
        }
      order = next;
      return built;
    },
    views: () => order,
    get: (c) => map.get(id(c))?.view,
    clear() {
      for (const e of map.values()) drop(e.view);
      map.clear();
      order = [];
    },
  };
}
