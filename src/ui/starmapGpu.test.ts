import { describe, expect, it } from 'vitest';
import { snapScale, wheelFactor, zoomTarget } from './starmapGpu';

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

describe('starmap zoom target', () => {
  it('adds up many small steps to the same zoom as one big step', () => {
    let target = 0.5;
    for (let i = 0; i < 100; i++) target = zoomTarget(target, wheelFactor(-1), 0.015, 6);
    expect(target).toBeCloseTo(zoomTarget(0.5, wheelFactor(-100), 0.015, 6), 6);
    expect(snapScale(target)).not.toBe(snapScale(0.5));
  });

  it('zooms by one 1.18 step for a mouse notch, out by the inverse, and clamps', () => {
    expect(wheelFactor(-100)).toBeCloseTo(1.18, 10);
    expect(wheelFactor(100)).toBeCloseTo(1 / 1.18, 10);
    expect(zoomTarget(5.9, 1.18, 0.015, 6)).toBe(6);
    expect(zoomTarget(0.016, 0.5, 0.015, 6)).toBe(0.015);
  });
});
