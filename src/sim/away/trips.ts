import { BodyC } from '../body';
import { shipById } from '../combat/ships';
import { AssignmentC, CarriedC, CrewC, DeadC, DraftedC, PositionC, type Crew } from '../crew/components';
import { isIncapacitated } from '../crew/helpers';
import { PickupC } from '../ai/components';
import { flightTicks } from '../ai/travel';
import { hasTank, vehicleAir } from '../eva/air';
import { setAirHolds } from '../eva/airLedger';
import { EvaFloatC } from '../eva/components';
import { outsideCrew } from '../eva/shuttle';
import { shipIdOf } from '../regions';
import { runDue } from './haul';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { AWAY_DEPART_GIVEUP_SEC, AWAY_LAST_CALL_SEC, AWAY_TRIP_WAIT_SEC, AWAY_TURNAROUND_SEC } from '../tuning';
import { VehicleC, type Vehicle } from '../vehicles/components';
import { occupants, vehicleDefOf } from '../vehicles/lifecycle';
import { StagingC } from '../items/components';
import { AwayC, SiteRunC, type SiteRun } from './components';
import { passageFits, passengerUrgent, scheduleHome, takesSiteWork } from './crew';
import { departCheck, homePoint, partyOut } from './depart';

/**
 * Batched round trips (docs/DESIGN.md "Round trips, batched", #286 slice 2b): when a trip home is due, the last call and riders that let it
 * leave without stranding anyone, and the watch while it is away.
 */

const sec = (n: number): number => Math.round(n * TICK_HZ);

/** Party members aboard the shuttle. */
export const partyAboard = (sim: Sim, v: Vehicle): number[] => occupants(v).filter((c) => sim.world.has(c, AwayC));

/**
 * True when nobody is between the shuttle and the site: nobody floating to or from it, nobody aboard still to go out (sent out and not yet
 * landed, or not sent yet), and no suit outside still tied to it. Only then may it leave (Codex 4448955314: a passenger whose `eva.out`
 * was still queued got out after the trip had left, in a suit tied to the shuttle, and held it at the site).
 */
export function settled(sim: Sim, id: number, v: Vehicle): boolean {
  if (sim.world.query(EvaFloatC).some((c) => sim.world.get(c, EvaFloatC)?.vehicle === id)) return false;
  if (partyAboard(sim, v).some((c) => !sim.world.get(c, AwayC)?.home && !sim.world.get(c, AwayC)?.ride)) return false;
  if (sim.world.query(AwayC).some((c) => sim.world.get(c, AwayC)?.vehicle === id && sim.world.get(c, AwayC)?.landing)) return false;
  return outsideCrew(sim, id).length === 0;
}

/**
 * True if a crew member at home would take a seat now: free (no job held, awake, not held), of the shuttle's side, fit for a passage and
 * willing to do some of the site's work (a priority set for a category it wants).
 */
function wouldGo(sim: Sim, c: number, vehicle: number, site: number): boolean {
  const crew = sim.world.get(c, CrewC) as Crew;
  if (crew.activity !== 'idle' || sim.world.has(c, AssignmentC) || sim.world.has(c, DraftedC) || sim.world.has(c, DeadC)) return false;
  if (!passageFits(sim, c, { kind: 'passage', category: 'construction', x: 0, y: 0, struct: 0, work: 1, progress: 0, reservedBy: 0, site, target: vehicle })) return false;
  return takesSiteWork(sim, c, site);
}

/**
 * Whether a trip home is due: 'urgent' (leaves at once: a waiting passenger hurt, downed, or at the end of a need), 'batch' (the hold
 * full; nobody of the party left on the site or to go out; rotation due, half the seats waiting or free seats crew at home would take; AWAY_TRIP_WAIT_SEC since the last trip with anyone
 * waiting; the shuttle's own air under a tank), else null. Every trip still goes through the departure check.
 */
export function tripDue(sim: Sim, id: number, v: Vehicle, r: SiteRun): 'urgent' | 'batch' | null {
  const aboard = partyAboard(sim, v);
  const going = aboard.filter((c) => sim.world.get(c, AwayC)?.home);
  if (going.some((c) => passengerUrgent(sim, c))) return 'urgent';
  if (runDue(sim, id) || going.some((c) => scheduleHome(sim, c))) return 'batch'; // their Free time (#412): home at the first chance
  // Nobody of the party on the site and none aboard to go out (a cargo run, or the last of them aboard for home): nothing to serve here.
  if (partyOut(sim, id).length === 0 && aboard.length === going.length) return 'batch';
  const seats = (vehicleDefOf(sim, v)?.capacity ?? 0) + 1;
  if (going.length > 0 && going.length >= Math.ceil(seats / 2)) return 'batch';
  if (going.length > 0 && sim.tick - r.lastTrip >= sec(AWAY_TRIP_WAIT_SEC)) return 'batch';
  if (!hasTank(sim, vehicleAir(sim, v))) return 'batch';
  // Seats free once those going home are out (riders stay aboard), and someone at home who would take one.
  const free = seats - (aboard.length - going.length);
  if (free <= 0) return null;
  const home = sim.world.query(CrewC, PositionC).filter((c) => !sim.world.has(c, AwayC) && shipIdOf(sim, sim.world.get(c, PositionC)!) === v.homeShip);
  return home.some((c) => wouldGo(sim, c, id, r.site)) ? 'batch' : null;
}

/** Able to answer the last call or come aboard to ride: on their feet, not carried, not held by the player. */
const able = (sim: Sim, m: number): boolean => !isIncapacitated(sim, m) && !sim.world.has(m, CarriedC) && !sim.world.has(m, DraftedC) && sim.world.has(m, PositionC);

/**
 * One tick of a due trip (the 'depart' phase; `r.timer` counts from when it fell due). It leaves ('go', with `r.returnBy` set) once the
 * shuttle is settled and the departure check passes. Until then each worker it finds short and able gets the last call (their air drive
 * refills them now); still short after AWAY_LAST_CALL_SEC they ride (come aboard for the round trip). A worker short and unable (downed out
 * of reach, held) keeps it waiting; after AWAY_DEPART_GIVEUP_SEC the trip is called off ('off') and the run stays.
 */
export function departStep(sim: Sim, id: number, v: Vehicle, r: SiteRun): 'wait' | 'go' | 'off' {
  // Leaving the phase ends the last call and the ride of those still out (away/owned.ts).
  if (r.timer > sec(AWAY_DEPART_GIVEUP_SEC)) return 'off';
  if (settled(sim, id, v)) {
    const { unsafe, returnBy, holds } = departCheck(sim, id);
    if (unsafe.length === 0) {
      setAirHolds(sim, id, holds); // the top-ups the check counted on, set aside until the shuttle is back (away/owned.ts ends them)
      if (returnBy === undefined) delete r.returnBy;
      else r.returnBy = returnBy;
      return 'go';
    }
  }
  // Those short (judged as they stand, a refill under way included) get the last call, then ride.
  for (const m of departCheck(sim, id, true).unsafe) {
    if (!able(sim, m)) continue;
    const away = sim.world.get(m, AwayC)!;
    away.lastCall = true;
    if (r.timer > sec(AWAY_LAST_CALL_SEC)) away.ride = true;
  }
  return 'wait';
}

/** Ticks for the shuttle to get back to the site from where it is (its home point while stowed or docked at home). */
function backTicks(sim: Sim, id: number, v: Vehicle, site: number): number {
  const s = shipById(sim, site);
  const body = v.state === 'flying' ? sim.world.get(id, BodyC) : undefined;
  const from = body ?? homePoint(sim, v);
  if (!s || !from) return Infinity;
  return flightTicks(sim, v, Math.hypot(s.x + s.width / 2 - from.x, s.y + s.height / 2 - from.y));
}

/**
 * The watch while the shuttle is away from the site (flying home, or at home): true if it must go straight back. A worker left out is
 * downed, carried or asks for a pickup, or the earliest worker counting on their own tank would run short before it could be back
 * (`returnBy`, with a few seconds to spare).
 */
export function mustTurnBack(sim: Sim, id: number, v: Vehicle, r: SiteRun): boolean {
  const out = partyOut(sim, id);
  if (out.length === 0) return false;
  if (out.some((m) => isIncapacitated(sim, m) || sim.world.has(m, CarriedC) || sim.world.has(m, PickupC))) return true;
  return r.returnBy !== undefined && sim.tick + backTicks(sim, id, v, r.site) + sec(5) >= r.returnBy;
}

/**
 * Ticks until the site's shuttle, away on a round trip, is beside the site again: the rest of its flight back ('fly'); the stop at home, at
 * most AWAY_TURNAROUND_SEC with part of the party out, then the flight ('board'); or the flight home, the stop and the flight back ('home').
 * Never later than `returnBy`, the deadline the watch holds it to (it turns back then).
 */
function arrivalTicks(sim: Sim, id: number, v: Vehicle, r: SiteRun): number {
  const s = shipById(sim, r.site);
  const home = homePoint(sim, v);
  if (!s || !home) return Infinity;
  const fromHome = flightTicks(sim, v, Math.hypot(s.x + s.width / 2 - home.x, s.y + s.height / 2 - home.y));
  const stop = (timer: number): number => Math.max(0, sec(AWAY_TURNAROUND_SEC) - timer);
  let eta = Infinity;
  if (r.phase === 'fly') eta = backTicks(sim, id, v, r.site);
  else if (r.phase === 'board') eta = stop(r.timer) + fromHome;
  else if (r.phase === 'home') {
    const body = sim.world.get(id, BodyC);
    const toHome = body ? flightTicks(sim, v, Math.hypot(home.x - body.x, home.y - body.y)) : 0;
    eta = toHome + stop(0) + fromHome;
  }
  return Math.min(eta, r.returnBy === undefined ? Infinity : Math.max(0, r.returnBy - sim.tick));
}

/**
 * For a party member on their site while its shuttle is away on a round trip that left them counting on their own tank (`SiteRun.returnBy`,
 * the departure check): where it takes the party aboard again (the first tile of the site's staging zone, beside its drop-off point) and the
 * ticks until it is there (`arrivalTicks`). The shuttle is their air source still, only later: admission lets them work on while it is away
 * (#408). Null otherwise.
 */
export function shuttleDueBack(sim: Sim, crew: number, ship: number): { tile: { x: number; y: number }; ticks: number } | null {
  const away = sim.world.get(crew, AwayC);
  const r = away?.site === ship ? sim.world.get(away.vehicle, SiteRunC) : undefined;
  const v = away && sim.world.get(away.vehicle, VehicleC);
  const tile = sim.world.get(ship, StagingC)?.tiles[0];
  if (!away || !r || !v || r.site !== ship || r.returnBy === undefined || r.pickup || !tile || (r.phase !== 'home' && r.phase !== 'board' && r.phase !== 'fly')) return null;
  const ticks = arrivalTicks(sim, away.vehicle, v, r);
  return Number.isFinite(ticks) ? { tile, ticks } : null;
}
