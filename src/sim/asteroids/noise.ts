/**
 * Seeded 2D value noise for organic outlines (pure integer hashing, no state). Deterministic for a seed: the same
 * (seed, x, y) always gives the same value, in any order.
 */

function hash(seed: number, x: number, y: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

/** Value noise in [0, 1) at (x, y), lattice spacing 1. */
export function valueNoise(seed: number, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smooth(x - x0);
  const ty = smooth(y - y0);
  const a = hash(seed, x0, y0);
  const b = hash(seed, x0 + 1, y0);
  const c = hash(seed, x0, y0 + 1);
  const d = hash(seed, x0 + 1, y0 + 1);
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}

/** Fractal sum of `octaves` value-noise layers at base frequency `freq`, normalised to [0, 1). */
export function fbm(seed: number, x: number, y: number, freq: number, octaves = 3): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = freq;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise(seed + o * 1013, x * f, y * f);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}
