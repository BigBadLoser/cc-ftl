import { pruneContacts, rollArrival } from '../galaxy/arrivals';
import type { Sim } from '../sim';

/**
 * Starmap upkeep while the player stays at a node: forget contacts whose ships are gone (every second) and roll for a
 * hostile ship jumping in (every ARRIVAL_EVERY_SEC). Galaxy rolls use the galaxy's own Rng.
 */
export function galaxySystem(sim: Sim): void {
  if (sim.tick % 20 === 0) pruneContacts(sim);
  rollArrival(sim);
}
