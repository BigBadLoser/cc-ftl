import { describe, expect, it } from 'vitest';
import { checkUse, generateShip, generateStation, STATION_SIZES, type GenResult, type ModuleDef, type StationDef } from '../sim';
import { content } from './index';
import { stations } from './stations';

const defs = content.modules as Record<string, ModuleDef>;
const breaks = (g: GenResult): string[] =>
  checkUse(g.template.rows, (g.template.modules ?? []).map((m) => ({ ...m, rot: m.rot ?? 0 })), defs, g.roomOf).map((b) => `${b.kind} ${b.def} at ${b.x},${b.y}`);

describe('room use rules (shipgen/rooms/usage.ts)', () => {
  it('every piece stays usable: beds, access tiles, chairs, serviceable sides (every faction and station kind, seeds 1 to 3)', () => {
    const found: string[] = [];
    let layouts = 0;
    for (const [id, f] of Object.entries(content.factions)) {
      for (let seed = 1; seed <= 3; seed++) {
        const g = generateShip(f, id, seed, 4, defs);
        layouts++;
        found.push(...breaks(g).map((b) => `${id} seed ${seed}: ${b}`));
      }
    }
    for (const [id, def] of Object.entries(stations)) {
      for (let seed = 1; seed <= 3; seed++) {
        const size = STATION_SIZES[(seed - 1) % STATION_SIZES.length] as (typeof STATION_SIZES)[number];
        const g = generateStation(def as StationDef, id, size, seed, defs);
        layouts++;
        found.push(...breaks(g).map((b) => `${id} ${size} seed ${seed}: ${b}`));
      }
    }
    expect(layouts).toBeGreaterThan(20);
    expect(found).toEqual([]);
  }, 120000);
});
