/**
 * Social rooms (furnishing mock round 2, tools/shipgen/mocks/furnishingRooms.ts): the chief's office, the gym, a hall
 * street, customs and the parade hall. Room frame of parts.ts: (0, 0) the top-left floor tile, the door under the
 * bottom wall at column d. Chairs face their table (r0 -y, r1 +x, r2 +y, r3 -x).
 */
import type { Piece } from './check';
import { BE, C, CN, EX, P, PL, RK, T, VM, VR, count, range } from './parts';
import type { Ctx } from './rules';

/** CO: a desk with its chair across it, centred; a planter in each back corner, a rack in the bottom-left corner (the desk and its chair wall off the right, so the way round stays along the bottom row). */
export function co(c: Ctx): Piece[] {
  const { w, h, d } = c, tx = Math.floor((w - 2) / 2), y = Math.floor((h - 3) / 2);
  return [P(C, tx, y, 2), P(T, tx, y + 1, 0), P(C, tx + 1, y + 2, 0), P(PL, 0, 0, 0), P(PL, w - 1, 0, 0), ...(tx >= 2 && d >= 2 ? [P(RK, 0, h - 1, 2)] : [])];
}

/** GY: sparring droids in a row a tile off the back wall, three tiles apart and centred; a bench in each bottom corner, a vending machine in the back corner. */
export function gy(c: Ctx): Piece[] {
  const { w, h, d } = c, n = count(c.need, EX), start = Math.floor((w - (3 * (n - 1) + 1)) / 2);
  const benches = [0, w - 2].filter((x) => d < x || d >= x + 2).map((x) => P(BE, x, h - 1, 2));
  return [...range(0, n - 1, 1).map((i) => P(EX, start + 3 * i, 1, 0)), ...benches, P(VM, w - 1, 0, 0)];
}

/** HL: a street's wall: planters round a bench, then a pair of vending machines, repeating every ten tiles along the back wall. */
export function hl(c: Ctx): Piece[] {
  const out: Piece[] = [];
  for (let x = 0; x + 3 < c.w; x += 10) {
    out.push(P(PL, x, 0, 0), P(BE, x + 1, 0, 0), P(PL, x + 3, 0, 0));
    if (x + 6 < c.w) out.push(P(VM, x + 6, 0, 0));
    if (x + 7 < c.w) out.push(P(VR, x + 7, 0, 0));
  }
  return out;
}

/** CU: a customs desk with its two chairs below it, a bench and planter at one end and a planter at the other. */
export function cu(c: Ctx): Piece[] {
  const { w } = c, tx = Math.floor(w / 2) - 2;
  return [P(T, tx, 0, 0), P(C, tx, 1, 0), P(C, tx + 1, 1, 0), P(BE, w - 3, 0, 0), P(PL, w - 1, 0, 0), P(PL, 0, 0, 0)];
}

/** PZ: a bench on each side of two planters in the middle (a pinwheel), a planter in each back corner, a vending machine in each bottom corner. */
export function pz(c: Ctx): Piece[] {
  const { w, h } = c, x = Math.floor(w / 2), y = Math.floor(h / 2);
  return [
    P(PL, 0, 0, 0), P(PL, w - 1, 0, 0), P(PL, x - 1, y, 0), P(PL, x + 1, y, 0),
    P(BE, x - 1, y - 2, 0), P(BE, x, y + 2, 2), P(BE, x - 3, y, 3), P(BE, x + 3, y, 1),
    P(VM, 0, h - 1, 2), P(VR, w - 1, h - 1, 2),
  ];
}

/**
 * MK: a market hall, every piece on a wall so the ways between the doors stay open (the doorways, three wide and two
 * deep, stay clear): a bench with a planter either side of it mid-way down each side wall, a trade console at each
 * back corner (a tile in; a side wall where a door is), a bench with planters on the back wall between them, a vending machine either side of the door, planters in the corners.
 */
export function mk(c: Ctx): Piece[] {
  const { w, h } = c, doors = [{ x: c.d, y: h - 1 }, ...(c.doors ?? [])];
  const used = new Set<string>(), out: Piece[] = [];
  const bad = (x: number, y: number): boolean => x < 0 || y < 0 || x >= w || y >= h || used.has(`${x},${y}`) || (c.cut ?? []).some((t) => t.x === x && t.y === y)
    || doors.some((t) => (t.y === 0 || t.y === h - 1 ? Math.abs(x - t.x) <= 1 && Math.abs(y - t.y) <= 2 : Math.abs(y - t.y) <= 1 && Math.abs(x - t.x) <= 2));
  const add = (def: string, x: number, y: number, rot: number, fw = 1, fh = 1): boolean => {
    const tiles: [number, number][] = [];
    for (let j = 0; j < fh; j++) for (let i = 0; i < fw; i++) tiles.push([x + i, y + j]);
    if (tiles.some(([a, b]) => bad(a, b))) return false;
    for (const [a, b] of tiles) used.add(`${a},${b}`);
    out.push(P(def, x, y, rot));
    return true;
  };
  // The side walls' spots for a bench, nearest the middle first; a mirrored pair where both stand.
  const spots = range(2, h - 4, 1).sort((a, b) => Math.abs(a + 0.5 - h / 2) - Math.abs(b + 0.5 - h / 2));
  const nBench = count(c.need, BE) || 2;
  // Two on each side wall where the wall is long (a bench, its planters either side, a gap), the first nearest the middle.
  const rows = h >= 10 ? 2 : 1, side = { left: [] as number[], right: [] as number[] };
  const bench = (x: number, rot: number, mine: number[]): void => {
    if (mine.length >= rows) return;
    const y = spots.find((t) => mine.every((m) => Math.abs(t - m) >= 5) && add(BE, x, t, rot, 1, 2));
    if (y !== undefined) { mine.push(y); add(PL, x, y - 1, 0); add(PL, x, y + 2, 0); }
  };
  for (let k = 0; k < rows; k++) { bench(0, 3, side.left); if (nBench > 1) bench(w - 1, 1, side.right); }
  // Consoles: the back corners (a tile in), else down the side walls.
  const slots: [number, number, number][] = [[1, 0, 0], [w - 2, 0, 0], [0, 2, 3], [w - 1, 2, 1], [0, h - 4, 3], [w - 1, h - 4, 1]];
  let placed = 0;
  for (const [x, y, r] of slots) if (placed < count(c.need, CN) && add(CN, x, y, r)) placed++;
  // The back wall between the consoles: a bench with a planter either side (unless a door is there).
  const bx = (w >> 1) - 1;
  if (add(BE, bx, 0, 0, 2, 1)) { add(PL, bx - 1, 0, 0); add(PL, bx + 2, 0, 0); }
  add(PL, 0, 0, 0); add(PL, w - 1, 0, 0);
  add(VM, 1, h - 1, 2); add(VR, w - 2, h - 1, 2);
  add(PL, 0, h - 1, 0); add(PL, w - 1, h - 1, 0);
  return out;
}
