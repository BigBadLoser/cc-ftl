import { describe, expect, it } from 'vitest';
import { designFromLayout, retarget } from './design';
import { addModule, addRoom, deleteRoom, moveModule, paint, removeModule, splitRoom, takeModuleId, takeRoomId, type Layout } from './layout';
import { anchorFor, describeAnchor, newPin, rebase } from './pins';
import { blankLayout } from './source';

const base = (): { l: Layout; room: number } => {
  const { layout, id } = addRoom(blankLayout(30, 24), { x: 5, y: 5, w: 10, h: 8 }, 'cargo');
  return { l: addModule(paint(layout, [[9, 12]], 'D'), { def: 'module.chair', x: 7, y: 7, rot: 0 }), room: id };
};

describe('pins', () => {
  it('attach to what is under the cursor: module, door, wall, room, floor; Alt drops free', () => {
    const { l, room } = base();
    const d = designFromLayout(l, 't');
    expect(anchorFor(l, d, 7, 7, false)).toEqual({ kind: 'module', id: 0 });
    expect(anchorFor(l, d, 9, 12, false)).toEqual({ kind: 'door', x: 9, y: 12 });
    expect(anchorFor(l, d, 4, 8, false)).toEqual({ kind: 'wall', x: 4, y: 8 });
    expect(anchorFor(l, d, 11, 9, false)).toEqual({ kind: 'room', id: room });
    expect(anchorFor(l, d, 20, 20, false)).toEqual({ kind: 'free' });
    expect(anchorFor(l, d, 7, 7, true)).toEqual({ kind: 'free' });
  });
  it('a module pin follows the module when it moves, and keeps its offset', () => {
    const { l } = base();
    const pin = newPin(1, 'chair is in the way', 7.5, 7.25, { kind: 'module', id: 0 }, l, designFromLayout(l, 't'));
    const moved = moveModule(l, 0, 10, 9, 0);
    const [p] = rebase([pin], moved, designFromLayout(moved, 't'));
    expect(p).toMatchObject({ x: 10.5, y: 9.25, orphan: false });
  });
  it('a room pin follows the room when it grows', () => {
    const { l, room } = base();
    const d = designFromLayout(l, 't');
    const pin = newPin(1, 'too small', 10, 9, { kind: 'room', id: room }, l, d);
    const grown = paint(l, [[15, 8], [15, 9], [15, 10]], '_', room);
    const [p] = rebase([pin], grown, designFromLayout(grown, 't'));
    expect(p?.x).toBeGreaterThan(10);
    expect(p?.orphan).toBe(false);
  });
  it('deleting the feature keeps the note, orphaned and where it was; undoing the delete revives it', () => {
    const { l, room } = base();
    const d = designFromLayout(l, 't');
    const onModule = newPin(1, 'a', 7, 7, { kind: 'module', id: 0 }, l, d);
    const onDoor = newPin(2, 'b', 9, 12, { kind: 'door', x: 9, y: 12 }, l, d);
    const onRoom = newPin(3, 'c', 10, 9, { kind: 'room', id: room }, l, d);
    const gone = deleteRoom(paint(removeModule(l, 0), [[9, 12]], '.'), room);
    const orphans = rebase([onModule, onDoor, onRoom], gone, designFromLayout(gone, 't'));
    expect(orphans.map((p) => p.orphan)).toEqual([true, true, true]);
    expect(orphans.map((p) => [p.x, p.y])).toEqual([[7, 7], [9, 12], [10, 9]]);
    expect(describeAnchor(orphans[0]!, gone, designFromLayout(gone, 't'))).toContain('gone');
    const back = rebase(orphans, l, d);
    expect(back.map((p) => p.orphan)).toEqual([false, false, false]);
  });
  it('a removed module id is never handed out again, so its pin stays orphaned', () => {
    const { l } = base();
    const cut = removeModule(l, 0);
    const again = addModule(cut, { def: 'module.chair', x: 7, y: 7, rot: 0 });
    expect(again.moduleIds).toEqual([1]);
    const pin = newPin(1, 'a', 7, 7, { kind: 'module', id: 0 }, l, designFromLayout(l, 't'));
    expect(rebase([pin], again, designFromLayout(again, 't'))[0]?.orphan).toBe(true);
  });
  it('an id is never reused after an undo: add, pin, undo, add another leaves the pin orphaned', () => {
    const { layout } = addRoom(blankLayout(30, 24), { x: 5, y: 5, w: 10, h: 8 }, 'cargo');
    let mark = 0;
    const first = takeModuleId(layout, mark);
    mark = first.mark;
    const withA = addModule(layout, { def: 'module.chair', x: 7, y: 7, rot: 0 }, first.id);
    const pin = newPin(1, 'a', 7, 7, { kind: 'module', id: first.id }, withA, designFromLayout(withA, 't'));
    // undo goes back to the layout before the add (its own counter is back at 0), the session mark stays
    const second = takeModuleId(layout, mark);
    expect(second.id).not.toBe(first.id);
    const withB = addModule(layout, { def: 'module.chair', x: 7, y: 7, rot: 0 }, second.id);
    expect(rebase([pin], withB, designFromLayout(withB, 't'))[0]?.orphan).toBe(true);
  });
  it('a room id is never reused after an undo: draw, pin, undo, draw another leaves the pin orphaned', () => {
    const { layout } = addRoom(blankLayout(40, 24), { x: 5, y: 5, w: 8, h: 6 }, 'cargo');
    let mark = 0;
    const t1 = takeRoomId(layout, mark);
    mark = t1.mark;
    const a = addRoom(layout, { x: 20, y: 5, w: 6, h: 5 }, 'cabin', t1.id);
    expect(a.id).toBe(t1.id);
    const pin = newPin(1, 'cabin is small', 22, 7, { kind: 'room', id: a.id }, a.layout, designFromLayout(a.layout, 't'));
    // undo: back to `layout`, whose own room count is lower again; the session mark is not
    const t2 = takeRoomId(layout, mark);
    expect(t2.id).not.toBe(t1.id);
    const b = addRoom(layout, { x: 20, y: 5, w: 6, h: 5 }, 'mess', t2.id);
    const d = designFromLayout(b.layout, 't');
    expect(d.rooms[t2.id]?.role).toBe('mess');
    expect(rebase([pin], b.layout, d)[0]?.orphan).toBe(true);
    // the gap an undo left holds no tiles and does not show as a room
    expect(d.rooms.filter((r) => r.tiles > 0)).toHaveLength(2);
  });
  it('a split half takes a fresh id too', () => {
    const { layout, id } = addRoom(blankLayout(40, 24), { x: 5, y: 5, w: 8, h: 6 }, 'cargo');
    let mark = 0;
    const t1 = takeRoomId(layout, mark);
    mark = t1.mark;
    const first = splitRoom(layout, id, 'v', t1.id);
    expect(first?.id).toBe(t1.id);
    const pin = newPin(1, 'half', 11, 7, { kind: 'room', id: t1.id }, first!.layout, designFromLayout(first!.layout, 't'));
    const t2 = takeRoomId(layout, mark);
    const second = splitRoom(layout, id, 'h', t2.id);
    expect(second?.id).not.toBe(t1.id);
    expect(rebase([pin], second!.layout, designFromLayout(second!.layout, 't'))[0]?.orphan).toBe(true);
  });
  it('a pick on the original design maps to the edited design by module id, or to nothing', () => {
    const { l } = base();
    const two = addModule(l, { def: 'module.chair', x: 10, y: 9, rot: 0 });
    const edited = removeModule(two, 0); // the first module is gone: the second moves to index 0
    const shown = designFromLayout(two, 'o'), now = designFromLayout(edited, 'e');
    expect(retarget(shown, now, { kind: 'module', id: 1 })).toEqual({ kind: 'module', id: 1 });
    expect(retarget(shown, now, { kind: 'module', id: 0 })).toBeNull();
    expect(retarget(shown, now, { kind: 'room', id: 0 })).toEqual({ kind: 'room', id: 0 });
    expect(retarget(shown, designFromLayout(deleteRoom(edited, 0), 'x'), { kind: 'room', id: 0 })).toBeNull();
  });
  it('returns the same array when nothing moved', () => {
    const { l } = base();
    const d = designFromLayout(l, 't');
    const pins = [newPin(1, 'a', 7, 7, { kind: 'module', id: 0 }, l, d), newPin(2, 'b', 20, 20, { kind: 'free' }, l, d)];
    expect(rebase(pins, l, d)).toBe(pins);
  });
});
