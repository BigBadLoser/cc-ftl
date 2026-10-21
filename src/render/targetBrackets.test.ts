import { describe, expect, it } from 'vitest';
import { armLength, bracketSegments, footprintRect } from './targetBrackets';

const id = (x: number, y: number) => ({ x, y });
const O = { x: 0, y: 0 };

describe('footprintRect', () => {
  it('1x1 is the tile diamond bounds', () => {
    expect(footprintRect(0, 0, 1, 1, O, 0, id)).toEqual({ x: -32, y: -16, w: 64, h: 32 });
  });
  it('2x1 and its rotated 1x2 are mirror images', () => {
    expect(footprintRect(3, 1, 2, 1, O, 0, id)).toEqual({ x: 32, y: 48, w: 96, h: 48 });
    expect(footprintRect(3, 1, 1, 2, O, 0, id)).toEqual({ x: 0, y: 48, w: 96, h: 48 });
  });
  it('subtracts lift, adds origin and rise, and applies the projection', () => {
    const r = footprintRect(0, 0, 1, 1, { x: 1, y: 1 }, 8, (x, y) => ({ x: x * 2 + 5, y: y * 2 + 7 }), 4);
    expect(r).toEqual({ x: -59, y: 15, w: 128, h: 72 });
  });
});

describe('brackets', () => {
  it('clamps the arm to 4..10 and to half a small side', () => {
    expect(armLength(8)).toBe(4);
    expect(armLength(6)).toBe(3);
    expect(armLength(60)).toBe(10);
    expect(armLength(24)).toBe(6);
  });
  it('makes four corners of two segments', () => {
    const s = bracketSegments({ x: 0, y: 0, w: 40, h: 20 });
    expect(s).toHaveLength(8);
    expect(s[1]).toEqual({ x1: 0, y1: 0, x2: 10, y2: 0 });
    expect(s[0]).toEqual({ x1: 0, y1: 5, x2: 0, y2: 0 });
  });
});
