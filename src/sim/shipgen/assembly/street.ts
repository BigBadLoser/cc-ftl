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

/**
 * Where a street along `axis` can run, its floor on lines `off - 1` and `off` across: the free stretch from the centre
 * out each way.
 */
function span(s: Site, axis: Axis, off = 0): [number, number, boolean] | null {
  const tile = (a: number, c: number): [number, number] => (axis === 'x' ? [a, c + off] : [c + off, a]);
  const open = (a: number): boolean => [-2, -1, 0, 1].every((c) => s.free(...tile(a, c)));
  if (!open(0) || !open(-1)) return null;
  let a1 = 0, a0 = -1;
  while (open(a1 + 1)) a1++;
  while (open(a0 - 1)) a0--;
  // It must meet the ring at one end at least.
  const meets = (a: number): boolean => [-1, 0].every((c) => s.g.at(...tile(a, c)) === s.ring);
  if (!meets(a1 + 1) && !meets(a0 - 1)) return null;
  // And whether at both: an arc's spine meets it at one end only, running out to the open side.
  return [a0, a1, meets(a1 + 1) && meets(a0 - 1)];
}

/** Paint a street along `axis` over the stretch [a0, a1]: floor on lines off - 1 and off, a solid margin either side. */
function paint(s: Site, axis: Axis, [a0, a1]: readonly [number, number, ...boolean[]], off = 0): number {
  const id = s.g.hall();
  if (axis === 'x') s.g.street(id, a0, off - 1, a1 + 1, off + 1);
  else s.g.street(id, off - 1, a0, off + 1, a1 + 1);
  return id;
}

/** One trial: returns the rooms left over (the grid keeps what stood). */
function attempt(s: Site, rooms: readonly RoomSpec[], axis: Axis, cross: boolean, deep: boolean): RoomSpec[] | null {
  const other: Axis = axis === 'x' ? 'y' : 'x';
  const main = span(s, axis);
  if (!main) return null;
  // The middle of the first street: where a lone street's rows start (an arc's street runs from the ring to the open
  // side, off centre) and where a second street crosses it.
  const mid = Math.floor((main[0] + main[1] + 1) / 2);
  const second = cross ? span(s, other, mid) : null;
  if (cross && !second) return null;
  const halls = [paint(s, axis, main)];
  if (cross && second) halls.push(paint(s, other, second, mid));
  // Free ground with CLEAR tiles of it all round: nothing stands against the ring.
  const free = (x: number, y: number): boolean => {
    if (!s.free(x, y)) return false;
    for (let d = -CLEAR; d <= CLEAR; d++) for (let e = -CLEAR; e <= CLEAR; e++) if (s.depth(x + d, y + e) < 4) return false;
    return true;
  };
  // Rows: either side of each street, from the centre outward both ways. Off a crossing they start past the other
  // street's margin. Rooms are dealt round the rows in turn, biggest first, so each row fills from the middle.
  const rows: { axis: Axis; dir: 1 | -1; from: number; edge: number; side: 1 | -1 }[] = [];
  const start = cross ? 2 : 0;
  for (const side of [-1, 1] as const) for (const dir of [1, -1] as const) {
    rows.push({ axis, dir, from: dir > 0 ? mid + start : mid - 1 - start, edge: side < 0 ? -2 : 1, side });
    // Along the second street, from the first outward; its sides either side of `mid`.
    if (cross) rows.push({ axis: other, dir, from: dir > 0 ? start : -1 - start, edge: side < 0 ? mid - 2 : mid + 1, side });
  }
  // Every room the same way round: its short side on the street, or (deep) its long side across.
  const turn = (r: RoomSpec): RoomSpec => ((deep ? r.w > r.h : r.h > r.w) && !r.cabin ? { ...r, w: r.h, h: r.w } : r);
  const depth = (r: RoomSpec): number => turn(r).h;
  // In the order given by department (the streets' own departments first: they stand in the middle), deepest first
  // within one, so the first room of a department on a side sets its depth there and every later one grows to meet it.
  const rank = new Map<string, number>();
  for (const r of rooms) if (!rank.has(r.dept ?? '')) rank.set(r.dept ?? '', rank.size);
  const left = [...rooms].sort((p, q) => (rank.get(p.dept ?? '') as number) - (rank.get(q.dept ?? '') as number) || depth(q) - depth(p) || q.w * q.h - p.w * p.h);
  const at = rows.map((r) => r.from);
  // One depth a department on a side of a street (both ways from the centre): set by its first room to stand there.
  const sideDepth = new Map<string, number>();
  // Deal: each row in turn takes the next room that fits it; a row that takes nothing is closed.
  const open = rows.map(() => true);
  while (left.length > 0 && open.some(Boolean)) {
    for (const [i, r] of rows.entries()) {
      if (!open[i] || left.length === 0) continue;
      let took = false;
      const side = `${r.axis}${r.side}`;
      for (const [k, spec] of left.entries()) {
        const t = turn(spec), sk = `${side}${spec.dept ?? ''}`, D = sideDepth.get(sk);
        if (D !== undefined && t.h > D) continue;
        const grown = D !== undefined && t.h < D ? { ...t, h: D } : t;
        const res = line(s, [grown], r.axis === 'x' ? 'x' : 'y', r.dir, at[i] as number, r.edge, r.side, { free, access: [...halls, s.ring] });
        if (res.rest.length > 0) continue;
        if (D === undefined) sideDepth.set(sk, t.h);
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
  // An arc's street is its spine, from the ring out to the open side: no other street, and none across it.
  const spine = (['x', 'y'] as const).filter((a) => span(s, a)?.[2] === false);
  const axes = spine.length > 0 ? spine : (['x', 'y'] as const);
  for (const cross of spine.length > 0 ? [false] : [false, true]) for (const deep of [false, true]) for (const axis of axes) {
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
