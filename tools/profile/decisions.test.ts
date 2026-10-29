import { describe, expect, it } from 'vitest';
import { content } from '../../src/content';
import { CrewC, JobC, PositionC, PrioritiesC, ShipC, homeShip, newGame } from '../../src/sim';
import { Struct } from '../../src/sim/structure';
import { DecisionRecorder, diffDecisions, formatDiff, parseDecisions, serializeDecisions, type Decision } from './decisions';

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

describe('DecisionRecorder and same-step completion', () => {
  /** A one-tick job beside an idle crew member: decide assigns it and work finishes it in the same step. */
  const run = (withProbe: boolean): Decision[] => {
    const sim = newGame(1, content);
    sim.step();
    sim.events.drain();
    const rec = new DecisionRecorder();
    rec.observe(sim);
    const ship = sim.world.get(homeShip(sim), ShipC)!;
    const crew = sim.world.query(CrewC).find((id) => {
      const p = sim.world.get(id, PositionC)!;
      return p.x === p.toX && p.y === p.toY && sim.world.get(id, PrioritiesC)!.construction > 0 && p.x > ship.x + 1;
    })!;
    const p = sim.world.get(crew, PositionC)!;
    const job = sim.world.createEntity();
    sim.world.add(job, JobC, { category: 'construction', kind: 'build', x: p.x - 1, y: p.y, struct: Struct.Door, work: 1, progress: 0, reservedBy: 0 });
    for (let i = 0; i < 5; i++) {
      sim.step(withProbe ? rec.probe(sim) : undefined);
      sim.events.drain();
      rec.observe(sim);
    }
    return rec.decisions;
  };

  it('captures an assignment that is made and finished within one step', () => {
    const withProbe = run(true);
    expect(withProbe.some((d) => d.kind === 'build' && d.job !== 0)).toBe(true);
    const take = withProbe.find((d) => d.job !== 0 && d.kind === 'build')!;
    expect(withProbe.some((d) => d.c === take.c && d.job === 0 && d.t >= take.t)).toBe(true);
    // Without the probe (observing only after the step) the one-tick job leaves no trace: the gap this closes.
    expect(run(false).some((d) => d.kind === 'build' && d.job !== 0)).toBe(false);
  });
});
