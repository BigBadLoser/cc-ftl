import { afterEach, describe, expect, it, vi } from 'vitest';
import { animNow, animPaused, setAnimPaused } from './animClock';

describe('animation clock', () => {
  afterEach(() => {
    setAnimPaused(false);
    vi.restoreAllMocks();
  });

  it('runs with real time, stands still while paused, and resumes where it stopped', () => {
    let real = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => real);
    const t0 = animNow();
    real += 500;
    expect(animNow() - t0).toBe(500);
    setAnimPaused(true);
    expect(animPaused()).toBe(true);
    const frozen = animNow();
    real += 3000;
    expect(animNow()).toBe(frozen);
    setAnimPaused(true); // idempotent: a second pause does not move the freeze point
    real += 1000;
    expect(animNow()).toBe(frozen);
    setAnimPaused(false);
    expect(animNow()).toBe(frozen); // no jump on resume: the paused time is skipped
    real += 250;
    expect(animNow()).toBe(frozen + 250);
  });
});
