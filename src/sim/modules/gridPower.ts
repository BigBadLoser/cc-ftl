import type { Sim } from '../sim';
import { ModuleC, type Module } from './components';
import { IonC } from '../combat/components';
import { chargeOf, hasFuel } from './energy';
import { isIdle } from './draw';
import { isHeldOffline } from './hold';
import { modulesOn } from './byShip';
import type { ModuleDef } from '../registry';

/** The test is a stable function: the module index caches its list by it. */
const suppliesPower = (d: ModuleDef): boolean => d.power > 0 || !!d.battery;

/**
 * Whether a module takes part in power allocation this tick: enabled, intact, not ion-struck, not held offline by crew work, not idle
 * (`ModuleDef.drawsWhen`). The one eligibility rule: `allocate` (systems/power.ts) and `networkHasPower` both ask it.
 */
export function powerLive(sim: Sim, id: number, m: Module, def: ModuleDef): boolean {
  return m.enabled && m.hp > 0 && !sim.world.has(id, IonC) && !isHeldOffline(sim, m) && !isIdle(sim, id, def);
}

/**
 * True while ship `ship`'s power network has power: a live supplier with fuel (a reactor) or a live battery bank with charge, by the same
 * rule `allocate` uses to build its supply. Tiles with no module of their own (a door's vent) have power exactly when their network does.
 * Today a ship is one network (modules/network.ts).
 */
export function networkHasPower(sim: Sim, ship: number): boolean {
  for (const id of modulesOn(sim, ship, suppliesPower)) {
    const m = sim.world.get(id, ModuleC) as Module;
    const def = sim.content.modules[m.def];
    if (!def || !powerLive(sim, id, m, def)) continue;
    if (def.power > 0 && hasFuel(m, def)) return true;
    if (def.power === 0 && def.battery && chargeOf(m, def) > 0) return true;
  }
  return false;
}
