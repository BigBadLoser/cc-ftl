import type { Ship } from '../sim/combat/components';
import type { GridLike } from '../sim/grid';
import { Struct } from '../sim/structure';
import { ROOF_H } from './heights';
import { ART_SCALE as S, TILE_H, TILE_W } from './iso';
import { sectorArt } from './sectorPos';

/** Margin between the hull's fitted ellipse and the bubble's rim (world px). */
const MARGIN = 8 * S;

/** An ellipse in sector art px: centre, semi-axes, and the rotation of its rx axis. */
export interface Fit {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rot: number;
}

/** The ellipse round a ship's bounding box (no grid to fit to): its floor diamond, lifted to half roof height and padded. */
export function boxFit(s: Pick<Ship, 'x' | 'y' | 'width' | 'height'>): Fit {
  const c = sectorArt(s.x + s.width / 2, s.y + s.height / 2);
  // A w x h box's corners sit on the 2:1 ellipse of "radius" k = sqrt((w^2 + h^2) / 2) tiles.
  const k = Math.sqrt((s.width * s.width + s.height * s.height) / 2);
  return { cx: c.x, cy: c.y - ROOF_H / 2, rx: (k * TILE_W) / 2 + MARGIN, ry: (k * TILE_H) / 2 + ROOF_H / 2 + MARGIN / 2, rot: 0 };
}

/** Smallest semi-minor axis, as a share of the major one: a long thin hull still gets an oval, not a sliver. */
const MIN_ASPECT = 0.38;

/**
 * The ellipse round a set of points (art px), turned to their long axis: the principal axis of the points, the box
 * they fill along it, grown evenly until every point is inside, then padded.
 */
export function fitPoints(xs: readonly number[], ys: readonly number[]): Fit | undefined {
  const n = xs.length;
  if (!n) return undefined;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i++) {
    mx += xs[i] as number;
    my += ys[i] as number;
  }
  mx /= n;
  my /= n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    const dx = (xs[i] as number) - mx;
    const dy = (ys[i] as number) - my;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  const rot = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const c = Math.cos(rot);
  const sn = Math.sin(rot);
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < n; i++) {
    const dx = (xs[i] as number) - mx;
    const dy = (ys[i] as number) - my;
    const lx = dx * c + dy * sn;
    const ly = -dx * sn + dy * c;
    x0 = Math.min(x0, lx);
    x1 = Math.max(x1, lx);
    y0 = Math.min(y0, ly);
    y1 = Math.max(y1, ly);
  }
  const ox = (x0 + x1) / 2;
  const oy = (y0 + y1) / 2;
  const a = Math.max(1, (x1 - x0) / 2);
  const b = Math.max(a * MIN_ASPECT, (y1 - y0) / 2, 1);
  let k = 1;
  for (let i = 0; i < n; i++) {
    const dx = (xs[i] as number) - mx;
    const dy = (ys[i] as number) - my;
    const lx = dx * c + dy * sn - ox;
    const ly = -dx * sn + dy * c - oy;
    k = Math.max(k, Math.hypot(lx / a, ly / b));
  }
  return { cx: mx + ox * c - oy * sn, cy: my + ox * sn + oy * c, rx: a * k + MARGIN, ry: b * k + MARGIN, rot };
}

/** The bubble round a ship's hull: every non-space tile's corners at floor and roof height. */
export function hullFit(g: GridLike): Fit | undefined {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let y = g.y0; y < g.y0 + g.height; y++) {
    for (let x = g.x0; x < g.x0 + g.width; x++) {
      if (g.get('struct', x, y) === Struct.Space) continue;
      for (const [cx, cy] of [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]] as const) {
        const p = sectorArt(cx + 0.5, cy + 0.5);
        xs.push(p.x, p.x);
        ys.push(p.y, p.y - ROOF_H);
      }
    }
  }
  return fitPoints(xs, ys);
}

/**
 * The point of the rim facing `from` (sector art px; none: the top), in the bubble's own frame (`lx`, `ly`, world px
 * from the centre along its axes) and in sector art px (`x`, `y`).
 */
export function rimPoint(f: Fit, from: { x: number; y: number } | undefined): { lx: number; ly: number; x: number; y: number } {
  const c = Math.cos(f.rot);
  const s = Math.sin(f.rot);
  const dx = from ? from.x - f.cx : 0;
  const dy = from ? from.y - f.cy : -1;
  const t = Math.atan2((-dx * s + dy * c) / f.ry, (dx * c + dy * s) / f.rx);
  const lx = f.rx * Math.cos(t);
  const ly = f.ry * Math.sin(t);
  return { lx, ly, x: f.cx + lx * c - ly * s, y: f.cy + lx * s + ly * c };
}

/** Half extents of the box round a fitted (turned) ellipse. */
export function fitExtent(f: Fit): { ex: number; ey: number } {
  const c = Math.cos(f.rot);
  const s = Math.sin(f.rot);
  return { ex: Math.hypot(f.rx * c, f.ry * s), ey: Math.hypot(f.rx * s, f.ry * c) };
}
