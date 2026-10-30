/**
 * The exterior hull's outline from a ship's tile mask, and each tile's hull key: a port of
 * tools/blender/sprites/hull_outline.py (keep the two in step; hullKey.test.ts checks them against its output).
 *
 * The outline runs just inside the mask's edges on space; a staircase of two or more outer corners runs as one 45
 * degree diagonal. Each side of it is a front (s, c): s . p <= c, c in 32nds of a tile. A tile's key is the stretches of
 * fronts whose hull reaches it, relative to the tile ("sx,sy,c;..." per stretch, "|" between), or "" (none). The art
 * names its pieces by `hullKeyName(key)`.
 */

type V = [number, number];
/** A front: the ship lies on s . p <= c / 32. */
export type Front = [V, number];

const E = 0.5 - 1 / 32;
const LIP = E + 0.5;
const REACH = 3.0;
const EPS = 1e-7;
/** The sides facing the camera: their runs and corners are the run set's. */
const NEAR = (s: V) => (s[0] === 1 && s[1] === 0) || (s[0] === 0 && s[1] === 1);

const cross = (a: V, b: V) => a[0] * b[1] - a[1] * b[0];
const back = () => LIP;
const at = <T>(a: T[], i: number): T => a[((i % a.length) + a.length) % a.length]!;

/** The mask's edges on space as closed loops, the ship on their left: [tile, outward normal]. */
function cycles(mask: Set<string>, tiles: V[]): [V, V][][] {
  const has = (x: number, y: number) => mask.has(`${x},${y}`);
  const out = new Map<string, [V, V, V][]>();
  for (const [x, y] of tiles)
    for (const n of [[1, 0], [0, 1], [-1, 0], [0, -1]] as V[]) {
      if (has(x + n[0], y + n[1])) continue;
      const a: V = [2 * x + n[0] + n[1], 2 * y + n[1] - n[0]];
      const k = `${a[0]},${a[1]}`;
      if (!out.has(k)) out.set(k, []);
      out.get(k)!.push([[x, y], n, [a[0] - 2 * n[1], a[1] + 2 * n[0]]]);
    }
  const seen = new Set<string>();
  const loops: [V, V][][] = [];
  for (const es of out.values())
    for (let e of es) {
      const loop: [V, V][] = [];
      while (!seen.has(`${e[0]},${e[1]}`)) {
        seen.add(`${e[0]},${e[1]}`);
        loop.push([e[0], e[1]]);
        const nxt = out.get(`${e[2][0]},${e[2][1]}`)!;
        e = nxt.find((m) => cross(e[1], m[1]) > 0) ?? nxt[0]!;
      }
      if (loop.length) loops.push(loop);
    }
  return loops;
}

/** A loop's fronts in order: its straight runs, and each staircase of two or more outer corners as a diagonal. */
function fronts(loop0: [V, V][]): Front[] {
  const m = loop0.length;
  const turn0 = loop0.map((e, i) => cross(e[1], at(loop0, i + 1)[1]));
  let i0 = turn0.findIndex((_, i) => at(turn0, i - 1) === 0);
  if (i0 < 0) i0 = 0;
  const loop = [...loop0.slice(i0), ...loop0.slice(0, i0)];
  const turn = [...turn0.slice(i0), ...turn0.slice(0, i0)];
  const out: Front[] = [];
  let i = 0;
  while (i < m) {
    let j = i;
    while (j < m - 1 && turn[j]! * ((j - i) % 2 === 0 ? 1 : -1) > 0) j++;
    if ((j - i) % 2 === 0) j--;
    const [[x, y], a] = loop[i]!;
    let f: Front;
    if (j - i >= 3) {
      const b = loop[i + 1]![1];
      const s: V = [a[0] + b[0], a[1] + b[1]];
      f = [s, Math.round(32 * (s[0] * x + s[1] * y) + 32 * E - 16)];
      i = j + 1;
    } else {
      f = [a, Math.round(32 * (a[0] * x + a[1] * y) + 32 * E)];
      i++;
    }
    const l = out[out.length - 1];
    if (!l || !same(l, f)) out.push(f);
  }
  if (out.length > 1 && same(out[0]!, out[out.length - 1]!)) out.pop();
  return out;
}

const same = (f: Front, h: Front) => f[0][0] === h[0][0] && f[0][1] === h[0][1] && f[1] === h[1];

/** The mask's outline: a list of loops, each its fronts in order (c in 32nds, world). */
export function hullOutline(tiles: V[]): Front[][] {
  const mask = new Set(tiles.map(([x, y]) => `${x},${y}`));
  // Sorted by x then y, as hull_outline.py: where the loops start shapes their fronts.
  const sorted = [...tiles].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return cycles(mask, sorted).map(fronts);
}

function meet(f: Front, h: Front): V | null {
  const [s, c0] = f;
  const [t, e0] = h;
  const det = cross(s, t);
  if (det === 0) return null;
  const c = c0 / 32;
  const e = e0 / 32;
  return [(c * t[1] - e * s[1]) / det, (s[0] * e - t[0] * c) / det];
}

function near(p: V, a: V | null, b: V | null): number {
  if (a === null || b === null) return 0;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const u = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / Math.max(EPS, dx * dx + dy * dy)));
  return Math.hypot(p[0] - a[0] - u * dx, p[1] - a[1] - u * dy);
}

type Group = [Front[], Front | null, Front | null];

/** A stretch split at its concave corners: [convex run, front before it, front after it]. */
export function hullGroups(fr: Front[]): Group[] {
  const out: Front[][] = [];
  let cur: Front[] = [fr[0]!];
  for (let i = 1; i < fr.length; i++) {
    if (cross(fr[i - 1]![0], fr[i]![0]) < 0) {
      out.push(cur);
      cur = [];
    }
    cur.push(fr[i]!);
  }
  out.push(cur);
  return out.map((g, i) => [g, i ? out[i - 1]!.at(-1)! : null, i + 1 < out.length ? out[i + 1]![0]! : null]);
}

type Half = [number, number, number];

function clip(poly0: V[], hs: Half[]): V[] {
  let poly = poly0;
  for (const [a, b, c] of hs) {
    const out: V[] = [];
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i]!;
      const q = poly[(i + 1) % poly.length]!;
      const u = a * p[0] + b * p[1] - c;
      const v = a * q[0] + b * q[1] - c;
      if (u <= EPS) out.push(p);
      if ((u < -EPS && -EPS < v) || (v < -EPS && -EPS < u)) {
        const k = u / (u - v);
        out.push([p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k]);
      }
    }
    poly = out;
    if (poly.length < 3) return [];
  }
  return poly;
}

function across(poly: V[], h: Half): boolean {
  const v = poly.map(([x, y]) => h[0] * x + h[1] * y - h[2]);
  return v.length > 0 && Math.min(...v) < -1e-6 && Math.max(...v) > 1e-6;
}

const area = (poly: V[]) => Math.abs(poly.reduce((s, p, i) => s + cross(p, poly[(i + 1) % poly.length]!), 0)) / 2;

/** Half-plane d(f) >= k. */
const atLeast = (f: Front, k = 0): Half => [f[0][0], f[0][1], f[1] / 32 - k];

/** Half-plane d(f) - kf <= d(h) - kh. */
const nearer = (f: Front, h: Front, kf = 0, kh = 0): Half => [
  h[0][0] - f[0][0],
  h[0][1] - f[0][1],
  h[1] / 32 - f[1] / 32 + kf - kh,
];

/** Which fronts of a stretch (tile-local, by place) shape the tile. */
function uses(fr: Front[]): Set<number> {
  const sq: V[] = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
  const used = new Set<number>();
  let i0 = 0;
  for (const [g, before, after] of hullGroups(fr)) {
    const i1 = i0 + g.length;
    const side: Half[] = [];
    for (const [o, f] of [[before, g[0]], [after, g.at(-1)]] as [Front | null, Front][]) if (o) side.push(nearer(o, f));
    const base = clip(sq, g.map((f) => atLeast(f)));
    const hull = clip(base, side);
    const had = used.size;
    g.forEach((f, gi) => {
      const i = i0 + gi;
      const [a, b, c] = atLeast(f, back());
      const others = g.filter((_, gj) => gj !== gi);
      if (area(clip(hull, [...others.map((h) => nearer(f, h)), [-a, -b, -c]])) > EPS) used.add(i);
      const span = clip(hull, others.map((h) => nearer(f, h, back(), back())));
      if (across(span, atLeast(f, back()))) used.add(i);
    });
    for (const [o, f, j] of [[before, g[0], i0 - 1], [after, g.at(-1), i1]] as [Front | null, Front, number][])
      if (o && used.size > had && across(base, nearer(o, f))) used.add(j);
    i0 = i1;
  }
  return used;
}

/** The tile's hull key ("" for none: plain roof): its stretches in sorted order. */
export function hullKey(loops: Front[][], x: number, y: number): string {
  const parts: Front[][] = [];
  for (const fr of loops) {
    const n = fr.length;
    const pts = n > 1 ? fr.map((f, i) => meet(at(fr, i - 1), f)) : [null];
    const nearI: number[] = [];
    for (let i = 0; i < n; i++) if (near([x, y], pts[i]!, n > 1 ? pts[(i + 1) % n]! : null) <= REACH) nearI.push(i);
    if (!nearI.length) continue;
    const runs: number[][] = [];
    let cur = [nearI[0]!];
    for (const i of nearI.slice(1)) {
      if (i === cur.at(-1)! + 1) cur.push(i);
      else {
        runs.push(cur);
        cur = [i];
      }
    }
    runs.push(cur);
    if (runs.length > 1 && runs[0]![0] === 0 && runs.at(-1)!.at(-1) === n - 1) runs[0] = [...runs.pop()!, ...runs[0]!];
    for (const run of runs) {
      const loc: Front[] = run.map((i) => {
        const [s, c] = fr[i]!;
        return [s, c - 32 * (s[0] * x + s[1] * y)];
      });
      const u = uses(loc);
      if (u.size) parts.push(loc.slice(Math.min(...u), Math.max(...u) + 1));
    }
  }
  // Sorted: the loops' order and where each starts follow the mask's order.
  return parts.map((p) => p.map(([s, c]) => `${s[0]},${s[1]},${c}`).join(";")).sort().join("|");
}

/** A key's stretches. */
export function parseHullKey(k: string): Front[][] {
  return k
    .split("|")
    .filter(Boolean)
    .map((p) => p.split(";").map((f) => {
      const [a, b, c] = f.split(",").map(Number);
      return [[a, b], c] as Front;
    }));
}

/** Whether a key is the generic set's (a diagonal, a far side) rather than the run set's (near runs and corners). */
export const hullKeyGeneric = (k: string) => parseHullKey(k).some((p) => p.some(([s]) => !NEAR(s)));

/** A key's sprite id part. */
export const hullKeyName = (k: string) => k.replace(/,/g, "_").replace(/;/g, "~").replace(/\|/g, "+").replace(/-/g, "m");
