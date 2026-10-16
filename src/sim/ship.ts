import type { ShipTemplate } from './registry';
import { Grid } from './grid';
import { SHIP_FIELDS, Struct } from './structure';

const CHARS: Record<string, number> = { '.': Struct.Space, '#': Struct.Wall, _: Struct.Floor, D: Struct.Door };

/** Build a ship grid from an ASCII template. Throws on unknown characters, naming row/col (0-based). */
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
  return grid;
}
