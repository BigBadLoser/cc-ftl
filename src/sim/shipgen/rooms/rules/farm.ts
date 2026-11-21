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

export const HYL = 'module.hydroponics_large';

/**
 * F2, a farm floor (a room wider than deep, its door on a long wall): large hydroponics beds stood on end across the
 * back of the room, two tiles between them, each worked from the gap beside it; a walkway along the front to the door.
 * The planned beds come first; the rest the floor holds are extras (#581).
 */
export function f2(c: Ctx): Piece[] {
  const { w, h, d } = c, out: Piece[] = [];
  // (A bed on end is two wide and three deep; a row of them at pitch four, shifted so the door's column falls in a gap.)
  const n = Math.floor((w + 2) / 4), span = 4 * n - 2, mid = Math.floor((w - span) / 2);
  const inBed = (s: number): boolean => d >= s && d < s + span && (d - s) % 4 < 2;
  const x0 = Array.from({ length: w - span + 1 }, (_, s) => s).sort((u, v) => Number(inBed(u)) - Number(inBed(v)) || Math.abs(u - mid) - Math.abs(v - mid))[0] ?? 0;
  for (let y = 0; y + 3 < h; y += 5) for (let i = 0; i < n; i++) {
    const x = x0 + 4 * i;
    if (x <= d && d <= x + 1) continue;
    // Rotation 3 works it from the east, rotation 1 from the west: the last bed faces back into the row.
    out.push(P(HYL, x, y, i === n - 1 && n > 1 ? 1 : 3));
  }
  return out;
}
