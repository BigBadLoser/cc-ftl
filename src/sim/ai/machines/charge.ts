import { CrewC, PathC, type Crew, type Path, type Position } from '../../crew/components';
import { clearPath, isSettled, origin } from '../../crew/helpers';
import { findPath } from '../../crew/pathfind';
import { dropCarried } from '../../items/stacks';
import { ModuleC } from '../../modules/components';
import { shipIdOf } from '../../regions';
import { bayFree, cradleOf, homeBay } from '../../robots/bay';
import type { Sim } from '../../sim';
import { abortTask, setJoblessTask, syncTask } from '../task';

/**
 * The charge machine (docs/CREW_AI.md section 6): a battery robot `Walk`s to its home bay (claiming the nearest free one on its
 * ship as home if it has none there) and `Charge`s in the cradle (activity 'charging'; the robot-bay system tops it up and lets it
 * go). The home bay is a long-lived claim the robot owns (`Module.reservedBy`), like an owned bed, not a hold of one task.
 */

/** The recharge drive's turn: false when no bay can be reached (the robot carries on as usual). */
export function chargeTurn(sim: Sim, id: number, crew: Crew, pos: Position, holdsJob: boolean): boolean {
  const bay = goToBay(sim, id, crew, pos);
  if (!bay) return false;
  if (holdsJob) {
    abortTask(sim, id, 'drive'); // also clears the path: plan the walk to the bay again
    goToBay(sim, id, crew, pos);
  }
  dropCarried(sim, id);
  if (crew.activity === 'charging') syncTask(sim, id);
  else setJoblessTask(sim, id, 'recharge', 'charge', 'Walk', { target: bay });
  return true;
}

/** The robot leaves the cradle (charged, or its bay is gone): the task ends. */
export function endCharge(sim: Sim, id: number): void {
  (sim.world.get(id, CrewC) as Crew).activity = 'idle';
  syncTask(sim, id);
}

/**
 * Walk to the home bay (claiming the nearest free one on this grid as home if it has none here) and settle into the
 * cradle: activity 'charging'. Returns the bay, or 0 when none can be reached, so the robot carries on as usual.
 */
function goToBay(sim: Sim, robot: number, crew: Crew, pos: Position): number {
  let bay = homeBay(sim, robot);
  const home = bay ? sim.world.get(bay, ModuleC) : undefined;
  if (home && shipIdOf(sim, home) !== shipIdOf(sim, pos)) return 0; // its home is on another grid: no squatting here
  if (home && home.hp <= 0) {
    home.reservedBy = 0; // wrecked home: find another
    bay = 0;
  }
  if (!bay) {
    let best = Infinity;
    for (const id of sim.world.query(ModuleC)) {
      const m = sim.world.get(id, ModuleC);
      if (!m || shipIdOf(sim, m) !== shipIdOf(sim, pos) || !bayFree(sim, id)) continue;
      const steps = findPath(sim, shipIdOf(sim, pos), origin(pos), cradleOf(sim, id));
      if (steps && steps.length < best) [bay, best] = [id, steps.length];
    }
    if (!bay) return 0;
    (sim.world.get(bay, ModuleC) as { reservedBy: number }).reservedBy = robot;
  }
  const m = cradleOf(sim, bay);
  const path = sim.world.get(robot, PathC) as Path;
  if (isSettled(pos) && pos.x === m.x && pos.y === m.y) {
    clearPath(sim, robot);
    crew.activity = 'charging';
    sim.events.emit({ type: 'robot.charging', crew: robot, bay });
    return bay;
  }
  if (path.steps.length > 0 || !isSettled(pos)) return bay;
  const steps = findPath(sim, shipIdOf(sim, pos), origin(pos), { x: m.x, y: m.y });
  if (!steps || steps.length === 0) return 0;
  path.steps = steps;
  return bay;
}

