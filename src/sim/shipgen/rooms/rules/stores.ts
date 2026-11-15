/**
 * Store rooms (furnishing mock round 2, tools/shipgen/mocks/furnishingRooms.ts): the pantry, the quartermaster's
 * armoury and the brig. Room frame of parts.ts: (0, 0) the top-left floor tile, the door under the bottom wall at column d.
 * Chairs face their table (r0 -y, r1 +x, r2 +y, r3 -x).
 */
import type { Piece } from './check';
import { AR, C, CD, L, P, RK, SW, T, count, range } from './parts';
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
