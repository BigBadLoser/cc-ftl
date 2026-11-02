import { BodyC } from '../body';
import { shipById } from '../combat/ships';
import { CarriedC, CrewC, DraftedC, type Crew } from '../crew/components';
import { isIncapacitated } from '../crew/helpers';
import { abortTask, isCarrying } from '../ai/task';
import { EvaFloatC, SuitC } from '../eva/components';
import { vehicleSuits } from '../eva/shuttle';
import { isThin, needsAir, suitDef } from '../eva/suit';
import { destroyJob } from '../items/stacks';
import { shipGrid } from '../regions';
import { haulsTo, planCarry } from '../salvage/cargoRun';
import { liveBox } from '../salvage/team';
import type { Sim } from '../sim';
import { AWAY_LIFT_SEC } from '../tuning';
import { VehicleC, type Vehicle } from '../vehicles/components';
import { boardingTile, hoverPoint } from '../vehicles/geometry';
import { boardCrew, occupants, unboardCrew, vehicleDefOf } from '../vehicles/lifecycle';
import { AwayC, AwaySiteC, type SiteRun } from './components';
import { partyOut } from './depart';
import { siteSpot } from './crew';
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

/**
 * Party members out on the site and not floating are the crew AI's: a suit still tied to the shuttle is untied (theirs: the shuttle may
 * leave), and those sent out of the hatch who have landed are let go (free to work).
 */
function handOver(sim: Sim, vehicle: number): void {
  for (const c of partyOut(sim, vehicle)) {
    const away = sim.world.get(c, AwayC)!;
    if (sim.world.has(c, EvaFloatC)) continue;
    const suit = sim.world.get(c, SuitC);
    if (suit?.vehicle === vehicle) delete suit.vehicle;
    if (!away.landing) continue;
    delete away.landing;
    if (sim.world.get(c, DraftedC)?.target === null && sim.world.remove(c, DraftedC)) (sim.world.get(c, CrewC) as Crew).activity = 'idle';
  }
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
    if (!isIncapacitated(sim, c)) delete away.downAt;
    else if (sim.world.has(c, CarriedC)) continue;
    else if (sim.tick - (away.downAt ??= sim.tick) > sec(AWAY_LIFT_SEC)) lift(sim, c, id);
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
    const suit = needsAir(sim, c) && !!grid && isThin(grid, at.x, at.y);
    if (suit && vehicleSuits(sim, v) <= 0) continue;
    unboardCrew(sim, c, id, at);
    if (sim.world.remove(c, DraftedC)) (sim.world.get(c, CrewC) as Crew).activity = 'idle'; // crew at work, not boarders
    if (!suit) continue;
    v.suits = vehicleSuits(sim, v) - 1;
    sim.world.add(c, SuitC, { worn: true, air: suitDef(sim).airSec });
    sim.events.emit({ type: 'suit.donned', crew: c, airlock: 0 });
  }
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

/** The housekeeping of 'stay' and 'depart': station, hand-over, the downed, pickups, loot into the hold. Null when off station. */
function beside(sim: Sim, id: number, v: Vehicle, r: SiteRun): { unplaced: number } | null {
  const fetch = answerPickups(sim, id);
  if (offStation(sim, id, v, r, fetch)) return null;
  const onStation = holdStation(sim, id, v, r, fetch);
  handOver(sim, id);
  watchDowned(sim, id);
  if (!onStation || !siteSpot(sim, id, r.site)) return null;
  return { unplaced: planCarry(sim, id, r.site) };
}

/** Beside the site: passengers go out, the party works, and a trip home falls due (`tripDue`), then waits for the shuttle to settle. */
export function stay(sim: Sim, id: number, v: Vehicle, r: SiteRun): void {
  if (!wanted(sim, r.site)) return go(r, 'recall');
  const here = beside(sim, id, v, r);
  if (!here || !due(r)) return;
  const trip = tripDue(sim, id, v, r, here.unplaced);
  sendOut(sim, id, v, !!trip);
  if (trip && settled(sim, id, v)) go(r, 'depart');
}

/** A trip is due: the last call and riders until the departure check passes, then home (or called off back to 'stay'). */
export function depart(sim: Sim, id: number, v: Vehicle, r: SiteRun): void {
  if (!wanted(sim, r.site)) return go(r, 'recall');
  const here = beside(sim, id, v, r);
  if (!here) return;
  sendOut(sim, id, v, true);
  const step = departStep(sim, id, v, r);
  if (step === 'off') return go(r, 'stay');
  if (step !== 'go') return;
  for (const j of haulsTo(sim, id)) destroyJob(sim, j); // a load on its way to the hold is set down; it waits for the next trip
  r.lastTrip = sim.tick;
  go(r, 'home');
  sim.events.emit({ type: 'away.departed', ship: r.site, vehicle: id, crew: partyAboard(sim, v), home: true });
}

/** Everyone is called aboard (the site closes, is gone, or a fight started); after AWAY_LIFT_SEC whoever is still out is lifted. */
export function recall(sim: Sim, id: number, v: Vehicle, r: SiteRun): void {
  holdStation(sim, id, v, r, 0);
  handOver(sim, id);
  const out = partyOut(sim, id);
  const gone = !shipById(sim, r.site);
  for (const c of partyAboard(sim, v)) {
    const away = sim.world.get(c, AwayC)!;
    // Aboard and not on the way out (a queued `eva.out` runs the next tick; one still aboard after that was refused): home with the rest.
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
  for (const j of haulsTo(sim, id)) destroyJob(sim, j);
  if (gone || sim.world.get(r.site, AwaySiteC)?.status !== 'open') r.ending = true;
  go(r, 'home');
  sim.events.emit({ type: 'away.departed', ship: r.site, vehicle: id, crew: partyAboard(sim, v), home: true });
}
