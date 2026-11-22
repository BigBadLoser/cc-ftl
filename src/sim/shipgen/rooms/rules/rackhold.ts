/**
 * RH rack hold (#581), the one arrangement of a hold of racks: single rows of racks along the room's long axis, each
 * facing a two-tile aisle (a rack and its aisle repeat every three tiles). In a room wider than deep in its door's
 * frame (a door on a long wall) the rows run across the frame, the first on the back wall; in a deeper room (a door on
 * a short end) the racks are turned a quarter so the rows run up the room, the first column on the west wall. The door's
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
  // Rows across a wide frame, facing south; up a deep one, turned to face east.
  if (w >= h) {
    for (let y = 0; y <= h - 2; y += 3) for (let x = 0; x + len <= w; x += len) put(x, y, 0, len, 1);
  } else {
    for (let x = 0; x + 1 <= w - 1; x += 3) for (let y = 0; y + len <= h - 1; y += len) put(x, y, 3, 1, len);
  }
  return out;
}
