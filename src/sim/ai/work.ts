import { AssignmentC, CrewC, JobC, PathC, PositionC, type Crew, type Position } from '../crew/components';
import { atJob, clearPath, isIncapacitated, isSettled } from '../crew/helpers';
import { performJob } from '../crew/jobWork';
import { destroyJob } from '../items/stacks';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { stat } from '../stats';
import { machineOf, travelState, workState } from './jobStates';
import { resumeAfter } from './machines/eva';
import { abortTask, detachJob, markState } from './task';

/**
 * The executor's work step (docs/CREW_AI.md section 6), in the work system's slot, last: completed jobs change the grid, which
 * rooms picks up next tick. Crew at their job's site do one tick of work on it (what that means per job kind is
 * `performJob`, crew/jobWork); the machine is then in its work state (`Work`, `Take`/`Deposit`, `Lift`/`Lay`, `Don`/`Doff`).
 * A finished job completes: it is destroyed, `crew.jobDone` is emitted and a suit errand hands the crew member back to the job
 * it was set aside for (the parent frame pops). Jobs that cannot finish yet (tile occupied, no free bed) keep them in place.
 */
export function workSystem(sim: Sim): void {
  for (const id of sim.world.query(CrewC, AssignmentC, PositionC, PathC)) {
    if (isIncapacitated(sim, id)) continue;
    const crew = sim.world.get(id, CrewC) as Crew;
    const pos = sim.world.get(id, PositionC) as Position;
    const assignment = sim.world.get(id, AssignmentC) as { jobId: number };
    const job = sim.world.get(assignment.jobId, JobC);
    if (!job) {
      abortTask(sim, id, 'jobGone'); // cancelled or taken away
      if (crew.activity === 'working') crew.activity = 'idle';
      continue;
    }
    const path = sim.world.get(id, PathC) as { steps: unknown[] };
    const ready =
      crew.activity !== 'sleeping' &&
      path.steps.length === 0 &&
      isSettled(pos) &&
      shipIdOf(sim, pos) === shipIdOf(sim, job) &&
      atJob(pos, job);
    if (!ready) {
      if (crew.activity === 'working') crew.activity = 'idle';
      continue;
    }
    crew.activity = 'working';
    const machine = machineOf(job);
    markState(sim, id, machine, workState(sim, id, job), job);
    if (performJob(sim, id, job, stat(sim, id, 'workSpeed')) !== 'done') {
      if (!atJob(pos, job)) markState(sim, id, machine, travelState(sim, id, job), job); // a load taken, a patient lifted: on to the next stop
      continue;
    }
    detachJob(sim, id);
    destroyJob(sim, assignment.jobId);
    sim.events.emit({ type: 'crew.jobDone', crew: id, kind: job.kind, ship: shipIdOf(sim, job), x: job.x, y: job.y });
    crew.activity = 'idle';
    clearPath(sim, id);
    resumeAfter(sim, id, job); // a suit errand hands the crew member back to the job it interrupted
  }
}
