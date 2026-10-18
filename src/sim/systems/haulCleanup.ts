import { JobC } from '../crew/components';
import { ModuleC } from '../modules/components';
import { CarryingC, ItemStackC } from '../items/components';
import { destinationTile } from '../items/haul';
import { destroyJob } from '../items/stacks';
import type { HaulRef } from '../items/components';
import type { Sim } from '../sim';
import { VehicleC } from '../vehicles/components';

/**
 * Drops haul jobs that can no longer happen so their reservations free up: the source stack or
 * storage is gone, the destination is gone, or a delivery lost its carrier. A carrier whose job
 * vanishes puts the load down on its own (see decide).
 */
export function haulCleanupSystem(sim: Sim): void {
  for (const id of [...sim.world.query(JobC)]) {
    const job = sim.world.get(id, JobC);
    const h = job?.haul;
    if (!job || !h) continue;
    const stale =
      destinationTile(sim, job) === null ||
      (h.phase === 'pickup' && !sourceExists(sim, h.src)) ||
      (h.phase === 'deliver' && (job.reservedBy === 0 || sim.world.get(job.reservedBy, CarryingC)?.item !== h.item));
    if (stale) destroyJob(sim, id);
  }
}

function sourceExists(sim: Sim, src: HaulRef): boolean {
  if (src.kind === 'floor') return sim.world.has(src.id, ItemStackC);
  if (src.kind === 'vehicle') return sim.world.has(src.id, VehicleC);
  return sim.world.has(src.id, ModuleC);
}
