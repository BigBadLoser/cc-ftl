import { JobC, PrioritiesC, type Job, type Position, type Priorities } from '../crew/components';
import { jobTakeable } from '../crew/jobFit';
import { isErrand } from '../eva/errands';
import type { Sim } from '../sim';

/**
 * The emergency check (docs/CREW_AI.md 7.1, preemption): a busy crew member is called off their job for a free emergency they rank higher.
 * Kept from the legacy picker unchanged in Phase 2; the scheduler (ai/scheduler.ts) assigns free crew.
 */

/** How often (ticks) a busy crew member looks for an emergency that outranks their job. */
export const EMERGENCY_CHECK_TICKS = 10;

/** Jobs a crew member drops what they are doing for: a fire, a downed crew member, a hole in the hull. */
const isEmergency = (job: Job): boolean => job.kind === 'extinguish' || job.kind === 'rescue' || (job.kind === 'build' && job.category === 'firefighting');
/** What an emergency never interrupts: a console, a rescue, a suit errand, or another emergency. */
const HOLDS = ['operate', 'rescue', 'suitUp', 'suitOff', 'extinguish'];

/** True when a free emergency job the crew member ranks higher than their current job is waiting and reachable (checked every few ticks). */
export function emergencyWaiting(sim: Sim, crewId: number, pos: Position, current: Job): boolean {
  if (HOLDS.includes(current.kind) || isErrand(current) || (current.kind === 'build' && current.category === 'firefighting')) return false;
  const prio = sim.world.get(crewId, PrioritiesC) as Priorities;
  const held = prio[current.category] || 5; // off counts as the lowest
  for (const id of sim.world.query(JobC)) {
    const j = sim.world.get(id, JobC) as Job;
    if (j.reservedBy !== 0 || !isEmergency(j)) continue;
    const level = prio[j.category];
    if (level >= 1 && level < held && jobTakeable(sim, crewId, pos, j)) return true;
  }
  return false;
}
