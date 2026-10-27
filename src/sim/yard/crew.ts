import { ALT, BodyC } from '../body';
import { ShipC } from '../combat/components';
import { CrewC, DeadC, DraftedC, PrioritiesC, WORK_CATEGORIES, type Crew, type Priorities } from '../crew/components';
import { releaseAssignment } from '../crew/helpers';
import { createCrew } from '../crew/spawn';
import { SuitC } from '../eva/components';
import { suitDef } from '../eva/suit';
import { vehicleSuits } from '../eva/shuttle';
import { isTileWalkable } from '../modules/walk';
import { shipGrid } from '../regions';
import type { Sim } from '../sim';
import { courierDef } from '../trade/courier';
import { AboardC, VehicleC, type Vehicle } from '../vehicles/components';
import { boardingTile } from '../vehicles/geometry';
import { boardCrew, unboardCrew } from '../vehicles/lifecycle';
import { YardCrewC, type YardOrder } from './types';

/** Station crew who build for the player work construction and nothing else. */
function builderPriorities(): Priorities {
  const p = Object.fromEntries(WORK_CATEGORIES.map((c) => [c, 0])) as unknown as Priorities;
  p.construction = 1;
  return p;
}

/** True for a yard crew member who is alive. */
export const alive = (sim: Sim, id: number): boolean => sim.world.has(id, CrewC) && !sim.world.has(id, DeadC);

/**
 * The yard shuttle and its crew, made at the station: the trade courier's shuttle type, bound for the player's airlock, with the crew already aboard
 * (the first is the pilot; the shuttle flies itself). Contractors are the station's people but neutral to everyone. Returns false when it cannot be made.
 */
export function launchShuttle(sim: Sim, o: YardOrder): boolean {
  const cd = courierDef(sim);
  const station = sim.world.get(o.station, ShipC);
  const spec = sim.content.yard?.crew;
  if (!cd || !station || !spec) return false;
  const vehicle = sim.world.createEntity();
  sim.world.add(vehicle, VehicleC, {
    def: cd.id, homeShip: o.station, home: 0, state: 'flying', hp: cd.def.maxHp, pilot: 0, passengers: [],
    dest: { type: 'dock', airlock: o.airlock }, dock: 0, cargo: [], autopilot: true,
  });
  sim.world.add(vehicle, BodyC, { x: station.x + station.width / 2, y: station.y + station.height / 2, heading: 0, alt: ALT.cruise });
  const n = Math.min(spec.count, cd.def.eva?.suits ?? spec.count, cd.def.capacity + 1);
  for (let i = 0; i < n; i++) {
    const id = createCrew(sim, o.station, spec.role, { x: station.x, y: station.y }, { faction: 'neutral', rest: 100 });
    if (!id) continue;
    sim.world.add(id, PrioritiesC, builderPriorities());
    sim.world.add(id, YardCrewC, { order: o.id });
    boardCrew(sim, id, vehicle);
    o.crew.push(id);
  }
  o.vehicle = vehicle;
  if (o.crew.length === 0) {
    sim.world.destroyEntity(vehicle);
    o.vehicle = 0;
    return false;
  }
  return true;
}

/**
 * The shuttle is docked at the player's airlock: the crew step out onto the ship in the shuttle's own suits (they are not drafted: they work the
 * order's build jobs on their own, like any crew). False while the landing tile is blocked.
 */
export function landCrew(sim: Sim, o: YardOrder): boolean {
  const v = sim.world.get(o.vehicle, VehicleC) as Vehicle;
  const at = boardingTile(sim, o.vehicle);
  const grid = at && shipGrid(sim, at.shipId);
  if (!at || !grid || !isTileWalkable(sim, grid, at.x, at.y)) return false;
  for (const id of o.crew) {
    if (sim.world.get(id, AboardC)?.vehicle !== o.vehicle) continue;
    unboardCrew(sim, id, o.vehicle, at);
    sim.world.remove(id, DraftedC);
    (sim.world.get(id, CrewC) as Crew).activity = 'idle';
    if (vehicleSuits(sim, v) > 0) {
      v.suits = vehicleSuits(sim, v) - 1;
      sim.world.add(id, SuitC, { worn: true, air: suitDef(sim).airSec, vehicle: o.vehicle });
    }
  }
  return true;
}

/** Back aboard: the suit goes back into the shuttle's stock. */
export function stowSuit(sim: Sim, o: YardOrder, id: number): void {
  const v = sim.world.get(o.vehicle, VehicleC);
  if (!v || !sim.world.remove(id, SuitC)) return;
  v.suits = vehicleSuits(sim, v) + 1;
}

/** Contractors' tanks are swapped by the yard as they work: they never run dry. */
export function topUpAir(sim: Sim, o: YardOrder): void {
  for (const id of o.crew) {
    const suit = sim.world.get(id, SuitC);
    if (suit) suit.air = suitDef(sim).airSec;
  }
}

/** The order's crew and shuttle leave the world (home again, or lost with the order). */
export function dismiss(sim: Sim, o: YardOrder): void {
  for (const id of o.crew) {
    if (sim.world.has(id, CrewC)) releaseAssignment(sim, id);
    sim.world.destroyEntity(id);
  }
  o.crew = [];
  if (o.vehicle) sim.world.destroyEntity(o.vehicle);
  o.vehicle = 0;
}
