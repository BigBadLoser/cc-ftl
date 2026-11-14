import { ShipC } from '../combat/components';
import { makeHaul } from '../items/plan';
import { nearestSource, nearestStorageFor, refKey, reservations } from '../items/stock';
import { storageAdd } from '../items/storage';
import { AirlockC, airlockWorking } from '../modules/airlock';
import { ModuleC } from '../modules/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { DEFAULT_CARRY_CAPACITY, PLAN_INTERVAL } from '../tuning';
import { cargoAdd, cargoOf, cargoTake } from '../vehicles/cargo';
import { VehicleC, type Vehicle } from '../vehicles/components';
import { cargoTile } from '../vehicles/geometry';
import { dockError } from '../vehicles/handlers';
import { addStock, touchMarket } from './deals';
import { unitsOf } from './dockCount';
import { dockDone, deliverGiven, reclaim, startUnits } from './dockLedger';
import { TraderC, type Deal } from './types';

/**
 * Docking trade at a station (an immobile trader ship): the player's shuttle docks at a free station airlock (the dock
 * order reserves it: no other shuttle may dock there), the station's own crew haul the goods between the station's
 * storage and the docked shuttle in both directions, then it undocks and flies home. The goods the player buys are staged
 * from the trader's stock into the station storage nearest the airlock when the shuttle docks; what the player sells
 * goes into station storage and from there into the trader's stock. If no station airlock is free and working the run
 * falls back to the hover swap (`Deal.via = 'hover'`).
 */

/** A free, working airlock on the station that this shuttle may dock at, or 0. */
export function stationAirlock(sim: Sim, station: number, vehicle: number): number {
  const ids = [...sim.world.query(AirlockC, ModuleC)]
    .filter((id) => shipIdOf(sim, sim.world.get(id, ModuleC)) === station && airlockWorking(sim, id))
    .sort((a, b) => a - b);
  return ids.find((id) => dockError(sim, vehicle, id) === null) ?? 0;
}

export const isStation = (sim: Sim, ship: number): boolean => sim.world.get(ship, ShipC)?.immobile === true;

/** Stage the goods the player buys into station storage near the airlock (from the trader's set-aside stock). */
export function stageGoods(sim: Sim, d: Deal): void {
  const dock = d.dock;
  if (!dock || dock.staged.length > 0) return;
  startUnits(sim, d);
  const stand = cargoTile(sim, d.vehicle);
  const res = reservations(sim);
  for (const l of d.get) {
    let left = l.count;
    for (let guard = 0; left > 0 && guard < 50; guard++) {
      const s = stand && nearestStorageFor(sim, d.ship, l.item, stand, res);
      if (!s || s.ref.kind !== 'storage') break;
      const n = storageAdd(sim, s.ref.id, l.item, left);
      if (n <= 0) break;
      left -= n;
      dock.staged.push({ storage: s.ref.id, item: l.item, count: n });
      unitsOf(d, l.item).shelf += n;
    }
    // No room in station storage: the rest goes straight into the hold (a crate on the dock).
    if (left > 0) {
      unitsOf(d, l.item).hold += cargoAdd(sim, d.vehicle, l.item, left); // what the hold took, not what was meant for it
    }
  }
}

/**
 * One planning round of station crew hauling: the player's goods out of the shuttle into station storage, the bought
 * goods from station storage into the shuttle. True when both directions are complete.
 */
export function stationWork(sim: Sim, d: Deal, v: Vehicle): boolean {
  const res = reservations(sim);
  const stand = cargoTile(sim, d.vehicle);
  if (dockDone(sim, d)) return true;
  if (sim.tick % PLAN_INTERVAL !== 0 || v.state !== 'docked' || !stand) return false;
  for (const l of d.give) {
    if (d.get.some((g) => g.item === l.item)) continue;
    const avail = cargoOf(sim, d.vehicle, l.item) - (res.out.get(refKey('vehicle', d.vehicle, l.item)) ?? 0);
    if (avail <= 0) continue;
    const dest = nearestStorageFor(sim, d.ship, l.item, stand, res);
    if (!dest) continue;
    const src = { ref: { kind: 'vehicle' as const, id: d.vehicle }, x: stand.x, y: stand.y, avail };
    makeHaul(sim, res, 'hauling', d.ship, src, dest.ref, l.item, Math.min(avail, dest.room, DEFAULT_CARRY_CAPACITY), [], [], { id: d.id, dir: 'give' });
  }
  for (const l of d.get) {
    let need = l.count - cargoOf(sim, d.vehicle, l.item) - (res.incoming.get(refKey('vehicle', d.vehicle, l.item)) ?? 0);
    for (let guard = 0; need > 0 && guard < 20; guard++) {
      const s = nearestSource(sim, d.ship, l.item, stand, res);
      if (!s) break;
      const n = Math.min(need, s.avail, DEFAULT_CARRY_CAPACITY);
      makeHaul(sim, res, 'hauling', d.ship, s, { kind: 'vehicle', id: d.vehicle }, l.item, n, [], [], { id: d.id, dir: 'get' });
      need -= n;
    }
  }
  return false;
}

/** The player's goods now in station storage go into the trader's stock (the station has them now). */
export function takeDelivery(sim: Sim, d: Deal): void {
  const trader = sim.world.get(d.ship, TraderC);
  if (!trader) return;
  for (const l of d.give) if (d.get.some((g) => g.item === l.item)) addStock(trader.stock, l.item, cargoTake(sim, d.vehicle, l.item, l.count));
  for (const q of deliverGiven(sim, d)) addStock(trader.stock, q.item, q.count);
  touchMarket(sim, trader);
}

/**
 * Undo the station side of a run that is called off at the station: haul jobs for the shuttle are dropped, the bought
 * goods come back out of the hold and the staging storage (the trader gets them back with the deal's refund), and the
 * player's goods the station crew already carried in go back into the hold.
 */
export function unwindStation(sim: Sim, d: Deal): void {
  if (!d.dock) return;
  reclaim(sim, d);
  const v = sim.world.get(d.vehicle, VehicleC);
  if (v?.state === 'docked') sim.enqueue({ type: 'vehicle.undock', vehicle: d.vehicle });
}
