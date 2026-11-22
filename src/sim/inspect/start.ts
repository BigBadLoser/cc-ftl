import { abortTask } from '../ai/task';
import { AwayC, AwaySiteC, SiteRunC } from '../away/components';
import { endRun } from '../away/end';
import { openSite } from '../away/handlers';
import { ShipC } from '../combat/components';
import { homeShip } from '../combat/shipQuery';
import { grant, revoke } from '../consent/guests';
import { CrewC, PrioritiesC, WORK_CATEGORIES, type Priorities } from '../crew/components';
import { createCrew } from '../crew/spawn';
import type { Sim } from '../sim';
import { freeShuttle, sendHome } from '../trade/courier';
import { addStock } from '../trade/deals';
import { TraderC } from '../trade/types';
import { VehicleC, type Vehicle } from '../vehicles/components';
import { boardCrew, vehicleDefOf } from '../vehicles/lifecycle';
import { reportLaunched } from '../vehicles/transitions';
import { ALT, BodyC } from '../body';
import { INSPECTOR_ROLE, INSPECTORS } from '../blackmarket/tuning';
import { destroyJob } from '../crew/jobEnd';
import { partyJobs } from './search';
import { InspectionC, inspections, playerInspections, type Inspection } from './types';

/** Inspectors work their inspection's own jobs (patrol, the category nobody aboard the player's ship has work in) and nothing else. */
function inspectorPriorities(): Priorities {
  const p = Object.fromEntries(WORK_CATEGORIES.map((c) => [c, 0])) as unknown as Priorities;
  p.patrol = 1;
  return p;
}

/** The player's live inspection (any phase), if one is under way (an NPC ship's inspection is not the player's: `playerInspections`). */
export function liveInspection(sim: Sim): [number, Inspection] | undefined {
  for (const id of playerInspections(sim)) return [id, sim.world.get(id, InspectionC) as Inspection];
  return undefined;
}

/**
 * Send a station's inspectors to the player's ship (#138): its own shuttle (a real one, stowed in its hangar or on its pad and free: trade/courier.ts
 * `freeShuttle`, #548) with the party aboard, serving an away site on the player's ship (owner 'inspect'; nothing on it is the party's loot, they
 * work inside). The run launches it, docks at a free airlock, else hovers and the party goes out of the hatch in suits (EVA boarding). The inspectors
 * are neutral, aboard by the station's leave (an 'inspect' grant, working). A patrol sends theirs the same way from its ship. False when it cannot
 * be sent (no shuttle free, a site already open on the ship, no crew could be made). `target` is the ship inspected: the player's by default, or an NPC
 * ship (#603: a patrol inspecting a trader in the player's node; `Inspection.npc`), one inspection a ship at a time.
 */
export function startInspection(sim: Sim, station: number, faction: string, name: string, target?: number): boolean {
  const free = freeShuttle(sim, station);
  const st = sim.world.get(station, ShipC);
  const ship = target ?? homeShip(sim);
  const npc = target !== undefined && target !== homeShip(sim);
  if (!st || !ship || sim.world.has(ship, AwaySiteC) || (npc ? inspections(sim).some((id) => sim.world.get(id, InspectionC)?.ship === ship) : liveInspection(sim))) return false;
  if ('error' in free && free.error === 'courierBusy') return false; // its shuttle is out on another job: later
  const vehicle = 'error' in free ? standIn(sim, station) : free.vehicle;
  if (!vehicle) return false;
  if (openSite(sim, ship, 'inspect', vehicle) === 'noShuttle') {
    if ('error' in free) sim.world.destroyEntity(vehicle);
    return false;
  }
  const v = sim.world.get(vehicle, VehicleC) as Vehicle;
  if ('error' in free) reportLaunched(sim, vehicle, v);
  v.autopilot = true;
  v.outbound = true; // a sealed hold: what they seize is not unloaded aboard
  Object.assign(sim.world.get(ship, AwaySiteC)!, { demand: {}, noLoot: true });
  const crew: number[] = [];
  const n = Math.min(INSPECTORS, (vehicleDefOf(sim, v)?.capacity ?? 0) + 1);
  for (let i = 0; i < n; i++) {
    const id = createCrew(sim, station, INSPECTOR_ROLE, { x: st.x, y: st.y }, { faction: 'neutral', rest: 100 });
    if (!id) continue;
    sim.world.add(id, PrioritiesC, inspectorPriorities());
    boardCrew(sim, id, vehicle);
    sim.world.add(id, AwayC, { site: ship, vehicle, cat: 'patrol' });
    crew.push(id);
  }
  sim.world.add(vehicle, InspectionC, { station, ship, faction, name, phase: 'fly', timer: 0, crew, jobs: [], found: [], value: 0, ...('error' in free ? { standIn: true as const } : {}), ...(npc ? { npc: true as const } : {}) });
  if (crew.length === 0) {
    endInspection(sim, vehicle);
    return false;
  }
  grant(sim, ship, { by: 'inspect', faction: 'neutral', site: ship, crew: [...crew], from: station, work: true });
  if (!npc) sim.events.emit({ type: 'inspect.started', inspection: vehicle, faction, name, crew: [...crew] });
  return true;
}

/**
 * The inspection is over for good: its run ends, its people leave the world, the leave to be aboard goes, and its shuttle goes back to being the
 * station's (what it seized goes into the station's stock) and flies home if it is not there yet.
 */
export function endInspection(sim: Sim, vehicle: number): void {
  const insp = sim.world.get(vehicle, InspectionC);
  const r = sim.world.get(vehicle, SiteRunC);
  if (r) endRun(sim, vehicle, r, 'closed');
  for (const id of insp?.crew ?? []) {
    if (sim.world.has(id, CrewC)) abortTask(sim, id, 'dismissed');
    sim.world.destroyEntity(id);
  }
  if (insp) revoke(sim, insp.ship, 'inspect', { site: insp.ship });
  if (!insp || insp.standIn) return void sim.world.destroyEntity(vehicle);
  sim.world.remove(vehicle, InspectionC);
  const v = sim.world.get(vehicle, VehicleC);
  if (!v) return;
  const trader = sim.world.get(v.homeShip, TraderC);
  if (trader) for (const q of v.cargo) addStock(trader.stock, q.item, q.count);
  v.cargo = [];
  sendHome(sim, vehicle);
}

/**
 * A shuttle made beside a ship that has none of its own to send its inspectors in (a patrol corvette). Temporary: #551 gives such ships a hangar
 * at generation, and then this goes: the first cargo shuttle type, flying beside the ship. 0 when the content has none.
 */
function standIn(sim: Sim, ship: number): number {
  const s = sim.world.get(ship, ShipC);
  const id = Object.keys(sim.content.vehicles ?? {}).sort().find((k) => sim.content.vehicles?.[k]?.class === 'shuttle' && (sim.content.vehicles[k]?.cargo ?? 0) > 0);
  const def = id ? sim.content.vehicles?.[id] : undefined;
  if (!s || !id || !def) return 0;
  const vehicle = sim.world.createEntity();
  sim.world.add(vehicle, VehicleC, {
    def: id, homeShip: ship, home: 0, state: 'flying', hp: def.maxHp, pilot: 0, passengers: [], dest: null, hover: ship, dock: 0, cargo: [],
  });
  sim.world.add(vehicle, BodyC, { x: s.x + s.width / 2, y: s.y + s.height / 2, heading: 0, alt: ALT.cruise });
  return vehicle;
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

