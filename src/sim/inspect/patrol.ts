import { PATROL_CHASE_CHANCE, PATROL_CHASE_TURNS, PATROL_RUN_HIT } from '../blackmarket/tuning';
import { finishEncounter } from '../galaxy/encounters';
import { unit } from '../galaxy/hash';
import { drop, resumeAfterHop } from '../galaxy/hyperspace';
import { repKey } from '../galaxy/standing';
import { inPlay } from '../galaxy/fleetShips';
import type { Encounter, Fleet } from '../galaxy/types';
import type { Sim } from '../sim';
import { reputationOf } from '../story/state';
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

const CHASE_SALT = 0xc4a5;

/** Does the encounter hold the player's trip until it is answered: an interdiction, or a patrol's hail to stop? */
export const holdsTrip = (e: Encounter): boolean => e.kind === 'interdict' || (e.kind === 'scan' && !!e.scan);

/** The chase roll for a run from a patrol: a pure function of the seed and the encounter id. */
export const chaseRoll = (sim: Sim, e: Encounter): number => unit(sim.seed, e.id, CHASE_SALT);

const hit = (sim: Sim, faction: string, n: number): void => {
  const key = repKey(sim, faction);
  sim.story.reputation[key] = reputationOf(sim.story, key) - n;
};

/** 'comply': the patrol holds at the node reached, and the trip drops out there (the ship then waits to deploy). False when the patrol is gone. */
export function comply(sim: Sim, e: Encounter): boolean {
  const g = sim.galaxy;
  const t = g.travel;
  const f = g.fleets.find((x) => x.id === e.fleet);
  if (!f || !t) {
    finishEncounter(sim, e.id, 'gone');
    if (t?.phase === 'interdicted') resumeAfterHop(sim, t);
    return false;
  }
  // It comes about to the node the player stops at, and stays there until the inspection is over (no turn passes while the player is in the node).
  f.node = g.current;
  f.from = g.current;
  f.route = [];
  f.dest = f.node;
  f.dwell = Math.max(f.dwell, 1);
  f.met = g.turn;
  delete f.hunt;
  delete f.chase;
  finishEncounter(sim, e.id, 'complied');
  g.patrolStop = { fleet: f.id, faction: e.faction, name: e.name };
  t.route.length = t.at + 1;
  t.phase = 'arrived';
  delete t.stopping;
  sim.events.emit({ type: 'patrol.complied', fleet: f.id, faction: e.faction, node: g.current });
  return drop(sim, 'galaxy.respond');
}

/** 'run': the standing hit, the chase roll, and the trip carries on. */
export function run(sim: Sim, e: Encounter): void {
  const g = sim.galaxy;
  hit(sim, e.faction, PATROL_RUN_HIT);
  const f = g.fleets.find((x) => x.id === e.fleet);
  const roll = chaseRoll(sim, e);
  const chased = !!f && roll < PATROL_CHASE_CHANCE;
  if (f) f.met = g.turn;
  if (f && chased) {
    f.hunt = { until: g.turn + PATROL_CHASE_TURNS };
    f.chase = true;
  }
  sim.events.emit({ type: 'patrol.ran', fleet: e.fleet, faction: e.faction, chased });
  finishEncounter(sim, e.id, chased ? 'ranChased' : 'ran');
  const t = g.travel;
  if (t?.phase === 'interdicted' && !g.encounters.some(holdsTrip)) resumeAfterHop(sim, t);
}

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

/** The player leaves before the patrol's inspectors came over: that is running from it (the hit; no chase, the patrol is left behind). */
export function abortPatrolStop(sim: Sim): void {
  const stop = sim.galaxy.patrolStop;
  if (!stop) return;
  delete sim.galaxy.patrolStop;
  hit(sim, stop.faction, PATROL_RUN_HIT);
  sim.events.emit({ type: 'patrol.ran', fleet: stop.fleet, faction: stop.faction, chased: false });
}
