import { FILL_MAX, fillerFor, type Filler } from './roomSize';
import { CABIN_TIER } from './cabinBlock';
import { roomKind } from './roomAccess';
import { MIN_DEPTH } from './frame';
import { areaOf, capOf, minLen, type Pair } from './pairs';

/** The splitter of the block layout (`blockLayout.ts`): a band's run of columns cut into rooms by planned area. */

/** A room at most this many times as long as it is deep, and at most `DEEP` times as deep as it is long (no thin strips). */
const ASPECT = 3;
export const DEEP = 2;
export interface Band { segs: [number, number][]; lo: (x: number) => number; hi: (x: number) => number }
export interface Piece { pair: Pair; x0: number; x1: number; /** An outer room's column in front of its own room (it keeps that door when it widens). */ at?: number }

/** Which fillers a ship has used (one workshop, lounge and gym a side at most; a farm where the ship carries one). */
export interface Fills { left: Filler[] }
// One of a kind a ship (the room opposite a hold of the same shape), holds in pairs.
const fillPair = (fills: Fills, area: number, deep: number): Pair => {
  const r = fillerFor(fills.left, area, deep, deep >= 2 * MIN_DEPTH + 1);
  return roomKind(r) === 'cargo' ? [r, r] : [r, fillerFor([], area, deep, deep >= 2 * MIN_DEPTH + 1)];
};

/**
 * The splitter: pairs in order along a band's runs, each taking columns until its share of the band is met (the band's
 * floor shared out in proportion to the planned areas), a plating column between rooms; a room too long for what is
 * left of a run moves to the next, the room before it taking the rest. Null when the pairs do not fit; with `sparse`,
 * runs may stay empty (an outer tier: the inner rooms keep the full depth there).
 */
export function split(band: Band, pairs: readonly Pair[], vary: readonly number[], sparse: boolean, fills: Fills): Piece[] | null {
  const area = (x: number): number => Math.max(0, band.hi(x) - band.lo(x) + 1);
  {
    const out: Piece[] = [];
    let s = 0, x = band.segs[0]?.[0] ?? 0, first = out.length;
    // Leftover floor from a to b as filler rooms, each within the fillers' size and none much longer than it is deep
    // (a plating column between them).
    const stores = (a: number, b: number): void => {
      let floor = 0;
      for (let x = a; x < b; x++) floor += area(x);
      const deep = Math.max(MIN_DEPTH, area(a));
      // As many as keep each within the fillers' size, none narrower than its depth allows.
      const most = Math.max(1, Math.floor((b - a + 1) / (Math.max(MIN_DEPTH, Math.ceil(deep / DEEP)) + 1)));
      const n = Math.min(most, Math.max(1, Math.round((b - a + 1) / (2.5 * deep + 1)), Math.ceil(floor / FILL_MAX)));
      for (let k = 0, x0 = a; k < n; k++) {
        const x1 = k === n - 1 ? b : a + Math.round(((k + 1) * (b - a + 1)) / n) - 1;
        let f = 0;
        for (let x = x0; x < x1; x++) f += area(x);
        out.push({ pair: fillPair(fills, f, deep), x0, x1 });
        x0 = x1 + 1;
      }
    };
    // A run's end: what is left from `x` on, long enough for a room, is a store (an outer tier leaves it to the inner
    // rooms); else the run's last room takes it. Then the next run.
    const next = (): void => {
      const last = out.length > first ? out[out.length - 1] : undefined, end = (band.segs[s] as [number, number])[1];
      if (end - x >= MIN_DEPTH) { if (!sparse) stores(x, end); } else if (last) last.x1 = end;
      s++; x = band.segs[s]?.[0] ?? 0; first = out.length;
    };
    for (const [i, pair] of pairs.entries()) {
      const len = Math.max(minLen(pair[0]), minLen(pair[1])), cap = capOf(pair), goal = Math.min(cap, 1.25 * areaOf(pair) * Math.max(1, vary[i % vary.length] ?? 1));
      // A room takes columns until its share is met, but no longer than three times its depth once it has its planned
      // floor; one that a run cannot hold moves on to the next run.
      for (;;) {
        if (s >= band.segs.length) return null;
        const end = (band.segs[s] as [number, number])[1], x0 = x;
        let a = 0, deep = 0;
        // Past its planned floor, a room stops at three times its depth or at its cap.
        const plan = areaOf(pair);
        const long = (): boolean => a >= plan && ((x - x0) >= ASPECT * (a / Math.max(1, x - x0)) || a + area(x) > cap);
        for (; x < end && ((a < goal && !long()) || x - x0 < len || (x - x0) * DEEP < deep); x++) { a += area(x); deep = Math.max(deep, area(x)); }
        // A cabin block: as long as its cabins ask at the depth it gets (two rows of cabins off a corridor of its own
        // where the floor is deep enough, else a row of cabins three wide on the spine), so they cut evenly.
        const blk = pair[0].block ? pair[0] : pair[1].block ? pair[1] : null;
        if (blk) {
          x = x0;
          const want = area(x0) >= 2 * CABIN_TIER - 1 ? blk.w : 4 * blk.mods.length - 1;
          if (x0 + want <= end) { out.push({ pair, x0, x1: x0 + want }); x = x0 + want + 1; break; }
          next();
          continue;
        }
        if (a >= plan && x - x0 >= len) { out.push({ pair, x0, x1: x }); x++; break; }
        x = x0;
        next();
      }
    }
    if (s < band.segs.length && x < (band.segs[s] as [number, number])[1]) next(); else s++;
    // Runs of an inner band the rooms did not reach hold stores (no floor stands empty).
    if (!sparse) for (const [a, b] of band.segs.slice(s)) stores(a, b);
    return out;
  }
}
