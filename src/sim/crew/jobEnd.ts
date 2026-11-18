import { abortTask } from '../ai/task';
import { spillItems } from '../items/stacks';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { JobC } from './components';

/** Ending a job, apart from items/stacks.ts so that stacks don't import the crew AI's task code (#553). */

/** Remove a job for good: delivered materials fall to the floor, its crew member is released. */
export function destroyJob(sim: Sim, jobId: number): void {
  const job = sim.world.get(jobId, JobC);
  if (!job) return;
  for (const q of job.delivered ?? []) spillItems(sim, shipIdOf(sim, job), job.x, job.y, q.item, q.count);
  job.delivered = [];
  if (job.reservedBy) abortTask(sim, job.reservedBy, 'cancelled');
  sim.world.destroyEntity(jobId);
}
