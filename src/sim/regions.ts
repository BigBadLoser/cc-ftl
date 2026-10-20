import { ShipC, type Ship } from './combat/components';
import type { GridLike, Rect } from './grid';
import { shipGridOf, type ShipGrid } from './shipGrid';
import type { Sim } from './sim';
import { Struct } from './structure';
import { MIN_SHIP_GAP, REGION_PAD } from './tuning';

/** One ship's structure in the sector, what field systems run over: the shared sector grid and the ship's rectangle. */
export interface Region {
  /** The `ShipC` entity (the ship id). */
  ship: number;
  /** The ship's bounded view of the sector grid (exactly `bbox`). */
  grid: ShipGrid;
  /** The ship's rectangle in sector tiles (exactly its template bbox). */
  bbox: Rect;
  /** `bbox` grown by REGION_PAD on every side: the EVA ring and one tile of venting vacuum. */
  frame: Rect;
}

/** Every ship id (ShipC entity), ascending: the order ships were created in. */
export function shipIds(sim: Sim): number[] {
  return [...sim.world.query(ShipC)].sort((a, b) => a - b);
}

/** The bounded view of ship `ship` over the sector grid (its ShipC rectangle), or undefined for no such ship. */
export function shipGrid(sim: Sim, ship: number): ShipGrid | undefined {
  return shipGridOf(sim.sector.grid, sim.world, ship);
}

/** A rectangle grown by `by` tiles on every side. */
export function padded(r: Rect, by: number): Rect {
  return { x: r.x - by, y: r.y - by, w: r.w + 2 * by, h: r.h + 2 * by };
}

/** True if two rectangles share a tile. */
export function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** A ship's rectangle in sector tiles: ShipC x, y, width, height. Every per-ship bound (EVA ring, space adjacency, power networks) is read from it. */
export function shipRect(ship: Ship): Rect {
  return { x: ship.x, y: ship.y, w: ship.width, h: ship.height };
}

/** True if the (integer) tile lies inside the rectangle. */
export function inRect(r: Rect, x: number, y: number): boolean {
  return Number.isInteger(x) && Number.isInteger(y) && x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
}

/** A ship's padded frame in sector tiles: its bbox (ShipC x, y, width, height) plus REGION_PAD. */
export function shipFrame(ship: Ship): Rect {
  return padded(shipRect(ship), REGION_PAD);
}

/**
 * Every region, in ascending ship id: the fixed order field systems iterate in (never Map insertion order, so a load or
 * a different spawn order cannot reorder rng draws). Ships spawn with ascending ids, which is the order systems always ran in.
 */
export function regions(sim: Sim): Region[] {
  const out: Region[] = [];
  for (const ship of [...sim.world.query(ShipC)].sort((a, b) => a - b)) {
    const s = sim.world.get(ship, ShipC) as Ship;
    const bbox = shipRect(s);
    out.push({ ship, grid: shipGridOf(sim.sector.grid, sim.world, ship) as ShipGrid, bbox, frame: padded(bbox, REGION_PAD) });
  }
  return out;
}

/** The `ShipC` entity owning the sector tile (x, y), or 0 (Space, or structure no ship owns). */
export function shipAt(sim: Sim, x: number, y: number): number {
  return sim.sector.grid.get('ship', x, y);
}

/**
 * The ship id at the sector tile (x, y): the owner layer; else the lowest-id ship whose rectangle holds it (Space inside a
 * bbox), else the lowest-id ship whose padded frame (the EVA ring) does (frames never overlap); else 0 (open Space).
 */
export function shipIdAt(sim: Sim, x: number, y: number): number {
  const owner = shipAt(sim, x, y);
  if (owner !== 0) return owner;
  let rect = 0;
  let ring = 0;
  for (const id of sim.world.query(ShipC)) {
    const s = sim.world.get(id, ShipC) as Ship;
    if (inRect(shipRect(s), x, y)) {
      if (rect === 0 || id < rect) rect = id;
    } else if ((ring === 0 || id < ring) && inRect(shipFrame(s), x, y)) ring = id;
  }
  return rect !== 0 ? rect : ring;
}

/** The ship id of the ship a placed thing (anything with a sector tile `x`, `y`) stands on, by the rule of `shipIdAt`; 0 for none. */
export function shipIdOf(sim: Sim, at: { x: number; y: number } | undefined): number {
  return at ? shipIdAt(sim, at.x, at.y) : 0;
}

/** True if the tile lies inside the rectangle of ship `ship` (false for no such ship). The bound every on-ship rule uses. */
export function inShip(sim: Sim, ship: number, x: number, y: number): boolean {
  const s = ship ? sim.world.get(ship, ShipC) : undefined;
  return !!s && inRect(shipRect(s), x, y);
}

/** Write `ship` as the owner of every non-Space tile of its rectangle (stamping a ship into the sector). */
export function stampOwner(grid: GridLike, ship: number, rect: Rect): void {
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
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
