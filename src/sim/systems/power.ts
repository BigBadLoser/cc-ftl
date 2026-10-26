import { IonC } from '../combat/components';
import { ModuleC, type Module } from '../modules/components';
import { networkOf } from '../modules/network';
import type { ModuleDef } from '../registry';
import type { Sim } from '../sim';
import { shipIdOf, shipGrid } from '../regions';

interface Member {
  id: number;
  m: Module;
  def: ModuleDef;
}

/**
 * Allocate power per network. Suppliers (power > 0) add to the pool; consumers are served in
 * priority order (1 first, ties by lower entity id). The first consumer that does not fit, and
 * everyone after it, goes unpowered, so shortages always cut the lowest priorities first.
 * Disabled or destroyed (hp 0) modules neither supply nor draw.
 */
export function powerSystem(sim: Sim): void {
  const networks = new Map<number, Member[]>();
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC) as Module;
    const def = sim.content.modules[m.def];
    const ship = shipIdOf(sim, m);
    const grid = shipGrid(sim, ship);
    if (!def || !grid) continue;
    const key = ship * 65536 + networkOf(grid, m.x, m.y);
    const list = networks.get(key);
    if (list) list.push({ id, m, def });
    else networks.set(key, [{ id, m, def }]);
  }
  for (const members of networks.values()) allocate(sim, members);
}

function allocate(sim: Sim, members: Member[]): void {
  let supply = 0;
  let demand = 0;
  const consumers: Member[] = [];
  for (const mem of members) {
    const live = mem.m.enabled && mem.m.hp > 0 && !sim.world.has(mem.id, IonC);
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
