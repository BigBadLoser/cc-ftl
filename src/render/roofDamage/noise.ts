/**
 * Deterministic noise for the roof damage art (render only, no sim state). Everything is a function of region-global art
 * pixel coordinates and seeds, so a tear computed in two overlapping windows (two chunks) comes out the same in both.
 */

const H0 = 0x9e3779b1;

/** One integer folded into a running hash. */
function mix(h: number, a: number): number {
  h = Math.imul(h ^ (a | 0), 0x85ebca6b) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** 32-bit hash of small integers. */
export function hash(...v: number[]): number {
  let h = H0;
  for (const a of v) h = mix(h, a);
  return h;
}

/** `hash(a, b, c)` without the rest array (per-px paths). */
export const hash3 = (a: number, b: number, c: number): number => mix(mix(mix(H0, a), b), c);
const hash4 = (a: number, b: number, c: number, d: number): number => mix(mix(mix(mix(H0, a), b), c), d);

/** A float in [0, 1) from integers. */
export const unit = (...v: number[]): number => hash(...v) / 4294967296;

/** A small seeded generator (mulberry32): a hit's own draws, so its shape never depends on the other hits. */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

/** Smooth value noise at (x, y) (global art px), `octaves` octaves from cell size `scale`, about -1..1. */
export function valueNoise(x: number, y: number, scale: number, octaves: number, salt: number): number {
  let out = 0;
  let amp = 1;
  for (let o = 0; o < octaves; o++) {
    const s = scale / 2 ** o;
    const fx = x / s;
    const fy = y / s;
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const tx = smooth(fx - ix);
    const ty = smooth(fy - iy);
    const g00 = (hash4(ix, iy, o, salt) / 4294967296) * 2 - 1;
    const g10 = (hash4(ix + 1, iy, o, salt) / 4294967296) * 2 - 1;
    const g01 = (hash4(ix, iy + 1, o, salt) / 4294967296) * 2 - 1;
    const g11 = (hash4(ix + 1, iy + 1, o, salt) / 4294967296) * 2 - 1;
    const v = (g00 * (1 - tx) + g10 * tx) * (1 - ty) + (g01 * (1 - tx) + g11 * tx) * ty;
    out += v * amp;
    amp *= 0.5;
  }
  return out / 1.75;
}

/**
 * The cell along one axis of an irregular grid (cell edges at spacings of about lo..hi px), for a coordinate `c` (global
 * art px). Edges sit at k * mid + a hashed jitter, so any window agrees on where they are.
 */
export function cellOf(c: number, lo: number, hi: number, salt: number): number {
  const mid = (lo + hi) / 2;
  const span = hi - lo;
  const edge = (k: number): number => k * mid + (mix(mix(H0, k), salt) / 4294967296 - 0.5) * span;
  let k = Math.floor(c / mid);
  if (c < edge(k)) k--;
  else if (c >= edge(k + 1)) k++;
  return k;
}

/** `cellOf` for the n coordinates from c0 on (one axis of a window: a cell grid is separable). */
export function cellsAlong(c0: number, n: number, size: readonly [number, number], salt: number): Int32Array {
  const out = new Int32Array(n);
  for (let i = 0; i < n; i++) out[i] = cellOf(c0 + i, size[0], size[1], salt);
  return out;
}

/** One cell id of a 2D irregular grid (`cellOf` across and down). */
export function cellId(x: number, y: number, w: readonly [number, number], h: readonly [number, number], salt: number): number {
  return hash(cellOf(x, w[0], w[1], salt), cellOf(y, h[0], h[1], salt + 1), salt);
}

/** A torn hole's outline: radius by angle around its centre (polygon corners), from the hit's own draws. */
export interface Outline {
  /** Corner angles (sorted, radians) and their radii (in the hole's own units: 1 = its size). */
  ang: number[];
  rad: number[];
}

export interface OutlineShape {
  teeth: readonly [number, number];
  notch: readonly [number, number];
  body: readonly [number, number];
}

/** Straight edges between n corners at irregular angles, two teeth along the hit's cracks, three deep notches. */
export function jagged(r: () => number, cracks: readonly number[], shape: OutlineShape, n = 14): Outline {
  const between = (a: readonly [number, number]): number => a[0] + (a[1] - a[0]) * r();
  const ang = [...Array.from({ length: n - 2 }, () => r() * 2 * Math.PI), ...cracks.slice(0, 2)].map((a) => a % (2 * Math.PI)).sort((a, b) => a - b);
  const rad = ang.map(() => between(shape.body));
  const order = [...ang.keys()];
  for (let i = 0; i < 3; i++) {                                         // (three distinct corners: a partial shuffle)
    const j = i + Math.floor(r() * (order.length - i));
    [order[i], order[j]] = [order[j] as number, order[i] as number];
    rad[order[i] as number] = between(shape.notch);
  }
  for (const ca of cracks.slice(0, 2)) {
    let best = 0;
    let bd = Infinity;
    ang.forEach((a, i) => {
      const d = Math.abs(Math.atan2(Math.sin(a - ca), Math.cos(a - ca)));
      if (d < bd) [bd, best] = [d, i];
    });
    rad[best] = between(shape.teeth);
  }
  return { ang, rad };
}

/** Whether a point (in the hole's own units) is inside the outline's polygon (even-odd). */
export function inside(o: Outline, x: number, y: number): boolean {
  const { xs, ys } = corners(o);
  let res = false;
  const n = xs.length;
  for (let i = 0; i < n; i++) {
    const x0 = xs[i] as number;
    const y0 = ys[i] as number;
    const x1 = xs[(i + 1) % n] as number;
    const y1 = ys[(i + 1) % n] as number;
    if (y0 > y !== y1 > y && x < ((x1 - x0) * (y - y0)) / (y1 - y0 + 1e-12) + x0) res = !res;
  }
  return res;
}

const cornersOf = new WeakMap<Outline, { xs: Float64Array; ys: Float64Array }>();

/** An outline's corners as points (worked out once per outline). */
function corners(o: Outline): { xs: Float64Array; ys: Float64Array } {
  let c = cornersOf.get(o);
  if (!c) {
    c = { xs: Float64Array.from(o.ang, (a, i) => Math.cos(a) * (o.rad[i] as number)), ys: Float64Array.from(o.ang, (a, i) => Math.sin(a) * (o.rad[i] as number)) };
    cornersOf.set(o, c);
  }
  return c;
}
