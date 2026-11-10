import { shipStorages, shipStoreCount } from '../items/stock';
import { storageAdd } from '../items/storage';
import { shipIdOf } from '../regions';
import { DAY_HOURS } from '../clock';
import { GAME_HOUR_SEC } from '../tuning';
import type { ModuleDef } from '../registry';
import type { Sim } from '../sim';
import { ModuleC, type Module } from './components';

/**
 * Reactor fuel and battery charge (issue #421): the one place that says how much a module holds and whether it can supply power.
 * The power system (systems/power.ts) burns, charges and drains through these; the refuel jobs (modules/refuel.ts), the snapshots
 * and the alerts read them. `Module.fuel` / `Module.charge` absent means full, so a freshly built module needs no setup.
 */

/** Units of fuel in a reactor's store (0 for a module with no fuel store). */
export function fuelOf(m: Pick<Module, 'fuel'>, def: Pick<ModuleDef, 'fuel'>): number {
  return def.fuel ? Math.max(0, m.fuel ?? def.fuel.store) : 0;
}

/** Power-seconds held by a battery bank (0 for a module with no battery). */
export function chargeOf(m: Pick<Module, 'charge'>, def: Pick<ModuleDef, 'battery'>): number {
  return def.battery ? Math.max(0, m.charge ?? def.battery.capacity) : 0;
}

/** Whether a power module delivers its power, fuel aside from the live checks the power system makes: a reactor with an empty store does not. Every hull burns by this one rule. */
export function hasFuel(m: Pick<Module, 'fuel'>, def: Pick<ModuleDef, 'fuel'>): boolean {
  return !def.fuel || fuelOf(m, def) > 0;
}

/** Days of typical draw an NPC ship carries when it spawns (its crew refuel from it), and a station keeps (refilled by the restock). */
export const NPC_FUEL_DAYS = 3;
export const STATION_FUEL_DAYS = 12;
/** Crystals left in a derelict's reactor on emergency power (others are empty): a short glow, not a working ship. */
export const DERELICT_FUEL = 1;

/** Fraction of its rating a reactor typically carries, for sizing a stock of fuel. */
const TYPICAL_LOAD = 0.5;

/** Units of a reactor fuel that a ship's reactors burn in `days` game days at a typical draw: the sizing of an NPC ship's or a station's stock. */
export function fuelForDays(sim: Sim, ship: number, item: string, days: number): number {
  let units = 0;
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const def = m && shipIdOf(sim, m) === ship ? sim.content.modules[m.def] : undefined;
    if (def?.fuel?.item === item) units += (def.power * TYPICAL_LOAD * days * DAY_HOURS * GAME_HOUR_SEC) / def.fuel.powerPerUnit;
  }
  return Math.ceil(units);
}

/**
 * Top a ship's stores up to `days` of typical draw of its reactors' fuel, into the first storages with room. A hull with no reactor,
 * or whose stores already hold that much, gets nothing. Returns the units added. Used when an NPC ship is spawned (a few days, as a
 * crew would carry) and by the station restock (a large stock, refilled). Deterministic: no rolls, storages in id order.
 */
export function stockFuel(sim: Sim, ship: number, days: number): number {
  const fuels = new Set<string>();
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const item = m && shipIdOf(sim, m) === ship ? sim.content.modules[m.def]?.fuel?.item : undefined;
    if (item) fuels.add(item);
  }
  let added = 0;
  for (const item of [...fuels].sort()) {
    let need = fuelForDays(sim, ship, item, days) - shipStoreCount(sim, ship, item);
    for (const id of shipStorages(sim, ship)) {
      if (need <= 0) break;
      const put = storageAdd(sim, id, item, need);
      need -= put;
      added += put;
    }
  }
  return added;
}
