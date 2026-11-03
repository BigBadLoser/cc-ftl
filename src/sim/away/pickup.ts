import { shipById } from '../combat/ships';
import { CrewC, DeadC, PositionC } from '../crew/components';
import { PickupC } from '../ai/components';
import { hasTank, vehicleAir } from '../eva/air';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { VehicleC } from '../vehicles/components';
import { AwayC, AwaySiteC, SiteRunC } from './components';
import { fetching, ofSide } from './crew';
import { partyOut } from './depart';
import { siteShuttleOk } from './handlers';
import { freeSeats } from './passage';

/**
 * Pickups and lost shuttles (docs/DESIGN.md "No source reachable: ask early" and "Failures", #286 slice 2b). A crew member out of air reach
 * (`PickupC`, from the air drive) is fetched by a shuttle: their site's own, which moves its hover point beside them, or for anyone not of a
 * party a free EVA shuttle on a pickup run. A site whose shuttle is lost asks for another free one; with none its party is stranded.
 */

type Box = { x: number; y: number; w: number; h: number };

/** The hover box of a pickup: the crew member's own tile (sector tiles), so the shuttle holds station within an easy float of it. */
export function boxAround(sim: Sim, c: number): Box | null {
  const p = sim.world.get(c, PositionC);
  return p ? { x: p.x, y: p.y, w: 1, h: 1 } : null;
}

/** The party member out on the site a shuttle is fetching (lowest id), marking each new request as answered. 0 for none. */
export function answerPickups(sim: Sim, vehicle: number): number {
  for (const c of partyOut(sim, vehicle)) if (sim.world.has(c, PickupC)) sim.world.get(c, AwayC)!.pickup = true;
  return fetching(sim, vehicle);
}

/**
 * A free shuttle that can fly a pickup or take over a site: lowest id, stowed at home, with a tank of air to share and a free seat (crew
 * embarked by hand may fill it: Codex 4449367460).
 */
function freeShuttle(sim: Sim, crew: number): number {
  return [...sim.world.query(VehicleC)].sort((a, b) => a - b).find((id) => {
    const v = sim.world.get(id, VehicleC)!;
    return ofSide(sim, crew, id) && siteShuttleOk(sim, id) && hasTank(sim, vehicleAir(sim, v)) && freeSeats(sim, v) > 0;
  }) ?? 0;
}

/**
 * Pickup runs: each crew member out of air reach who is of no party, on a ship in the node, and not fetched yet gets a free shuttle
 * (lowest id first, of their side). The shuttle runs as a site run with `pickup` set and no site: it hovers beside them, and the return drive brings them
 * aboard (they are of its party until they step out at home). None start during a fight.
 */
export function startPickupRuns(sim: Sim): void {
  if (sim.sector.inCombat) return; // no shuttle goes out into a fight (sites are called in then too)
  const fetched = new Set(sim.world.query(SiteRunC).map((id) => sim.world.get(id, SiteRunC)?.pickup ?? 0));
  for (const c of [...sim.world.query(PickupC, CrewC, PositionC)].sort((a, b) => a - b)) {
    if (fetched.has(c) || sim.world.has(c, AwayC) || sim.world.has(c, DeadC)) continue;
    const grid = shipIdOf(sim, sim.world.get(c, PositionC)!);
    const vehicle = shipById(sim, grid) ? freeShuttle(sim, c) : 0;
    if (!vehicle) continue;
    sim.world.add(c, AwayC, { site: grid, vehicle, cat: 'hauling', pickup: true });
    sim.world.add(vehicle, SiteRunC, { site: grid, phase: 'fly', timer: 0, lastTrip: sim.tick, pickup: c });
    (sim.world.get(vehicle, VehicleC) as { autopilot: boolean }).autopilot = true;
    sim.events.emit({ type: 'away.pickup', ship: grid, vehicle, crew: [c] });
  }
}

/**
 * A site whose shuttle is gone (destroyed, or its run ended): another free shuttle takes the run over and the party is its party (it comes
 * by way of home, offering the free seats). With none the site is `stranded` (an alert, once) and asks again later. A site with nobody of
 * its party left closes. A party member with nowhere to stand (aboard the lost shuttle) leaves the party.
 */
export function replaceLostShuttles(sim: Sim): void {
  for (const site of [...sim.world.query(AwaySiteC)].sort((a, b) => a - b)) {
    const s = sim.world.get(site, AwaySiteC)!;
    if (sim.world.get(s.vehicle, SiteRunC)?.site === site) continue;
    const all = [...sim.world.query(AwayC)].filter((c) => sim.world.get(c, AwayC)?.site === site).sort((a, b) => a - b);
    const party = all.filter((c) => !sim.world.has(c, DeadC) && sim.world.has(c, PositionC));
    for (const c of all) if (!party.includes(c)) sim.world.remove(c, AwayC);
    if (party.length === 0 || !shipById(sim, site)) {
      for (const c of party) sim.world.remove(c, AwayC);
      sim.world.remove(site, AwaySiteC);
      sim.events.emit({ type: 'away.closed', ship: site, vehicle: s.vehicle, reason: 'lost' });
      continue;
    }
    const vehicle = freeShuttle(sim, party[0] as number);
    if (!vehicle) {
      if (s.block !== 'stranded') sim.events.emit({ type: 'away.stranded', ship: site, crew: party });
      s.block = 'stranded';
      continue;
    }
    delete s.block;
    s.vehicle = vehicle;
    for (const c of party) {
      const away = sim.world.get(c, AwayC)!;
      away.vehicle = vehicle; // a `landing` or `home` of the lost shuttle's ends with it (away/owned.ts)
    }
    sim.world.add(vehicle, SiteRunC, { site, phase: 'board', timer: 0, lastTrip: sim.tick });
    sim.events.emit({ type: 'away.pickup', ship: site, vehicle, crew: party });
  }
}
