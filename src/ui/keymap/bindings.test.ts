import { describe, expect, it } from 'vitest';
import { ACTIONS } from './actions';
import { chordLabel, chordOf, createKeymap, KEYS_STORE, overlaps, type Keymap } from './bindings';
import type { ActionId } from './actions';

const memory = () => {
  const m = new Map<string, string>();
  return { m, s: { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) } };
};
const press = (code: string, shiftKey = false) => ({ code, shiftKey });
/** Every key of every action, checked with the Controls page's own rule. */
const clashes = (km: Keymap) => ACTIONS.flatMap((a) => km.keys(a.id).flatMap((c) => km.conflicts(a.id, c).map((o) => `${a.id}/${o} on ${c}`)));

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

  it('treats Draft as live in a fight: Draft on V clashes with Volley; a build key can still match a combat key', () => {
    const km = createKeymap(() => null);
    expect(km.conflicts('crew.draft', 'KeyV')).toEqual(['combat.volley']);
    expect(km.conflicts('build.rotateBack', 'Shift+KeyR')).toEqual([]); // the build tool is never open in a fight
    expect(km.conflicts('build.rotate', 'KeyV')).toEqual([]);
  });

  it('lets R draft crew, rotate a module and pick weapon 4 on purpose', () => {
    const byId = new Map(ACTIONS.map((a) => [a.id, a]));
    expect(overlaps(byId.get('crew.draft')!, byId.get('combat.weapon4')!)).toBe(false);
    expect(overlaps(byId.get('combat.volley')!, byId.get('game.pause')!)).toBe(true);
  });

  it('a group reset never leaves another group sharing its default key (Codex: Pause V, Volley Space, Reset Combat)', () => {
    const km = createKeymap(() => null);
    km.bind('game.pause', 0, 'KeyV', true); // swap: Volley takes Space
    expect(km.keys('combat.volley')).toEqual(['Space']);
    const lost = km.reset('combat');
    expect(km.keys('combat.volley')).toEqual(['KeyV']);
    expect(km.keys('game.pause')).toEqual([]); // V went back to Volley; Pause is unbound, not sharing
    expect(lost).toEqual([{ id: 'game.pause', chord: 'KeyV', to: ['combat.volley'] }]);
    expect(clashes(km)).toEqual([]);
  });

  it('a swap never hands the displaced key into a second conflict (Codex: Draft to Space)', () => {
    const km = createKeymap(() => null);
    const lost = km.bind('crew.draft', 0, 'Space', true); // Pause would get R, which Rotate module and Select weapon 4 still use
    expect(km.keys('crew.draft')).toEqual(['Space']);
    expect(km.keys('game.pause')).toEqual([]);
    expect(km.keys('build.rotate')).toEqual(['KeyR']);
    expect(km.keys('combat.weapon4')).toEqual(['KeyR']);
    expect(lost).toEqual([{ id: 'game.pause', chord: 'KeyR', to: ['build.rotate', 'combat.weapon4'] }]);
    expect(clashes(km)).toEqual([]);
  });

  it('stays conflict-free after any sequence of rebinds, swaps, clears and resets', () => {
    let seed = 12345;
    const rnd = (n: number) => {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      return seed % n;
    };
    const chords = [...new Set(ACTIONS.flatMap((a) => a.keys))].concat(['KeyB', 'KeyP', 'Shift+KeyV', 'Digit4']);
    const ids = ACTIONS.map((a) => a.id as ActionId);
    const groups = [...new Set(ACTIONS.map((a) => a.group))];
    for (let run = 0; run < 40; run++) {
      const km = createKeymap(() => null);
      for (let step = 0; step < 60; step++) {
        const op = rnd(10);
        const id = ids[rnd(ids.length)]!;
        if (op < 6) km.bind(id, rnd(2), chords[rnd(chords.length)]!, rnd(2) === 1);
        else if (op < 8) km.bind(id, rnd(2), null);
        else if (op < 9) km.reset(groups[rnd(groups.length)]);
        else km.reset();
        expect(clashes(km), `run ${run} step ${step}`).toEqual([]);
      }
    }
  });

  it('a stored map with conflicts loads clean', () => {
    const { m, s } = memory();
    m.set(KEYS_STORE, JSON.stringify({ 'game.pause': ['KeyV'] }));
    const km = createKeymap(() => s);
    expect(clashes(km)).toEqual([]);
  });
});
