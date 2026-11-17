/**
 * Room sample (dev tool, not shipped): real rooms cut out of generated stations, each on its own with its walls and
 * doors, furnished as the game furnishes them today. A row per room role, a few kinds, sizes and seeds, rooms of a
 * shape already shown skipped. Captions: kind (3 letters), size (s/h), seed, then the room's size and its beds. The test bed for a new fit-out: the same rooms, furnished by it.
 *   node tools/shipgen/cli.js --mock tools/shipgen/mocks/roomSample.ts --out <dir>  (then /tools/layout/?case=mock-roomSample)
 */
import { content } from '../../../src/content';
import { stationRecipes } from '../../../src/content/stationRecipes';
import { stations } from '../../../src/content/stations';
import { assembleStation, type ModuleDef, type Recipe, type RoomRole, type ShipTemplate, type StationDef, type StationSize } from '../../../src/sim';
import type { Sheet } from './furnishing';

const defs = content.modules as Record<string, ModuleDef>;
type Kind = keyof typeof stations;
const SOURCES: [Kind, keyof typeof stationRecipes][] = [
  ['station.military', 'fort'], ['station.mining', 'compound'], ['station.trading', 'bazaar'], ['station.pirate', 'tree'], ['station.farming', 'spine'],
];
const SIZES: StationSize[] = ['station', 'hub'];
const SEEDS = [1, 2];
const ROLES: RoomRole[] = ['quarters', 'support', 'weapons', 'medbay', 'shields', 'reactor'];
/** Rooms per row at most. */
const PER_ROW = 9;

interface Cut { caption: string; role: RoomRole; rows: string[]; modules: NonNullable<ShipTemplate['modules']>; floor: [number, number] }

/** Every room of the sampled roles, cut out with a ring of wall: its own floor, the walls and doors round it. */
function cuts(): Map<RoomRole, Cut[]> {
  const out = new Map<RoomRole, Cut[]>(ROLES.map((r) => [r, []]));
  const seen = new Set<string>();
  for (const [kind, family] of SOURCES) for (const size of SIZES) for (const seed of SEEDS) {
    const recipe = stationRecipes[family][0] as Recipe;
    let made;
    try { made = assembleStation(stations[kind] as StationDef, kind, size, seed, defs, recipe); } catch { continue; }
    const { template, rooms, width } = made;
    const rows = template.rows;
    for (const room of rooms) {
      if (!ROLES.includes(room.role) || room.tiles.length === 0) continue;
      const xs = room.tiles.map((i) => i % width), ys = room.tiles.map((i) => Math.floor(i / width));
      const x0 = Math.min(...xs) - 1, y0 = Math.min(...ys) - 1, x1 = Math.max(...xs) + 1, y1 = Math.max(...ys) + 1;
      const own = new Set(room.tiles);
      const near = (x: number, y: number): boolean => [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].some(([dx, dy]) => own.has((y + (dy as number)) * width + x + (dx as number)));
      const cut: string[] = [];
      for (let y = y0; y <= y1; y++) {
        let line = '';
        for (let x = x0; x <= x1; x++) {
          const c = rows[y]?.[x] ?? '.';
          line += own.has(y * width + x) ? c : near(x, y) ? (c === 'D' ? 'D' : '#') : '.';
        }
        cut.push(line);
      }
      const mods = (template.modules ?? []).filter((m) => own.has(m.y * width + m.x)).map((m) => ({ ...m, x: m.x - x0, y: m.y - y0 }));
      const beds = mods.filter((m) => m.def === 'module.bed').length;
      const doors = cut.join('').split('D').length - 1;
      const key = `${room.role} ${x1 - x0 - 1}x${y1 - y0 - 1} ${room.tiles.length} ${doors} ${beds}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const list = out.get(room.role) as Cut[];
      if (list.length >= PER_ROW) continue;
      const first = room.tiles[0] as number;
      list.push({
        caption: `${kind.slice(8, 11)}${size[0]}${seed} ${x1 - x0 - 1}x${y1 - y0 - 1}${beds ? ` ${beds}b` : ''}`, role: room.role,
        rows: cut, modules: mods, floor: [first % width - x0, Math.floor(first / width) - y0],
      });
    }
  }
  return out;
}

export function mock(): Sheet {
  const GAP = 4, X0 = 2;
  const lines = [...cuts().values()].filter((l) => l.length > 0);
  const W = X0 + Math.max(...lines.map((l) => l.reduce((n, c) => n + (c.rows[0] as string).length + GAP, 0))) + 2;
  const H = lines.reduce((n, l) => n + Math.max(...l.map((c) => c.rows.length)) + 3, 1) + 1;
  const grid = Array.from({ length: H }, () => Array<string>(W).fill('.'));
  const sheet: Sheet = { template: { name: 'Room sample', rows: [], modules: [] } as ShipTemplate, captions: [], roles: [], problems: [] };
  let top = 1;
  for (const line of lines) {
    let x = X0;
    for (const c of line) {
      const oy = top + 1;
      c.rows.forEach((r, y) => [...r].forEach((ch, i) => { if (ch !== '.') (grid[oy + y] as string[])[x + i] = ch; }));
      for (const m of c.modules) sheet.template.modules?.push({ ...m, x: m.x + x, y: m.y + oy });
      const w = (c.rows[0] as string).length;
      sheet.captions.push({ x, y: top, text: c.caption, cx: x + (w - 1) / 2, cy: oy + (c.rows.length - 1) / 2 });
      sheet.roles.push({ x: c.floor[0] + x, y: c.floor[1] + oy, role: c.role });
      x += w + GAP;
    }
    top += Math.max(...line.map((c) => c.rows.length)) + 3;
  }
  sheet.template.rows = grid.map((r) => r.join(''));
  return sheet;
}
