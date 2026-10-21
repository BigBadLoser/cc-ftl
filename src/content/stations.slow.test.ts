import { describe, expect, it } from 'vitest';
import { STATION_MAX, STATION_SIZES, generateStation, type ModuleDef, type StationDef } from '../sim';
import { content } from './index';
import { stations } from './stations';

const defs = content.modules as Record<string, ModuleDef>;

describe('station generator sweep', () => {
  it('12 seeds of every kind and size validate, mostly on early attempts; hubs build in reasonable time', () => {
    let slowest = 0;
    let which = '';
    const hubMs: number[] = [];
    for (const [id, def] of Object.entries(stations)) {
      for (const size of STATION_SIZES) {
        let attempts = 0;
        for (let seed = 1; seed <= 12; seed++) {
          const t0 = performance.now();
          const g = generateStation(def as StationDef, id, size, seed, defs);
          const dt = performance.now() - t0;
          if (size === 'hub') hubMs.push(dt);
          if (dt > slowest) { slowest = dt; which = `${id} ${size} seed ${seed} (${g.attempts} attempts)`; }
          expect(g.problems, `${id} ${size} seed ${seed}`).toEqual([]);
          expect(Math.max(g.width, g.height)).toBeLessThanOrEqual(STATION_MAX);
          attempts += g.attempts;
        }
        expect(attempts / 12, `${id} ${size} mean attempts`).toBeLessThan(6);
      }
    }
    // Courts are lit by a lamp grid and docks reserved up front, so hubs rarely reseed: a mean under about 1 s on a
    // quiet machine (bounded loosely here, tests run in parallel), the worst case a few seconds (see STATUS).
    expect(hubMs.reduce((t, x) => t + x, 0) / hubMs.length, 'hub mean ms').toBeLessThan(3000);
    expect(slowest, which).toBeLessThan(8000);
  }, 900000);
});
