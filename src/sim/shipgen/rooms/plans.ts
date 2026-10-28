import type { Rng } from '../../rng';
import { accessTile, rotatedSize } from '../../modules/footprint';
import type { ModuleDef } from '../../registry';
import type { Layout, PlacedModule } from '../layout';

/**
 * Whole-room plans: a room laid out at once from a repeating unit, instead of module by module (furnish.ts), so its
 * furniture lines up. A plan works on a plain rectangle only; it places everything or nothing, and the caller falls back
 * to the arrangement's steps when it returns false.
 *
 * Dorm: beds in an unbroken row along one wall, each head to the wall with its locker beside it, skipping door
 * approaches; the rest on the opposite wall when the room is deep enough for an aisle between; life support against an
 * end wall; with `desk`, a table and chair at the other end.
 */

type Side = 'n' | 's' | 'w' | 'e';
interface Box { x0: number; y0: number; x1: number; y1: number }

/** Rotation that turns a 1 x 2 piece's long side into the room from wall `side` (head to the wall). */
const INTO: Record<Side, number> = { n: 0, s: 2, w: 1, e: 3 };
/** Rotation that lays a 1 x 2 piece along wall `side`. */
const ALONG: Record<Side, number> = { n: 1, s: 3, w: 0, e: 2 };

/** The tile `d` steps in from wall `side` at position `p` along it. */
function at(b: Box, side: Side, p: number, d: number): { x: number; y: number } {
  if (side === 'n') return { x: b.x0 + p, y: b.y0 + d };
  if (side === 's') return { x: b.x0 + p, y: b.y1 - d };
  if (side === 'w') return { x: b.x0 + d, y: b.y0 + p };
  return { x: b.x1 - d, y: b.y0 + p };
}
const runOf = (b: Box, side: Side): number => (side === 'n' || side === 's' ? b.x1 - b.x0 + 1 : b.y1 - b.y0 + 1);
const depthOf = (b: Box, side: Side): number => (side === 'n' || side === 's' ? b.y1 - b.y0 + 1 : b.x1 - b.x0 + 1);
const OPP: Record<Side, Side> = { n: 's', s: 'n', w: 'e', e: 'w' };
/** A chair's rotation facing wall `side` (chairs face north at 0, east 1, south 2, west 3). */
const FACE: Record<Side, number> = { n: 0, e: 1, s: 2, w: 3 };

/** Top-left of a piece of `def` at rotation `rot` whose footprint starts at tile t (growing into the room from `side`). */
function anchor(def: ModuleDef, rot: number, side: Side, t: { x: number; y: number }): { x: number; y: number } {
  const [w, h] = rotatedSize(def, rot);
  return { x: side === 'e' ? t.x - w + 1 : t.x, y: side === 's' ? t.y - h + 1 : t.y };
}

/** Lay out a dorm in `room`; false (and nothing placed) when it does not fit. */
export function planDorm(lay: Layout, rng: Rng, room: number, beds: number, extras: { lifeSupport: number; desk: boolean }): boolean {
  const tiles = lay.roomTiles(room);
  if (tiles.length === 0) return false;
  const xs = tiles.map((i) => i % lay.w), ys = tiles.map((i) => Math.floor(i / lay.w));
  const b: Box = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
  if ((b.x1 - b.x0 + 1) * (b.y1 - b.y0 + 1) !== tiles.length) return false;
  const bed = lay.defs['module.bed'], locker = lay.defs['module.storage_locker'], ls = lay.defs['module.lifeSupport'];
  if (!bed || !locker || !ls) return false;
  const base = lay.unreached();
  const n0 = lay.modules.length;
  const put = (pm: PlacedModule): boolean => {
    if (lay.fitError(pm.def, pm.x, pm.y, pm.rot, room)) return false;
    lay.push(pm);
    if (lay.unreached() > base) { lay.pop(); return false; }
    return true;
  };
  const undo = (): false => { while (lay.modules.length > n0) lay.pop(); return false; };
  // A locker against wall `side` facing into the room.
  const lockerAt = (side: Side, t: { x: number; y: number }): PlacedModule | null => {
    for (let rot = 0; rot < 4; rot++) {
      const a = accessTile(locker, t.x, t.y, rot);
      if (a && Math.abs(a.x - t.x) + Math.abs(a.y - t.y) === 1 && (side === 'n' ? a.y > t.y : side === 's' ? a.y < t.y : side === 'w' ? a.x > t.x : a.x < t.x)) return { def: 'module.storage_locker', x: t.x, y: t.y, rot };
    }
    return null;
  };
  // Walls for the rows: the longer ones first (fewer doors first among equals), deep enough for a bed and an aisle.
  const sides = (['n', 's', 'w', 'e'] as Side[]).filter((s) => depthOf(b, s) >= 3)
    .sort((p, q) => runOf(b, q) - runOf(b, p) || rng.next() - 0.5);
  if (sides.length === 0) return false;
  const first = sides[0] as Side;
  const rows: Side[] = [first, ...(depthOf(b, first) >= 5 ? [OPP[first]] : [])];
  // A locker beside every bed's head; where the walls are too short for that, one between every pair, then none.
  const lay1 = (gap: number): boolean => {
    let left = beds;
    rows.forEach((side, ri) => {
      const run = runOf(b, side);
      const fromEnd = rng.chance(0.5);
      // The beds shared out evenly between the rows (the first row takes any odd one).
      const want = Math.ceil(left / (rows.length - ri));
      let here = 0;
      for (let k = 0, inRun = 0; k < run && left > 0 && here < want;) {
        const p = fromEnd ? run - 1 - k : k;
        const brot = INTO[side];
        const ba = anchor(bed, brot, side, at(b, side, p, 0));
        if (!put({ def: 'module.bed', x: ba.x, y: ba.y, rot: brot })) { k++; continue; }
        left--;
        here++;
        k++;
        if (++inRun % gap !== 0) continue;
        // The locker beside the bed's head, on the side the row is heading.
        const q = fromEnd ? run - 1 - k : k;
        const lk = q >= 0 && q < run ? lockerAt(side, at(b, side, q, 0)) : null;
        if (lk && put(lk)) k++;
      }
    });
    return left === 0;
  };
  let fits = false;
  for (const gap of [1, 2, Infinity]) {
    if (lay1(gap)) { fits = true; break; }
    undo();
  }
  if (!fits) return false;
  // Life support against an end wall, along it; the desk against the other end.
  const ends = (['n', 's', 'w', 'e'] as Side[]).filter((s) => !rows.includes(s));
  for (let i = 0; i < extras.lifeSupport; i++) {
    let done = false;
    for (const side of ends) {
      const run = runOf(b, side);
      for (const p of [Math.floor(run / 2) - 1, 0, run - 2, Math.floor(run / 2)]) {
        if (p < 0 || p > run - 2) continue;
        const rot = ALONG[side];
        const a = anchor(ls, rot, side, at(b, side, p, 0));
        if (put({ def: 'module.lifeSupport', x: a.x, y: a.y, rot })) { done = true; break; }
      }
      if (done) break;
    }
    if (!done) return undo();
  }
  if (extras.desk) {
    const table = lay.defs['module.mess_table'];
    for (const side of [...ends].reverse()) {
      if (!table) break;
      const run = runOf(b, side);
      const rot = side === 'n' || side === 's' ? 0 : 1;
      const p = Math.max(0, Math.floor(run / 2) - 1);
      const t = anchor(table, rot, side, at(b, side, p, 0));
      if (!put({ def: 'module.mess_table', x: t.x, y: t.y, rot })) continue;
      // Its chair in front, turned to face it (toward the wall).
      const [tw, th] = rotatedSize(table, rot);
      const seat = side === 'n' ? { x: t.x, y: t.y + th } : side === 's' ? { x: t.x, y: t.y - 1 } : side === 'w' ? { x: t.x + tw, y: t.y } : { x: t.x - 1, y: t.y };
      put({ def: 'module.chair', x: seat.x, y: seat.y, rot: FACE[side] });
      break;
    }
  }
  return true;
}
