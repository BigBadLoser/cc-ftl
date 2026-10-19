import { ShipC, type Ship } from './combat/components';
import type { GridLike, Rect } from './grid';
import { GridWindow } from './gridWindow';
import type { Sim } from './sim';
import { Struct } from './structure';
import { MIN_SHIP_GAP, REGION_PAD } from './tuning';

/** One structure in the sector that field systems run over: a grid window and the ship that owns it (if any). */
export interface Region {
  gridId: number;
  grid: GridLike;
  /** The `ShipC` entity of the grid, or 0 (a fixture grid with no ship). */
  ship: number;
  /** The grid's rectangle in sector tiles (today exactly its template bbox). */
  bbox: Rect;
  /** `bbox` grown by REGION_PAD on every side: the EVA ring and one tile of venting vacuum. */
  frame: Rect;
}

/** A rectangle grown by `by` tiles on every side. */
export function padded(r: Rect, by: number): Rect {
  return { x: r.x - by, y: r.y - by, w: r.w + 2 * by, h: r.h + 2 * by };
}

/** True if two rectangles share a tile. */
export function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** A ship's padded frame in sector tiles: its bbox (ShipC x, y, width, height) plus REGION_PAD. */
export function shipFrame(ship: Ship): Rect {
  return padded({ x: ship.x, y: ship.y, w: ship.width, h: ship.height }, REGION_PAD);
}

/**
 * Every region, in ascending grid id: the fixed order field systems iterate in (never Map insertion order, so a load or
 * a different spawn order cannot reorder rng draws). Grids and their ships spawn with ascending ids, so this is also
 * ShipC query order, and the order systems always ran in.
 */
export function regions(sim: Sim): Region[] {
  const ships = new Map<number, number>();
  for (const id of sim.world.query(ShipC)) {
    const gridId = sim.world.get(id, ShipC)?.gridId;
    if (gridId !== undefined && !ships.has(gridId)) ships.set(gridId, id);
  }
  return [...sim.grids.keys()].sort((a, b) => a - b).map((gridId) => {
    const grid = sim.grids.get(gridId) as GridLike;
    const bbox = grid instanceof GridWindow
      ? { x: grid.ox, y: grid.oy, w: grid.width, h: grid.height }
      : { x: 0, y: 0, w: grid.width, h: grid.height };
    return { gridId, grid, ship: ships.get(gridId) ?? 0, bbox, frame: padded(bbox, REGION_PAD) };
  });
}

/** The `ShipC` entity owning the sector tile (x, y), or 0 (Space, or structure no ship owns). */
export function shipAt(sim: Sim, x: number, y: number): number {
  return sim.sector.grid.get('ship', x, y);
}

/** Write `ship` as the owner of every non-Space tile of a grid (stamping a ship into the sector). */
export function stampOwner(grid: GridLike, ship: number): void {
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (grid.get('struct', x, y) !== Struct.Space && grid.get('ship', x, y) !== ship) grid.set('ship', x, y, ship);
    }
  }
}

/**
 * Why a ship with sector bbox `bbox` cannot be placed, or null: 'overlap' if it shares a tile with another grid,
 * 'tooClose' if its padded frame comes within MIN_SHIP_GAP of another grid's padded frame.
 */
export function placementGapError(sim: Sim, bbox: Rect): 'overlap' | 'tooClose' | null {
  const reach = padded(bbox, REGION_PAD + MIN_SHIP_GAP);
  let close = false;
  for (const r of regions(sim)) {
    if (intersects(bbox, r.bbox)) return 'overlap';
    if (intersects(reach, r.frame)) close = true;
  }
  return close ? 'tooClose' : null;
}
