import { describe, expect, it } from 'vitest';
import { content } from '../content';
import { addCredits } from '../sim/trade/credits';
import { deserialize, newGame, runSummary, serialize } from '../sim';

describe('run summary', () => {
  it('tracks the best credits ever held, past a later drop, and keeps it through a save', () => {
    const sim = newGame(3, content);
    const start = sim.trade.credits;
    addCredits(sim, 500);
    sim.trade.credits = 120;
    const s = runSummary(sim);
    expect(s).toMatchObject({ bestCredits: start + 500, credits: 120, jumps: 0, seconds: 0 });
    expect(runSummary(deserialize(serialize(sim), content)).bestCredits).toBe(start + 500);
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

describe('best credits from the start', () => {
  it('a new game and an old save count what they hold, so a purchase before any tick cannot lower the best', () => {
    const fresh = newGame(3, content);
    const start = fresh.trade.credits;
    expect(start).toBeGreaterThan(0);
    fresh.trade.credits -= start; // spent while paused
    expect(runSummary(fresh).bestCredits).toBe(start);

    const old = newGame(3, content);
    delete old.trade.bestCredits;
    const loaded = deserialize(serialize(old), content);
    loaded.trade.credits -= start;
    expect(runSummary(loaded).bestCredits).toBe(start);
  });
});
