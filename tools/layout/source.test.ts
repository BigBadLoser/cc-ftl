import { describe, expect, it } from 'vitest';
import { problemsOf } from './problems';
import { buildLayout, DEFAULT_SOURCE, outposts, specOf } from './source';

describe('asteroid outposts in the import', () => {
  it('lists every outpost kind the game builds', () => {
    expect(outposts()).toEqual(['trading', 'farming', 'mining', 'pirate', 'criminal', 'covert']);
  });
  it('builds a trading outpost as the game does: a prefab base on ground, neutral, of the trading station kind', () => {
    const s = { ...DEFAULT_SOURCE, kind: 'outpost' as const, id: 'trading', seed: 1 };
    const { layout, label } = buildLayout(s);
    expect(label).toBe('trading outpost seed 1');
    expect(specOf(s)).toBe('outpost.trading');
    expect(layout.ground).toBe(true);
    expect(layout.origin).toEqual({ gen: { faction: 'station.trading', seed: 1, depth: 0, role: 'outpost' }, side: 'neutral' });
    expect(layout.rooms.length).toBeGreaterThan(3);
    expect(layout.modules.length).toBeGreaterThan(10);
    expect(problemsOf(layout).filter((p) => /disconnected|unreachable/.test(p.text))).toEqual([]);
  });
  it('a dug outpost is hostile and stands in the rock, not on ground', () => {
    const { layout } = buildLayout({ ...DEFAULT_SOURCE, kind: 'outpost', id: 'pirate', seed: 2 });
    expect(layout.ground).toBeUndefined();
    expect(layout.origin?.side).toBe('hostile');
    expect(layout.modules.length).toBeGreaterThan(0);
  });
});

describe('the ground a base stands on', () => {
  it('is the same rectangle for the grid and the preview, and none for a design in space', async () => {
    const { groundRect } = await import('./ground');
    const { PAD } = await import('./layout');
    const { layout } = buildLayout({ ...DEFAULT_SOURCE, kind: 'outpost', id: 'trading', seed: 1 });
    expect(groundRect(layout)).toEqual({ x: PAD - 3, y: PAD - 3, w: layout.width - 2 * (PAD - 3), h: layout.height - 2 * (PAD - 3) });
    expect(groundRect({ ...layout, ground: undefined } as typeof layout)).toBeNull();
  });
});
