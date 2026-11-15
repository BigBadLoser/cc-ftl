/**
 * Store rooms (furnishing mock round 2, tools/shipgen/mocks/furnishingRooms.ts): the pantry, the quartermaster's
 * armoury and the brig. Room frame of parts.ts: (0, 0) the top-left floor tile, the door under the bottom wall at column d.
 * Chairs face their table (r0 -y, r1 +x, r2 +y, r3 -x).
 */
import type { Piece } from './check';
import { AR, C, CD, L, OB, P, RK, SW, T, count, range } from './parts';
import type { Ctx } from './rules';

/** Left x of each shelf along a back wall: pairs of two-wide units, a tile between pairs (0, 2, 5, 7, 10 ...). */
export const shelfSlots = (w: number): number[] => {
  const out: number[] = [];
  for (let x = 0, i = 0; x + 2 <= w; i++) { out.push(x); x += 2 + (i % 2); }
  return out;
};

/** PA: cold stores (planned racks first) along the back wall in pairs, a rack in the bottom corner away from the door. */
export function pa(c: Ctx): Piece[] {
  const { w, h, d } = c, racks = count(c.need, RK);
  const shelves = shelfSlots(w).map((x, i) => P(i < racks ? RK : CD, x, 0, 0));
  const left = d >= 2, right = d <= w - 3;
  const corner = left && (d >= w >> 1 || !right) ? 0 : right ? w - 2 : -1;
  return [...shelves, ...(corner >= 0 && h >= 3 ? [P(RK, corner, h - 1, 2)] : [])];
}

/** QM: armoury lockers along the back wall either side of the door's column, a desk and chair in front of them, a locker in each bottom corner. */
export function qm(c: Ctx): Piece[] {
  const { w, h, d } = c, tx = Math.max(0, Math.min(w - 2, d - 1)), ty = Math.min(2, h - 3);
  const top = [...range(0, d - 2, 2), ...range(w - 2, d + 1, -2)].map((x) => P(AR, x, 0, 0));
  const corners = [d >= 2 ? P(AR, 0, h - 1, 2) : null, d <= w - 3 ? P(AR, w - 2, h - 1, 2) : null].filter((p): p is Piece => p !== null);
  return [...top, P(T, tx, ty, 0), P(C, tx, ty - 1, 2), ...corners];
}

/** BG: the stasis wheel centred on the back wall, a locker beside it, a guard's desk and chair in front, by the near corner. */
export function bg(c: Ctx): Piece[] {
  const { w, h } = c;
  return [P(SW, Math.floor((w - 3) / 2), 0, 0), P(L, 0, 0, 3), P(C, 0, h - 2, 1), P(T, 1, h - 2, 0)];
}

/** Frame rotation that faces +v / -v across the ore store (rows: v is y; columns: v is x). */
const FACING = { rows: { v: 0, nv: 2 }, cols: { v: 3, nv: 1 } } as const;

/**
 * OS: the ore store beside the pod deck (the room is planned two bins per pod, a row of them down each long wall and an
 * aisle between): bins in a row on each long wall facing the aisle, centred along it, a gap at a door's floor tile (when
 * that costs the row a bin, the row stands a tile off the wall, a lane behind it). Nothing else; a bigger room only gets
 * a wider aisle. Door on a long wall: the rows run along x; door on a short wall: down y.
 */
export function ore(c: Ctx): Piece[] {
  const { w, h } = c, total = count(c.need, OB), rows = w >= h, f = rows ? FACING.rows : FACING.cols;
  const U = rows ? w : h, V = rows ? h : w;
  const at = (u: number, v: number, rot: number): Piece => P(OB, rows ? u : v, rows ? v : u, rot);
  const blocked = new Set([`${c.d},${h - 1}`, ...(c.doors ?? []).map((e) => `${e.x},${e.y}`)]);
  const free = (u: number, v: number): boolean => ![0, 1].some((a) => [0, 1].some((b) => blocked.has(rows ? `${u + a},${v + b}` : `${v + b},${u + a}`)));
  const half = Math.ceil(total / 2), o = Math.max(0, Math.floor((U - 2 * half) / 2));
  const wall = (v: number, rot: number): Piece[] => {
    const out: Piece[] = [];
    for (let u = o; u + 2 <= U; u += free(u, v) ? 2 : 1) if (free(u, v)) out.push(at(u, v, rot));
    return out;
  };
  const back = wall(0, f.v), nb = Math.min(back.length, half);
  // The door's floor tile cuts the front row short: then the whole row stands a tile off the wall, a lane behind it.
  const flush = wall(V - 2, f.nv), front = flush.length >= total - nb || V < 6 ? flush : wall(V - 3, f.nv);
  const out = [...back.slice(0, nb), ...front.slice(0, total - nb)];
  return out.length === total ? out : [];
}
