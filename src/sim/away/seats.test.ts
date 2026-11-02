import { describe, expect, it } from 'vitest';
import { allocateSeats } from './seats';

describe('allocateSeats', () => {
  it('gives nothing without seats or demand', () => {
    expect(allocateSeats({}, 3)).toEqual([]);
    expect(allocateSeats({ construction: 5 }, 0)).toEqual([]);
  });

  it('with fewer seats than categories, the most wanted get one each (ties in the priority grid order)', () => {
    expect(allocateSeats({ hauling: 2, construction: 9, repair: 2 }, 2)).toEqual(['repair', 'construction']);
    expect(allocateSeats({ hauling: 2, construction: 2 }, 1)).toEqual(['construction']);
  });

  it('otherwise one each, then the rest by largest remainder', () => {
    expect(allocateSeats({ construction: 8, hauling: 2 }, 3)).toEqual(['construction', 'construction', 'hauling']);
    expect(allocateSeats({ construction: 1, hauling: 1 }, 3)).toEqual(['construction', 'construction', 'hauling']);
    expect(allocateSeats({ construction: 3 }, 4)).toEqual(['construction', 'construction', 'construction', 'construction']);
  });

  it('is the same every time and fills every seat', () => {
    const d = { construction: 7, hauling: 5, repair: 1 };
    for (let n = 1; n <= 8; n++) {
      expect(allocateSeats(d, n)).toEqual(allocateSeats(d, n));
      expect(allocateSeats(d, n)).toHaveLength(n);
    }
  });
});
