import { AirlockC } from '../modules/airlock';
import { ModuleC } from '../modules/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { AIRLOCK_AIR_REFILL_SEC, VEHICLE_AIR_DOCK_FILL_SEC } from '../tuning';
import { shipById } from '../combat/ships';
import { VehicleC } from '../vehicles/components';
import { airlockAir, airlockAirCap, shipHasLifeSupport, vehicleAir, vehicleAirCap } from '../eva/air';
import { suitDef } from '../eva/suit';
import { freeAirlockStore } from '../eva/airLedger';

/**
 * Air store upkeep, once a second (docs/ARCHITECTURE.md "Air stores").
 * - An airlock on a ship with working life support refills one tank per AIRLOCK_AIR_REFILL_SEC; on a derelict it never does.
 * - A shuttle stowed in its bay is topped up to full; one docked at an airlock draws the shortfall from that airlock's store (a store with
 *   no tank to spare gives what it has, and it only ever gives what it has, never air held for a crew member: the air ledger).
 */
export function airStoresSystem(sim: Sim): void {
  if (sim.tick % TICK_HZ !== 0) return;
  const tank = suitDef(sim).airSec;
  const lifeSupport = new Map<number, boolean>();
  for (const id of sim.world.query(AirlockC, ModuleC)) {
    const cap = airlockAirCap(sim, id);
    const have = airlockAir(sim, id);
    if (have >= cap) continue;
    const ship = shipIdOf(sim, sim.world.get(id, ModuleC)!);
    let ok = lifeSupport.get(ship);
    if (ok === undefined) lifeSupport.set(ship, (ok = shipHasLifeSupport(sim, ship)));
    const a = sim.world.get(id, AirlockC)!;
    a.air = ok ? Math.min(cap, have + tank / AIRLOCK_AIR_REFILL_SEC) : have;
  }
  for (const id of sim.world.query(VehicleC)) {
    const v = sim.world.get(id, VehicleC)!;
    const cap = vehicleAirCap(sim, v);
    const have = vehicleAir(sim, v);
    if (have >= cap) continue;
    if (v.state === 'stowed') v.air = cap;
    else if (v.state === 'docked' && v.dock && shipById(sim, shipIdOf(sim, sim.world.get(v.dock, ModuleC)))?.faction === 'player') {
      const lock = sim.world.get(v.dock, AirlockC);
      const give = Math.min(cap - have, freeAirlockStore(sim, v.dock), tank / VEHICLE_AIR_DOCK_FILL_SEC); // never air held for a crew member
      if (lock && give > 0) {
        lock.air = airlockAir(sim, v.dock) - give;
        v.air = have + give;
      }
    }
  }
}
