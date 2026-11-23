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

/** A hydroponics bed lying along a wall: its width and depth. */
const BED: Readonly<Record<string, [number, number]>> = { [HYL]: [3, 2], [HY]: [2, 1] };

/**
 * F3, a farm floor (a room wider than deep, its door on a long wall): its beds (all large or all small) half on the back
 * wall and half on the front, lying along them, each pair facing the other over the aisle between, two tiles apart,
 * spread evenly, the front ones clear of the door (#581).
 */
export function f3(c: Ctx): Piece[] {
  const { w, h, d } = c, def = c.need[0] ?? HYL, [bw, bd] = BED[def] ?? [3, 2], n = c.need.length;
  const back = Math.ceil(n / 2), front = n - back;
  const at = (m: number, i: number): number => Math.round(((i + 0.5) * w) / m - bw / 2);
  const out: Piece[] = [];
  for (let i = 0; i < back; i++) out.push(P(def, at(back, i), 0, 0));
  for (let i = 0; i < front; i++) {
    let x = at(front, i);
    // (Slide off the door's column, to whichever side keeps inside the walls, the nearer first.)
    if (d >= x && d < x + bw) x = d - x < bw / 2 && d + 1 + bw <= w ? d + 1 : d - bw >= 0 ? d - bw : d + 1;
    out.push(P(def, x, h - bd, 2));
  }
  return out;
}

/** Whether F3 suits a room planned with these beds (or, `as`, with that bed standing in for each): two to a wall with two tiles between, a row to each long wall and an aisle. */
export const f3Fits = (need: readonly string[], r: { w: number; h: number }, as?: string): boolean => {
  const def = as ?? need[0] ?? '', bed = BED[def], n = need.length;
  return !!bed && n > 0 && need.every((m) => m === need[0] && !!BED[m]) && r.h >= 2 * bed[1] + 1 && Math.ceil(n / 2) * (bed[0] + 2) - 2 <= r.w;
};
