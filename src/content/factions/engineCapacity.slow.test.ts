import { describe, expect, it } from 'vitest';
import { generatedLoad } from './capacityFixture';
import { factions } from './index';

// Slow soak test (see "Test tiers" in docs/ARCHITECTURE.md): the same seeds and depths the generator's own sweep uses, 160 of them per
// faction, so the biggest hulls (one-engine liners with 500-625 wall and door tiles) are in it. Skipped by `npm run check:fast`.
const SEEDS = 160;

describe('engine hull capacity, many seeds', () => {
  for (const id of Object.keys(factions)) {
    it(`${id}: ${SEEDS} seeds across depths 0-9 all fit their engines`, () => {
      const bad: string[] = [];
      let worst = 0;
      for (let seed = 0; seed < SEEDS; seed++) {
        const load = generatedLoad(id, seed * 7919 + 13, seed % 10);
        worst = Math.max(worst, load.ratio);
        if (load.over > 0) bad.push(`seed ${seed}: hull ${load.tiles} / ${load.capacity}`);
      }
      expect(bad).toEqual([]);
      expect(worst).toBeGreaterThan(0);
    }, 240000);
  }
});
