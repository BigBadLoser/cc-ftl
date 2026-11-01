import type { Rng } from '../../rng';
import type { RoomSpec } from '../plan';
import { DIRS8, K, rectSpots, rectTiles, type Grid, type TileRect } from './grid';
import { cutRegion } from './parcels';
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

/** The arc length of a run of tiles: the number of distinct front tiles, at least one. */
export const frontLength = (g: Grid, tiles: readonly number[], front: (i: number) => boolean): number => Math.max(1, tiles.filter(front).length);

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
