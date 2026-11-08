import { abortTask } from '../ai/task';
import { ALT, BodyC } from '../body';
import { AwayC, AwaySiteC, SiteRunC } from '../away/components';
import { endRun } from '../away/end';
import { openSite } from '../away/handlers';
import { ShipC } from '../combat/components';
import { homeShip } from '../combat/ships';
import { grant, revoke } from '../consent/guests';
import { CrewC, PrioritiesC, WORK_CATEGORIES, type Priorities } from '../crew/components';
import { createCrew } from '../crew/spawn';
import type { Sim } from '../sim';
import { courierDef } from '../trade/courier';
import { VehicleC, type Vehicle } from '../vehicles/components';
import { boardCrew } from '../vehicles/lifecycle';
import { reportLaunched } from '../vehicles/transitions';
import { INSPECTOR_ROLE, INSPECTORS } from '../blackmarket/tuning';
import { destroyJob } from '../items/stacks';
import { partyJobs } from './search';
import { InspectionC, inspections, type Inspection } from './types';

/** Inspectors work their inspection's own jobs (patrol, the category nobody aboard the player's ship has work in) and nothing else. */
function inspectorPriorities(): Priorities {
  const p = Object.fromEntries(WORK_CATEGORIES.map((c) => [c, 0])) as unknown as Priorities;
  p.patrol = 1;
  return p;
}

/** The live inspection (any phase), if one is under way. */
export function liveInspection(sim: Sim): [number, Inspection] | undefined {
  for (const id of inspections(sim)) return [id, sim.world.get(id, InspectionC) as Inspection];
  return undefined;
}

/**
 * Send a station's inspectors to the player's ship (#138): the trade courier's type, made beside the station with the party aboard, serving an away
 * site on the player's ship (owner 'inspect'; nothing on it is the party's loot, they work inside). The run docks at a free airlock, else hovers and
 * the party goes out of the hatch in suits (EVA boarding). The inspectors are neutral, aboard by the station's leave (an 'inspect' grant, working).
 * False when it cannot be sent (no courier type, a site already open on the ship, no crew could be made).
 */
export function startInspection(sim: Sim, station: number, faction: string, name: string): boolean {
  const cd = courierDef(sim);
  const st = sim.world.get(station, ShipC);
  const ship = homeShip(sim);
  if (!cd || !st || !ship || sim.world.has(ship, AwaySiteC) || liveInspection(sim)) return false;
  const vehicle = sim.world.createEntity();
  sim.world.add(vehicle, VehicleC, {
    def: cd.id, homeShip: station, home: 0, state: 'flying', hp: cd.def.maxHp, pilot: 0, passengers: [],
    dest: null, hover: station, dock: 0, cargo: [], autopilot: true, outbound: true, // a sealed hold: what they seize is not unloaded aboard
  });
  sim.world.add(vehicle, BodyC, { x: st.x + st.width / 2, y: st.y + st.height / 2, heading: 0, alt: ALT.cruise });
  if (openSite(sim, ship, 'inspect', vehicle) === 'noShuttle') {
    sim.world.destroyEntity(vehicle);
    return false;
  }
  reportLaunched(sim, vehicle, sim.world.get(vehicle, VehicleC) as Vehicle);
  Object.assign(sim.world.get(ship, AwaySiteC)!, { demand: {}, noLoot: true });
  const crew: number[] = [];
  const n = Math.min(INSPECTORS, cd.def.eva?.suits ?? INSPECTORS, cd.def.capacity + 1);
  for (let i = 0; i < n; i++) {
    const id = createCrew(sim, station, INSPECTOR_ROLE, { x: st.x, y: st.y }, { faction: 'neutral', rest: 100 });
    if (!id) continue;
    sim.world.add(id, PrioritiesC, inspectorPriorities());
    boardCrew(sim, id, vehicle);
    sim.world.add(id, AwayC, { site: ship, vehicle, cat: 'patrol' });
    crew.push(id);
  }
  sim.world.add(vehicle, InspectionC, { station, ship, faction, name, phase: 'fly', timer: 0, crew, jobs: [], found: [], value: 0 });
  if (crew.length === 0) {
    endInspection(sim, vehicle);
    return false;
  }
  grant(sim, ship, { by: 'inspect', faction: 'neutral', site: ship, crew: [...crew], from: station, work: true });
  sim.events.emit({ type: 'inspect.started', inspection: vehicle, faction, name, crew: [...crew] });
  return true;
}

/** The inspection is over for good: its run ends, its people and its shuttle (with what it seized) leave the world, the leave to be aboard goes. */
export function endInspection(sim: Sim, vehicle: number): void {
  const insp = sim.world.get(vehicle, InspectionC);
  const r = sim.world.get(vehicle, SiteRunC);
  if (r) endRun(sim, vehicle, r, 'closed');
  for (const id of insp?.crew ?? []) {
    if (sim.world.has(id, CrewC)) abortTask(sim, id, 'dismissed');
    sim.world.destroyEntity(id);
  }
  if (insp) revoke(sim, insp.ship, 'inspect', { site: insp.ship });
  sim.world.destroyEntity(vehicle);
}

export function go(insp: Inspection, phase: Inspection['phase']): void {
  insp.phase = phase;
  insp.timer = 0;
  delete insp.blocked;
}

/** The inspectors are done here: their jobs go, the site closes (its run calls them aboard and flies them home), and `outcome` is how it ended. */
export function leave(sim: Sim, vehicle: number, insp: Inspection, outcome: NonNullable<Inspection['outcome']>): void {
  for (const id of partyJobs(sim, vehicle)) destroyJob(sim, id);
  insp.jobs = [];
  insp.outcome = outcome;
  const site = sim.world.get(insp.ship, AwaySiteC);
  if (site?.vehicle === vehicle) site.status = 'closing';
  go(insp, 'leave');
}

