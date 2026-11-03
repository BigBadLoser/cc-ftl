import type { Ship } from '../sim/combat/components';
import type { GridLike } from '../sim/grid';
import { Struct } from '../sim/structure';
import { ROOF_Z, Z_PX } from './heights';
import { TILE_H, TILE_W } from './iso';
import { sectorArt } from './sectorPos';

/**
 * The shield bubble is an ellipsoid standing on the ship's grid (axes along the grid, in tiles; height in tile units, one
 * unit = Z_PX px up the screen), seen through the game's isometric camera. Its outline on screen is an ellipse (`cx`,
 * `cy`, `rx`, `ry`, `rot`, sector art px), which the dome's effects work in; `body` maps a point inside that outline back
 * onto the shell, so the hex lattice lies on the 3D surface and squashes the way the floor does.
 */
export interface Fit {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rot: number;
  body: Body;
}

/**
 * The unit-sphere frame of the ellipsoid: a screen offset (dx, dy) from the outline's centre goes to `mx * dx + my * dy`
 * in the unit ball (the shell point's projection onto the screen plane), and the front of the shell is that plus
 * `sqrt(1 - r^2) * n`, `n` being the unit view direction in the same frame. `ab` scales the lattice so cells stay round
 * on a long ellipsoid; `hex` is one hex cell in the lattice's units (a quarter turn round the sphere = 1).
 */
export interface Body {
  mx: [number, number, number];
  my: [number, number, number];
  n: [number, number, number];
  ab: [number, number];
  hex: number;
}

/** Room between the hull and the shell, in tiles (sideways) and height units (over the roof). */
const MARGIN = 0.55;
/** Smallest semi-axis across the ship, as a share of the long one: a thin hull still gets an oval, not a sliver. */
const MIN_ASPECT = 0.38;
/** The shell's height is at least this share of its smaller ground semi-axis, so it reads as a dome, not a pancake. */
const MIN_RISE = 0.55;
/** One hex cell across, in tiles of the shell's surface. */
const HEX_TILES = 1.1;

const HW = TILE_W / 2;
const HH = TILE_H / 2;
/** The view direction in grid space (sx, sy, z): the screen does not move along it; +d points at the camera. */
const VIEW: readonly [number, number, number] = [1, 1, (2 * HH) / Z_PX];

type V3 = [number, number, number];
const dot = (u: readonly number[], v: readonly number[]): number =>
  (u[0] as number) * (v[0] as number) + (u[1] as number) * (v[1] as number) + (u[2] as number) * (v[2] as number);

/** The ellipsoid round a set of grid-space points (sector tile coordinates, z in height units). */
export function fitBody(pts: readonly (readonly [number, number, number])[]): Fit | undefined {
  if (!pts.length) return undefined;
  const lo: V3 = [Infinity, Infinity, Infinity];
  const hi: V3 = [-Infinity, -Infinity, -Infinity];
  for (const p of pts) {
    for (let i = 0; i < 3; i++) {
      lo[i] = Math.min(lo[i] as number, p[i] as number);
      hi[i] = Math.max(hi[i] as number, p[i] as number);
    }
  }
  const c: V3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
  let hx = Math.max((hi[0] - lo[0]) / 2, 0.5);
  let hy = Math.max((hi[1] - lo[1]) / 2, 0.5);
  const long = Math.max(hx, hy);
  hx = Math.max(hx, long * MIN_ASPECT);
  hy = Math.max(hy, long * MIN_ASPECT);
  const hz = Math.max((hi[2] - lo[2]) / 2, Math.min(hx, hy) * MIN_RISE);
  let k = 1;
  for (const p of pts) k = Math.max(k, Math.hypot((p[0] - c[0]) / hx, (p[1] - c[1]) / hy, (p[2] - c[2]) / hz));
  return project(c, [hx * k + MARGIN, hy * k + MARGIN, hz * k + MARGIN]);
}

/** The screen outline and unit-sphere frame of the ellipsoid at `c` with semi-axes `ax` (grid space). */
export function project(c: readonly [number, number, number], ax: readonly [number, number, number]): Fit {
  const [a, b, h] = ax;
  // M = P * diag(a, b, h): unit ball -> screen offset, P = [[HW, -HW, 0], [HH, HH, -Z_PX]]
  const m0 = [HW * a, -HW * b, 0];
  const m1 = [HH * a, HH * b, -Z_PX * h];
  // S = M M^T: the outline's shape matrix; its eigen-axes are the outline's
  const sxx = dot(m0, m0);
  const sxy = dot(m0, m1);
  const syy = dot(m1, m1);
  const tr = (sxx + syy) / 2;
  const disc = Math.sqrt(((sxx - syy) / 2) ** 2 + sxy * sxy);
  // M^+ = M^T S^-1: screen offset -> the unit-ball point on the plane facing the camera
  const det = sxx * syy - sxy * sxy;
  const i00 = syy / det;
  const i01 = -sxy / det;
  const i11 = sxx / det;
  const mx = [0, 1, 2].map((k) => (m0[k] as number) * i00 + (m1[k] as number) * i01) as V3;
  const my = [0, 1, 2].map((k) => (m0[k] as number) * i01 + (m1[k] as number) * i11) as V3;
  const nv: V3 = [VIEW[0] / a, VIEW[1] / b, VIEW[2] / h];
  const nl = Math.hypot(...nv);
  const r = (a + b) / 2;
  const centre = sectorArt(c[0], c[1]);
  return {
    cx: centre.x,
    cy: centre.y - c[2] * Z_PX,
    rx: Math.sqrt(tr + disc),
    ry: Math.sqrt(Math.max(tr - disc, 1)),
    rot: 0.5 * Math.atan2(2 * sxy, sxx - syy),
    body: {
      mx,
      my,
      n: nv.map((v) => v / nl) as V3,
      ab: [a / r, b / r],
      hex: HEX_TILES / ((r * Math.PI) / 2),
    },
  };
}

/** The bubble round a ship's bounding box (no grid to fit to): the box from floor to roof. */
export function boxFit(s: Pick<Ship, 'x' | 'y' | 'width' | 'height'>): Fit {
  return fitBody([
    [s.x, s.y, 0],
    [s.x + s.width, s.y + s.height, ROOF_Z],
  ]) as Fit;
}

/** The bubble round a ship's hull: every non-space tile's corners at floor and roof height. */
export function hullFit(g: GridLike): Fit | undefined {
  const pts: V3[] = [];
  for (let y = g.y0; y < g.y0 + g.height; y++) {
    for (let x = g.x0; x < g.x0 + g.width; x++) {
      if (g.get('struct', x, y) === Struct.Space) continue;
      for (const [cx, cy] of [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]] as const) pts.push([cx, cy, 0], [cx, cy, ROOF_Z]);
    }
  }
  return fitBody(pts);
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
