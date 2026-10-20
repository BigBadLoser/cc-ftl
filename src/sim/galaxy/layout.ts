import type { Rng } from '../rng';
import type { Vec } from './geometry';
import { LAYOUT_LOOSENESS, LAYOUT_WEIGHTS } from './tuning';

/**
 * Sector layout styles. A style does not place nodes; it is a weight over the sector disc (unit coordinates) that node
 * darts are accepted against, blended with a random looseness. So a "ring" sector leans ring-shaped, a "streak" leans
 * long and thin, and no two sectors of a style look the same.
 */
export type LayoutStyle = 'cloud' | 'streak' | 'clumps' | 'ring' | 'fork' | 'corridor' | 'spokes';

export interface Layout {
  style: LayoutStyle;
  /** Acceptance weight in [0, 1] at a point of the unit disc. */
  weight(p: Vec): number;
}

const gauss = (d: number, w: number): number => Math.exp(-((d / w) ** 2));

/** Distance from p to the segment a-b. */
function segDist(p: Vec, a: Vec, b: Vec): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / (vx * vx + vy * vy || 1)));
  return Math.hypot(p.x - a.x - t * vx, p.y - a.y - t * vy);
}

/** Distance from p to a polyline. */
const lineDist = (p: Vec, line: readonly Vec[]): number => {
  let d = Infinity;
  for (let i = 1; i < line.length; i++) d = Math.min(d, segDist(p, line[i - 1] as Vec, line[i] as Vec));
  return d;
};

/** Arms from the centre at the given angles, reaching `len` of the radius. */
function arms(angles: readonly number[], len: number, width: number): (p: Vec) => number {
  const ends = angles.map((a) => ({ x: Math.cos(a) * len, y: Math.sin(a) * len }));
  return (p) => Math.max(...ends.map((e) => gauss(segDist(p, { x: 0, y: 0 }, e), width)));
}

/** The shape term of a style, with its random orientation and proportions drawn from `rng`. */
function shape(style: LayoutStyle, rng: Rng): (p: Vec) => number {
  const turn = rng.next() * Math.PI * 2;
  switch (style) {
    case 'cloud':
      return () => 1;
    case 'streak': {
      const width = 0.25 + 0.15 * rng.next();
      return (p) => gauss(-p.x * Math.sin(turn) + p.y * Math.cos(turn), width);
    }
    case 'clumps': {
      const n = 2 + (rng.next() < 0.4 ? 1 : 0);
      const at = Array.from({ length: n }, (_, k) => {
        const a = turn + (k / n) * Math.PI * 2 + (rng.next() - 0.5) * 0.8;
        const d = 0.4 + 0.25 * rng.next();
        return { x: Math.cos(a) * d, y: Math.sin(a) * d };
      });
      return (p) => Math.max(...at.map((c) => gauss(Math.hypot(p.x - c.x, p.y - c.y), 0.3)));
    }
    case 'ring': {
      const r = 0.62 + 0.12 * rng.next();
      return (p) => gauss(Math.hypot(p.x, p.y) - r, 0.18);
    }
    case 'fork': {
      const spread = 0.7 + 0.5 * rng.next();
      return arms([turn, turn + Math.PI - spread / 2, turn + Math.PI + spread / 2], 0.9, 0.2);
    }
    case 'spokes': {
      const n = 4 + (rng.next() < 0.5 ? 1 : 0);
      const fn = arms(Array.from({ length: n }, (_, k) => turn + (k / n) * Math.PI * 2 + (rng.next() - 0.5) * 0.5), 0.9, 0.18);
      return (p) => Math.max(fn(p), gauss(Math.hypot(p.x, p.y), 0.25));
    }
    case 'corridor': {
      // A curve across the disc: a quadratic bend sampled as a polyline.
      const bend = (rng.next() - 0.5) * 1.4;
      const dx = Math.cos(turn);
      const dy = Math.sin(turn);
      const line: Vec[] = [];
      for (let k = 0; k <= 12; k++) {
        const t = k / 12 * 2 - 1;
        const off = bend * (1 - t * t);
        line.push({ x: dx * t * 0.95 - dy * off, y: dy * t * 0.95 + dx * off });
      }
      return (p) => gauss(lineDist(p, line), 0.2);
    }
  }
}

/** Pick a sector's layout: a hub leans to spokes, the start sector stays a loose cloud, others by LAYOUT_WEIGHTS. */
export function pickLayout(rng: Rng, hub: boolean, start: boolean): Layout {
  let style: LayoutStyle = 'cloud';
  if (hub) style = 'spokes';
  else if (!start) {
    const entries = Object.entries(LAYOUT_WEIGHTS) as [LayoutStyle, number][];
    let roll = rng.next() * entries.reduce((t, [, w]) => t + w, 0);
    style = (entries.find(([, w]) => (roll -= w) < 0) ?? entries[0]!)[0];
  }
  const loose = LAYOUT_LOOSENESS.min + rng.next() * (LAYOUT_LOOSENESS.max - LAYOUT_LOOSENESS.min);
  const fn = shape(style, rng);
  return { style, weight: (p) => loose + (1 - loose) * fn(p) };
}
