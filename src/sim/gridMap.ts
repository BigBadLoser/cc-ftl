import type { GridLike } from './grid';
import { GridWindow } from './gridWindow';
import { SectorGrid } from './sectorGrid';
import { SHIP_EMPTY, SHIP_FIELDS } from './structure';

/** Where a grid's window sits in the sector: top-left (x, y) in sector tiles and size w x h. Saved with the game. */
export interface GridRect {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Tiles between grids that `sim.grids.set` places itself (test fixtures and other grids with no sector position). */
const AUTO_GAP = 32;

/**
 * A fresh, empty sector grid with the ship fields. Chunks are never released for now (no occupancy field): a chunk whose
 * structure is all gone can still hold module or item ids on Space tiles, and nothing lifts ships yet (step 9 decides).
 */
export function newSectorGrid(): SectorGrid {
  return new SectorGrid(0, SHIP_FIELDS, SHIP_EMPTY, { occupancyField: null });
}

/**
 * `sim.grids` during the sector refactor: grid id -> a `GridWindow` with the exact template bbox, so every caller keeps
 * local coordinates. `stamp` copies a dense grid into the sector at a sector position. `set` with a grid that is not a
 * window of this sector stamps it at the next free spot on row y = 0 (fixtures that build a grid and set it directly).
 * Iteration order is insertion order, as before; stamping refuses a window that overlaps another one.
 */
export class GridMap extends Map<number, GridLike> {
  constructor(private readonly sector: () => SectorGrid) {
    super();
  }

  override set(id: number, grid: GridLike): this {
    if (grid instanceof GridWindow && grid.sector === this.sector()) {
      if (grid.id !== id) throw new Error(`GridMap: window ${grid.id} set as grid ${id}`);
      return super.set(id, grid);
    }
    let x = 0;
    for (const w of this.windows()) x = Math.max(x, w.ox + w.width + AUTO_GAP);
    this.stamp(id, grid, x, 0);
    return this;
  }

  /**
   * Copy every field of `src` (local coordinates) into the sector with its top-left at (x, y), and register the window
   * over it as grid `id`. Space tiles at their empty values allocate nothing. Throws if the id is taken or the rectangle
   * overlaps another window.
   */
  stamp(id: number, src: GridLike, x: number, y: number): GridWindow {
    if (this.has(id)) throw new Error(`GridMap: grid ${id} already exists`);
    if (this.overlaps({ id, x, y, w: src.width, h: src.height })) throw new Error(`GridMap: grid ${id} overlaps another grid`);
    const sector = this.sector();
    for (const field of src.fieldNames()) {
      if (!sector.has(field)) throw new Error(`GridMap: the sector has no field "${field}"`);
    }
    // struct first, so a chunk holding structure is allocated before its other fields are written
    const fields = src.fieldNames().sort((a, b) => Number(b === 'struct') - Number(a === 'struct'));
    for (const field of fields) {
      for (let ly = 0; ly < src.height; ly++) {
        for (let lx = 0; lx < src.width; lx++) {
          const v = src.get(field, lx, ly);
          if (v !== sector.get(field, x + lx, y + ly)) sector.set(field, x + lx, y + ly, v);
        }
      }
    }
    const win = new GridWindow(id, sector, x, y, src.width, src.height);
    super.set(id, win);
    return win;
  }

  /** True if the rectangle intersects any window other than `r.id`'s. */
  overlaps(r: GridRect): boolean {
    for (const w of this.windows()) {
      if (w.id === r.id) continue;
      if (r.x < w.ox + w.width && w.ox < r.x + r.w && r.y < w.oy + w.height && w.oy < r.y + r.h) return true;
    }
    return false;
  }

  /** Window rectangles sorted by id (the save). */
  rects(): GridRect[] {
    return [...this.windows()].sort((a, b) => a.id - b.id).map((w) => ({ id: w.id, x: w.ox, y: w.oy, w: w.width, h: w.height }));
  }

  /** Recreate windows over the current sector grid from saved rectangles (in the given order). */
  restore(rects: readonly GridRect[]): void {
    for (const r of rects) super.set(r.id, new GridWindow(r.id, this.sector(), r.x, r.y, r.w, r.h));
  }

  private *windows(): Iterable<GridWindow> {
    for (const g of this.values()) if (g instanceof GridWindow) yield g;
  }
}
