import { describe, expect, it } from 'vitest';
import { boxSelection, clickSelection, idsInRect, normRect } from './selection';

describe('crew selection helpers', () => {
  it('normalises a drag from any corner', () => {
    expect(normRect({ x: 50, y: 40 }, { x: 10, y: 90 })).toEqual({ x0: 10, y0: 40, x1: 50, y1: 90 });
  });

  it('keeps the ids whose points fall inside the box, edges included', () => {
    const pts = [{ id: 1, x: 10, y: 10 }, { id: 2, x: 20, y: 20 }, { id: 3, x: 21, y: 20 }, { id: 4, x: 5, y: 15 }];
    expect(idsInRect({ x0: 10, y0: 10, x1: 20, y1: 20 }, pts)).toEqual([1, 2]);
    expect(idsInRect({ x0: 0, y0: 0, x1: 1, y1: 1 }, pts)).toEqual([]);
  });

  it('a plain click replaces the selection; shift adds, and shift on a selected one takes it out', () => {
    expect(clickSelection([1, 2], 3, false)).toEqual([3]);
    expect(clickSelection([1, 2], 3, true)).toEqual([1, 2, 3]);
    expect(clickSelection([1, 2], 2, true)).toEqual([1]);
  });

  it('a plain box replaces the selection; shift adds the hits without doubling', () => {
    expect(boxSelection([1], [2, 3], false)).toEqual([2, 3]);
    expect(boxSelection([1, 2], [2, 3], true)).toEqual([1, 2, 3]);
    expect(boxSelection([1], [], false)).toEqual([]);
    expect(boxSelection([1], [], true)).toEqual([1]);
  });
});
