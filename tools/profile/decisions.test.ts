import { describe, expect, it } from 'vitest';
import { DecisionRecorder, diffDecisions, formatDiff, parseDecisions, serializeDecisions, type Decision } from './decisions';
import { buildScenario } from './scenarios';

const d = (t: number, c: number, job: number, kind = 'build', x = 1, y = 1): Decision => ({ t, c, job, kind, cat: 'construction', x, y });

const base = [d(1, 10, 100), d(1, 11, 101), d(5, 10, 0, '-', 0, 0), d(6, 10, 102), d(9, 12, 103)];

describe('diffDecisions', () => {
  it('reports identical runs', () => {
    const r = diffDecisions(base, [...base]);
    expect(r.identical).toBe(true);
    expect(formatDiff(r)).toContain('IDENTICAL: 5');
  });

  it('finds a known divergence: same crew and tick, different job', () => {
    const b = base.map((x) => ({ ...x }));
    b[3] = d(6, 10, 999);
    const r = diffDecisions(base, b, { context: 2 });
    expect(r.identical).toBe(false);
    const v = r.divergence!;
    expect(v.tick).toBe(6);
    expect(v.reason).toBe('job');
    expect(v.a?.job).toBe(102);
    expect(v.b?.job).toBe(999);
    expect(v.before.map((x) => x.t)).toEqual([1, 5]);
    expect(v.tickA).toHaveLength(1);
    const text = formatDiff(r, { a: 'old', b: 'new' });
    expect(text).toContain('DIVERGED at tick 6');
    expect(text).toContain('old:');
    expect(text).toContain('job 999');
  });

  it('finds a decision that one run never made, and a run that ends early', () => {
    const missing = base.filter((x) => x.job !== 101);
    const r1 = diffDecisions(base, missing);
    expect(r1.divergence).toMatchObject({ tick: 1, reason: 'onlyA' });
    const r2 = diffDecisions(base, base.slice(0, 3));
    expect(r2.divergence).toMatchObject({ tick: 6, reason: 'onlyA', b: undefined });
    const r3 = diffDecisions(base.slice(0, 3), base);
    expect(r3.divergence?.reason).toBe('onlyB');
  });

  it('does not depend on the order of decisions within a tick', () => {
    const swapped = [base[1]!, base[0]!, ...base.slice(2)];
    expect(diffDecisions(base, swapped).identical).toBe(true);
  });

  it('matches by site when job ids have shifted', () => {
    const shifted = base.map((x) => (x.job ? { ...x, job: x.job + 1000 } : { ...x }));
    expect(diffDecisions(base, shifted).identical).toBe(false);
    expect(diffDecisions(base, shifted, { match: 'site' }).identical).toBe(true);
  });
});

describe('decision files', () => {
  it('round trips and rejects malformed input with a line number', () => {
    const header = { format: 'cc-ftl-decisions/1' as const, scenario: 'x', seed: 1, ticks: 9 };
    const parsed = parseDecisions(serializeDecisions(header, base));
    expect(parsed.header).toEqual(header);
    expect(parsed.decisions).toEqual(base);
    expect(() => parseDecisions('')).toThrow(/empty/);
    expect(() => parseDecisions('{"format":"other"}\n')).toThrow(/header/);
    expect(() => parseDecisions(serializeDecisions(header, base) + 'not json\n', 'f.jsonl')).toThrow(/f.jsonl: line 7/);
    expect(() => parseDecisions(serializeDecisions(header, base) + '{"t":1}\n')).toThrow(/not a decision/);
  });
});

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
  }, 120000);
});
