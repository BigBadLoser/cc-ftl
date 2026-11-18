import { PATROL_CHASE_CHANCE, PATROL_CHASE_TURNS, PATROL_RUN_HIT } from '../blackmarket/tuning';
import { finishEncounter } from '../galaxy/encounters';
import { unit } from '../galaxy/hash';
import { drop, resumeAfterHop } from '../galaxy/hyperspace';
import { standingHit } from '../galaxy/standing';
import type { Encounter } from '../galaxy/types';
import type { Sim } from '../sim';
import { holdsTrip } from './holds';

/**
 * The player's answers to a patrol's hail ('comply', 'run'; the rules are in inspect/patrol.ts's note), called by galaxy/respond.ts. Apart from
 * patrol.ts so that the jump code (galaxy/hyperspace.ts) can import the patrol stop without importing the hail answers back (#553).
 */

const CHASE_SALT = 0xc4a5;

/** The chase roll for a run from a patrol: a pure function of the seed and the encounter id. */
export const chaseRoll = (sim: Sim, e: Encounter): number => unit(sim.seed, e.id, CHASE_SALT);

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
  standingHit(sim, e.faction, PATROL_RUN_HIT);
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
