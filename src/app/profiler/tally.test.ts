import { describe, expect, it } from 'vitest';
import { Tally } from './tally';

function clock() {
  let t = 0;
  return { now: () => t, advance: (ms: number) => void (t += ms) };
}

describe('Tally', () => {
  it('computes calls, total, mean and max', () => {
    const c = clock();
    const t = new Tally(c.now);
    for (const ms of [1, 2, 3, 6]) {
      t.begin('a');
      c.advance(ms);
      t.end('a');
    }
    const s = t.stats.get('a')!;
    expect(s.calls).toBe(4);
    expect(s.total).toBe(12);
    expect(s.mean).toBe(3);
    expect(s.max).toBe(6);
  });

  it('computes nearest-rank p95', () => {
    const c = clock();
    const t = new Tally(c.now);
    for (let i = 1; i <= 100; i++) {
      t.begin('a');
      c.advance(i);
      t.end('a');
    }
    expect(t.stats.get('a')!.p95).toBe(95);
  });

  it('p95 describes the rolling window, not the whole history', () => {
    const c = clock();
    const t = new Tally(c.now);
    for (let i = 0; i < 2000; i++) {
      t.begin('a');
      c.advance(i < 500 ? 100 : 1);
      t.end('a');
    }
    expect(t.stats.get('a')!.p95).toBe(1);
    expect(t.stats.get('a')!.max).toBe(100);
  });

  it('subtracts nested labels from self time', () => {
    const c = clock();
    const t = new Tally(c.now);
    t.begin('outer');
    c.advance(2);
    t.begin('inner');
    c.advance(5);
    t.end('inner');
    c.advance(1);
    t.end('outer');
    expect(t.stats.get('outer')!.total).toBe(8);
    expect(t.stats.get('outer')!.self).toBe(3);
    expect(t.stats.get('inner')!.self).toBe(5);
  });

  it('counts values separately from timers', () => {
    const t = new Tally(() => 0);
    t.count('draws', 10);
    t.count('draws', 20);
    t.count('ticks');
    const s = t.stats.get('draws')!;
    expect(s.isCount).toBe(true);
    expect(s.total).toBe(30);
    expect(s.mean).toBe(15);
    expect(t.stats.get('ticks')!.total).toBe(1);
  });

  it('closes stale inner spans when an outer end arrives, and ignores unknown ends', () => {
    const c = clock();
    const t = new Tally(c.now);
    t.begin('outer');
    t.begin('threw');
    c.advance(4);
    t.end('outer');
    t.end('nothing');
    expect(t.stats.get('threw')!.total).toBe(4);
    expect(t.stats.get('outer')!.self).toBe(0);
    expect(t.stats.has('nothing')).toBe(false);
  });

  it('takeFrame returns this frame only, and reset clears everything', () => {
    const c = clock();
    const t = new Tally(c.now);
    t.begin('a');
    c.advance(2);
    t.end('a');
    expect(t.takeFrame().map((f) => [f.label, f.total])).toEqual([['a', 2]]);
    expect(t.takeFrame()).toEqual([]);
    t.reset();
    expect(t.stats.size).toBe(0);
  });
});

describe('Tally excluded spans', () => {
  it('times the span on its own and removes it from every open span, total and self', () => {
    const c = clock();
    const t = new Tally(c.now);
    t.begin('frame');
    t.begin('tick');
    c.advance(1);
    t.excluded('observe', () => c.advance(10));
    c.advance(1);
    t.end('tick');
    t.end('frame');
    expect(t.stats.get('tick')).toMatchObject({ total: 2, self: 2 });
    expect(t.stats.get('frame')).toMatchObject({ total: 2, self: 0 });
    expect(t.excludedStats.get('observe')).toMatchObject({ calls: 1, total: 10 });
    expect(t.stats.has('observe')).toBe(false);
    expect(t.takeFrame().map((s) => s.label)).not.toContain('observe');
  });

  it('counts nested excluded spans once and still removes the time if fn throws', () => {
    const c = clock();
    const t = new Tally(c.now);
    t.begin('tick');
    expect(() => t.excluded('observe', () => { c.advance(3); t.excluded('inner', () => c.advance(4)); throw new Error('x'); })).toThrow('x');
    t.end('tick');
    expect(t.stats.get('tick')!.total).toBe(0);
    expect(t.excludedStats.get('observe')!.total).toBe(7);
    expect(t.excludedStats.has('inner')).toBe(false);
  });
});
