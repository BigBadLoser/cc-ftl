/**
 * F1, a greenhouse (the agri station's narrow farm, its door on a short wall): hydroponics beds stood on end down both
 * long walls, facing each other across the aisle, filled from the back wall; the rows by the door are left clear.
 */
import type { Piece } from './check';
import { P } from './parts';
import type { Ctx } from './rules';

export const HY = 'module.hydroponics';

export function f1(c: Ctx): Piece[] {
  const { w, h } = c;
  let left = c.need.filter((m) => m === HY).length;
  const out: Piece[] = [];
  // Rotation 3 stands a bed on end with its access to the east (the left wall's), rotation 1 to the west (the right wall's).
  for (let y = 0; y + 1 <= h - 3 && left > 0; y += 2) {
    out.push(P(HY, 0, y, 3));
    if (--left > 0) { out.push(P(HY, w - 1, y, 1)); left--; }
  }
  return out;
}

/**
 * F2, a farm floor (a room wider than deep, its door on a long wall): hydroponics beds edge to edge in rows across the
 * room, the rows in pairs facing each other over a shared aisle, a walkway kept clear from the door through every aisle.
 * The planned beds come first; the rest of the floor's are extras (#581).
 */
export function f2(c: Ctx): Piece[] {
  const { w, h, d } = c, out: Piece[] = [];
  const xs: number[] = [];
  for (let x = 0; x + 1 < w; x += 2) {
    if (x <= d && d <= x + 1) { x--; continue; }
    xs.push(x);
  }
  // Rotation 0 faces the bed's access down (the row below), rotation 2 up.
  for (let y = 0; y + 1 < h; y += 3) {
    for (const x of xs) out.push(P(HY, x, y, 0));
    if (y + 2 < h - 1) for (const x of xs) out.push(P(HY, x, y + 2, 2));
  }
  return out;
}
