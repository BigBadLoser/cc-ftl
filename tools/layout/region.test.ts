import { describe, expect, it } from 'vitest';
import { addModule, addRoom, newModule, type Layout } from './layout';
import { clipRect, extract, fitPiece, isEmpty, lift, stamp, wholeRect } from './region';
import { addWindow } from './windows';
import { blankLayout } from './source';

/** A 30x20 grid with a cargo room (walls included at 4..11 x 4..9) holding two beds (ids 0, 1). */
function ship(): Layout {
  const { layout } = addRoom(blankLayout(30, 20), { x: 5, y: 5, w: 6, h: 4 }, 'cargo');
  return addModule(addModule(layout, newModule('module.bed', 6, 6, 0), 0), newModule('module.bed', 8, 7, 0), 1);
}
const box = { x: 4, y: 4, w: 8, h: 6 };
const marks = { module: 2, room: 1 };

describe('region pieces', () => {
  it('a move lifts the room with its walls and modules and stamps it elsewhere, keeping the ids', () => {
    const l = ship();
    const p = extract(l, box);
    expect(p.rooms).toEqual([{ role: 'cargo', id: 0, whole: true }]);
    expect(p.modules.map((m) => m.id)).toEqual([0, 1]);
    const { layout } = stamp(lift(l, box), p, 16, 10, true, marks);
    expect(layout.cells.slice(4, 10).every((r) => r.slice(4, 12) === '........')).toBe(true);
    expect(layout.cells.slice(10, 16).map((r) => r.slice(16, 24))).toEqual(l.cells.slice(4, 10).map((r) => r.slice(4, 12)));
    expect(layout.roomOf[12 * 30 + 18]).toBe(0);
    expect(layout.modules.map((m) => [m.x, m.y])).toEqual([[18, 12], [20, 13]]);
    expect(layout.moduleIds).toEqual([0, 1]);
    expect(layout.rooms.length).toBe(1);
  });
  it('a paste takes new room and module ids from the marks and leaves the original', () => {
    const l = ship();
    const { layout, marks: after } = stamp(l, extract(l, box), 16, 10, false, { module: 5, room: 3 });
    expect(layout.moduleIds).toEqual([0, 1, 5, 6]);
    expect(layout.nextModuleId).toBe(7);
    expect(layout.rooms[3]).toEqual({ role: 'cargo' });
    expect(layout.roomOf[12 * 30 + 18]).toBe(3);
    expect(layout.roomOf[6 * 30 + 6]).toBe(0);
    expect(after).toEqual({ module: 7, room: 4 });
  });
  it('open space in a piece is transparent; a written tile replaces what is under it and drops the modules there', () => {
    const l = ship();
    const p = extract(l, { x: 3, y: 3, w: 10, h: 8 }); // a ring of open space round the room
    const { layout } = stamp(l, p, 5, 3, false, marks); // two tiles right: overlaps the original
    expect(layout.cells[5]?.[4]).toBe('#'); // the original's west wall, under the piece's open ring, stays
    expect(layout.moduleIds).toEqual([2, 3]); // the original beds were written over
  });
  it('a box partly over a module or window grows to hold it whole', () => {
    let l = ship();
    l = addWindow(l, { x: 6, y: 4, axis: 'x', size: 3 });
    expect(wholeRect(l, { x: 6, y: 7, w: 1, h: 1 })).toEqual({ x: 6, y: 6, w: 1, h: 2 }); // the bed is two tiles long
    expect(wholeRect(l, { x: 7, y: 3, w: 1, h: 2 })).toEqual({ x: 6, y: 3, w: 3, h: 2 });
    const p = extract(l, box);
    expect(p.windows).toEqual([{ x: 2, y: 0, axis: 'x', size: 3 }]);
    const { layout } = stamp(lift(l, box), p, 16, 10, true, marks);
    expect(layout.windows).toEqual([{ x: 18, y: 10, axis: 'x', size: 3 }]);
  });
  it('a room only partly in the piece moves as a new room of the same role', () => {
    const l = ship();
    const half = { x: 4, y: 4, w: 4, h: 6 };
    const p = extract(l, half);
    expect(p.rooms[0]?.whole).toBe(false);
    const { layout } = stamp(lift(l, half), p, 20, 10, true, marks);
    expect(layout.roomOf[12 * 30 + 21]).toBe(1);
    expect(layout.rooms[1]).toEqual({ role: 'cargo' });
  });
  it('carries the per-tile template rows, ground cable over open space included', () => {
    const l0 = ship();
    const cable = l0.cells.map((r, y) => (y === 2 ? r.slice(0, 6) + '+' + r.slice(7) : r.replace(/./g, '.')));
    const l = { ...l0, extra: { cable } };
    const r = { x: 4, y: 2, w: 8, h: 8 };
    const { layout } = stamp(lift(l, r), extract(l, r), 16, 10, true, marks);
    expect(layout.extra.cable?.[2]?.[6]).toBe('.');
    expect(layout.extra.cable?.[10]?.[18]).toBe('+');
  });
  it('keeps a piece on the grid and clips a box to it', () => {
    const l = ship();
    const p = extract(l, box);
    expect(fitPiece(l, p, 27, -3)).toEqual([22, 0]);
    expect(clipRect(l, { x: -2, y: 18, w: 5, h: 5 })).toEqual({ x: 0, y: 18, w: 3, h: 2 });
    expect(isEmpty(extract(l, { x: 20, y: 0, w: 3, h: 3 }))).toBe(true);
    expect(isEmpty(p)).toBe(false);
  });
});

describe('lifting a box out of a ship', () => {
  it('leaves a wall where it borders what stays, so a cut room stays sealed', () => {
    const l = ship();
    const out = lift(l, { x: 8, y: 4, w: 4, h: 6 }); // the room's east half
    expect(out.cells[6]?.slice(4, 13)).toBe('#___#....');
    expect(out.cells[4]?.slice(4, 13)).toBe('#####....');
    expect(out.moduleIds).toEqual([0]);
  });
});
