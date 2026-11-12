import { wontDo } from './wontDo';
import { ModuleC } from '../modules/components';
import { YardCrewC } from '../yard/types';
import { AwayC } from '../away/components';
import { InspectionC } from '../inspect/types';
import { passageFits } from '../away/crew';
import { isErrand, findSuitSource } from '../eva/errands';
import { planSiteWalk } from '../eva/route';
import { needsMaterials } from '../items/materials';
import { canTakeRobotJob } from '../robots/jobs';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { AssignmentC, CrewC, DraftedC, PositionC, PrioritiesC, type Job, type Position } from './components';
import { isOffDuty } from '../fight/relations';
import { workBlocked } from './workBlock';
import { OPERATE_MAX_LEVEL } from '../tuning';
import { jobCareFits } from './care';
import { isIncapacitated, jobGoal, origin, refusesWork } from './helpers';

/** The checks every job pick makes before scoring: the crew member's ship, not their own target, funded, not an errand, and not barred to them (a yard job, a blocked work category). */
export function jobFits(sim: Sim, crewId: number, pos: Position, job: Job): boolean {
  if (job.yardOnly && !sim.world.has(crewId, YardCrewC)) return false;
  if (!partyFits(sim, crewId, job) || !jobCareFits(sim, crewId, job)) return false;
  if (workBlocked(sim, crewId, job.category)) return false;
  if (job.kind === 'operate' && refusesConsole(sim, crewId, job.target ?? 0)) return false; // a Pacifist never mans a gun
  if (job.yard !== undefined && job.yardRank !== undefined && job.yardRank > (sim.yard.orders.find((o) => o.id === job.yard)?.rank ?? job.yardRank) + 1) return false;
  return shipIdOf(sim, job) === shipIdOf(sim, pos) && job.target !== crewId && !needsMaterials(job) && !isErrand(job) && canTakeRobotJob(sim, crewId, job) && passageFits(sim, crewId, job);
}

/** Does the crew member refuse to man this console: a weapons console and they won't fight (docs/TRAITS.md 10.10)? Job picks and station orders ask it. */
export function refusesConsole(sim: Sim, crewId: number, module: number): boolean {
  const m = sim.world.get(module, ModuleC);
  return !!m && sim.content.modules[m.def]?.console === 'weapons' && wontDo(sim, crewId, 'violence');
}

/** A party job (`Job.party`) is its party's alone; an inspector (of a shuttle with an inspection) takes nothing else. */
function partyFits(sim: Sim, crewId: number, job: Job): boolean {
  const party = sim.world.get(crewId, AwayC)?.vehicle;
  if (job.party !== undefined) return party === job.party;
  return party === undefined || !sim.world.has(party, InspectionC);
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
    if (level < 1 || level > OPERATE_MAX_LEVEL || !at || shipIdOf(sim, at) !== shipId || sim.world.has(id, AssignmentC) || isIncapacitated(sim, id) || isOffDuty(sim, id) || refusesWork(sim, id)) continue;
    if (sim.world.get(id, CrewC)?.activity === 'sleeping' || sim.world.has(id, DraftedC) || !jobFits(sim, id, at, job)) continue;
    return id;
  }
  return 0;
}
