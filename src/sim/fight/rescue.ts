import { AssignmentC, JobC, PathC, PrioritiesC, type Path, type Position, type Priorities } from '../crew/components';
import { jobGoal, origin } from '../crew/helpers';
import type { Tile } from '../crew/pathfind';
import { planWalk } from '../eva/route';
import type { Grid } from '../grid';
import type { Sim } from '../sim';
import { shipIdOf } from '../regions';
import { FLEE_HOLD_DIST } from '../tuning';
import { sightLine } from './los';

type Cell = { x: number; y: number };

/** True if no intruder can see `at` and all are farther than FLEE_HOLD_DIST: a spot where an unarmed crew member is safe for now. */
export function hiddenFrom(sim: Sim, grid: Grid, at: Cell, threats: readonly Cell[]): boolean {
  return threats.every((t) => Math.hypot(t.x - at.x, t.y - at.y) > FLEE_HOLD_DIST && !sightLine(sim, grid, t, at).visible);
}

/** True if the crew member holds a rescue job (heading for the patient, or carrying them). */
export function onRescue(sim: Sim, id: number): boolean {
  const a = sim.world.get(id, AssignmentC);
  return sim.world.get(a?.jobId ?? 0, JobC)?.kind === 'rescue';
}

/**
 * An unarmed crew member who is hiding from boarders takes the nearest free rescue job whose patient is also out of the intruders' sight
 * (and who they can reach), so the downed do not bleed out while the fight goes on. Medical work must be on for them. True if one was claimed.
 */
export function claimHiddenRescue(sim: Sim, grid: Grid, id: number, pos: Position, threats: readonly Cell[]): boolean {
  const prio = sim.world.get(id, PrioritiesC) as Priorities | undefined;
  if (!prio || prio.medical <= 0 || sim.world.has(id, AssignmentC)) return false;
  const shipId = shipIdOf(sim, pos);
  let best: { job: number; steps: Tile[] } | null = null;
  for (const jobId of sim.world.query(JobC)) {
    const job = sim.world.get(jobId, JobC);
    if (!job || job.kind !== 'rescue' || job.reservedBy !== 0 || job.target === id || shipIdOf(sim, job) !== shipId) continue;
    const goal = jobGoal(job);
    if (!hiddenFrom(sim, grid, goal, threats)) continue;
    const plan = planWalk(sim, id, shipId, origin(pos), goal);
    if (plan && !plan.thin && (!best || plan.steps.length < best.steps.length)) best = { job: jobId, steps: plan.steps };
  }
  if (!best) return false;
  (sim.world.get(best.job, JobC) as { reservedBy: number }).reservedBy = id;
  sim.world.add(id, AssignmentC, { jobId: best.job });
  (sim.world.get(id, PathC) as Path).steps = best.steps;
  return true;
}

