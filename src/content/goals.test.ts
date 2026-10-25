import { describe, expect, it } from 'vitest';
import { deserialize, newGame, serialize, type Sim } from '../sim';
import { offersHere } from '../sim/galaxy/jobOffers';
import { bumpStat, currentAct } from '../sim/story/goals';
import { content } from '.';
import { goals } from './goals';

/** A second of game time: the goal chain is checked once a second. */
const second = (sim: Sim) => {
  for (let i = 0; i < 20; i++) sim.step();
};

describe('goal chain', () => {
  it('starts on the first act, remembers the home cluster, and marks goals in any order', () => {
    const sim = newGame(3, content);
    second(sim);
    expect(currentAct(sim)?.id).toBe('act.underway');
    expect(sim.story.goals.home).not.toBeNull();
    // Taking a job is counted where it happens.
    const offer = offersHere(sim)[0];
    if (offer) {
      sim.enqueue({ type: 'jobs.accept', key: offer.key });
      sim.step();
    } else bumpStat(sim, 'jobsTaken');
    second(sim);
    expect(sim.story.goals.done).toContain('goal.take_job');
    expect(sim.story.goals.done).not.toContain('goal.first_trade');
  });

  it('finishing an act pays its reward and opens the next; the last one sets goals.done', () => {
    const sim = newGame(3, content);
    second(sim);
    const credits = sim.trade.credits;
    // Act 1: a second node visited, a trade, a job taken and done.
    sim.galaxy.visited['elsewhere'] = sim.tick;
    for (const s of ['trades', 'jobsTaken', 'jobsDone']) bumpStat(sim, s);
    second(sim);
    expect(sim.trade.credits).toBe(credits + goals[0]!.reward.credits!);
    expect(currentAct(sim)?.id).toBe('act.flying');
    expect(sim.story.goals.done).toEqual([]);
    for (const s of ['fuelBought', 'built', 'gathered', 'repaired']) bumpStat(sim, s);
    second(sim);
    expect(currentAct(sim)?.id).toBe('act.beyond');
    for (const s of ['kills', 'bountiesDone']) bumpStat(sim, s);
    second(sim);
    // Still home: the last goal waits for another cluster.
    expect(currentAct(sim)?.id).toBe('act.beyond');
    sim.story.goals.home = 'somewhere else';
    second(sim);
    expect(currentAct(sim)).toBeNull();
    expect(sim.story.flags['goals.done']).toBe(1);
  });

  it('can be skipped, and saves', () => {
    const sim = newGame(3, content);
    bumpStat(sim, 'trades');
    second(sim);
    const back = deserialize(serialize(sim), content);
    expect(back.story.goals).toEqual(sim.story.goals);
    sim.enqueue({ type: 'story.skipGoals' });
    sim.step();
    expect(currentAct(sim)).toBeNull();
  });
});
