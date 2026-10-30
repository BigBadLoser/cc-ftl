import { describe, expect, it } from 'vitest';
import { DecisionRecorder, diffDecisions, type Decision } from './decisions';
import { buildScenario } from './scenarios';

describe('DecisionRecorder', () => {
  const run = (): Decision[] => {
    const sim = buildScenario('haul', 1);
    const rec = new DecisionRecorder();
    for (let i = 0; i < 30; i++) {
      sim.step();
      sim.events.drain();
      rec.observe(sim);
    }
    return rec.decisions;
  };

  it('records assignments, the same on every run of one seed', () => {
    const a = run();
    expect(a.length).toBeGreaterThan(20);
    expect(a.some((x) => x.kind === 'haul')).toBe(true);
    expect(diffDecisions(a, run()).identical).toBe(true);
  }, 120000); // two runs of the 500-stack haul scenario: ~20 s alone, more under load
});
