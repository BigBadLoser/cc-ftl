/**
 * RH rack hold (#581): a hold of racks entered on a long wall (the room wider than deep in its door's frame). The racks
 * stand in rows along the long axis: a row on the back wall facing out, then pairs back to back with an aisle between
 * pairs, the door's row bare. A rack is left out wherever it would cover a doorway (the main door's column, or the
 * floor beside any other door), so that gap carries the walkway from the door's row to every aisle. The planned racks
 * are the first places; the hold fills every row (place.ts keeps those that fit and leave the room working).
 */
import type { Piece } from './check';
import { P } from './parts';
import type { Ctx } from './rules';

const RACK = 'module.storage_rack';

/** Whether `rackHold` suits a room: racks only, entered on a long wall, room for a row and an aisle past the door's. */
export const rackHoldFits = (need: readonly string[], r: { w: number; h: number }): boolean =>
  need.length > 0 && need.every((m) => m === RACK) && r.w >= r.h && r.h >= 4 && r.w >= 6;

export function rackHold(c: Ctx): Piece[] {
  const { w, h, d } = c, out: Piece[] = [], rw = c.defs[RACK]?.footprint[0] ?? 2;
  const blocked = new Set<string>((c.cut ?? []).map((e) => `${e.x},${e.y}`));
  const near = (x: number, y: number): boolean => x === d || (c.doors ?? []).some((e) => Math.abs(e.x - x) <= 1 && Math.abs(e.y - y) <= 1);
  // Row 0 faces south onto aisle 1; then y = 2 + 3k faces north and 3 + 3k south, both onto an aisle (1 + 3k, 4 + 3k).
  for (let y = 0; y <= h - 2; y++) {
    const rot = y % 3 === 2 ? 2 : y % 3 === 0 ? 0 : -1;
    if (rot < 0) continue;
    for (let x = 0; x + rw <= w; x += rw) {
      const span = Array.from({ length: rw }, (_, i) => x + i);
      if (span.some((t) => blocked.has(`${t},${y}`) || near(t, y))) continue;
      out.push(P(RACK, x, y, rot));
    }
  }
  return out;
}
