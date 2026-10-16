import {
  AssignmentC, CrewC, JobC, PathC, PositionC, type Crew, type Job, type Position,
} from '../crew/components';
import { clearPath, isAdjacent, isSettled, isTileOccupied, releaseAssignment } from '../crew/helpers';
import { Struct } from '../structure';
import type { Sim } from '../sim';
import { stat } from '../stats';

/** Crew adjacent to their job's tile do work; finished jobs change the grid and disappear. */
export function workSystem(sim: Sim): void {
  for (const id of sim.world.query(CrewC, AssignmentC, PositionC, PathC)) {
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
      isAdjacent(pos, job);
    if (!ready) {
      if (crew.activity === 'working') crew.activity = 'idle';
      continue;
    }
    crew.activity = 'working';
    job.progress = Math.min(job.work, job.progress + stat(sim, id, 'workSpeed'));
    if (job.progress < job.work) continue;
    if (job.kind === 'build' && isTileOccupied(sim, job.gridId, job.x, job.y)) continue; // wait for the tile to clear
    complete(sim, id, assignment.jobId, job);
    crew.activity = 'idle';
    clearPath(sim, id);
  }
}

function complete(sim: Sim, crew: number, jobId: number, job: Job): void {
  const grid = sim.grids.get(job.gridId);
  if (grid?.has('struct') && grid.inBounds(job.x, job.y)) {
    const next = job.kind === 'build' ? job.struct : Struct.Floor;
    if (grid.get('struct', job.x, job.y) !== next) grid.set('struct', job.x, job.y, next);
  }
  sim.world.remove(crew, AssignmentC);
  sim.world.destroyEntity(jobId);
  sim.events.emit({ type: 'crew.jobDone', crew, kind: job.kind, gridId: job.gridId, x: job.x, y: job.y });
}
