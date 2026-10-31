import { describe, expect, it } from 'vitest';
import { EDGE, ICON_GAP, markerPlace, spread } from './poiMarkers';

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

describe('icon and name', () => {
  it('puts the icon behind the arrow, toward the screen centre, and opens the name away from the arrow', () => {
    const p = markerPlace({ x: 5000, y: 475 }, 1920, 950)!;
    expect(p).toMatchObject({ edge: 'r', ux: 1, uy: 0, grow: 'l' });
    expect(p.x - p.ux * ICON_GAP).toBeLessThan(p.x);
    expect(markerPlace({ x: -5000, y: 475 }, 1920, 950)).toMatchObject({ edge: 'l', ux: -1, grow: 'r' });
  });
  it('stops the name at the HUD', () => {
    const p = markerPlace({ x: 5000, y: 475 }, 1920, 950, [{ l: 1500, t: 400, r: 1700, b: 560 }])!;
    expect(p.room).toBeLessThan(170);
  });
});

describe('spread', () => {
  it('moves a marker that would overlap an earlier one to the nearest free slot along the edge', () => {
    const a = { x: 1896, y: 800, edge: 'r' as const, angle: 0, ux: 1, uy: 0, grow: 'l' as const, room: 100 };
    const out = spread([a, { ...a, y: 805 }], 1920, 950);
    expect(out[0]!.y).toBe(800);
    expect(Math.abs(out[1]!.y - 800)).toBeGreaterThanOrEqual(74);
    expect(out[1]!.y + 34).toBeLessThanOrEqual(950 - 24);
  });
  it('does not push a marker back under the HUD (two targets at the same spot beside the right column)', () => {
    const hud = [{ l: 1652, t: 8, r: 1912, b: 450 }];
    const a = markerPlace({ x: 5000, y: 100 }, 1920, 950, hud)!;
    const b = markerPlace({ x: 5000, y: 150 }, 1920, 950, hud)!;
    expect(a.y).toBe(b.y);
    const out = spread([a, b], 1920, 950, hud);
    expect(out).toHaveLength(2);
    for (const m of out) expect(m.y - 34 > 450 || m.y + 34 < 8).toBe(true);
    expect(Math.abs(out[0]!.y - out[1]!.y)).toBeGreaterThanOrEqual(68);
    for (const m of out) expect(m.y + 34).toBeLessThanOrEqual(950 - 24 + 1);
  });
  it('drops a marker when no slot along the edge is clear', () => {
    const hud = [{ l: 1652, t: 8, r: 1912, b: 900 }];
    const a = markerPlace({ x: 5000, y: 475 }, 1920, 950, hud);
    const out = spread([a!, { ...a!, ship: 2 } as typeof a & object], 1920, 950, hud);
    expect(out.length).toBeLessThan(2);
  });
  it('measures the name room at the slot a marker was moved to', () => {
    // A HUD box beside the upper slot: the second marker is pushed up one step into its range, so its room shrinks there while the first keeps the full width.
    const hud = [{ l: 1500, t: 330, r: 1700, b: 420 }];
    const a = markerPlace({ x: 5000, y: 475 }, 1920, 950, hud)!;
    expect(a.room).toBe(170);
    const out = spread([a, { ...a }], 1920, 950, hud);
    expect(out).toHaveLength(2);
    expect(out[0]!.room).toBe(170);
    expect(out[1]!.y).toBe(a.y - 74);
    expect(out[1]!.room).toBeLessThan(170);
  });
});
