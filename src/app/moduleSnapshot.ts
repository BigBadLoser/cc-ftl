import { CrewC, DeadC, ModuleC, PositionC, airlockSuits, roomTiles, type Sim } from '../sim';
import { buildRobotBay } from './robotSnapshot';
import { costsOf } from './logisticsSnapshot';
import { buildFood } from './foodSnapshot';
import { buildHeat } from './heatSnapshot';
import { buildStock } from './logisticsSnapshot';
import type { UiModule, UiModuleDef, UiStats } from '../ui/api';
import { shipIdOf, shipGrid } from '../sim/regions';
import { homeShip } from '../sim/index';


/** A sector tile in its grid's local tiles (from the grid's top-left), for readouts. */
export function localOf(sim: Sim, shipId: number, x: number, y: number): { x: number; y: number } {
  const g = shipGrid(sim, shipId);
  return { x: x - (g?.x0 ?? 0), y: y - (g?.y0 ?? 0) };
}

/** Plain-data module list for the UI. Reads the sim, never mutates it. */
export function buildModuleList(sim: Sim): UiModule[] {
  const out: UiModule[] = [];
  const GRID = homeShip(sim);
  const home = homeShip(sim);
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const def = m && sim.content.modules[m.def];
    if (!m || !def || shipIdOf(sim, m) !== GRID) continue;
    out.push({
      id, ship: home, def: m.def, name: def.name, x: m.x, y: m.y, local: localOf(sim, shipIdOf(sim, m), m.x, m.y), hp: Math.round(m.hp), maxHp: def.maxHp,
      powerPriority: m.powerPriority, enabled: m.enabled, powered: m.powered && m.enabled && m.hp > 0, power: def.power,
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
  const GRID = homeShip(sim);
  let supply = 0;
  let demand = 0;
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const def = m && sim.content.modules[m.def];
    if (!m || !def || shipIdOf(sim, m) !== GRID || !m.enabled || m.hp <= 0) continue;
    if (def.power > 0) supply += def.power;
    else demand -= def.power;
  }
  let o2: number | null = null;
  const grid = shipGrid(sim, GRID);
  if (grid) {
    const rooms = new Set<number>();
    for (const id of sim.world.query(CrewC, PositionC)) {
      const p = sim.world.get(id, PositionC);
      if (!p || shipIdOf(sim, p) !== GRID || sim.world.has(id, DeadC) || !grid.inBounds(p.x, p.y)) continue;
      const r = grid.get('room', p.x, p.y);
      if (r) rooms.add(r);
    }
    let sum = 0;
    for (const r of rooms) {
      const tiles = roomTiles(grid).get(r) ?? [];
      // roomTiles indices run from the grid's top-left (x0, y0).
      const o2At = (i: number) => grid.get('o2', grid.x0 + (i % grid.width), grid.y0 + Math.floor(i / grid.width));
      sum += tiles.reduce((a, i) => a + o2At(i), 0) / Math.max(1, tiles.length);
    }
    if (rooms.size) o2 = sum / rooms.size;
  }
  return { supply, demand, food: buildFood(sim, buildStock(sim)), heat: buildHeat(sim), o2 };
}
