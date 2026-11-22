import { describe, expect, it } from 'vitest';
import { exploredWorld, measurePace } from '../../test/support/fixtures/coarse';

/**
 * The pace of the far galaxy on the map a player really has (30 jumps out, then 8 more jumps per coarse tick, 150 ticks, about 60 hours at 1x) on several
 * seeds: the map changes now and then, not wildly, with little back-and-forth, and a player never sees two changes nearby between two looks. The fast
 * guard of the same claims is in `galaxyCoarse.test.ts` (one seed, 60 ticks).
 */
describe('the far galaxy\'s pace', () => {
  it('changes steadily near the player, with little ping-pong, never twice at once', () => {
    const rows: string[] = [];
    let flipped = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const { sim, walker } = exploredWorld(seed, 30);
      const pace = measurePace(sim, walker, 150);
      rows.push(`seed ${seed}: ${JSON.stringify(pace)}`);
      expect(pace.doubles, rows.join('\n')).toBe(0);
      expect(pace.retakes, rows.join('\n')).toBeLessThanOrEqual(0.45);
      // One coarse tick is 24 minutes: 4 flips per 100 ticks in the region would be one per 10 hours.
      expect(pace.region, rows.join('\n')).toBeLessThan(4);
      if (pace.galaxy > 0) flipped++;
    }
    expect(flipped, rows.join('\n')).toBeGreaterThanOrEqual(4);
  }, 900000);
});
