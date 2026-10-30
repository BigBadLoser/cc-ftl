import { describe, expect, it } from 'vitest';
import { createSettings, DEFAULT_SETTINGS, SETTINGS_STORE } from './settings';

const memory = () => {
  const m = new Map<string, string>();
  return { m, s: { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) } };
};

describe('settings', () => {
  it('persist per profile, notify, and reset', () => {
    const { s } = memory();
    const a = createSettings(() => s);
    const seen: boolean[] = [];
    a.subscribe((v) => seen.push(v.edgeScroll));
    a.set({ edgeScroll: true, zoomSpeed: 1.5 });
    expect(seen).toEqual([false, true]);
    expect(createSettings(() => s).get()).toMatchObject({ edgeScroll: true, zoomSpeed: 1.5 });
    a.reset();
    expect(createSettings(() => s).get()).toEqual(DEFAULT_SETTINGS);
  });

  it('drop values of the wrong type or out of range, and survive blocked storage', () => {
    const { m, s } = memory();
    m.set(SETTINGS_STORE, JSON.stringify({ zoomSpeed: 9, scrollSpeed: 'fast', startSpeed: 7, tooltips: false }));
    expect(createSettings(() => s).get()).toEqual({ ...DEFAULT_SETTINGS, tooltips: false });
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    const b = createSettings(() => broken);
    b.set({ showFps: true });
    expect(b.get().showFps).toBe(true);
  });
});
