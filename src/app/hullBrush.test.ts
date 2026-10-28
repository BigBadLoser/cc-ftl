import { describe, expect, it } from 'vitest';
import { belowMin, dragRect, lineTiles, mirrorTiles, rectTiles, withMirror } from './hullBrush';

describe('hull brushes', () => {
  it('a drag never makes a rectangle thinner than 3 x 3: it snaps up, towards the drag', () => {
    expect(dragRect({ x: 5, y: 5 }, { x: 5, y: 5 })).toEqual({ x: 5, y: 5, w: 3, h: 3 });
    expect(dragRect({ x: 5, y: 5 }, { x: 6, y: 9 })).toEqual({ x: 5, y: 5, w: 3, h: 5 });
    expect(dragRect({ x: 5, y: 5 }, { x: 4, y: 3 })).toEqual({ x: 3, y: 3, w: 3, h: 3 }); // up and to the left: it grows that way
    expect(dragRect({ x: 5, y: 5 }, { x: 10, y: 7 })).toEqual({ x: 5, y: 5, w: 6, h: 3 });
    expect(rectTiles(dragRect({ x: 0, y: 0 }, { x: 3, y: 2 }))).toHaveLength(12);
  });

  it('a drag keeps its real size when asked, and is below the minimum until 3 x 3 (the minSize refusal)', () => {
    const small = dragRect({ x: 5, y: 5 }, { x: 6, y: 6 }, 1);
    expect(small).toEqual({ x: 5, y: 5, w: 2, h: 2 });
    expect(belowMin(small)).toBe(true);
    expect(belowMin(dragRect({ x: 5, y: 5 }, { x: 7, y: 6 }, 1))).toBe(true); // 3 x 2
    expect(belowMin(dragRect({ x: 5, y: 5 }, { x: 7, y: 7 }, 1))).toBe(false);
    expect(dragRect({ x: 5, y: 5 }, { x: 5, y: 5 }, 1)).toEqual({ x: 5, y: 5, w: 1, h: 1 });
  });

  it('a line snaps to 0, 45 or 90 degrees, and a diagonal has at least 2 steps', () => {
    expect(lineTiles({ x: 5, y: 5 }, { x: 9, y: 6 })).toEqual([0, 1, 2, 3, 4].map((i) => ({ x: 5 + i, y: 5 }))); // nearly flat: horizontal
    expect(lineTiles({ x: 5, y: 5 }, { x: 4, y: 8 })).toEqual([0, 1, 2, 3].map((i) => ({ x: 5, y: 5 + i }))); // nearly vertical
    expect(lineTiles({ x: 5, y: 5 }, { x: 8, y: 8 })).toEqual([0, 1, 2, 3].map((i) => ({ x: 5 + i, y: 5 + i })));
    expect(lineTiles({ x: 5, y: 5 }, { x: 3, y: 7 })).toEqual([0, 1, 2].map((i) => ({ x: 5 - i, y: 5 + i }))); // up-left to down-left
    expect(lineTiles({ x: 5, y: 5 }, { x: 6, y: 6 })).toHaveLength(3); // a diagonal drag of one step is stretched to 2
  });

  it('the allowed slopes are one list: a 1:2 staircase has runs of 2 and snaps by angle', () => {
    const slopes = [0, 0.5, 1, Infinity];
    const l = lineTiles({ x: 0, y: 0 }, { x: 8, y: 3 }, slopes);
    expect(l.map((t) => t.y)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    expect(l.map((t) => t.x)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(lineTiles({ x: 0, y: 0 }, { x: 6, y: 6 }, slopes)).toHaveLength(7); // still the 45 degree line
    expect(lineTiles({ x: 0, y: 0 }, { x: 3, y: 8 }, [0, 2, Infinity]).map((t) => t.x)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]); // steep 2:1, runs of 2 along y
    expect(lineTiles({ x: 0, y: 0 }, { x: 8, y: 3 })).toHaveLength(9); // the default set has no 1:2: it stays flat
  });

  it('mirrors across the ship\'s long axis', () => {
    const wide = { x: 20, y: 50, width: 30, height: 20 }; // long along x: rows swap
    expect(mirrorTiles([{ x: 22, y: 50 }], wide)).toEqual([{ x: 22, y: 69 }]);
    expect(mirrorTiles([{ x: 22, y: 40 }], wide)).toEqual([{ x: 22, y: 79 }]);
    const tall = { x: 0, y: 0, width: 10, height: 30 }; // long along y: columns swap
    expect(mirrorTiles([{ x: 1, y: 7 }], tall)).toEqual([{ x: 8, y: 7 }]);
    expect(withMirror([{ x: 22, y: 50 }, { x: 22, y: 69 }], wide)).toHaveLength(2); // a tile on its own mirror is kept once
  });
});
