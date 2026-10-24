import { JobC } from '../crew/components';
import { missingMaterials } from '../items/materials';
import { makeHaul, warnDue } from '../items/plan';
import { nearestSource, refKey, reservations } from '../items/stock';
import type { Sim } from '../sim';
import { DEFAULT_CARRY_CAPACITY, PLAN_INTERVAL } from '../tuning';
import { shipIdOf } from '../regions';

const MAX_HAULS_PER_ITEM = 8;

/**
 * Materials delivery. For every job that lacks materials (build, module blueprint, craft), creates
 * haul jobs from the nearest unreserved stock to the job until the shortfall is covered by hauls in
 * flight. If there is no stock, the job just waits and a debounced 'job.missingMaterials' is emitted.
 * Work on the job only begins once everything has been delivered (see jobWork).
 */
export function supplyJobsSystem(sim: Sim): void {
  if (sim.tick % PLAN_INTERVAL !== 0) return;
  const res = reservations(sim);
  for (const jobId of sim.world.query(JobC)) {
    const job = sim.world.get(jobId, JobC);
    if (!job || job.haul) continue;
    for (const need of missingMaterials(job)) {
      let lack = need.count - (res.incoming.get(refKey('job', jobId, need.item)) ?? 0);
      for (let i = 0; i < MAX_HAULS_PER_ITEM && lack > 0; i++) {
        const src = nearestSource(sim, shipIdOf(sim, job), need.item, job, res);
        if (!src) {
          if (warnDue(sim, job)) {
            sim.events.emit({ type: 'job.missingMaterials', job: jobId, ship: shipIdOf(sim, job), x: job.x, y: job.y, item: need.item });
          }
          break;
        }
        const n = Math.min(lack, src.avail, DEFAULT_CARRY_CAPACITY);
        const category = job.kind === 'craft' ? (sim.content.recipes[job.craft?.recipe ?? '']?.category ?? 'crafting') : 'construction';
        makeHaul(sim, res, category, shipIdOf(sim, job), src, { kind: 'job', id: jobId }, need.item, n);
        lack -= n;
      }
    }
  }
}
