import { describe, expect, it } from 'vitest';
import { centerTop, clampRect, isPinned, moveRect, readNumber, readWindow, resizeRect, splitFraction, windowKey, writeNumber, writeWindow, type Bounds } from './floatingWindow';

const B: Bounds = { left: 8, top: 100, right: 1592, bottom: 892 };
const MIN = { w: 300, h: 200 };
const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe('clampRect', () => {
  it('keeps a rect inside the bounds', () => {
    expect(clampRect({ x: -50, y: 0, w: 400, h: 300 }, B, MIN)).toEqual({ x: 8, y: 100, w: 400, h: 300 });
    expect(clampRect({ x: 1500, y: 800, w: 400, h: 300 }, B, MIN)).toEqual({ x: 1192, y: 592, w: 400, h: 300 });
  });
  it('shrinks an oversize window to the bounds and raises an undersize one to the minimum', () => {
    expect(clampRect({ x: 0, y: 0, w: 5000, h: 5000 }, B, MIN)).toEqual({ x: 8, y: 100, w: 1584, h: 792 });
    expect(clampRect({ x: 50, y: 150, w: 10, h: 10 }, B, MIN)).toEqual({ x: 50, y: 150, w: 300, h: 200 });
  });
  it('lets a tiny viewport win over the minimum', () => {
    const tiny: Bounds = { left: 0, top: 0, right: 200, bottom: 150 };
    expect(clampRect({ x: 30, y: 30, w: 300, h: 300 }, tiny, MIN)).toEqual({ x: 0, y: 0, w: 200, h: 150 });
  });
});

describe('moveRect', () => {
  it('moves by the drag and stops at the edges', () => {
    const s = { x: 100, y: 120, w: 372, h: 500 };
    expect(moveRect(s, 50, 30, B, MIN)).toEqual({ x: 150, y: 150, w: 372, h: 500 });
    expect(moveRect(s, -500, -500, B, MIN)).toEqual({ x: 8, y: 100, w: 372, h: 500 });
    expect(moveRect(s, 5000, 5000, B, MIN)).toEqual({ x: 1220, y: 392, w: 372, h: 500 });
  });
});

describe('resizeRect', () => {
  const s = { x: 100, y: 200, w: 400, h: 400 };
  it('moves only the dragged edge', () => {
    expect(resizeRect(s, 'e', 60, 99, B, MIN)).toEqual({ x: 100, y: 200, w: 460, h: 400 });
    expect(resizeRect(s, 's', 99, 40, B, MIN)).toEqual({ x: 100, y: 200, w: 400, h: 440 });
  });
  it('keeps the far edge fixed when dragging the left or top edge', () => {
    expect(resizeRect(s, 'w', -50, 0, B, MIN)).toEqual({ x: 50, y: 200, w: 450, h: 400 });
    expect(resizeRect(s, 'n', 0, -80, B, MIN)).toEqual({ x: 100, y: 120, w: 400, h: 480 });
  });
  it('corners move two edges', () => {
    expect(resizeRect(s, 'nw', -20, -30, B, MIN)).toEqual({ x: 80, y: 170, w: 420, h: 430 });
    expect(resizeRect(s, 'se', 20, 30, B, MIN)).toEqual({ x: 100, y: 200, w: 420, h: 430 });
  });
  it('enforces the minimum size without moving the fixed edge', () => {
    expect(resizeRect(s, 'w', 900, 0, B, MIN)).toEqual({ x: 200, y: 200, w: 300, h: 400 });
    expect(resizeRect(s, 'n', 0, 900, B, MIN)).toEqual({ x: 100, y: 400, w: 400, h: 200 });
    expect(resizeRect(s, 'se', -900, -900, B, MIN)).toEqual({ x: 100, y: 200, w: 300, h: 200 });
  });
  it('does not grow past the bounds', () => {
    expect(resizeRect(s, 'se', 5000, 5000, B, MIN)).toEqual({ x: 100, y: 200, w: 1492, h: 692 });
    expect(resizeRect(s, 'nw', -5000, -5000, B, MIN)).toEqual({ x: 8, y: 100, w: 492, h: 500 });
  });
});

describe('centerTop', () => {
  it('centres in the bounds below their top, and shrinks to fit', () => {
    expect(centerTop(B, 560)).toEqual({ x: 520, y: 100, w: 560, h: 0 });
    expect(centerTop({ ...B, left: 388 }, 560, 300, 4)).toEqual({ x: 710, y: 104, w: 560, h: 300 });
    expect(centerTop({ left: 0, top: 0, right: 300, bottom: 100 }, 560).w).toBe(300);
  });
});

describe('splitFraction', () => {
  it('gives the top the share above the splitter', () => {
    expect(splitFraction(300, 600, 100, 100)).toBeCloseTo(0.5);
  });
  it('keeps both parts at their minimum', () => {
    expect(splitFraction(10, 600, 150, 100)).toBeCloseTo(0.25);
    expect(splitFraction(590, 600, 150, 100)).toBeCloseTo(500 / 600);
  });
});

describe('window memory', () => {
  it('starts at the default spot, unpinned', () => {
    expect(readWindow('combat', () => mem())).toEqual({ rect: null, pinned: false });
  });
  it('round-trips position, size and pin per panel id', () => {
    const s = mem();
    writeWindow('combat', { rect: { x: 10, y: 20, w: 400, h: 500 }, pinned: true }, () => s);
    expect(readWindow('combat', () => s)).toEqual({ rect: { x: 10, y: 20, w: 400, h: 500 }, pinned: true });
    expect(readWindow('jobs', () => s)).toEqual({ rect: null, pinned: false });
    expect(s.getItem(windowKey('combat'))).not.toBeNull();
  });
  it('reports pin state', () => {
    const s = mem();
    expect(isPinned('jobs', () => s)).toBe(false);
    writeWindow('jobs', { rect: null, pinned: true }, () => s);
    expect(isPinned('jobs', () => s)).toBe(true);
  });
  it('ignores malformed data and survives unavailable storage', () => {
    const s = mem();
    s.setItem(windowKey('x'), '{"rect":{"x":"a","y":1,"w":1,"h":1},"pinned":"yes"}');
    expect(readWindow('x', () => s)).toEqual({ rect: null, pinned: false });
    s.setItem(windowKey('y'), 'not json');
    expect(readWindow('y', () => s)).toEqual({ rect: null, pinned: false });
    const broken = () => { throw new Error('blocked'); };
    expect(readWindow('x', broken)).toEqual({ rect: null, pinned: false });
    expect(() => writeWindow('x', { rect: null, pinned: true }, broken)).not.toThrow();
  });
  it('remembers a number such as a splitter position', () => {
    const s = mem();
    expect(readNumber('k', 0.5, () => s)).toBe(0.5);
    writeNumber('k', 0.7, () => s);
    expect(readNumber('k', 0.5, () => s)).toBe(0.7);
    expect(readNumber('k', 0.5, () => { throw new Error('x'); })).toBe(0.5);
  });
});
