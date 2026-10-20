import { CHUNK_SIZE, type GridLike, type Rect } from './grid';
import type { SectorGrid } from './sectorGrid';
import { ShipC, type Ship } from './combat/components';
import type { World } from './ecs';

/**
 * One ship's rectangle of the sector grid, in **sector coordinates**: `get(x, y)` reads sector tile (x, y), and the view only
 * adds the bounds of the ship's rectangle (`x0`, `y0`, `width`, `height`: the ShipC x, y, width, height), so `inBounds`
 * and the edge checks of Grid-shaped code (EVA ring, space adjacency, power networks, A*) keep their meaning. Writes go
 * straight through to the sector. Nothing registers or saves a view: `shipGrid` derives it from the ShipC rectangle, and
 * `id` is the ship id (the ShipC entity).
 */
export class ShipGrid implements GridLike {
  constructor(
    /** The ship id (ShipC entity). */
    readonly id: number,
    readonly sector: SectorGrid,
    readonly x0: number,
    readonly y0: number,
    readonly width: number,
    readonly height: number,
  ) {}

  /** The rectangle in sector tiles. */
  get rect(): Rect {
    return { x: this.x0, y: this.y0, w: this.width, h: this.height };
  }

  has(field: string): boolean {
    return this.sector.has(field);
  }

  fieldNames(): string[] {
    return this.sector.fieldNames();
  }

  inBounds(x: number, y: number): boolean {
    return Number.isInteger(x) && Number.isInteger(y) && x >= this.x0 && y >= this.y0 && x < this.x0 + this.width && y < this.y0 + this.height;
  }

  get(field: string, x: number, y: number): number {
    this.check(x, y);
    return this.sector.get(field, x, y);
  }

  set(field: string, x: number, y: number, value: number): void {
    this.check(x, y);
    this.sector.set(field, x, y, value);
  }

  /** Sum of the revisions of the sector chunks the rectangle overlaps; changes whenever a tile in them is written. */
  revision(field: string): number {
    return this.sumRevisions(field, this.x0, this.y0, this.width, this.height);
  }

  /** Revision of sector chunk (cx, cy), which must overlap the rectangle. */
  chunkRevision(field: string, cx: number, cy: number): number {
    const x = cx * CHUNK_SIZE, y = cy * CHUNK_SIZE;
    const a = Math.max(x, this.x0), b = Math.max(y, this.y0);
    const c = Math.min(x + CHUNK_SIZE, this.x0 + this.width), d = Math.min(y + CHUNK_SIZE, this.y0 + this.height);
    if (a >= c || b >= d) throw new RangeError(`ShipGrid chunk (${cx}, ${cy}) out of bounds`);
    return this.sumRevisions(field, a, b, c - a, d - b);
  }

  /**
   * Scratch copy of a field over a sector rectangle (default: the ship's), row-major. The rectangle may reach past the ship
   * (a padded region frame): those tiles read straight from the sector.
   */
  load(field: string, rect: Rect = this.rect): Float64Array {
    return this.sector.load(field, rect);
  }

  private sumRevisions(field: string, x0: number, y0: number, w: number, h: number): number {
    if (!this.sector.has(field)) throw new Error(`ShipGrid: unknown field "${field}"`);
    if (w <= 0 || h <= 0) return 0;
    let sum = 0;
    for (let cy = Math.floor(y0 / CHUNK_SIZE); cy <= Math.floor((y0 + h - 1) / CHUNK_SIZE); cy++) {
      for (let cx = Math.floor(x0 / CHUNK_SIZE); cx <= Math.floor((x0 + w - 1) / CHUNK_SIZE); cx++) {
        sum += this.sector.chunkRevision(field, cx, cy);
      }
    }
    return sum;
  }

  private check(x: number, y: number): void {
    if (!this.inBounds(x, y)) throw new RangeError(`ShipGrid: (${x}, ${y}) out of bounds`);
  }
}

const views = new WeakMap<SectorGrid, Map<number, ShipGrid>>();

/**
 * The view of ship `ship` over `sector`, from its ShipC rectangle; undefined for an id that is not a ship. The same object
 * is returned while the rectangle is unchanged, so caches can key on it.
 */
export function shipGridOf(sector: SectorGrid, world: World, ship: number): ShipGrid | undefined {
  const s: Ship | undefined = ship ? world.get(ship, ShipC) : undefined;
  if (!s) return undefined;
  let byShip = views.get(sector);
  if (!byShip) views.set(sector, (byShip = new Map()));
  const hit = byShip.get(ship);
  if (hit && hit.x0 === s.x && hit.y0 === s.y && hit.width === s.width && hit.height === s.height) return hit;
  const view = new ShipGrid(ship, sector, s.x, s.y, s.width, s.height);
  byShip.set(ship, view);
  return view;
}
