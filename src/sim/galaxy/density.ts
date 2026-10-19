import { unit } from './hash';
import { DENSITY_CORE, DENSITY_FLOOR, DENSITY_HOME, DENSITY_OCTAVES, DENSITY_SCALE, DENSITY_VOID } from './tuning';

const fade = (t: number): number => t * t * (3 - 2 * t);

/** Smooth value noise in [0, 1): hashed lattice values, bilinear with a smoothstep fade. */
function valueNoise(seed: number, salt: number, x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = fade(x - ix);
  const fy = fade(y - iy);
  const v = (dx: number, dy: number): number => unit(seed, ix + dx, iy + dy, salt);
  const top = v(0, 0) + (v(1, 0) - v(0, 0)) * fx;
  const bot = v(0, 1) + (v(1, 1) - v(0, 1)) * fx;
  return top + (bot - top) * fy;
}

/**
 * Large-scale star density at a map position, in [0, 1]: fractal value noise, a pure function of (seed, x, y), so
 * chunks agree at the seams. Low values are voids, high values are dense cores. The start's surroundings are lifted.
 */
export function density(seed: number, x: number, y: number): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = 1 / DENSITY_SCALE;
  for (let o = 0; o < DENSITY_OCTAVES; o++) {
    sum += amp * valueNoise(seed, 60 + o, x * f, y * f);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  // The start always sits in settled space: lift the density towards the core near the origin.
  const home = Math.max(0, 1 - Math.hypot(x, y) / DENSITY_HOME);
  return Math.max(sum / norm, DENSITY_CORE * fade(Math.min(1, 2 * home)));
}

/** Coreness in [0, 1]: 0 at or below DENSITY_VOID, 1 at or above DENSITY_CORE, smooth between. */
export function coreness(d: number): number {
  return fade(Math.min(1, Math.max(0, (d - DENSITY_VOID) / (DENSITY_CORE - DENSITY_VOID))));
}

/** Chance a sector candidate survives at this coreness: DENSITY_FLOOR in voids, 1 at the core. */
export function keepChance(core: number): number {
  return DENSITY_FLOOR + (1 - DENSITY_FLOOR) * core;
}

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
