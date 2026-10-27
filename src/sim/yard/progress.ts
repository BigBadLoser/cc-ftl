import { JobC } from '../crew/components';
import { destroyJob } from '../items/stacks';
import { shipGrid } from '../regions';
import type { Sim } from '../sim';
import { Struct } from '../structure';
import type { YardMoney, YardOrder } from './types';

/** Tiles of an order standing now: floor and walls built (a tile counts when the space has been given a structure). */
export function builtCount(sim: Sim, o: YardOrder): { floor: number; walls: number } {
  const grid = shipGrid(sim, o.ship);
  const done = (t: { x: number; y: number }): boolean => !!grid && grid.inBounds(t.x, t.y) && grid.get('struct', t.x, t.y) !== Struct.Space;
  return { floor: o.floor.filter(done).length, walls: o.walls.filter(done).length };
}

/** Tiles the order covers, built or not. */
export const totalTiles = (o: YardOrder): number => o.floor.length + o.walls.length;

/** The share of the price of `n` of its tiles (rounded down; the station gets the remainder). */
export function shareOf(o: YardOrder, n: number): YardMoney {
  const t = Math.max(1, totalTiles(o));
  return { credits: Math.floor((o.price.credits * n) / t), metal: Math.floor((o.price.metal * n) / t) };
}

/** The open build jobs an order posted. */
export function jobsOf(sim: Sim, o: YardOrder): number[] {
  return sim.world.query(JobC).filter((id) => sim.world.get(id, JobC)?.yard === o.id);
}

/** Drop the jobs of an order that are still open (materials delivered to them, none here, would drop as stacks). */
export function dropJobs(sim: Sim, o: YardOrder): void {
  for (const id of jobsOf(sim, o)) destroyJob(sim, id);
}
