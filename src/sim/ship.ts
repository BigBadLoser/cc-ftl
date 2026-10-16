import type { ShipTemplate } from './registry';
import { Grid } from './grid';
import { storageAdd } from './items/storage';
import { spawnModule } from './modules/spawn';
import type { Sim } from './sim';
import { SHIP_FIELDS, Struct } from './structure';
import { NORMAL_CO2, NORMAL_O2, NORMAL_TEMP, SPACE_TEMP } from './tuning';

const CHARS: Record<string, number> = { '.': Struct.Space, '#': Struct.Wall, _: Struct.Floor, D: Struct.Door };

/**
 * Build a ship grid from an ASCII template. Throws on unknown characters, naming row/col (0-based).
 * Floors and doors start with normal air and temperature; space is vacuum at SPACE_TEMP.
 */
export function gridFromTemplate(id: number, t: ShipTemplate): Grid {
  const width = Math.max(1, ...t.rows.map((r) => r.length));
  const height = Math.max(1, t.rows.length);
  const grid = new Grid(id, width, height, SHIP_FIELDS);
  t.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const kind = CHARS[row[x] as string];
      if (kind === undefined) {
        throw new Error(`Ship "${t.name}": unknown char "${row[x]}" at row ${y}, col ${x}`);
      }
      if (kind !== Struct.Space) grid.set('struct', x, y, kind);
    }
  });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) initAtmosphere(grid, x, y);
  }
  return grid;
}

/** Set a tile's gas and temperature to the normal value for its struct kind. */
export function initAtmosphere(grid: Grid, x: number, y: number): void {
  const kind = grid.get('struct', x, y);
  const air = kind === Struct.Floor || kind === Struct.Door;
  grid.set('o2', x, y, air ? NORMAL_O2 : 0);
  grid.set('co2', x, y, air ? NORMAL_CO2 : 0);
  grid.set('temp', x, y, kind === Struct.Space ? SPACE_TEMP : NORMAL_TEMP);
}

/** Place a template's modules on a grid that is already in `sim.grids`. */
export function spawnTemplateModules(sim: Sim, gridId: number, t: ShipTemplate): void {
  for (const m of t.modules ?? []) {
    const id = spawnModule(sim, gridId, m.def, m.x, m.y, m.rot);
    for (const q of m.stock ?? []) storageAdd(sim, id, q.item, q.count);
  }
}
