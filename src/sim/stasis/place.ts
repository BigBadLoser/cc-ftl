import type { Tile } from '../crew/pathfind';
import { isTileOccupied } from '../crew/helpers';
import { isTileWalkable } from '../modules/walk';
import { shipGrid } from '../regions';
import type { Sim } from '../sim';
import { StasisC } from './components';
import { PLACE_STEPS } from './tuning';

const DIRS: readonly (readonly [number, number])[] = [[1, 0], [0, 1], [-1, 0], [0, -1]];

/** The nearest tile to `from` (breadth first over walkable tiles, at most PLACE_STEPS away, `from` first) that passes `ok`, or null. */
export function tileNear(sim: Sim, ship: number, from: Tile, ok: (x: number, y: number) => boolean): Tile | null {
  const grid = shipGrid(sim, ship);
  if (!grid?.has('struct') || !grid.inBounds(from.x, from.y)) return null;
  const walk = (x: number, y: number): boolean => grid.inBounds(x, y) && isTileWalkable(sim, grid, x, y);
  if (walk(from.x, from.y) && ok(from.x, from.y)) return from;
  const seen = new Set<number>([from.y * grid.width + from.x]);
  let ring: Tile[] = [from];
  for (let d = 1; d <= PLACE_STEPS && ring.length > 0; d++) {
    const next: Tile[] = [];
    for (const t of ring) {
      for (const [dx, dy] of DIRS) {
        const x = t.x + dx, y = t.y + dy, k = y * grid.width + x;
        if (seen.has(k) || !walk(x, y)) continue;
        seen.add(k);
        if (ok(x, y)) return { x, y };
        next.push({ x, y });
      }
    }
    ring = next;
  }
  return null;
}

/** The tiles a slab lying on the floor covers: its head (x, y) and its foot along +x (rot 0) or +y (rot 1). */
export function floorTiles(x: number, y: number, rot: 0 | 1): [Tile, Tile] {
  return [{ x, y }, rot === 0 ? { x: x + 1, y } : { x, y: y + 1 }];
}

/** Tiles covered by slabs lying on the floor (sector tiles, `x,y` keys), but `except`'s. */
function slabFloor(sim: Sim, except: number): Set<string> {
  const out = new Set<string>();
  for (const id of sim.world.query(StasisC)) {
    const s = sim.world.get(id, StasisC);
    if (!s || s.at !== 'floor' || id === except) continue;
    for (const t of floorTiles(s.x, s.y, s.rot)) out.add(`${t.x},${t.y}`);
  }
  return out;
}

/**
 * Where a slab put down near `from` lies: the nearest walkable tile with a walkable neighbour along +x or +y, neither under another slab, and the
 * way it lies. Falls back to `from` lying along +x (a slab is always somewhere).
 */
export function floorSpot(sim: Sim, prisoner: number, ship: number, from: Tile): { x: number; y: number; rot: 0 | 1 } {
  const grid = shipGrid(sim, ship);
  const taken = slabFloor(sim, prisoner);
  const free = (x: number, y: number): boolean => !!grid && grid.inBounds(x, y) && isTileWalkable(sim, grid, x, y) && !taken.has(`${x},${y}`);
  let rot: 0 | 1 = 0;
  const at = tileNear(sim, ship, from, (x, y) => {
    if (!free(x, y)) return false;
    if (free(x + 1, y)) rot = 0;
    else if (free(x, y + 1)) rot = 1;
    else return false;
    return true;
  });
  return at ? { ...at, rot } : { x: from.x, y: from.y, rot: 0 };
}

/** A free tile near `from` for a crew member to stand on (walkable, nobody on it), or `from` itself. */
export function standSpot(sim: Sim, ship: number, from: Tile): Tile {
  return tileNear(sim, ship, from, (x, y) => !isTileOccupied(sim, ship, x, y)) ?? from;
}
