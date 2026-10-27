import { describe, expect, it } from 'vitest';
import { createAreaPaint, rectTiles } from './areaPaint';

describe('area painting', () => {
  it('a rectangle drag adds its tiles, in either corner order', () => {
    const p = createAreaPaint();
    p.begin({ x: 3, y: 2 });
    p.drag({ x: 1, y: 1 });
    expect(p.dragging()).toHaveLength(6);
    expect(p.end()).toBe(true);
    expect(p.tiles()).toEqual(rectTiles({ x: 1, y: 1 }, { x: 3, y: 2 }));
    expect(p.dragging()).toEqual([]);
  });

  it('erase takes tiles out, and an overlapping add does not duplicate', () => {
    const p = createAreaPaint();
    p.begin({ x: 0, y: 0 });
    p.drag({ x: 3, y: 0 });
    p.end();
    p.begin({ x: 2, y: 0 });
    p.drag({ x: 5, y: 0 });
    p.end();
    expect(p.tiles().map((t) => t.x)).toEqual([0, 1, 2, 3, 4, 5]);
    p.setMode('erase');
    p.begin({ x: 1, y: 0 });
    p.drag({ x: 4, y: 0 });
    expect(p.end()).toBe(true);
    expect(p.tiles().map((t) => t.x)).toEqual([0, 5]);
    p.begin({ x: 9, y: 9 });
    expect(p.end()).toBe(false);
  });

  it('cancel drops the drag, clear and set replace the set', () => {
    const p = createAreaPaint();
    p.begin({ x: 0, y: 0 });
    p.drag({ x: 2, y: 2 });
    p.cancel();
    expect(p.end()).toBe(false);
    expect(p.tiles()).toEqual([]);
    p.set([{ x: 4, y: 4 }, { x: 4, y: 4 }]);
    expect(p.tiles()).toEqual([{ x: 4, y: 4 }]);
    p.clear();
    expect(p.tiles()).toEqual([]);
  });

  it('an outline add puts down only the border, a thin drag is a line, and erase takes the whole rectangle', () => {
    const p = createAreaPaint('add', 'outline');
    p.begin({ x: 0, y: 0 });
    p.drag({ x: 3, y: 2 });
    expect(p.dragging()).toHaveLength(10);
    p.end();
    expect(p.tiles()).toHaveLength(10);
    expect(p.tiles().some((t) => t.x === 1 && t.y === 1)).toBe(false);
    p.begin({ x: 5, y: 0 });
    p.drag({ x: 5, y: 3 });
    p.end();
    expect(p.tiles()).toHaveLength(14);
    p.setMode('erase');
    p.begin({ x: 0, y: 0 });
    p.drag({ x: 3, y: 2 });
    p.end();
    expect(p.tiles()).toEqual([{ x: 5, y: 0 }, { x: 5, y: 1 }, { x: 5, y: 2 }, { x: 5, y: 3 }]);
  });
});
