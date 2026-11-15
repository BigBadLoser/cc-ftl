/**
 * Machine rooms and holds of a station (#460): the core vault, the battery room, warehouses and crate rooms, the shuttle
 * hangar and the pod deck. Room frame of parts.ts: (0, 0) the top-left floor tile, the door under the bottom wall at column d.
 * Stores place their planned modules first and then as many more of the same as the floor suits (place.ts keeps those
 * only where they fit and the room still works).
 */
import type { Piece } from './check';
import { BT, CN, P, count, range } from './parts';
import type { Ctx } from './rules';

export const AI = 'module.aiCore', PDF = 'module.pointDefense', CR = 'module.storage', VB = 'module.vehicle_bay', PB = 'module.pod_bay';

/** Columns of n two-wide machines in a w-wide row, edge to edge (roof machines keep a tile apart) with a tile off each wall when the room is wide enough. */
const spreadX = (w: number, n: number): number[] => {
  if (n === 1) return [Math.floor((w - 2) / 2)];
  const m = w >= 3 * n + 1 ? 1 : 0;
  return range(0, n - 1, 1).map((i) => m + Math.round((i * (w - 2 * m - 2)) / (n - 1)));
};

/** CR: the core vault: the AI core in the middle of the back wall, the point defence either side, spread across, a clear floor to the door. */
export function core(c: Ctx): Piece[] {
  const pd = count(c.need, PDF), left = Math.ceil(pd / 2);
  const order = [...Array<string>(left).fill(PDF), AI, ...Array<string>(pd - left).fill(PDF)];
  return spreadX(c.w, order.length).map((x, i) => P(order[i] as string, x, 0, 0));
}

/** BA: the battery room: the console in the middle of the back wall, the cells in a bank round it, in rows with a lane between, as many as they need. */
export function bank(c: Ctx): Piece[] {
  const { w, h } = c, cells = count(c.need, BT), cx = Math.floor(w / 2), rows = Math.max(1, Math.ceil(cells / Math.max(1, w - 1)));
  if (2 * rows - 2 > h - 2) return [];
  const per = Math.ceil(cells / rows), out: Piece[] = count(c.need, CN) > 0 ? [P(CN, cx, 0, 0)] : [];
  let left = cells;
  for (let y = 0; y < rows; y++) {
    const n = Math.min(per, left), xs: number[] = [];
    for (let k = 1; xs.length < n; k++) { xs.push(cx - k); if (xs.length < n) xs.push(cx + k); }
    // Keep the bank inside the walls: slide it toward the side with room.
    const lo = Math.min(...xs), shift = lo < 0 ? -lo : Math.max(...xs) > w - 1 ? w - 1 - Math.max(...xs) : 0;
    out.push(...xs.map((x) => P(BT, x + shift, 2 * y, 0)));
    left -= n;
  }
  return out;
}

/**
 * CG: a warehouse or crate room: rows of crates in stacks of four at most with a cross lane between, back to back round an
 * aisle (the back wall's row faces south, the next one north), the door wall's row only in a room three or four deep. The
 * planned crates take the first places; a roomier hold fills up to a quarter of its floor.
 */
export function crates(c: Ctx): Piece[] {
  const { w, h, d } = c, planned = count(c.need, CR);
  const rows: { y: number; rot: number }[] = [];
  for (let y = 0; y + 1 <= h - 2; y += 4) {
    rows.push({ y, rot: 0 });
    if (y + 2 <= h - 3) rows.push({ y: y + 2, rot: 2 });
  }
  if (h >= 3 && h <= 4) rows.push({ y: h - 1, rot: 2 });
  const m = Math.max(1, Math.ceil((w + 1) / 5)), cols = w - (m - 1), xs: number[] = [];
  for (let s = 0, x = 0; s < m; s++) {
    const len = Math.floor(cols / m) + (s < cols % m ? 1 : 0);
    for (let i = 0; i < len; i++) xs.push(x + i);
    x += len + 1;
  }
  const clear = new Set<string>([`${d},${h - 1}`, ...(c.doors ?? []).map((e) => `${e.x},${e.y}`)]);
  const slots = rows.flatMap((r) => xs.map((x) => P(CR, x, r.y, r.rot))).filter((p) => !clear.has(`${p.x},${p.y}`));
  return slots.slice(0, Math.max(planned, Math.min(slots.length, Math.round(w * h * 0.25))));
}

/** SH: the shuttle hangar: the bay on the back wall at the side away from the door, its boarding strip along the long side. */
export function shuttle(c: Ctx): Piece[] {
  return [P(VB, c.d >= c.w >> 1 ? 0 : c.w - 5, 0, 0)];
}

/** Rows a pod deck of n bays and h deep has: two past four bays (or where one row is too long for the room) where it is deep enough. */
const podRows = (n: number, w: number, h: number): number => ((n > 4 || 4 * n > w) && n > 1 && h >= 8 ? 2 : 1);

/** Whether the pod bays fit: each with the tile beside it crew unload at, in rows, a walkway below. */
export const podsFit = (n: number, w: number, h: number): boolean => n > 0 && 4 * Math.ceil(n / podRows(n, w, h)) <= w && h >= (podRows(n, w, h) === 1 ? 4 : 8);

/** PB: the pod deck: bays in a row (two rows when deep), each with its unload tile on the east side, a walkway between and below. */
export function pods(c: Ctx): Piece[] {
  const n = count(c.need, PB), per = Math.ceil(n / podRows(n, c.w, c.h));
  const xs = per === 1 ? [Math.floor((c.w - 4) / 2)] : range(0, per - 1, 1).map((i) => Math.round((i * (c.w - 4)) / (per - 1)));
  return range(0, n - 1, 1).map((i) => P(PB, xs[i % per] as number, 4 * Math.floor(i / per), 0));
}
