import { BodyC } from '../body';
import { shipById } from '../combat/ships';
import { CarriedC, CrewC, DraftedC, type Crew } from '../crew/components';
import { isIncapacitated } from '../crew/helpers';
import { abortTask, isCarrying } from '../ai/task';
import { EvaFloatC, SuitC } from '../eva/components';
import { vehicleSuits } from '../eva/shuttle';
import { isThin, needsAir, suitDef } from '../eva/suit';
import { shipGrid } from '../regions';
import { keepZone, liveBox, loadStep, loading } from './haul';
import type { Sim } from '../sim';
import { AWAY_LIFT_SEC } from '../tuning';
import { VehicleC, type Vehicle } from '../vehicles/components';
import { boardingTile, hoverPoint } from '../vehicles/geometry';
import { boardCrew, occupants, unboardCrew, vehicleDefOf } from '../vehicles/lifecycle';
import { AwayC, AwaySiteC, type SiteRun } from './components';
import { partyOut } from './depart';
import { fetching, siteSpot } from './crew';
import { REPEAT, atSite, due, go, hovering, sec, wanted } from './phase';
import { answerPickups, boxAround } from './pickup';
import { departStep, partyAboard, settled, tripDue } from './trips';

/**
 * The run's phases beside the site (docs/DESIGN.md "Away sites", #286): 'stay' (passengers go out, the party works, a trip home falls due),
 * 'depart' (the last call and riders until the departure check lets it go) and 'recall' (everyone aboard, the lift, home).
 */

/**
 * Hold station: while hovering, keep close to what is left of the site (salvage's rule: the hover point follows the live extent of the hull)
 * or to a crew member it is fetching, shifting over while nobody floats to or from it. True while it holds station (docked counts).
 */
function holdStation(sim: Sim, id: number, v: Vehicle, r: SiteRun, fetch: number): boolean {
  if (!atSite(sim, v, r.site)) return false;
  if (!hovering(v, r.site)) return true;
  if ((r.timer % REPEAT !== 0 && r.timer !== 1) || sim.world.query(EvaFloatC).some((c) => sim.world.get(c, EvaFloatC)?.vehicle === id)) return true;
  const body = sim.world.get(id, BodyC);
  const box = fetch ? boxAround(sim, fetch) : liveBox(sim, r.site);
  const to = body && box && hoverPoint(sim, r.site, vehicleDefOf(sim, v)?.eva?.hoverGap ?? 2, body, box);
  if (!body || !box || !to || Math.hypot(to.x - body.x, to.y - body.y) < 0.75) return true;
  v.hover = 0;
  v.dest = { type: 'hover', ship: r.site, box };
  return false;
}

/** Take a party member aboard where they are (downed with nobody to carry them, or still out when a closing site gives up waiting). */
export function lift(sim: Sim, c: number, vehicle: number): void {
  const v = sim.world.get(vehicle, VehicleC);
  if (!v || occupants(v).length >= (vehicleDefOf(sim, v)?.capacity ?? 0) + 1) return;
  if (isCarrying(sim, c)) abortTask(sim, c, 'halted'); // a patient in hand is set down first (lifted on their own)
  sim.world.remove(c, EvaFloatC);
  if (sim.world.remove(c, SuitC)) v.suits = vehicleSuits(sim, v) + 1;
  boardCrew(sim, c, vehicle);
  const away = sim.world.get(c, AwayC);
  if (away) sim.world.add(c, AwayC, { site: away.site, vehicle: away.vehicle, cat: away.cat, home: true });
}

/**
 * Downed members out on the site are rescue jobs (carried aboard by the party, crew/jobWork.ts); one lying there AWAY_LIFT_SEC uncarried
 * (nobody able to carry them) is lifted aboard. Their clock is `AwayC.downAt`.
 */
function watchDowned(sim: Sim, id: number): void {
  for (const c of partyOut(sim, id)) {
    const away = sim.world.get(c, AwayC)!;
    if (!isIncapacitated(sim, c) || sim.world.has(c, CarriedC)) continue; // `downAt` ends with their being down (away/owned.ts)
    if (sim.tick - (away.downAt ??= sim.tick) > sec(AWAY_LIFT_SEC)) lift(sim, c, id);
  }
}

/**
 * Send out the passengers aboard who are not going home (riders too, unless `keepRiders`): hovering, out of the hatch (`eva.out`, a suit
 * from stock for those who breathe), handed to the crew AI once landed; docked, they step out at the airlock, a suit from stock for those
 * who breathe if its tile is thin (none left: they wait aboard).
 */
function sendOut(sim: Sim, id: number, v: Vehicle, keepRiders: boolean): void {
  const at = v.state === 'docked' ? boardingTile(sim, id) : null;
  const grid = at && shipGrid(sim, at.shipId);
  let suits = vehicleSuits(sim, v);
  for (const c of partyAboard(sim, v)) {
    const away = sim.world.get(c, AwayC)!;
    if (away.home || (keepRiders && away.ride)) continue;
    delete away.ride;
    if (!at && needsAir(sim, c) && suits-- <= 0) {
      away.home = true; // no suit to go out in: they go home with the next trip
      continue;
    }
    if (!at) {
      away.landing = true; // (a `landing` still aboard: the last eva.out was refused; it is asked again)
      sim.enqueue({ type: 'eva.out', vehicle: id, crew: c });
      continue;
    }
    const suit = needsAir(sim, c) && ((!!grid && isThin(grid, at.x, at.y)) || !!sim.world.get(away.site, AwaySiteC)?.outside);
    if (suit && vehicleSuits(sim, v) <= 0) continue;
    unboardCrew(sim, c, id, at);
    standBy(sim, c, !!sim.world.get(away.site, AwaySiteC)?.standBy);
    if (!suit) continue;
    v.suits = vehicleSuits(sim, v) - 1;
    sim.world.add(c, SuitC, { worn: true, air: suitDef(sim).airSec });
    sim.events.emit({ type: 'suit.donned', crew: c, airlock: 0 });
  }
}

/**
 * A crew member landed on a site: drafted, standing by for orders, on a site whose owner wants that (boarders), else undrafted and at the
 * crew AI's work.
 */
export function standBy(sim: Sim, c: number, drafted: boolean): void {
  const crew = sim.world.get(c, CrewC) as Crew | undefined;
  if (!crew) return;
  if (drafted) {
    sim.world.add(c, DraftedC, { target: null });
    crew.activity = 'drafted';
  } else if (sim.world.remove(c, DraftedC)) crew.activity = 'idle';
}

/** Off station (knocked off, or a pickup wants it hovering while docked): back to 'fly'. True if so. */
function offStation(sim: Sim, id: number, v: Vehicle, r: SiteRun, fetch: number): boolean {
  if (fetch && v.state === 'docked') {
    if (due(r)) sim.enqueue({ type: 'vehicle.undock', vehicle: id });
    return false;
  }
  if (atSite(sim, v, r.site) || (v.dest?.type === 'hover' && v.dest.ship === r.site) || (v.dest?.type === 'dock')) return false;
  go(r, 'fly');
  return true;
}

/**
 * The housekeeping of 'stay' and 'depart': station, the downed, pickups, the staging zone beside the drop-off point and loading it into the
 * hold. False when off station. (Those sent out of the hatch are the crew AI's once landed: the hand-over is the release of their drift's
 * holds, away/owned.ts.)
 */
function beside(sim: Sim, id: number, v: Vehicle, r: SiteRun): boolean {
  const fetch = answerPickups(sim, id);
  if (offStation(sim, id, v, r, fetch)) return false;
  const onStation = holdStation(sim, id, v, r, fetch);
  watchDowned(sim, id);
  const spot = onStation && siteSpot(sim, id, r.site);
  if (!spot) return false;
  if (!sim.world.get(r.site, AwaySiteC)?.noLoot) {
    keepZone(sim, r.site, id, spot);
    loadStep(sim, r.site, id, r.lastTrip);
  }
  return true;
}

/** Beside the site: passengers go out, the party works, and a trip home falls due (`tripDue`), then waits for the shuttle to settle. */
export function stay(sim: Sim, id: number, v: Vehicle, r: SiteRun): void {
  if (!wanted(sim, r.site)) return go(r, 'recall');
  if (!beside(sim, id, v, r) || !due(r)) return;
  const trip = tripDue(sim, id, v, r);
  sendOut(sim, id, v, !!trip);
  // An urgent trip goes at once; any other waits until the shuttle has loaded what the zone holds (or its hold is full).
  if (trip && settled(sim, id, v) && (trip === 'urgent' || !loading(sim, r.site, id))) go(r, 'depart');
}

/** A trip is due: the last call and riders until the departure check passes, then home (or called off back to 'stay'). */
export function depart(sim: Sim, id: number, v: Vehicle, r: SiteRun): void {
  if (!wanted(sim, r.site)) return go(r, 'recall');
  if (!beside(sim, id, v, r)) return;
  sendOut(sim, id, v, true);
  const step = departStep(sim, id, v, r);
  if (step === 'off') return go(r, 'stay');
  if (step !== 'go') return;
  r.lastTrip = sim.tick;
  go(r, 'home');
  sim.events.emit({ type: 'away.departed', ship: r.site, vehicle: id, crew: partyAboard(sim, v), home: true });
}

/** Everyone is called aboard (the site closes, is gone, or a fight started); after AWAY_LIFT_SEC whoever is still out is lifted. */
export function recall(sim: Sim, id: number, v: Vehicle, r: SiteRun): void {
  const out = partyOut(sim, id);
  const gone = !shipById(sim, r.site);
  // With no hull left to hover beside (the last floor is down), the call home is answered as a pickup: the shuttle comes beside whoever
  // is still out and they float in from where they stand.
  if (!gone && !liveBox(sim, r.site)) for (const c of out) sim.world.get(c, AwayC)!.pickup = true;
  holdStation(sim, id, v, r, fetching(sim, id));
  for (const c of partyAboard(sim, v)) {
    const away = sim.world.get(c, AwayC)!;
    // Aboard and not on the way out (a queued `eva.out` runs the next tick; one still aboard after that was refused): home with the rest
    // (a refused drift is no drift: its `landing` goes with it).
    if (!away.landing || r.timer > 2) {
      away.home = true;
      delete away.landing;
    }
  }
  if (out.length > 0 && !gone && r.timer <= sec(AWAY_LIFT_SEC)) {
    watchDowned(sim, id);
    return;
  }
  // Carriers first: a patient in hand is set down, then lifted on their own.
  for (const c of [...out.filter((c) => isCarrying(sim, c)), ...out.filter((c) => !isCarrying(sim, c))]) lift(sim, c, id);
  if (!settled(sim, id, v)) return;
  if (gone || sim.world.get(r.site, AwaySiteC)?.status !== 'open') r.ending = true;
  go(r, 'home');
  sim.events.emit({ type: 'away.departed', ship: r.site, vehicle: id, crew: partyAboard(sim, v), home: true });
}
