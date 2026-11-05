import { BreakdownC } from '../crew/breakTypes';
import { AssignmentC, DraftedC, JobC, PathC, PositionC, type Position } from '../crew/components';
import { exposure, HAZARD_AIR, HAZARD_COLD, HAZARD_FIRE, HAZARD_HEAT, hazardsHere, tileHazards } from '../crew/hazard';
import { isSettled } from '../crew/helpers';
import { findPath, type Tile } from '../crew/pathfind';
import { isTileWalkable } from '../modules/walk';
import { shipGrid } from '../regions';
import type { Sim } from '../sim';
import { TaskC } from './components';
import { isCarrying } from './task';
import { isUrgent, policyOf, readInput } from './utility';

/**
 * The `hazard` interrupt's predicate (docs/CREW_AI.md section 5, TRAITS.md section 5 "Survival is not a break"). A crew member is
 * held by it while the tile they stand on harms them in a way their task does not tolerate, and they have stopped there (a walk
 * through fire or thin air is obeyed: the route was chosen) or are already escaping. A drafted crew member counts only once their
 * order is done (they are stepped off and keep the draft).
 *
 * Only crew whose policy says `escapeHazards` (every policy in content; not `policy.none`, so bare test content keeps crew put).
 *
 * Tolerance: putting out a fire tolerates fire and heat; sealing a breach (a firefighting wall build) tolerates thin air and cold;
 * a rescuer carrying a patient (a `finish` task) carries on to the bed. Suited crew are not harmed by thin air in the first place.
 */
export function toleratedHazards(sim: Sim, id: number): number {
  const job = sim.world.get(sim.world.get(id, AssignmentC)?.jobId ?? 0, JobC);
  if (!job) return 0;
  if (job.kind === 'extinguish') return HAZARD_FIRE | HAZARD_HEAT;
  if (job.kind === 'refill') return HAZARD_AIR | HAZARD_COLD; // on the way to fill an empty tank
  if (job.kind === 'build' && job.category === 'firefighting') return HAZARD_AIR | HAZARD_COLD;
  if (isCarrying(sim, id)) return HAZARD_AIR | HAZARD_COLD | HAZARD_FIRE | HAZARD_HEAT;
  return 0;
}

/** True while the hazard interrupt holds the crew member (see the file header). */
export function hazardHolds(sim: Sim, id: number): boolean {
  if (!policyOf(sim, id).escapeHazards) return false;
  const here = hazardsHere(sim, id);
  if (here === 0 || (here & ~toleratedHazards(sim, id)) === 0) return false;
  if (sim.world.get(id, TaskC)?.machine === 'escape') return true;
  const drafted = sim.world.get(id, DraftedC);
  // A break suspends the draft's order (a frozen or cowering crew member does not walk to it): survival beats the break.
  if (drafted && !sim.world.has(id, BreakdownC) && (drafted.target || sim.world.has(id, AssignmentC))) return false;
  const pos = sim.world.get(id, PositionC) as Position;
  return (sim.world.get(id, PathC)?.steps.length ?? 0) === 0 && isSettled(pos);
}

/**
 * A survival drive is critical: the tile harms them (`hazardHolds`), or a drive that is urgent and harms at zero (air, starvation) is under its
 * urgent line, whether or not it can be served (an unreachable source still raises the pickup request). A crew member in a break is then handled
 * as if they had none (`BreakdownC.suspended`, set by the break system), so the scheduler's full path runs: refill, meal, escape, pickup request, the draft rules.
 */
export function survivalCritical(sim: Sim, id: number): boolean {
  if (hazardHolds(sim, id)) return true;
  for (const d of policyOf(sim, id).drives) {
    const v = d.urgent && d.harmsAtZero && d.input ? readInput(sim, id, d.input) : undefined;
    if (v !== undefined && isUrgent(d, v)) return true;
  }
  return false;
}

/**
 * True when a need's destination (a bed, a meal spot, a charging cradle, a break spot) on ship `ship` would harm the crew member,
 * for a crew member whose policy escapes hazards. The need planners skip such a tile, so a crew member who has just escaped is not
 * sent straight back (a sleeper woken by a fire on their bed takes another bed, or the floor where they stand).
 */
export function unsafeFor(sim: Sim, id: number, ship: number, x: number, y: number): boolean {
  if (!policyOf(sim, id).escapeHazards) return false;
  const grid = shipGrid(sim, ship);
  if (!grid) return false;
  const { suited, airless } = exposure(sim, id);
  return tileHazards(grid, x, y, suited, airless) !== 0;
}

/**
 * A walk to a tile beside (x, y) that does not harm the crew member: the usual nearest stop beside it, else the nearest of its
 * other walkable, safe neighbours (a crate whose nearest side burns can still be reached from another). Null when none is reachable.
 */
export function safePathBeside(sim: Sim, id: number, ship: number, from: Tile, x: number, y: number): Tile[] | null {
  const steps = findPath(sim, ship, from, { x, y, adjacent: true });
  const end = steps && (steps[steps.length - 1] ?? from);
  if (!end || !unsafeFor(sim, id, ship, end.x, end.y)) return steps;
  const grid = shipGrid(sim, ship);
  if (!grid) return null;
  let best: Tile[] | null = null;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const tx = x + dx, ty = y + dy;
      if ((!dx && !dy) || !isTileWalkable(sim, grid, tx, ty) || unsafeFor(sim, id, ship, tx, ty)) continue;
      const s = tx === from.x && ty === from.y ? [] : findPath(sim, ship, from, { x: tx, y: ty });
      if (s && (!best || s.length < best.length)) best = s;
    }
  }
  return best;
}
