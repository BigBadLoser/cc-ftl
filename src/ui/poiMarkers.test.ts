import { describe, expect, it } from 'vitest';
import { EDGE, markerPlace, spread } from './poiMarkers';

describe('markerPlace', () => {
  it('has no marker for a target on screen and clear of the HUD', () => {
    expect(markerPlace({ x: 900, y: 500 }, 1920, 950)).toBeNull();
  });
  it('has a marker for an on-screen target hidden behind a HUD rectangle', () => {
    expect(markerPlace({ x: 1800, y: 100 }, 1920, 950, [{ l: 1700, t: 50, r: 1900, b: 300 }])).not.toBeNull();
  });
  it('puts a target far to the left on the left edge, level with the screen centre, pointing left', () => {
    expect(markerPlace({ x: -2000, y: 475 }, 1920, 950)).toMatchObject({ x: EDGE, y: 475, edge: 'l', angle: 180 });
  });
  it('points down for a target below and right for a target to the right', () => {
    expect(markerPlace({ x: 960, y: 3000 }, 1920, 950)).toMatchObject({ edge: 'b', angle: 90, y: 950 - EDGE });
    expect(markerPlace({ x: 5000, y: 475 }, 1920, 950)).toMatchObject({ edge: 'r', angle: 0, x: 1920 - EDGE });
  });
  it('slides along the edge clear of a HUD rectangle', () => {
    const p = markerPlace({ x: 5000, y: 100 }, 1920, 950, [{ l: 1600, t: 40, r: 1900, b: 450 }]);
    expect(p!.edge).toBe('r');
    expect(p!.y).toBeGreaterThan(450);
  });
});

describe('spread', () => {
  it('moves a marker that would overlap an earlier one along the edge', () => {
    const a = { x: 1896, y: 800, edge: 'r' as const, angle: 0, tx: -100, ty: -50 };
    const out = spread([a, { ...a, y: 805 }], 1920, 950);
    expect(out[0]!.y).toBe(800);
    expect(out[1]!.y).toBeLessThan(800 - 20);
  });
});
