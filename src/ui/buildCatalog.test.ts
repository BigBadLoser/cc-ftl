import { describe, expect, it } from 'vitest';
import { costForRun, moduleChips, previewGeometry, rotateAccess, windowChips, windowSizeOf, type Entry } from './buildCatalog';

describe('previewGeometry', () => {
  it('marks every access tile (the game table has two stools), and none for a module without one', () => {
    const box = { w: 300, h: 200 };
    const two = previewGeometry(2, 1, [rotateAccess(2, 1, 0, 0, 1), rotateAccess(2, 1, 0, 1, -1)], null, box);
    expect(two.access).toHaveLength(2);
    expect(two.accessLabel).toHaveLength(2);
    expect(new Set(two.access).size).toBe(2);
    const none = previewGeometry(1, 1, [], null, box);
    expect(none.access).toEqual([]);
    expect(none.accessLabel).toEqual([]);
  });
});

describe('window size chips', () => {
  it('lists 2, 3 and 4 tiles with the picked size on, 3 when unset', () => {
    expect(windowChips(undefined).map((c) => [c.id, c.label, c.on])).toEqual([['window-2', '2 tiles', false], ['window-3', '3 tiles', true], ['window-4', '4 tiles', false]]);
    expect(windowChips(4).filter((c) => c.on).map((c) => c.id)).toEqual(['window-4']);
  });
  it('reads a chip id back as a size, and only a valid one', () => {
    expect(windowSizeOf('window-2')).toBe(2);
    expect(windowSizeOf('window-5')).toBeNull();
    expect(windowSizeOf('bar.mk1')).toBeNull();
  });
  it('costs a run per tile', () => {
    expect(costForRun([{ item: 'item.metal', name: 'Metal', count: 2 }, { item: 'item.polymer', name: 'Polymer', count: 1 }] as never, 4).map((c) => c.count)).toEqual([8, 4]);
  });
  it('module chips mark the current member and label by variant label, tier or name', () => {
    const m = (id: string, def: object): Entry => ({ key: id, id, name: id, kind: 'module', def } as unknown as Entry);
    const chips = moduleChips([m('a', { tier: 'Mk I' }), m('b', { variantLabel: 'Long' })], 'b');
    expect(chips.map((c) => [c.label, c.on, c.thumbId])).toEqual([['Mk I', false, undefined], ['Long', true, 'b']]);
  });
});
