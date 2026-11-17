import { describe, expect, it } from 'vitest';
import { content } from '../content';
import { newGame } from '../sim/newGame';
import { runSummary } from '../sim/runSummary';
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
