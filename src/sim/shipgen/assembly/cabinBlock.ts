import type { RoomSpec } from '../plan';
import { SLEEPER } from './quarters';

/**
 * A cabin block: a barracks floor deep enough for two rows of cabins is cut into cabins off a corridor of its own, run
 * out from the spine (SHIPGEN_V4, "Room layout"). Planned in the band's frame: columns from the piece's first, rows out
 * from the spine's wall row (0 is the wall row a room shares with the spine, floor from 1).
 */

/** Floor rows of a cabin; floor columns a cabin takes at least (a station cabin's two), and as wide as a cabin is cut. */
const CABIN_ROWS = 3, CABIN_COLS = 2, ROOMY = 4;

/** A rectangle of the block: columns [c0, c1), rows [r0, r1] (inclusive; `Infinity` runs to the hull). */
export interface Rect { c0: number; c1: number; r0: number; r1: number }
export interface CabinBlock { stubs: Rect[]; cabins: Rect[] }

/**
 * The block for a piece `len` columns long whose floor is `rows` deep, or null when it is too small for two rows of
 * cabins each side of a corridor. A cabin's column beside the corridor and its row beside the spine compile to wall,
 * so a rectangle includes them; cabins in a column stand a plating row apart, units a plating column apart.
 */
export function cabinBlock(len: number, rows: number): CabinBlock | null {
  // Rows of cabins: the first (its wall row against the spine, then its floor), the rest a plating row apart.
  const tiers = 1 + Math.floor((rows - CABIN_ROWS) / (CABIN_ROWS + 1));
  // A unit: cabin floor, wall, corridor, wall, cabin floor; units a plating column apart, as many as keep cabins near
  // `ROOMY` wide and none under `CABIN_COLS`.
  const unit = 2 * (CABIN_COLS + 1) + 1, roomy = 2 * (ROOMY + 1) + 1;
  const most = len < unit ? 0 : 1 + Math.floor((len - unit) / (unit + 1));
  const units = Math.min(most, Math.max(1, Math.round((len + 1) / (roomy + 1))));
  if (tiers < 2 || units < 1) return null;
  const stubs: Rect[] = [], cabins: Rect[] = [];
  const start = (t: number): number => (t === 0 ? 0 : CABIN_ROWS + 2 + (t - 1) * (CABIN_ROWS + 1));
  // The last row of cabins runs out to the hull.
  const end = (t: number): number => (t === tiers - 1 ? Infinity : t === 0 ? CABIN_ROWS : start(t) + CABIN_ROWS - 1);
  for (let u = 0; u < units; u++) {
    const a = Math.round(((len + 1) * u) / units), b = Math.round(((len + 1) * (u + 1)) / units) - 1;
    // Cabins either side the same width: the corridor takes the odd column (one or two wide, three where cabins would
    // be wider than roomy).
    const w = b - a, side = Math.floor((w - 1) / 2) - 1 > ROOMY ? Math.floor((w - 3) / 2) : Math.floor((w - 1) / 2);
    const sw = w - 2 * side, s0 = a + side;
    stubs.push({ c0: s0, c1: s0 + sw, r0: 0, r1: start(tiers - 1) + CABIN_ROWS - 1 });
    for (let t = 0; t < tiers; t++) {
      cabins.push({ c0: a, c1: s0, r0: start(t), r1: end(t) });
      cabins.push({ c0: s0 + sw, c1: b, r0: start(t), r1: end(t) });
    }
  }
  return { stubs, cabins };
}

/**
 * A barracks' cabin block, each cabin its spec: a bed and a locker, or a bunk where there are fewer cabins than sleepers.
 * Null when the floor is too small, or the cabins would not sleep the barracks' crew.
 */
export function cabinsFor(barracks: RoomSpec, len: number, rows: number): { stubs: Rect[]; cabins: { rect: Rect; spec: RoomSpec }[] } | null {
  const b = cabinBlock(len, rows);
  const sleepers = barracks.mods.reduce((n, m) => n + (m === SLEEPER.def ? SLEEPER.sleepers : m === 'module.bed' ? 1 : 0), 0);
  if (!b || b.cabins.length * SLEEPER.sleepers < sleepers) return null;
  const bed = b.cabins.length >= sleepers ? 'module.bed' : SLEEPER.def;
  return { stubs: b.stubs, cabins: b.cabins.map((rect) => ({ rect, spec: { role: 'quarters', mods: [bed, 'module.storage_locker'], w: rect.c1 - rect.c0, h: CABIN_ROWS, cabin: true, cabins: false } })) };
}
