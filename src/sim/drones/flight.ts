import type { Body } from '../body';
import { findPath } from '../crew/pathfind';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import type { Drone } from './components';

/**
 * Drone flight inside a ship (DESIGN.md "Drones"). A drone flies over solid modules, furniture and crew (`fly` in the walk rule), so it goes
 * where walkers cannot, but it is still inside the hull: walls and doors that cannot open bar it, and an open doorway lets it through (and is
 * held open while it passes, like a walker). The route is an ordinary tile path; the body moves continuously from tile centre to tile
 * centre in sector tiles, so the same body later flies free in space (slice 2) with a different planner.
 */

/** The tile the body is over. */
export const bodyTile = (b: Body): { x: number; y: number } => ({ x: Math.floor(b.x), y: Math.floor(b.y) });

/** Plan a flight from where the body is to (x, y) on the ship; false when no way is open. An empty route means it is there already. */
export function planFlight(sim: Sim, d: Drone, b: Body, x: number, y: number): boolean {
  const steps = findPath(sim, d.ship, bodyTile(b), { x, y }, { fly: true });
  if (!steps) return false;
  d.steps = steps;
  return true;
}

/** True when the body has reached the centre of (x, y). */
export function arrived(b: Body, x: number, y: number): boolean {
  return Math.abs(b.x - (x + 0.5)) < 1e-6 && Math.abs(b.y - (y + 0.5)) < 1e-6;
}

/**
 * Fly along the route for one tick at `speed` tiles a second. Returns false if the next tile has closed (a door jammed shut, a wall built):
 * the caller plans again. With no steps left it settles onto its tile's centre. `wait` says the next tile is a shut airlock door (already asked to
 * cycle): the drone holds where it is until it opens, like a walker.
 */
export function fly(
  d: Drone, b: Body, speed: number, open: (x: number, y: number) => boolean, wait: (x: number, y: number) => boolean = () => false,
): boolean {
  let left = speed / TICK_HZ;
  while (left > 0) {
    const next = d.steps[0] ?? bodyTile(b);
    if (d.steps.length > 0 && !open(next.x, next.y)) return false;
    if (d.steps.length > 0 && wait(next.x, next.y)) return true;
    const tx = next.x + 0.5, ty = next.y + 0.5;
    const dx = tx - b.x, dy = ty - b.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 1e-9) b.heading = Math.atan2(dy, dx);
    if (dist <= left) {
      b.x = tx;
      b.y = ty;
      left -= dist;
      if (d.steps.length === 0) break;
      d.steps.shift();
      continue;
    }
    b.x += (dx / dist) * left;
    b.y += (dy / dist) * left;
    left = 0;
  }
  return true;
}
