import { ShipC } from './combat/components';
import type { ShipTemplate } from './registry';
import { DenseGrid, type GridLike } from './grid';
import { ContainerC } from './containers/components';
import { ProductionC } from './items/components';
import { storageAdd } from './items/storage';
import { spawnModule } from './modules/spawn';
import type { Sim } from './sim';
import { spawnVehicle } from './vehicles/lifecycle';
import { FINISH_CHARS, SHIP_FIELDS, Struct, writeStruct } from './structure';
import { NORMAL_CO2, NORMAL_O2, NORMAL_TEMP, SPACE_TEMP } from './tuning';

const CHARS: Record<string, number> = { '.': Struct.Space, '#': Struct.Wall, _: Struct.Floor, D: Struct.Door, '=': Struct.Beam };

/**
 * Build a dense ship grid from an ASCII template (local coordinates; `stampGrid` places it in the sector).
 * Throws on unknown characters, naming row/col (0-based).
 * Floors and doors start with normal air and temperature; space is vacuum at SPACE_TEMP.
 */
export function gridFromTemplate(t: ShipTemplate): DenseGrid {
  const width = Math.max(1, ...t.rows.map((r) => r.length));
  const height = Math.max(1, t.rows.length);
  const grid = new DenseGrid(0, width, height, SHIP_FIELDS);
  t.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const kind = CHARS[row[x] as string];
      if (kind === undefined) {
        throw new Error(`Ship "${t.name}": unknown char "${row[x]}" at row ${y}, col ${x}`);
      }
      if (kind !== Struct.Space) writeStruct(grid, x, y, kind);
      const finish = FINISH_CHARS[t.floors?.[y]?.[x] ?? ''];
      if (finish && kind === Struct.Floor) grid.set('floor', x, y, finish);
    }
  });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) initAtmosphere(grid, x, y);
  }
  return grid;
}

/** Set a tile's gas and temperature to the normal value for its struct kind. */
export function initAtmosphere(grid: GridLike, x: number, y: number): void {
  const kind = grid.get('struct', x, y);
  const air = kind === Struct.Floor || kind === Struct.Door;
  grid.set('o2', x, y, air ? NORMAL_O2 : 0);
  grid.set('co2', x, y, air ? NORMAL_CO2 : 0);
  grid.set('temp', x, y, kind === Struct.Space ? SPACE_TEMP : NORMAL_TEMP);
}

/** Place a template's modules on a ship that is already stamped: its ShipC says where its top-left tile is. */
export function spawnTemplateModules(sim: Sim, ship: number, t: ShipTemplate): void {
  const s = sim.world.get(ship, ShipC);
  placeTemplateModules(sim, t, s?.x ?? 0, s?.y ?? 0);
}

/** Place a template's modules for a ship whose top-left tile is (ox, oy). Template modules are ship-local; they are stamped in sector tiles. */
export function placeTemplateModules(sim: Sim, t: ShipTemplate, ox: number, oy: number): void {
  for (const m of t.modules ?? []) {
    const id = spawnModule(sim, m.def, ox + m.x, oy + m.y, m.rot);
    for (const q of m.stock ?? []) storageAdd(sim, id, q.item, q.count);
    if (m.vehicle) spawnVehicle(sim, m.vehicle, id);
    const box = sim.world.get(id, ContainerC);
    if (box && m.clamp) box.clamp = m.clamp;
    const production = sim.world.get(id, ProductionC);
    for (const o of m.orders ?? []) production?.orders.push({ ...o, done: 0 });
  }
}
