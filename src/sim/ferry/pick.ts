import { ShipC } from '../combat/components';
import { shipById } from '../combat/ships';
import { ItemStackC, StorageC } from '../items/components';
import { AirlockC, airlockWorking } from '../modules/airlock';
import { ModuleC } from '../modules/components';
import { boardingReserved } from '../boarding/reserve';
import { isLive } from '../trade/deals';
import { shipIdAt, shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { dockError } from '../vehicles/handlers';
import { VehicleBayC, VehicleC } from '../vehicles/components';
import { vehicleDefOf } from '../vehicles/lifecycle';
import { MiningPodC } from '../mining/components';
import { outsideCrew } from '../eva/shuttle';
import { FerryC } from './components';

/** True for a player region a run can start or end at: the home ship or a claimed base. */
export function isFerryRegion(sim: Sim, ship: number): boolean {
  const s = sim.world.get(ship, ShipC);
  return !!s && s.faction === 'player' && (s.state === 'active' || s.state === 'disabled');
}

/**
 * True for a region a run can load from: a ferry region, or a salvage site (a captured prize or a ruined derelict), whose
 * loose stacks and storage the crew there can haul and a hovering shuttle can swap.
 */
export function isPickupRegion(sim: Sim, ship: number): boolean {
  const s = sim.world.get(ship, ShipC);
  return isFerryRegion(sim, ship) || (!!s && (s.state === 'prize' || (s.state === 'wreck' && !!s.ruin)));
}

/** Units of every item in a region's storage modules and loose on its floor, ascending by item id. */
export function regionStock(sim: Sim, ship: number): { item: string; count: number }[] {
  const totals = new Map<string, number>();
  for (const id of sim.world.query(StorageC, ModuleC)) {
    if (shipIdOf(sim, sim.world.get(id, ModuleC)) !== ship) continue;
    for (const st of sim.world.get(id, StorageC)?.stacks ?? []) totals.set(st.item, (totals.get(st.item) ?? 0) + st.count);
  }
  for (const id of sim.world.query(ItemStackC)) {
    const st = sim.world.get(id, ItemStackC);
    if (st && !st.job && shipIdAt(sim, st.x, st.y) === ship) totals.set(st.item, (totals.get(st.item) ?? 0) + st.count);
  }
  return [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([item, count]) => ({ item, count }));
}

/** Units of an item in a region's storage modules and loose on its floor. */
export function regionItems(sim: Sim, ship: number, item: string): number {
  return regionStock(sim, ship).find((l) => l.item === item)?.count ?? 0;
}

/** A free, working airlock of a region this shuttle may dock at (the one it is docked at first), or 0. */
export function regionAirlock(sim: Sim, ship: number, vehicle: number): number {
  const ids = [...sim.world.query(AirlockC, ModuleC)]
    .filter((id) => shipIdOf(sim, sim.world.get(id, ModuleC)) === ship && airlockWorking(sim, id))
    .sort((a, b) => a - b);
  return ids.find((id) => dockError(sim, vehicle, id) === null) ?? 0;
}

/**
 * How a shuttle reaches a region: 'dock' when it has a free working airlock, 'hover' when it has none but is not the shuttle's
 * home ship (suited crew and instant swaps, as for a base with no airlock), else null (a ship with no working airlock cannot be
 * hovered at by its own shuttle).
 */
export function ferryMode(sim: Sim, ship: number, vehicle: number): 'dock' | 'hover' | null {
  if (regionAirlock(sim, ship, vehicle)) return 'dock';
  const v = sim.world.get(vehicle, VehicleC);
  return v && v.homeShip !== ship && vehicleDefOf(sim, v)?.eva ? 'hover' : null;
}

/** True if a shuttle is free for a new run: not a pod, not on a trade run, another run or a boarding, nobody of it out on EVA. */
export function ferryFree(sim: Sim, vehicle: number): boolean {
  const v = sim.world.get(vehicle, VehicleC);
  const def = v && vehicleDefOf(sim, v);
  if (!v || !def || def.class === 'pod' || (def.cargo ?? 0) <= 0) return false;
  if (!isFerryRegion(sim, v.homeShip) || sim.world.has(vehicle, FerryC) || sim.world.has(vehicle, MiningPodC) || boardingReserved(sim, vehicle)) return false;
  if (sim.trade.deals.some((d) => d.vehicle === vehicle && isLive(d)) || v.outbound) return false;
  if (outsideCrew(sim, vehicle).length > 0) return false;
  return !v.home || v.state !== 'stowed' || (sim.world.has(v.home, VehicleBayC) && !!sim.world.get(v.home, ModuleC) && (sim.world.get(v.home, ModuleC)?.hp ?? 0) > 0);
}

/** The shuttle a "go to base" order uses when none is named: a stowed free one first, then the lowest id. */
export function pickFerryShuttle(sim: Sim): number {
  const free = [...sim.world.query(VehicleC)].filter((id) => ferryFree(sim, id)).sort((a, b) => a - b);
  return free.find((id) => sim.world.get(id, VehicleC)?.state === 'stowed') ?? free[0] ?? 0;
}

/** Player regions in the sector a run can go between, ascending id. */
export function ferryRegions(sim: Sim): number[] {
  return [...sim.world.query(ShipC)].filter((id) => isFerryRegion(sim, id) && !!shipById(sim, id)).sort((a, b) => a - b);
}
