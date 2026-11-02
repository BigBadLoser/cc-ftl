import { AssignmentC, JobC, PathC, type Job, type Position } from '../../crew/components';
import { isSettled } from '../../crew/helpers';
import type { Tile } from '../../crew/pathfind';
import { findSuitStow, isErrand, type SuitSource } from '../../eva/errands';
import { isSuited, suitDef, suitTile } from '../../eva/suit';
import { shipIdOf } from '../../regions';
import type { Sim } from '../../sim';
import { TICK_HZ } from '../../time';
import { YardCrewC } from '../../yard/types';
import { SalvageCrewC } from '../../salvage/components';
import { attachJob, setJoblessTask } from '../task';

/**
 * The eva machine (docs/CREW_AI.md section 6): `ToAirlock`, then `Don` or `Doff` at the airlock's suit tile. A suit errand is a
 * personal job entity (kept, decision 7). Started for a job that needs a suit, it nests under that job's machine (the job stays
 * reserved and resumes when the suit is on); started on its own (an idle crew member stowing a suit, a player order) it is the root
 * task. Phase 1 keeps the legacy flow: the errand is the crew member's assignment, the job set aside keeps its reservation.
 */

/**
 * Start a suit errand for a crew member: a personal job at the airlock's suit tile that becomes their assignment.
 * `resume` is a job they already reserved; it stays theirs and is picked up again when the suit is on. Does not touch
 * the crew member's other assignment (callers release it first when they want to).
 */
export function startErrand(sim: Sim, crew: number, kind: 'suitUp' | 'suitOff', src: SuitSource, shipId: number, resume?: number): number {
  const at = suitTile(sim, src.airlock) as Tile;
  const def = suitDef(sim);
  const id = sim.world.createEntity();
  sim.world.add(id, JobC, {
    category: 'operating', kind, x: at.x, y: at.y, struct: 0, progress: 0, reservedBy: crew,
    work: Math.max(1, Math.round((kind === 'suitUp' ? def.donSec : def.doffSec) * TICK_HZ)),
    target: src.airlock, errandFor: crew, ...(resume ? { resume } : {}),
  });
  attachJob(sim, crew, id);
  (sim.world.get(crew, PathC) as { steps: Tile[] }).steps = [...src.steps];
  return id;
}

/** When a suit errand ends, the crew member goes back to the job it interrupted (if it is still theirs): the parent frame pops. */
export function resumeAfter(sim: Sim, crew: number, job: Job): void {
  const next = job.resume ? sim.world.get(job.resume, JobC) : undefined;
  if (job.resume && next && next.reservedBy === crew && !sim.world.has(crew, AssignmentC)) attachJob(sim, crew, job.resume);
}

/**
 * Drop errands whose crew member no longer carries them (the assignment was released, they slept, died or were
 * drafted away) and free the job they had set aside. The orphan sweep of an aborted nested task, a tick after the abort as before.
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

/** A suited crew member with nothing to do walks to an airlock and takes the suit off, so the suit is free for the next one. */
export function stowSuit(sim: Sim, id: number, pos: Position): boolean {
  // The shipyard's contractors and a salvage team keep their suits on until the shuttle.
  if (!isSuited(sim, id) || sim.world.has(id, YardCrewC) || sim.world.has(id, SalvageCrewC)) return false;
  if (!isSettled(pos) || (sim.tick + id) % 20 !== 0) {
    setJoblessTask(sim, id, 'idle', 'eva', 'Wait'); // look for an airlock every second or so; meanwhile stand still
    return true;
  }
  const src = findSuitStow(sim, id, pos);
  if (!src) return false;
  startErrand(sim, id, 'suitOff', src, shipIdOf(sim, pos));
  return true;
}
