/**
 * Social rooms (furnishing mock round 2, tools/shipgen/mocks/furnishingRooms.ts): the chief's office, the gym, a hall
 * street, customs and the parade hall. Room frame of parts.ts: (0, 0) the top-left floor tile, the door under the
 * bottom wall at column d. Chairs face their table (r0 -y, r1 +x, r2 +y, r3 -x).
 */
import type { Piece } from './check';
import { BE, C, EX, P, PL, RK, T, VM, VR, count, range } from './parts';
import type { Ctx } from './rules';

/** CO: a desk with its chair across it, centred; a planter in each back corner, a rack in the bottom-left corner (the desk and its chair wall off the right, so the way round stays along the bottom row). */
export function co(c: Ctx): Piece[] {
  const { w, h, d } = c, tx = Math.floor((w - 2) / 2), y = Math.floor((h - 3) / 2);
  return [P(C, tx, y, 2), P(T, tx, y + 1, 0), P(C, tx + 1, y + 2, 0), P(PL, 0, 0, 0), P(PL, w - 1, 0, 0), ...(tx >= 2 && d >= 2 ? [P(RK, 0, h - 1, 2)] : [])];
}

/** GY: sparring droids in a row a tile off the back wall, three tiles apart and centred; a bench in each bottom corner, a vending machine in the back corner. */
export function gy(c: Ctx): Piece[] {
  const { w, h, d } = c, n = count(c.need, EX), start = Math.floor((w - (3 * (n - 1) + 1)) / 2);
  const benches = [0, w - 2].filter((x) => d < x || d >= x + 2).map((x) => P(BE, x, h - 1, 2));
  return [...range(0, n - 1, 1).map((i) => P(EX, start + 3 * i, 1, 0)), ...benches, P(VM, w - 1, 0, 0)];
}

/** HL: a street's wall: planters round a bench, then a pair of vending machines, repeating every ten tiles along the back wall. */
export function hl(c: Ctx): Piece[] {
  const out: Piece[] = [];
  for (let x = 0; x + 3 < c.w; x += 10) {
    out.push(P(PL, x, 0, 0), P(BE, x + 1, 0, 0), P(PL, x + 3, 0, 0));
    if (x + 6 < c.w) out.push(P(VM, x + 6, 0, 0));
    if (x + 7 < c.w) out.push(P(VR, x + 7, 0, 0));
  }
  return out;
}

/** CU: a customs desk with its two chairs below it, a bench and planter at one end and a planter at the other. */
export function cu(c: Ctx): Piece[] {
  const { w } = c, tx = Math.floor(w / 2) - 2;
  return [P(T, tx, 0, 0), P(C, tx, 1, 0), P(C, tx + 1, 1, 0), P(BE, w - 3, 0, 0), P(PL, w - 1, 0, 0), P(PL, 0, 0, 0)];
}

/** PZ: a bench on each side of two planters in the middle (a pinwheel), a planter in each back corner, a vending machine in each bottom corner. */
export function pz(c: Ctx): Piece[] {
  const { w, h } = c, x = Math.floor(w / 2), y = Math.floor(h / 2);
  return [
    P(PL, 0, 0, 0), P(PL, w - 1, 0, 0), P(PL, x - 1, y, 0), P(PL, x + 1, y, 0),
    P(BE, x - 1, y - 2, 0), P(BE, x, y + 2, 2), P(BE, x - 3, y, 3), P(BE, x + 3, y, 1),
    P(VM, 0, h - 1, 2), P(VR, w - 1, h - 1, 2),
  ];
}
