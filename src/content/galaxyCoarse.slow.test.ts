import { describe, expect, it } from 'vitest';
import { coarseWorld, measurePace } from '../../test/support/fixtures/coarse';

/**
 * The pace of the far galaxy over a long run (1000 coarse ticks, about 400 hours at 1x) on several seeds: the map changes steadily but not wildly, and a
 * player never sees two changes nearby between two looks. The fast guard of the same claims is in `galaxyCoarse.test.ts` (one seed, 150 ticks).
 */
describe('the far galaxy\'s pace', () => {
  it('changes about once every 10 to 30 hours inside a player\'s region, never twice at once', () => {
    const rows: string[] = [];
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const pace = measurePace(coarseWorld(seed, 6), 1000);
      rows.push(`seed ${seed}: ${JSON.stringify(pace)}`);
      expect(pace.doubles, rows.join('\n')).toBe(0);
      // A coarse tick is 24 minutes: 100 ticks are 40 hours, so 1 flip per 100 ticks is one per 40 hours and 4 per 100 is one per 10.
      expect(pace.region, rows.join('\n')).toBeGreaterThan(1);
      expect(pace.region, rows.join('\n')).toBeLessThan(6);
    }
  }, 600000);
});
