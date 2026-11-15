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
