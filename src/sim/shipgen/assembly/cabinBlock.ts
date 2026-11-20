import type { RoomSpec } from '../plan';
import { SLEEPER } from './quarters';

/**
 * A cabin block: a barracks floor deep enough for two rows of cabins is cut into cabins off a corridor of its own, run
 * out from the spine (SHIPGEN_V4, "Room layout"). Planned in the band's frame: columns from the piece's first, rows out
 * from the spine's wall row (0 is the wall row a room shares with the spine, floor from 1).
 */

/** Floor rows of a cabin; floor columns a cabin takes at least (a station cabin's two), and as wide as a cabin is cut. */
const CABIN_ROWS = 3, CABIN_COLS = 2, ROOMY = 4;
/** Rows a row of cabins takes with the plating row past it: two rows of cabins want twice this, less one. */
export const CABIN_TIER = CABIN_ROWS + 1;

/** A rectangle of the block: columns [c0, c1), rows [r0, r1] (inclusive; `Infinity` runs to the hull). */
export interface Rect { c0: number; c1: number; r0: number; r1: number }
/** `rest`: the floor beyond the last row of cabins, a unit's full width: one room the corridor ends at. */
export interface CabinBlock { stubs: Rect[]; cabins: Rect[]; rest: Rect[] }

/**
 * The block for a piece `len` columns long whose floor is `rows` deep, or null when it is too small for two rows of
 * cabins each side of a corridor. A cabin's column beside the corridor and its row beside the spine compile to wall,
 * so a rectangle includes them; cabins in a column stand a plating row apart, units a plating column apart.
 */
export function cabinBlock(len: number, rows: number, want = Infinity): CabinBlock | null {
  // Rows of cabins: the first (its wall row against the spine, then its floor), the rest a plating row apart.
  const deep = 1 + Math.floor((rows - CABIN_ROWS) / (CABIN_ROWS + 1));
  // A unit: cabin floor, wall, corridor, wall, cabin floor; units a plating column apart, as many as keep cabins near
  // `ROOMY` wide and none under `CABIN_COLS`.
  const unit = 2 * (CABIN_COLS + 1) + 1, roomy = 2 * (ROOMY + 1) + 1;
  const most = len < unit ? 0 : 1 + Math.floor((len - unit) / (unit + 1));
  const units = Math.min(most, Math.max(1, Math.round((len + 1) / (roomy + 1))));
  if (deep < 2 || units < 1) return null;
  // Only the rows of cabins the beds want: past them, a room each side of the corridor out to the hull (none under three
  // rows: the last row of cabins takes those).
  const start0 = (t: number): number => (t === 0 ? 0 : CABIN_ROWS + 2 + (t - 1) * (CABIN_ROWS + 1));
  let tiers = Math.max(2, Math.min(deep, Math.ceil(want / (2 * units))));
  if (tiers < deep && rows - start0(tiers) < CABIN_ROWS) tiers = deep;
  const back = tiers < deep;
  const stubs: Rect[] = [], cabins: Rect[] = [], rest: Rect[] = [];
  const start = (t: number): number => (t === 0 ? 0 : CABIN_ROWS + 2 + (t - 1) * (CABIN_ROWS + 1));
  // The last row of cabins runs out to the hull.
  const end = (t: number): number => (t === tiers - 1 && !back ? Infinity : t === 0 ? CABIN_ROWS : start(t) + CABIN_ROWS - 1);
  for (let u = 0; u < units; u++) {
    const a = Math.round(((len + 1) * u) / units), b = Math.round(((len + 1) * (u + 1)) / units) - 1;
    // Cabins either side the same width: the corridor takes the odd column (one or two wide, three where cabins would
    // be wider than roomy).
    const w = b - a, side = Math.floor((w - 1) / 2) - 1 > ROOMY ? Math.floor((w - 3) / 2) : Math.floor((w - 1) / 2);
    const sw = w - 2 * side, s0 = a + side;
    // Out to the hull, as the last row of cabins runs (a corridor stopping short would leave plating: a thick hull), or
    // to the room past the cabins, which spans the unit.
    stubs.push({ c0: s0, c1: s0 + sw, r0: 0, r1: back ? start(tiers - 1) + CABIN_ROWS - 1 : Infinity });
    for (let t = 0; t < tiers; t++) {
      cabins.push({ c0: a, c1: s0, r0: start(t), r1: end(t) });
      cabins.push({ c0: s0 + sw, c1: b, r0: start(t), r1: end(t) });
    }
    if (back) rest.push({ c0: a, c1: b, r0: start(tiers), r1: Infinity });
  }
  return { stubs, cabins, rest };
}

/**
 * PROTOTYPE (#581): a cabin run, its corridor lengthwise: a stub out from the spine at the piece's first columns, then
 * along the piece, a row of cabins each side of it (the front row on the spine, the back row out to the hull or the
 * battery). For floor too shallow-ended for a corridor run out to the hull, as under the battery. Null when `rows` is
 * under two rows of cabins and the corridor, or a row has no cabin.
 */
export function cabinRun(len: number, rows: number): CabinBlock | null {
  if (rows < 2 * CABIN_ROWS + 3) return null;
  // The corridor two wide where the floor allows it and the back row keeps its three rows.
  const sw = rows >= 2 * CABIN_ROWS + 4 ? 2 : 1, h0 = CABIN_ROWS + 2, h1 = h0 + sw - 1;
  const row = (c0: number, c1: number, r0: number, r1: number): Rect[] | null => {
    // Cabins near `ROOMY` wide a plating column apart; the first and last column of each may be wall.
    const L = c1 - c0, n = Math.max(1, Math.round((L + 1) / (ROOMY + 2)));
    const out: Rect[] = [];
    for (let k = 0; k < n; k++) {
      const a = c0 + Math.round(((L + 1) * k) / n), b = c0 + Math.round(((L + 1) * (k + 1)) / n) - 1;
      if (b - a < CABIN_COLS + 1) return null;
      out.push({ c0: a, c1: b, r0, r1 });
    }
    return out;
  };
  const front = row(sw, len, 0, h0 - 1), back = row(0, len, h1 + 1, Infinity);
  if (!front || !back) return null;
  return { stubs: [{ c0: 0, c1: sw, r0: 0, r1: h0 - 1 }, { c0: 0, c1: len, r0: h0, r1: h1 }], cabins: [...front, ...back], rest: [] };
}

/**
 * A barracks' cabin block (`run`: a cabin run instead), each cabin its spec: a bed and a locker, or a bunk where there are fewer cabins than sleepers.
 * Null when the floor is too small, or the cabins would not sleep the barracks' crew.
 */
export function cabinsFor(barracks: RoomSpec, len: number, rows: number, run = false): { stubs: Rect[]; cabins: { rect: Rect; spec: RoomSpec }[]; rest: Rect[] } | null {
  const sleepers = barracks.mods.reduce((n, m) => n + (m === SLEEPER.def ? SLEEPER.sleepers : m === 'module.bed' ? 1 : 0), 0);
  const b = run ? cabinRun(len, rows) : cabinBlock(len, rows, sleepers);
  if (!b || b.cabins.length * SLEEPER.sleepers < sleepers) return null;
  const bed = b.cabins.length >= sleepers ? 'module.bed' : SLEEPER.def;
  return { stubs: b.stubs, rest: b.rest, cabins: b.cabins.map((rect) => ({ rect, spec: { role: 'quarters', mods: [bed, 'module.storage_locker'], w: rect.c1 - rect.c0, h: CABIN_ROWS, cabin: true, cabins: false } })) };
}
