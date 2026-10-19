import {
  AssignmentC, CrewC, JobC, PathC, PositionC, type Crew, type Position,
} from '../crew/components';
import { atJob, clearPath, isIncapacitated, isSettled, releaseAssignment } from '../crew/helpers';
import { performJob } from '../crew/jobWork';
import { resumeAfter } from '../eva/errands';
import { destroyJob } from '../items/stacks';
import type { Sim } from '../sim';
import { stat } from '../stats';

/**
 * Crew adjacent to their job's tile do one tick of work on it (what that means per job kind is in
 * crew/jobWork). Finished jobs disappear; jobs that cannot finish yet (tile occupied, no free bed)
 * keep the crew in place until they can.
 */
export function workSystem(sim: Sim): void {
  for (const id of sim.world.query(CrewC, AssignmentC, PositionC, PathC)) {
    if (isIncapacitated(sim, id)) continue;
    const crew = sim.world.get(id, CrewC) as Crew;
    const pos = sim.world.get(id, PositionC) as Position;
    const assignment = sim.world.get(id, AssignmentC) as { jobId: number };
    const job = sim.world.get(assignment.jobId, JobC);
    if (!job) {
      releaseAssignment(sim, id); // cancelled or taken away
      if (crew.activity === 'working') crew.activity = 'idle';
      continue;
    }
    const path = sim.world.get(id, PathC) as { steps: unknown[] };
    const ready =
      crew.activity !== 'sleeping' &&
      path.steps.length === 0 &&
      isSettled(pos) &&
      pos.gridId === job.gridId &&
      atJob(pos, job);
    if (!ready) {
      if (crew.activity === 'working') crew.activity = 'idle';
      continue;
    }
    crew.activity = 'working';
    if (performJob(sim, id, job, stat(sim, id, 'workSpeed')) !== 'done') continue;
    sim.world.remove(id, AssignmentC);
    destroyJob(sim, assignment.jobId);
    sim.events.emit({ type: 'crew.jobDone', crew: id, kind: job.kind, gridId: job.gridId, x: job.x, y: job.y });
    crew.activity = 'idle';
    clearPath(sim, id);
    resumeAfter(sim, id, job); // a suit errand hands the crew member back to the job it interrupted
  }
}
