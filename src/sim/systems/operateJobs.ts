import { JobC } from '../crew/components';
import { releaseAssignment } from '../crew/helpers';
import { IonC } from '../combat/components';

import { ModuleC } from '../modules/components';
import { accessTile } from '../modules/footprint';
import type { Sim } from '../sim';
import { shipIdOf } from '../regions';
import { shipById } from '../combat/ships';
import { chargeOrdered, seatHelms } from '../ftl/order';

/**
 * Opens one 'operate' job (category operating) per console while it is needed and drops it when it is not.
 * A console is needed during combat while its ship is active, the console is powered and intact; outside combat the helm is needed while
 * a charge order stands (`ftl.charge`), and `seatHelms` sends the best free pilot (else any crew) to it.
 * Crew who hold the job stand on the access tile ("manning" the console, see combat/operators).
 * Seam: automation (AI core tiers) would stand in for missing operators here, at reduced efficiency.
 */
export function operateJobsSystem(sim: Sim): void {
  const open = new Map<number, number>(); // console module -> job id
  for (const jobId of [...sim.world.query(JobC)]) {
    const job = sim.world.get(jobId, JobC);
    if (job?.kind !== 'operate') continue;
    if (consoleNeeded(sim, job.target ?? 0) && !open.has(job.target ?? 0)) {
      open.set(job.target ?? 0, jobId);
      continue;
    }
    if (job.reservedBy) releaseAssignment(sim, job.reservedBy);
    sim.world.destroyEntity(jobId);
  }
  const fresh = new Set<number>();
  for (const id of sim.world.query(ModuleC)) {
    if (open.has(id) || !consoleNeeded(sim, id)) continue;
    const m = sim.world.get(id, ModuleC);
    const def = m && sim.content.modules[m.def];
    const at = m && def && accessTile(def, m.x, m.y, m.rot);
    if (!m || !at) continue;
    const job = sim.world.createEntity();
    sim.world.add(job, JobC, {
      category: 'operating', kind: 'operate', x: at.x, y: at.y, struct: 0, work: 1, progress: 0,
      reservedBy: 0, target: id,
    });
    fresh.add(job);
  }
  seatHelms(sim, fresh);
}

function consoleNeeded(sim: Sim, id: number): boolean {
  const m = sim.world.get(id, ModuleC);
  const console = m && sim.content.modules[m.def]?.console;
  if (!m || !console) return false;
  // Outside combat only an ordered drive charge (`ftl.charge`) needs a console: the helm.
  if (!sim.sector.inCombat && !(console === 'helm' && chargeOrdered(sim, shipIdOf(sim, m)))) return false;
  if (!m.powered || m.hp <= 0 || sim.world.has(id, IonC)) return false;
  return shipById(sim, shipIdOf(sim, m))?.state === 'active';
}

