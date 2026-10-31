import { describe, expect, it } from 'vitest';
import { content } from '../content';
import { deserialize, newGame, runSummary, serialize } from '../sim';
import { tradeSystem } from '../sim/systems/trade';

describe('run summary', () => {
  it('tracks the best credits ever held, past a later drop, and keeps it through a save', () => {
    const sim = newGame(3, content);
    sim.trade.credits = 500;
    tradeSystem(sim);
    sim.trade.credits = 120;
    tradeSystem(sim);
    const s = runSummary(sim);
    expect(s).toMatchObject({ bestCredits: 500, credits: 120, jumps: 0, seconds: 0 });
    expect(runSummary(deserialize(serialize(sim), content)).bestCredits).toBe(500);
  });

  it('counts game seconds and jumps', () => {
    const sim = newGame(3, content);
    sim.tick = 20 * 90 + 5;
    sim.galaxy.jumps = 4;
    expect(runSummary(sim)).toMatchObject({ seconds: 90, jumps: 4 });
  });

  it('reads an older save without the field as the credits it has', () => {
    const sim = newGame(3, content);
    sim.trade.credits = 40;
    delete sim.trade.bestCredits;
    expect(runSummary(deserialize(serialize(sim), content)).bestCredits).toBe(40);
  });
});
