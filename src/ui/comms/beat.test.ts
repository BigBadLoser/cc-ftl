import { afterEach, describe, expect, it, vi } from 'vitest';
import { startBeat } from './beat';

describe('startBeat', () => {
  afterEach(() => vi.useRealTimers());

  it('plays its frames on, off, on, then rests: the glitch', () => {
    vi.useFakeTimers();
    const seen: boolean[] = [];
    const stop = startBeat((v) => seen.push(v), 1000, [70, 50, 70]);
    vi.advanceTimersByTime(1400 + 70 + 50 + 70 + 1); // the longest wait (1.4x), then the three frames
    expect(seen.slice(0, 4)).toEqual([true, false, true, false]);
    stop();
  });

  it('one long frame is the reduced-motion tell: a single hard swap held, then back', () => {
    vi.useFakeTimers();
    const seen: boolean[] = [];
    const stop = startBeat((v) => seen.push(v), 2600, [900]);
    vi.advanceTimersByTime(2600 * 1.4 + 900 + 1);
    expect(seen.slice(0, 2)).toEqual([true, false]);
    stop();
  });

  it('stopping ends the beat and leaves the value at rest', () => {
    vi.useFakeTimers();
    const seen: boolean[] = [];
    startBeat((v) => seen.push(v), 100, [10])();
    vi.advanceTimersByTime(5000);
    expect(seen).toEqual([false]);
  });
});
