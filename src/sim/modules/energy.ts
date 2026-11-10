import { ShipC } from '../combat/components';
import type { ModuleDef } from '../registry';
import type { Sim } from '../sim';
import type { Module } from './components';

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

/**
 * Whether reactors on this ship burn fuel. Player ships only (user rule for NPCs, issue #421): an enemy, a station or a derelict
 * runs on without crystals, so a fight or a station never stalls on fuel. A ship the player takes over starts burning with a full store.
 */
export function burnsFuel(sim: Sim, ship: number): boolean {
  return sim.world.get(ship, ShipC)?.faction === 'player';
}

/**
 * Whether a power source is delivering right now, as the power system last left it: a powered reactor, or a live (powered) battery
 * bank with charge left. The ship-state check counts these, so a ship whose reactors ran dry stays active on its banks (#424).
 */
export function supplying(m: Pick<Module, 'powered' | 'charge'>, def: Pick<ModuleDef, 'power' | 'battery'>): boolean {
  return m.powered && (def.power > 0 || chargeOf(m, def) > 0);
}

/** Whether a power module delivers its power, fuel aside from the live checks the power system makes: a reactor with an empty store on a ship that burns does not. */
export function hasFuel(sim: Sim, ship: number, m: Pick<Module, 'fuel'>, def: Pick<ModuleDef, 'fuel'>): boolean {
  return !def.fuel || !burnsFuel(sim, ship) || fuelOf(m, def) > 0;
}
