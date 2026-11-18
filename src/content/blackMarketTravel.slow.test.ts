import { describe, it } from 'vitest';
import { expectDenMarkets } from '../../test/support/fixtures/blackMarket';

describe('lesser services on the galaxy, the whole sweep', () => {
  it('about a quarter of pirate dens are markets, by a seeded roll; a market has the truce and a plain den stays hostile', () => {
    expectDenMarkets([11, 12, 13, 14]);
  });
});
