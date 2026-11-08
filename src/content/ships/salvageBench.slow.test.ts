import { describe, expect, it } from 'vitest';
import { runBench, setupBench } from './salvageBench';

/**
 * Guard for `salvageBench.soak.test.ts` (the salvage throughput bench, docs/ARCHITECTURE.md "Throughput check", #286): the same short smoke
 * on the bench wreck, 3 game minutes instead of 5. The soak file keeps the 5-minute smoke and the 2-game-hour runs (`SALVAGE_BENCH=1`).
 */
describe('salvage throughput bench (guard)', () => {
  it('runs: a short shift on the bench wreck brings scrap home, and the same seed gives the same run', () => {
    const quick = (): ReturnType<typeof runBench> => runBench(setupBench(1, { crew: 6, airlock: false }), 20 * 60 * 3);
    const a = quick();
    expect(a.scrap).toBeGreaterThan(0);
    expect(a.stripped).toBeGreaterThan(0);
    expect(quick()).toEqual(a);
  }, 120000);
});
