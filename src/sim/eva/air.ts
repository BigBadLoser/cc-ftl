import { CrewC } from '../crew/components';
import { traitMult } from '../crew/traits';
import { shipById } from '../combat/ships';
import { ModuleC } from '../modules/components';
import { AirlockC } from '../modules/airlock';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { AIRLOCK_AIR_TANKS, VEHICLE_AIR_TANKS } from '../tuning';
import { VehicleC, type Vehicle } from '../vehicles/components';
import { vehicleDefOf } from '../vehicles/lifecycle';
import { suitDef } from './suit';

/**
 * Air stores (docs/ARCHITECTURE.md "Air stores", #286 slice 0). An airlock and a shuttle each hold a finite store of breathing air in seconds of
 * suit time, drawn from when a crew member refills a tank there. The airlock's refills slowly on a ship with working life support and never on
 * a derelict (`systems/airStores.ts`); the shuttle's is topped up in its bay or while docked at an airlock with air in its store. A store
 * field that is absent (an old save, a freshly built module) reads as full. What a source can give and the refill are the air ledger's
 * (`eva/airLedger.ts`).
 */

/** The airlock module's capacity in seconds: its def's `airStore`, else AIRLOCK_AIR_TANKS tanks. */
export function airlockAirCap(sim: Sim, airlock: number): number {
  const m = sim.world.get(airlock, ModuleC);
  return (m && sim.content.modules[m.def]?.airlock?.airStore) ?? AIRLOCK_AIR_TANKS * suitDef(sim).airSec;
}

/** Seconds of air in an airlock's store. */
export function airlockAir(sim: Sim, airlock: number): number {
  const a = sim.world.get(airlock, AirlockC);
  return a ? Math.min(a.air ?? airlockAirCap(sim, airlock), airlockAirCap(sim, airlock)) : 0;
}

/** A shuttle's capacity in seconds: its def's `eva.airStore`, else VEHICLE_AIR_TANKS tanks. */
export function vehicleAirCap(sim: Sim, v: Vehicle): number {
  return vehicleDefOf(sim, v)?.eva?.airStore ?? VEHICLE_AIR_TANKS * suitDef(sim).airSec;
}

/** Seconds of air in a shuttle's store (0 for a def with no EVA). */
export function vehicleAir(sim: Sim, v: Vehicle): number {
  return vehicleDefOf(sim, v)?.eva ? Math.min(v.air ?? vehicleAirCap(sim, v), vehicleAirCap(sim, v)) : 0;
}

/** True if the store holds a full tank at least (a shuttle with less is no longer a source). */
export function hasTank(sim: Sim, seconds: number): boolean {
  return seconds >= suitDef(sim).airSec;
}

/** A shuttle docked at this airlock, or 0. */
export function dockedAt(sim: Sim, airlock: number): number {
  for (const id of sim.world.query(VehicleC)) {
    const v = sim.world.get(id, VehicleC) as Vehicle;
    if (v.state === 'docked' && v.dock === airlock) return id;
  }
  return 0;
}

/** True if the ship's life support works, and the ship is not a derelict: an airlock store on it refills. */
export function shipHasLifeSupport(sim: Sim, shipId: number): boolean {
  const s = shipById(sim, shipId);
  if (!s || s.state === 'wreck' || s.ruin) return false;
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC)!;
    if (m.powered && m.enabled && m.hp > 0 && sim.content.modules[m.def]?.o2PerSec && shipIdOf(sim, m) === shipId) return true;
  }
  return false;
}

/** Seconds of suit time one second of the wearer's tank is worth: the tank of a Void-born crew member lasts longer. */
export function airValue(sim: Sim, crew: number): number {
  return sim.world.has(crew, CrewC) ? traitMult(sim, crew, 'suitAirMult') : 1;
}
