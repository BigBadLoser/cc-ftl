import { describe, expect, it } from 'vitest';
import { snapScale } from './starmapGpu';

describe('starmap scale grid', () => {
  it('snaps to sixteenths of an octave, idempotently, and keeps powers of two', () => {
    expect(snapScale(1)).toBe(1);
    expect(snapScale(2)).toBe(2);
    const s = snapScale(1.18);
    expect(s).toBeCloseTo(2 ** (4 / 16), 10);
    expect(snapScale(s)).toBeCloseTo(s, 12);
    expect(Math.abs(Math.log2(snapScale(0.37) / 0.37))).toBeLessThanOrEqual(1 / 32 + 1e-9);
  });
});
