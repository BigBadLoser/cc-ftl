import { claimBed, findFreeBed, ownedBedPlan, releaseBedClaim } from '../../crew/beds';
import { BedClaimC, PathC, type Crew, type Path, type Position } from '../../crew/components';
import { clearPath, isSettled, origin } from '../../crew/helpers';
import { findPath } from '../../crew/pathfind';
import { dropCarried } from '../../items/stacks';
import { ModuleC } from '../../modules/components';
import { shipIdOf } from '../../regions';
import type { Sim } from '../../sim';
import { abortTask, setJoblessTask, syncTask } from '../task';

/**
 * The sleep machine (docs/CREW_AI.md section 6): `ClaimBed` (the bed they own, else the nearest free one), `Walk` to it, `Sleep`
 * (activity 'sleeping'; the needs system wakes them at full rest). With no reachable bed they sleep where they stand. Phase 1:
 * `BedClaimC` and the activity stay the saved truth; the bed is the task's hold.
 */

/** Below this rest a non-drafted crew member drops everything and sleeps (operators hold out longer, see policy.legacy). */
export const SLEEP_BELOW = 20;
/** A tired crew member acts when (tick + id) is a multiple of this, so a whole crew crossing the threshold at once does not search for beds in one tick. */
export const SLEEP_STAGGER = 4;

/** The sleep drive's turn. A crew member already walking to a bed is not held up by the stagger. */
export function sleepTurn(sim: Sim, id: number, crew: Crew, pos: Position, holdsJob: boolean): void {
  if (!sim.world.has(id, BedClaimC) && (sim.tick + id) % SLEEP_STAGGER !== 0) return;
  if (holdsJob) abortTask(sim, id, 'drive');
  dropCarried(sim, id);
  goToSleep(sim, id, crew, pos);
  if (sim.world.has(id, BedClaimC) || crew.activity === 'sleeping') syncTask(sim, id);
  else setJoblessTask(sim, id, 'sleep', 'sleep', 'ClaimBed'); // no bed and still stepping: they lie down once settled
}

/** Full rest: give the bed back and get up (the needs system calls this). */
export function wakeUp(sim: Sim, id: number, crew: Crew): void {
  releaseBedClaim(sim, id);
  crew.activity = 'idle';
  syncTask(sim, id);
}

/**
 * Tired: claim the bed they own (else the nearest free one) and walk to it, then sleep there (faster rest). With no
 * reachable bed, sleep where standing. Only falls asleep once settled on a tile.
 */
function goToSleep(sim: Sim, id: number, crew: Crew, pos: Position): void {
  let claim = sim.world.get(id, BedClaimC);
  const bed = claim && sim.world.get(claim.bed, ModuleC);
  if (claim && (!bed || bed.hp <= 0)) {
    releaseBedClaim(sim, id);
    claim = undefined;
  }
  const path = sim.world.get(id, PathC) as Path;
  if (claim && bed) {
    if (isSettled(pos) && pos.x === bed.x && pos.y === bed.y) return fallAsleep(sim, id, crew);
    if (path.steps.length > 0 || !isSettled(pos)) return; // still walking to the bed
    const steps = findPath(sim, shipIdOf(sim, pos), origin(pos), { x: bed.x, y: bed.y });
    if (steps && steps.length > 0) {
      path.steps = steps;
      return;
    }
    releaseBedClaim(sim, id); // unreachable: sleep on the floor instead
  } else {
    const plan = ownedBedPlan(sim, id, shipIdOf(sim, pos), origin(pos)) ?? findFreeBed(sim, shipIdOf(sim, pos), origin(pos));
    if (plan) {
      claimBed(sim, id, plan.bed);
      path.steps = plan.steps;
      return;
    }
  }
  if (isSettled(pos)) fallAsleep(sim, id, crew);
}

function fallAsleep(sim: Sim, id: number, crew: Crew): void {
  clearPath(sim, id);
  crew.activity = 'sleeping';
  sim.events.emit({ type: 'crew.fellAsleep', crew: id });
}
