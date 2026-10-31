import type { Rng } from '../rng';
import type { RoomSpec } from './plan';
import { roomGraph, scoreRoles } from './stationQuality';
import type { RoomRole } from './types';

/**
 * Room assignment after the structure (Merrell et al. 2010, Lopes et al. 2010: the plan's shape is fixed, then rooms go
 * where their neighbours suit them): once a layout's rooms are drawn, rooms that can stand in for each other trade roles
 * (and plans) wherever that raises the layout's adjacency and district score (stationQuality.ts). Works on any grammar,
 * since it only reads the drawn rooms.
 *
 * Interchangeable: soft rooms (SOFT) with soft rooms, and the inboard system rooms (CORE) with each other, of floor areas
 * within AREA of each other and each big enough for the other's plan. Everything with a fixed place stays: corridors,
 * docks, gun bays (hull face), the bridge, engines, hangars, refineries and farms (their floor is cut to fit), courts,
 * sealed rooms. Furnishing comes after, so a room is fitted out for the role it ends up with.
 */

const SOFT: readonly RoomRole[] = ['quarters', 'cargo', 'support', 'armoury'];
const CORE: readonly RoomRole[] = ['reactor', 'shields', 'core'];
/** Largest floor ratio between two rooms that trade roles. */
const AREA = 1.35;
/** How much the district clustering weighs against the adjacency share. */
const CLUSTER = 0.15;

export interface RoleSwap { roles: RoomRole[]; specs: (RoomSpec | undefined)[]; swaps: number; before: number; after: number }

export function swapRoles(rng: Rng, rows: readonly string[], roomOf: Int16Array, rolesIn: readonly RoomRole[], specsIn: readonly (RoomSpec | undefined)[]): RoleSwap {
  const roles = [...rolesIn];
  const specs = [...specsIn];
  const g = roomGraph(rows, roomOf);
  const W = Math.max(...rows.map((r) => r.length));
  const floor = new Map<number, number>();
  for (let i = 0; i < roomOf.length; i++) {
    const r = roomOf[i] ?? -1;
    if (r >= 0 && rows[Math.floor(i / W)]?.[i % W] === '_') floor.set(r, (floor.get(r) ?? 0) + 1);
  }
  const classOf = (r: number): number => {
    if (specs[r]?.sealed || specs[r]?.pinned) return -1;
    const role = roles[r] as RoomRole;
    return SOFT.includes(role) ? 0 : CORE.includes(role) ? 1 : -1;
  };
  const need = (r: number): number => { const s = specs[r]; return s ? s.w * s.h * 0.8 : 0; };
  const fits = (a: number, b: number): boolean => {
    const fa = floor.get(a) ?? 0, fb = floor.get(b) ?? 0;
    return Math.max(fa, fb) <= AREA * Math.min(fa, fb) && fa >= need(b) && fb >= need(a);
  };
  const pool = g.rooms.filter((r) => classOf(r) >= 0);
  const value = (): number => { const q = scoreRoles(g, roles); return q.adjacency + CLUSTER * Math.min(q.clustering, 3); };
  const before = value();
  let best = before, swaps = 0;
  if (pool.length >= 2) {
    for (let t = 0; t < 30 * pool.length; t++) {
      const a = pool[rng.int(0, pool.length - 1)] as number, b = pool[rng.int(0, pool.length - 1)] as number;
      if (a === b || classOf(a) !== classOf(b) || roles[a] === roles[b] || !fits(a, b)) continue;
      const swap = (): void => {
        [roles[a], roles[b]] = [roles[b] as RoomRole, roles[a] as RoomRole];
        [specs[a], specs[b]] = [specs[b], specs[a]];
      };
      swap();
      const v = value();
      if (v > best) { best = v; swaps++; } else swap();
    }
  }
  return { roles, specs, swaps, before, after: best };
}
