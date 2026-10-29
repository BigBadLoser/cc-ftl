import { AssignmentC, CrewC, JobC, type Job } from '../crew/components';
import type { Sim } from '../sim';
import { IntentC, InterruptC, TaskC } from './components';
import { LEGACY_DRIVES } from './policy';
import type { Blackboard, DriveId, Interrupt, Task, TaskClass } from './types';

/**
 * The AI debug inspector's core (docs/CREW_AI.md section 11), first cut: per crew member the policy and drive, the interrupt, and
 * the task's state path and holds. Pure: it reads the sim and never changes it. Phase 2 adds the job side (candidates, tuples).
 */
export interface CrewExplain {
  id: number;
  name: string;
  policy: string | null;
  drive: DriveId | null;
  /** Drive scores by drive id (per mille). */
  scores: Record<string, number>;
  interrupt: Interrupt | null;
  task: {
    /** Suspended parents first, the active machine last: `generic/Navigate > eva/ToAirlock`. */
    path: string;
    class: TaskClass;
    since: number;
    job: { id: number; kind: string; category: string } | null;
    /** Every claim the task holds, the root job first: `job 12`, `errand 40`, `bed 7`. */
    holds: string[];
    bb: Blackboard;
  } | null;
  /** The legacy assignment the task mirrors (Phase 1), or 0. */
  assignment: number;
}

/** A task's state path, outermost frame first. */
export function taskPath(task: Task): string {
  return [...task.stack.map((f) => `${f.machine}/${f.state}`), `${task.machine}/${task.state}`].join(' > ');
}

/** What a crew member wants, is held by and is doing, and what they hold. */
export function explainCrew(sim: Sim, id: number): CrewExplain {
  const intent = sim.world.get(id, IntentC);
  const task = sim.world.get(id, TaskC);
  const job = task?.job ? sim.world.get(task.job, JobC) : undefined;
  const scores: Record<string, number> = {};
  if (intent) LEGACY_DRIVES.forEach((d, i) => (scores[d] = intent.scores[i] ?? 0));
  return {
    id,
    name: sim.world.get(id, CrewC)?.name ?? '',
    policy: intent?.policy ?? null,
    drive: intent?.drive ?? null,
    scores,
    interrupt: sim.world.get(id, InterruptC) ?? null,
    task: task ? {
      path: taskPath(task),
      class: task.class,
      since: task.since,
      job: job ? jobRef(task.job, job) : null,
      holds: [...(task.job ? [`job ${task.job}`] : []), ...task.holds.map((h) => `${h.kind} ${h.id}`)],
      bb: task.bb,
    } : null,
    assignment: sim.world.get(id, AssignmentC)?.jobId ?? 0,
  };
}

const jobRef = (id: number, job: Job): { id: number; kind: string; category: string } => ({ id, kind: job.kind, category: job.category });

/** Every crew member with an intent or a task, in id order. */
export function explainAll(sim: Sim): CrewExplain[] {
  // Over the crew store (always there): a query on a store that does not exist yet would create it.
  return sim.world.query(CrewC).filter((id) => sim.world.has(id, IntentC) || sim.world.has(id, TaskC)).map((id) => explainCrew(sim, id));
}
