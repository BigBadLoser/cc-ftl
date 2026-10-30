import { AssignmentC, BedClaimC, CrewC, DeadC, DownedC, JobC, type Job } from '../crew/components';
import { isErrand } from '../eva/errands';
import { ModuleC } from '../modules/components';
import type { Sim } from '../sim';
import { TaskC } from './components';
import { deriveTask } from './task';

/**
 * The reservation audit (docs/CREW_AI.md section 3, invariants 1, 2, 3 and 5 as far as Phase 1 holds them). Pure: it reads the sim.
 * `problems` must be empty after every tick. `pendingSweep` counts what the legacy flow leaves for one tick on purpose: an errand
 * whose crew member was pulled away and the job it set aside, which the suits system sweeps at the start of the next tick.
 */
export interface AuditReport {
  problems: string[];
  pendingSweep: number;
}

const alive = (sim: Sim, id: number): boolean => sim.world.has(id, CrewC) && !sim.world.has(id, DeadC);

/** The errand waiting for the suits system's sweep that set `job` aside for `crew`, if any. */
function parkedBy(sim: Sim, jobId: number, crew: number): boolean {
  for (const id of sim.world.query(JobC)) {
    const e = sim.world.get(id, JobC) as Job;
    if (isErrand(e) && e.resume === jobId && e.errandFor === crew && sim.world.get(crew, AssignmentC)?.jobId !== id) return true;
  }
  return false;
}

export function auditReservations(sim: Sim): AuditReport {
  const problems: string[] = [];
  let pendingSweep = 0;
  // 1. A reserved job's holder is alive and holds it in its task (the root job, or the errand nested under it).
  for (const id of sim.world.query(JobC)) {
    const job = sim.world.get(id, JobC) as Job;
    const c = job.reservedBy;
    if (!c) continue;
    const task = sim.world.get(c, TaskC);
    const held = !!task && (task.job === id || task.holds.some((h) => h.kind === 'errand' && h.id === id));
    if (held && alive(sim, c)) continue;
    if (isErrand(job) && job.errandFor === c && sim.world.get(c, AssignmentC)?.jobId !== id) pendingSweep++;
    else if (!isErrand(job) && parkedBy(sim, id, c)) pendingSweep++;
    else problems.push(`job ${id} (${job.kind}) reserved by ${c}${alive(sim, c) ? '' : ' (gone)'} whose task does not hold it`);
  }
  // 3. Every crew member's task is the one the legacy components imply (the mirror is current), and holds one root job at most.
  for (const c of sim.world.query(CrewC)) {
    const task = sim.world.get(c, TaskC);
    const want = deriveTask(sim, c);
    const a = sim.world.get(c, AssignmentC);
    if (a && !task) problems.push(`crew ${c} holds job ${a.jobId} with no task`);
    if (!task) continue;
    if (sim.world.has(c, DeadC)) problems.push(`dead crew ${c} has a task`);
    if (want && (want.job !== task.job || want.machine !== task.machine || want.stack.length !== task.stack.length || JSON.stringify(want.holds) !== JSON.stringify(task.holds))) {
      problems.push(`crew ${c} task ${task.machine}/${task.state} job ${task.job} does not mirror ${want.machine} job ${want.job}`);
    }
    if (!want && task.job !== 0) problems.push(`crew ${c} task holds job ${task.job} but has no assignment`);
    if (task.stack.length > 2) problems.push(`crew ${c} task stack deeper than 2`);
    const errands = task.holds.filter((h) => h.kind === 'errand');
    if (errands.length !== (task.stack.length > 0 ? 1 : 0)) problems.push(`crew ${c} has ${errands.length} errand holds with a stack of ${task.stack.length}`);
    for (const e of errands) {
      const ej = sim.world.get(e.id, JobC);
      if (!ej || ej.resume !== task.job || ej.errandFor !== c || ej.reservedBy !== c) problems.push(`crew ${c} errand hold ${e.id} is not their errand for job ${task.job}`);
    }
  }
  // 2. A reserved bed has exactly one lifeline: the sleeper's claim, or the patient's `Downed.bed`.
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    if (!m || !m.reservedBy || !sim.content.modules[m.def]?.bed) continue;
    const b = m.reservedBy;
    const lines = Number(sim.world.get(b, BedClaimC)?.bed === id) + Number(sim.world.get(b, DownedC)?.bed === id);
    if (lines !== 1) problems.push(`bed ${id} reserved by ${b} with ${lines} lifelines`);
  }
  return { problems, pendingSweep };
}
