import { isTileWalkable } from '../modules/walk';
import { shipGrid, shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { JobC, PathC, type Path, type Position } from './components';
import { origin } from './helpers';
import { findPath, type Tile } from './pathfind';

/**
 * An idle crew member standing on a module site steps out to the nearest free tile beside it, so the finished module is
 * never held up by someone who is only standing there. True if a move was started.
 */
export function vacateSite(sim: Sim, id: number, pos: Position): boolean {
  const here = origin(pos);
  const ship = shipIdOf(sim, pos);
  const site = [...sim.world.query(JobC)]
    .map((j) => sim.world.get(j, JobC))
    .find((j) => j && j.kind === 'module' && j.size && shipIdOf(sim, j) === ship
      && here.x >= j.x && here.x < j.x + j.size[0] && here.y >= j.y && here.y < j.y + j.size[1]);
  const grid = shipGrid(sim, ship);
  if (!site?.size || !grid) return false;
  const [w, h] = site.size;
  const ring: Tile[] = [];
  for (let y = site.y - 1; y <= site.y + h; y++) for (let x = site.x - 1; x <= site.x + w; x++) {
    const inside = x >= site.x && x < site.x + w && y >= site.y && y < site.y + h;
    if (!inside && grid.inBounds(x, y) && isTileWalkable(sim, grid, x, y)) ring.push({ x, y });
  }
  let best: Tile[] | null = null;
  for (const t of ring) {
    const steps = findPath(sim, ship, here, t);
    if (steps && steps.length > 0 && (!best || steps.length < best.length)) best = steps;
  }
  if (!best) return false;
  (sim.world.get(id, PathC) as Path).steps = best;
  return true;
}
