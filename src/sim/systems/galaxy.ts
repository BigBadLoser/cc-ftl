import { pruneContacts, rollArrival } from '../galaxy/arrivals';
import { tendFleets } from '../galaxy/fleetShips';
import { tickTurnClock } from '../galaxy/turn';
import type { Sim } from '../sim';

/**
 * Starmap upkeep while the player stays at a node: the game-time turn clock (one turn per minute, which moves the NPC fleets), forget
 * contacts and fleet ships that are gone (every second) and roll for a hostile ship jumping in (every ARRIVAL_EVERY_SEC). Galaxy rolls
 * use the galaxy's own Rng.
 */
export function galaxySystem(sim: Sim): void {
  if (sim.sector.state !== 'active') return;
  if (sim.tick % 20 === 0) {
    pruneContacts(sim);
    tendFleets(sim);
  }
  tickTurnClock(sim);
  rollArrival(sim);
}
