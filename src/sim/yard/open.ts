import { BUILD_TICKS, createJob } from '../crew/handlers';
import { findJobAt } from '../crew/helpers';
import { shipGrid } from '../regions';
import type { Sim } from '../sim';
import { Struct } from '../structure';
import type { YardOrder } from './types';

type Tile = { x: number; y: number };
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const N8 = [...N4, [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;
const key = (t: Tile): string => `${t.x},${t.y}`;

/**
 * The walls an order's build has turned inward: the ship's old outer hull where the new section joins on, and any of the order's own walls laid
 * against it (a plan drawn beside the hull rather than over it). A candidate is a plain wall (no module on it) that is one of the order's walls or
 * touches one of its tiles side on; it opens once no tile round it, corners included, is open space, a truss or another ship's, so the outer
 * ring (and every wall still facing out, like a cross wall before the rest of the plan) stays shut. Interior walls of the old ship never touch
 * the new tiles, so the rooms the player built are left alone.
 */
export function innerWalls(sim: Sim, o: YardOrder): Tile[] {
  const grid = shipGrid(sim, o.ship);
  if (!grid) return [];
  const order = new Set([...o.floor, ...o.walls].map(key));
  const own = (x: number, y: number): boolean => grid.inBounds(x, y) && grid.get('ship', x, y) === o.ship;
  const shut = (x: number, y: number): boolean => own(x, y) && grid.get('struct', x, y) !== Struct.Space && grid.get('struct', x, y) !== Struct.Beam;
  const cand = new Map<string, Tile>();
  const consider = (t: Tile): void => {
    if (!own(t.x, t.y) || grid.get('struct', t.x, t.y) !== Struct.Wall || (grid.has('module') && grid.get('module', t.x, t.y) !== 0)) return;
    if (N8.every(([dx, dy]) => shut(t.x + dx, t.y + dy))) cand.set(key(t), t);
  };
  for (const w of o.walls) consider(w);
  for (const t of [...o.floor, ...o.walls]) {
    for (const [dx, dy] of N4) {
      const n = { x: t.x + dx, y: t.y + dy };
      if (!order.has(key(n))) consider(n);
    }
  }
  return [...cand.values()].sort((a, b) => a.y - b.y || a.x - b.x);
}

/** The last pass ('open'), once the new section is shut: floor where the walls it turned inward stand. Returns the jobs posted. */
export function postOpenJobs(sim: Sim, o: YardOrder): number {
  o.stage = 'open';
  let n = 0;
  for (const t of innerWalls(sim, o)) {
    if (findJobAt(sim, o.ship, t.x, t.y)) continue;
    createJob(sim, 'build', o.ship, t.x, t.y, Struct.Floor, BUILD_TICKS[Struct.Floor] as number, true, { yard: o.id });
    n++;
  }
  return n;
}
