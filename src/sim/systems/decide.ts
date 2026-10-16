import {
  AssignmentC, CrewC, DraftedC, JobC, NeedsC, PathC, PositionC, PrioritiesC, WORK_CATEGORIES,
  type Crew, type Position, type Priorities,
} from '../crew/components';
import { clearPath, isAdjacent, isSettled, origin, releaseAssignment } from '../crew/helpers';
import { findPath, type Tile } from '../crew/pathfind';
import { isWalkable } from '../structure';
import type { Sim } from '../sim';

/** Below this rest a non-drafted crew member drops everything and sleeps in place. */
const SLEEP_BELOW = 20;
/** Per-tick chance that an idle crew member wanders (about once per 10 s). */
const WANDER_CHANCE = 0.005;
const WANDER_RADIUS = 3;

/** Autonomous decisions for non-drafted crew: sleep, keep/repath a job, pick a job, or idle. */
export function decideSystem(sim: Sim): void {
  for (const id of sim.world.query(CrewC, PrioritiesC, PositionC, PathC, NeedsC)) {
    if (sim.world.has(id, DraftedC)) continue;
    const crew = sim.world.get(id, CrewC) as Crew;
    if (crew.activity === 'sleeping') continue;
    const pos = sim.world.get(id, PositionC) as Position;
    const needs = sim.world.get(id, NeedsC) as { rest: number };

    if (needs.rest < SLEEP_BELOW) {
      releaseAssignment(sim, id);
      if (isSettled(pos)) {
        crew.activity = 'sleeping';
        sim.events.emit({ type: 'crew.fellAsleep', crew: id });
      }
      continue;
    }

    const assignment = sim.world.get(id, AssignmentC);
    if (assignment) {
      const job = sim.world.get(assignment.jobId, JobC);
      if (!job) {
        releaseAssignment(sim, id);
        continue;
      }
      const path = sim.world.get(id, PathC);
      if (path && path.steps.length === 0 && !isAdjacent(origin(pos), job)) {
        const steps = findPath(sim, pos.gridId, origin(pos), { x: job.x, y: job.y, adjacent: true });
        if (steps) path.steps = steps;
        else releaseAssignment(sim, id);
      }
      continue;
    }

    if (!pickJob(sim, id, pos)) wander(sim, id, pos, crew);
  }
}

/** Reserve the best job by priority level, then shortest path, then lowest id. */
function pickJob(sim: Sim, crewId: number, pos: Position): boolean {
  const prio = sim.world.get(crewId, PrioritiesC) as Priorities;
  const jobs = sim.world.query(JobC).filter((j) => sim.world.get(j, JobC)?.reservedBy === 0);
  if (jobs.length === 0) return false;
  for (let level = 1; level <= 4; level++) {
    const cats = WORK_CATEGORIES.filter((c) => prio[c] === level);
    let best: { id: number; steps: Tile[] } | null = null;
    for (const jobId of jobs) {
      const job = sim.world.get(jobId, JobC);
      if (!job || job.gridId !== pos.gridId || !cats.includes(job.category)) continue;
      const steps = findPath(sim, pos.gridId, origin(pos), { x: job.x, y: job.y, adjacent: true });
      if (steps && (!best || steps.length < best.steps.length)) best = { id: jobId, steps };
    }
    if (best) {
      (sim.world.get(best.id, JobC) as { reservedBy: number }).reservedBy = crewId;
      sim.world.add(crewId, AssignmentC, { jobId: best.id });
      (sim.world.get(crewId, PathC) as { steps: Tile[] }).steps = best.steps;
      return true;
    }
  }
  return false;
}

/** Occasionally stroll a few tiles within the current room. */
function wander(sim: Sim, id: number, pos: Position, crew: Crew): void {
  const path = sim.world.get(id, PathC);
  if (!path || path.steps.length > 0 || !isSettled(pos)) return;
  if (crew.activity !== 'idle') crew.activity = 'idle';
  if (!sim.rng.chance(WANDER_CHANCE)) return;
  const grid = sim.grids.get(pos.gridId);
  if (!grid?.has('room')) return;
  const room = grid.get('room', pos.x, pos.y);
  if (room === 0) return;
  const tx = pos.x + sim.rng.int(-WANDER_RADIUS, WANDER_RADIUS);
  const ty = pos.y + sim.rng.int(-WANDER_RADIUS, WANDER_RADIUS);
  if ((tx === pos.x && ty === pos.y) || !grid.inBounds(tx, ty)) return;
  if (!isWalkable(grid.get('struct', tx, ty)) || grid.get('room', tx, ty) !== room) return;
  const steps = findPath(sim, pos.gridId, { x: pos.x, y: pos.y }, { x: tx, y: ty });
  if (steps && steps.length <= 2 * WANDER_RADIUS) path.steps = steps;
  else clearPath(sim, id);
}
