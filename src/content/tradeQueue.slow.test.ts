import { describe, expect, it } from 'vitest';
import { playerItems } from '../sim/trade/player';
import { METAL, agree, runOut, setup, step, stockOf } from '../../test/support/fixtures/tradeQueue';

/** The queue tests from the first deal's start: tradeQueue.test.ts starts the same cases with the first buy already on its way home. */
describe('queued deals, the whole run', () => {
  it('a second buy waits behind the first, holds nothing, then runs after it', () => {
    const { sim, st } = setup();
    const start = sim.trade.credits;
    const first = agree(sim, st, [], [METAL])!;
    const stock1 = stockOf(sim, st, 'item.metal');
    const credits1 = sim.trade.credits;
    const second = agree(sim, st, [], [METAL])!;
    expect(first.phase).not.toBe('queued');
    expect(second.phase).toBe('queued');
    expect(second.held).toBe(0);
    expect(sim.trade.credits).toBe(credits1); // nothing escrowed for the waiting deal
    expect(stockOf(sim, st, 'item.metal')).toBe(stock1);
    const metal0 = playerItems(sim, 'item.metal');
    runOut(sim);
    for (let i = 0; i < 300; i++) step(sim);
    expect(first.phase).toBe('done');
    expect(second.phase).toBe('done');
    expect(playerItems(sim, 'item.metal') - metal0).toBe(20);
    expect(start - sim.trade.credits).toBeGreaterThan(0);
    expect(first.held + second.held).toBe(0);
  });

  it('a buy plus a sell: the sell waits for its goods and both settle', () => {
    const { sim, st } = setup();
    const first = agree(sim, st, [], [METAL])!;
    const second = agree(sim, st, [{ item: 'item.metal', count: 5 }], [])!;
    expect(first.phase).not.toBe('queued');
    expect(second).toBeDefined();
    expect(second.phase).toBe('queued');
    runOut(sim);
    expect(first.phase).toBe('done');
    expect(second.phase).toBe('done');
  });

  it('cancelling the second deal costs nothing and leaves the first running', () => {
    const { sim, st } = setup();
    const first = agree(sim, st, [], [METAL])!;
    const credits = sim.trade.credits;
    const stock = stockOf(sim, st, 'item.metal');
    const second = agree(sim, st, [], [METAL])!;
    sim.enqueue({ type: 'trade.cancel', id: second.id });
    step(sim);
    expect(second.phase).toBe('failed');
    expect(second.reason).toBe('cancelled');
    expect(sim.trade.credits).toBe(credits);
    expect(stockOf(sim, st, 'item.metal')).toBe(stock);
    runOut(sim);
    expect(first.phase).toBe('done');
  });
});
