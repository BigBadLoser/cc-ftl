import { bedStandTile, bedUseOf, findFreeBed, ownedBedPlan, type BedPlan } from '../../crew/beds';
import { lieDownInCare } from '../../crew/recovery';
import { PathC, PositionC, type Crew, type Path, type Position } from '../../crew/components';
import { clearPath, isSettled, origin } from '../../crew/helpers';
import { findPath } from '../../crew/pathfind';
import { walkOpts } from '../../eva/route';
import { dropCarried } from '../../items/stacks';
import { ModuleC } from '../../modules/components';
import { noteSleep } from '../../crew/mood';
import { shipIdOf } from '../../regions';
import type { Sim } from '../../sim';
import { unsafeFor } from '../hazard';
import { abortTask, claimBed, claimedBed, releaseBedClaim, setJoblessTask, syncTask } from '../task';

/**
 * The sleep machine (docs/CREW_AI.md section 6): `ClaimBed` (the bed they own, else the nearest free one), `Walk` to it, `Sleep`
 * (activity 'sleeping'; the needs system wakes them at full rest). With no reachable bed they sleep where they stand.
 * The bed claim is the task's hold (`claimBed`, `releaseBedClaim` in ai/task.ts).
 */

/** A tired crew member acts when (tick + id) is a multiple of this, so a whole crew crossing the threshold at once does not search for beds in one tick. */
export const SLEEP_STAGGER = 4;

/** The sleep drive's turn. A crew member already walking to a bed is not held up by the stagger. */
export function sleepTurn(sim: Sim, id: number, crew: Crew, pos: Position, holdsJob: boolean): void {
  if (!claimedBed(sim, id) && (sim.tick + id) % SLEEP_STAGGER !== 0) return;
  if (holdsJob) abortTask(sim, id, 'drive');
  dropCarried(sim, id);
  goToSleep(sim, id, crew, pos, false);
  if (claimedBed(sim, id) || crew.activity === 'sleeping' || crew.activity === 'recovering') syncTask(sim, id);
  else setJoblessTask(sim, id, 'sleep', 'sleep', 'ClaimBed'); // no bed and still stepping: they lie down once settled
}

/**
 * The recover drive's turn (content/policies.ts, a hurt crew member): the sleep machine's walk to a treatment bed (a medical bed first, else a recovery pod:
 * `bedUseOf`) and the stay in it instead of sleep. True while they walk to it or lie in it; false when none can be reached (the next drive serves them).
 */
export function recoverTurn(sim: Sim, id: number, crew: Crew, pos: Position, holdsJob: boolean): boolean {
  // Plan the walk first: with no reachable treatment bed the drive does not serve them, and their job and load are left alone.
  let plan: BedPlan | null = null;
  if (!claimedBed(sim, id) && crew.activity !== 'recovering') {
    const ship = shipIdOf(sim, pos);
    plan = findFreeBed(sim, ship, origin(pos), false, (x, y) => unsafeFor(sim, id, ship, x, y), bedUseOf(sim, id));
    if (!plan) return false;
  }
  if (holdsJob) abortTask(sim, id, 'drive');
  dropCarried(sim, id);
  goToSleep(sim, id, crew, pos, true, plan);
  if (crew.activity === 'recovering' || claimedBed(sim, id)) {
    syncTask(sim, id);
    return true;
  }
  return false;
}

/** True if the crew member is on the tile of the bed they reserved. */
export function inBed(sim: Sim, id: number): boolean {
  const claim = claimedBed(sim, id);
  const bed = claim ? sim.world.get(claim, ModuleC) : undefined;
  const pos = sim.world.get(id, PositionC);
  return !!bed && !!pos && pos.x === bed.x && pos.y === bed.y;
}

/** A sleep ends: the night counts for mood (in a bed or on the floor), they get up and `crew.wokeUp` fires. At full rest, or a schedule's wake (#412). */
export function endSleep(sim: Sim, id: number, crew: Crew): void {
  noteSleep(sim, id, inBed(sim, id));
  wakeUp(sim, id, crew);
  sim.events.emit({ type: 'crew.wokeUp', crew: id });
}

/** Full rest: give the bed back and get up (the needs system calls this). */
export function wakeUp(sim: Sim, id: number, crew: Crew): void {
  releaseBedClaim(sim, id);
  crew.activity = 'idle';
  syncTask(sim, id);
}

/**
 * Tired: claim the bed they own (else the nearest free one) and walk to it, then sleep there (faster rest). With no
 * reachable bed, sleep where standing. A bed whose tile harms them is passed over. Only falls asleep once settled on a tile.
 */
function goToSleep(sim: Sim, id: number, crew: Crew, pos: Position, toPod: boolean, planned: BedPlan | null = null): void {
  let claim = claimedBed(sim, id);
  const bed = claim ? sim.world.get(claim, ModuleC) : undefined;
  if (claim && (!bed || bed.hp <= 0)) {
    releaseBedClaim(sim, id);
    claim = 0;
  }
  const path = sim.world.get(id, PathC) as Path;
  const ship = shipIdOf(sim, pos);
  const unsafe = (x: number, y: number): boolean => unsafeFor(sim, id, ship, x, y);
  const def = bed && sim.content.modules[bed.def];
  const stand = bed && def ? bedStandTile(def, bed) : { x: 0, y: 0 };
  if (claim && bed && unsafe(stand.x, stand.y)) {
    releaseBedClaim(sim, id); // the bed now harms them (a fire on it): another bed, else the floor
    clearPath(sim, id);
    claim = 0;
  }
  if (claim && bed) {
    if (isSettled(pos) && pos.x === stand.x && pos.y === stand.y) return def?.medical ? lieDownInCare(sim, id, claim) : fallAsleep(sim, id, crew);
    if (path.steps.length > 0 || !isSettled(pos)) return; // still walking to the bed
    const steps = findPath(sim, shipIdOf(sim, pos), origin(pos), stand, walkOpts(sim, id));
    if (steps && steps.length > 0) {
      path.steps = steps;
      return;
    }
    releaseBedClaim(sim, id); // unreachable: sleep on the floor instead (a pod patient just stays hurt)
    if (toPod) return;
  } else if (toPod) {
    const plan = planned ?? findFreeBed(sim, ship, origin(pos), false, unsafe, bedUseOf(sim, id));
    if (plan) {
      claimBed(sim, id, plan.bed);
      path.steps = plan.steps;
    }
    return;
  } else {
    const plan = ownedBedPlan(sim, id, ship, origin(pos), unsafe) ?? findFreeBed(sim, ship, origin(pos), false, unsafe);
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
