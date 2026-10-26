import { describe, expect, it } from 'vitest';
import { arrowHeadPx, blockPx, dashPx, ellipsePx, linePx } from './pixelShapes';

describe('pixel shapes', () => {
  it('draws an ellipse outline of whole pixels, symmetric about its centre and without repeats', () => {
    const pts = ellipsePx(0, 0, 10, 5);
    const keys = new Set(pts.map((p) => `${p.x},${p.y}`));
    expect(keys.size).toBe(pts.length);
    for (const p of pts) {
      expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBe(true);
      expect(keys.has(`${-p.x},${-p.y}`)).toBe(true);
    }
    expect(keys.has('10,0') && keys.has('0,5') && keys.has('-10,0') && keys.has('0,-5')).toBe(true);
  });

  it('draws a connected line that includes both ends', () => {
    const run = linePx(0, 0, 9, 4);
    expect(run[0]).toEqual({ x: 0, y: 0 });
    expect(run[run.length - 1]).toEqual({ x: 9, y: 4 });
    for (let i = 1; i < run.length; i++) {
      expect(Math.abs((run[i] as { x: number }).x - (run[i - 1] as { x: number }).x)).toBeLessThanOrEqual(1);
      expect(Math.abs((run[i] as { y: number }).y - (run[i - 1] as { y: number }).y)).toBeLessThanOrEqual(1);
    }
    expect(linePx(3, 3, 3, 3)).toEqual([{ x: 3, y: 3 }]);
  });

  it('dashes a run in a repeating on/off pattern', () => {
    const run = linePx(0, 0, 9, 0);
    expect(dashPx(run, 3, 2).map((p) => p.x)).toEqual([0, 1, 2, 5, 6, 7]);
    expect(dashPx(run, 3, 2, 3).map((p) => p.x)).toEqual([2, 3, 4, 7, 8, 9]);
  });

  it('builds an arrow head that narrows to one tip pixel, and a block', () => {
    const a = arrowHeadPx(0, 0, 3);
    expect(a).toHaveLength(9);
    expect(a.filter((p) => p.y === 0)).toEqual([{ x: 0, y: 0 }]);
    expect(blockPx(1, 1, 3, 2)).toHaveLength(6);
  });
});
