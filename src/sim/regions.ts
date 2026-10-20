import { ShipC, type Ship } from './combat/components';
import type { GridLike, Rect } from './grid';
import type { Sim } from './sim';
import { Struct } from './structure';
import { MIN_SHIP_GAP, REGION_PAD } from './tuning';

/** One structure in the sector that field systems run over: a grid window and the ship that owns it (if any). */
export interface Region {
  gridId: number;
  grid: GridLike;
  /** The `ShipC` entity of the grid, or 0 (a fixture grid with no ship). */
  ship: number;
  /** The grid's rectangle in sector tiles (exactly its template bbox; the grid reads sector coordinates). */
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
    const bbox = { x: grid.x0, y: grid.y0, w: grid.width, h: grid.height };
    return { gridId, grid, ship: ships.get(gridId) ?? 0, bbox, frame: padded(bbox, REGION_PAD) };
  });
}

/** The `ShipC` entity owning the sector tile (x, y), or 0 (Space, or structure no ship owns). */
export function shipAt(sim: Sim, x: number, y: number): number {
  return sim.sector.grid.get('ship', x, y);
}

/** The grid id of the ship owning the sector tile (x, y), else of the grid whose rectangle or EVA ring holds it, or 0 (open Space). Bridges to gridId-keyed code until step 7 ends. */
export function gridIdAt(sim: Sim, x: number, y: number): number {
  const ship = shipAt(sim, x, y);
  const owned = ship === 0 ? 0 : sim.world.get(ship, ShipC)?.gridId ?? 0;
  if (owned !== 0) return owned;
  // No owner: Space inside a grid's rectangle (or a fixture grid with no ship), else the EVA ring around one (its padded
  // frame; frames never overlap). The lowest id wins a tie, as sorted iteration did.
  let rect = 0;
  let ring = 0;
  for (const [id, g] of sim.grids) {
    if (g.inBounds(x, y)) {
      if (rect === 0 || id < rect) rect = id;
    } else if (ring === 0 || id < ring) {
      if (x >= g.x0 - REGION_PAD && x < g.x0 + g.width + REGION_PAD && y >= g.y0 - REGION_PAD && y < g.y0 + g.height + REGION_PAD) ring = id;
    }
  }
  return rect !== 0 ? rect : ring;
}

/** Write `ship` as the owner of every non-Space tile of a grid (stamping a ship into the sector). */
export function stampOwner(grid: GridLike, ship: number): void {
  for (let y = grid.y0; y < grid.y0 + grid.height; y++) {
    for (let x = grid.x0; x < grid.x0 + grid.width; x++) {
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

/**
 * Ships whose grid window is not where their `ShipC` says (window origin != ShipC x, y, or a different size), as readable
 * messages; empty when every window agrees. Ships without a window (lifted, or a fixture ShipC with no grid) are skipped.
 * The coordinate flip (step 6) relies on this holding everywhere, so tests assert it.
 */
export function windowShipMismatches(sim: Sim): string[] {
  const out: string[] = [];
  for (const id of sim.world.query(ShipC)) {
    const s = sim.world.get(id, ShipC) as Ship;
    const g = sim.grids.get(s.gridId);
    if (!g) continue;
    const ox = g.x0, oy = g.y0;
    if (ox !== s.x || oy !== s.y || g.width !== s.width || g.height !== s.height) {
      out.push(`ship ${id} (grid ${s.gridId}): ShipC ${s.x},${s.y} ${s.width}x${s.height}, window ${ox},${oy} ${g.width}x${g.height}`);
    }
  }
  return out;
}

/** The grid id of the ship a placed thing (a module, anything with a sector tile `x`, `y`) stands on; 0 for none. */
export function gridIdOf(sim: Sim, at: { x: number; y: number } | undefined): number {
  return at ? gridIdAt(sim, at.x, at.y) : 0;
}
