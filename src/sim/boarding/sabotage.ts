import { abortTask, attachJob } from '../ai/task';
import { damageModule } from '../combat/effects';
import { factionsHostile } from '../combat/factions';
import { shipById } from '../combat/ships';
import { AssignmentC, CrewC, DeadC, DownedC, DraftedC, JobC, PathC, PositionC, type Job, type Path } from '../crew/components';
import type { WorkResult } from '../crew/jobWork';
import { isIncapacitated, origin } from '../crew/helpers';
import { planWalk } from '../eva/route';
import { AllegianceC, FighterC } from '../fight/components';
import { destroyJob } from '../items/stacks';
import { ModuleC } from '../modules/components';
import { footprintTiles } from '../modules/footprint';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { SABOTAGE_PER_SEC } from '../tuning';
import { EmbarkOrderC } from '../vehicles/components';
import { SabotageOrderC } from './components';

/**
 * Sabotage: a boarder wrecks a module of the hostile ship they stand on. It is a job of kind 'sabotage' (like an ordered hack):
 * the boarder is drafted and standing by (no move target), walks to a tile beside the module and takes SABOTAGE_PER_SEC hp off it
 * per second, with weapon or tools alike. The damage goes through `damageModule`, the same path a weapon hit takes, so a module
 * wrecked this way behaves exactly like one shot to pieces.
 *
 * The order is not a priority over the fight: a drafted crew member who sees a hostile engages it (crew combat), which drops the
 * job. It also ends when the module is destroyed, the boarder goes down, is drafted off, is given another order (move, attack,
 * embark, man) or the order is cancelled. Every end emits `crew.sabotageEnded` with the reason.
 */

type Result = 'ok' | string;

/** Why the crew member cannot be ordered to wreck this module, or null. */
function sabotageError(sim: Sim, crew: number, module: number): string | null {
  const pos = sim.world.get(crew, PositionC);
  if (!sim.world.has(crew, CrewC) || !pos || sim.world.has(crew, DeadC)) return 'noCrew';
  if (isIncapacitated(sim, crew)) return 'incapacitated';
  const m = sim.world.get(module, ModuleC);
  if (!m || m.hp <= 0) return 'badTarget';
  const ship = shipById(sim, shipIdOf(sim, m));
  if (!ship || !factionsHostile(sim.world.get(crew, AllegianceC)?.faction, ship.faction)) return 'notHostile';
  if (shipIdOf(sim, pos) !== shipIdOf(sim, m)) return 'notAboard';
  return null;
}

/** A walk to a tile beside the module: the shortest over its footprint, or null. */
export function planSabotage(sim: Sim, crew: number, module: number): { x: number; y: number; steps: { x: number; y: number }[] } | null {
  const pos = sim.world.get(crew, PositionC);
  const m = sim.world.get(module, ModuleC);
  const def = m && sim.content.modules[m.def];
  if (!pos || !m || !def) return null;
  let plan: { x: number; y: number; steps: { x: number; y: number }[] } | null = null;
  for (const t of footprintTiles(def, m.x, m.y, m.rot)) {
    const steps = planWalk(sim, crew, shipIdOf(sim, pos), origin(pos), { x: t.x, y: t.y, adjacent: true })?.steps; // the route the walk will take (a suited boarder may cross the hull)
    if (steps && (!plan || steps.length < plan.steps.length)) plan = { x: t.x, y: t.y, steps };
  }
  return plan;
}

/** Create the sabotage job for a standing-by boarder and start the walk. */
export function startSabotageJob(sim: Sim, crew: number, module: number, plan: NonNullable<ReturnType<typeof planSabotage>>): void {
  const job = sim.world.createEntity();
  sim.world.add(job, JobC, {
    category: 'operating', kind: 'sabotage', x: plan.x, y: plan.y, struct: 0, work: 1, progress: 0, reservedBy: crew, target: module, holder: crew,
  });
  attachJob(sim, crew, job);
  (sim.world.get(crew, PathC) as Path).steps = plan.steps;
}

/** Order one crew member to wreck `module`. Returns 'ok' or a reject reason. */
function orderSabotage(sim: Sim, crew: number, module: number): Result {
  const err = sabotageError(sim, crew, module);
  if (err) return err;
  const plan = planSabotage(sim, crew, module);
  if (!plan) return 'unreachable';
  endSabotage(sim, crew, 'cancelled'); // a new order replaces an old one
  abortTask(sim, crew, 'order');
  const drafted = sim.world.get(crew, DraftedC);
  if (drafted) {
    drafted.target = null;
    delete drafted.planned;
  } else sim.world.add(crew, DraftedC, { target: null });
  const f = sim.world.get(crew, FighterC);
  if (f) f.ordered = 0;
  sim.world.remove(crew, EmbarkOrderC);
  (sim.world.get(crew, CrewC) as { activity: string }).activity = 'drafted';
  sim.world.add(crew, SabotageOrderC, { module });
  const ship = shipIdOf(sim, sim.world.get(module, ModuleC));
  sim.events.emit({ type: 'crew.sabotageStarted', crew, module, ship });
  // A boarder already in a fight does not sabotage while it lasts (crew combat only drops a job when it *enters* a fight): the order
  // starts paused and the resume system posts the job once the fight is over.
  if (f && f.mode !== 'idle') sim.events.emit({ type: 'crew.sabotagePaused', crew, module, ship });
  else startSabotageJob(sim, crew, module, plan);
  return 'ok';
}

/** `crew.sabotage`: the group is sent to wreck `module`. Rejected only when nobody could be sent (the first member's reason). */
export function orderSabotageGroup(sim: Sim, ids: readonly number[], module: number): string | null {
  let first: string | null = null;
  let any = false;
  for (const id of ids) {
    const r = orderSabotage(sim, id, module);
    if (r === 'ok') any = true;
    else first ??= r;
  }
  return any ? null : (first ?? 'noCrew');
}

/** The sabotage job this crew member holds, or 0. */
function sabotageJobOf(sim: Sim, crew: number): number {
  const a = sim.world.get(crew, AssignmentC);
  return a && sim.world.get(a.jobId, JobC)?.kind === 'sabotage' ? a.jobId : 0;
}

/** Stop the crew member's sabotage order (the job, or the order alone while a fight pauses it) with `reason`. Returns true if there was one. */
function endSabotage(sim: Sim, crew: number, reason: 'cancelled'): boolean {
  const jobId = sabotageJobOf(sim, crew);
  const job = jobId ? sim.world.get(jobId, JobC) : undefined;
  const order = sim.world.get(crew, SabotageOrderC);
  sim.world.remove(crew, SabotageOrderC);
  if (job) {
    emitEnded(sim, crew, job, reason);
    destroyJob(sim, jobId); // releases the holder's task
    return true;
  }
  if (!order) return false;
  endOrder(sim, crew, order.module, reason);
  return true;
}

/** The order ended for good with no job to name it (paused by a fight): report it and forget it. */
export function endOrder(sim: Sim, crew: number, module: number, reason: 'destroyed' | 'interrupted' | 'downed' | 'cancelled'): void {
  sim.world.remove(crew, SabotageOrderC);
  const m = sim.world.get(module, ModuleC);
  sim.events.emit({ type: 'crew.sabotageEnded', crew, module, ship: m ? shipIdOf(sim, m) : 0, reason });
}

/** `crew.cancelSabotage`: drop the members' sabotage orders. They stay drafted where they stand. Returns a reject reason, or null. */
export function cancelSabotage(sim: Sim, ids: readonly number[]): string | null {
  let any = false;
  for (const id of ids) if (endSabotage(sim, id, 'cancelled')) any = true;
  return any ? null : 'noSabotage';
}

function emitEnded(sim: Sim, crew: number, job: Job, reason: 'destroyed' | 'interrupted' | 'downed' | 'cancelled'): void {
  sim.events.emit({ type: 'crew.sabotageEnded', crew, module: job.target ?? 0, ship: shipIdOf(sim, job), reason });
}

/** One tick of wrecking (the work step). Done when the module is destroyed (or already gone). */
export function performSabotage(sim: Sim, crew: number, job: Job): WorkResult {
  const id = job.target ?? 0;
  const m = sim.world.get(id, ModuleC);
  if (!m || m.hp <= 0) {
    sim.world.remove(crew, SabotageOrderC);
    emitEnded(sim, crew, job, 'destroyed');
    return 'done';
  }
  damageModule(sim, id, SABOTAGE_PER_SEC / TICK_HZ, shipIdOf(sim, m));
  if (m.hp > 0) return 'working';
  sim.world.remove(crew, SabotageOrderC);
  emitEnded(sim, crew, job, 'destroyed');
  return 'done';
}

/**
 * Keep or drop a sabotage job (autojobs). It lasts while its module stands and its boarder still holds it, drafted and standing
 * by. When it is dropped:
 *  - the module is gone (wrecked by someone else counts), or the boarder is downed or dead: the order ends ('destroyed', 'downed');
 *  - the boarder is still drafted and standing by with nothing else to do (a fight took the job): the order is only PAUSED, kept in
 *    `SabotageOrderC`, and `crew.sabotagePaused` is reported; it resumes by itself when the fight is over (boarding/resume.ts);
 *  - otherwise (moved, undrafted, given another job) the order ends ('interrupted').
 */
export function keepSabotage(sim: Sim, jobId: number, job: Job): boolean {
  const by = job.holder ?? 0;
  const m = sim.world.get(job.target ?? 0, ModuleC);
  const drafted = sim.world.get(by, DraftedC);
  const holding = job.reservedBy === by && by !== 0 && sim.world.get(by, AssignmentC)?.jobId === jobId && drafted?.target === null;
  if (m && m.hp > 0 && holding) return true;
  if (!m || m.hp <= 0) {
    sim.world.remove(by, SabotageOrderC);
    emitEnded(sim, by, job, 'destroyed');
  } else if (sim.world.has(by, DownedC) || sim.world.has(by, DeadC)) {
    sim.world.remove(by, SabotageOrderC);
    emitEnded(sim, by, job, 'downed');
  } else if (drafted?.target === null && !sim.world.has(by, AssignmentC) && sim.world.get(by, SabotageOrderC)?.module === job.target) {
    sim.events.emit({ type: 'crew.sabotagePaused', crew: by, module: job.target ?? 0, ship: shipIdOf(sim, job) });
  } else {
    sim.world.remove(by, SabotageOrderC);
    emitEnded(sim, by, job, 'interrupted');
  }
  return false;
}
