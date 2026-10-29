import { releaseBedClaim } from '../crew/beds';
import { AssignmentC, BedClaimC, CarriedC, CrewC, EatC, JobC, PathC, type Crew, type Job } from '../crew/components';
import { clearPath } from '../crew/helpers';
import type { Tile } from '../crew/pathfind';
import { isErrand } from '../eva/errands';
import { dropCarried } from '../items/stacks';
import type { Sim } from '../sim';
import { classOf } from './classes';
import { IntentC, InterruptC, TaskC } from './components';
import type { Blackboard, DriveId, Frame, Hold, MachineId, Task } from './types';

/**
 * The task API: the only writers of `AssignmentC` (lint enforces it) and of `TaskC`. Phase 1 keeps the legacy components as
 * the saved truth and makes `Task` mirror them: every write here is followed by `syncTask`, and the scheduler re-syncs every
 * crew member it visits. Jobless tasks (a walk to the robot bay, an idle stroll) exist only in `Task` and are set by the
 * machine that starts them.
 */

/** The machine that carries out a job of this kind. */
export function machineOf(job: Job): MachineId {
  if (job.kind === 'haul') return 'haul';
  if (job.kind === 'rescue') return 'rescue';
  if (isErrand(job)) return 'eva';
  return 'generic';
}

/** The state a job machine is in while on the way (before work): derived from the legacy components. */
export function travelState(sim: Sim, crew: number, job: Job): string {
  if (job.kind === 'haul') return job.haul?.phase === 'deliver' ? 'ToDest' : 'ToSource';
  if (job.kind === 'rescue') return sim.world.get(job.target ?? 0, CarriedC)?.carrier === crew ? 'ToBed' : 'ToPatient';
  if (isErrand(job)) return 'ToAirlock';
  return 'Navigate';
}

/** The state a job machine is in while working at the site. */
export function workState(sim: Sim, crew: number, job: Job): string {
  if (job.kind === 'haul') return job.haul?.phase === 'deliver' ? 'Deposit' : 'Take';
  if (job.kind === 'rescue') return sim.world.get(job.target ?? 0, CarriedC)?.carrier === crew ? 'Lay' : 'Lift';
  if (job.kind === 'suitUp') return 'Don';
  if (job.kind === 'suitOff') return 'Doff';
  return 'Work';
}

function newTask(sim: Sim, job: number, drive: DriveId, machine: MachineId, state: string, bb: Blackboard, holds: Hold[] = [], stack: Frame[] = [], jobC?: Job): Task {
  return { job, drive, machine, state, since: sim.tick, class: classOf(machine, state, jobC), stack, holds, bb };
}

/** The task a held job implies: a suit errand set aside for a job it was started for nests under that job's machine. */
function jobTask(sim: Sim, crew: number, jobId: number, job: Job): Task {
  if (isErrand(job)) {
    const bb: Blackboard = { target: job.target ?? 0, aux: jobId, tile: { x: job.x, y: job.y } };
    const parent = job.resume ? sim.world.get(job.resume, JobC) : undefined;
    if (job.resume && parent && parent.reservedBy === crew) {
      const pm = machineOf(parent);
      const ps = travelState(sim, crew, parent);
      const frame: Frame = { machine: pm, state: ps, class: classOf(pm, ps, parent), bb: { target: parent.target ?? 0 } };
      return newTask(sim, job.resume, 'work', 'eva', 'ToAirlock', bb, [{ kind: 'errand', id: jobId }], [frame]);
    }
    return newTask(sim, jobId, 'work', 'eva', 'ToAirlock', bb);
  }
  const machine = machineOf(job);
  return newTask(sim, jobId, 'work', machine, travelState(sim, crew, job), { target: job.target ?? 0 }, [], [], job);
}

/** The task the legacy components imply, or null when they imply none (idle, or a jobless walk only `Task` knows). */
export function deriveTask(sim: Sim, crew: number): Task | null {
  const a = sim.world.get(crew, AssignmentC);
  if (a) {
    const job = sim.world.get(a.jobId, JobC);
    return job ? jobTask(sim, crew, a.jobId, job) : newTask(sim, a.jobId, 'work', 'generic', 'Navigate', {});
  }
  const c = sim.world.get(crew, CrewC) as Crew | undefined;
  const claim = sim.world.get(crew, BedClaimC);
  if (c?.activity === 'sleeping' || claim) {
    const holds: Hold[] = claim ? [{ kind: 'bed', id: claim.bed }] : [];
    return newTask(sim, 0, 'sleep', 'sleep', c?.activity === 'sleeping' ? 'Sleep' : 'Walk', claim ? { aux: claim.bed } : {}, holds);
  }
  const eat = sim.world.get(crew, EatC);
  if (eat) return newTask(sim, 0, 'eat', 'eat', eat.left >= 0 ? 'Consume' : 'Walk', { tile: { x: eat.x, y: eat.y } });
  if (c?.activity === 'charging') return newTask(sim, 0, 'recharge', 'charge', 'Charge', {});
  return null;
}

/** A task the legacy components spell out (so it ends when they no longer do): any job task and the need states. */
const derivable = (t: Task): boolean =>
  t.job !== 0 || t.machine === 'eat' || (t.machine === 'sleep' && t.state !== 'ClaimBed') || (t.machine === 'charge' && t.state === 'Charge');

const sameHolds = (a: Hold[], b: Hold[]): boolean => a.length === b.length && a.every((h, i) => h.kind === b[i]?.kind && h.id === b[i]?.id);

/** Same task (same job, machine, nesting and holds): its state and start tick carry over. */
function sameTask(a: Task, b: Task): boolean {
  return a.job === b.job && a.machine === b.machine && a.drive === b.drive && a.stack.length === b.stack.length && sameHolds(a.holds, b.holds);
}

/**
 * Bring `Task` in line with the legacy components. A derived task replaces a different one (keeping the state and start of the
 * same one; need states, which the legacy components spell out, are refreshed). With nothing derived, a jobless task is kept
 * only with `keepJobless` (the scheduler's re-sync; an abort or a completion ends it).
 */
export function syncTask(sim: Sim, crew: number, keepJobless = false): void {
  const prev = sim.world.get(crew, TaskC);
  const next = deriveTask(sim, crew);
  if (!next) {
    if (prev && (!keepJobless || prev.job !== 0 || derivable(prev))) sim.world.remove(crew, TaskC);
    return;
  }
  if (prev && sameTask(prev, next)) {
    if (next.job === 0 && prev.state !== next.state) setState(sim, crew, prev, next.state);
    if (next.job === 0 && next.bb.aux !== undefined) prev.bb.aux = next.bb.aux;
    return;
  }
  sim.world.add(crew, TaskC, next);
}

/** Move a task to another state (and its class with it). */
export function setState(sim: Sim, crew: number, task: Task, state: string, job?: Job): void {
  if (task.state === state) return;
  task.state = state;
  task.class = classOf(task.machine, state, job ?? sim.world.get(task.job, JobC));
}

/** Set the state of the crew member's task, if it has one of this machine. */
export function markState(sim: Sim, crew: number, machine: MachineId, state: string, job?: Job): void {
  const t = sim.world.get(crew, TaskC);
  if (t && t.machine === machine) setState(sim, crew, t, state, job);
}

/** Start (or keep) a task only `Task` records: a walk to the robot bay, an idle walk, waiting to stow a suit. */
export function setJoblessTask(sim: Sim, crew: number, drive: DriveId, machine: MachineId, state: string, bb: Blackboard = {}): void {
  const prev = sim.world.get(crew, TaskC);
  if (prev && prev.job === 0 && prev.machine === machine && prev.drive === drive && prev.stack.length === 0) {
    setState(sim, crew, prev, state);
    prev.bb = bb;
    return;
  }
  sim.world.add(crew, TaskC, newTask(sim, 0, drive, machine, state, bb));
}

/** End a jobless task (nothing to do). */
export function clearJoblessTask(sim: Sim, crew: number): void {
  const t = sim.world.get(crew, TaskC);
  if (t && t.job === 0) sim.world.remove(crew, TaskC);
}

// --- Holds --------------------------------------------------------------------------------------------------------------

/** Reserve a job for a crew member and make it their task; `steps` (kept by reference) become their path. */
export function reserveJob(sim: Sim, crew: number, jobId: number, steps?: Tile[]): void {
  (sim.world.get(jobId, JobC) as { reservedBy: number }).reservedBy = crew;
  sim.world.add(crew, AssignmentC, { jobId });
  if (steps) (sim.world.get(crew, PathC) as { steps: Tile[] }).steps = steps;
  syncTask(sim, crew);
}

/** Make a job the crew member already holds (`reservedBy`) their task: a suit errand, or the job one was set aside for. */
export function attachJob(sim: Sim, crew: number, jobId: number): void {
  sim.world.add(crew, AssignmentC, { jobId });
  syncTask(sim, crew);
}

/** The work is done: the crew member no longer holds the job (the caller destroys it). */
export function detachJob(sim: Sim, crew: number): void {
  sim.world.remove(crew, AssignmentC);
}

/** Why a task was abandoned. Phase 1 keeps each legacy release as it was: the reason picks what is disposed of besides the job. */
export type AbortReason =
  | 'downed' | 'dead' | 'drafted' | 'surrendered' | 'boarded' | 'removed' | 'halted' | 'fight' | 'equip'
  | 'heldForMend' | 'preempt' | 'relieved' | 'unreachable' | 'jobGone' | 'cancelled' | 'replaced' | 'order' | 'drive'
  | 'standDown' | 'imprisoned' | 'dismissed' | 'debug';

interface Dispose {
  /** Release the sleeping-bed claim. */
  bed?: true;
  /** Drop the carried load at the crew member's feet. */
  carried?: true;
  /** A sleeper, charger or eater stops (activity back to idle). */
  wake?: true;
  /** The crew member is gone for good: forget the intent too. */
  forget?: true;
}

const DISPOSE: Partial<Record<AbortReason, Dispose>> = {
  downed: { bed: true }, drafted: { bed: true }, surrendered: { bed: true }, boarded: { bed: true }, removed: { bed: true },
  dead: { bed: true, forget: true },
  halted: { bed: true, carried: true },
  fight: { bed: true, carried: true, wake: true },
  equip: { carried: true },
};

/**
 * Abandon the crew member's task: the only teardown. In order: free the job (when still theirs) and stop holding it, stop
 * walking (the step in progress finishes), then what the reason disposes of (bed claim, load, a need in progress), and end the
 * task. Errands set aside are swept by the suits system next tick, as before (`sweepErrands`). Callers apply their own state.
 */
export function abortTask(sim: Sim, crew: number, reason: AbortReason): void {
  const a = sim.world.get(crew, AssignmentC);
  if (a) {
    const job = sim.world.get(a.jobId, JobC);
    if (job && job.reservedBy === crew) job.reservedBy = 0;
    sim.world.remove(crew, AssignmentC);
  }
  clearPath(sim, crew);
  const d = DISPOSE[reason];
  if (d?.bed) releaseBedClaim(sim, crew);
  if (d?.carried) dropCarried(sim, crew);
  if (d?.wake) {
    const c = sim.world.get(crew, CrewC) as Crew;
    if (c.activity === 'sleeping' || c.activity === 'charging' || c.activity === 'eating') c.activity = 'idle';
  }
  if (d?.forget) {
    sim.world.remove(crew, TaskC);
    sim.world.remove(crew, IntentC);
    sim.world.remove(crew, InterruptC);
    return;
  }
  syncTask(sim, crew);
}

/** True if the crew member is on a rescue job and holds the patient (they must not drop them to sleep or fight). */
export function isCarrying(sim: Sim, crew: number): boolean {
  const a = sim.world.get(crew, AssignmentC);
  const job = a && sim.world.get(a.jobId, JobC);
  return !!job && job.kind === 'rescue' && sim.world.get(job.target ?? 0, CarriedC)?.carrier === crew;
}
