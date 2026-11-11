import { describe, expect, it } from 'vitest';
import { centre, diffLayouts } from './diff';
import { addModule, addRoom, moveModule, paint, removeModule, rotateModule, setRole, type Layout } from './layout';
import { blankLayout } from './source';
import { resizeGrid } from './ship';

const base = (): { l: Layout; room: number } => {
  const { layout, id } = addRoom(blankLayout(30, 24), { x: 5, y: 5, w: 8, h: 6 }, 'cargo');
  return { l: addModule(layout, { def: 'module.console', x: 7, y: 7, rot: 0 }), room: id };
};

describe('diff classification', () => {
  it('finds nothing when nothing changed', () => {
    const { l } = base();
    expect(diffLayouts(l, l)).toEqual({ tiles: [], modules: [], rooms: [] });
  });
  it('tiles: added where space became something, removed where something became space, changed when swapped', () => {
    const { l } = base();
    const d = diffLayouts(l, paint(paint(paint(l, [[20, 20]], '_'), [[6, 6]], '#'), [[5, 5]], '.'));
    expect(d.tiles).toContainEqual({ x: 20, y: 20, kind: 'added' });
    expect(d.tiles).toContainEqual({ x: 6, y: 6, kind: 'changed' });
    expect(d.tiles).toContainEqual({ x: 5, y: 5, kind: 'removed' });
  });
  it('doors count as added or removed, not changed', () => {
    const { l } = base();
    const withDoor = paint(l, [[8, 10]], 'D');
    expect(diffLayouts(l, withDoor).tiles).toEqual([{ x: 8, y: 10, kind: 'added' }]);
    expect(diffLayouts(withDoor, l).tiles).toEqual([{ x: 8, y: 10, kind: 'removed' }]);
  });
  it('modules: added, removed and moved are matched by id, so removing another module does not look like a move', () => {
    const { l } = base();
    const two = addModule(l, { def: 'module.console', x: 10, y: 8, rot: 0 });
    const d = diffLayouts(two, moveModule(removeModule(two, 0), 0, 11, 8, 0));
    expect(d.modules).toEqual([
      { kind: 'removed', id: 0, from: two.modules[0] },
      { kind: 'moved', id: 1, from: two.modules[1], to: { def: 'module.console', x: 11, y: 8, rot: 0 } },
    ]);
    expect(diffLayouts(l, addModule(l, { def: 'module.console', x: 9, y: 9, rot: 0 })).modules.map((m) => m.kind)).toEqual(['added']);
    expect(diffLayouts(l, rotateModule(l, 0)).modules.map((m) => m.kind)).toEqual(['moved']);
  });
  it('rooms: retyped, added and removed', () => {
    const { l, room } = base();
    expect(diffLayouts(l, setRole(l, room, 'mess')).rooms).toEqual([{ kind: 'retyped', id: room, from: 'cargo', to: 'mess' }]);
    const more = addRoom(l, { x: 16, y: 5, w: 4, h: 4 }, 'cabin');
    expect(diffLayouts(l, more.layout).rooms).toEqual([{ kind: 'added', id: more.id, to: 'cabin' }]);
    expect(diffLayouts(more.layout, l).rooms.map((r) => r.kind)).toEqual(['removed']);
  });
  it('a module centre is the middle of its tiles', () => {
    expect(centre({ def: 'module.console', x: 7, y: 7, rot: 0 })).toEqual([7, 7]);
  });
});

describe('beam edits', () => {
  const withBeam = (l: Layout, x: number, y: number, ch: string): Layout => ({ ...l, cells: l.cells.map((r, j) => (j === y ? `${r.slice(0, x)}${ch}${r.slice(x + 1)}` : r)) });
  it('painting or erasing a beam shows in the overlay', () => {
    const { l } = base();
    const beam = withBeam(l, 20, 20, '=');
    expect(diffLayouts(l, beam).tiles).toEqual([{ x: 20, y: 20, kind: 'added' }]);
    expect(diffLayouts(beam, l).tiles).toEqual([{ x: 20, y: 20, kind: 'removed' }]);
    expect(diffLayouts(beam, withBeam(l, 20, 20, '_')).tiles).toEqual([{ x: 20, y: 20, kind: 'changed' }]);
    expect(diffLayouts(beam, withBeam(l, 20, 20, '#')).tiles).toEqual([{ x: 20, y: 20, kind: 'changed' }]);
  });
});

describe('diff after a resize', () => {
  it('lists tiles drawn in the grown area, and tiles lost by a shrink', () => {
    const l = blankLayout(20, 20);
    const r = resizeGrid(l, 30, 26);
    if ('error' in r) throw new Error(r.error);
    const edited = paint(r.layout, [[25, 22]], '_');
    expect(diffLayouts(l, edited).tiles).toEqual([{ x: 25, y: 22, kind: 'added' }]);
    expect(diffLayouts(edited, l).tiles).toEqual([{ x: 25, y: 22, kind: 'removed' }]);
  });
});
