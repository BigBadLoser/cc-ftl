import { describe, expect, it } from 'vitest';
import { content } from '../../content';
import { newGame, pipeline, serialize, systemLabels, type Probe } from '../../sim';

function fake(): { probe: Probe; log: string[] } {
  const log: string[] = [];
  return {
    log,
    probe: { begin: (l) => log.push(`+${l}`), end: (l) => log.push(`-${l}`), count: (l, n = 1) => log.push(`#${l}:${n}`) },
  };
}

describe('pipeline probe', () => {
  it('labels every system uniquely', () => {
    expect(systemLabels.length).toBe(pipeline.length);
    expect(new Set(systemLabels).size).toBe(pipeline.length);
    expect(systemLabels.every((l) => /^sim\/[a-zA-Z]+$/.test(l))).toBe(true);
  });

  it('wraps the tick and every system, in pipeline order', () => {
    const sim = newGame(1, content);
    const { probe, log } = fake();
    sim.step(probe);
    const expected = ['+sim/tick', '+sim/commands', '-sim/commands', ...systemLabels.flatMap((l) => [`+${l}`, `-${l}`]), '-sim/tick'];
    expect(log).toEqual(expected);
  });

  it('does not change the simulation', () => {
    const a = newGame(7, content);
    const b = newGame(7, content);
    const { probe } = fake();
    for (let i = 0; i < 50; i++) {
      a.step();
      b.step(probe);
    }
    expect(b.tick).toBe(a.tick);
    expect(b.world.entityCount).toBe(a.world.entityCount);
    expect(serialize(b)).toBe(serialize(a));
  });
});
