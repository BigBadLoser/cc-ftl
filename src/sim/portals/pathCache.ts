import { findPath, type PathGoal, type Tile } from '../crew/pathfind';
import type { Grid } from '../grid';
import type { Sim } from '../sim';

/** Most entries one grid's cache keeps before it is dropped and refilled. */
const MAX_ENTRIES = 4000;

interface GridCache {
  /** Revisions of every field findPath reads. The cache is dropped when they change. */
  sig: string;
  paths: Map<string, Tile[] | null>;
}
const caches = new WeakMap<Grid, GridCache>();

/**
 * findPath with a per-grid memo, for the cross-grid planner, which asks for the same legs over and over (every
 * endpoint pair, every crew member). Entries live until the grid's `struct` or `module` field changes, which are the
 * only things the walk rules read, so a hit always equals a fresh search. Hits are shared: callers must copy before
 * mutating. The cache is derived data (never saved) and does not change results, only speed.
 */
export function cachedPath(sim: Sim, gridId: number, from: Tile, goal: PathGoal): readonly Tile[] | null {
  const grid = sim.grids.get(gridId);
  if (!grid?.has('struct')) return null;
  const sig = `${grid.revision('struct')}:${grid.has('module') ? grid.revision('module') : 0}`;
  let c = caches.get(grid);
  if (!c || c.sig !== sig || c.paths.size >= MAX_ENTRIES) {
    c = { sig, paths: new Map() };
    caches.set(grid, c);
  }
  const key = `${from.x},${from.y}>${goal.x},${goal.y}${goal.adjacent ? 'a' : ''}`;
  if (c.paths.has(key)) return c.paths.get(key) ?? null;
  const path = findPath(sim, gridId, from, goal);
  c.paths.set(key, path);
  return path;
}
