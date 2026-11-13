import type { RoomSpec } from '../plan';
import { SOLID, SPACE } from './regions';
import type { Site } from './lattice';

/**
 * The ring's inner side as frontage. The ring is a street like any other: its inner wall is cut into straight runs (the
 * long flats, and the treads and risers of its stair at the diagonals), and rooms stand against each run with their
 * backs to the centre. Along a flat they line it; on the stair each tread takes one room, as wide as the tread, whose
 * far wall carries the riser straight on, so no wall meets the stair anywhere else. A ring with rooms on both sides
 * holds twice the cabins, so the whole station is a size smaller.
 */

interface Run {
  /** The run's wall tiles lie along `axis` at `at` on the other axis; free ground is on side `inward` of it. */
  axis: 'x' | 'y';
  at: number;
  inward: 1 | -1;
  /** First and last tile along the axis. */
  a0: number;
  a1: number;
  angle: number;
  /** Distance of its middle from its face's axis: flats first, then the stair outward. */
  off: number;
}

const TAU = 2 * Math.PI;
const apart = (a: number, b: number): number => { const d = Math.abs(a - b) % TAU; return Math.min(d, TAU - d); };

/** The straight runs of the ring's inner wall that have the ring on one side and free ground on the other. */
export function runsOf(s: Site): Run[] {
  const { g, R } = s;
  const wall = (x: number, y: number): boolean => g.at(x, y) === SOLID && s.depth(x, y) === 3;
  const ground = (x: number, y: number): boolean => s.depth(x, y) >= 4 && g.at(x, y) === SPACE;
  const out: Run[] = [];
  for (const axis of ['x', 'y'] as const) {
    const tile = (a: number, c: number): [number, number] => (axis === 'x' ? [a, c] : [c, a]);
    for (const inward of [1, -1] as const) {
      for (let c = -R; c <= R; c++) {
        let start: number | null = null;
        for (let a = -R; a <= R + 1; a++) {
          // The ring straight behind the wall tile, or a tile along from it (the end of a tread, under the turn).
          const ringed = [0, 1, -1].some((k) => g.at(...tile(a + k, c - inward)) === s.ring);
          const on = wall(...tile(a, c)) && ringed && ground(...tile(a, c + inward));
          if (on && start === null) start = a;
          if (!on && start !== null) {
            const [mx, my] = tile((start + a - 1) / 2, c);
            out.push({ axis, at: c, inward, a0: start, a1: a - 1, angle: (Math.atan2(mx, -my) + TAU) % TAU, off: Math.abs((start + a - 1) / 2) });
            start = null;
          }
        }
      }
    }
  }
  return out.sort((p, q) => p.off - q.off);
}

export interface InnerAsk { spec: RoomSpec; angle: number }

/** Whether a room is small enough to stand on the ring's inner side. */
export const innerRoom = (r: RoomSpec): boolean => !!r.cabin || (Math.min(r.w, r.h) <= 5 && Math.max(r.w, r.h) <= 9);

/**
 * Place rooms on the ring's inner side, each on the run nearest its angle. `asks` in order of who chooses first.
 * `within`: a room stands only on a run this near its angle (the rest find no place). `rows`: longest runs first.
 * Returns the rooms that found no place.
 */
export function placeInner(s: Site, asks: readonly InnerAsk[], within = Infinity, rows = false): RoomSpec[] {
  const { g } = s;
  // `rows`: the runs with the longest stretch of open ground in front of them first (a pier cuts a run in two), so
  // what stands inboard is a row along a straight (an arc's arms), not rooms scattered on the short runs by the axes.
  const stretch = (run: Run): number => {
    let best = 0, n = 0;
    for (let a = run.a0; a <= run.a1; a++) {
      const [x, y] = run.axis === 'x' ? [a, run.at + run.inward] : [run.at + run.inward, a];
      n = s.free(x, y) ? n + 1 : 0;
      best = Math.max(best, n);
    }
    return best;
  };
  const runs = rows ? runsOf(s).map((r) => ({ r, n: stretch(r) })).sort((p, q) => q.n - p.n).map((p) => p.r) : runsOf(s);
  const left = [...asks];
  for (const run of runs) {
    if (left.length === 0) break;
    const tile = (a: number, d: number): [number, number] => (run.axis === 'x' ? [a, run.at + run.inward * d] : [run.at + run.inward * d, a]);
    const riser = (a: number): boolean => { const [x, y] = tile(a, 1); return g.at(x, y) === SOLID && s.depth(x, y) === 3; };
    // The run with the riser column at either end: a room's end wall carries the riser straight on.
    const a0 = run.a0 - (riser(run.a0 - 1) ? 1 : 0), a1 = run.a1 + (riser(run.a1 + 1) ? 1 : 0);
    const open = (a: number, d: number): boolean => { const [x, y] = tile(a, d); return s.free(x, y); };
    const bare = (a: number, d: number): boolean => { const [x, y] = tile(a, d); const b = g.at(x, y); return b === SPACE || (b >= 0 && !!g.regions[b]?.hall); };
    // Rooms go in from the end nearer the face's axis outward.
    const dir = Math.abs(a0) <= Math.abs(a1) ? 1 : -1;
    let at = dir > 0 ? a0 : a1;
    const end = dir > 0 ? a1 : a0;
    while (left.length > 0 && (end - at) * dir + 1 >= 4) {
      // Whoever wants this place most among the rooms that fit it.
      const room = (end - at) * dir + 1;
      let best = -1, bestCost = Infinity, bestBox = { along: 0, depth: 0, turned: false };
      for (const [k, ask] of left.entries()) {
        for (const turned of [false, true]) {
          const w = turned ? ask.spec.h : ask.spec.w, h = turned ? ask.spec.w : ask.spec.h;
          if (turned && (ask.spec.cabin || w === h)) continue;
          // Its own near wall when what stands before it is open (space below a riser, or a hall).
          let near = 0;
          for (let d = 1; d <= h && near === 0; d++) if (bare(at - dir, d)) near = 1;
          let along = w + 1 + near;
          if (along > room) continue;
          if (room - along < 4) along = room; // too little left for another: it takes the rest
          if (along - 1 - near > w + 3) continue; // but not stretched out of shape
          let fits = true;
          for (let d = 0; d <= h + 1 && fits; d++) for (let k2 = 0; k2 < along && fits; k2++) fits = open(at + dir * k2, d);
          if (!fits) continue;
          if (apart(run.angle, ask.angle) > within) continue;
          const cost = apart(run.angle, ask.angle) + (turned ? 0.05 : 0);
          if (cost < bestCost) { best = k; bestCost = cost; bestBox = { along, depth: h, turned }; }
        }
      }
      if (best < 0) break;
      const ask = left[best] as InnerAsk;
      const m = g.mark();
      const spec = bestBox.turned ? { ...ask.spec, w: ask.spec.h, h: ask.spec.w } : ask.spec;
      const [xa, ya] = tile(at, 0), [xb, yb] = tile(at + dir * (bestBox.along - 1), bestBox.depth + 1);
      const box: [number, number, number, number] = [Math.min(xa, xb), Math.min(ya, yb), Math.max(xa, xb) + 1, Math.max(ya, yb) + 1];
      const before = g.blocks(box[0] - 3, box[1] - 3, box[2] + 3, box[3] + 3);
      g.rect(g.room(spec.role, { spec, access: [s.ring] }), ...box);
      if (g.blocks(box[0] - 3, box[1] - 3, box[2] + 3, box[3] + 3) > before) { g.reset(m); at += dir; continue; }
      left.splice(best, 1);
      at += dir * bestBox.along;
    }
  }
  return left.map((a) => a.spec);
}
