import { describe, expect, it } from 'vitest';
import { newGame } from '../sim';
import { ensureAround } from '../sim/galaxy/state';
import { content } from '../content';
import { buildJobs } from './jobsSnapshot';

describe('buildJobs', () => {
  it('lists the offers at the start station with names, rewards and distances, and moves a taken one to the held jobs', () => {
    const sim = newGame(3, content);
    ensureAround(sim, sim.galaxy.current);
    const board = buildJobs(sim);
    expect(board.here).not.toBeNull();
    expect(board.offers.length).toBeGreaterThan(0);
    const o = board.offers[0]!;
    expect(o.id).toBeNull();
    expect(o.title).toMatch(/^(Deliver \d+× .+|Destroy the .+)$/);
    expect(o.hops).toBeGreaterThan(0);
    sim.enqueue({ type: 'jobs.accept', key: o.key });
    sim.step();
    const after = buildJobs(sim);
    expect(after.active.map((j) => j.key)).toEqual([o.key]);
    expect(after.offers.some((j) => j.key === o.key)).toBe(false);
  });
});
