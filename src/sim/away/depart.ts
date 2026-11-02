import { BodyC } from '../body';
import { shipById } from '../combat/ships';
import { CarriedC, CrewC, DeadC, PositionC } from '../crew/components';
import { isIncapacitated, origin } from '../crew/helpers';
import { airLeftSec } from '../ai/airNeed';
import { travelTicks, flightTicks } from '../ai/travel';
import { airlockAir, tankShortfall, vehicleAir } from '../eva/air';
import { EvaFloatC } from '../eva/components';
import { planWalk } from '../eva/route';
import { hatchSpot } from '../eva/shuttle';
import { airSources } from '../eva/sources';
import { isSuited, isThin, needsAir } from '../eva/suit';
import { shipGrid, shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { AIR_RESERVE_SEC, AWAY_DEPART_MARGIN, AWAY_TURNAROUND_SEC } from '../tuning';
import { AboardC, VehicleC, type Vehicle } from '../vehicles/components';
import { bayCenter } from '../vehicles/geometry';
import { AwayC } from './components';

/**
 * The departure check (docs/ARCHITECTURE.md "Departure check", #286): the shuttle serving a site may leave it only if every member of the
 * party staying out is safe until it is back. A member is safe when
 * - (a) they do not drain: they need no air, or wear no suit on a breathable tile;
 * - (c) they are able and have air for AWAY_DEPART_MARGIN round trips (`roundTripTicks`) plus the walk to the hatch spot plus AIR_RESERVE_SEC;
 * - (b) failing that, they can walk to another air source (an airlock on the site with air left, another shuttle) on the air they have, with
 *   AIR_RESERVE_SEC to spare, and its store still holds their refill once the members before them (ascending id) have had theirs.
 * Downed or carried members are never safe. Nobody may be floating to or from the shuttle either.
 */

/** The party of a site's shuttle: crew of it who are not aboard, ascending id. */
export function partyOut(sim: Sim, vehicle: number): number[] {
  return sim.world.query(AwayC, CrewC).filter((c) => sim.world.get(c, AwayC)?.vehicle === vehicle && !sim.world.has(c, AboardC) && !sim.world.has(c, DeadC)).sort((a, b) => a - b);
}

/** Where the shuttle goes home to: its bay's centre, else its home ship's centre (sector tiles). */
function homePoint(sim: Sim, v: Vehicle): { x: number; y: number } | null {
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

/** (c): ticks to walk to the shuttle's hatch spot (Infinity when it cannot be reached). */
function hatchTicks(sim: Sim, m: number, vehicle: number): number {
  const pos = sim.world.get(m, PositionC);
  const spot = hatchSpot(sim, vehicle);
  if (!pos || !spot || spot.shipId !== shipIdOf(sim, pos)) return Infinity;
  const plan = planWalk(sim, m, spot.shipId, origin(pos), { x: spot.x, y: spot.y });
  return plan ? travelTicks(sim, m, plan.steps, { suited: true }) : Infinity;
}

/** The members of the party staying out who are not safe if the shuttle leaves now (empty: it may go). */
export function unsafeMembers(sim: Sim, vehicle: number): number[] {
  const out = partyOut(sim, vehicle);
  if (out.some((m) => sim.world.get(m, EvaFloatC)?.vehicle === vehicle)) return out; // someone between the hull and the hatch: wait
  const R = roundTripTicks(sim, vehicle);
  const unsafe: number[] = [];
  // Members whose own tank does not cover the round trip but who can walk to another source in time: they share its store.
  const leaning: { m: number; sources: string[] }[] = [];
  const stores = new Map<string, number>();
  for (const m of out) {
    if (isIncapacitated(sim, m) || sim.world.has(m, CarriedC) || !sim.world.has(m, PositionC)) {
      unsafe.push(m);
      continue;
    }
    if (noDrain(sim, m)) continue; // (a)
    const air = airLeftSec(sim, m);
    if (air >= (AWAY_DEPART_MARGIN * R + hatchTicks(sim, m, vehicle)) / TICK_HZ + AIR_RESERVE_SEC) continue; // (c)
    // (b): another source counts only if the tank lasts the walk there, with the same reserve as admission.
    const others = airSources(sim, m, { without: vehicle }).filter((s) => s.ticks / TICK_HZ + AIR_RESERVE_SEC <= air);
    if (others.length === 0) {
      unsafe.push(m);
      continue;
    }
    const keys = others.map((s) => `${s.kind}:${s.id}`);
    for (const s of others) {
      const v = s.kind === 'vehicle' ? sim.world.get(s.id, VehicleC) : undefined;
      stores.set(`${s.kind}:${s.id}`, s.kind === 'airlock' ? airlockAir(sim, s.id) : v ? vehicleAir(sim, v) : 0);
    }
    leaning.push({ m, sources: keys });
  }
  // Each member leaning on a store gets the refill they need from the nearest of theirs that still has it (ascending id).
  for (const { m, sources } of leaning) {
    const need = tankShortfall(sim, m);
    const key = sources.find((k) => (stores.get(k) ?? 0) >= need);
    if (key) stores.set(key, (stores.get(key) ?? 0) - need);
    else unsafe.push(m);
  }
  return unsafe.sort((a, b) => a - b);
}
