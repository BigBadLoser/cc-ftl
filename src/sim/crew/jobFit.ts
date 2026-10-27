import { isErrand, findSuitSource } from '../eva/errands';
import { planSiteWalk } from '../eva/route';
import { needsMaterials } from '../items/materials';
import { canTakeRobotJob } from '../robots/jobs';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { AssignmentC, CrewC, DraftedC, PositionC, PrioritiesC, type Job, type Position } from './components';
import { isOffDuty } from '../fight/relations';
import { OPERATE_MAX_LEVEL } from '../tuning';
import { isIncapacitated, jobGoal, origin } from './helpers';

/** The checks every job pick makes before scoring: the crew member's ship, not their own target, funded, not an errand, and not barred to them. */
export function jobFits(sim: Sim, crewId: number, pos: Position, job: Job): boolean {
  return shipIdOf(sim, job) === shipIdOf(sim, pos) && job.target !== crewId && !needsMaterials(job) && !isErrand(job) && canTakeRobotJob(sim, crewId, job);
}

/** True if `crewId` could actually take the job now: it fits, they can walk to it, and a suit can be had when the way is thin air. */
export function jobTakeable(sim: Sim, crewId: number, pos: Position, job: Job): boolean {
  if (!jobFits(sim, crewId, pos, job)) return false;
  const plan = planSiteWalk(sim, crewId, shipIdOf(sim, pos), origin(pos), jobGoal(job));
  return !!plan && (!plan.thin || !!findSuitSource(sim, crewId, pos));
}

/**
 * An operator by choice (operating priority 1 or 2) of the console's ship with nothing to do who could take the console job, or 0. While one
 * exists a stand-in has no business at the console (the walk is not checked: a relief may be standing on its tile).
 */
export function freeOperatorFor(sim: Sim, shipId: number, job: Job): number {
  for (const id of sim.world.query(CrewC, PrioritiesC, PositionC)) {
    const level = sim.world.get(id, PrioritiesC)?.operating ?? 0;
    const at = sim.world.get(id, PositionC);
    if (level < 1 || level > OPERATE_MAX_LEVEL || !at || shipIdOf(sim, at) !== shipId || sim.world.has(id, AssignmentC) || isIncapacitated(sim, id) || isOffDuty(sim, id)) continue;
    if (sim.world.get(id, CrewC)?.activity === 'sleeping' || sim.world.has(id, DraftedC) || !jobFits(sim, id, at, job)) continue;
    return id;
  }
  return 0;
}
