import { describe, expect, it } from 'vitest';
import { regions } from './area';

const sq = (x: number, y: number, s: number) => [x, y, x + s, y, x + s, y + s, x, y + s];

describe('starmap areas', () => {
  it('fills even-odd: a loop inside another is its hole, a loop inside the hole is filled again', () => {
    const r = regions([sq(0, 0, 100), sq(10, 10, 80), sq(30, 30, 20), sq(200, 0, 10)]);
    expect(r).toHaveLength(3);
    expect(r[0]!.holes).toEqual([sq(10, 10, 80)]);
    expect(r[1]!.outer).toEqual(sq(30, 30, 20));
    expect(r[2]!.holes).toEqual([]);
  });
});
