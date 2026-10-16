import { JobC } from '../crew/components';
import { ModuleC } from '../modules/components';
import { CarryingC, ItemStackC } from '../items/components';
import { destinationTile } from '../items/haul';
import { destroyJob } from '../items/stacks';
import type { Sim } from '../sim';

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
      (h.phase === 'pickup' && !(h.src.kind === 'floor' ? sim.world.has(h.src.id, ItemStackC) : sim.world.has(h.src.id, ModuleC))) ||
      (h.phase === 'deliver' && (job.reservedBy === 0 || sim.world.get(job.reservedBy, CarryingC)?.item !== h.item));
    if (stale) destroyJob(sim, id);
  }
}
