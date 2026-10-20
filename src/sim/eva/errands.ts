import { AssignmentC, JobC, PathC, type Job, type Position } from '../crew/components';
import { origin } from '../crew/helpers';
import type { Tile } from '../crew/pathfind';
import { ModuleC } from '../modules/components';
import { AirlockC } from '../portals/components';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { planWalk } from './route';
import { airlockUsable, freeSuits, isThin, suitDef, suitTile } from './suit';
import { gridIdOf } from '../regions';

/** An airlock to fit or stow a suit at, with the walk to its suit tile. */
export interface SuitSource {
  airlock: number;
  steps: Tile[];
}

/** True for the personal errands the sim makes for a crew member (nobody else may pick them up). */
export function isErrand(job: Job): boolean {
  return job.kind === 'suitUp' || job.kind === 'suitOff';
}

function onGrid(sim: Sim, airlock: number, gridId: number): boolean {
  return gridIdOf(sim, sim.world.get(airlock, ModuleC)) === gridId;
}

/**
 * The best airlock on the crew member's grid to get a suit from: one with a free suit and a walk to its suit tile that
 * keeps out of thin air. Shortest walk wins, then the lowest module id. Null when there is none.
 */
export function findSuitSource(sim: Sim, crew: number, pos: Position): SuitSource | null {
  let best: SuitSource | null = null;
  for (const id of sim.world.query(AirlockC)) {
    const at = suitTile(sim, id);
    if (!at || !airlockUsable(sim, id) || freeSuits(sim, id) <= 0 || !onGrid(sim, id, gridIdOf(sim, pos))) continue;
    const plan = planWalk(sim, crew, gridIdOf(sim, pos), origin(pos), at);
    if (!plan || plan.thin) continue;
    if (!best || plan.steps.length < best.steps.length) best = { airlock: id, steps: plan.steps };
  }
  return best;
}

/** The nearest airlock on the grid whose suit tile has breathable air, to take the suit off at. */
export function findSuitStow(sim: Sim, crew: number, pos: Position): SuitSource | null {
  const grid = sim.grids.get(gridIdOf(sim, pos));
  let best: SuitSource | null = null;
  for (const id of sim.world.query(AirlockC)) {
    const at = suitTile(sim, id);
    if (!grid || !at || !airlockUsable(sim, id) || !onGrid(sim, id, gridIdOf(sim, pos)) || isThin(grid, at.x, at.y)) continue;
    const plan = planWalk(sim, crew, gridIdOf(sim, pos), origin(pos), at);
    if (plan && (!best || plan.steps.length < best.steps.length)) best = { airlock: id, steps: plan.steps };
  }
  return best;
}

/**
 * Start a suit errand for a crew member: a personal job at the airlock's suit tile that becomes their assignment.
 * `resume` is a job they already reserved; it stays theirs and is picked up again when the suit is on. Does not touch
 * the crew member's other assignment (callers release it first when they want to).
 */
export function startErrand(sim: Sim, crew: number, kind: 'suitUp' | 'suitOff', src: SuitSource, gridId: number, resume?: number): number {
  const at = suitTile(sim, src.airlock) as Tile;
  const def = suitDef(sim);
  const id = sim.world.createEntity();
  sim.world.add(id, JobC, {
    category: 'operating', kind, x: at.x, y: at.y, struct: 0, progress: 0, reservedBy: crew,
    work: Math.max(1, Math.round((kind === 'suitUp' ? def.donSec : def.doffSec) * TICK_HZ)),
    target: src.airlock, errandFor: crew, ...(resume ? { resume } : {}),
  });
  sim.world.add(crew, AssignmentC, { jobId: id });
  (sim.world.get(crew, PathC) as { steps: Tile[]; then?: unknown }).steps = [...src.steps];
  delete (sim.world.get(crew, PathC) as { then?: unknown }).then;
  return id;
}

/** When a suit errand ends, the crew member goes back to the job it interrupted (if it is still theirs). */
export function resumeAfter(sim: Sim, crew: number, job: Job): void {
  const next = job.resume ? sim.world.get(job.resume, JobC) : undefined;
  if (job.resume && next && next.reservedBy === crew && !sim.world.has(crew, AssignmentC)) sim.world.add(crew, AssignmentC, { jobId: job.resume });
}

/**
 * Drop errands whose crew member no longer carries them (the assignment was released, they slept, died or were
 * drafted away) and free the job they had set aside.
 */
export function sweepErrands(sim: Sim): void {
  for (const id of [...sim.world.query(JobC)]) {
    const job = sim.world.get(id, JobC) as Job;
    if (!isErrand(job)) continue;
    const who = job.errandFor ?? 0;
    if (who && sim.world.has(who, AssignmentC) && sim.world.get(who, AssignmentC)?.jobId === id) continue;
    const parked = job.resume ? sim.world.get(job.resume, JobC) : undefined;
    if (parked && parked.reservedBy === who && sim.world.get(who, AssignmentC)?.jobId !== job.resume) parked.reservedBy = 0;
    job.reservedBy = 0;
    sim.world.destroyEntity(id);
  }
}
