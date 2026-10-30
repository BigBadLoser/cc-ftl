import { describe, expect, it } from 'vitest';
import { markerPlace, safeRect, spread } from './poiMarkers';

describe('markerPlace', () => {
  it('has no marker for a target inside the safe rectangle', () => {
    expect(markerPlace({ x: 900, y: 500 }, 1920, 950)).toBeNull();
  });
  it('clamps a target far to the left onto the left edge, level with the screen centre', () => {
    const p = markerPlace({ x: -2000, y: 475 }, 1920, 950);
    expect(p).toEqual({ x: safeRect(1920, 950).l, y: 475, angle: 180 });
  });
  it('keeps every marker inside the safe rectangle on the line toward the target', () => {
    const { l, t, r, b } = safeRect(1920, 950);
    for (const at of [{ x: 5000, y: -3000 }, { x: -300, y: 2000 }, { x: 1000, y: 900 }, { x: 40, y: 475 }]) {
      const p = markerPlace(at, 1920, 950);
      expect(p).not.toBeNull();
      expect(p!.x).toBeGreaterThanOrEqual(l);
      expect(p!.x).toBeLessThanOrEqual(r);
      expect(p!.y).toBeGreaterThanOrEqual(t);
      expect(p!.y).toBeLessThanOrEqual(b);
    }
  });
});

describe('spread', () => {
  it('moves a marker that would overlap an earlier one inward', () => {
    const out = spread([{ x: 1500, y: 800, angle: 0 }, { x: 1520, y: 805, angle: 0 }], 950);
    expect(out[0]!.y).toBe(800);
    expect(out[1]!.y).toBeLessThan(800 - 20);
  });
});
