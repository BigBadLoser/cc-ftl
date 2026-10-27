import { ShipC, type Ship } from '../combat/components';
import { BUILD_TICKS, createJob } from '../crew/handlers';
import { shipRect } from '../regions';
import type { Sim } from '../sim';
import { Struct } from '../structure';
import { inRowOrder, rowRanks } from './rows';
import type { YardOrder } from './types';

type Tile = { x: number; y: number };

/** Post the jobs of one pass in row order (nearest the ship first); the order's current row is the lowest of them. */
function post(sim: Sim, o: YardOrder, tiles: readonly (Tile & { struct: number })[]): void {
  const ship = sim.world.get(o.ship, ShipC) as Ship;
  const rank = rowRanks(sim, o.ship, shipRect(ship));
  for (const t of inRowOrder(tiles, rank)) {
    createJob(sim, 'build', o.ship, t.x, t.y, t.struct, BUILD_TICKS[t.struct] as number, true, { yard: o.id, yardRank: rank(t.x, t.y) });
  }
  if (tiles.length) o.rank = Math.min(...tiles.map((t) => rank(t.x, t.y)));
}

/** The planning pass: an open truss on every tile of the order that has none. Quick, and outside the visit cap. */
export function postTrussJobs(sim: Sim, o: YardOrder): void {
  o.stage = 'truss';
  post(sim, o, o.trusses.map((t) => ({ ...t, struct: Struct.Beam })));
}

/**
 * The hull pass: floor, and walls where the trusses (or open space, for the closing walls the plan does not cover) are, in row order. The wall
 * of each floor patch left in `gaps` is closed last, once the crew are out (see `flow.ts`).
 */
export function postHullJobs(sim: Sim, o: YardOrder): void {
  o.stage = 'hull';
  const gapKeys = new Set(o.gaps.map((g) => `${g.wall.x},${g.wall.y}`));
  post(sim, o, [
    ...o.floor.map((t) => ({ ...t, struct: Struct.Floor as number })),
    ...o.walls.filter((w) => !gapKeys.has(`${w.x},${w.y}`)).map((t) => ({ ...t, struct: Struct.Wall as number })),
  ]);
}
