import { AssignmentC, CrewC, DraftedC, JobC, NeedsC, PathC, PositionC, PrioritiesC, type Crew, type Position } from '../crew/components';
import { isIncapacitated } from '../crew/helpers';
import { isOffDuty } from '../fight/relations';
import { dropCarried } from '../items/stacks';
import type { Sim } from '../sim';
import { EMERGENCY_CHECK_TICKS, emergencyWaiting } from './emergency';
import { chargeTurn } from './machines/charge';
import { eatTurn } from './machines/eat';
import { idleTurn } from './machines/idle';
import { navigateTurn } from './machines/navigate';
import { sleepTurn } from './machines/sleep';
import { legacyIntent } from './policy';
import { assignJobs } from './scheduler';
import { abortTask, isCarrying, syncTask } from './task';

/**
 * Crew decisions, in `decide`'s slot (docs/CREW_AI.md sections 4 and 7). Per crew member in id order: the forced states keep them
 * out (drafted, incapacitated, off duty; a sleeper, charger or eater is busy), `policy.legacy` writes what they want (`Intent`), the
 * need machines (charge, sleep, eat) take it in that order, and a held job is kept, rerouted or dropped for an emergency. The crew
 * left free are then matched to open jobs together by the scheduler (`assignJobs`, Phase 2), and those without a job idle. Every turn leaves the
 * `Task` mirror current; crew held out of the loop are re-synced.
 */
export function scheduleSystem(sim: Sim): void {
  const free: number[] = [];
  for (const id of sim.world.query(CrewC, PrioritiesC, PositionC, PathC, NeedsC)) {
    if (sim.world.has(id, DraftedC) || isIncapacitated(sim, id) || isOffDuty(sim, id)) {
      syncTask(sim, id, true); // held out of the loop: keep the mirror current (the turn below sets it for everyone else)
      continue;
    }
    const crew = sim.world.get(id, CrewC) as Crew;
    // Asleep, charging or eating: the need's own machine ends it (wakeUp, endCharge, finishMeal keep the mirror).
    if (crew.activity === 'sleeping' || crew.activity === 'charging' || crew.activity === 'eating') continue;
    const pos = sim.world.get(id, PositionC) as Position;
    const assignment = sim.world.get(id, AssignmentC);
    const want = legacyIntent(sim, id, !!assignment && sim.world.get(assignment.jobId, JobC)?.kind === 'operate');

    // Robots: hold still for a mender; head to the robot bay when the battery is low or badly damaged.
    if (want.mendHold) {
      abortTask(sim, id, 'heldForMend');
      continue;
    }
    if (want.recharge && chargeTurn(sim, id, crew, pos, !!assignment)) continue;
    if (want.sleep) {
      sleepTurn(sim, id, crew, pos, !!assignment);
      continue;
    }
    // Hungry: walk to the galley (or a crate with food) and eat. No food or no way there: carry on, try again later.
    if (want.eat && eatTurn(sim, id, crew, pos)) continue;

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
  for (const id of free) if (!taken.has(id)) idleTurn(sim, id, sim.world.get(id, CrewC) as Crew, sim.world.get(id, PositionC) as Position);
}
