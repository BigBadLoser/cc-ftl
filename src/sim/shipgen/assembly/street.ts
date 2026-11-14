import type { RoomSpec } from '../plan';
import { line, type Site } from './lattice';

/**
 * The ring's inside as streets: what the band cannot hold stands in rows either side of a straight street through the
 * middle, from the ring's inner wall to the wall opposite (or to an arc's open side). Rows keep CLEAR tiles off the
 * ring, so the open ground between their backs and the ring stays open (bracing crosses it). Tried in order until every
 * room stands: one street, rooms as given; one street, rooms turned end on (deeper rows, more to a street); then two
 * streets crossing at the centre, likewise. Each on either axis.
 */

const CLEAR = 3;

type Axis = 'x' | 'y';

/** Where a street along `axis` through the centre can run: the free stretch from the centre out each way. */
function span(s: Site, axis: Axis): [number, number] | null {
  const tile = (a: number, c: number): [number, number] => (axis === 'x' ? [a, c] : [c, a]);
  const open = (a: number): boolean => [-2, -1, 0, 1].every((c) => s.free(...tile(a, c)));
  if (!open(0) || !open(-1)) return null;
  let a1 = 0, a0 = -1;
  while (open(a1 + 1)) a1++;
  while (open(a0 - 1)) a0--;
  // It must meet the ring at one end at least.
  const meets = (a: number): boolean => [-1, 0].every((c) => s.g.at(...tile(a, c)) === s.ring);
  if (!meets(a1 + 1) && !meets(a0 - 1)) return null;
  return [a0, a1];
}

/** Paint a street along `axis` over the stretch [a0, a1]: floor on lines -1 and 0, a solid margin either side. */
function paint(s: Site, axis: Axis, [a0, a1]: [number, number]): number {
  const id = s.g.hall();
  if (axis === 'x') s.g.street(id, a0, -1, a1 + 1, 1);
  else s.g.street(id, -1, a0, 1, a1 + 1);
  return id;
}

/** One trial: returns the rooms left over (the grid keeps what stood). */
function attempt(s: Site, rooms: readonly RoomSpec[], axis: Axis, cross: boolean, deep: boolean): RoomSpec[] | null {
  const other: Axis = axis === 'x' ? 'y' : 'x';
  const main = span(s, axis);
  if (!main) return null;
  const second = cross ? span(s, other) : null;
  if (cross && !second) return null;
  const halls = [paint(s, axis, main)];
  if (cross && second) halls.push(paint(s, other, second));
  // Free ground with CLEAR tiles of it all round: nothing stands against the ring.
  const free = (x: number, y: number): boolean => {
    if (!s.free(x, y)) return false;
    for (let d = -CLEAR; d <= CLEAR; d++) for (let e = -CLEAR; e <= CLEAR; e++) if (s.depth(x + d, y + e) < 4) return false;
    return true;
  };
  // Rows: either side of each street, from the centre outward both ways. Off a crossing they start past the other
  // street's margin. Rooms are dealt round the rows in turn, biggest first, so each row fills from the middle.
  const rows: { axis: Axis; dir: 1 | -1; from: number; edge: number; side: 1 | -1 }[] = [];
  for (const ax of cross ? [axis, other] : [axis]) {
    const start = cross ? 2 : 0;
    for (const side of [-1, 1] as const) for (const dir of [1, -1] as const) rows.push({ axis: ax, dir, from: dir > 0 ? start : -1 - start, edge: side < 0 ? -2 : 1, side });
  }
  let left = [...rooms].sort((p, q) => q.w * q.h - p.w * p.h);
  const at = rows.map((r) => r.from);
  // Deal: each row in turn takes the next room that fits it; a row that takes nothing is closed.
  const open = rows.map(() => true);
  while (left.length > 0 && open.some(Boolean)) {
    for (const [i, r] of rows.entries()) {
      if (!open[i] || left.length === 0) continue;
      let took = false;
      for (const [k, spec] of left.entries()) {
        const res = line(s, [spec], r.axis === 'x' ? 'x' : 'y', r.dir, at[i] as number, r.edge, r.side, { free, deep, access: [...halls, s.ring] });
        if (res.rest.length > 0) continue;
        at[i] = res.at;
        left.splice(k, 1);
        took = true;
        break;
      }
      if (!took) open[i] = false;
    }
  }
  return left;
}

/** Stand `rooms` on streets through the ring's inside. Returns the rooms that found no place. */
export function placeStreets(s: Site, rooms: readonly RoomSpec[]): RoomSpec[] {
  if (rooms.length === 0) return [];
  const { g } = s;
  const box = [-s.R, -s.R, s.R, s.R] as const;
  const blocks = g.blocks(...box);
  let best: { left: number; o: [Axis, boolean, boolean] } | null = null;
  for (const cross of [false, true]) for (const deep of [false, true]) for (const axis of ['x', 'y'] as const) {
    const m = g.mark();
    const left = attempt(s, rooms, axis, cross, deep);
    const thick = g.blocks(...box) > blocks;
    g.reset(m);
    if (!left || thick) continue;
    if (left.length === 0) { attempt(s, rooms, axis, cross, deep); return []; }
    if (!best || left.length < best.left) best = { left: left.length, o: [axis, cross, deep] };
  }
  return best ? (attempt(s, rooms, ...best.o) as RoomSpec[]) : [...rooms];
}
