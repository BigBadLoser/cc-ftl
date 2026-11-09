import { AssignmentC, CarriedC, CrewC, JobC } from '../crew/components';
import { AwayC } from '../away/components';
import { BreakdownC } from '../crew/breakTypes';
import { SuitC } from '../eva/components';
import type { Sim } from '../sim';
import { EVAL_TICKS } from '../tuning';
import { airDraining } from './airNeed';
import { IntentC, TaskC } from './components';
import type { DriveDef, DriveInput, Intent, PolicyDef } from './types';
import { evaluateIntent, isUrgent, policyOf, readInput, type TaskView } from './utility';

/**
 * The evaluation stagger (docs/CREW_AI.md section 4). A crew member's drives are scored in full (`evaluateIntent`) on their staggered tick,
 * once per EVAL_TICKS, and in between the last ranking (`Intent.rank`) is served: the need machines, the scheduler and the idle turn still
 * run every tick, only the scoring waits. An evaluation is due at once when:
 * - a wake reason is set (`Intent.wake`: a forced state held them out of the loop),
 * - their task context changed (`taskContext`: a job taken, finished or lost, a task's machine, sleeping, eating or charging begun or
 *   ended, a patient picked up, a suit put on or off, thin air underfoot, a party joined or left, a mental break begun or over),
 * - a drive crossed its urgent line, or one that harms at zero (air, starvation) is under it (then every tick, as before),
 * - their suit tank drains or they are of an away party (then every tick: the travel time to an air source, a recall, a fight, a ride
 *   home all move those drives faster than the stagger).
 * All of it is saved state (`Intent`), so a loaded game evaluates on the same ticks as the uninterrupted run.
 */

/** A forced state (a break, a draft, downed, off duty) held the crew member out of the loop: evaluate once it ends. */
export const WAKE_HELD = 1;

/** The next staggered tick after `tick` for crew member `id`. */
export const nextEvalTick = (tick: number, id: number): number => tick + EVAL_TICKS - (((tick + id) % EVAL_TICKS) + EVAL_TICKS) % EVAL_TICKS;

/** Set a wake reason: the crew member's next turn evaluates their drives. */
export function wakeIntent(sim: Sim, id: number, reason: number): void {
  const intent = sim.world.get(id, IntentC);
  if (intent && ((intent.wake ?? 0) & reason) === 0) intent.wake = (intent.wake ?? 0) | reason;
}

/** Fixed codes for the task context (plain constants: the context is saved, so its numbers must not depend on the order things were seen). */
const MACHINE: Record<string, number> = { generic: 1, haul: 2, rescue: 3, eva: 4, eat: 5, sleep: 6, charge: 7, escape: 8, leisure: 9, return: 10, break: 11 };
const NEED_ACTIVITY: Record<string, number> = { sleeping: 1, eating: 2, charging: 3 };
const mix = (h: number, n: number): number => Math.imul(h ^ (n | 0), 0x01000193);

/**
 * What a drive's gates read of the crew member's task, as one number: the job held (and a carried patient), the task's machine, the
 * activity when it is a need's own (sleeping, eating, charging), a suit worn and whether its tank drains, and an away party.
 */
export function taskContext(sim: Sim, id: number): number {
  const w = sim.world;
  const job = w.get(id, AssignmentC)?.jobId ?? 0;
  let h = mix(0x811c9dc5, job);
  if (job) {
    const j = w.get(job, JobC);
    if (j?.kind === 'rescue' && w.get(j.target ?? 0, CarriedC)?.carrier === id) h = mix(h, 1);
  }
  const machine = w.get(id, TaskC)?.machine;
  const act = w.get(id, CrewC)?.activity;
  let bits = (machine ? (MACHINE[machine] ?? 15) : 0) | ((act ? (NEED_ACTIVITY[act] ?? 0) : 0) << 4);
  if (w.has(id, SuitC)) bits |= airDraining(sim, id) ? 3 << 6 : 1 << 6;
  if (w.has(id, AwayC)) bits |= 1 << 8;
  if (w.has(id, BreakdownC)) bits |= 1 << 9; // a break begun or over (a mild one closes the work drive)
  return mix(h, bits) >>> 0;
}

/** Per policy: the urgent drives read every tick (cheap inputs; air and the way home are covered by the every-tick classes), and those that harm at zero. */
interface Guard {
  urgent: { i: number; def: DriveDef }[];
  harm: number;
}
const guards = new WeakMap<PolicyDef, Guard>();
function guardOf(policy: PolicyDef): Guard {
  let g = guards.get(policy);
  if (!g) {
    g = { urgent: [], harm: 0 };
    policy.drives.forEach((d, i) => {
      if (d.harmsAtZero) (g as Guard).harm |= 1 << i;
      if (d.urgent && d.input && d.input !== 'airMargin' && d.input !== 'awayReturn') (g as Guard).urgent.push({ i, def: d });
    });
    guards.set(policy, g);
  }
  return g;
}

/** True when the crew member's drives must be evaluated this tick (see the file header). */
function due(sim: Sim, id: number, policy: PolicyDef, intent: Intent | undefined): boolean {
  if (!intent || intent.policy !== policy.id || !intent.rank || intent.wake || sim.tick >= intent.nextEval) return true;
  const w = sim.world;
  if (w.has(id, AwayC) || (w.has(id, SuitC) && airDraining(sim, id))) return true; // every tick (see the file header)
  if (taskContext(sim, id) !== intent.ctx) return true;
  const g = guardOf(policy);
  for (const { i, def } of g.urgent) {
    const x = readInput(sim, id, def.input as DriveInput);
    if (x === undefined || !isUrgent(def, x)) continue;
    // Newly urgent, or urgent and harmful at zero (every tick, as before the stagger).
    if (((intent.urgent ?? 0) & (1 << i)) === 0 || (g.harm & (1 << i)) !== 0) return true;
  }
  return false;
}

const served = new WeakMap<number[], DriveDef[]>();
/** The drives of a kept ranking (a memo by the ranking array: never saved, the same answer after a load). */
function ranking(policy: PolicyDef, rank: number[]): DriveDef[] {
  let r = served.get(rank);
  if (!r) {
    r = rank.map((i) => policy.drives[i] as DriveDef);
    served.set(rank, r);
  }
  return r;
}

/** The ranked drives for this tick: a fresh evaluation when one is due, else the last ranking. */
export function decideIntent(sim: Sim, id: number, view: TaskView): DriveDef[] {
  return decide(sim, id, view, false) as DriveDef[];
}

/** As `decideIntent`, but null when no evaluation is due (the last ranking holds and nothing new is to be learnt from it). */
export function freshIntent(sim: Sim, id: number, view: TaskView): DriveDef[] | null {
  return decide(sim, id, view, true);
}

function decide(sim: Sim, id: number, view: TaskView, onlyFresh: boolean): DriveDef[] | null {
  const policy = policyOf(sim, id);
  const intent = sim.world.get(id, IntentC);
  if (!due(sim, id, policy, intent)) return onlyFresh ? null : ranking(policy, (intent as Intent).rank as number[]);
  const ctx = taskContext(sim, id);
  const ranked = evaluateIntent(sim, id, view);
  const after = sim.world.get(id, IntentC) as Intent;
  after.ctx = ctx;
  after.nextEval = nextEvalTick(sim.tick, id);
  delete after.wake;
  return ranked;
}
