import { describe, expect, it } from 'vitest';
import { designFromLayout } from './design';
import { addModule, addRoom, deleteRoom, moveModule, paint, removeModule, takeModuleId, type Layout } from './layout';
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
  it('returns the same array when nothing moved', () => {
    const { l } = base();
    const d = designFromLayout(l, 't');
    const pins = [newPin(1, 'a', 7, 7, { kind: 'module', id: 0 }, l, d), newPin(2, 'b', 20, 20, { kind: 'free' }, l, d)];
    expect(rebase(pins, l, d)).toBe(pins);
  });
});
