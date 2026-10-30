import { abortTask, attachJob } from '../ai/task';
import { damageModule } from '../combat/effects';
import { factionsHostile } from '../combat/factions';
import { shipById } from '../combat/ships';
import { AssignmentC, CrewC, DeadC, DownedC, DraftedC, JobC, PathC, PositionC, type Job, type Path } from '../crew/components';
import type { WorkResult } from '../crew/jobWork';
import { isIncapacitated, origin } from '../crew/helpers';
import { findPath } from '../crew/pathfind';
import { AllegianceC, FighterC } from '../fight/components';
import { destroyJob } from '../items/stacks';
import { ModuleC } from '../modules/components';
import { footprintTiles } from '../modules/footprint';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { SABOTAGE_PER_SEC } from '../tuning';
import { EmbarkOrderC } from '../vehicles/components';

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

/** Order one crew member to wreck `module`. Returns 'ok' or a reject reason. */
function orderSabotage(sim: Sim, crew: number, module: number): Result {
  const err = sabotageError(sim, crew, module);
  if (err) return err;
  const pos = sim.world.get(crew, PositionC)!;
  const m = sim.world.get(module, ModuleC)!;
  const def = sim.content.modules[m.def];
  if (!def) return 'badTarget';
  let plan: { x: number; y: number; steps: { x: number; y: number }[] } | null = null;
  for (const t of footprintTiles(def, m.x, m.y, m.rot)) {
    const steps = findPath(sim, shipIdOf(sim, pos), origin(pos), { x: t.x, y: t.y, adjacent: true });
    if (steps && (!plan || steps.length < plan.steps.length)) plan = { x: t.x, y: t.y, steps };
  }
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
  const job = sim.world.createEntity();
  sim.world.add(job, JobC, {
    category: 'operating', kind: 'sabotage', x: plan.x, y: plan.y, struct: 0, work: 1, progress: 0, reservedBy: crew, target: module, holder: crew,
  });
  attachJob(sim, crew, job);
  (sim.world.get(crew, PathC) as Path).steps = plan.steps;
  sim.events.emit({ type: 'crew.sabotageStarted', crew, module, ship: shipIdOf(sim, m) });
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

/** Stop the crew member's sabotage job (if any) with `reason`. Returns true if there was one. */
function endSabotage(sim: Sim, crew: number, reason: 'cancelled'): boolean {
  const jobId = sabotageJobOf(sim, crew);
  const job = jobId ? sim.world.get(jobId, JobC) : undefined;
  if (!job) return false;
  emitEnded(sim, crew, job, reason);
  destroyJob(sim, jobId); // releases the holder's task
  return true;
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
    emitEnded(sim, crew, job, 'destroyed');
    return 'done';
  }
  damageModule(sim, id, SABOTAGE_PER_SEC / TICK_HZ, shipIdOf(sim, m));
  if (m.hp > 0) return 'working';
  emitEnded(sim, crew, job, 'destroyed');
  return 'done';
}

/**
 * Keep or drop a sabotage job (autojobs). It lasts while its module stands and its boarder still holds it, drafted and standing
 * by; otherwise it is dropped with the reason (the module wrecked by someone else counts as 'destroyed').
 */
export function keepSabotage(sim: Sim, jobId: number, job: Job): boolean {
  const by = job.holder ?? 0;
  const m = sim.world.get(job.target ?? 0, ModuleC);
  const holding = job.reservedBy === by && by !== 0 && sim.world.get(by, AssignmentC)?.jobId === jobId && sim.world.get(by, DraftedC)?.target === null;
  if (m && m.hp > 0 && holding) return true;
  const reason = !m || m.hp <= 0 ? 'destroyed' : by !== 0 && (sim.world.has(by, DownedC) || sim.world.has(by, DeadC)) ? 'downed' : 'interrupted';
  emitEnded(sim, by, job, reason);
  return false;
}
