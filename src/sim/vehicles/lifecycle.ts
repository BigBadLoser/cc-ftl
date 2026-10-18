import { shipOf } from '../combat/ships';
import { releaseBedClaim } from '../crew/beds';
import {
  CarriedC, CrewC, DeadC, DownedC, DraftedC, HealthC, PathC, PositionC, type Crew,
} from '../crew/components';
import { killCrew } from '../crew/death';
import { releaseAssignment } from '../crew/helpers';
import { spillItems } from '../items/stacks';
import { ModuleC } from '../modules/components';
import { CrossingC } from '../portals/components';
import type { VehicleDef } from '../registry';
import type { Sim } from '../sim';
import { stat } from '../stats';
import { BLEED_OUT_SECONDS, SKILL_STEP } from '../tuning';
import { TICK_HZ } from '../time';
import { AboardC, EmbarkOrderC, VehicleBayC, VehicleC, type Vehicle } from './components';
import { bayCenter, boardingTile, dockPoint } from './geometry';

/** The content def of a vehicle entity, or undefined. */
export function vehicleDefOf(sim: Sim, v: Vehicle): VehicleDef | undefined {
  return sim.content.vehicles?.[v.def];
}

/** Everyone aboard: the pilot (if any) then the passengers. */
export function occupants(v: Vehicle): number[] {
  return v.pilot ? [v.pilot, ...v.passengers] : [...v.passengers];
}

/** Faction of the ship a vehicle belongs to. */
export function vehicleFaction(sim: Sim, v: Vehicle): string {
  return shipOf(sim, v.homeGrid)?.faction ?? 'neutral';
}

/** Sector tiles per tick: content speed, faster with the pilot's piloting skill (stat resolver). */
export function vehicleSpeedPerTick(sim: Sim, v: Vehicle): number {
  const def = vehicleDefOf(sim, v);
  if (!def) return 0;
  const skill = v.pilot ? stat(sim, v.pilot, 'piloting') : 0;
  return (def.speed * (1 + SKILL_STEP * skill)) / TICK_HZ;
}

/** Create a stowed vehicle in a bay (assumes the bay is empty). Returns the entity. */
export function spawnVehicle(sim: Sim, defId: string, bay: number): number {
  const def = sim.content.vehicles?.[defId];
  const bm = sim.world.get(bay, VehicleBayC);
  const c = bayCenter(sim, bay) ?? { x: 0, y: 0 }; // the ship entity may not exist yet at game start; the vehicle system re-syncs it
  const mod = sim.world.get(bay, ModuleC);
  if (!def || !bm || !mod || sim.content.modules[mod.def]?.vehicleBay?.class !== def.class) throw new Error(`spawnVehicle: bad def "${defId}" or bay ${bay}`);
  const id = sim.world.createEntity();
  sim.world.add(id, VehicleC, {
    def: defId, homeGrid: mod.gridId, home: bay, state: 'stowed', x: c.x, y: c.y, heading: 0, hp: def.maxHp,
    pilot: 0, passengers: [], dest: null, dock: 0,
  });
  bm.vehicle = id;
  return id;
}

/** Hide a crew member aboard a vehicle: off the grid, out of every job and route. The first aboard is the pilot. */
export function boardCrew(sim: Sim, crew: number, vehicle: number): 'pilot' | 'passenger' {
  const v = sim.world.get(vehicle, VehicleC) as Vehicle;
  releaseAssignment(sim, crew);
  releaseBedClaim(sim, crew);
  for (const key of [EmbarkOrderC, DraftedC, PositionC, PathC, CrossingC, CarriedC]) sim.world.remove(crew, key);
  sim.world.add(crew, AboardC, { vehicle });
  (sim.world.get(crew, CrewC) as Crew).activity = 'idle';
  const role = v.pilot === 0 ? 'pilot' : 'passenger';
  if (role === 'pilot') v.pilot = crew;
  else v.passengers.push(crew);
  sim.events.emit({ type: 'crew.embarked', crew, vehicle, role });
  return role;
}

/**
 * Put a crew member back on a grid tile. Crew landing on a ship of another faction than their vehicle's are drafted
 * (they stand where they land until ordered), so enemy boarders do not wander off to do the defenders' chores.
 */
export function unboardCrew(sim: Sim, crew: number, vehicle: number, at: { gridId: number; x: number; y: number }): void {
  const v = sim.world.get(vehicle, VehicleC) as Vehicle;
  if (v.pilot === crew) v.pilot = 0;
  v.passengers = v.passengers.filter((c) => c !== crew);
  sim.world.remove(crew, AboardC);
  sim.world.add(crew, PositionC, { gridId: at.gridId, x: at.x, y: at.y, toX: at.x, toY: at.y, progress: 0, facing: 0 });
  sim.world.add(crew, PathC, { steps: [] });
  const intruder = shipOf(sim, at.gridId)?.faction !== vehicleFaction(sim, v);
  if (intruder) sim.world.add(crew, DraftedC, { target: null });
  (sim.world.get(crew, CrewC) as Crew).activity = intruder ? 'drafted' : 'idle';
  sim.events.emit({ type: 'crew.disembarked', crew, vehicle, gridId: at.gridId, x: at.x, y: at.y });
}

/**
 * Destroy a vehicle. Outcome for those aboard: shot down in flight, they all die (no grid to land on, vacuum outside).
 * Destroyed while docked, they are thrown into the airlock's inside tile downed (0 hp, bleeding out, rescuable).
 */
export function destroyVehicle(sim: Sim, id: number): void {
  const v = sim.world.get(id, VehicleC);
  if (!v) return;
  const dock = v.state === 'docked' ? boardingTile(sim, id) : null;
  for (const crew of occupants(v)) {
    if (dock) {
      unboardCrew(sim, crew, id, dock);
      downCrew(sim, crew);
    } else {
      sim.world.remove(crew, AboardC);
      killCrew(sim, crew);
    }
  }
  const bay = sim.world.get(v.home, VehicleBayC);
  if (bay && bay.vehicle === id) bay.vehicle = 0;
  sim.events.emit({ type: 'vehicle.destroyed', vehicle: id, state: v.state, x: v.x, y: v.y });
  sim.world.destroyEntity(id);
}

function downCrew(sim: Sim, crew: number): void {
  if (sim.world.has(crew, DeadC) || sim.world.has(crew, DownedC)) return;
  const hp = sim.world.get(crew, HealthC);
  if (hp) hp.hp = 0;
  sim.world.remove(crew, DraftedC);
  sim.world.add(crew, DownedC, { bleed: BLEED_OUT_SECONDS, stabilized: false, bed: 0 });
  (sim.world.get(crew, CrewC) as Crew).activity = 'downed';
  sim.events.emit({ type: 'crew.downed', crew });
}

/** Apply damage to a vehicle; destroys it at 0 hp. */
export function damageVehicle(sim: Sim, id: number, amount: number, source: 'weapon' | 'pointDefence'): void {
  const v = sim.world.get(id, VehicleC);
  if (!v || amount <= 0) return;
  v.hp = Math.max(0, v.hp - amount);
  sim.events.emit({ type: 'vehicle.damaged', vehicle: id, amount, hp: v.hp, source });
  if (v.hp <= 0) destroyVehicle(sim, id);
}

/** A stowed vehicle whose bay was destroyed is lost with the hangar; those aboard die with it. */
export function vehicleLostWithBay(sim: Sim, id: number): void {
  const v = sim.world.get(id, VehicleC);
  if (v?.state !== 'stowed') return;
  destroyVehicle(sim, id);
}

/** Drop the hangar's shuttle when a bay module is removed (deconstructed): crew step out, the shuttle becomes an item. */
export function releaseBayVehicle(sim: Sim, bay: number, gridId: number, x: number, y: number): void {
  const b = sim.world.get(bay, VehicleBayC);
  const v = b && sim.world.get(b.vehicle, VehicleC);
  if (!b || !v) return;
  if (v.state === 'stowed') {
    const at = boardingTile(sim, b.vehicle);
    for (const crew of occupants(v)) if (at) unboardCrew(sim, crew, b.vehicle, at);
    const item = Object.entries(sim.content.items).find(([, d]) => d.vehicle === v.def)?.[0];
    if (item) spillItems(sim, gridId, x, y, item, 1);
    sim.world.destroyEntity(b.vehicle);
  } else {
    v.home = 0;
    if (v.dest?.type === 'bay') v.dest = null;
  }
  b.vehicle = 0;
}

/** Fly-to point of a destination, or null if it is gone. */
export function destPoint(sim: Sim, v: Vehicle): { x: number; y: number } | null {
  if (v.dest?.type === 'dock') return dockPoint(sim, v.dest.airlock);
  if (v.dest?.type === 'bay') return bayCenter(sim, v.home);
  return null;
}

/** Leave a dock: the vehicle hovers at the dock point. */
export function undock(sim: Sim, id: number, v: Vehicle): void {
  const airlock = v.dock;
  const gridId = sim.world.get(airlock, ModuleC)?.gridId ?? 0;
  v.state = 'flying';
  v.dock = 0;
  v.dest = null;
  sim.events.emit({ type: 'vehicle.undocked', vehicle: id, gridId, airlock });
}

