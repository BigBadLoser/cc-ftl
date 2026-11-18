import { describe, it } from 'vitest';
import { expectEnvSkipEquivalent } from '../../../test/support/fixtures/envSkip';

/**
 * The environment solvers skip regions whose inputs are unchanged and reuse cached link lists, conductance and lamp light; a sim rebuilt from its
 * save every tick never has a warm cache. Both runs must stay byte-identical through a scripted scenario that touches every input (the scenario and
 * its explanation are in test/support/fixtures/envSkip.ts). The fast tier compares every 5 ticks, the slow tier (envSkip.slow.test.ts) every tick.
 */
describe('environment solver skipping', () => {
  it('gives exactly the full solve, tick by tick, through doors, a breach, smoke, a fire and a power cut', () => {
    expectEnvSkipEquivalent(5);
  }, 120_000);
});
