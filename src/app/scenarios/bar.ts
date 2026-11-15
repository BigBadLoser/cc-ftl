import { ShipC, placementError, playerShip, type Command, type Sim } from '../../sim';
import type { Scenario } from './types';

/** An L of bar furniture, relative to its left end (x, y): the counter along u (front +v), the corner at its right end, the short counter behind it, stools on the padded faces. */
const L = [
  { def: 'module.bar_counter', dx: 0, dy: 0, rot: 0 },
  { def: 'module.bar_corner', dx: 3, dy: 0, rot: 0 },
  { def: 'module.bar_counter_short', dx: 3, dy: -2, rot: 3 },
  { def: 'module.bar_stool', dx: 0, dy: 1, rot: 0 },
  { def: 'module.bar_stool', dx: 1, dy: 1, rot: 0 },
  { def: 'module.bar_stool', dx: 2, dy: 1, rot: 0 },
  { def: 'module.bar_stool', dx: 4, dy: 0, rot: 0 },
  { def: 'module.bar_stool', dx: 4, dy: -1, rot: 0 },
] as const;

/** True when a 9x7 patch around the L (a margin of open floor all round) is free, so the bar stands clear of walls and other furniture. */
function clear(sim: Sim, ship: number, x: number, y: number): boolean {
  for (let dy = -3; dy <= 3; dy++) for (let dx = -2; dx <= 6; dx++) if (placementError(sim, ship, 'module.bar_stool', x + dx, y + dy, 0) !== null) return false;
  return true;
}

/** `?scenario=bar` (#441): the bar counter, corner, short counter and stools built as an L in the first open spot of the ship (debug hull). Furniture only. */
export const bar: Scenario = ({ sim, dispatch, setSpeed }) => {
  setSpeed(1);
  const ship = playerShip(sim);
  const s = ship === undefined ? undefined : sim.world.get(ship, ShipC);
  if (ship === undefined || !s) return;
  for (let y = s.y; y < s.y + s.height; y++) for (let x = s.x; x < s.x + s.width; x++) {
    if (!clear(sim, ship, x, y)) continue;
    if (!L.every((p) => placementError(sim, ship, p.def, x + p.dx, y + p.dy, p.rot) === null)) continue;
    for (const p of L) dispatch({ type: 'debug.spawnModule', ship, x: x + p.dx, y: y + p.dy, def: p.def, rot: p.rot } as Command);
    return;
  }
};
