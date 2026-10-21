import { describe, expect, it } from 'vitest';
import {
  STATION_SIZES, airlockTiles, footprintTiles, generateShip, generateStation, type FactionDef, type GenResult, type ModuleDef, type StationDef,
} from '../sim';
import { content } from './index';
import { stations } from './stations';

const defs = content.modules as Record<string, ModuleDef>;
const FIXTURES = ['module.airlock', 'module.light'];

/** Every generated layout of the sweep: ship factions, and station kinds by size. */
function sweep(): { name: string; g: GenResult }[] {
  const out: { name: string; g: GenResult }[] = [];
  for (const [id, f] of Object.entries(content.factions)) {
    for (let seed = 1; seed <= 6; seed++) out.push({ name: `${id} ${seed}`, g: generateShip(f as FactionDef, id, seed, 1, defs) });
  }
  for (const [id, def] of Object.entries(stations)) {
    for (const size of STATION_SIZES) {
      for (let seed = 1; seed <= (size === 'hub' ? 1 : 4); seed++) out.push({ name: `${id} ${size} ${seed}`, g: generateStation(def as StationDef, id, size, seed, defs) });
    }
  }
  return out;
}
const layouts = sweep();

/**
 * Plain doors on an airlock: its footprint and collar may carry only its own outer and inner door (written on spawn, and
 * drawn by the airlock's own sprites; render/airlockArt `airlockDoorTiles`). Any other door there would draw a generic
 * door on the airlock.
 */
function strayDoors(g: GenResult): string[] {
  const rows = g.template.rows;
  const at = (x: number, y: number): string => rows[y]?.[x] ?? ' ';
  const out: string[] = [];
  for (const m of g.template.modules ?? []) {
    const def = defs[m.def];
    if (!def?.airlock) continue;
    const t = airlockTiles(def, m);
    const own = (x: number, y: number): boolean => (x === t.outer.x && y === t.outer.y) || (x === t.inner.x && y === t.inner.y);
    for (const p of [...footprintTiles(def, m.x, m.y, m.rot), ...(t.collar ? [t.collar] : [])]) {
      if (at(p.x, p.y) === 'D' && !own(p.x, p.y)) out.push(`${m.def}@${m.x},${m.y} r${m.rot}: door at ${p.x},${p.y}`);
    }
  }
  return out;
}

/** The dock rooms of a layout's airlocks: where each airlock's inside tile lies, and what else that room holds. */
function airlockRooms(g: GenResult): { role: string; bare: boolean; hasDoor: boolean; besideHall: boolean }[] {
  const { width: w, rows } = { width: g.width, rows: g.template.rows };
  const at = (x: number, y: number): string => rows[y]?.[x] ?? ' ';
  const out: { role: string; bare: boolean; hasDoor: boolean; besideHall: boolean }[] = [];
  const occ = new Map<number, string>();
  for (const m of g.template.modules ?? []) for (const t of footprintTiles(defs[m.def] as ModuleDef, m.x, m.y, m.rot)) occ.set(t.y * w + t.x, m.def);
  for (const m of g.template.modules ?? []) {
    const def = defs[m.def];
    if (!def?.airlock) continue;
    const ins = airlockTiles(def, m).inside;
    const room = g.roomOf[ins.y * w + ins.x] as number;
    const r = g.rooms[room];
    if (!r) continue;
    const floor = r.tiles;
    const bare = floor.length <= 12 && floor.every((i) => FIXTURES.includes(occ.get(i) ?? 'module.airlock'));
    let hasDoor = false;
    let besideHall = false;
    for (const i of floor) {
      const x = i % w;
      const y = Math.floor(i / w);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        if (at(x + dx, y + dy) === 'D') hasDoor = true;
        const c = at(x + dx, y + dy);
        const across = g.roomOf[(y + 2 * dy) * w + x + 2 * dx] ?? -1;
        if ((c === '#' || c === 'D') && at(x + 2 * dx, y + 2 * dy) === '_' && g.rooms[across]?.role === 'hall') besideHall = true;
      }
    }
    out.push({ role: r.role, bare, hasDoor, besideHall });
  }
  return out;
}

describe('airlocks', () => {
  it('carry no plain doors on their footprint or collar, in generated ships and stations', () => {
    const bad = layouts.flatMap(({ name, g }) => strayDoors(g).map((s) => `${name} ${s}`));
    expect(bad).toEqual([]);
  });

  it('open straight into their corridor when their dock holds nothing else; docks with contents keep their door', () => {
    const bad: string[] = [];
    const tally = new Map<string, { merged: number; walled: number }>();
    for (const { name, g } of layouts) {
      expect(g.problems, name).toEqual([]);
      const key = name.split(' ').slice(0, name.startsWith('station.') ? 2 : 1).join(' ');
      const t = tally.get(key) ?? { merged: 0, walled: 0 };
      tally.set(key, t);
      for (const r of airlockRooms(g)) {
        if (r.role === 'hall') { t.merged++; continue; } // merged: the airlock's walkway is corridor floor, no door between
        if (r.role !== 'dock') bad.push(`${name}: airlock in a ${r.role} room`); // never merged into a non-corridor room
        else if (r.bare && r.besideHall) bad.push(`${name}: an airlock-only dock beside a corridor kept its wall`);
        else if (r.bare) t.walled++;
        else if (!r.hasDoor) bad.push(`${name}: a dock with contents lost its door`);
      }
    }
    expect(bad).toEqual([]);
    expect([...tally.values()].reduce((n, t) => n + t.merged, 0)).toBeGreaterThan(0);
    // The docks that border no corridor stay walled: listed for the report.
    console.log([...tally.entries()].map(([k, t]) => `${k}: merged ${t.merged}, walled ${t.walled}`).join('\n'));
  });
});
