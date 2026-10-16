import { describe, expect, it } from 'vitest';
import { crewPalette, hash } from './palette';

describe('crewPalette', () => {
  it('is deterministic per seed', () => {
    expect(crewPalette(42)).toEqual(crewPalette(42));
    expect(hash(1, 1)).not.toBe(hash(1, 2));
  });
  it('varies across seeds', () => {
    const skins = new Set(Array.from({ length: 40 }, (_, i) => crewPalette(i).skin));
    expect(skins.size).toBeGreaterThan(2);
  });
});
