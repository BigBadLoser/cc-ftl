import { describe, expect, it } from 'vitest';
import { artZoom, crewPalette, filterResolution, hash } from './palette';

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

describe('filterResolution', () => {
  it('puts one texel on each art px when the art is shrunk', () => {
    for (const s of [1 / 8, 1 / 3, 0.5, 0.75]) expect(filterResolution(s) * s).toBeCloseTo(1, 10);
  });
  it('is one texel per device px from zoom 1 up', () => {
    for (const s of [1, 1.37, 2, 3]) expect(filterResolution(s)).toBe(1);
  });
  it('guards a degenerate scale', () => {
    expect(filterResolution(0)).toBe(1);
  });
});

describe('crew filter on the art grid', () => {
  it('works on the art grid: the zoom is the camera scale times 2 world px per art px', () => {
    expect(artZoom(0.5)).toBe(1);
    expect(artZoom(1)).toBe(2);
  });
  it('keeps one texel per art px while the art is shrunk, and shrinks nothing at camera scale 0.5 and up', () => {
    for (const cam of [1 / 8, 0.2, 0.4]) expect(filterResolution(artZoom(cam)) * artZoom(cam)).toBeCloseTo(1, 10);
    for (const cam of [0.5, 0.75, 1, 3]) expect(filterResolution(artZoom(cam))).toBe(1);
  });
});
