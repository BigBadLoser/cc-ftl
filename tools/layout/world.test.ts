import { describe, expect, it } from 'vitest';
import { ModuleC } from '../../src/sim';
import { ORIGIN } from './camera';
import { buildLayout, DEFAULT_SOURCE } from './source';
import { buildWorld, sameShell, swapModules, type World } from './world';
import type { Layout } from './layout';

/** The modules a world's sim holds, as def|x|y|rot keys relative to the layout, sorted. */
const held = (w: World): string[] => w.sim.world.query(ModuleC).map((id) => { const m = w.sim.world.get(id, ModuleC)!; return `${m.def}|${m.x - ORIGIN}|${m.y - ORIGIN}|${m.rot}`; }).sort();

describe('swapModules', () => {
  it('leaves the sim holding what a fresh stamp of the edited layout holds', () => {
    const a = buildLayout(DEFAULT_SOURCE).layout;
    const w = buildWorld(a)!;
    const plain = a.modules.findIndex((m) => !/container|airlock|bay|stasis/.test(m.def));
    const b: Layout = { ...a, modules: a.modules.filter((_, i) => i !== plain) };
    expect(sameShell(a, b)).toBe(true);
    expect(swapModules(w, a, b)).toBe(true);
    expect(held(w)).toEqual(held(buildWorld(b)!));
    expect(swapModules(w, b, a)).toBe(true);
    expect(held(w)).toEqual(held(buildWorld(a)!));
  });

  it('refuses a tile edit (sameShell false)', () => {
    const a = buildLayout(DEFAULT_SOURCE).layout;
    const cells = [...a.cells]; cells[0] = (cells[0] ?? '').replace(/./, (c) => (c === '.' ? '#' : '.'));
    expect(sameShell(a, { ...a, cells })).toBe(false);
  });
});
