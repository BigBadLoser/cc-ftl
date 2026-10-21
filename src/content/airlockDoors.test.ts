import { describe, expect, it } from 'vitest';
import {
  STATION_SIZES, airlockTiles, footprintTiles, generateShip, generateStation, type FactionDef, type GenResult, type ModuleDef, type StationDef,
} from '../sim';
import { content } from './index';
import { stations } from './stations';

const defs = content.modules as Record<string, ModuleDef>;

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

describe('airlocks carry no plain doors', () => {
  it('in generated stations (every kind and size)', () => {
    const bad: string[] = [];
    for (const [id, def] of Object.entries(stations)) {
      for (const size of STATION_SIZES) {
        for (let seed = 1; seed <= (size === 'hub' ? 1 : 4); seed++) {
          for (const s of strayDoors(generateStation(def as StationDef, id, size, seed, defs))) bad.push(`${id} ${size} ${seed} ${s}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('in generated ships (every faction)', () => {
    const bad: string[] = [];
    for (const [id, f] of Object.entries(content.factions ?? {})) {
      for (let seed = 1; seed <= 6; seed++) for (const s of strayDoors(generateShip(f as FactionDef, id, seed, 1, defs))) bad.push(`${id} ${seed} ${s}`);
    }
    expect(bad).toEqual([]);
  });
});
