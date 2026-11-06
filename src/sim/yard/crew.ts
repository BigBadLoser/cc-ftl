import { reportLaunched } from '../vehicles/transitions';
import { ALT, BodyC } from '../body';
import { abortTask } from '../ai/task';
import { AwayC, AwaySiteC, SiteRunC, type SiteRun } from '../away/components';
import { endRun } from '../away/end';
import { openSite } from '../away/handlers';
import { ShipC } from '../combat/components';
import { CrewC, DeadC, PrioritiesC, WORK_CATEGORIES, type Priorities } from '../crew/components';
import { createCrew } from '../crew/spawn';
import type { Sim } from '../sim';
import { courierDef } from '../trade/courier';
import { VehicleC, type Vehicle } from '../vehicles/components';
import { boardCrew } from '../vehicles/lifecycle';
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
 * The yard shuttle and its crew (#287: an away site on the player's ship). The shuttle is the trade courier's type, made beside the station
 * (its home), with the crew already aboard: they are the site's party from the start. The site (owner 'yard') docks the shuttle at the
 * player's airlock the order chose, lands the party suited (`outside`: their work is on the hull), takes nothing home (`noLoot`) and has
 * no seats to offer (`demand` none); the site's run flies it, brings tired or hurt contractors home to the station, and brings everyone home
 * when the order closes the site. Contractors are the station's people but neutral to everyone. Returns false when it cannot be made.
 */
export function launchShuttle(sim: Sim, o: YardOrder): boolean {
  const cd = courierDef(sim);
  const station = sim.world.get(o.station, ShipC);
  const spec = sim.content.yard?.crew;
  if (!cd || !station || !spec) return false;
  const vehicle = sim.world.createEntity();
  sim.world.add(vehicle, VehicleC, {
    def: cd.id, homeShip: o.station, home: 0, state: 'flying', hp: cd.def.maxHp, pilot: 0, passengers: [],
    dest: null, hover: o.station, dock: 0, cargo: [], autopilot: true,
  });
  sim.world.add(vehicle, BodyC, { x: station.x + station.width / 2, y: station.y + station.height / 2, heading: 0, alt: ALT.cruise });
  if (openSite(sim, o.ship, 'yard', vehicle) === 'noShuttle') {
    sim.world.destroyEntity(vehicle);
    return false;
  }
  reportLaunched(sim, vehicle, sim.world.get(vehicle, VehicleC) as Vehicle);
  Object.assign(sim.world.get(o.ship, AwaySiteC)!, { demand: {}, dock: o.airlock, outside: true, noLoot: true });
  const n = Math.min(spec.count, cd.def.eva?.suits ?? spec.count, cd.def.capacity + 1);
  for (let i = 0; i < n; i++) {
    const id = createCrew(sim, o.station, spec.role, { x: station.x, y: station.y }, { faction: 'neutral', rest: 100 });
    if (!id) continue;
    sim.world.add(id, PrioritiesC, builderPriorities());
    sim.world.add(id, YardCrewC, { order: o.id });
    boardCrew(sim, id, vehicle);
    sim.world.add(id, AwayC, { site: o.ship, vehicle, cat: 'construction' });
    o.crew.push(id);
  }
  o.vehicle = vehicle;
  if (o.crew.length === 0) {
    dismiss(sim, o);
    return false;
  }
  return true;
}

/** The order's site run, if its shuttle still serves the player's ship. */
export function yardRun(sim: Sim, o: YardOrder): SiteRun | undefined {
  const r = sim.world.get(o.vehicle, SiteRunC);
  return r?.site === o.ship ? r : undefined;
}

/** The order's crew and shuttle leave the world (home again, or lost with the order); the site's run ends with them. */
export function dismiss(sim: Sim, o: YardOrder): void {
  const r = yardRun(sim, o);
  if (r) endRun(sim, o.vehicle, r, 'closed');
  for (const id of o.crew) {
    if (sim.world.has(id, CrewC)) abortTask(sim, id, 'dismissed');
    sim.world.destroyEntity(id);
  }
  o.crew = [];
  if (o.vehicle) sim.world.destroyEntity(o.vehicle);
  o.vehicle = 0;
}
