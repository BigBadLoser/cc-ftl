import type { Rng } from '../../rng';
import type { RoomSpec } from '../plan';
import { DIRS8, K, rectSpots, rectTiles, type Grid, type TileRect } from './grid';
import { cutRegion, startAngle } from './parcels';
import type { DeptId } from './program';
import type { Structure } from './structure';

/**
 * Shared pieces of the department strategies: the room list they fill, a parcel's depth from its public front, angular
 * slicing into units, and rectangle packing. Rooms own tiles; walls come later from precedence (walls.ts), except the
 * walls round a rectangular room, which its strategy marks solid so the room keeps its exact interior.
 */

/** A door to a room, to public floor (a hall or court), or to whichever of several rooms it borders. */
export type Door = number | 'public' | { any: number[] };

export interface Room2 {
  tiles: number[];
  spec: RoomSpec;
  dept: DeptId | 'public';
  /** Where walls fall: a room's tiles next to a room of higher precedence become wall. */
  prec: number;
  /** Rooms it has a door to ('public': the halls or a court). */
  doors: Door[];
  /** Tiles a door should be near (the middle of its front), when it matters. */
  doorNear?: number;
  /** A leftover room (stores, plant): dropped (made wall) when walls leave it too little floor. */
  optional?: boolean;
}

export const PREC = { hall: 1e6, court: 9e5, rect: 5e5, inner: 4e5, soft: 1e3 } as const;

export interface Ctx2 {
  rng: Rng;
  s: Structure;
  g: Grid;
  rooms: Room2[];
  /** The public hall room (index 0) and every court room. */
  publics: number[];
  /** Each department's internal hall, for neighbours that open onto it (freight onto the harbour hall). */
  halls: Map<DeptId, number>;
  /** Parcel of each tile (dept id), for strategies that look at their neighbours. */
  owner: Map<number, DeptId>;
  /** The walls and floors build drew last (kept for the debug view when it fails). */
  drawn?: { wall: Uint8Array; floor: Int32Array };
}

export function addRoom(c: Ctx2, r: Room2): number {
  c.rooms.push(r);
  const id = c.rooms.length - 1;
  for (const i of r.tiles) c.g.set(i, K.Room, id);
  return id;
}

/** Mark tiles solid (walls a strategy draws). */
export const solid = (c: Ctx2, tiles: Iterable<number>): void => { for (const i of tiles) c.g.set(i, K.Solid); };

/** Is a tile public (hall or court)? */
export const isPublic = (g: Grid, i: number): boolean => (g.pub[i] as number) > 0;

/** Chebyshev (8-step) distance of each tile, matching where walls fall (beside anything of higher precedence) from the tiles that pass `front` (those count 1). Unreached tiles are absent. */
export function depthFrom(g: Grid, tiles: readonly number[], front: (i: number) => boolean): Map<number, number> {
  const mine = new Set(tiles);
  const d = new Map<number, number>();
  let q = tiles.filter(front);
  for (const i of q) d.set(i, 1);
  let k = 1;
  while (q.length > 0) {
    const next: number[] = [];
    for (const i of q) for (const j of g.nb(i, DIRS8)) if (mine.has(j) && !d.has(j)) { d.set(j, k + 1); next.push(j); }
    k++;
    q = next;
  }
  return d;
}

/** Tiles touching public floor, diagonally too (they become its wall). */
export const nearPublic = (g: Grid, i: number): boolean => g.nb(i, DIRS8).some((j) => isPublic(g, j));

/** Cut tiles in angle order into runs by weight (radial walls), keyed by index. */
export function slice(g: Grid, tiles: readonly number[], weights: readonly number[], fallback = 0): number[][] {
  const m = cutRegion(g, tiles, weights.map((w, k) => ({ key: String(k), weight: w })), fallback);
  return weights.map((_, k) => m.get(String(k)) ?? []);
}

/**
 * Cut a row into units along its front: the front tiles in angle order are shared out by weight, and every other tile
 * goes with its nearest front tile (walking inside the row). Unit walls then stand square to the front, round a
 * corner of the ring as well as along it; a row with no front is cut by angle.
 */
export function sliceAlong(g: Grid, tiles: readonly number[], weights: readonly number[], front: (i: number) => boolean): number[][] {
  const fs = tiles.filter(front);
  if (fs.length < weights.length) return slice(g, tiles, weights);
  const { start } = startAngle(g, fs, 0);
  const TAU = 2 * Math.PI;
  const at = (i: number): number => ((((g.a(i) - start) % TAU) + TAU) % TAU);
  fs.sort((p, q) => at(p) - at(q));
  const total = weights.reduce((t, w) => t + w, 0) || 1;
  // Every tile goes with its nearest front tile.
  const mine = new Set(tiles);
  const near = new Map<number, number>(fs.map((i, j) => [i, j]));
  let q = [...fs];
  while (q.length > 0) {
    const next: number[] = [];
    for (const i of q) for (const j of g.nb(i)) if (mine.has(j) && !near.has(j)) { near.set(j, near.get(i) as number); next.push(j); }
    q = next;
  }
  // The front is cut by length (a unit's front is its width; where the row is deeper its rooms are deeper, never
  // narrower), each front tile at its true distance along it: two-step chords read a staircase as its diagonal.
  const pos: number[] = [0];
  for (let j = 1; j < fs.length; j++) {
    const q2 = fs[j] as number, b = fs[Math.max(0, j - 2)] as number;
    pos.push((j >= 2 ? (pos[j - 2] as number) : 0) + Math.min(j >= 2 ? 3 : 1.5, Math.hypot(g.x(q2) - g.x(b), g.y(q2) - g.y(b))));
  }
  const len = (pos[pos.length - 1] as number) || 1;
  const part = new Map<number, number>();
  let acc = 0, k = 0;
  fs.forEach((i, j) => {
    while (k < weights.length - 1 && (pos[j] as number) >= ((acc + (weights[k] as number)) / total) * len) { acc += weights[k] as number; k++; }
    part.set(i, k);
  });
  for (const i of tiles) { const j = near.get(i); if (j !== undefined) part.set(i, part.get(fs[j] as number) as number); }
  // Straighten the cuts: each is an axis line through the gap between two units' fronts, square to the front there
  // (a cut by nearest front tile on a diagonal would be a staircase strip). A tile moves to the next unit when it
  // lies past the line.
  const lines: ({ vert: boolean; at: number; sign: number } | null)[] = [];
  for (let j = 0; j + 1 < weights.length; j++) {
    const last = fs.filter((i) => part.get(i) === j).pop(), first = fs.find((i) => part.get(i) === j + 1);
    if (last === undefined || first === undefined) { lines.push(null); continue; }
    // The front's direction over a few tiles either side of the gap.
    const a = fs[Math.max(0, fs.indexOf(last) - 2)] as number, b = fs[Math.min(fs.length - 1, fs.indexOf(first) + 2)] as number;
    const dx = g.x(b) - g.x(a), dy = g.y(b) - g.y(a);
    const vert = Math.abs(dx) >= Math.abs(dy);
    lines.push({ vert, at: vert ? (g.x(last) + g.x(first)) / 2 : (g.y(last) + g.y(first)) / 2, sign: Math.sign(vert ? dx : dy) || 1 });
  }
  // A straightened cut that leaves a unit under two thirds of its share is dropped (that cut stays as cut).
  for (let pass = 0; ; pass++) {
    const out = weights.map(() => [] as number[]);
    for (const i of tiles) {
      let k2 = part.get(i) ?? 0;
      const past = (l: { vert: boolean; at: number; sign: number }): boolean => ((l.vert ? g.x(i) : g.y(i)) - l.at) * l.sign > 0;
      const lo = lines[k2 - 1], hi = lines[k2];
      if (lo && !past(lo)) k2--;
      else if (hi && past(hi)) k2++;
      out[k2]?.push(i);
    }
    const small = out.findIndex((u, j) => u.length < ((weights[j] as number) / total) * tiles.length * 0.67 && (lines[j - 1] || lines[j]));
    if (small < 0 || pass > weights.length) return out;
    lines[small - 1] = null;
    lines[small] = null;
  }
}

/**
 * The length of a run's front along the ring: its angular span times its mean radius (a count of front tiles would
 * read a staircase on a diagonal as up to twice as long as it is), at least one.
 */
export function frontLength(g: Grid, tiles: readonly number[], front: (i: number) => boolean): number {
  const fs = tiles.filter(front);
  if (fs.length < 2) return 1;
  const TAU = 2 * Math.PI;
  let len = 0;
  // Per piece of front: along a ring, its tiles in angle order measured by two-step chords (a staircase reads as its
  // diagonal); along a spoke (no angle to speak of), its straight extent.
  for (const comp of g.components(fs, DIRS8)) {
    const as = comp.map((i) => ((g.a(i) % TAU) + TAU) % TAU);
    const { start } = startAngle(g, comp, 0);
    const at = (i: number): number => ((((g.a(i) - start) % TAU) + TAU) % TAU);
    const xs = comp.map((i) => g.x(i)), ys = comp.map((i) => g.y(i));
    const ext = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    const r = comp.reduce((t, i) => t + g.r(i), 0) / comp.length;
    const span = Math.max(...comp.map(at));
    if (span * r < ext * 0.5 || as.length < 3) { len += ext + 1; continue; }
    const o = [...comp].sort((p, q) => at(p) - at(q));
    let l = 0;
    for (let j = 2; j < o.length; j += 2) l += Math.hypot(g.x(o[j] as number) - g.x(o[j - 2] as number), g.y(o[j] as number) - g.y(o[j - 2] as number));
    if (o.length % 2 === 0) l += Math.hypot(g.x(o[o.length - 1] as number) - g.x(o[o.length - 2] as number), g.y(o[o.length - 1] as number) - g.y(o[o.length - 2] as number)) * 0.7;
    len += l + 1;
  }
  return Math.max(1, len);
}

/**
 * Place a rectangle of interior w x h (either way round) whose walls lie in `free`, scored by `rank` (higher better);
 * null if none fits.
 */
export function placeRect(g: Grid, free: ReadonlySet<number>, w: number, h: number, rank: (r: TileRect) => number): TileRect | null {
  let best: TileRect | null = null, top = -Infinity;
  for (const [a, b] of w === h ? [[w, h]] : [[w, h], [h, w]]) {
    for (const r of rectSpots(g, free, (a as number) + 2, (b as number) + 2)) {
      const v = rank(r);
      if (v > top) { top = v; best = r; }
    }
  }
  return best;
}

/** A placed rectangle's interior and its wall ring. */
export function rectParts(g: Grid, r: TileRect): { inner: number[]; ring: number[] } {
  const inner = rectTiles(g, { x: r.x + 1, y: r.y + 1, w: r.w - 2, h: r.h - 2 });
  const set = new Set(inner);
  return { inner, ring: rectTiles(g, r).filter((i) => !set.has(i)) };
}

/** Tiles of `set` 4-adjacent to some tile of `other`. */
export const touching = (g: Grid, set: readonly number[], other: ReadonlySet<number>): number[] => set.filter((i) => g.nb(i).some((j) => other.has(j)));

/**
 * A parcel's public faces: tiles touching public floor further in (its inner face) or further out (its outer face).
 * Public floor at the same radius (a spoke along the parcel's end) counts for neither.
 */
export function faces(g: Grid, tiles: readonly number[]): { inner: number[]; outer: number[] } {
  const inner: number[] = [], outer: number[] = [];
  for (const i of tiles) {
    let lo = false, hi = false;
    // Four-neighbours only: a spoke's side (a diagonal neighbour on it differs in radius) is no ring face.
    for (const j of g.nb(i)) {
      if (!isPublic(g, j)) continue;
      const d = g.r(j) - g.r(i);
      if (d < -0.4) lo = true; else if (d > 0.4) hi = true;
    }
    if (lo) inner.push(i);
    if (hi) outer.push(i);
  }
  return { inner, outer };
}

/** Thickness of a tile set: twice the greatest 4-step distance from a tile to the set's edge, less one. */
export function thickness(g: Grid, tiles: readonly number[]): number {
  const mine = new Set(tiles);
  const seen = new Set<number>();
  let q: number[] = [];
  for (const i of tiles) if (g.nb(i).some((j) => !mine.has(j))) { seen.add(i); q.push(i); }
  let d = 1;
  for (;;) {
    const next: number[] = [];
    for (const i of q) for (const j of g.nb(i)) if (mine.has(j) && !seen.has(j)) { seen.add(j); next.push(j); }
    if (next.length === 0) break;
    d++;
    q = next;
  }
  return 2 * d - 1;
}

/** A room shape worth keeping: three floor wide after its walls (thickness five) and filling 60% of its bounding box. */
export function goodShape(g: Grid, tiles: readonly number[]): boolean {
  if (tiles.length < 12 || thickness(g, tiles) < 5) return false;
  const xs = tiles.map((i) => g.x(i)), ys = tiles.map((i) => g.y(i));
  const box = (Math.max(...xs) - Math.min(...xs) + 1) * (Math.max(...ys) - Math.min(...ys) + 1);
  return tiles.length / box >= 0.6;
}
