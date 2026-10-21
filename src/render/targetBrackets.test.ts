import { describe, expect, it } from 'vitest';
import { armLength, footprintQuad, isoBracketSegments, padQuad } from './targetBrackets';

const id = (x: number, y: number) => ({ x, y });
const O = { x: 0, y: 0 };

describe('footprintQuad', () => {
  it('1x1 is the tile diamond', () => {
    expect(footprintQuad(0, 0, 1, 1, O, 0, id)).toEqual({ top: { x: 0, y: -16 }, right: { x: 32, y: 0 }, bottom: { x: 0, y: 16 }, left: { x: -32, y: 0 } });
  });
  it('2x1 is a parallelogram with its real corners', () => {
    const q = footprintQuad(3, 1, 2, 1, O, 0, id);
    expect(q).toEqual({ top: { x: 64, y: 48 }, right: { x: 128, y: 80 }, bottom: { x: 96, y: 96 }, left: { x: 32, y: 64 } });
  });
  it('rotated 1x2 mirrors it', () => {
    const q = footprintQuad(3, 1, 1, 2, O, 0, id);
    expect(q).toEqual({ top: { x: 64, y: 48 }, right: { x: 96, y: 64 }, bottom: { x: 32, y: 96 }, left: { x: 0, y: 80 } });
  });
  it('subtracts lift, adds origin and rise, and applies the projection', () => {
    const q = footprintQuad(0, 0, 1, 1, { x: 1, y: 1 }, 8, (x, y) => ({ x: x * 2 + 5, y: y * 2 + 7 }), 4);
    expect(q.bottom).toEqual({ x: 5, y: 2 * (48 - 8) + 7 });
    expect(q.top).toEqual({ x: 5, y: 2 * (16 - 8 - 4) + 7 });
  });
});

describe('isoBracketSegments', () => {
  it('clamps the arm to 4..10 and to half a short edge', () => {
    expect(armLength(8)).toBe(4);
    expect(armLength(6)).toBe(3);
    expect(armLength(200)).toBe(10);
    expect(armLength(24)).toBe(6);
  });
  it('draws two arms per vertex lying along the edges', () => {
    const q = footprintQuad(0, 0, 2, 1, O, 0, id);
    const segs = isoBracketSegments(q);
    expect(segs).toHaveLength(8);
    const ring = [q.top, q.right, q.bottom, q.left];
    for (const s of segs) {
      // Each arm starts at a vertex and is parallel to one of the two edges meeting there.
      const i = ring.findIndex((p) => p.x === s.x1 && p.y === s.y1);
      expect(i).toBeGreaterThanOrEqual(0);
      const ok = [ring[(i + 1) % 4], ring[(i + 3) % 4]].some((n) => {
        const cross = (n!.x - s.x1) * (s.y2 - s.y1) - (n!.y - s.y1) * (s.x2 - s.x1);
        return Math.abs(cross) < 1e-9 && (n!.x - s.x1) * (s.x2 - s.x1) + (n!.y - s.y1) * (s.y2 - s.y1) > 0;
      });
      expect(ok).toBe(true);
      expect(Math.hypot(s.x2 - s.x1, s.y2 - s.y1)).toBeLessThanOrEqual(10 + 1e-9);
    }
  });
  it('padding moves corners outward along the diagonals', () => {
    const q = padQuad(footprintQuad(0, 0, 1, 1, O, 0, id), 2);
    expect(q.top.y).toBeLessThan(-16);
    expect(q.right.x).toBeGreaterThan(32);
    expect(q.bottom.y).toBeGreaterThan(16);
    expect(q.left.x).toBeLessThan(-32);
  });
});
