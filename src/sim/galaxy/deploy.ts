import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { ARRIVAL_EVERY_SEC } from './tuning';
import { resetTurnClock } from './turn';

/**
 * The player's ship has been placed (`sector.deploy`) in the node `sim.galaxy.current`: the arrival clock restarts. No story event
 * starts here: they are drawn at the hops of a trip (hyperspace.ts `storyAtHop`), never while the ship idles in a node. (The node's ships were
 * restored or materialised when the ship dropped out of hyperspace, so the deploy picker could see them.)
 */
export function onDeployed(sim: Sim): void {
  const g = sim.galaxy;
  // An event grid is not a node: no arrival clock.
  if (g.event) return void g.rev++;
  resetTurnClock(sim);
  g.nextArrival = sim.tick + Math.round(ARRIVAL_EVERY_SEC * TICK_HZ);
  g.rev++;
}
