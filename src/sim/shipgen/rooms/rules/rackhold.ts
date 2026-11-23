/**
 * RH rack hold (#581), the one arrangement of a hold of racks: every rack end-on to a long wall, its short side on the
 * wall, the racks along it every three tiles with a two-tile aisle between (none in the last column, its aisle past the wall) (a carrier's hold). In a room wider than deep
 * in its door's frame (a door on a long wall) they stand on the back wall, and on the door wall where a walkway is left
 * between; in a deeper room (a door on a short end) on the west and east walls. The door's
 * row is bare, and a rack is left out wherever it would cover a doorway (the main door's column, or the floor beside any
 * other door, on any wall), so those gaps carry the walkway to every aisle. The planned racks take the first places; the
 * hold fills every row (place.ts keeps those that fit and leave the room working).
 */
import type { Piece } from './check';
import { P } from './parts';
import type { Ctx } from './rules';

const RACK = 'module.storage_rack';

/** Whether `rackHold` suits a room: racks only, a row and its aisle past the door's row (or a column and its aisle in a deep room). */
export const rackHoldFits = (need: readonly string[], r: { w: number; h: number }): boolean =>
  need.length > 0 && need.every((m) => m === RACK) && (r.w >= r.h ? r.w >= 6 && r.h >= 3 : r.h >= 4 && r.w >= 3);

export function rackHold(c: Ctx): Piece[] {
  const { w, h, d } = c, out: Piece[] = [], len = c.defs[RACK]?.footprint[0] ?? 2;
  const blocked = new Set<string>((c.cut ?? []).map((e) => `${e.x},${e.y}`));
  const near = (x: number, y: number): boolean => (w >= h && x === d) || (c.doors ?? []).some((e) => Math.abs(e.x - x) <= 1 && Math.abs(e.y - y) <= 1);
  const put = (x: number, y: number, rot: number, tw: number, th: number): void => {
    for (let i = 0; i < tw; i++) for (let j = 0; j < th; j++) if (blocked.has(`${x + i},${y + j}`) || near(x + i, y + j)) return;
    out.push(P(RACK, x, y, rot));
  };
  // Each rack end-on to a long wall (its short side on the wall), one beside the next every three tiles (a two-tile
  // aisle between): in a wide frame turned to face east, on the back wall and (deep enough to keep a walkway between)
  // the door wall; in a deep one facing south, on the west wall and the east.
  if (w >= h) {
    for (let x = 0; x + 1 < w; x += 3) { put(x, 0, 3, 1, len); if (h >= 2 * len + 1) put(x, h - len, 3, 1, len); }
  } else {
    for (let y = 0; y + 1 <= h - 2; y += 3) { put(0, y, 0, len, 1); if (w >= 2 * len + 1) put(w - len, y, 0, len, 1); }
  }
  return out;
}
