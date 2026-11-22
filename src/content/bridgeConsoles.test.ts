import { describe, expect, it } from 'vitest';
import { content } from './index';
import { footprintTiles } from '../sim/modules/footprint';
import { generateOutline } from '../sim/shipgen/assembly/outlineShip';
import type { ModuleDef } from '../sim/registry';
import type { FactionDef } from '../sim/shipgen/types';

/** Facing of each rotation (the side its user stands): 0 south, 1 west, 2 north, 3 east. */
const FACE = [{ x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }, { x: 1, y: 0 }];
const CONSOLES = ['module.weaponsConsole', 'module.shieldConsole'];
const SETS: [string, string, number][] = [['faction.civilian', 'liner', 8], ['faction.navy', 'frigate', 3], ['faction.navy', 'destroyer', 3], ['faction.navy', 'cruiser', 3]];

/** The bridge's consoles and juts of a ship: a console with floor behind it, or a bridge tile ending a one-wide stretch. */
function problems(fid: string, type: string, seed: number): string[] {
  const r = generateOutline((content.factions as unknown as Record<string, FactionDef>)[fid] as FactionDef, fid, seed, 3, content.modules, type);
  const { rows } = r.template, w = r.width, out: string[] = [];
  const room = r.rooms.find((q) => q.role === 'bridge');
  if (!room) return [];
  const mine = new Set(room.tiles);
  const floorAt = (x: number, y: number): boolean => rows[y]?.[x] === '_' && mine.has(y * w + x);
  for (const m of r.template.modules ?? []) {
    const def = (content.modules as unknown as Record<string, ModuleDef | undefined>)[m.def];
    if (!def || !CONSOLES.includes(m.def) || !mine.has(m.y * w + m.x)) continue;
    const tiles = footprintTiles(def, m.x, m.y, m.rot), face = FACE[m.rot % 4] as { x: number; y: number };
    const at = (x: number, y: number): boolean => tiles.some((t) => t.x === x && t.y === y);
    // The tiles on the console's back edge (none of them has its back neighbour inside the console) need a wall behind.
    for (const t of tiles) {
      const bx = t.x - face.x, by = t.y - face.y;
      if (!at(bx, by) && rows[by]?.[bx] !== '#') out.push(`${fid}:${type}:s${seed} ${m.def} at ${m.x},${m.y} has no wall behind it`);
    }
  }
  for (const i of room.tiles) {
    const x = i % w, y = Math.floor(i / w);
    if (!floorAt(x, y)) continue;
    const wide = !floorAt(x - 1, y) && !floorAt(x + 1, y), tall = !floorAt(x, y - 1) && !floorAt(x, y + 1);
    if (wide || tall) out.push(`${fid}:${type}:s${seed} one-wide jut at ${x},${y}`);
  }
  return out;
}

describe('bridge', () => {
  it.each(SETS)('%s %s: each console backs onto a wall, no one-wide juts', (fid, type, n) => {
    const bad: string[] = [];
    for (let s = 1; s <= n; s++) bad.push(...problems(fid, type, s));
    expect(bad).toEqual([]);
  });
});
