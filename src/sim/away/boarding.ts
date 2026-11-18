import { JobC } from '../crew/components';
import { destroyJob } from '../items/stacks';
import { isTileWalkable } from '../modules/walk';
import { shipGrid } from '../regions';
import type { Sim } from '../sim';
import { VehicleC } from '../vehicles/components';
import { boardingTile } from '../vehicles/geometry';
import { occupants, unboardCrew } from '../vehicles/lifecycle';
import { AwayC } from './components';

/**
 * A shuttle's passages and the way off it: the passage jobs it offers, withdrawing them, and letting its passengers out at the boarding tile.
 * Apart from away/passage.ts (posting and boarding the party) so that ending a site (away/end.ts) does not import the whole passage flow (#553).
 */

/** The passage jobs a shuttle offers, ascending id. */
export function passagesOf(sim: Sim, vehicle: number): number[] {
  return sim.world.query(JobC).filter((j) => {
    const job = sim.world.get(j, JobC);
    return job?.kind === 'passage' && job.target === vehicle;
  }).sort((a, b) => a - b);
}

/** Withdraw every passage of the shuttle (a walker on the way is called off). */
export function dropPassages(sim: Sim, vehicle: number): void {
  for (const j of passagesOf(sim, vehicle)) destroyJob(sim, j);
}

/**
 * Let everyone aboard out at the boarding tile (back from the site, or a passenger stepping out again). `who` picks them; they leave the
 * party. False when the tile cannot be stood on (nobody gets out).
 */
export function letOut(sim: Sim, vehicle: number, who: (c: number) => boolean = () => true): boolean {
  const v = sim.world.get(vehicle, VehicleC);
  const at = boardingTile(sim, vehicle);
  const grid = at && shipGrid(sim, at.shipId);
  if (!v || !at || !grid || !isTileWalkable(sim, grid, at.x, at.y)) return false;
  for (const c of occupants(v)) {
    if (!who(c)) continue;
    unboardCrew(sim, c, vehicle, at);
    sim.world.remove(c, AwayC);
  }
  return true;
}
