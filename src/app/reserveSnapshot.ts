import { ModuleC, type Sim } from '../sim';
import { chargeOf, fuelOf } from '../sim/modules/energy';
import { shipStoreCount } from '../sim/items/stock';
import { shipIdOf } from '../sim/regions';
import type { UiReserve } from '../ui/api';

const r1 = (n: number): number => Math.round(n * 10) / 10;

/** A reactor's fuel store or a battery bank's charge for the module panel, or null for any other module. Reads the sim. */
export function buildReserve(sim: Sim, id: number): UiReserve | null {
  const m = sim.world.get(id, ModuleC);
  const def = m && sim.content.modules[m.def];
  if (!m || !def) return null;
  if (def.fuel) {
    const ship = shipIdOf(sim, m);
    const have = fuelOf(m, def);
    const name = sim.content.items[def.fuel.item]?.name ?? def.fuel.item;
    const stock = shipStoreCount(sim, ship, def.fuel.item);
    const note = have <= 0 ? (stock > 0 ? `Out of ${name.toLowerCase()}: supplies nothing until crew load more` : `Out of ${name.toLowerCase()}: supplies nothing, none in the stores`)
      : have < def.fuel.refillBelow ? (stock > 0 ? 'Running low: crew will refill it' : `Running low, none in the stores`) : 'Burns with the load it carries';
    return { kind: 'fuel', label: name, have: r1(have), max: def.fuel.store, note, low: have < def.fuel.refillBelow };
  }
  if (def.battery) {
    const have = chargeOf(m, def);
    const note = m.hp <= 0 ? 'Destroyed: the charge is lost' : !m.enabled ? 'Switched off: holds its charge' : have <= 0 ? 'Empty' : have >= def.battery.capacity ? 'Full' : 'Charges from spare power, covers a shortfall';
    return { kind: 'charge', label: 'Charge', have: Math.round(have), max: def.battery.capacity, note, low: have <= 0 };
  }
  return null;
}

/** The home ship's reactor fuel and battery charge in total, for the power readout (null when it has none of either). */
export function buildReserves(sim: Sim, ship: number): { fuel: { have: number; max: number } | null; battery: { have: number; max: number } | null } {
  const fuel = { have: 0, max: 0, any: false };
  const battery = { have: 0, max: 0, any: false };
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const def = m && shipIdOf(sim, m) === ship ? sim.content.modules[m.def] : undefined;
    if (!m || !def) continue;
    if (def.fuel) Object.assign(fuel, { have: fuel.have + fuelOf(m, def), max: fuel.max + def.fuel.store, any: true });
    else if (def.battery) Object.assign(battery, { have: battery.have + chargeOf(m, def), max: battery.max + def.battery.capacity, any: true });
  }
  return { fuel: fuel.any ? { have: r1(fuel.have), max: fuel.max } : null, battery: battery.any ? { have: Math.round(battery.have), max: battery.max } : null };
}
