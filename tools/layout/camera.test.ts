import { describe, expect, it } from 'vitest';
import { FOCUS_BIAS, fitted, ladder, panned, scaleOf, toScreen, toTile, zoomed, type Space, type View } from './camera';

const box = { w: 900, h: 600 };
const v: View = { cx: 30.5, cy: 18, zoom: 1 };

describe('layout lab camera', () => {
  for (const space of ['grid', 'iso'] as Space[]) {
    it(`${space}: screen to tile to screen round-trips`, () => {
      for (const dpr of [1, 2]) {
        for (const [sx, sy] of [[0, 0], [450, 300], [123, 456], [899, 599]] as const) {
          const t = toTile(space, v, dpr, box, sx, sy);
          const s = toScreen(space, v, dpr, box, t.x, t.y);
          expect(s.x).toBeCloseTo(sx, 6);
          expect(s.y).toBeCloseTo(sy, 6);
        }
      }
    });
    it(`${space}: the view centre sits at the pane centre`, () => {
      const s = toScreen(space, v, 2, box, v.cx, v.cy);
      expect(s.x).toBeCloseTo(450, 6);
      // The renderer centres FOCUS_BIAS art px above the floor diamond, so the iso tile centre sits a little below the middle.
      expect(s.y).toBeCloseTo(space === 'grid' ? 300 : 300 + (FOCUS_BIAS * v.zoom) / 2, 6);
    });
    it(`${space}: zooming keeps the tile under the cursor`, () => {
      const before = toTile(space, v, 2, box, 200, 150);
      const z = zoomed(space, v, 2, box, 200, 150, 1);
      expect(z.zoom).toBeGreaterThan(v.zoom);
      const after = toTile(space, z, 2, box, 200, 150);
      expect(after.x).toBeCloseTo(before.x, 6);
      expect(after.y).toBeCloseTo(before.y, 6);
    });
    it(`${space}: a drag moves the tile under the cursor with it`, () => {
      const t = toTile(space, v, 2, box, 300, 200);
      const p = panned(space, v, 2, 40, -25);
      const s = toScreen(space, p, 2, box, t.x, t.y);
      expect(s.x).toBeCloseTo(340, 6);
      expect(s.y).toBeCloseTo(175, 6);
    });
  }

  it('the two panes put the same tile at the pane centre and agree on the scale step', () => {
    const a = toScreen('grid', v, 2, box, v.cx + 1, v.cy);
    const b = toScreen('iso', v, 2, box, v.cx + 1, v.cy);
    // One tile east is a tile side to the right in the grid and half a diamond width (the same distance) to the right in iso.
    expect(a.x - 450).toBeCloseTo(scaleOf(v.zoom, 2), 6);
    expect(b.x - 450).toBeCloseTo(scaleOf(v.zoom, 2), 6);
  });

  it('zoom stops at the ends of the ladder', () => {
    const levels = ladder(2);
    const lo = { ...v, zoom: levels[0] as number };
    expect(zoomed('grid', lo, 2, box, 10, 10, -1)).toBe(lo);
    const hi = { ...v, zoom: levels[levels.length - 1] as number };
    expect(zoomed('iso', hi, 2, box, 10, 10, 1)).toBe(hi);
  });

  it('fitted picks the largest level that fits and centres the design', () => {
    const f = fitted(100, 60, 2, box);
    expect(100 * scaleOf(f.zoom, 2)).toBeLessThanOrEqual(box.w);
    expect(f.cx).toBe(49.5);
    expect(f.cy).toBe(29.5);
  });
});
