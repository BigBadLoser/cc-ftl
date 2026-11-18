import { describe, expect, it } from 'vitest';
import type { ModuleDef } from '../sim/registry';
import { buildStation } from '../sim/shipgen/stationBuild';
import { STATION_SIZES, type StationDef } from '../sim/shipgen/stationTypes';
import { content } from './index';
import { stations } from './stations';
import { expectResearch, expectSizes, stationIds, wallsAndCourts } from '../../test/support/fixtures/stations';

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

// The fast tests (stations.test.ts) check seed 1; these are the other seeds they used to sweep.
describe('station generation, more seeds', () => {
  it('research stations at seeds 2-6 are valid, with labs and the workshop bench and no engines', () => {
    for (const size of STATION_SIZES) for (const seed of [2, 3, 4, 5, 6]) expectResearch(size, seed);
  }, 300000);

  it('hubs are much bigger than any ship and outposts are the smallest (seed 2)', () => {
    for (const id of stationIds) expectSizes(id, 2);
  }, 300000);

  it('walls are one tile thick, and the kinds have open rooms (market courts, gardens) (seed 5)', () => {
    let courts = 0;
    for (const id of stationIds) for (const size of STATION_SIZES) courts += wallsAndCourts(id, size, 5);
    expect(courts).toBeGreaterThan(3);
  }, 300000);
});
