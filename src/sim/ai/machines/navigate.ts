import { PathC, type Job, type Path, type Position } from '../../crew/components';
import { atJob, jobGoal, origin } from '../../crew/helpers';
import { findSuitSource, isErrand } from '../../eva/errands';
import { planSiteWalk } from '../../eva/route';
import { shipIdOf } from '../../regions';
import type { Sim } from '../../sim';
import { machineOf, travelState } from '../jobStates';
import { abortTask, markState } from '../task';
import { startErrand } from './eva';

/**
 * The job machines' shared travel step (generic `Navigate`, haul `ToSource`/`ToDest`, rescue `ToPatient`/`ToBed`, eva
 * `ToAirlock`): with the path run out short of the site, plan the walk again. A way only through thin air nests the eva machine
 * first (suit up, then resume). Unreachable: the task is abandoned.
 */
export function navigateTurn(sim: Sim, id: number, pos: Position, jobId: number, job: Job): void {
  const path = sim.world.get(id, PathC);
  if (!path || path.steps.length > 0 || atJob(origin(pos), job)) return; // walking, or there: the work step takes over
  if (!routeToJob(sim, id, pos, jobId, job)) return abortTask(sim, id, 'unreachable');
  markState(sim, id, machineOf(job), travelState(sim, id, job), job);
}

/**
 * Walk to a reserved job. A job that can only be reached through thin air sends an unsuited crew member to fit a suit
 * first (the job stays theirs and resumes afterwards); false when it cannot be reached at all or no suit can be had.
 */
function routeToJob(sim: Sim, id: number, pos: Position, jobId: number, job: Job): boolean {
  const path = sim.world.get(id, PathC) as Path;
  const plan = planSiteWalk(sim, id, shipIdOf(sim, pos), origin(pos), jobGoal(job));
  if (!plan) return false;
  if (plan.thin && !isErrand(job)) {
    const src = findSuitSource(sim, id, pos);
    if (!src) return false;
    startErrand(sim, id, 'suitUp', src, shipIdOf(sim, pos), jobId);
    return true;
  }
  path.steps = plan.steps;
  return true;
}
