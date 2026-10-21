import { TERRAIN_COARSE, TERRAIN_LATTICE, TERRAIN_LOW, TERRAIN_SCALE, TERRAIN_STREAK, TERRAIN_TIDE_SCALE } from './tuning';

/** Fast hash of four integers to [0, 1) (murmur-style mixing, fixed arity for the noise inner loop). */
function h4(a: number, b: number, c: number, d: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13) ^ b, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 16) ^ c, 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 15) ^ d, 0x165667b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

const smooth = (e0: number, e1: number, v: number): number => {
  const t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/**
 * The galaxy's terrain: a density field from domain-warped fractal noise. Filaments follow one contour of the warped
 * noise, clouds sit on a second channel, and the start sits in a guaranteed bump of density. Density is 0 in the rifts
 * (void) and up to 1 on dense ridges. Values are computed on a fixed lattice and interpolated, so the same point gives
 * the same density whichever chunk asks. Endless: a pure function of (seed, position).
 */
export class Terrain {
  private lattice = new Map<number, number>();
  private coarseLattice = new Map<number, number>();
  private lows = new Map<number, Float64Array>();

  constructor(readonly seed: number) {}

  /** Value noise in [0, 1) on the integer lattice, smoothly interpolated. */
  private vnoise(x: number, y: number, salt: number): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const u = fx * fx * (3 - 2 * fx);
    const v = fy * fy * (3 - 2 * fy);
    const h = (a: number, b: number) => h4(this.seed, a, b, salt);
    const a = h(ix, iy);
    const b = h(ix + 1, iy);
    const c = h(ix, iy + 1);
    const d = h(ix + 1, iy + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  /** Fractal noise; each octave is rotated so no axis-aligned grain shows. */
  private fbm(x: number, y: number, salt: number, octaves: number): number {
    let amp = 0.5;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      const c = Math.cos(0.55 * i + 0.3);
      const s = Math.sin(0.55 * i + 0.3);
      const rx = x * c - y * s;
      const ry = x * s + y * c;
      sum += amp * this.vnoise(rx + i * 17.3, ry + i * 9.1, salt + i * 131);
      norm += amp;
      x = rx * 2;
      y = ry * 2;
      amp *= 0.5;
    }
    return sum / norm;
  }

  /** Low-frequency noise in [0, 1) around 0.5 at `scale` units per feature (for wobbly region borders). */
  wobble(x: number, y: number, scale: number, salt: number): number {
    return this.fbm(x / scale, y / scale, 1000 + salt, 2);
  }

  /**
   * The large-scale tide at a point, 0..1: a very low-frequency field (TERRAIN_TIDE_SCALE) that makes dense core
   * expanses where it is high and a sparse outer rim where it is low.
   */
  tide(x: number, y: number): number {
    return smooth(0.3, 0.7, this.fbm(x / TERRAIN_TIDE_SCALE + 11.3, y / TERRAIN_TIDE_SCALE - 4.1, 21, 3));
  }

  /** The slowly varying parts at a lattice point: domain warp (qx, qy), flow direction (fx, fy) and the tide. */
  private lowAt(ix: number, iy: number): Float64Array {
    const key = (ix + 32768) * 65536 + (iy + 32768);
    let v = this.lows.get(key);
    if (!v) {
      const px = (ix * TERRAIN_LOW) / TERRAIN_SCALE;
      const py = (iy * TERRAIN_LOW) / TERRAIN_SCALE;
      const flow = this.fbm(px * 0.35 - 7.9, py * 0.35 + 1.7, 7, 2) * Math.PI * 4;
      v = Float64Array.of(
        this.fbm(px + 3.1, py + 7.7, 1, 4) - 0.5, this.fbm(px - 5.4, py + 2.2, 2, 4) - 0.5,
        Math.cos(flow), Math.sin(flow), this.tide(ix * TERRAIN_LOW, iy * TERRAIN_LOW),
      );
      this.lows.set(key, v);
    }
    return v;
  }

  /** The slowly varying parts at (x, y), bilinear on the TERRAIN_LOW lattice (they barely change across a cell). */
  private low(x: number, y: number): number[] {
    const gx = x / TERRAIN_LOW;
    const gy = y / TERRAIN_LOW;
    const ix = Math.floor(gx);
    const iy = Math.floor(gy);
    const fx = gx - ix;
    const fy = gy - iy;
    const a = this.lowAt(ix, iy);
    const b = this.lowAt(ix + 1, iy);
    const c = this.lowAt(ix, iy + 1);
    const d = this.lowAt(ix + 1, iy + 1);
    return [0, 1, 2, 3, 4].map((k) => a[k]! + (b[k]! - a[k]!) * fx + (c[k]! - a[k]!) * fy + (a[k]! - b[k]! - c[k]! + d[k]!) * fx * fy);
  }

  /** The raw field at a point (no lattice). */
  private raw(x: number, y: number): number {
    const px = x / TERRAIN_SCALE;
    const py = y / TERRAIN_SCALE;
    const [qx, qy, fx, fy, tide] = this.low(x, y) as [number, number, number, number, number];
    // Directional terrain: smear the filament noise along a slowly turning flow, so ridges run as long streams.
    const dx = fx * TERRAIN_STREAK;
    const dy = fy * TERRAIN_STREAK;
    let n = 0;
    for (let k = -1; k <= 1; k++) n += this.fbm(px + 3.4 * qx + 1.5 * k * dx, py + 3.4 * qy + 1.5 * k * dy, 3, 4);
    n /= 3;
    const filament = 1 - smooth(0, 0.08 + 0.08 * tide, Math.abs(n - 0.5));
    const cloud = smooth(0.62 - 0.2 * tide, 0.8 - 0.2 * tide, this.fbm(px * 0.6 + 2.2 * qy, py * 0.6 - 2.2 * qx, 9, 4));
    const grain = 0.12 * (this.fbm(px * 3, py * 3, 4, 2) - 0.5);
    const home = 0.85 * (1 - smooth(500, 1500, Math.hypot(x, y)));
    const d = (0.78 * filament + 0.4 * cloud * (0.3 + 0.7 * filament) - 0.05 + grain) * (0.8 + 0.45 * tide);
    return Math.max(0, Math.min(1, Math.max(home, d)));
  }

  private at(cache: Map<number, number>, step: number, ix: number, iy: number): number {
    const key = (ix + 32768) * 65536 + (iy + 32768);
    let v = cache.get(key);
    if (v === undefined) {
      v = this.raw(ix * step, iy * step);
      cache.set(key, v);
    }
    return v;
  }

  private sample(cache: Map<number, number>, step: number, x: number, y: number): number {
    const gx = x / step;
    const gy = y / step;
    const ix = Math.floor(gx);
    const iy = Math.floor(gy);
    const fx = gx - ix;
    const fy = gy - iy;
    const a = this.at(cache, step, ix, iy);
    const b = this.at(cache, step, ix + 1, iy);
    const c = this.at(cache, step, ix, iy + 1);
    const d = this.at(cache, step, ix + 1, iy + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }

  /** Density at (x, y): 0 (void) .. 1 (dense), bilinear on the fine lattice (for site placement). */
  density(x: number, y: number): number {
    return this.sample(this.lattice, TERRAIN_LATTICE, x, y);
  }

  /** Density on the coarse lattice: cheaper, for long void checks along lines (lanes, region reach). */
  coarse(x: number, y: number): number {
    return this.sample(this.coarseLattice, TERRAIN_COARSE, x, y);
  }

  /** Length of the longest stretch of a-b below `min` density (sampled every `step` units). */
  voidRun(ax: number, ay: number, bx: number, by: number, min: number, step = 50): { longest: number; total: number } {
    const len = Math.hypot(bx - ax, by - ay);
    const n = Math.max(1, Math.ceil(len / step));
    const seg = len / n;
    let run = 0;
    let longest = 0;
    let total = 0;
    for (let k = 1; k < n; k++) {
      const t = k / n;
      if (this.coarse(ax + (bx - ax) * t, ay + (by - ay) * t) < min) {
        run += seg;
        total += seg;
        longest = Math.max(longest, run);
      } else run = 0;
    }
    return { longest, total };
  }
}
