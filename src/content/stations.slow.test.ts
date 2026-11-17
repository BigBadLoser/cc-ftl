import { describe, expect, it } from 'vitest';
import type { ModuleDef } from '../sim/registry';
import { buildStation } from '../sim/shipgen/stationBuild';
import { STATION_SIZES, type StationDef } from '../sim/shipgen/stationTypes';
import { content } from './index';
import { stations } from './stations';

const defs = content.modules as Record<string, ModuleDef>;

describe('station sweep', () => {
  it('12 seeds of every kind at outpost and station size, 4 of every hub, stand, nearly all on the first try', () => {
    for (const [id, def] of Object.entries(stations)) {
      for (const size of STATION_SIZES) {
        // Hubs are the big ones (most of the time here); a few seeds of each kind.
        const seeds = size === 'hub' ? 4 : 12;
        let attempts = 0;
        for (let seed = 1; seed <= seeds; seed++) {
          const g = buildStation(def as StationDef, id, size, seed, defs);
          expect(g.problems, `${id} ${size} seed ${seed}`).toEqual([]);
          attempts += g.attempts;
        }
        expect(attempts / seeds, `${id} ${size} mean tries`).toBeLessThan(1.5);
      }
    }
  }, 900000);
});
