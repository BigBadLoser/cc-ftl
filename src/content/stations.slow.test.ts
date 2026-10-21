import { describe, expect, it } from 'vitest';
import { STATION_MAX, STATION_SIZES, generateStation, type ModuleDef, type StationDef } from '../sim';
import { content } from './index';
import { stations } from './stations';

const defs = content.modules as Record<string, ModuleDef>;

describe('station generator sweep', () => {
  it('12 seeds of every kind and size validate, mostly on early attempts; hubs build in reasonable time', () => {
    let slowest = 0;
    for (const [id, def] of Object.entries(stations)) {
      for (const size of STATION_SIZES) {
        let attempts = 0;
        for (let seed = 1; seed <= 12; seed++) {
          const t0 = performance.now();
          const g = generateStation(def as StationDef, id, size, seed, defs);
          slowest = Math.max(slowest, performance.now() - t0);
          expect(g.problems, `${id} ${size} seed ${seed}`).toEqual([]);
          expect(Math.max(g.width, g.height)).toBeLessThanOrEqual(STATION_MAX);
          attempts += g.attempts;
        }
        expect(attempts / 12, `${id} ${size} mean attempts`).toBeLessThan(6);
      }
    }
    expect(slowest).toBeLessThan(8000);
  }, 900000);
});
