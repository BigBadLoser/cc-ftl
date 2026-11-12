import { describe, expect, it } from 'vitest';
import { FOCUS_BIAS, fitRect, fitted, gridLadder, ladder, panned, percentOf, previewView, scaleOf, toScreen, toTile, zoomed, type Space, type View } from './camera';

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
    it(`${space}: zooming keeps the tile under the cursor (the preview at its snapped level)`, () => {
      const shown = (x: View): View => (space === 'iso' ? previewView(x, 2) : x);
      const before = toTile(space, shown(v), 2, box, 200, 150);
      const z = zoomed(space, v, 2, box, 200, 150, 1);
      expect(z.zoom).toBeGreaterThan(v.zoom);
      const after = toTile(space, shown(z), 2, box, 200, 150);
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

  it('zoom stops at the ends of the grid ladder', () => {
    const levels = gridLadder(2);
    const lo = { ...v, zoom: levels[0] as number };
    expect(zoomed('grid', lo, 2, box, 10, 10, -1)).toBe(lo);
    const hi = { ...v, zoom: levels[levels.length - 1] as number };
    expect(zoomed('iso', hi, 2, box, 10, 10, 1)).toBe(hi);
  });

  it('fitted picks the largest step that fits and centres the design', () => {
    const f = fitted(100, 60, 2, box);
    expect(100 * scaleOf(f.zoom, 2)).toBeLessThanOrEqual(box.w);
    expect(f.cx).toBe(49.5);
    expect(f.cy).toBe(29.5);
  });
});

describe('grid zoom steps', () => {
  it('every step is a whole-pixel tile side, in 100% = 16 px percentages', () => {
    for (const dpr of [1, 2]) for (const z of gridLadder(dpr)) expect(Number.isInteger(Math.round(scaleOf(z, dpr) * 1e6) / 1e6)).toBe(true);
    expect(gridLadder(2).map((z) => percentOf(z, 2))).toEqual([19, 25, 38, 50, 75, 100, 150, 200, 300, 400]);
  });
  it('fit picks the largest step that fits, any size, never blown past the top', () => {
    const f = fitRect(10, 8, 69, 47, 2, box);
    expect(gridLadder(2)).toContain(f.zoom);
    expect(62 * scaleOf(f.zoom, 2)).toBeLessThanOrEqual(box.w);
    expect(42 * scaleOf(f.zoom, 2)).toBeLessThanOrEqual(box.h);
    const bigger = gridLadder(2).find((l) => l > f.zoom);
    if (bigger) expect(62 * scaleOf(bigger, 2) > box.w || 42 * scaleOf(bigger, 2) > box.h).toBe(true);
    expect(fitRect(0, 0, 3, 3, 2, box).zoom).toBe(gridLadder(2).at(-1));
    expect(f.cx).toBe(39.5);
  });
  it('the preview snaps the shared zoom to the nearest renderer level, at the same centre; pan stays exact', () => {
    for (const dpr of [1, 2]) for (const z of gridLadder(dpr)) {
      const p = previewView({ cx: 5, cy: 6, zoom: z }, dpr);
      expect(ladder(dpr)).toContain(p.zoom);
      expect([p.cx, p.cy]).toEqual([5, 6]);
      for (const l of ladder(dpr)) expect(Math.abs(Math.log(p.zoom / z))).toBeLessThanOrEqual(Math.abs(Math.log(l / z)) + 1e-12);
    }
    const p = previewView({ cx: 5, cy: 6, zoom: gridLadder(2)[3] as number }, 2);
    expect(toScreen('iso', panned('iso', p, 2, 40, -25), 2, box, 5, 6).x).toBeCloseTo(450 + 40, 6);
  });
  it('a wheel step moves to the next grid step in that direction, from a step or between steps, keeping the tile under the pointer', () => {
    const L = gridLadder(2);
    const between = { ...v, zoom: (L[4] as number) * 1.1 };
    expect(zoomed('grid', between, 2, box, 300, 200, 1).zoom).toBe(L[5]);
    expect(zoomed('grid', between, 2, box, 300, 200, -1).zoom).toBe(L[4]);
    const up = zoomed('grid', between, 2, box, 300, 200, 1);
    expect(toTile('grid', up, 2, box, 300, 200).x).toBeCloseTo(toTile('grid', between, 2, box, 300, 200).x, 6);
  });
});
