import { describe, expect, it } from 'vitest';
import { exploredWorld, measurePace } from '../../test/support/fixtures/coarse';

/**
 * The pace of the far galaxy on the map a player really has (a new game with its warm-up history, 30 jumps out, then 8 more jumps per coarse tick, 150 ticks, about
 * 60 hours at 1x) on several seeds: the player's region changes hands about once per 3 to 5 hours, not wildly, with little back-and-forth, a player never sees two
 * changes nearby between two looks, and wars start and end a handful of times a day, not constantly. The fast guard of the same claims is in `galaxyCoarse.test.ts`
 * (one seed, 60 ticks).
 */
describe('the far galaxy\'s pace', () => {
  it('changes steadily near the player, with little ping-pong, never twice at once, and wars come and go', () => {
    const rows: string[] = [];
    let flipped = 0;
    let warred = 0;
    let region = 0;
    const seeds = [1, 2, 3, 4, 5, 6];
    for (const seed of seeds) {
      const { sim, walker } = exploredWorld(seed, 30);
      const pace = measurePace(sim, walker, 150);
      rows.push(`seed ${seed}: ${JSON.stringify(pace)}`);
      expect(pace.doubles, rows.join('\n')).toBe(0);
      expect(pace.retakes, rows.join('\n')).toBeLessThanOrEqual(0.25);
      // One coarse tick is 24 minutes: 20 flips per 100 ticks in the region would be one per 2 hours.
      expect(pace.region, rows.join('\n')).toBeLessThan(20);
      // A day is 60 ticks: 100 ticks is 1.7 days. Wars starting and ending together stay under about 6 a day (10 per 100 ticks).
      expect(pace.starts + pace.ends, rows.join('\n')).toBeLessThan(20);
      if (pace.galaxy > 0) flipped++;
      if (pace.starts + pace.ends > 0) warred++;
      region += pace.region;
    }
    expect(flipped, rows.join('\n')).toBe(seeds.length);
    expect(warred, rows.join('\n')).toBeGreaterThanOrEqual(5);
    // About 8 flips per 100 ticks on average (one per 5 hours) or more.
    expect(region / seeds.length, rows.join('\n')).toBeGreaterThanOrEqual(6);
  }, 900000);
});
