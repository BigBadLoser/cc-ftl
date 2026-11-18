import { abortTask } from '../ai/task';
import { AwayC, AwaySiteC, SiteRunC, type SiteRun } from '../away/components';
import { endRun } from '../away/end';
import { openSite } from '../away/handlers';
import { ShipC } from '../combat/components';
import { CrewC, DeadC, PrioritiesC, WORK_CATEGORIES, type Priorities } from '../crew/components';
import { createCrew } from '../crew/spawn';
import type { Sim } from '../sim';
import { freeShuttle, sendHome } from '../trade/courier';
import { VehicleC, type Vehicle } from '../vehicles/components';
import { boardCrew, vehicleDefOf } from '../vehicles/lifecycle';
import { YardCrewC, type YardOrder } from './types';
import { grant, revoke } from '../consent/guests';

/** Station crew who build for the player work construction and nothing else. */
function builderPriorities(): Priorities {
  const p = Object.fromEntries(WORK_CATEGORIES.map((c) => [c, 0])) as unknown as Priorities;
  p.construction = 1;
  return p;
}

/** True for a yard crew member who is alive. */
export const alive = (sim: Sim, id: number): boolean => sim.world.has(id, CrewC) && !sim.world.has(id, DeadC);

/**
 * The yard shuttle and its crew (#287: an away site on the player's ship). The shuttle is the station's own (a real one, stowed in its hangar or
 * on its pad and free: trade/courier.ts `freeShuttle`, #548), with the crew already aboard: they are the site's party from the start. The site (owner 'yard') docks the shuttle at the
 * player's airlock the order chose, lands the party suited (`outside`: their work is on the hull), takes nothing home (`noLoot`) and has
 * no seats to offer (`demand` none); the site's run flies it, brings tired or hurt contractors home to the station, and brings everyone home
 * when the order closes the site. Contractors are the station's people but neutral to everyone, aboard the player's ship by its leave (a 'yard'
 * consent grant for the site's party and the named crew, working; revoked in `dismiss`). 'busy' while the station's shuttle is out on another job;
 * 'none' when it cannot be sent at all.
 */
export function launchShuttle(sim: Sim, o: YardOrder): 'ok' | 'busy' | 'none' {
  const free = freeShuttle(sim, o.station);
  const station = sim.world.get(o.station, ShipC);
  const spec = sim.content.yard?.crew;
  if ('error' in free) return free.error === 'courierBusy' ? 'busy' : 'none';
  if (!station || !spec) return 'none';
  const vehicle = free.vehicle;
  if (openSite(sim, o.ship, 'yard', vehicle) === 'noShuttle') return 'none';
  const v = sim.world.get(vehicle, VehicleC) as Vehicle;
  v.autopilot = true;
  Object.assign(sim.world.get(o.ship, AwaySiteC)!, { demand: {}, dock: o.airlock, outside: true, noLoot: true });
  const n = Math.min(spec.count, (vehicleDefOf(sim, v)?.capacity ?? 0) + 1);
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
    return 'none';
  }
  grant(sim, o.ship, { by: 'yard', faction: 'neutral', site: o.ship, crew: [...o.crew], from: o.station, work: true });
  return 'ok';
}

/** The order's site run, if its shuttle still serves the player's ship. */
export function yardRun(sim: Sim, o: YardOrder): SiteRun | undefined {
  const r = sim.world.get(o.vehicle, SiteRunC);
  return r?.site === o.ship ? r : undefined;
}

/** The order's crew leave the world (home again, or lost with the order) and the station's shuttle is its own again (flying home if it is out); the site's run ends with them. */
export function dismiss(sim: Sim, o: YardOrder): void {
  const r = yardRun(sim, o);
  if (r) endRun(sim, o.vehicle, r, 'closed');
  for (const id of o.crew) {
    if (sim.world.has(id, CrewC)) abortTask(sim, id, 'dismissed');
    sim.world.destroyEntity(id);
  }
  o.crew = [];
  revoke(sim, o.ship, 'yard', { site: o.ship });
  if (o.vehicle) sendHome(sim, o.vehicle);
  o.vehicle = 0;
}
