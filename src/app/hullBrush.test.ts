import { describe, expect, it } from 'vitest';
import { dragRect, mirrorTiles, rectTiles, stairSize, stairTiles, withMirror } from './hullBrush';

describe('hull brushes', () => {
  it('a drag never makes a rectangle thinner than 3 x 3: it snaps up, towards the drag', () => {
    expect(dragRect({ x: 5, y: 5 }, { x: 5, y: 5 })).toEqual({ x: 5, y: 5, w: 3, h: 3 });
    expect(dragRect({ x: 5, y: 5 }, { x: 6, y: 9 })).toEqual({ x: 5, y: 5, w: 3, h: 5 });
    expect(dragRect({ x: 5, y: 5 }, { x: 4, y: 3 })).toEqual({ x: 3, y: 3, w: 3, h: 3 }); // up and to the left: it grows that way
    expect(dragRect({ x: 5, y: 5 }, { x: 10, y: 7 })).toEqual({ x: 5, y: 5, w: 6, h: 3 });
    expect(rectTiles(dragRect({ x: 0, y: 0 }, { x: 3, y: 2 }))).toHaveLength(12);
  });

  it('a staircase has legs of at least 2 and points the way the drag goes', () => {
    expect(stairSize({ x: 0, y: 0 }, { x: 0, y: 0 })).toBe(2);
    expect(stairTiles({ x: 0, y: 0 }, { x: 0, y: 0 })).toEqual([{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 0 }]);
    expect(stairSize({ x: 0, y: 0 }, { x: 3, y: 1 })).toBe(4);
    const down = stairTiles({ x: 10, y: 10 }, { x: 8, y: 12 }); // towards negative x, positive y
    expect(down).toHaveLength(6);
    expect(down).toContainEqual({ x: 8, y: 10 });
    expect(down).toContainEqual({ x: 10, y: 12 });
    expect(down).not.toContainEqual({ x: 8, y: 12 }); // the far corner is cut by the diagonal
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
