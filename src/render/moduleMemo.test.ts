import { describe, expect, it } from 'vitest';
import type { Module } from '../sim/modules/components';
import type { ModuleDef } from '../sim/registry';
import { animFrame, FLICKER_DARK_MS, FLICKER_LIT_MS } from './moduleArt';
import { artClock, sameInputs, setModuleMemo, type ModuleMemo } from './moduleMemo';

describe('module memo', () => {
  it('the art clock changes whenever an animation frame, the flicker phase or the ruin blip does', () => {
    for (let t = 0; t < 5000; t += 7) {
      const u = t + 7;
      const moved = animFrame(t, 1e9) !== animFrame(u, 1e9)
        || (t % (FLICKER_LIT_MS + FLICKER_DARK_MS) < FLICKER_LIT_MS) !== (u % (FLICKER_LIT_MS + FLICKER_DARK_MS) < FLICKER_LIT_MS)
        || Math.floor(t / 170) !== Math.floor(u / 170);
      expect(artClock(t) !== artClock(u)).toBe(moved);
    }
  });

  it('matches only the same inputs, and never animated modules or with the memo off', () => {
    const m = { def: 'd', x: 1, y: 2, rot: 0, hp: 10, powered: true, enabled: true } as Module;
    const def = { asset: 'a' } as ModuleDef;
    const memo: ModuleMemo = { def: 'd', x: 1, y: 2, rot: 0, hp: 10, powered: true, enabled: true, active: false, extra: '', host: 3, clock: null, tiles: [], dark: 1 };
    expect(sameInputs(memo, m, def, false, '', 3, 123)).toBe(true);
    expect(sameInputs(memo, { ...m, hp: 9 }, def, false, '', 3, 123)).toBe(false);
    expect(sameInputs(memo, m, def, true, '', 3, 123)).toBe(false);
    expect(sameInputs(memo, m, def, false, 'full', 3, 123)).toBe(false);
    expect(sameInputs(memo, m, def, false, '', 4, 123)).toBe(false);
    expect(sameInputs({ ...memo, clock: 5 }, m, def, false, '', 3, 6)).toBe(false);
    expect(sameInputs(memo, m, { ...def, vehicleBay: {} } as unknown as ModuleDef, false, '', 3, 123)).toBe(false);
    setModuleMemo(false);
    try {
      expect(sameInputs(memo, m, def, false, '', 3, 123)).toBe(false);
    } finally {
      setModuleMemo(true);
    }
  });
});
