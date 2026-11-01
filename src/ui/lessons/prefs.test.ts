import { describe, expect, it } from 'vitest';
import { createLessonPrefs, PREFS_KEY } from './prefs';

const memory = () => {
  const m = new Map<string, string>();
  return { m, s: { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) } };
};

describe('lesson prefs', () => {
  it('remembers seen lessons and the off switch across instances, and resets', () => {
    const { s } = memory();
    const a = createLessonPrefs(() => s);
    a.markSeen('lesson.combat');
    a.setEnabled(false);
    const b = createLessonPrefs(() => s);
    expect(b.isSeen('lesson.combat')).toBe(true);
    expect(b.enabled()).toBe(false);
    b.reset();
    expect(createLessonPrefs(() => s).isSeen('lesson.combat')).toBe(false);
  });

  it('survives blocked storage and junk', () => {
    const throwing = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    const p = createLessonPrefs(() => throwing);
    p.markSeen('x');
    expect(p.isSeen('x')).toBe(true);
    const { m, s } = memory();
    m.set(PREFS_KEY, '{not json');
    expect(createLessonPrefs(() => s).enabled()).toBe(true);
    expect(createLessonPrefs(() => null).isSeen('x')).toBe(false);
  });
});
