import { BodyC } from '../body';
import { shipById } from '../combat/ships';
import { AssignmentC, CarriedC, CrewC, DeadC, DraftedC, PositionC, PrioritiesC, type Crew } from '../crew/components';
import { isIncapacitated } from '../crew/helpers';
import { PickupC } from '../ai/components';
import { flightTicks } from '../ai/travel';
import { hasTank, vehicleAir } from '../eva/air';
import { setAirHolds } from '../eva/airLedger';
import { EvaFloatC } from '../eva/components';
import { outsideCrew, vehicleSuits } from '../eva/shuttle';
import { needsAir } from '../eva/suit';
import { AllegianceC } from '../fight/components';
import { shipIdOf } from '../regions';
import { runDue } from './haul';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { AWAY_DEPART_GIVEUP_SEC, AWAY_LAST_CALL_SEC, AWAY_TRIP_WAIT_SEC } from '../tuning';
import type { Vehicle } from '../vehicles/components';
import { occupants, vehicleDefOf } from '../vehicles/lifecycle';
import { AwayC, type SiteRun } from './components';
import { passageFits, passengerUrgent } from './crew';
import { departCheck, homePoint, partyOut } from './depart';
import { siteDemand } from './seats';

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
 * True if a crew member at home would take a seat now: free (no job held, awake, not held), of the player's crew, fit for a passage (a suit
 * left for them if they breathe) and willing to do some of the site's work (a priority set for a category it wants).
 */
function wouldGo(sim: Sim, c: number, site: number, suits: number): boolean {
  const crew = sim.world.get(c, CrewC) as Crew;
  if (crew.activity !== 'idle' || sim.world.has(c, AssignmentC) || sim.world.has(c, DraftedC) || sim.world.has(c, DeadC)) return false;
  if (sim.world.get(c, AllegianceC)?.faction !== 'player' || (needsAir(sim, c) && suits <= 0)) return false;
  if (!passageFits(sim, c, { kind: 'passage', category: 'construction', x: 0, y: 0, struct: 0, work: 1, progress: 0, reservedBy: 0, site })) return false;
  const prio = sim.world.get(c, PrioritiesC);
  const demand = siteDemand(sim, site);
  return !!prio && Object.entries(demand).some(([cat, n]) => (n ?? 0) > 0 && (prio[cat as keyof typeof prio] ?? 0) >= 1);
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
  if (runDue(sim, id)) return 'batch';
  // Nobody of the party on the site and none aboard to go out (a cargo run, or the last of them aboard for home): nothing to serve here.
  if (partyOut(sim, id).length === 0 && aboard.length === going.length) return 'batch';
  const seats = (vehicleDefOf(sim, v)?.capacity ?? 0) + 1;
  if (going.length > 0 && going.length >= Math.ceil(seats / 2)) return 'batch';
  if (going.length > 0 && sim.tick - r.lastTrip >= sec(AWAY_TRIP_WAIT_SEC)) return 'batch';
  if (!hasTank(sim, vehicleAir(sim, v))) return 'batch';
  // Seats free once those going home are out (riders stay aboard), and someone at home who would take one.
  const free = seats - (aboard.length - going.length);
  if (free <= 0) return null;
  const suits = vehicleSuits(sim, v) - aboard.filter((c) => !sim.world.get(c, AwayC)?.home && needsAir(sim, c)).length;
  const home = sim.world.query(CrewC, PositionC).filter((c) => !sim.world.has(c, AwayC) && shipIdOf(sim, sim.world.get(c, PositionC)!) === v.homeShip);
  return home.some((c) => wouldGo(sim, c, r.site, suits)) ? 'batch' : null;
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
