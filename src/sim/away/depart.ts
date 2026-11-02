import { BodyC } from '../body';
import { shipById } from '../combat/ships';
import { CarriedC, CrewC, DeadC, PositionC } from '../crew/components';
import { isIncapacitated, origin } from '../crew/helpers';
import { airLeftSec } from '../ai/airNeed';
import { travelTicks, flightTicks } from '../ai/travel';
import { airlockAir, vehicleAir } from '../eva/air';
import { EvaFloatC } from '../eva/components';
import { planWalk } from '../eva/route';
import { hatchSpot } from '../eva/shuttle';
import { airSources } from '../eva/sources';
import { isSuited, isThin, needsAir, suitDef } from '../eva/suit';
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
 * - (b) they can reach another air source (an airlock on the site with air left, another shuttle), and those sources hold a tank for each
 *   member counting on them;
 * - (c) they are able and have air for AWAY_DEPART_MARGIN round trips (`roundTripTicks`) plus the walk to the hatch spot plus AIR_RESERVE_SEC.
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
  // (b) members share the other sources' stores: one tank each, counted over the distinct sources they reach.
  const leaning: number[] = [];
  const stores = new Map<string, number>();
  for (const m of out) {
    if (isIncapacitated(sim, m) || sim.world.has(m, CarriedC) || !sim.world.has(m, PositionC)) {
      unsafe.push(m);
      continue;
    }
    if (noDrain(sim, m)) continue;
    const others = airSources(sim, m, { without: vehicle });
    if (others.length > 0) {
      leaning.push(m);
      for (const s of others) {
        const v = s.kind === 'vehicle' ? sim.world.get(s.id, VehicleC) : undefined;
        stores.set(`${s.kind}:${s.id}`, s.kind === 'airlock' ? airlockAir(sim, s.id) : v ? vehicleAir(sim, v) : 0);
      }
      continue;
    }
    const need = (AWAY_DEPART_MARGIN * R + hatchTicks(sim, m, vehicle)) / TICK_HZ + AIR_RESERVE_SEC;
    if (airLeftSec(sim, m) < need) unsafe.push(m);
  }
  if (leaning.length > 0) {
    const total = [...stores.values()].reduce((s, n) => s + n, 0);
    const tanks = leaning.length * suitDef(sim).airSec; // stores and suit tanks hold base seconds (a Void-born wearer's air lasts longer, not more)
    if (total < tanks) unsafe.push(...leaning);
  }
  return unsafe.sort((a, b) => a - b);
}
