import { describe, expect, it } from 'vitest';
import { enclosedAt, fillRoom } from './fill';
import { addRoom, paint, shapeTiles, stroke, type Layout } from './layout';
import { blankLayout } from './source';

/** Rooms round an enclosed open hole whose bottom-right corner steps in (as a ship's engine block does). */
function holed(): Layout {
  let l: Layout = blankLayout(24, 18);
  l = addRoom(l, { x: 2, y: 2, w: 18, h: 2 }, 'hall').layout;
  l = addRoom(l, { x: 2, y: 4, w: 2, h: 10 }, 'hall').layout;
  l = addRoom(l, { x: 16, y: 4, w: 4, h: 8 }, 'engine').layout;
  l = paint(l, shapeTiles('wall', [4, 14], [12, 14]), '#');
  l = paint(l, shapeTiles('wall', [12, 12], [16, 12]), '#');
  return paint(l, shapeTiles('wall', [12, 12], [12, 14]), '#');
}
const hole = (l: Layout): [number, number][] => enclosedAt(l, 6, 6) ?? [];

describe('an enclosed area that is not a rectangle', () => {
  it('is found whole from a click inside it, and not from outside the ship or on a wall', () => {
    const l = holed();
    expect(hole(l).length).toBe(10 * 7 + 7 * 2); // 5..14 x 5..11, then the stepped-in rows 12..13 at 5..11
    expect(enclosedAt(l, 0, 0)).toBeNull();
    expect(enclosedAt(l, 4, 6)).toBeNull();
  });
  it('fills as one new room and keeps every wall round it', () => {
    const l = holed();
    const f = fillRoom(l, hole(l), 'cargo', 3);
    expect(f.rooms[3]).toEqual({ role: 'cargo' });
    for (const [x, y] of hole(l)) { expect(f.cells[y]?.[x]).toBe('_'); expect(f.roomOf[y * f.width + x]).toBe(3); }
    const walls = (m: Layout): number => m.cells.join('').split('#').length;
    expect(walls(f)).toBe(walls(l));
  });
  it('painting floor into it keeps its walls too (only hull that faced outside space is absorbed)', () => {
    const l = holed();
    const f = stroke(l, 'floor', false, hole(l));
    expect(f.cells[6]?.[4]).toBe('#');
    expect(f.cells[6]?.[15]).toBe('#');
    expect(f.cells[13]?.[12]).toBe('#');
  });
});
