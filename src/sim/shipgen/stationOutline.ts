/**
 * Ring outlines for round stations. A ring is drawn round the centre at "radius" R in a norm: the round norm (k = 0)
 * gives the old rasterised circle; k in (1, 2) gives an octagon, max(|x|, |y|, (|x| + |y|) / k): k = sqrt 2 a regular
 * octagon, k near 2 a square with small chamfered corners. Straight sides keep ring rooms rectangular (no
 * stair-stepped walls); only the chamfers run at 45 degrees.
 *
 * Positions along a ring are measured as outline length (`along`), not angle, so rooms get equal floor for equal
 * share whatever the shape (a square's corners carry more length per radian than its sides).
 */

const TAU = Math.PI * 2;

/** The ring norm of (x, y): Euclidean for k = 0, else the octagon norm. */
export function ringNorm(x: number, y: number, k: number): number {
  if (k <= 0) return Math.hypot(x, y);
  const ax = Math.abs(x), ay = Math.abs(y);
  return Math.max(ax, ay, (ax + ay) / k);
}

/** Distance from the centre to the unit outline at angle a. */
export const reachAt = (a: number, k: number): number => 1 / ringNorm(Math.cos(a), Math.sin(a), k);

/** Outward normal of the outline at angle a: radial when round, else the face's (axis or diagonal). */
export function normalAt(a: number, k: number): { nx: number; ny: number } {
  const c = Math.cos(a), s = Math.sin(a);
  if (k <= 0) return { nx: c, ny: s };
  const ax = Math.abs(c), ay = Math.abs(s), d = (ax + ay) / k;
  if (d > ax + 1e-9 && d > ay + 1e-9) return { nx: Math.sign(c) * Math.SQRT1_2, ny: Math.sign(s) * Math.SQRT1_2 };
  return ax >= ay ? { nx: Math.sign(c), ny: 0 } : { nx: 0, ny: Math.sign(s) };
}

const SAMPLES = 720;
const tables = new Map<number, Float64Array>();
/** Cumulative unit-outline length at SAMPLES + 1 evenly spaced angles over 0..TAU. */
function table(k: number): Float64Array {
  let t = tables.get(k);
  if (t) return t;
  t = new Float64Array(SAMPLES + 1);
  let px = reachAt(0, k), py = 0;
  for (let i = 1; i <= SAMPLES; i++) {
    const a = (i / SAMPLES) * TAU, r = reachAt(a, k);
    const x = r * Math.cos(a), y = r * Math.sin(a);
    t[i] = (t[i - 1] as number) + Math.hypot(x - px, y - py);
    px = x; py = y;
  }
  tables.set(k, t);
  return t;
}

/** Length of the unit outline (2 pi when round). */
export const perimeter = (k: number): number => (k <= 0 ? TAU : (table(k)[SAMPLES] as number));

/** Unit-outline length from angle 0 to angle a (any real a; whole turns add a perimeter). */
export function along(a: number, k: number): number {
  if (k <= 0) return a;
  const t = table(k), P = t[SAMPLES] as number;
  const turns = Math.floor(a / TAU);
  const f = ((a - turns * TAU) / TAU) * SAMPLES;
  const i = Math.min(SAMPLES - 1, Math.floor(f));
  return turns * P + (t[i] as number) + ((t[i + 1] as number) - (t[i] as number)) * (f - i);
}

/** The angle in [a0, a1] at outline length `len` past a0 (inverse of `along`). */
export function angleAlong(a0: number, a1: number, len: number, k: number): number {
  if (k <= 0) return Math.min(a1, a0 + len);
  const base = along(a0, k);
  let lo = a0, hi = a1;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (along(m, k) - base < len) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}

/** Outline length of an arc [a0, a1]. */
export const arcLength = (a0: number, a1: number, k: number): number => along(a1, k) - along(a0, k);
