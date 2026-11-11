import { describe, expect, it } from 'vitest';
import type { ScheduleBlock } from '../sim';
import { clickSelect, clockText, coverage, coverTone, matchPreset, paintRange, painted, targets } from './schedule';

const row = (fill: ScheduleBlock, ...runs: [ScheduleBlock, number, number][]): ScheduleBlock[] => {
  const r: ScheduleBlock[] = Array.from({ length: 24 }, () => fill);
  for (const [b, f, t] of runs) for (let h = f; h <= t; h++) r[h] = b;
  return r;
};

describe('schedule helpers', () => {
  it('counts crew on Work per hour', () => {
    const c = coverage([row('work', ['sleep', 0, 5]), row('sleep', ['work', 3, 4])]);
    expect(c[0]).toBe(0);
    expect(c[3]).toBe(1);
    expect(c[10]).toBe(1);
    expect(coverTone(0)).toBe('none');
    expect(coverTone(1)).toBe('one');
    expect(coverTone(2)).toBe('ok');
  });
  it('matches a preset or says custom', () => {
    const presets = [{ id: 'a', hours: row('any') }, { id: 'w', hours: row('work') }];
    expect(matchPreset(row('work'), presets)).toBe('w');
    expect(matchPreset(row('work', ['free', 1, 1]), presets)).toBeNull();
  });
  it('paints an inclusive range whichever way the drag went', () => {
    expect(paintRange(7, 3)).toEqual({ from: 3, to: 7 });
    const p = painted(row('work'), 5, 2, 'sleep');
    expect(p.filter((b) => b === 'sleep')).toHaveLength(4);
    expect(p[2]).toBe('sleep');
    expect(p[6]).toBe('work');
  });
  it('formats the clock and handles selection', () => {
    expect(clockText({ hour: 6, minute: 5 })).toBe('06:05');
    expect(clickSelect([], 1, false)).toEqual([1]);
    expect(clickSelect([1], 1, false)).toEqual([]);
    expect(clickSelect([1], 2, true)).toEqual([1, 2]);
    expect(clickSelect([1, 2], 1, true)).toEqual([2]);
    expect(targets([1, 2], 2)).toEqual([1, 2]);
    expect(targets([1, 2], 3)).toEqual([3]);
  });
});
