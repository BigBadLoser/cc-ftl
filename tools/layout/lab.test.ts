import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('./previewHost', () => ({ preview: {} })); // the preview needs a DOM
import { exists, liveRoom } from './design';
import { addRoom, moduleIndex, shapeTiles, stroke, type Layout } from './layout';
import { describeChanges, changeItems } from './changes';
import { caseOf, decodeLayout, encodeLayout, marksOf, parseCase, serializeCase } from './cases';
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

describe('id marks survive a save and a load', () => {
  const roundTrip = (): void => {
    const file = parseCase(serializeCase(lab.caseFile('t') as never));
    lab.hist = null; lab.idMarkForTest(0, 0);
    lab.loadCase(file);
  };
  it('a note orphaned by an undo stays orphaned after save, load and a new addition', () => {
    start();
    const l0 = lab.layout as Layout;
    lab.provenance = { ...DEFAULT_SOURCE, spec: specOf(DEFAULT_SOURCE), generator: 'x' };
    lab.original = l0;
    lab.placeModule('module.chair', 14, 7, 0); // id 2
    const id = (lab.layout as Layout).moduleIds[2] as number;
    lab.addPin(14, 7, false);
    expect(lab.pins[0]?.anchor).toEqual({ kind: 'module', id });
    lab.undo();
    expect(lab.pins[0]?.orphan).toBe(true);
    roundTrip();
    lab.placeModule('module.chair', 14, 7, 0);
    const added = (lab.layout as Layout).moduleIds.at(-1) as number;
    expect(added).toBeGreaterThan(id);
    expect(lab.pins[0]?.orphan).toBe(true);
  });
  it('an older case without marks still starts above its notes', () => {
    start();
    lab.provenance = { ...DEFAULT_SOURCE, spec: specOf(DEFAULT_SOURCE), generator: 'x' };
    const file = lab.caseFile('t') as ReturnType<typeof lab.caseFile> & object;
    delete file.marks;
    file.notes = [{ id: 1, text: '', x: 0, y: 0, orphan: true, dx: 0, dy: 0, anchor: { kind: 'module', id: 99 } }];
    expect(marksOf(file, [blankLayout(4, 4)]).module).toBe(100);
  });
});

describe('rotating the selected module', () => {
  it('is refused when the turned footprint would overlap a neighbour, with no undo entry', () => {
    start();
    const bed = (lab.layout as Layout).moduleIds.length; // the next id's index
    expect(lab.placeModule('module.bed', 12, 11, 0)).toBe(true);
    for (const [x, y] of [[13, 11], [11, 11], [11, 12], [13, 12], [12, 10], [12, 13]] as const) lab.placeModule('module.chair', x, y, 0);
    lab.selected = { kind: 'module', id: (lab.layout as Layout).moduleIds[bed] as number };
    const before = lab.layout, past = lab.hist!.past.length;
    lab.rotateSelected();
    expect(lab.layout).toBe(before);
    expect(lab.hist!.past.length).toBe(past);
  });
  it('turns the module when the space is free', () => {
    start();
    expect(lab.placeModule('module.bed', 16, 11, 0)).toBe(true);
    const id = (lab.layout as Layout).moduleIds.at(-1) as number;
    lab.selected = { kind: 'module', id };
    lab.rotateSelected();
    const l = lab.layout as Layout;
    expect(l.modules[moduleIndex(l, id)]?.rot).toBe(1);
  });
});

describe('rotating a container', () => {
  it('turns its clamp with it, so a turned container on a frame stays valid', () => {
    start();
    const base = lab.layout as Layout;
    // a frame: beams x5..14, y8..13, hull wall on the east column
    const cells = base.cells.map((r, y) => (y >= 8 && y <= 13 ? `${r.slice(0, 5)}${'='.repeat(10)}#${r.slice(16)}` : r));
    lab.hist = { past: [], present: { ...base, cells }, future: [] } as never;
    expect(lab.placeModule('container.2x4', 6, 9, 0)).toBe(true);
    const id = (lab.layout as Layout).moduleIds.at(-1) as number;
    lab.selected = { kind: 'module', id };
    lab.rotateSelected();
    const l = lab.layout as Layout;
    const m = l.modules[moduleIndex(l, id)];
    expect(m?.rot).toBe(1);
    expect(m?.clamp).toBe('e');
  });
});

describe('the ship name', () => {
  it('is the title: an import starts with its label, and a rename shows at once (one undo step)', async () => {
    const { renameShip } = await import('./ship');
    lab.import({ ...DEFAULT_SOURCE, kind: 'blank', id: '' });
    expect(lab.design?.label).toBe('Blank grid');
    expect(lab.layout?.name).toBe('Blank grid');
    lab.edit((l) => renameShip(l, 'Hauler'));
    expect(lab.design?.label).toBe('Hauler');
    lab.undo();
    expect(lab.design?.label).toBe('Blank grid');
  });
});

describe('a shape stroke is one undo step (#464)', () => {
  it('a wall line and a floor rectangle each undo in one step', () => {
    start();
    const before = lab.layout as Layout;
    lab.edit((cur) => stroke(cur, 'wall', false, shapeTiles('wall', [22, 2], [28, 2])));
    lab.edit((cur) => stroke(cur, 'floor', false, shapeTiles('floor', [22, 10], [26, 12])));
    expect((lab.layout as Layout).cells[2]?.slice(22, 29)).toBe('#######');
    lab.undo();
    expect((lab.layout as Layout).cells[10]?.[22]).toBe('.');
    lab.undo();
    expect((lab.layout as Layout).cells).toEqual(before.cells);
  });
});
