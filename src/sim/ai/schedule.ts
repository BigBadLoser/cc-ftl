import { AssignmentC, CrewC, DraftedC, JobC, NeedsC, PathC, PositionC, PrioritiesC, type Crew, type Position } from '../crew/components';
import { isIncapacitated } from '../crew/helpers';
import { isOffDuty } from '../fight/relations';
import { dropCarried } from '../items/stacks';
import type { Sim } from '../sim';
import { EMERGENCY_CHECK_TICKS, emergencyWaiting } from './emergency';
import { chargeTurn } from './machines/charge';
import { eatTurn } from './machines/eat';
import { idleTurn } from './machines/idle';
import { leisureTurn } from './machines/leisure';
import { navigateTurn } from './machines/navigate';
import { sleepTurn } from './machines/sleep';
import { speciesOf } from '../robots/core';
import { heldForMend } from '../robots/jobs';
import { assignJobs } from './scheduler';
import { abortTask, clearJoblessTask, isCarrying, syncTask } from './task';
import { TaskC } from './components';
import { hazardHolds } from './hazard';
import { escapeTurn } from './machines/escape';
import type { DriveDef, MachineId } from './types';
import { evaluateIntent, serveDrive, type TaskView } from './utility';

/** A need machine's turn: true when it took the crew member this tick, false to fall through to the next drive. */
type NeedTurn = (sim: Sim, id: number, crew: Crew, pos: Position, holdsJob: boolean) => boolean;

/** The need machines a drive may start (`DriveDef.task`). A new need is a machine plus its turn here. */
const NEED_TURNS: Partial<Record<MachineId, NeedTurn>> = {
  charge: chargeTurn,
  sleep: (sim, id, crew, pos, holdsJob) => (sleepTurn(sim, id, crew, pos, holdsJob), true),
  eat: (sim, id, crew, pos) => eatTurn(sim, id, crew, pos),
  leisure: (sim, id, crew, pos) => leisureTurn(sim, id, crew, pos),
};

/** Whether a drive's own task is under way (`keepWhileTask`). */
const underway = (sim: Sim, id: number) => (machine: MachineId): boolean => sim.world.get(id, TaskC)?.machine === machine && machine === 'eat';

/**
 * Crew decisions, in `decide`'s slot (docs/CREW_AI.md sections 4 and 7). Per crew member in id order: the forced states keep them
 * out (drafted, incapacitated, off duty; a sleeper, charger or eater is busy), `policy.legacy` writes what they want (`Intent`), the
 * need machines (charge, sleep, eat) take it in that order, and a held job is kept, rerouted or dropped for an emergency. The crew
 * left free are then matched to open jobs together by the scheduler (`assignJobs`, Phase 2), and those without a job idle. Every turn leaves the
 * `Task` mirror current; crew held out of the loop are re-synced.
 */
export function scheduleSystem(sim: Sim): void {
  const free: number[] = [];
  /** Drives ranked below work, tried in the idle turn of a crew member the scheduler found no job for (leisure). */
  const idleDrives = new Map<number, DriveDef[]>();
  for (const id of sim.world.query(CrewC, PrioritiesC, PositionC, PathC, NeedsC)) {
    if (sim.world.has(id, DraftedC) || isIncapacitated(sim, id) || isOffDuty(sim, id)) {
      // A drafted crew member whose order is done is stepped off a harmful tile and keeps the draft (the hazard interrupt).
      if (sim.world.has(id, DraftedC) && !isIncapacitated(sim, id) && !isOffDuty(sim, id) && hazardHolds(sim, id)) escapeTurn(sim, id, sim.world.get(id, PositionC) as Position, true);
      syncTask(sim, id, true); // held out of the loop: keep the mirror current (the turn below sets it for everyone else)
      continue;
    }
    const crew = sim.world.get(id, CrewC) as Crew;
    // The hazard interrupt (ai/hazard.ts): off a harmful tile before anything else, a sleeper or an eater included. The walk is
    // planned first; with nowhere safer to go the crew member carries on as they were.
    if (hazardHolds(sim, id)) {
      if (escapeTurn(sim, id, sim.world.get(id, PositionC) as Position)) continue;
      if (sim.world.get(id, TaskC)?.machine === 'escape') clearJoblessTask(sim, id);
    }
    // Asleep, charging or eating: the need's own machine ends it (wakeUp, endCharge, finishMeal keep the mirror).
    if (crew.activity === 'sleeping' || crew.activity === 'charging' || crew.activity === 'eating') continue;
    const pos = sim.world.get(id, PositionC) as Position;
    const assignment = sim.world.get(id, AssignmentC);
    const atPost = !!assignment && sim.world.get(assignment.jobId, JobC)?.kind === 'operate';

    // Robots: hold still for a mender (an interrupt in the design; kept inline, as a mender may take the job earlier in this pass).
    // Only a mechanical body is ever mended (mend jobs are posted for robots alone): skip the job scan for everyone else.
    if (speciesOf(sim, id)?.mechanical && heldForMend(sim, id) && !isCarrying(sim, id)) {
      evaluateIntent(sim, id, { atPost, underway: underway(sim, id), finishing: () => true });
      abortTask(sim, id, 'heldForMend');
      continue;
    }
    // The utility engine ranks the drives (ai/utility.ts); each need's machine is tried in that order, falling through when it
    // cannot start (no bay, no food), until one takes the crew member or `work` hands them to the job scheduler.
    const view: TaskView = { atPost, underway: underway(sim, id), finishing: () => isCarrying(sim, id) };
    let served = false;
    const ranked = evaluateIntent(sim, id, view);
    for (let i = 0; i < ranked.length; i++) {
      const d = ranked[i] as DriveDef;
      const turn = d.task === 'job' ? undefined : NEED_TURNS[d.task];
      if (turn && !turn(sim, id, crew, pos, !!assignment)) continue;
      if (d.task === 'job' && i + 1 < ranked.length) idleDrives.set(id, ranked.slice(i + 1));
      serveDrive(sim, id, d.id);
      served = d.task !== 'job';
      break;
    }
    if (served) continue;
    serveDrive(sim, id, 'work');

    if (assignment) {
      const job = sim.world.get(assignment.jobId, JobC);
      if (!job) {
        abortTask(sim, id, 'jobGone');
        continue;
      }
      // An emergency (fire, downed crew member, hull hole) the crew member ranks above their job calls them off it.
      if ((sim.tick + id) % EMERGENCY_CHECK_TICKS === 0 && !isCarrying(sim, id) && emergencyWaiting(sim, id, pos, job)) abortTask(sim, id, 'preempt');
      else {
        navigateTurn(sim, id, pos, assignment.jobId, job);
        continue;
      }
    }

    dropCarried(sim, id); // a load left over from a lost haul job
    free.push(id);
  }
  // Free crew are matched to jobs together (ai/scheduler.ts); the rest idle, in id order.
  const taken = free.length > 0 ? assignJobs(sim, free) : new Set<number>();
  for (const id of free) {
    if (taken.has(id)) continue;
    const crew = sim.world.get(id, CrewC) as Crew, pos = sim.world.get(id, PositionC) as Position;
    const drives = idleDrives.get(id);
    idleTurn(sim, id, crew, pos, drives && (() => {
      const d = drives.find((d) => d.task !== 'job' && NEED_TURNS[d.task]?.(sim, id, crew, pos, false));
      if (d) serveDrive(sim, id, d.id);
      return !!d;
    }));
  }
}
