import { BodyC } from '../body';
import { shipById } from '../combat/ships';
import { flightTicks, walkSpeed } from '../ai/travel';
import { CrewC, DeadC, HealthC, NeedsC, PositionC, type Job } from '../crew/components';
import { TICK_HZ } from '../time';
import { AboardC, VehicleC } from '../vehicles/components';
import { boardingTile } from '../vehicles/geometry';
import { vehicleFaction } from '../vehicles/lifecycle';
import { hatchSpot } from '../eva/shuttle';
import { needsAir } from '../eva/suit';
import { AllegianceC } from '../fight/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { isIncapacitated } from '../crew/helpers';
import { hungerDrainPerSec } from '../crew/eating';
import { stat } from '../stats';
import { blockNow, secToSleep } from '../crew/schedule';
import {
  AWAY_GO_STAY_SEC, AWAY_HOME_CHARGE, AWAY_HOME_HEALTH, AWAY_HOME_HUNGER, AWAY_HOME_REST, AWAY_URGENT_CHARGE, AWAY_URGENT_HUNGER, AWAY_URGENT_REST,
} from '../tuning';
import { AwayC, AwaySiteC, SiteRunC } from './components';
import { fightCalls } from './phase';

/**
 * The crew side of away sites (docs/DESIGN.md "Away sites", #286 slice 2a): who may take a passage, and the return drive's input. No site
 * code moves crew about except the closing lift; the crew AI does (the return machine, ai/machines/return.ts).
 */

/** True while a living crew member of the player's side stands on the ship (a site's wreck must not go while anyone is on it). */
export function playerCrewOn(sim: Sim, ship: number): boolean {
  for (const id of sim.world.query(CrewC, PositionC)) {
    if (!sim.world.has(id, DeadC) && sim.world.get(id, AllegianceC)?.faction === 'player' && shipIdOf(sim, sim.world.get(id, PositionC)) === ship) return true;
  }
  return false;
}

/** The site a crew member is working on: they are of its party and stand on its grid. 0 otherwise. */
export function siteUnderFoot(sim: Sim, id: number): number {
  const away = sim.world.get(id, AwayC);
  const pos = away && sim.world.get(id, PositionC);
  return pos && shipIdOf(sim, pos) === away.site ? away.site : 0;
}

/** The crew member a site's shuttle is fetching (a pickup it answered, `AwayC.pickup`): lowest id of its party out. 0 for none. */
export function fetching(sim: Sim, vehicle: number): number {
  let first = 0;
  for (const c of sim.world.query(AwayC, CrewC)) {
    const away = sim.world.get(c, AwayC)!;
    if (away.vehicle === vehicle && away.pickup && (!first || c < first) && !sim.world.has(c, AboardC) && !sim.world.has(c, DeadC)) first = c;
  }
  return first;
}

/**
 * Where a shuttle takes people aboard on a grid: the hatch spot while it hovers beside it (they float in), or the inside tile of the
 * airlock it is docked at (they step in). Null when it is neither. On a pickup the shuttle hovers beside the crew member it fetches, so
 * their own tile is the hatch spot (the hull near them may be all but gone: they float in from where they stand).
 */
export function siteSpot(sim: Sim, vehicle: number, shipId: number): { x: number; y: number; docked: boolean } | null {
  const v = sim.world.get(vehicle, VehicleC);
  const at = sim.world.get(fetching(sim, vehicle), PositionC);
  const spot = v?.state === 'docked' ? boardingTile(sim, vehicle) : hatchSpot(sim, vehicle, at && shipIdOf(sim, at) === v?.hover ? at : undefined);
  return spot && spot.shipId === shipId ? { x: spot.x, y: spot.y, docked: v?.state === 'docked' } : null;
}

/** True if the party of this site is being called home: the site closes, is gone, or a fight started. */
export function siteRecalled(sim: Sim, site: number): boolean {
  const s = sim.world.get(site, AwaySiteC);
  const run = s && sim.world.get(s.vehicle, SiteRunC);
  return !s || s.status === 'closing' || !run || run.phase === 'recall' || fightCalls(sim, site);
}

/**
 * True if any need the crew member has (rest, hunger, a battery's charge; 0..100) is under its line. A need they lack is satisfied: the same
 * rule serves crew who eat and sleep and robots who charge.
 */
function needBelow(sim: Sim, id: number, rest: number, hunger: number, charge: number): boolean {
  const n = sim.world.get(id, NeedsC);
  return !!n && (n.rest < rest || (n.hunger ?? 100) < hunger || (n.charge ?? 100) < charge);
}

/** True if the crew member is hurt enough to go home at once (below AWAY_HOME_HEALTH, or downed). */
function hurt(sim: Sim, id: number): boolean {
  const h = sim.world.get(id, HealthC);
  return isIncapacitated(sim, id) || (!!h && h.max > 0 && h.hp < AWAY_HOME_HEALTH * h.max);
}

/**
 * The return drive's input (`awayReturn`): absent unless the crew member works on their site. 0 when they must come aboard now (the site
 * is closing, a fight, hurt below AWAY_HOME_HEALTH, riding out a round trip, or a pickup came for them), 500 when they are due home (a need
 * under its home line, AWAY_HOME_REST / _HUNGER / _CHARGE: before the sleep, eat or charge drives would want them; or their schedule has them
 * in a Sleep block, #412), else 1000.
 */
export function awayReturn(sim: Sim, id: number): number | undefined {
  const site = siteUnderFoot(sim, id);
  if (!site) return undefined;
  const away = sim.world.get(id, AwayC);
  if (siteRecalled(sim, site) || away?.ride || away?.pickup || away?.recall || hurt(sim, id)) return 0;
  return needBelow(sim, id, AWAY_HOME_REST, AWAY_HOME_HUNGER, AWAY_HOME_CHARGE) || blockNow(sim, id) === 'sleep' ? 500 : 1000;
}

/**
 * True if a passenger waiting aboard for the next trip home is urgent (the trip leaves at once): hurt or downed, or a need under its urgent
 * line (AWAY_URGENT_*: where they would sleep, eat or charge; needs keep running aboard), so nobody sleeps or starves in a seat.
 */
export function passengerUrgent(sim: Sim, id: number): boolean {
  return !!sim.world.get(id, AwayC)?.recall || hurt(sim, id) || needBelow(sim, id, AWAY_URGENT_REST, AWAY_URGENT_HUNGER, AWAY_URGENT_CHARGE);
}

/** True if the crew member is of the side of the shuttle (its home ship's): its passages, pickups and seats are theirs. */
export function ofSide(sim: Sim, crew: number, vehicle: number): boolean {
  const v = sim.world.get(vehicle, VehicleC);
  return !!v && sim.world.get(crew, AllegianceC)?.faction === vehicleFaction(sim, v);
}

/**
 * Seconds of work on a site before the first of the crew member's needs falls to its home line (AWAY_HOME_REST / _HUNGER / _CHARGE) at
 * its waking rate (a battery at its busy rate), or their schedule's next Sleep block starts (#412: away parties plan around it; Free does not limit a trip).
 * Infinity for one with no need that drains and no plan.
 */
export function staySec(sim: Sim, id: number): number {
  const n = sim.world.get(id, NeedsC);
  if (!n) return Infinity;
  const left = (value: number, line: number, perSec: number): number => (perSec > 0 ? Math.max(0, value - line) / perSec : Infinity);
  const battery = sim.content.species[sim.world.get(id, CrewC)?.species ?? '']?.charge;
  return Math.min(
    secToSleep(sim, id),
    left(n.rest, AWAY_HOME_REST, stat(sim, id, 'restDecay')),
    n.hunger === undefined ? Infinity : left(n.hunger, AWAY_HOME_HUNGER, hungerDrainPerSec(sim, id, false)),
    n.charge === undefined || !battery ? Infinity : left(n.charge, AWAY_HOME_CHARGE, battery.drainPerSec * battery.busyMult),
  );
}

/**
 * The passage checks of `jobFits`: a player crew member not already of a party, rested, fed or charged enough to stay a while (AWAY_GO_STAY_SEC
 * of work before a need sends them home). A seat beyond the shuttle's suits (`airless`) is for crew who do not breathe.
 */
export function passageFits(sim: Sim, crew: number, job: Job): boolean {
  if (job.kind !== 'passage') return true;
  if (job.holder && job.holder !== crew) return false; // a named party's seat (`AwaySite.invited`)
  if (sim.world.has(crew, AwayC) || !ofSide(sim, crew, job.target ?? 0) || (job.airless && needsAir(sim, crew))) return false;
  return sim.world.has(crew, NeedsC) && staySec(sim, crew) >= AWAY_GO_STAY_SEC;
}

/**
 * What a passage costs beyond the walk to the bay, in walking tiles of this crew member: the flight to the site. So a home job of the same
 * level and urgency nearby still wins (docs/DESIGN.md "Who goes").
 */
export function passageTiles(sim: Sim, crew: number, job: Job): number {
  if (job.kind !== 'passage') return 0;
  const v = sim.world.get(job.target ?? 0, VehicleC);
  const body = sim.world.get(job.target ?? 0, BodyC);
  const s = shipById(sim, job.site ?? 0);
  if (!v || !body || !s) return 0;
  const ticks = flightTicks(sim, v, Math.hypot(s.x + s.width / 2 - body.x, s.y + s.height / 2 - body.y));
  return Number.isFinite(ticks) ? Math.round((ticks / TICK_HZ) * walkSpeed(sim, crew)) : 0;
}
