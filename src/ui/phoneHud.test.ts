import { describe, expect, it } from 'vitest';
import { GOALS_PHONE_KEY, readGoalsOpen, splitAlerts, writeGoalsOpen } from './phoneHud';

describe('splitAlerts', () => {
  it('is empty for no alerts', () => {
    expect(splitAlerts([])).toEqual({ top: null, rest: [], extra: 0 });
  });
  it('shows the newest and counts the rest', () => {
    expect(splitAlerts(['new', 'mid', 'old'])).toEqual({ top: 'new', rest: ['mid', 'old'], extra: 2 });
  });
  it('has no badge for a single alert', () => {
    expect(splitAlerts(['only']).extra).toBe(0);
  });
});

describe('goals phone state', () => {
  const mem = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  };
  it('starts collapsed and remembers the choice', () => {
    const s = mem();
    expect(readGoalsOpen(() => s)).toBe(false);
    writeGoalsOpen(true, () => s);
    expect(s.getItem(GOALS_PHONE_KEY)).toBe('1');
    expect(readGoalsOpen(() => s)).toBe(true);
    writeGoalsOpen(false, () => s);
    expect(readGoalsOpen(() => s)).toBe(false);
  });
  it('stays collapsed and does not throw when storage is unavailable', () => {
    const bad = () => { throw new Error('blocked'); };
    expect(readGoalsOpen(bad)).toBe(false);
    expect(() => writeGoalsOpen(true, bad)).not.toThrow();
  });
});
