/**
 * Asteroid generator: pure and seeded (the sim's `Rng`, its own stream per seed). Separate from ship shipgen; it shares only
 * the RNG and the validation helpers. Output is an `AsteroidPlan` in local tiles, stamped by `stampAsteroid`.
 */
import type { Rect } from '../grid';
import { Rng } from '../rng';
import { Struct } from '../structure';
import { fbm } from './noise';
import { blob, bounds, crop, depth, fillHoles, largestBody, metaballs, type Ball, type Mask } from './shape';
import type { AsteroidKind, AsteroidPlan, OreDef } from './types';

/** Big asteroid parameters. Diameter is the longer side before the outline is trimmed. */
export const BIG = {
  minSize: 40,
  maxSize: 120,
  /** Shorter side as a fraction of the longer, inclusive range. */
  aspect: [0.6, 1],
  balls: [5, 9],
  /** Outline roughness (noise amplitude on the metaball field). */
  rough: 0.75,
  /** Rock tiles per ore vein. */
  tilesPerVein: 200,
  veinLength: [12, 40],
  /** Chance a vein step is two tiles wide. */
  veinWide: 0.35,
  /** Chance an unforced big asteroid is the hollowable variant. */
  hollowChance: 0.5,
  /** Core tiles are at least this many tiles from space ... */
  coreMargin: 5,
  /** ... and within this fraction of the shorter side of the deepest tile. */
  coreRadius: 0.28,
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

/** Options for `generateAsteroid`. `hollow` forces (or forbids) a big asteroid's hollowable core; default from the seed. */
export interface AsteroidGenOptions {
  hollow?: boolean;
}

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

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

function emptyPlan(kind: AsteroidKind, seed: number, hollow: boolean, w: number, h: number): AsteroidPlan {
  return { kind, seed, hollow, w, h, struct: new Uint8Array(w * h), ore: new Uint8Array(w * h), amt: new Uint8Array(w * h), parts: [], core: null };
}

function setOre(plan: AsteroidPlan, i: number, ore: OreDef, rng: Rng): void {
  if (plan.struct[i] !== Struct.Rock) return;
  plan.ore[i] = ore.code;
  plan.amt[i] = rng.int(ore.amount[0], ore.amount[1]);
}

/** Mark the hollowable core: rock at least `coreMargin` deep, connected to the deepest tile and near it. */
function markCore(plan: AsteroidPlan, mask: Mask, noiseSeed: number): void {
  const d = depth(mask);
  let deepest = 0;
  for (let i = 1; i < d.length; i++) if ((d[i] as number) > (d[deepest] as number)) deepest = i;
  if ((d[deepest] as number) < BIG.coreMargin) return;
  const r = Math.min(plan.w, plan.h) * BIG.coreRadius;
  const cx = deepest % plan.w;
  const cy = (deepest - cx) / plan.w;
  const stack = [deepest];
  const seen = new Uint8Array(d.length);
  seen[deepest] = 1;
  while (stack.length > 0) {
    const i = stack.pop() as number;
    plan.struct[i] = Struct.CoreRock;
    const x = i % plan.w;
    const y = (i - x) / plan.w;
    for (const [dx, dy] of N4) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= plan.w || ny >= plan.h) continue;
      const j = ny * plan.w + nx;
      // a lumpy chamber, not a disc: the reach varies with low-frequency noise
      const reach = r * (0.6 + 0.8 * fbm(noiseSeed, nx, ny, 3 / r, 2));
      if (seen[j] || (d[j] as number) < BIG.coreMargin || Math.hypot(nx - cx, ny - cy) > reach) continue;
      seen[j] = 1;
      stack.push(j);
    }
  }
  const core = { w: plan.w, h: plan.h, m: plan.struct.map((s) => (s === Struct.CoreRock ? 1 : 0)) };
  plan.core = bounds(core);
}

/** Ore veins: wandering 4-connected streaks through plain rock, one or two tiles wide. */
function carveVeins(plan: AsteroidPlan, rng: Rng, ores: readonly OreDef[]): void {
  const rock: number[] = [];
  for (let i = 0; i < plan.struct.length; i++) if (plan.struct[i] === Struct.Rock) rock.push(i);
  const veins = Math.max(2, Math.round(rock.length / BIG.tilesPerVein));
  for (let v = 0; v < veins && rock.length > 0; v++) {
    const ore = pickOre(rng, ores, 'big');
    if (!ore) return;
    const start = rng.pick(rock);
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
      if (nx < 0 || ny < 0 || nx >= plan.w || ny >= plan.h || plan.struct[ny * plan.w + nx] !== Struct.Rock) break;
      x = nx;
      y = ny;
    }
  }
}

function generateBig(seed: number, ores: readonly OreDef[], opts: AsteroidGenOptions): AsteroidPlan {
  const rng = new Rng(seed ^ 0x5a17e401);
  const rolled = rng.chance(BIG.hollowChance);
  const hollow = opts.hollow ?? rolled;
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
  const plan = emptyPlan('big', seed, hollow, mask.w, mask.h);
  for (let i = 0; i < mask.m.length; i++) if (mask.m[i]) plan.struct[i] = Struct.Rock;
  plan.parts = [{ x: 0, y: 0, w: mask.w, h: mask.h }];
  const coreSeed = rng.int(0, 0x7fffffff);
  if (hollow) markCore(plan, mask, coreSeed);
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
  if (placed.length === 0) return emptyPlan('field', seed, false, 1, 1);
  // crop the field to its rocks
  const x0 = Math.min(...placed.map((p) => p.r.x)), y0 = Math.min(...placed.map((p) => p.r.y));
  for (const p of placed) { p.r.x -= x0; p.r.y -= y0; }
  const w = Math.max(1, ...placed.map((p) => p.r.x + p.r.w));
  const h = Math.max(1, ...placed.map((p) => p.r.y + p.r.h));
  const plan = emptyPlan('field', seed, false, w, h);
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
  return kind === 'big' ? generateBig(seed >>> 0, sorted, opts) : generateField(seed >>> 0, sorted);
}
