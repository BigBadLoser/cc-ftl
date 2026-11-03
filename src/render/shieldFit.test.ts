import { describe, expect, it } from 'vitest';
import { fitExtent, fitPoints, rimPoint } from './shieldFit';

const inside = (f: { cx: number; cy: number; rx: number; ry: number; rot: number }, x: number, y: number): number => {
  const c = Math.cos(f.rot);
  const s = Math.sin(f.rot);
  const dx = x - f.cx;
  const dy = y - f.cy;
  return Math.hypot((dx * c + dy * s) / f.rx, (-dx * s + dy * c) / f.ry);
};

describe('shield fit', () => {
  // a long hull on the iso diagonal: points along a slanted strip
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i <= 40; i++) {
    for (const o of [-20, 0, 20]) {
      xs.push(i * 30 + o);
      ys.push(i * 12 - o);
    }
  }
  const f = fitPoints(xs, ys);

  it('turns to the hull and holds every point', () => {
    expect(f).toBeDefined();
    if (!f) return;
    expect(f.rot).toBeGreaterThan(0.2);
    expect(f.rot).toBeLessThan(0.6);
    expect(f.rx).toBeGreaterThan(f.ry);
    for (let i = 0; i < xs.length; i++) expect(inside(f, xs[i] as number, ys[i] as number)).toBeLessThanOrEqual(1);
  });

  it('a thin hull still gets an oval', () => {
    const g = fitPoints([0, 100, 200, 300], [0, 0, 0, 0]);
    expect(g && g.ry / g.rx).toBeGreaterThan(0.3);
  });

  it('puts a hit on the rim, on the side the shot came from', () => {
    if (!f) return;
    const p = rimPoint(f, { x: f.cx - 1000, y: f.cy - 400 });
    expect(inside(f, p.x, p.y)).toBeCloseTo(1, 5);
    expect(p.x).toBeLessThan(f.cx);
    const { ex, ey } = fitExtent(f);
    expect(Math.abs(p.x - f.cx)).toBeLessThanOrEqual(ex + 1e-6);
    expect(Math.abs(p.y - f.cy)).toBeLessThanOrEqual(ey + 1e-6);
  });
});
