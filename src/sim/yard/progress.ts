import { JobC } from '../crew/components';
import { destroyJob } from '../items/stacks';
import { shipGrid } from '../regions';
import type { Sim } from '../sim';
import { Struct } from '../structure';
import type { YardMoney, YardOrder } from './types';

/**
 * Tiles of an order standing now. A truss tile counts once it has any structure (the truss itself, or the hull it was turned into); floor and wall
 * tiles count only when they are real floor or hull: an open truss (`Struct.Beam`) is not yet either.
 */
export function builtCount(sim: Sim, o: YardOrder): { truss: number; floor: number; walls: number } {
  const grid = shipGrid(sim, o.ship);
  const at = (t: { x: number; y: number }): number => (grid && grid.inBounds(t.x, t.y) ? grid.get('struct', t.x, t.y) : Struct.Space);
  const hull = (t: { x: number; y: number }): boolean => at(t) !== Struct.Space && at(t) !== Struct.Beam;
  return { truss: o.trusses.filter((t) => at(t) !== Struct.Space).length, floor: o.floor.filter(hull).length, walls: o.walls.filter(hull).length };
}

/** Tiles the order covers, built or not (trusses, floor and walls). */
export const totalTiles = (o: YardOrder): number => o.trusses.length + o.floor.length + o.walls.length;

/** What the station has earned of the money held: the share of the hull price for the floor and walls built, plus the share of the planning fee for the trusses built. */
export function earned(sim: Sim, o: YardOrder): YardMoney {
  const b = builtCount(sim, o);
  const hullTotal = Math.max(1, o.floor.length + o.walls.length);
  const trussTotal = Math.max(1, o.trusses.length);
  const hull = { credits: o.price.credits - o.fee.credits, metal: o.price.metal - o.fee.metal };
  return {
    credits: Math.floor((hull.credits * (b.floor + b.walls)) / hullTotal) + Math.floor((o.fee.credits * b.truss) / trussTotal),
    metal: Math.floor((hull.metal * (b.floor + b.walls)) / hullTotal) + Math.floor((o.fee.metal * b.truss) / trussTotal),
  };
}

/** The open build jobs an order posted. */
export function jobsOf(sim: Sim, o: YardOrder): number[] {
  return sim.world.query(JobC).filter((id) => sim.world.get(id, JobC)?.yard === o.id);
}

/** Drop the jobs of an order that are still open (materials delivered to them, none here, would drop as stacks). */
export function dropJobs(sim: Sim, o: YardOrder): void {
  for (const id of jobsOf(sim, o)) destroyJob(sim, id);
}
