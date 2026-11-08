import { IonC } from '../combat/components';
import { ModuleC, type Module } from '../modules/components';
import { isIdle } from '../modules/draw';
import { isHeldOffline } from '../modules/hold';
import { networkOf } from '../modules/network';
import type { ModuleDef } from '../registry';
import type { Sim } from '../sim';
import { shipIdOf, shipGrid } from '../regions';
import { modulesWhere, type ModuleList } from '../modules/byShip';

interface Member {
  id: number;
  m: Module;
  def: ModuleDef;
}

/**
 * Allocate power per network. Suppliers (power > 0) add to the pool; consumers are served in
 * priority order (1 first, ties by lower entity id). The first consumer that does not fit, and
 * everyone after it, goes unpowered, so shortages always cut the lowest priorities first.
 * Disabled, destroyed (hp 0), ion-struck or work-held (`Module.offlineUntil`) modules neither supply nor draw; nor does an idle one (`ModuleDef.drawsWhen`).
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

function allocate(sim: Sim, members: Member[]): void {
  let supply = 0;
  let demand = 0;
  const consumers: Member[] = [];
  for (const mem of members) {
    const live = mem.m.enabled && mem.m.hp > 0 && !sim.world.has(mem.id, IonC) && !isHeldOffline(sim, mem.m) && !isIdle(sim, mem.id, mem.def);
    if (!live) {
      mem.m.powered = false;
    } else if (mem.def.power > 0) {
      supply += mem.def.power;
      mem.m.powered = true;
    } else if (mem.def.power < 0) {
      demand -= mem.def.power;
      consumers.push(mem);
    } else {
      mem.m.powered = true;
    }
  }
  consumers.sort((a, b) => a.m.powerPriority - b.m.powerPriority || a.id - b.id);
  let remaining = supply;
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
  const first = members[0];
  if (lostPower && first) sim.events.emit({ type: 'power.shortage', ship: shipIdOf(sim, first.m), supply, demand });
}
