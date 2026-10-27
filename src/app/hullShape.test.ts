import { describe, expect, it } from 'vitest';
import { chamferFromDrag, handleAt, handleTiles, NO_CHAMFER, rectOf, shapeTiles, snapChamfer } from './hullShape';

const R = rectOf({ x: 5, y: 7 }, { x: 14, y: 12 }); // 10 x 6

describe('hull shape geometry', () => {
  it('a plain rectangle has every tile', () => {
    expect(shapeTiles(R, NO_CHAMFER)).toHaveLength(60);
  });

  it('a 2-step chamfer takes the corner tile and its two neighbours', () => {
    const t = shapeTiles(R, { ...NO_CHAMFER, nw: 2 });
    expect(t).toHaveLength(57);
    const has = (x: number, y: number) => t.some((p) => p.x === x && p.y === y);
    expect(has(5, 7)).toBe(false);
    expect(has(6, 7)).toBe(false);
    expect(has(5, 8)).toBe(false);
    expect(has(6, 8)).toBe(true);
  });

  it('each corner cuts its own end', () => {
    const t = shapeTiles(R, { nw: 3, ne: 3, sw: 3, se: 3 });
    expect(t).toHaveLength(60 - 4 * 6);
    expect(t.some((p) => p.x === 14 && p.y === 12)).toBe(false);
    expect(t.some((p) => p.x === 5 && p.y === 12)).toBe(false);
  });

  it('chamfer steps skip 1', () => {
    expect([0, 0.4, 1, 1.4, 2, 3, 4].map((v) => snapChamfer(v, R))).toEqual([0, 0, 2, 2, 2, 3, 4]);
  });

  it('a chamfer never exceeds the short side', () => {
    expect(snapChamfer(50, R)).toBe(5);
    expect(snapChamfer(5, rectOf({ x: 0, y: 0 }, { x: 1, y: 1 }))).toBe(0); // 2x2: nothing can be cut in 2+ steps
  });

  it('dragging a handle inward along the diagonal sets the chamfer', () => {
    expect(chamferFromDrag(R, 'nw', { x: 5, y: 7 })).toBe(0);
    expect(chamferFromDrag(R, 'nw', { x: 6, y: 8 })).toBe(2); // 1 tile in snaps to 2
    expect(chamferFromDrag(R, 'nw', { x: 8, y: 10 })).toBe(3);
    expect(chamferFromDrag(R, 'se', { x: 11, y: 9 })).toBe(3);
    expect(chamferFromDrag(R, 'ne', { x: 15, y: 6 })).toBe(0); // outward does nothing
  });

  it('handles are 2x2 blocks sticking out of the corners', () => {
    expect(handleTiles(R, 'nw')).toEqual([{ x: 5, y: 7 }, { x: 4, y: 7 }, { x: 5, y: 6 }, { x: 4, y: 6 }]);
    expect(handleAt(R, { x: 15, y: 13 })).toBe('se');
    expect(handleAt(R, { x: 9, y: 9 })).toBeNull();
  });
});
