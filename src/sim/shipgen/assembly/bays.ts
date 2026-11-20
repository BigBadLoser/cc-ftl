import { BAND, MIN_DEPTH, type Frame, type Row } from './frame';

/**
 * PROTOTYPE (#581): the band cut into bays, the unit rooms will take. A bay is columns [x0, x1) out from the spine, a
 * plating column after it (shared wall), the same both sides. Under the battery the cuts follow its gun rooms' walls:
 * a bay under each gun, one under each corridor stretch between; elsewhere a stretch is cut into near-equal bays of
 * about `BAY` columns. A bay deep enough for two rooms is split into a front and a back tier (rows out from the spine,
 * room row 1 the first floor row; `Infinity` runs to the hull).
 */
export interface Bay { x0: number; x1: number; tiers: [number, number][]; /** Its rows, where not out from the spine. */ row?: Row }

/** A bay's columns, its plating column aside: seven or eight. */
export const BAY = 7.5;

export function bayLayout(fr: Frame): Bay[] {
  const { xBand, dockAt, CW, xS, depth, maint, lane, outer } = fr;
  // On a lane hull, aft of the cross corridor: out from each side corridor, and in from it to the lane where it has both.
  const out: Row | undefined = lane && { c: lane.yc, dir: 1, depth: (x) => outer(x) - lane.yc - BAND - 1 };
  const blocks: [number, number, Row?][] = [[xBand, dockAt - 1], [dockAt + CW + 1, xS, out]];
  if (lane?.both) blocks.push([lane.head + 1, xS, { c: lane.yc, dir: -1, depth: (x) => lane.yc - BAND - 1 - lane.edge(x) }]);
  // Plating columns the battery fixes: each gun room's side walls, run in to the spine.
  const fixed = (maint?.guns ?? []).flatMap(([s0, s1]) => [s0, s1 - 1]);
  const bays: Bay[] = [];
  for (const [a, b, row] of blocks) {
    const cuts = [a - 1, ...fixed.filter((c) => c > a && c < b - 1).sort((u, v) => u - v), b];
    for (let k = 0; k + 1 < cuts.length; k++) {
      const s0 = (cuts[k] as number) + 1, s1 = cuts[k + 1] as number;
      if (s1 - s0 < 1) continue;
      const inBattery = !!maint && s0 >= maint.a && s1 <= maint.b;
      // Near-equal bays: as many as keep each closest to BAY (a plating column between each).
      const n = inBattery ? 1 : Math.max(1, Math.round((s1 - s0 + 1) / (BAY + 1)));
      for (let j = 0; j < n; j++) {
        const x0 = s0 + Math.round(((s1 - s0 + 1) * j) / n), x1 = s0 + Math.round(((s1 - s0 + 1) * (j + 1)) / n) - 1;
        // (Under a doubled gun the column is the inboard gun's.)
        if (maint?.inner.some((i) => { const g = maint.guns[i]; return !!g && x0 >= g[0] && x1 <= g[1]; })) continue;
        bays.push({ x0, x1, tiers: tiersOf(x0, x1, row?.depth ?? depth, lane ? FRONT : undefined), ...(row ? { row } : {}) });
      }
    }
  }
  return bays;
}

/** A lane hull's front tier's rows at most: its wide body's small rooms in front, the big behind. */
const FRONT = 3;

/**
 * One tier to the hull, or a front and a back where the bay is deep enough for two rooms of at least `MIN_DEPTH` rows:
 * halved, or with `front` the front tier no deeper than that.
 */
function tiersOf(x0: number, x1: number, depth: (x: number) => number, front?: number): [number, number][] {
  let d = Infinity;
  for (let x = x0; x < x1; x++) d = Math.min(d, depth(x));
  if (d < 2 * MIN_DEPTH + 1) return [[1, Infinity]];
  const r = Math.min(front ?? Infinity, Math.max(MIN_DEPTH, Math.round((d - 1) / 2)));
  return [[1, r], [r + 2, Infinity]];
}

