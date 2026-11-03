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
import { IntentC, PickupC, TaskC } from './components';
import { airDraining } from './airNeed';
import { airLeft } from '../eva/airLedger';
import { airTurn } from './machines/air';
import { returnTurn } from './machines/return';
import { siteUnderFoot } from '../away/crew';
import { hazardHolds } from './hazard';
import { escapeTurn } from './machines/escape';
import type { DriveDef, MachineId } from './types';
import { evaluateIntent, policyOf, readInput, serveDrive, type TaskView } from './utility';

/** A need machine's turn: true when it took the crew member this tick, false to fall through to the next drive. */
type NeedTurn = (sim: Sim, id: number, crew: Crew, pos: Position, holdsJob: boolean) => boolean;

/** The need machines a drive may start (`DriveDef.task`). A new need is a machine plus its turn here. */
const NEED_TURNS: Partial<Record<MachineId, NeedTurn>> = {
  eva: airTurn, // the air drive: the refill errand
  return: returnTurn, // an away crew member heads for their site's shuttle
  charge: chargeTurn,
  // Never on an away site (#286): there the return drive takes them home to sleep; no lying down on a wreck's floor.
  sleep: (sim, id, crew, pos, holdsJob) => !siteUnderFoot(sim, id) && (sleepTurn(sim, id, crew, pos, holdsJob), true),
  eat: (sim, id, crew, pos) => eatTurn(sim, id, crew, pos),
  leisure: (sim, id, crew, pos) => leisureTurn(sim, id, crew, pos),
};

/** Whether a drive's own task is under way (`keepWhileTask`): a meal, or a refill errand (the air drive). */
const underway = (sim: Sim, id: number) => (machine: MachineId): boolean => {
  if (machine === 'eva') return sim.world.get(sim.world.get(id, AssignmentC)?.jobId ?? 0, JobC)?.kind === 'refill';
  return sim.world.get(id, TaskC)?.machine === machine && machine === 'eat';
};

/**
 * True when a drive of the crew member's policy other than the one whose task they are in (`own`: 'sleep' or 'eat') is urgent, read from the
 * policy's data: air under its critical margin, hunger under its starving line, rest, and so on. Any such need wakes a sleeper or an eater so the drives
 * below can serve it (a drive with `task: 'job'` is never one: it has no need of its own).
 */
function urgentElsewhere(sim: Sim, id: number, own: MachineId): boolean {
  const drives = policyOf(sim, id).drives;
  const isUrgent = (d: DriveDef): boolean => {
    const x = d.urgent && d.input ? readInput(sim, id, d.input) : undefined;
    return x !== undefined && x < (d.urgent?.below ?? 0);
  };
  // Their own need is urgent too: they finish it first, unless the other would harm them at zero and theirs would not (the ranking keeps the
  // current drive between two urgent ones, so a wake that the ranking would not honour only bounces).
  const mine = drives.find((d) => d.task === own);
  const ownUrgent = !!mine && isUrgent(mine);
  if (ownUrgent && mine.harmsAtZero) return false;
  return drives.some((d) => d.urgent && d.input && d.task !== own && d.task !== 'job' && (!ownUrgent || d.harmsAtZero) && isUrgent(d));
}

/** Keep the pickup request (`PickupC`) in step with the air drive being blocked: set, with its alert, when no source can be reached. */
function pickupRequest(sim: Sim, id: number): void {
  const want = sim.world.get(id, IntentC)?.blocked === 'air' && airDraining(sim, id); // only a draining tank with no source in reach
  if (want === sim.world.has(id, PickupC)) return;
  if (!want) {
    sim.world.remove(id, PickupC);
    return;
  }
  sim.world.add(id, PickupC, { since: sim.tick });
  sim.events.emit({ type: 'crew.airUnreachable', crew: id, sec: Math.floor(airLeft(sim, id)) });
}

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
      sim.world.remove(id, PickupC);
      continue;
    }
    const crew = sim.world.get(id, CrewC) as Crew;
    // The hazard interrupt (ai/hazard.ts): off a harmful tile before anything else, a sleeper or an eater included. The walk is
    // planned first; with nowhere safer to go the crew member carries on as they were.
    if (hazardHolds(sim, id)) {
      // With no breathable tile in reach, an empty suit's way out is the air drive below (critical: a refill, which tolerates thin air).
      if (escapeTurn(sim, id, sim.world.get(id, PositionC) as Position)) continue;
      if (sim.world.get(id, TaskC)?.machine === 'escape') clearJoblessTask(sim, id);
    }
    // Any other need gone urgent ends a sleep or a meal (a suited crew member whose room lost its air, a sleeper who is starving): they get up
    // and the drives below serve it; sleep resumes through its own drive afterwards. Charging is a robot's, which does not breathe.
    if ((crew.activity === 'sleeping' || crew.activity === 'eating') && urgentElsewhere(sim, id, crew.activity === 'sleeping' ? 'sleep' : 'eat')) abortTask(sim, id, 'urgentNeed');
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
    pickupRequest(sim, id);
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
