/**
 * Asteroid generator: pure and seeded (the sim's `Rng`, its own stream per seed). Separate from ship shipgen; it shares only
 * the RNG and the validation helpers. Output is an `AsteroidPlan` in local tiles, stamped by `stampAsteroid`.
 */
import type { Rect } from '../grid';
import { Rng } from '../rng';
import { Struct } from '../structure';
import { fbm } from './noise';
import { blob, bounds, crop, depth, fillHoles, largestBody, metaballs, type Ball, type Mask } from './shape';
import type { AsteroidCoverage, AsteroidKind, AsteroidPlan, OreDef } from './types';

/** Big asteroid parameters. Diameter is the longer side before the outline is trimmed. */
export const BIG = {
  minSize: 40,
  maxSize: 120,
  /** Shorter side as a fraction of the longer, inclusive range. */
  aspect: [0.6, 1],
  balls: [5, 9],
  /** Outline roughness (noise amplitude on the metaball field). */
  rough: 0.75,
  /** Coverage class odds (dense asteroids are common) and the rock-mass share of each, inclusive range. */
  coverage: { open: 3, mixed: 3, dense: 4 },
  mass: { open: [0.06, 0.2], mixed: [0.3, 0.55], dense: [0.78, 1] },
  /** Massifs (big blobs of mass) and craters (a ground floor ringed by a mass rim) per asteroid. */
  massifs: [1, 2],
  craters: [1, 4],
  /** Rock tiles per ore vein. */
  tilesPerVein: 200,
  veinLength: [12, 40],
  /** Chance a vein step is two tiles wide. */
  veinWide: 0.35,
  /** Chance a vein starts inside rock mass (massifs, ridges), and the amount factor of ore in rock mass (richer). */
  veinInMass: 0.7,
  massRich: 1.6,
} as const;

/** Asteroid field parameters. */
export const FIELD = {
  width: [70, 110],
  height: [45, 70],
  rocks: [18, 34],
  /** Clumps the rocks gather around. */
  clusters: [2, 4],
  minRock: 3,
  maxRock: 15,
  /** Empty tiles kept between any two rocks of a field (their bboxes). */
  gap: 3,
  /** Chance a rock has ore pockets, and pockets per rock with ore. */
  pocketChance: 0.65,
  pockets: [1, 2],
  placeTries: 600,
} as const;

/** Options for `generateAsteroid`. `coverage` forces a big asteroid's class; default rolled from the seed (the outline is the same). */
export interface AsteroidGenOptions {
  coverage?: AsteroidCoverage;
}


function pickOre(rng: Rng, ores: readonly OreDef[], kind: AsteroidKind): OreDef | undefined {
  const total = ores.reduce((s, o) => s + o.weight[kind], 0);
  if (total <= 0) return undefined;
  let r = rng.next() * total;
  for (const o of ores) {
    r -= o.weight[kind];
    if (r < 0) return o;
  }
  return ores[ores.length - 1];
}

function emptyPlan(kind: AsteroidKind, seed: number, coverage: AsteroidCoverage, w: number, h: number): AsteroidPlan {
  return { kind, seed, coverage, mass: 0, w, h, struct: new Uint8Array(w * h), ore: new Uint8Array(w * h), amt: new Uint8Array(w * h), parts: [] };
}

function setOre(plan: AsteroidPlan, i: number, ore: OreDef, rng: Rng): void {
  const k = plan.struct[i];
  if (k !== Struct.Rock && k !== Struct.Ground) return;
  const n = rng.int(ore.amount[0], ore.amount[1]);
  plan.ore[i] = ore.code;
  plan.amt[i] = Math.min(255, k === Struct.Rock && plan.kind === 'big' ? Math.round(n * BIG.massRich) : n);
}

/** Ore veins: wandering 4-connected streaks through both rock forms, one or two tiles wide, most starting in rock mass. */
function carveVeins(plan: AsteroidPlan, rng: Rng, ores: readonly OreDef[]): void {
  const rock: number[] = [];
  const mass: number[] = [];
  for (let i = 0; i < plan.struct.length; i++) {
    if (plan.struct[i] !== Struct.Space) rock.push(i);
    if (plan.struct[i] === Struct.Rock) mass.push(i);
  }
  const veins = Math.max(2, Math.round(rock.length / BIG.tilesPerVein));
  for (let v = 0; v < veins && rock.length > 0; v++) {
    const ore = pickOre(rng, ores, 'big');
    if (!ore) return;
    const inMass = rng.chance(BIG.veinInMass) && mass.length > 0;
    const start = rng.pick(inMass ? mass : rock);
    let x = start % plan.w;
    let y = (start - x) / plan.w;
    let heading = rng.next() * Math.PI * 2;
    const length = rng.int(BIG.veinLength[0], BIG.veinLength[1]);
    for (let s = 0; s < length; s++) {
      const i = y * plan.w + x;
      setOre(plan, i, ore, rng);
      if (rng.chance(BIG.veinWide)) {
        // widen sideways (perpendicular to the dominant axis), so the streak stays one body
        const side = Math.abs(Math.cos(heading)) > Math.abs(Math.sin(heading)) ? plan.w : 1;
        if (i + side < plan.struct.length && (side === plan.w || (i + 1) % plan.w !== 0)) setOre(plan, i + side, ore, rng);
      }
      heading += (rng.next() - 0.5) * 0.7;
      const c = Math.cos(heading), sn = Math.sin(heading);
      const alongX = rng.next() < Math.abs(c) / (Math.abs(c) + Math.abs(sn));
      const nx = alongX ? x + Math.sign(c) : x;
      const ny = alongX ? y : y + Math.sign(sn);
      if (nx < 0 || ny < 0 || nx >= plan.w || ny >= plan.h || plan.struct[ny * plan.w + nx] === Struct.Space) break;
      x = nx;
      y = ny;
    }
  }
}

function rollCoverage(rng: Rng): AsteroidCoverage {
  const w = BIG.coverage;
  const r = rng.next() * (w.open + w.mixed + w.dense);
  return r < w.open ? 'open' : r < w.open + w.mixed ? 'mixed' : 'dense';
}

/**
 * Rock-mass height field over the body: ridged noise (ridges), one or two massifs (broad domes), craters (a ring rim of mass
 * around a sunken floor), all deterministic for the seed. The highest `share` of body tiles become rock mass.
 */
function massField(rng: Rng, mask: Mask): Float64Array {
  const { w, h, m } = mask;
  const f = new Float64Array(w * h);
  const seed = rng.int(0, 0x7fffffff);
  const freq = 3 / Math.min(w, h);
  const massifs = Array.from({ length: rng.int(BIG.massifs[0], BIG.massifs[1]) }, () => ({ x: w * (0.2 + 0.6 * rng.next()), y: h * (0.2 + 0.6 * rng.next()), r: Math.min(w, h) * (0.12 + 0.14 * rng.next()) }));
  const craters = Array.from({ length: rng.int(BIG.craters[0], BIG.craters[1]) }, () => ({ x: w * (0.15 + 0.7 * rng.next()), y: h * (0.15 + 0.7 * rng.next()), r: Math.min(w, h) * (0.05 + 0.1 * rng.next()) }));
  const d = depth(mask);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!m[i]) continue;
      const ridge = 1 - Math.abs(2 * fbm(seed, x, y, freq, 3) - 1);
      let v = 0.55 * ridge ** 3 + 0.15 * fbm(seed + 7, x, y, freq * 3, 2);
      for (const s of massifs) v += 0.9 * Math.max(0, 1 - Math.hypot(x - s.x, y - s.y) / s.r);
      for (const c of craters) {
        const t = Math.hypot(x - c.x, y - c.y) / c.r;
        v += t < 0.85 ? -0.6 : t < 1.2 ? 0.5 * (1 - Math.abs(t - 1.02) / 0.18) : 0;
      }
      // the outer band leans to ground on open and mixed asteroids
      v -= 0.25 * Math.max(0, 1 - (d[i] as number) / 4);
      f[i] = v;
    }
  }
  return f;
}

function generateBig(seed: number, ores: readonly OreDef[], opts: AsteroidGenOptions): AsteroidPlan {
  const rng = new Rng(seed ^ 0x5a17e401);
  const rolled = rollCoverage(rng);
  const coverage = opts.coverage ?? rolled;
  const size = rng.int(BIG.minSize, BIG.maxSize);
  const short = Math.max(BIG.minSize, Math.round(size * (BIG.aspect[0] + (BIG.aspect[1] - BIG.aspect[0]) * rng.next())));
  const [w, h] = rng.chance(0.5) ? [size, short] : [short, size];
  const balls: Ball[] = [{ x: w / 2, y: h / 2, r: Math.min(w, h) * 0.3 }];
  const count = rng.int(BIG.balls[0], BIG.balls[1]);
  for (let i = 1; i < count; i++) {
    const a = rng.next() * Math.PI * 2;
    const d = 0.15 + 0.22 * rng.next();
    balls.push({ x: w / 2 + Math.cos(a) * d * w, y: h / 2 + Math.sin(a) * d * h, r: Math.min(w, h) * (0.07 + 0.13 * rng.next()) });
  }
  const full = metaballs(w, h, balls, rng.int(0, 0x7fffffff), BIG.rough, 4 / Math.min(w, h));
  largestBody(full);
  fillHoles(full);
  const box = bounds(full) ?? { x: 0, y: 0, w: 1, h: 1 };
  const mask = crop(full, box);
  const plan = emptyPlan('big', seed, coverage, mask.w, mask.h);
  const field = massField(rng, mask);
  const [lo, hi] = BIG.mass[coverage];
  const share = lo + (hi - lo) * rng.next();
  const body: number[] = [];
  for (let i = 0; i < mask.m.length; i++) if (mask.m[i]) body.push(i);
  // the top `share` of the field is rock mass (ties by index, so the split is exact and deterministic)
  const ranked = [...body].sort((a, b) => (field[b] as number) - (field[a] as number) || a - b);
  const massCount = Math.round(share * body.length);
  for (const i of body) plan.struct[i] = Struct.Ground;
  for (let k = 0; k < massCount; k++) plan.struct[ranked[k] as number] = Struct.Rock;
  plan.mass = body.length ? massCount / body.length : 0;
  plan.parts = [{ x: 0, y: 0, w: mask.w, h: mask.h }];
  carveVeins(plan, rng, ores);
  return plan;
}

/** Rocks of a field: small blobs placed by rejection sampling with `FIELD.gap` between their bboxes. */
function generateField(seed: number, ores: readonly OreDef[]): AsteroidPlan {
  const rng = new Rng(seed ^ 0x0f1e1d00);
  const fw = rng.int(FIELD.width[0], FIELD.width[1]);
  const fh = rng.int(FIELD.height[0], FIELD.height[1]);
  const want = rng.int(FIELD.rocks[0], FIELD.rocks[1]);
  const clusters = Array.from({ length: rng.int(FIELD.clusters[0], FIELD.clusters[1]) }, () => ({ x: fw * (0.2 + 0.6 * rng.next()), y: fh * (0.2 + 0.6 * rng.next()) }));
  const placed: { r: Rect; m: Mask }[] = [];
  for (let t = 0; t < FIELD.placeTries && placed.length < want; t++) {
    // sizes lean small: a few big boulders among many smaller rocks
    const size = FIELD.minRock + Math.floor((FIELD.maxRock - FIELD.minRock + 1) * rng.next() ** 1.6);
    const raw = blob(rng, size + 2, size + 2, rng.int(1, 3), 0.5);
    const box = bounds(raw);
    const tiles = raw.m.reduce((n, v) => n + v, 0);
    if (!box || box.w < FIELD.minRock || box.h < FIELD.minRock || tiles < Math.max(7, box.w * box.h * 0.5)) continue;
    const m = crop(raw, box);
    // around a clump: the mean of two uniforms leans to the middle, so rocks thin out towards the field's edge
    const c = rng.pick(clusters);
    const sx = ((rng.next() + rng.next()) - 1) * fw * 0.5, sy = ((rng.next() + rng.next()) - 1) * fh * 0.5;
    const px = Math.round(c.x + sx - m.w / 2), py = Math.round(c.y + sy - m.h / 2);
    if (px < 0 || py < 0 || px + m.w > fw || py + m.h > fh) continue;
    const r = { x: px, y: py, w: m.w, h: m.h };
    const clash = placed.some((p) => r.x < p.r.x + p.r.w + FIELD.gap && p.r.x < r.x + r.w + FIELD.gap
      && r.y < p.r.y + p.r.h + FIELD.gap && p.r.y < r.y + r.h + FIELD.gap);
    if (!clash) placed.push({ r, m });
  }
  if (placed.length === 0) return emptyPlan('field', seed, 'dense', 1, 1);
  // crop the field to its rocks
  const x0 = Math.min(...placed.map((p) => p.r.x)), y0 = Math.min(...placed.map((p) => p.r.y));
  for (const p of placed) { p.r.x -= x0; p.r.y -= y0; }
  const w = Math.max(1, ...placed.map((p) => p.r.x + p.r.w));
  const h = Math.max(1, ...placed.map((p) => p.r.y + p.r.h));
  const plan = emptyPlan('field', seed, 'dense', w, h);
  for (const p of placed) {
    for (let y = 0; y < p.m.h; y++) {
      for (let x = 0; x < p.m.w; x++) if (p.m.m[y * p.m.w + x]) plan.struct[(p.r.y + y) * w + p.r.x + x] = Struct.Rock;
    }
    plan.parts.push(p.r);
    if (!rng.chance(FIELD.pocketChance)) continue;
    const pockets = rng.int(FIELD.pockets[0], FIELD.pockets[1]);
    for (let k = 0; k < pockets; k++) {
      const ore = pickOre(rng, ores, 'field');
      if (!ore) break;
      const cells: number[] = [];
      for (let y = 0; y < p.m.h; y++) for (let x = 0; x < p.m.w; x++) if (p.m.m[y * p.m.w + x]) cells.push((p.r.y + y) * w + p.r.x + x);
      const c = rng.pick(cells);
      const cx = c % w, cy = (c - cx) / w;
      const rad = rng.int(1, Math.max(1, Math.min(3, Math.floor(Math.min(p.r.w, p.r.h) / 3))));
      for (const i of cells) {
        const x = i % w, y = (i - x) / w;
        if (Math.abs(x - cx) + Math.abs(y - cy) <= rad) setOre(plan, i, ore, rng);
      }
    }
  }
  return plan;
}

/**
 * Generate an asteroid of `kind` from `seed`. `ores` is the content ore list (any order: it is sorted by code, so the
 * result does not depend on object key order). Same inputs, same plan.
 */
export function generateAsteroid(kind: AsteroidKind, seed: number, ores: readonly OreDef[], opts: AsteroidGenOptions = {}): AsteroidPlan {
  const sorted = [...ores].sort((a, b) => a.code - b.code);
  const plan = kind === 'big' ? generateBig(seed >>> 0, sorted, opts) : generateField(seed >>> 0, sorted);
  if (kind === 'field') plan.mass = 1; // field rocks are solid boulders: rock mass only
  return plan;
}
