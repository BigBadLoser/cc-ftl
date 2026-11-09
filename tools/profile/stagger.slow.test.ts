import { describe, expect, it } from 'vitest';
import { deserialize, serialize, type Sim } from '../../src/sim';
import { content } from '../../src/content';
import { buildScenario } from './scenarios';

/**
 * The crew evaluation stagger (src/sim/ai/stagger.ts) keeps its timing in saved state (`Intent`): a game saved and loaded at any tick,
 * on or off a crew member's staggered tick, plays on exactly as the uninterrupted run. Busy nodes: salvage beside a hub (away site,
 * suits, passages) and several ships.
 */

const step = (sim: Sim, n: number): void => {
  for (let i = 0; i < n; i++) {
    sim.step();
    sim.events.drain();
  }
};

describe('crew evaluation stagger across a save', () => {
  it.each(['salvageHub', 'multiship'])('%s: a save and load at several ticks plays on identically', (name) => {
    const T = 1600;
    const ref = buildScenario(name, 1);
    step(ref, T);
    const want = serialize(ref);
    for (const at of [211, 777, 1203]) {
      const sim = buildScenario(name, 1);
      step(sim, at);
      const loaded = deserialize(serialize(sim), content);
      step(loaded, T - at);
      expect(serialize(loaded) === want).toBe(true);
    }
  });
});
