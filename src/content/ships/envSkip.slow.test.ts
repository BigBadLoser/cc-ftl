import { describe, it } from 'vitest';
import { expectEnvSkipEquivalent } from '../../../test/support/fixtures/envSkip';

describe('environment solver skipping, every tick', () => {
  it('gives exactly the full solve, tick by tick, through doors, a breach, smoke, a fire and a power cut', () => {
    expectEnvSkipEquivalent(1);
  }, 120_000);
});
