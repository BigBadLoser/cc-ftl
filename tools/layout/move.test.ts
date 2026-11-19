import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('./previewHost', () => ({ preview: {} })); // the preview needs a DOM
import { addModule, addRoom, newModule, type Layout } from './layout';
import { blankLayout } from './source';
type Lab = typeof import('./lab.svelte').lab;
type Move = typeof import('./move.svelte').move;

let lab: Lab, move: Move;
beforeAll(async () => {
  const g = globalThis as unknown as Record<string, unknown>;
  g.window = globalThis;
  lab = (await import('./lab.svelte')).lab;
  move = (await import('./move.svelte')).move;
}, 90_000);

/** A cargo room with walls at 4..11 x 4..9 and a chair (id 0); the Move tool's box over it. */
function start(): Layout {
  const { layout } = addRoom(blankLayout(30, 20), { x: 5, y: 5, w: 6, h: 4 }, 'cargo');
  const l = addModule(layout, newModule('module.bed', 6, 6, 0), 0);
  lab.hist = { past: [], present: l, future: [] };
  lab.idMarkForTest(1, 1);
  lab.setTool('move');
  move.reset();
  move.startMarquee([4, 4]);
  move.dragMarquee([11, 9]);
  move.endMarquee(true);
  return l;
}
const at = (x: number, y: number): string => (lab.layout as Layout).cells[y]?.[x] ?? '?';

describe('the Move tool', () => {
  it('a drag carries the box contents as one undo step; the box follows', () => {
    const l = start();
    expect(move.box).toEqual({ x: 4, y: 4, w: 8, h: 6 });
    move.grab([5, 5]);
    move.drag([10, 8]);
    move.drag([15, 10]);
    move.drop();
    expect(move.box).toEqual({ x: 14, y: 9, w: 8, h: 6 });
    expect(at(4, 4)).toBe('.');
    expect(at(14, 9)).toBe('#');
    expect((lab.layout as Layout).modules[0]).toMatchObject({ x: 16, y: 11 });
    expect(lab.hist?.past).toEqual([l]);
    lab.undo();
    expect(lab.layout).toBe(l);
  });
  it('Esc, or a drag back where it began, leaves no edit', () => {
    const l = start();
    move.grab([5, 5]);
    move.drag([9, 9]);
    move.cancelFloat();
    expect(lab.layout).toBe(l);
    expect(move.box).toEqual({ x: 4, y: 4, w: 8, h: 6 });
    move.grab([5, 5]);
    move.drag([9, 9]);
    move.drag([5, 5]);
    move.drop();
    expect(lab.layout).toBe(l);
    expect(lab.canUndo).toBe(false);
  });
  it('copy and paste: the piece follows the pointer and a click places it with new ids', () => {
    start();
    expect(move.copy()).toBe(true);
    move.pointer = [20, 12];
    move.paste();
    move.drag([22, 12]);
    move.drop();
    const l = lab.layout as Layout;
    expect(l.moduleIds).toEqual([0, 1]);
    expect(move.box).toEqual({ x: 18, y: 9, w: 8, h: 6 });
    expect(l.roomOf[11 * 30 + 20]).toBe(1);
    expect(lab.marks).toEqual({ module: 2, room: 2 });
    expect(lab.hist?.past.length).toBe(1);
  });
  it('cut clears the box; arrows nudge it; changing tool drops the box', () => {
    start();
    move.nudge(1, 0);
    expect(at(4, 4)).toBe('.');
    expect(at(5, 4)).toBe('#');
    expect(move.box?.x).toBe(5);
    move.cut();
    expect(at(5, 4)).toBe('.');
    expect((lab.layout as Layout).modules).toEqual([]);
    expect(move.clip?.modules.length).toBe(1);
    lab.setTool('floor');
    expect(move.box).toBeNull();
  });
});

describe('Move tool turns, duplicates and keeps its clipboard', () => {
  it('R turns the box contents in place as one undo step', () => {
    start();
    move.turn('cw');
    expect(move.box).toEqual({ x: 5, y: 3, w: 6, h: 8 });
    expect((lab.layout as Layout).modules[0]?.rot).toBe(1);
    expect(lab.hist?.past.length).toBe(1);
  });
  it('Alt+drag leaves the original and places a duplicate with new ids', () => {
    const l = start();
    move.grab([5, 5], true);
    move.drag([17, 5]);
    move.drop();
    const now = lab.layout as Layout;
    expect(now.cells[4]?.slice(4, 12)).toBe(l.cells[4]?.slice(4, 12));
    expect(now.cells[4]?.slice(16, 24)).toBe(l.cells[4]?.slice(4, 12));
    expect(now.moduleIds).toEqual([0, 1]);
  });
  it('a copy is saved for the next session', () => {
    const store = new Map<string, string>();
    (globalThis as unknown as { localStorage: unknown }).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) };
    start();
    move.copy();
    expect(JSON.parse(store.get('cc-ftl.layout.clip') as string)).toEqual(move.clip);
  });
});

describe('the keyboard', () => {
  const key = async (k: string, mods: Partial<KeyboardEvent> = {}): Promise<void> => {
    const { onKey } = await import('./keys');
    onKey({ key: k, target: null, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, preventDefault: () => {}, ...mods } as unknown as KeyboardEvent);
  };
  it('[ and ] step the window size, the room type and the armed module', async () => {
    start();
    await key('x');
    lab.windowSize = 3;
    await key(']'); await key(']');
    expect(lab.windowSize).toBe(4);
    await key('[');
    expect(lab.windowSize).toBe(3);
    await key('g');
    const role = lab.role;
    await key(']');
    expect(lab.role).not.toBe(role);
    await key('m');
    lab.armed = null;
    await key(']');
    expect(lab.armed).not.toBeNull();
  });
  it('S, R, Shift+R, arrows and Ctrl+C / Ctrl+V drive the Move tool', async () => {
    start();
    await key('s');
    expect(lab.tool).toBe('move');
    await key('R', { shiftKey: true });
    expect((lab.layout as Layout).modules[0]?.rot).toBe(3);
    await key('r');
    expect((lab.layout as Layout).modules[0]?.rot).toBe(0);
    const x = move.box?.x as number;
    await key('ArrowRight', { shiftKey: true });
    expect(move.box?.x).toBe(x + 5);
    await key('c', { ctrlKey: true });
    await key('v', { ctrlKey: true });
    expect(move.float).not.toBeNull();
    await key('Escape');
    expect(move.float).toBeNull();
  });
});

describe('saved shapes', () => {
  it('Save box keeps the box as a shape; picking it up places a copy', async () => {
    const { shapes } = await import('./shapes.svelte');
    start();
    move.saveShape();
    const s = shapes.list[0];
    expect(s?.piece.w).toBe(8);
    move.pointer = [20, 12];
    move.paste(s?.piece ?? null);
    expect(move.float?.source).toBe(s?.piece);
    move.drop();
    expect((lab.layout as Layout).moduleIds).toEqual([0, 1]);
    shapes.rename(s?.id as number, '  bay  ');
    expect(shapes.list[0]?.name).toBe('bay');
    shapes.remove(s?.id as number);
    expect(shapes.list).toEqual([]);
  });
});
