import { CrewC, DeadC, ModuleC, PositionC, airlockSuits, roomTiles, type Sim } from '../sim';
import { buildRobotBay } from './robotSnapshot';
import { costsOf } from './logisticsSnapshot';
import type { UiModule, UiModuleDef, UiStats } from '../ui/api';

const GRID = 1;

/** Plain-data module list for the UI. Reads the sim, never mutates it. */
export function buildModuleList(sim: Sim): UiModule[] {
  const out: UiModule[] = [];
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const def = m && sim.content.modules[m.def];
    if (!m || !def || m.gridId !== GRID) continue;
    out.push({
      id, def: m.def, name: def.name, x: m.x, y: m.y, hp: Math.round(m.hp), maxHp: def.maxHp,
      priority: m.priority, enabled: m.enabled, powered: m.powered && m.enabled && m.hp > 0, power: def.power,
      storage: !!def.storage, crafting: !!def.crafting, bay: def.robotBay ? buildRobotBay(sim, id) : null,
      suits: def.airlock ? { stowed: airlockSuits(sim, id), max: def.airlock.suits ?? 0 } : null,
    });
  }
  return out;
}

export function buildModuleDefs(sim: Sim): UiModuleDef[] {
  return Object.entries(sim.content.modules).map(([id, d]) => ({
    id,
    name: d.name,
    w: d.footprint[0],
    h: d.footprint[1],
    power: d.power,
    cost: costsOf(sim, d.cost),
  }));
}

/** Power supply/demand of the ship and the average O2 of the rooms crew stand in. */
export function buildStats(sim: Sim): UiStats {
  let supply = 0;
  let demand = 0;
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const def = m && sim.content.modules[m.def];
    if (!m || !def || m.gridId !== GRID || !m.enabled || m.hp <= 0) continue;
    if (def.power > 0) supply += def.power;
    else demand -= def.power;
  }
  let o2: number | null = null;
  const grid = sim.grids.get(GRID);
  if (grid) {
    const room = grid.raw('room');
    const o2f = grid.raw('o2');
    const rooms = new Set<number>();
    for (const id of sim.world.query(CrewC, PositionC)) {
      const p = sim.world.get(id, PositionC);
      if (!p || p.gridId !== GRID || sim.world.has(id, DeadC) || !grid.inBounds(p.x, p.y)) continue;
      const r = room[p.y * grid.width + p.x] as number;
      if (r) rooms.add(r);
    }
    let sum = 0;
    for (const r of rooms) {
      const tiles = roomTiles(grid).get(r) ?? [];
      sum += tiles.reduce((a, i) => a + (o2f[i] as number), 0) / Math.max(1, tiles.length);
    }
    if (rooms.size) o2 = sum / rooms.size;
  }
  return { supply, demand, o2 };
}
