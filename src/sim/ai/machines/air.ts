import { AssignmentC, JobC, type Crew, type Position } from '../../crew/components';
import { CarryingC } from '../../items/components';
import { isErrand } from '../../eva/errands';
import { nearestAirSource } from '../../eva/sources';
import type { Sim } from '../../sim';
import { forgetAirSearch } from '../airNeed';
import { TaskC } from '../components';
import { abortTask, isCarrying, syncTask } from '../task';
import { TICK_HZ } from '../../time';
import { NEST_HOLD_SEC } from '../../tuning';
import { navigateTurn } from './navigate';
import { startRefill } from './refill';

/**
 * The air drive's turn (#286 slice 1; docs/DESIGN.md "Air as a need"): a suited crew member whose tank runs low walks to the nearest air
 * source and fills up there (the refill errand, `eva` `ToAirlock` then `Fill`). The refill **nests**: the job they were on stays theirs
 * (reserved, its progress on the job) and is handed back when the tank is full (the errand's `resume`), so long work is done in stints.
 * A load in hand is set down first and the haul given up; a patient is only set down once the drive is critical (`breaksFinish`): on the
 * nearest safe tile within SETDOWN_STEPS (else where the rescuer stands; ai/setDown.ts), keeping their bed, and the rescue is posted again. False when no source can be reached (the drive is blocked: the pickup request).
 */
export function airTurn(sim: Sim, id: number, _crew: Crew, pos: Position, holdsJob: boolean): boolean {
  const a = holdsJob ? sim.world.get(id, AssignmentC) : undefined;
  const job = a && sim.world.get(a.jobId, JobC);
  if (a && job?.kind === 'refill') {
    // A job parked this long (NEST_HOLD_SEC: a long way to the source, a queue at it) is let go, as an abort would: others may take it.
    if (job.resume && sim.tick - (job.heldSince ?? sim.tick) > NEST_HOLD_SEC * TICK_HZ) {
      const parent = sim.world.get(job.resume, JobC);
      if (parent?.reservedBy === id) parent.reservedBy = 0;
      delete job.resume;
      delete job.heldSince;
      syncTask(sim, id);
    }
    navigateTurn(sim, id, pos, a.jobId, job);
    return true;
  }
  if (job && isErrand(job)) return false; // fitting or stowing a suit: not on top of that errand
  const src = nearestAirSource(sim, id); // the walk with it is the one it was timed by
  if (!src) return false;
  let resume: number | undefined;
  // A job is parked (nested) unless a patient or a load is in hand: those are set down and the job given up. A task with no job (a walk to a
  // bed, a meal or a break) ends, its holds released (abortTask, the one teardown).
  if (a && job && !isCarrying(sim, id) && !sim.world.has(id, CarryingC)) resume = a.jobId;
  else if (a || sim.world.has(id, TaskC)) abortTask(sim, id, 'air');
  forgetAirSearch(sim, id);
  startRefill(sim, id, src, src.steps, resume);
  return true;
}


