import { describe, expect, it } from 'vitest';
import { advance } from './loop';

describe('advance', () => {
  it('runs one step per 50ms at 20Hz 1x and carries remainder', () => {
    let r = advance(0, 120, 1);
    expect(r.steps).toBe(2);
    expect(r.acc).toBeCloseTo(20);
    r = advance(r.acc, 30, 1);
    expect(r.steps).toBe(1);
    expect(r.acc).toBeCloseTo(0);
  });
  it('scales with speed', () => {
    expect(advance(0, 100, 3).steps).toBe(5);
    expect(advance(0, 50, 2).steps).toBe(2);
  });
  it('does nothing when paused', () => {
    expect(advance(30, 1000, 0)).toEqual({ steps: 0, acc: 0 });
  });
  it('clamps catch-up and drops backlog', () => {
    const r = advance(0, 10_000, 1);
    expect(r.steps).toBe(5);
    expect(r.acc).toBe(0);
  });
  it('ignores negative dt', () => {
    expect(advance(10, -5, 1).steps).toBe(0);
  });
});
