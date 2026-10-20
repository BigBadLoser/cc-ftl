import { hash32 } from './hash';
import { TERRAIN_LATTICE, TERRAIN_SCALE } from './tuning';

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

  constructor(readonly seed: number) {}

  /** Value noise in [0, 1) on the integer lattice, smoothly interpolated. */
  private vnoise(x: number, y: number, salt: number): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const u = fx * fx * (3 - 2 * fx);
    const v = fy * fy * (3 - 2 * fy);
    const h = (a: number, b: number) => hash32(this.seed, a, b, salt) / 4294967296;
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

  /** The raw field at a point (no lattice). */
  private raw(x: number, y: number): number {
    const px = x / TERRAIN_SCALE;
    const py = y / TERRAIN_SCALE;
    const qx = this.fbm(px + 3.1, py + 7.7, 1, 4) - 0.5;
    const qy = this.fbm(px - 5.4, py + 2.2, 2, 4) - 0.5;
    const n = this.fbm(px + 3.4 * qx, py + 3.4 * qy, 3, 5);
    const filament = 1 - smooth(0, 0.12, Math.abs(n - 0.5));
    const cloud = smooth(0.5, 0.72, this.fbm(px * 0.6 + 2.2 * qy, py * 0.6 - 2.2 * qx, 9, 4));
    const grain = 0.12 * (this.fbm(px * 3, py * 3, 4, 3) - 0.5);
    const home = 0.85 * (1 - smooth(500, 1500, Math.hypot(x, y)));
    return Math.max(0, Math.min(1, Math.max(home, 0.78 * filament + 0.35 * cloud * (0.3 + 0.7 * filament) - 0.05 + grain)));
  }

  private at(ix: number, iy: number): number {
    const key = (ix + 32768) * 65536 + (iy + 32768);
    let v = this.lattice.get(key);
    if (v === undefined) {
      v = this.raw(ix * TERRAIN_LATTICE, iy * TERRAIN_LATTICE);
      this.lattice.set(key, v);
    }
    return v;
  }

  /** Density at (x, y): 0 (void) .. 1 (dense), bilinear on the lattice. */
  density(x: number, y: number): number {
    const gx = x / TERRAIN_LATTICE;
    const gy = y / TERRAIN_LATTICE;
    const ix = Math.floor(gx);
    const iy = Math.floor(gy);
    const fx = gx - ix;
    const fy = gy - iy;
    const a = this.at(ix, iy);
    const b = this.at(ix + 1, iy);
    const c = this.at(ix, iy + 1);
    const d = this.at(ix + 1, iy + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
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
      if (this.density(ax + (bx - ax) * t, ay + (by - ay) * t) < min) {
        run += seg;
        total += seg;
        longest = Math.max(longest, run);
      } else run = 0;
    }
    return { longest, total };
  }
}
