import { describe, expect, it } from 'vitest';
import { nextHeatRate } from './heatRate';

describe('nextHeatRate', () => {
  it('waits for enough ticks before sampling', () => {
    const a = nextHeatRate(0, { tick: 0, pct: 10 }, { tick: 3, pct: 20 }, 20);
    expect(a.rate).toBe(0);
    expect(a.last.tick).toBe(0);
  });
  it('measures % per game second', () => {
    expect(nextHeatRate(0, { tick: 0, pct: 10 }, { tick: 20, pct: 14 }, 20).rate).toBeCloseTo(4);
    expect(nextHeatRate(0, { tick: 0, pct: 50 }, { tick: 40, pct: 42 }, 20).rate).toBeCloseTo(-4);
  });
  it('smooths against the previous rate', () => {
    const r = nextHeatRate(4, { tick: 0, pct: 0 }, { tick: 20, pct: 0 }, 20).rate;
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThan(4);
  });
  it('restarts after a tick rewind (a load)', () => {
    const r = nextHeatRate(3, { tick: 100, pct: 10 }, { tick: 5, pct: 10 }, 20);
    expect(r.rate).toBe(3);
    expect(r.last.tick).toBe(5);
  });
});
