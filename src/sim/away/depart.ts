import { BodyC } from '../body';
import { shipById } from '../combat/ships';
import { CarriedC, CrewC, DeadC, PositionC } from '../crew/components';
import { isIncapacitated, origin } from '../crew/helpers';
import { airLines } from '../ai/airNeed';
import { travelTicks, flightTicks } from '../ai/travel';
import { EvaFloatC } from '../eva/components';
import { planWalk } from '../eva/route';
import { airLeft, fitsReserve, sourceSupply } from '../eva/airLedger';
import type { AirHold } from '../eva/components';
import { airSources, type AirSource } from '../eva/sources';
import { isSuited, isThin, needsAir, suitDef } from '../eva/suit';
import { shipGrid, shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { AIR_RESERVE_SEC, AWAY_DEPART_MARGIN, AWAY_TURNAROUND_SEC } from '../tuning';
import { AboardC, VehicleC, type Vehicle } from '../vehicles/components';
import { bayCenter } from '../vehicles/geometry';
import { AwayC } from './components';
import { siteSpot } from './crew';

/**
 * The departure check (docs/ARCHITECTURE.md "Departure check", #286): the shuttle serving a site may leave it only if every member of the
 * party staying out is safe until it is back. A member is safe when
 * - (a) they do not drain: they need no air, or wear no suit on a breathable tile;
 * - (c) they are able and have air for AWAY_DEPART_MARGIN round trips (`roundTripTicks`) plus the walk to the hatch spot plus AIR_RESERVE_SEC;
 * - (b) failing that, they can walk to another air source (an airlock on the site with air left, a shuttle docked or hovering there) on the
 *   air they have, with AIR_RESERVE_SEC to spare (`fitsReserve`), and its supply (`sourceSupply`, what the refill draws from) still holds
 *   every top-up they will take before the shuttle is back once the members before them (ascending id) have had theirs (`topUps`). On
 *   launch those top-ups become air holds (`AirHoldsC`) owned by the shuttle: set aside for them until the shuttle is back.
 * Downed or carried members are never safe. Nobody may be floating to or from the shuttle either.
 */

/** The party of a site's shuttle: crew of it who are not aboard, ascending id. */
export function partyOut(sim: Sim, vehicle: number): number[] {
  return sim.world.query(AwayC, CrewC).filter((c) => sim.world.get(c, AwayC)?.vehicle === vehicle && !sim.world.has(c, AboardC) && !sim.world.has(c, DeadC)).sort((a, b) => a - b);
}

/** Where the shuttle goes home to: its bay's centre, else its home ship's centre (sector tiles). */
export function homePoint(sim: Sim, v: Vehicle): { x: number; y: number } | null {
  const bay = v.home ? bayCenter(sim, v.home) : null;
  if (bay) return bay;
  const s = shipById(sim, v.homeShip);
  return s ? { x: s.x + s.width / 2, y: s.y + s.height / 2 } : null;
}

/** Ticks for a round trip from the site: the flight home, the longest stop there (AWAY_TURNAROUND_SEC) and the flight back. */
export function roundTripTicks(sim: Sim, vehicle: number): number {
  const v = sim.world.get(vehicle, VehicleC);
  const body = sim.world.get(vehicle, BodyC);
  const home = v && homePoint(sim, v);
  if (!v || !body || !home) return Infinity;
  const leg = flightTicks(sim, v, Math.hypot(home.x - body.x, home.y - body.y));
  return 2 * leg + AWAY_TURNAROUND_SEC * TICK_HZ;
}

/** (a): the crew member's air does not run down where they stand. */
function noDrain(sim: Sim, m: number): boolean {
  if (!needsAir(sim, m)) return true;
  const pos = sim.world.get(m, PositionC);
  const grid = pos && shipGrid(sim, shipIdOf(sim, pos));
  return !isSuited(sim, m) && !!pos && !!grid && !isThin(grid, pos.x, pos.y);
}

/** (c): ticks to walk to where the shuttle takes them aboard (Infinity when it cannot be reached). */
function hatchTicks(sim: Sim, m: number, vehicle: number): number {
  const pos = sim.world.get(m, PositionC);
  const spot = pos && siteSpot(sim, vehicle, shipIdOf(sim, pos));
  if (!pos || !spot) return Infinity;
  const plan = planWalk(sim, m, shipIdOf(sim, pos), origin(pos), { x: spot.x, y: spot.y });
  return plan ? travelTicks(sim, m, plan.steps, { suited: true }) : Infinity;
}

/**
 * (b): what a worker counting on `src` draws from its store until the shuttle is back, and the seconds of air that buys them. They must last
 * `need` seconds (the (c) line) and have `air`. The air drive sends them to fill at the refill line, and a fill tops the tank up to full: each
 * top-up gives them `tank - refill line` seconds more and draws up to a whole tank from the store. So the store is held to a whole tank per
 * top-up they will need: one (the design's "one tank per worker counting on them") unless the round trip outlasts what one top-up buys.
 * Null when a top-up buys nothing (the refill line is a full tank).
 */
function topUps(sim: Sim, m: number, air: number, need: number, src: AirSource): { draw: number; gain: number } | null {
  const { tank, refill } = airLines(sim, m, src.ticks / TICK_HZ);
  const per = tank - refill;
  if (per <= 0) return null;
  const n = Math.max(1, Math.ceil((need - air) / per));
  return { draw: n * suitDef(sim).airSec, gain: n * per };
}

/** The members of the party staying out who are not safe if the shuttle leaves now (empty: it may go). */
export function unsafeMembers(sim: Sim, vehicle: number): number[] {
  return departCheck(sim, vehicle).unsafe;
}

/**
 * The departure check in full: `unsafe` as `unsafeMembers`; `returnBy`, the tick the shuttle must be back at the site by, the earliest a
 * worker safe by their own tank (c), or by it and the top-ups set aside for them (b), would run short (undefined when nobody drains);
 * `holds`, those top-ups, for the shuttle to own while it is away.
 */
export function departCheck(sim: Sim, vehicle: number, floatsOk = false): { unsafe: number[]; returnBy?: number; holds: AirHold[] } {
  const out = partyOut(sim, vehicle);
  // Someone between the hull and the hatch: wait (`floatsOk`: judge them as they stand, for the last call).
  if (!floatsOk && out.some((m) => sim.world.get(m, EvaFloatC)?.vehicle === vehicle)) return { unsafe: out, holds: [] };
  const R = roundTripTicks(sim, vehicle);
  const unsafe: number[] = [];
  let returnBy: number | undefined;
  const holds: AirHold[] = [];
  // Members whose own tank does not cover the round trip but who can walk to another source in time: they share its store.
  const leaning: { m: number; air: number; walk: number; need: number; sources: AirSource[] }[] = [];
  const stores = new Map<string, number>();
  const key = (s: AirSource): string => `${s.kind}:${s.id}`;
  const runsShort = (air: number, walk: number): number => sim.tick + Math.floor((air - AIR_RESERVE_SEC) * TICK_HZ - walk);
  for (const m of out) {
    if (isIncapacitated(sim, m) || sim.world.has(m, CarriedC) || !sim.world.has(m, PositionC)) {
      unsafe.push(m);
      continue;
    }
    if (noDrain(sim, m)) continue; // (a)
    const air = airLeft(sim, m);
    const walk = hatchTicks(sim, m, vehicle);
    const need = (AWAY_DEPART_MARGIN * R + walk) / TICK_HZ + AIR_RESERVE_SEC;
    if (air >= need) {
      // (c): they run short when the air left only covers the walk back and the reserve.
      returnBy = Math.min(returnBy ?? Infinity, runsShort(air, walk));
      continue;
    }
    // (b): another source counts only if the tank lasts the walk there, with the same reserve as admission.
    const others = airSources(sim, m, { without: vehicle }).filter((s) => fitsReserve(s.ticks / TICK_HZ, air));
    if (others.length === 0) {
      unsafe.push(m);
      continue;
    }
    for (const s of others) if (!stores.has(key(s))) stores.set(key(s), sourceSupply(sim, s, { without: vehicle, side: m }));
    leaning.push({ m, air, walk, need, sources: others });
  }
  // Each member leaning on a store has their top-ups set aside in the nearest of theirs that still holds them (ascending id).
  for (const { m, air, walk, need, sources } of leaning) {
    const src = sources.find((s) => {
      const t = topUps(sim, m, air, need, s);
      return !!t && (stores.get(key(s)) ?? 0) >= t.draw;
    });
    const t = src && topUps(sim, m, air, need, src);
    if (!src || !t) {
      unsafe.push(m);
      continue;
    }
    stores.set(key(src), (stores.get(key(src)) ?? 0) - t.draw);
    holds.push({ crew: m, kind: src.kind, id: src.id, sec: t.draw });
    returnBy = Math.min(returnBy ?? Infinity, runsShort(air + t.gain, walk));
  }
  return { unsafe: unsafe.sort((a, b) => a - b), returnBy, holds };
}
