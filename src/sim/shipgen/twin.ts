import type { ModuleDef } from '../registry';
import { rotatedSize } from '../modules/footprint';
import type { Layout } from './layout';

/**
 * Twin rooms (#581): two rooms that are each other's mirror across a row (a ship's engine rooms either side of its
 * axis) furnish alike, the second as the first mirrored, so a ship's drive is symmetric.
 */

/** The row sum `y + y'` that mirrors room `a`'s tiles onto room `b`'s exactly, or null. */
export function mirrorOf(lay: Layout, a: number, b: number): number | null {
  const ta = lay.roomTiles(a), tb = new Set(lay.roomTiles(b));
  if (ta.length === 0 || ta.length !== tb.size) return null;
  const ys = (ts: Iterable<number>): number[] => [...ts].map((i) => Math.floor(i / lay.w));
  const sum = Math.min(...ys(ta)) + Math.max(...ys(tb));
  return ta.every((i) => tb.has((sum - Math.floor(i / lay.w)) * lay.w + (i % lay.w))) ? sum : null;
}

/** Facing mirrored across a row: south and north swap, east and west stay. */
const FLIP = [2, 1, 0, 3];

/**
 * Room `room` furnished as modules `from` mirrored across rows summing to `sum`: the indices it placed, or null (and
 * the layout as it was) where one of them does not fit there.
 */
export function furnishMirrored(lay: Layout, room: number, from: readonly number[], sum: number, defs: Record<string, ModuleDef>): number[] | null {
  const start = lay.modules.length, got: number[] = [];
  for (const k of from) {
    const m = lay.modules[k], def = m && defs[m.def];
    if (!m || !def) continue;
    const rot = FLIP[m.rot % 4] as number, [, h] = rotatedSize(def, m.rot);
    const y = sum - (m.y + h - 1);
    if (lay.fitError(m.def, m.x, y, rot, room) !== null) { while (lay.modules.length > start) lay.pop(); return null; }
    lay.push({ def: m.def, x: m.x, y, rot });
    got.push(lay.modules.length - 1);
  }
  return got;
}
