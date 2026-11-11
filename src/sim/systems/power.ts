import { IonC } from '../combat/components';
import { ModuleC, type Module } from '../modules/components';
import { isIdle } from '../modules/draw';
import { TICK_HZ } from '../time';
import { chargeOf, fuelOf, hasFuel } from '../modules/energy';
import { isHeldOffline } from '../modules/hold';
import { networkOf } from '../modules/network';
import type { ModuleDef } from '../registry';
import type { Sim } from '../sim';
import { shipIdOf, shipGrid } from '../regions';
import { modulesWhere, type ModuleList } from '../modules/byShip';

export interface Member {
  id: number;
  m: Module;
  def: ModuleDef;
}

/**
 * Allocate power per network. Suppliers (power > 0) add to the pool; consumers are served in
 * priority order (1 first, ties by lower entity id). The first consumer that does not fit, and
 * everyone after it, goes unpowered, so shortages always cut the lowest priorities first.
 * Reactors with a fuel store burn it in proportion to the load they carry (modules/energy.ts); an empty one supplies nothing. Battery banks drain to
 * cover a shortfall before any consumer is cut and charge from spare supply (the reactors burn for that too). Disabled, destroyed (hp 0), ion-struck or work-held (`Module.offlineUntil`) modules neither supply nor draw; nor does an idle one (`ModuleDef.drawsWhen`).
 */
export function powerSystem(sim: Sim): void {
  for (const members of networksOf(sim)) allocate(sim, members);
}

/**
 * The power networks: modules grouped by ship and `networkOf` tile, each list ascending, the networks in order of their
 * lowest module id. A pure function of the module index (which ship each module stands on), the ship rectangles it is keyed
 * on and the content, so it is cached on the index's list and rebuilt with it.
 */
const networkCache = new WeakMap<ModuleList, Member[][]>();

function networksOf(sim: Sim): Member[][] {
  const all = modulesWhere(sim, null);
  const hit = networkCache.get(all);
  if (hit) return hit;
  const networks = new Map<number, Member[]>();
  for (let k = 0; k < all.ids.length; k++) {
    const id = all.ids[k] as number, ship = all.ships[k] as number;
    const m = sim.world.get(id, ModuleC) as Module;
    const def = sim.content.modules[m.def];
    const grid = shipGrid(sim, ship);
    if (!def || !grid) continue;
    const key = ship * 65536 + networkOf(grid, m.x, m.y);
    const list = networks.get(key);
    if (list) list.push({ id, m, def });
    else networks.set(key, [{ id, m, def }]);
  }
  const out = [...networks.values()];
  networkCache.set(all, out);
  return out;
}

/** Allocate one network (exported for the tick-cost equivalence test, which groups the modules the naive way). */
export function allocate(sim: Sim, members: Member[]): void {
  const first = members[0];
  const ship = first ? shipIdOf(sim, first.m) : 0;
  const dt = 1 / TICK_HZ;
  let supply = 0;
  let demand = 0;
  const consumers: Member[] = [];
  const suppliers: Member[] = [];
  const banks: Member[] = [];
  for (const mem of members) {
    const live = mem.m.enabled && mem.m.hp > 0 && !sim.world.has(mem.id, IonC) && !isHeldOffline(sim, mem.m) && !isIdle(sim, mem.id, mem.def);
    if (mem.def.battery && mem.m.hp <= 0) mem.m.charge = 0; // a destroyed bank loses its charge
    if (!live) {
      mem.m.powered = false;
    } else if (mem.def.power > 0) {
      mem.m.powered = hasFuel(mem.m, mem.def); // an empty reactor supplies nothing
      if (mem.m.powered) {
        supply += mem.def.power;
        suppliers.push(mem);
      }
    } else if (mem.def.power < 0) {
      demand -= mem.def.power;
      consumers.push(mem);
    } else {
      mem.m.powered = true;
      if (mem.def.battery) banks.push(mem);
    }
  }
  consumers.sort((a, b) => a.m.powerPriority - b.m.powerPriority || a.id - b.id);
  // Batteries cover what the reactors cannot, before anything is cut: their stored energy, as power over this tick.
  const stored = banks.reduce((n, b) => n + chargeOf(b.m, b.def), 0);
  let remaining = supply + stored / dt;
  let cut = false;
  let lostPower = false;
  for (const c of consumers) {
    const draw = -c.def.power;
    if (!cut && draw <= remaining) {
      remaining -= draw;
      c.m.powered = true;
    } else {
      cut = true;
      if (c.m.powered) lostPower = true;
      c.m.powered = false;
    }
  }
  const used = supply + stored / dt - remaining;
  let reactorLoad = Math.min(used, supply);
  const fromBanks = (used - reactorLoad) * dt;
  if (fromBanks > 0) drain(banks, fromBanks);
  else if (supply > used) reactorLoad += charge(banks, (supply - used) * dt) / dt; // spare supply fills the banks, and the reactors burn for it
  // Burn follows the load the reactors actually carry (each carries the same share of its rating).
  if (supply > 0) {
    const share = reactorLoad / supply;
    for (const r of suppliers) {
      const fuel = r.def.fuel;
      if (fuel) r.m.fuel = Math.max(0, fuelOf(r.m, r.def) - (r.def.power * share * dt) / fuel.powerPerUnit);
    }
  }
  if (lostPower && first) sim.events.emit({ type: 'power.shortage', ship, supply, demand });
}

/** Take `energy` power-seconds from the banks, in order. */
function drain(banks: Member[], energy: number): void {
  let left = energy;
  for (const b of banks) {
    const take = Math.min(left, chargeOf(b.m, b.def));
    b.m.charge = chargeOf(b.m, b.def) - take;
    left -= take;
    if (left <= 0) return;
  }
}

/** Put up to `energy` power-seconds into the banks, in order; returns how much went in. */
function charge(banks: Member[], energy: number): number {
  let left = energy;
  for (const b of banks) {
    const cap = b.def.battery?.capacity ?? 0;
    const put = Math.min(left, cap - chargeOf(b.m, b.def));
    if (put <= 0) continue;
    b.m.charge = chargeOf(b.m, b.def) + put;
    left -= put;
    if (left <= 0) break;
  }
  return energy - left;
}
