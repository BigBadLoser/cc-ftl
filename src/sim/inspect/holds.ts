import type { Encounter } from '../galaxy/types';
import type { Sim } from '../sim';
import { InspectionC, inspections } from './types';

/** Patrol queries the galaxy turn asks (#553): apart from inspect/patrol.ts so that fleets and encounters don't import the hail flow. */

/** Does the encounter hold the player's trip until it is answered: an interdiction, or a patrol's hail to stop? */
export const holdsTrip = (e: Encounter): boolean => e.kind === 'interdict' || (e.kind === 'scan' && !!e.scan);

/** The patrol fleets held where they are (galaxy/fleets.ts): the one the player stopped for, and each one whose inspectors are out, until it ends. */
export function inspectingFleets(sim: Sim): Set<number> {
  const out = new Set<number>();
  if (sim.galaxy.patrolStop) out.add(sim.galaxy.patrolStop.fleet);
  for (const id of inspections(sim)) {
    const fleet = sim.world.get(id, InspectionC)?.patrol;
    if (fleet !== undefined) out.add(fleet);
  }
  return out;
}
