import { describe, expect, it } from 'vitest';
import { ACTIONS } from './actions';
import { chordLabel, chordOf, createKeymap, KEYS_STORE, overlaps } from './bindings';

const memory = () => {
  const m = new Map<string, string>();
  return { m, s: { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) } };
};
const press = (code: string, shiftKey = false) => ({ code, shiftKey });

describe('key map', () => {
  it('has no clashing defaults', () => {
    const km = createKeymap(() => null);
    for (const a of ACTIONS) for (const c of a.keys) expect(km.conflicts(a.id, c), `${a.id} ${c}`).toEqual([]);
  });

  it('matches chords with Shift exactly, the same way the conflict check reads them', () => {
    const km = createKeymap(() => null);
    expect(km.matches(press('KeyQ'), 'combat.weapon1')).toBe(true);
    expect(km.matches(press('KeyQ', true), 'combat.weapon1')).toBe(false);
    expect(km.matches(press('KeyQ', true), 'combat.mode1')).toBe(true);
    // Pan down on Shift+Up: no conflict with Pan up on Up, and at run time each key moves one way only.
    expect(km.conflicts('cam.down', 'Shift+ArrowUp')).toEqual([]);
    km.bind('cam.down', 1, 'Shift+ArrowUp');
    expect(km.matches(press('ArrowUp'), 'cam.up')).toBe(true);
    expect(km.matches(press('ArrowUp'), 'cam.down')).toBe(false);
    expect(km.matches(press('ArrowUp', true), 'cam.down')).toBe(true);
    expect(km.matches(press('ArrowUp', true), 'cam.up')).toBe(false);
  });

  it('rebinds, persists only the changes, and resets per group or all', () => {
    const { m, s } = memory();
    const km = createKeymap(() => s);
    km.bind('combat.volley', 0, 'KeyB');
    expect(km.keys('combat.volley')).toEqual(['KeyB']);
    expect(JSON.parse(m.get(KEYS_STORE)!)).toEqual({ 'combat.volley': ['KeyB'] });
    expect(createKeymap(() => s).keys('combat.volley')).toEqual(['KeyB']);
    km.bind('game.pause', 1, 'KeyP');
    km.reset('combat');
    expect(km.keys('combat.volley')).toEqual(['KeyV']);
    expect(km.keys('game.pause')).toEqual(['Space', 'KeyP']);
    km.reset();
    expect(km.keys('game.pause')).toEqual(['Space']);
  });

  it('finds conflicts in overlapping contexts and swaps keys on request', () => {
    const km = createKeymap(() => null);
    expect(km.conflicts('combat.volley', 'KeyH')).toEqual(['combat.holdAll']);
    expect(km.conflicts('combat.volley', 'Space')).toEqual(['game.pause']); // global overlaps everything
    km.bind('combat.volley', 0, 'KeyH', true);
    expect(km.keys('combat.volley')).toEqual(['KeyH']);
    expect(km.keys('combat.holdAll')).toEqual(['KeyV']);
  });

  it('never rebinds Esc, and clears a slot on null', () => {
    const km = createKeymap(() => null);
    km.bind('ui.menu', 0, 'KeyX');
    expect(km.keys('ui.menu')).toEqual(['Escape']);
    km.bind('cam.up', 1, null);
    expect(km.keys('cam.up')).toEqual(['KeyW']);
  });

  it('ignores junk in storage', () => {
    const { m, s } = memory();
    m.set(KEYS_STORE, '{"combat.volley": 5, "nope": ["KeyX"], "ui.menu": ["KeyX"]');
    expect(createKeymap(() => s).keys('combat.volley')).toEqual(['KeyV']);
  });

  it('names chords for badges and reads them from events', () => {
    expect(chordLabel('KeyQ')).toBe('Q');
    expect(chordLabel('Shift+Digit1')).toBe('Shift+1');
    expect(chordLabel('ArrowUp')).toBe('↑');
    expect(chordOf(press('ShiftLeft', true))).toBeNull();
    expect(chordOf(press('KeyR', true))).toBe('Shift+KeyR');
  });

  it('lets R draft crew, rotate a module and pick weapon 4 on purpose', () => {
    const byId = new Map(ACTIONS.map((a) => [a.id, a]));
    expect(overlaps(byId.get('crew.draft')!, byId.get('combat.weapon4')!)).toBe(false);
    expect(overlaps(byId.get('combat.volley')!, byId.get('game.pause')!)).toBe(true);
  });
});
