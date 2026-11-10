/** Away sites and crew schedules (#412, docs/DESIGN.md "Schedules", user decisions 2026-11-10): who goes, and who comes home when. */
import { describe, expect, it } from 'vitest';
import { AssignmentC, JobC, NeedsC, type Job, type Sim } from '../../sim';
import { AwayC, SiteRunC } from '../../sim/away/components';
import { passageFits } from '../../sim/away/crew';
import { passagesOf } from '../../sim/away/passage';
import { hourAt } from '../../sim/clock';
import { blockNow, secToSleep } from '../../sim/crew/schedule';
import { TICK_HZ } from '../../sim/time';
import { AWAY_GO_STAY_SEC } from '../../sim/tuning';
import { crewOn, landed, play } from './awayFixture';
import { boarding } from './salvage404Fixture';

const block = (sim: Sim, id: number, from: number, to: number, b: 'any' | 'work' | 'sleep' | 'free'): void => {
  sim.enqueue({ type: 'crew.schedule.set', id, from: ((from % 24) + 24) % 24, to: ((to % 24) + 24) % 24, block: b });
  sim.applyCommands();
};

describe('away sites and schedules', () => {
  it('a passage goes on duty up to near Sleep, when the stay is worth the flight; not in a Sleep block', () => {
    const { sim, shuttle, crew } = boarding();
    const job = sim.world.get(passagesOf(sim, shuttle)[0]!, JobC) as Job;
    const c = crew[0]!;
    Object.assign(sim.world.get(c, NeedsC)!, { rest: 100, hunger: 100 });
    const h = hourAt(sim.tick);
    block(sim, c, 0, 23, 'work');
    block(sim, c, h + 4, h + 4, 'sleep'); // Sleep in under four game hours: shorter than the minimum stay, still worth the flight
    expect(secToSleep(sim, c)).toBeLessThan(AWAY_GO_STAY_SEC);
    expect(passageFits(sim, c, job)).toBe(true);
    block(sim, c, h, h, 'sleep');
    expect(passageFits(sim, c, job)).toBe(false);
  });

  it('a party member whose Sleep starts takes the shuttle home at once; one in Free works on while it is away, then goes home', () => {
    const { sim, home, wreck, shuttle, party } = landed(6);
    expect(party.length).toBeGreaterThanOrEqual(2);
    const [sleeper, free] = party as [number, number];
    for (const id of party) {
      Object.assign(sim.world.get(id, NeedsC)!, { rest: 100, hunger: 100 });
      block(sim, id, 0, 23, 'work');
    }
    block(sim, sleeper, 0, 23, 'sleep');
    play(sim, 60 * TICK_HZ, () => sim.world.get(shuttle, SiteRunC)?.phase === 'home');
    expect(sim.world.get(shuttle, SiteRunC)?.phase).toBe('home'); // the trip left for the sleeper alone, not after the batch wait
    // Free with the shuttle away: Free on a site reads as Work, and they work on.
    block(sim, free, 0, 23, 'free');
    play(sim, 5 * TICK_HZ);
    expect(sim.world.has(free, AwayC)).toBe(true);
    expect(blockNow(sim, free)).toBe('work');
    expect(sim.world.get(free, AssignmentC)).toBeDefined();
    play(sim, 240 * TICK_HZ, () => !sim.world.has(sleeper, AwayC) && !sim.world.has(free, AwayC));
    expect(crewOn(sim, home)).toEqual(expect.arrayContaining([sleeper, free])); // the shuttle came back and took them home
    expect(crewOn(sim, wreck)).not.toContain(free);
  });
});
