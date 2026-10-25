import { pruneContacts, rollArrival } from '../galaxy/arrivals';
import { tendEvent } from '../galaxy/eventGrid';
import { tendFleets } from '../galaxy/fleetShips';
import { settleLosses } from '../galaxy/jobs';
import { tickTurnClock } from '../galaxy/turn';
import type { Sim } from '../sim';

/**
 * Starmap upkeep while the player stays at a node: the game-time turn clock (one turn per minute, which moves the NPC fleets), forget
 * contacts and fleet ships that are gone (every second) and roll for a hostile ship jumping in (every ARRIVAL_EVERY_SEC). Galaxy rolls
 * use the galaxy's own Rng. Ships the player destroyed or took are counted towards their notoriety first (heat.ts), while their contacts still say who they were.
 */
export function galaxySystem(sim: Sim): void {
  if (sim.sector.state !== 'active') return;
  // An event grid is a pocket outside the map: only its fleet is tended; no turns, no arrivals.
  // Losses first, while their contacts still say who they were; then the jobs that hang on them (a bounty's kills, a delivery's arrival).
  if (sim.tick % 20 === 0) settleLosses(sim);
  if (sim.galaxy.event) return void (sim.tick % 20 === 0 && tendEvent(sim));
  if (sim.tick % 20 === 0) {
    pruneContacts(sim);
    tendFleets(sim);
  }
  tickTurnClock(sim);
  rollArrival(sim);
}
