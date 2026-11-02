import { AssignmentC, DraftedC, JobC, PathC, PositionC, type Position } from '../crew/components';
import { HAZARD_AIR, HAZARD_COLD, HAZARD_FIRE, HAZARD_HEAT, hazardsHere } from '../crew/hazard';
import { isSettled } from '../crew/helpers';
import type { Sim } from '../sim';
import { TaskC } from './components';
import { isCarrying } from './task';
import { policyOf } from './utility';

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
  if (drafted && (drafted.target || sim.world.has(id, AssignmentC))) return false;
  const pos = sim.world.get(id, PositionC) as Position;
  return (sim.world.get(id, PathC)?.steps.length ?? 0) === 0 && isSettled(pos);
}
