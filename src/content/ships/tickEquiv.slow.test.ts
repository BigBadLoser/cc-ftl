import { describe, it } from 'vitest';
import { expectTickEquivalent } from '../../../test/support/fixtures/tickEquiv';

describe('tick-cost changes are exact, every tick', () => {
  it('matches the previous doors, helm, power and modules code byte for byte through combat in a populated node', () => {
    expectTickEquivalent(1);
  }, 120_000);
});
