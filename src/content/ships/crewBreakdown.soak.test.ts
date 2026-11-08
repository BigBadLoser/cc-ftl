import { describe, expect, it } from 'vitest';
import { CrewC, MoodC, PrioritiesC, TICK_HZ, newGame, type Sim, type SimEvent } from '../../sim';
import { BREAK_BASE_P } from '../../sim/tuning';
import { rollBreak } from '../../sim/crew/breakdown';
import { content } from '../index';

/** Balance check for mental breaks (docs/TRAITS.md section 5): a low-mood crew breaks at about the designed rate, a content crew does not. */

const colonist = (sim: Sim): number => sim.world.query(CrewC).find((c) => sim.world.has(c, PrioritiesC)) as number;

describe('break balance', () => {
  it('a crew member under mood 10 breaks about once per 5-6 minutes of checks (1.5% per 5 s), and one at mood 40 with no stressor never does', () => {
    const sim = newGame(5, content, 'ship.starter', false);
    for (let i = 0; i < 40; i++) sim.step();
    const c = colonist(sim);
    const m = sim.world.get(c, MoodC)!;
    const N = 20000;
    const hits = (mood: number): number => {
      let n = 0;
      for (let k = 0; k < N; k++) {
        m.value = mood;
        sim.tick = k * 100 + 3;
        if (rollBreak(sim, c, m, false)) n++;
      }
      return n;
    };
    const low = hits(5) / N;
    expect(low).toBeGreaterThan(BREAK_BASE_P.risk * 0.8);
    expect(low).toBeLessThan(BREAK_BASE_P.risk * 1.2);
    expect(1 / low / 12).toBeGreaterThan(4.5); // minutes between breaks at 12 checks a minute
    expect(1 / low / 12).toBeLessThan(7);
    expect(hits(40)).toBe(0);
  });

  // One continuous 30-minute run: 66-68 s on CI, over the 60 s default, so the soak tier gives it room.
  it('a content crew breaks never in half an hour of ordinary play', { timeout: 600_000 }, () => {
    const sim = newGame(7, content, 'ship.starter', false);
    const events: SimEvent[] = [];
    for (let i = 0; i < 1800 * TICK_HZ; i++) {
      sim.step();
      if (i % 50 === 0) events.push(...sim.events.drain());
    }
    events.push(...sim.events.drain());
    expect(events.filter((e) => e.type === 'crew.break')).toEqual([]);
  });
});
