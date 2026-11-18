import { INSPECT_PATROL_REFUSE_HIT } from '../blackmarket/tuning';
import { standingHit } from '../galaxy/standing';
import { inPlay } from '../galaxy/fleetShips';
import type { Fleet } from '../galaxy/types';
import type { Sim } from '../sim';
import { liveInspection, startInspection } from './start';
import { InspectionC } from './types';

/**
 * Patrol hails (#138 step 2, docs/DESIGN.md "Contraband inspections in the world"). A navy or corporation patrol whose scan reads contraband aboard
 * (blackmarket/scan.ts `scanFor`) hails the player mid-jump to stop: the trip halts in hyperspace (as an interdiction does) until `galaxy.respond`
 * answers it.
 * - 'comply': the trip ends at the node reached; the patrol holds there beside the player (`GalaxyState.patrolStop`), and once the ship is deployed one
 *   of its ships sends its inspectors over (the station inspection of step 1, with the patrol ship as the source: `Inspection.patrol`).
 * - 'run': the trip carries on; standing with the patrol's faction falls by PATROL_RUN_HIT and, with PATROL_CHASE_CHANCE, the patrol gives chase
 *   (`Fleet.chase`: it follows as a hunter for PATROL_CHASE_TURNS and hails again whenever it crosses the player).
 * What refusing or fighting a patrol leads to (it turns hostile) is step 3.
 */

/** The patrol's ship that sends the inspectors: its first ship in play in the node. */
const patrolShip = (sim: Sim, f: Fleet): number | undefined => f.ships.find((c) => c.ship !== undefined && inPlay(sim, c.ship))?.ship;

/**
 * Once the player who complied is deployed in the node, the patrol sends its inspectors (called each tick by the inspection system). The stop is
 * dropped when the patrol is gone or the player is elsewhere.
 */
export function patrolBoards(sim: Sim): void {
  const g = sim.galaxy;
  const stop = g.patrolStop;
  if (!stop || sim.sector.state !== 'active') return;
  const f = g.fleets.find((x) => x.id === stop.fleet);
  if (!f || f.node !== g.current || g.event) {
    delete g.patrolStop;
    return;
  }
  if (liveInspection(sim)) return;
  const ship = patrolShip(sim, f);
  if (ship === undefined || !startInspection(sim, ship, stop.faction, stop.name)) return; // its ships are not real yet, or the site is busy: next tick
  const [vehicle] = liveInspection(sim) as [number, unknown];
  const insp = sim.world.get(vehicle, InspectionC);
  if (insp) insp.patrol = f.id;
  delete g.patrolStop;
}

/** The player leaves before the patrol's inspectors set off: that is refusing them (INSPECT_PATROL_REFUSE_HIT; nobody turns hostile). */
export function abortPatrolStop(sim: Sim): void {
  const stop = sim.galaxy.patrolStop;
  if (!stop) return;
  delete sim.galaxy.patrolStop;
  standingHit(sim, stop.faction, INSPECT_PATROL_REFUSE_HIT);
  sim.events.emit({ type: 'patrol.ran', fleet: stop.fleet, faction: stop.faction, chased: false });
}

