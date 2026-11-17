import { Struct, findJobAt, shipGrid, windowRunError, windowRun, type Sim, type WindowAxis } from '../sim';
import type { Tile } from './input';

export interface WindowPlan {
  ship: number;
  start: Tile;
  axis: WindowAxis;
  size: number;
  tiles: Tile[];
  /** A rejection reason (messages.ts), or null when the command would be accepted. */
  error: string | null;
}

const solid = (k: number) => k === Struct.Wall || k === Struct.Door || k === Struct.RockWall;

/**
 * The window run the Window tool would build with the cursor on `at`: the axis comes from the wall (a run along x when it
 * connects east and west, else along y), and the run holds the cursor tile, centred on it where it can be and slid along the
 * wall otherwise. With no valid run the centred one comes back with the reason the sim gives (windowRunError).
 */
export function windowPlan(sim: Sim, ship: number, at: Tile, size: number): WindowPlan | null {
  const grid = shipGrid(sim, ship);
  if (!grid?.has('struct') || !grid.inBounds(at.x, at.y)) return null;
  const k = (x: number, y: number) => (grid.inBounds(x, y) ? grid.get('struct', x, y) : Struct.Space);
  const axis: WindowAxis = solid(k(at.x - 1, at.y)) && solid(k(at.x + 1, at.y)) ? 'x' : solid(k(at.x, at.y - 1)) && solid(k(at.x, at.y + 1)) ? 'y' : 'x';
  const centre = Math.floor((size - 1) / 2);
  const offsets = Array.from({ length: size }, (_, i) => i).sort((a, b) => Math.abs(a - centre) - Math.abs(b - centre));
  let first: WindowPlan | null = null;
  for (const o of offsets) {
    const start = axis === 'x' ? { x: at.x - o, y: at.y } : { x: at.x, y: at.y - o };
    const error = windowRunError(grid, start.x, start.y, axis, size, (x, y) => findJobAt(sim, ship, x, y) !== 0);
    const plan: WindowPlan = { ship, start, axis, size, tiles: windowRun(start.x, start.y, axis, size).map(({ x, y }) => ({ x, y })), error };
    if (!error) return plan;
    first ??= plan;
  }
  return first;
}
