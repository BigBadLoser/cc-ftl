import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('./previewHost', () => ({ preview: {} })); // the preview needs a DOM
import { exists, liveRoom } from './design';
import { addRoom, moduleIndex, type Layout } from './layout';
import { describeChanges, changeItems } from './changes';
import { caseOf, decodeLayout, encodeLayout } from './cases';
import { diffLayouts } from './diff';
import { blankLayout, DEFAULT_SOURCE, specOf } from './source';
type LabType = typeof import('./lab.svelte').lab;

let lab: LabType;
beforeAll(async () => {
  const g = globalThis as unknown as Record<string, unknown>;
  g.window = globalThis;
  lab = (await import('./lab.svelte')).lab;
}, 90_000);

/** A lab on a blank grid with one room and two modules (ids 0 and 1). */
function start(): void {
  lab.hist = null;
  const { layout } = addRoom(blankLayout(30, 24), { x: 5, y: 5, w: 14, h: 10 }, 'cargo');
  lab.import({ ...DEFAULT_SOURCE, kind: 'blank' });
  lab.hist = null;
  lab.original = layout;
  lab.hist = { past: [], present: layout, future: [] } as never;
  lab.placeModule('module.chair', 7, 7, 0);
  lab.placeModule('module.chair', 10, 9, 0);
}
const ids = (): number[] => [...(lab.layout as Layout).moduleIds];

describe('selection is held by stable id', () => {
  it('delete module A, select B, undo: B is still the selected module', () => {
    start();
    expect(ids()).toEqual([0, 1]);
    lab.selected = { kind: 'module', id: 0 };
    lab.removeSelected();
    expect(ids()).toEqual([1]);
    lab.selected = { kind: 'module', id: 1 };
    lab.undo(); // brings A back at index 0: B moves to index 1
    expect(ids()).toEqual([0, 1]);
    expect(lab.selected).toEqual({ kind: 'module', id: 1 });
    lab.rotateSelected();
    const l = lab.layout as Layout;
    expect(l.modules[moduleIndex(l, 1)]?.rot).toBe(1);
    expect(l.modules[moduleIndex(l, 0)]?.rot).toBe(0);
    lab.removeSelected();
    expect(ids()).toEqual([0]);
  });
  it('a selection or hover whose module is gone is cleared', () => {
    start();
    lab.selected = { kind: 'module', id: 1 };
    lab.hover = { kind: 'module', id: 1 };
    lab.undo(); // the second placement is undone
    expect(lab.selected).toBeNull();
    expect(lab.hover).toBeNull();
  });
  it('delete room A, select room B, undo: B stays selected; a deleted room clears', () => {
    start();
    const a = lab.drawRoom({ x: 20, y: 5, w: 4, h: 4 }, 'cabin') as number;
    const b = lab.drawRoom({ x: 20, y: 12, w: 4, h: 4 }, 'bridge') as number;
    lab.selected = { kind: 'room', id: a };
    lab.removeSelected();
    expect(lab.selected).toBeNull();
    lab.selected = { kind: 'room', id: b };
    lab.undo();
    expect(lab.selected).toEqual({ kind: 'room', id: b });
    expect(liveRoom(lab.design!, a)).toBeDefined();
    lab.undo(); // room B undone
    lab.undo();
    expect(lab.selected).toBeNull();
    expect(exists(lab.design!, { kind: 'room', id: b })).toBe(false);
  });
});

describe('padding rooms', () => {
  it('an id gap after an undo adds empty rooms that show nowhere', () => {
    start();
    const first = lab.drawRoom({ x: 20, y: 5, w: 4, h: 4 }, 'cabin') as number;
    lab.undo();
    const second = lab.drawRoom({ x: 20, y: 12, w: 4, h: 4 }, 'bridge') as number;
    expect(second).toBeGreaterThan(first); // ids never repeat
    const l = lab.layout as Layout, orig = lab.original as Layout;
    const empty = l.rooms.map((_, i) => i).filter((i) => !l.roomOf.includes(i));
    expect(empty.length).toBeGreaterThan(0);
    const d = lab.design!;
    expect(d.rooms.filter((r) => r.tiles > 0).length).toBe(2);
    // the change list and diff name only the real new room
    expect(describeChanges(orig, l).filter((t) => /room/i.test(t))).toHaveLength(1);
    expect(changeItems(orig, l).every((c) => !empty.some((i) => c.text.includes(`room ${i} `)))).toBe(true);
    expect(diffLayouts(orig, l).rooms.map((r) => r.id)).toEqual([second]);
    // a saved case holds no trailing padding and still decodes to the same grid
    const file = caseOf('t', { ...DEFAULT_SOURCE, spec: specOf(DEFAULT_SOURCE), generator: 'x' }, orig, l, [], describeChanges(orig, l));
    expect(decodeLayout(file.edited).roomOf).toEqual(l.roomOf);
    expect(file.changes.join('\n')).not.toMatch(/room \d+ hall/i);
  });
  it('trailing padding is not saved', () => {
    const { layout } = addRoom(blankLayout(20, 20), { x: 3, y: 3, w: 5, h: 5 }, 'cargo', 4);
    expect(layout.rooms.length).toBe(5);
    expect(encodeLayout(layout).rooms.length).toBe(5); // id 4 is used
    const onlyZero = addRoom(blankLayout(20, 20), { x: 3, y: 3, w: 5, h: 5 }, 'cargo').layout;
    expect(encodeLayout({ ...onlyZero, rooms: [...onlyZero.rooms, { role: 'hall' }, { role: 'hall' }] }).rooms.length).toBe(1);
  });
});
