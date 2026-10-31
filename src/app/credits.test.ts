import { describe, expect, it } from 'vitest';
import { content } from '../content';
import { newGame, runSummary } from '../sim';
import { addCredits } from '../sim/trade/credits';

describe('best credits', () => {
  it('counts credits gained by a command while paused (no tick), even if spent before the next one', () => {
    const sim = newGame(3, content);
    const start = sim.trade.credits;
    addCredits(sim, 800); // a job hand-in
    sim.trade.credits -= 800; // spent at once (a blueprint)
    expect(runSummary(sim).bestCredits).toBe(start + 800);
  });
});
