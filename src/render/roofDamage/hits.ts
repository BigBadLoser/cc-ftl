/**
 * The roof damage art's hits laid onto a window of art px (the look: tools/damage_mock/roof_mock.py on art/walls-2x):
 * each hull hit is a jagged, stepped tear (narrow, compact or irregular) with soot, cracks and dents round it; a light
 * hit (or one on unworn plating) only dents and scorches. Worn plating round a hit makes its tear spread (tears merge).
 */
import { cellsAlong, hash, inside, jagged, rng, valueNoise, type Outline } from './noise';
import { stepped, type Mask } from './masks';

/** A hit in window art px (`x`, `y`: where it landed, on the roof plane), its power, shape seed and the wear (0..1) of
 * the plating it landed on. */
export interface RoofHit {
  x: number;
  y: number;
  power: number;
  seed: number;
  wear: number;
}

/** A window of art px at global art px (gx, gy) and its roof (where plating covers it). */
export interface Window {
  w: number;
  h: number;
  gx: number;
  gy: number;
  roof: Mask;
}

export const TEAR_POWER = 40;                   // hull damage a hit needs to tear the plating (a lighter one dents it)
export const WEAR_GIVES = 0.6;                  // ... unless the plating round it is this worn
const SPREAD = 34;                              // px a tear spreads by on fully worn plating (tears merge)
const ISO_Y = 1.35;                             // rows count this much more than columns (the roof's iso flattening)
const TEAR = { teeth: [1.2, 1.4], notch: [0.5, 0.65], body: [0.7, 1.0] } as const;
const KINDS = [['irregular', 0.45], ['narrow', 0.3], ['compact', 0.25]] as const;
const NARROW = 1.9;                             // a narrow tear: this long, 1/this wide, along its own angle
const COMPACT = 0.6;                            // a compact hole: this share of the size, spreading half as far
const STEP_W = [2, 6] as const;                 // px: a tear's edge runs in steps this wide, this tall (irregular)
const STEP_H = [2, 4] as const;
const DENT_N = 7;                               // dents round a tear
const DENT_R = [4, 8] as const;                 // their radius (x the hit's size)

const clamp = (v: number, a = 0, b = 1): number => Math.max(a, Math.min(b, v));
const between = (r: () => number, a: readonly [number, number]): number => a[0] + (a[1] - a[0]) * r();
const normal = (r: () => number): number => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

/** A hit's size from its power: 1 for a missile (90). */
export const sizeOf = (power: number): number => clamp(Math.sqrt(power / 90), 0.35, 1.5);

/**
 * How far (art px) a hit's marks can reach: its widest tear on fully worn plating with the underplate band and cut past
 * it, its soot, its dents. A px further than this from every hit is untouched by them.
 */
export function reachOf(power: number): number {
  const size = sizeOf(power);
  const R = (18 + SPREAD) * size;
  const tear = R * TEAR.teeth[1] * NARROW + STEP_W[1] + 24;
  const soot = Math.max((26 + SPREAD * 0.8) * size * 1.6 * 1.35, (R + 4) * 1.6);
  const dents = 27 * size + 12 * DENT_R[1] * size;
  return Math.ceil(Math.max(tear, soot, dents));
}

/** What the hits leave on the window: torn holes, soot (0..1), cracks, dent depth. */
export interface HitFields {
  hole: Mask;
  scorch: Float32Array;
  crack: Mask;
  dent: Float32Array;
}

export function hitFields(win: Window, hits: readonly RoofHit[]): HitFields {
  const { w, h, gx, gy, roof } = win;
  const hole = new Uint8Array(w * h);
  const scorch = new Float32Array(w * h);
  const crack = new Uint8Array(w * h);
  const dent = new Float32Array(w * h);
  const warps = new Float32Array(w * h).fill(NaN);                   // (worked out where a hit's soot reaches only)
  const warp = (x: number, y: number, i: number): number => (Number.isNaN(warps[i]) ? (warps[i] = valueNoise(gx + x, gy + y, 10, 3, 1)) : (warps[i] as number));
  for (const hit of hits) {
    const size = sizeOf(hit.power);
    const worn = hit.wear;
    const tears = hit.power >= TEAR_POWER || worn >= WEAR_GIVES;
    const r = rng(hit.seed);
    const cracks = Array.from({ length: 1 + Math.floor(r() * 3) }, () => [r() * 2 * Math.PI, between(r, [0.9, 1.5])] as const);
    if (!tears) {
      minor(hit, r);
      continue;
    }
    const outline = jagged(r, cracks.map((c) => c[0]), TEAR);
    const kr = rng(hash(hit.seed, 70));
    const pick = kr();
    const kind = pick < KINDS[0][1] ? 'irregular' : pick < KINDS[0][1] + KINDS[1][1] ? 'narrow' : 'compact';
    const th = kr() * Math.PI;
    let R = 18 * size;
    let late = clamp((worn - 0.5) / 0.5);
    if (kind === 'compact') {
      R *= COMPACT;
      late *= 0.5;
    }
    R += SPREAD * size * late;
    tear(hit, outline, kind, th, R);
    const S = (26 + SPREAD * 0.8 * late) * size;
    soot(hit, S, cracks, R);
    for (let k = 0; k < DENT_N; k++) {
      const a = r() * 2 * Math.PI;
      const d = Math.abs(normal(r) * 9 * size);
      addDent(hit.x + d * Math.cos(a), hit.y + (d * Math.sin(a)) / ISO_Y, between(r, DENT_R) * size, rng(hash(hit.seed, 55, k)));
    }
  }
  for (let i = 0; i < w * h; i++) if (!roof[i]) [hole[i], crack[i], scorch[i], dent[i]] = [0, 0, 0, 0];
  return { hole, scorch, crack, dent };

  /** The px a callback should visit round (cx, cy) within radius rad (x) and rad / ISO_Y (y). */
  function box(cx: number, cy: number, rad: number, fn: (x: number, y: number, i: number) => void): void {
    const x0 = Math.max(0, Math.floor(cx - rad));
    const x1 = Math.min(w - 1, Math.ceil(cx + rad));
    const y0 = Math.max(0, Math.floor(cy - rad / ISO_Y));
    const y1 = Math.min(h - 1, Math.ceil(cy + rad / ISO_Y));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) fn(x, y, y * w + x);
  }

  /** A tear: the outline at radius R, squared off onto the hit's own stepped grid (relative to it: windows agree). */
  function tear(hit: RoofHit, o: Outline, kind: string, th: number, R: number): void {
    const reach = R * 1.5 * (kind === 'narrow' ? NARROW : 1) + 8;
    const x0 = Math.max(0, Math.floor(hit.x - reach));
    const x1 = Math.min(w - 1, Math.ceil(hit.x + reach));
    const y0 = Math.max(0, Math.floor(hit.y - reach / ISO_Y));
    const y1 = Math.min(h - 1, Math.ceil(hit.y + reach / ISO_Y));
    if (x1 < x0 || y1 < y0) return;
    const bw = x1 - x0 + 1;
    const bh = y1 - y0 + 1;
    const m = new Uint8Array(bw * bh);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        let dx = x - hit.x;
        let dy = (y - hit.y) * ISO_Y;
        if (kind === 'narrow') [dx, dy] = [(dx * Math.cos(th) + dy * Math.sin(th)) / NARROW, (-dx * Math.sin(th) + dy * Math.cos(th)) * NARROW];
        m[(y - y0) * bw + x - x0] = inside(o, dx / R, dy / R) ? 1 : 0;
      }
    }
    const salt = hash(hit.seed, 80);
    const sq = stepped(m, bw, bh, cellsAlong(x0 - Math.round(hit.x), bw, STEP_W, salt), cellsAlong(y0 - Math.round(hit.y), bh, STEP_H, salt + 1));
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) if (sq[y * bw + x]) hole[(y + y0) * w + x + x0] = 1;
  }

  function soot(hit: RoofHit, S: number, cracks: readonly (readonly [number, number])[], R: number): void {
    const reach = Math.max(S * 1.6, (R + 4) * 1.6) + 4;
    box(hit.x, hit.y, reach, (x, y, i) => {
      const dx = x - hit.x;
      const dy = (y - hit.y) * ISO_Y;
      const rr = Math.hypot(dx, dy);
      const sooty = rr < 1.15 * 1.35 * S;                                // (past this no warp (|warp| <= 1) brings soot)
      let cracky = false;
      for (const [, cl] of cracks) if (rr < (R + 4) * cl && rr > R * 0.8) cracky = true;
      if (!sooty && !cracky) return;
      const wp = warp(x, y, i);
      if (sooty) scorch[i] = Math.max(scorch[i] as number, clamp(1.15 - rr / (S * (1 + 0.35 * wp))));
      if (!cracky) return;
      const a = Math.atan2(dy, dx);
      for (const [ca, cl] of cracks) {                                     // (cracks: thin, wandering, out from the hole)
        const da = Math.atan2(Math.sin(a - ca - 0.25 * wp), Math.cos(a - ca - 0.25 * wp));
        const len = (R + 4) * cl;
        if (Math.abs(da) * rr < 0.6 + (0.15 * rr) / Math.max(len, 1) && rr < len && rr > R * 0.8) crack[i] = 1;
      }
    });
  }

  /** A light hit: a ragged scorch spot and one to three dents, never a hole. */
  function minor(hit: RoofHit, r: () => number): void {
    const ms = clamp(0.3 + (0.3 * hit.power) / TEAR_POWER, 0.3, 0.6);
    box(hit.x, hit.y, 30 * ms + 4, (x, y, i) => {
      const rr = Math.hypot(x - hit.x, (y - hit.y) * ISO_Y) / (1 + 0.45 * warp(x, y, i));
      scorch[i] = Math.max(scorch[i] as number, clamp(1.1 - rr / (26 * ms)) * 0.8);
    });
    const n = 1 + Math.floor(r() * 3);
    for (let j = 0; j < n; j++) {
      const a = r() * 2 * Math.PI;
      const d = j > 0 ? Math.abs(normal(r) * 4 * ms) : 0;
      addDent(hit.x + d * Math.cos(a), hit.y + (d * Math.sin(a)) / ISO_Y, between(r, DENT_R) * ms * (j === 0 ? 1.5 : 0.9), rng(hash(hit.seed, 56, j)));
    }
  }

  /** A dent: stretched along its own angle, its rim lumpy, its own depth. */
  function addDent(cx: number, cy: number, rad: number, r: () => number): void {
    const asp = between(r, [1, 2.2]);
    const th = r() * Math.PI;
    const l2 = r() * 0.3;
    const p2 = r() * 2 * Math.PI;
    const l3 = r() * 0.18;
    const p3 = r() * 2 * Math.PI;
    const amp = between(r, [0.45, 1.3]);
    const [ct, st] = [Math.cos(th), Math.sin(th)];
    const far = 60 * (rad * (1 + l2 + l3)) ** 2;                        // (past this the dent adds under e^-30)
    box(cx, cy, 4 * rad * asp + 2, (x, y, i) => {
      const ddx = x - cx;
      const ddy = (y - cy) * ISO_Y;
      const u = ddx * ct + ddy * st;
      const v = (-ddx * st + ddy * ct) * asp;
      if (u * u + v * v > far) return;
      const ang = Math.atan2(v, u);
      const rr = rad * (1 + l2 * Math.sin(2 * ang + p2) + l3 * Math.sin(3 * ang + p3));
      dent[i] = (dent[i] as number) + amp * Math.exp(-(u * u + v * v) / (2 * rr * rr));
    });
  }
}
