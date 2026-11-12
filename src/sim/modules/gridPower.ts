import type { Sim } from '../sim';
import { ModuleC, type Module } from './components';
import { chargeOf } from './energy';
import { modulesOn } from './byShip';
import type { ModuleDef } from '../registry';

/** The test is a stable function: the module index caches its list by it. */
const suppliesPower = (d: ModuleDef): boolean => d.power > 0 || !!d.battery;

/**
 * True while ship `ship`'s power network has power: a running supplier (a reactor with fuel, `Module.powered`) or a battery bank with charge.
 * Tiles with no module of their own (a door's vent) have power exactly when their network does. Today a ship is one network (modules/network.ts).
 */
export function networkHasPower(sim: Sim, ship: number): boolean {
  for (const id of modulesOn(sim, ship, suppliesPower)) {
    const m = sim.world.get(id, ModuleC) as Module;
    const def = sim.content.modules[m.def];
    if (!def || m.hp <= 0 || !m.enabled) continue;
    if (def.power > 0 && m.powered) return true;
    if (def.battery && chargeOf(m, def) > 0) return true;
  }
  return false;
}
