import { describe, expect, it } from 'vitest';
import { SCAN_FRAMES, SCAN_PERIOD_MS, scanFrame } from './recoveryArt';

describe('recovery pod scanner timing', () => {
  it('sweeps once per period for SCAN_FRAMES frames, in order, then rests', () => {
    const seen: number[] = [];
    for (let t = 0; t < SCAN_PERIOD_MS; t += 250) seen.push(scanFrame(t, 7));
    const on = seen.filter((f) => f >= 0);
    expect(on).toHaveLength(SCAN_FRAMES);
    expect(seen.length - on.length).toBe(SCAN_PERIOD_MS / 250 - SCAN_FRAMES);
    const start = seen.indexOf(0);
    for (let i = 0; i < SCAN_FRAMES; i++) expect(seen[(start + i) % seen.length]).toBe(i);
  });

  it('gives different pods different offsets', () => {
    const firstScan = (id: number): number => {
      for (let t = 0; t < SCAN_PERIOD_MS; t += 250) if (scanFrame(t, id) === 0) return t;
      return -1;
    };
    expect(new Set([1, 2, 3, 4, 5].map(firstScan)).size).toBe(5);
  });
});
