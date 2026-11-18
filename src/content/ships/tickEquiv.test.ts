import { describe, it } from 'vitest';
import { expectTickEquivalent } from '../../../test/support/fixtures/tickEquiv';

/**
 * The tick-cost work (doors visit only door tiles while nothing else changed; ship, console and shield helpers test the module's content before
 * looking up its ship; power and modules look the ship up once) must not change a single value: a run of the real pipeline is compared, byte for byte, with
 * a run of the previous code (kept verbatim in test/support/fixtures/tickEquiv.ts), through combat in a populated node and scripted door edits. The fast tier
 * compares the saved states every 10 ticks (the helpers every tick), the slow tier (tickEquiv.slow.test.ts) every tick.
 */
describe('tick-cost changes are exact', () => {
  it('matches the previous doors, helm, power and modules code byte for byte through combat in a populated node', () => {
    expectTickEquivalent(10);
  }, 120_000);
});
