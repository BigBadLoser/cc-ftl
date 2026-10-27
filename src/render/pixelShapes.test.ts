import { describe, expect, it } from 'vitest';
import { arrowHeadPx, blockPx, dashPx, dashedPath, ellipsePx, linePx, type Px } from './pixelShapes';

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

  describe('dashedPath', () => {
    // Short legs, a corner and a diagonal: 2, 3, 1 and 4 pixels long between corners.
    const pts: Px[] = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 3 }, { x: 3, y: 3 }, { x: 7, y: 5 }];
    const key = (p: Px): string => `${p.x},${p.y}`;
    /** Every pixel of the polyline from the last point back, each shared corner once. */
    const run = (): Px[] => {
      const out: Px[] = [];
      for (let i = pts.length - 1; i > 0; i--) out.push(...linePx((pts[i] as Px).x, (pts[i] as Px).y, (pts[i - 1] as Px).x, (pts[i - 1] as Px).y).slice(i === pts.length - 1 ? 0 : 1));
      return out;
    };

    it('alternates 3 on and 2 off along the whole line, across corners and short legs', () => {
      const all = run();
      expect(all.length).toBeGreaterThan(10);
      expect(dashedPath(pts, 3, 2).map(key)).toEqual(all.filter((_, i) => i % 5 < 3).map(key));
    });

    it('keeps the dashes in place when the walker end of the line is cut off', () => {
      const full = new Set(dashedPath(pts, 3, 2).map(key));
      for (const cut of [1, 2, 3]) {
        const rest = dashedPath(pts.slice(cut), 3, 2);
        expect(rest.length).toBeGreaterThan(0);
        for (const p of rest) expect(full.has(key(p))).toBe(true);
      }
    });

    it('handles a single point', () => {
      expect(dashedPath([{ x: 4, y: 4 }], 3, 2)).toEqual([{ x: 4, y: 4 }]);
    });
  });
});
