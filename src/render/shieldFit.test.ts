import { describe, expect, it } from 'vitest';
import { Z_PX } from './heights';
import { fitBody, fitExtent, rimPoint, type Fit } from './shieldFit';
import { sectorArt } from './sectorPos';

const inside = (f: Fit, x: number, y: number): number => {
  const c = Math.cos(f.rot);
  const s = Math.sin(f.rot);
  const dx = x - f.cx;
  const dy = y - f.cy;
  return Math.hypot((dx * c + dy * s) / f.rx, (-dx * s + dy * c) / f.ry);
};
const screen = (p: readonly [number, number, number]): { x: number; y: number } => {
  const a = sectorArt(p[0], p[1]);
  return { x: a.x, y: a.y - p[2] * Z_PX };
};

describe('shield fit', () => {
  // a long hull along the grid's x axis, floor to roof
  const pts: [number, number, number][] = [];
  for (let x = 0; x <= 24; x++) for (const y of [0, 4, 8]) for (const z of [0, 2]) pts.push([x, y, z]);
  const f = fitBody(pts) as Fit;

  it('holds every hull point inside its outline on screen', () => {
    for (const p of pts) {
      const s = screen(p);
      expect(inside(f, s.x, s.y)).toBeLessThan(1);
    }
  });

  it('lies along the grid: a hull long in x tilts its outline down to the right like the floor', () => {
    expect(f.rx).toBeGreaterThan(f.ry);
    expect(f.rot).toBeGreaterThan(0.2);
    expect(f.rot).toBeLessThan(0.6);
  });

  it('maps the outline back onto the shell: the centre is the point facing the camera, the rim turns side-on', () => {
    const { mx, my, n } = f.body;
    const at = (dx: number, dy: number): number => {
      const u = [0, 1, 2].map((k) => (mx[k] as number) * dx + (my[k] as number) * dy);
      return u.reduce((s, v, k) => s + v * (n[k] as number), 0); // the screen-plane part has no share of the view
    };
    expect(Math.abs(at(f.rx * Math.cos(f.rot), f.rx * Math.sin(f.rot)))).toBeLessThan(1e-9);
    const r = Math.hypot(...[0, 1, 2].map((k) => (mx[k] as number) * f.rx * Math.cos(f.rot) + (my[k] as number) * f.rx * Math.sin(f.rot)));
    expect(r).toBeCloseTo(1, 6);
  });

  it('a thin hull still gets an oval', () => {
    const g = fitBody([
      [0, 0, 0],
      [30, 1, 2],
    ]) as Fit;
    expect(g.ry / g.rx).toBeGreaterThan(0.3);
  });

  it('puts a hit on the rim, on the side the shot came from', () => {
    const p = rimPoint(f, { x: f.cx - 1000, y: f.cy - 400 });
    expect(inside(f, p.x, p.y)).toBeCloseTo(1, 5);
    expect(p.x).toBeLessThan(f.cx);
    const { ex, ey } = fitExtent(f);
    expect(Math.abs(p.x - f.cx)).toBeLessThanOrEqual(ex + 1e-6);
    expect(Math.abs(p.y - f.cy)).toBeLessThanOrEqual(ey + 1e-6);
  });
});
