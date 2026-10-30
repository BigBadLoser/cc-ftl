import { describe, expect, it } from 'vitest';
import { placePanel } from './panelPlace';

const view = { w: 1000, h: 700 };
const size = { w: 200, h: 100 };
const mod = { x0: 400, y0: 300, x1: 460, y1: 350 };

describe('placePanel', () => {
  it('puts the panel to the right of the module, clear of it', () => {
    const p = placePanel(mod, size, view, [])!;
    expect(p.x).toBe(472);
    expect(p.y).toBe(325 - 50);
  });
  it('flips to the left when the right has no room', () => {
    const p = placePanel({ x0: 800, y0: 300, x1: 880, y1: 350 }, size, view, [])!;
    expect(p.x + size.w).toBeLessThanOrEqual(800 - 12);
  });
  it('avoids obstacles, never covers the module, and stays inside the view', () => {
    const wall = { x0: 460, y0: 0, x1: 700, y1: 700 };
    const p = placePanel(mod, size, view, [wall])!;
    const r = { x0: p.x, y0: p.y, x1: p.x + 200, y1: p.y + 100 };
    expect(r.x1 <= wall.x0 || r.x0 >= wall.x1).toBe(true);
    expect(r.x0 >= 8 && r.y0 >= 8 && r.x1 <= 992 && r.y1 <= 692).toBe(true);
  });
  it('clamps a module near the corner and hides when the module is off screen', () => {
    const p = placePanel({ x0: 960, y0: 650, x1: 1000, y1: 690 }, size, view, [])!;
    expect(p.x + 200).toBeLessThanOrEqual(992);
    expect(p.y + 100).toBeLessThanOrEqual(692);
    expect(placePanel({ x0: 1100, y0: 0, x1: 1200, y1: 50 }, size, view, [])).toBeNull();
  });
});
