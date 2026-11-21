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
 * F2, a farm floor too shallow for the large beds to lie two to a wall: small beds stood on end across the back of the
 * room, two tiles between them, each worked from the gap beside it, centred, the door's column in a gap; a walkway
 * along the front (#581).
 */
export function f2(c: Ctx): Piece[] {
  const { w, d } = c, n = c.need.filter((m) => m === HY).length, span = 3 * n - 2;
  if (span > w) return [];
  const mid = Math.floor((w - span) / 2), inBed = (s: number): boolean => d >= s && d < s + span && (d - s) % 3 === 0;
  const x0 = Array.from({ length: w - span + 1 }, (_, s) => s).sort((u, v) => Number(inBed(u)) - Number(inBed(v)) || Math.abs(u - mid) - Math.abs(v - mid))[0] ?? 0;
  // Rotation 3 works it from the east, rotation 1 from the west: the last bed faces back into the row.
  return Array.from({ length: n }, (_, i) => P(HY, x0 + 3 * i, 0, i === n - 1 && n > 1 ? 1 : 3));
}

/**
 * F3, a farm floor deep enough for two rows (a room wider than deep, its door on a long wall): the large beds half on the
 * back wall and half on the front, lying along them, each pair facing the other over the aisle between; spread evenly,
 * the front ones clear of the door (#581).
 */
export function f3(c: Ctx): Piece[] {
  const { w, h, d } = c, n = c.need.filter((m) => m === HYL).length, back = Math.ceil(n / 2), front = n - back;
  const at = (m: number, i: number): number => Math.round(((i + 0.5) * w) / m - 1.5);
  const out: Piece[] = [];
  for (let i = 0; i < back; i++) out.push(P(HYL, at(back, i), 0, 0));
  for (let i = 0; i < front; i++) {
    let x = at(front, i);
    // (Slide off the door's column, toward the room's middle side of it where that keeps inside the walls.)
    if (d >= x && d <= x + 2) x = d - x <= 1 && d + 1 + 3 <= w ? d + 1 : d - 3 >= 0 ? d - 3 : d + 1;
    out.push(P(HYL, x, h - 2, 2));
  }
  return out;
}

/** Whether F3 suits a room: its large beds two to a wall with two tiles between, a row to each long wall and an aisle. */
export const f3Fits = (need: readonly string[], r: { w: number; h: number }): boolean => {
  const n = need.filter((m) => m === HYL).length;
  return n > 0 && n === need.length && r.h >= 5 && Math.ceil(n / 2) * 5 - 2 + 2 <= r.w;
};
