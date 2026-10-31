import { describe, expect, it } from 'vitest';
import { shipNameFor } from './names';

const def = { first: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], second: ['1', '2', '3', '4', '5', '6', '7', '8'] };

describe('shipNameFor', () => {
  it('is deterministic for a seed and key, and differs across seeds', () => {
    const name = (seed: number): string => shipNameFor(def, [seed, 3, 9], new Set());
    expect(name(1)).toBe(name(1));
    expect(new Set([1, 2, 3, 4].map(name)).size).toBeGreaterThan(1);
  });
});
