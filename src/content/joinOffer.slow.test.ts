import { describe, expect, it } from 'vitest';
import { carryOf, JOIN_WAIT_SEC } from '../sim/galaxy/joinOffer';
import { atDestination, step } from '../../test/support/fixtures/joinOffer';

describe('a passenger asks to join, the whole wait', () => {
  it('left unanswered, the ask lapses as a no', () => {
    const { sim, crew, seen } = atDestination(7);
    step(sim, seen, 20 * (JOIN_WAIT_SEC + 2));
    expect(carryOf(sim, crew)?.asking ?? undefined).toBeUndefined();
    expect(seen.sent).toBeGreaterThan(0);
  });
});
