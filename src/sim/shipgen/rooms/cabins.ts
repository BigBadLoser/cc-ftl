import type { Rng } from '../../rng';
import type { RoomSpec } from '../plan';
import type { RoomRole } from '../types';

/**
 * Cabins: a quarters room off the navy is divided into one-bed cabins off a hallway (after Shadows of Doubt's interior
 * generator, which draws dividing walls and a hallway inside each address). Quarters are either one person's cabin or a
 * shared bunk room: a room with no place for cabins stays a bunk room (rooms/plans.ts lays its beds out).
 *
 * The cabins take a rectangle inside the room: a hallway one or two tiles wide along its length and, on one side of it (both,
 * when deep enough), a row of cabins, each at least 2 wide and 3 deep, behind a wall with its own door onto the
 * hallway. Whatever of the room lies outside the rectangle joins the hallway as a lobby. Every door the room had must
 * open onto the hallway or lobby, which must stay one piece; lobby floor touching a cabin (a diagonal room's wedge) is
 * walled off.
 * Of the rectangles that work, the one closest to 2-3 wide, 3-4 deep cabins wins (a two-wide hallway when the room has
 * life support to keep there). The hallway keeps the room's other planned modules (life support), unless it is one tile
 * wide: then the last cabin does. Each cabin gets one bed. Walls and doors carry no room (-1), as everywhere.
 */

export interface Split { rows: string[]; roomOf: Int16Array; roles: RoomRole[]; specs: (RoomSpec | undefined)[]; cabins: number }

interface CabinRow { wall: number; from: number; to: number; n: number }
interface Option { x0: number; y0: number; L: number; D: number; along: 0 | 1; hw: number; rows: CabinRow[]; walls: number[]; score: number }

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** Split the bunk rooms that fit into cabins; returns new rows and room tables (the old room keeps no tiles). */
export function splitCabins(rows: string[], roomOf: Int16Array, w: number, roles: readonly RoomRole[], specs: readonly (RoomSpec | undefined)[], rng: Rng): Split {
  const cells = rows.map((r) => Array.from({ length: w }, (_, x) => r[x] ?? '.'));
  const room = Int16Array.from(roomOf);
  const outRoles = [...roles];
  const outSpecs = [...specs];
  let cabins = 0;
  for (let id = 0; id < roles.length; id++) {
    const spec = specs[id];
    if (roles[id] !== 'quarters' || !spec || spec.sealed) continue;
    const beds = spec.mods.filter((m) => m === 'module.bed').length;
    if (beds < 2) continue;
    const others = spec.mods.filter((m) => m !== 'module.bed');
    const opt = bestOption(cells, room, w, id, beds, others.length > 0);
    if (!opt) continue;
    const { x0, y0, L, along } = opt;
    const xy = (u: number, v: number): { x: number; y: number } => (along === 0 ? { x: x0 + u, y: y0 + v } : { x: x0 + v, y: y0 + u });
    const set = (u: number, v: number, c: string, r: number): void => {
      const p = xy(u, v);
      (cells[p.y] as string[])[p.x] = c;
      room[p.y * w + p.x] = r;
    };
    // The hallway (and lobby): a new room with the old one's other modules.
    const hall = outRoles.length;
    outRoles.push('hall');
    outSpecs.push({ ...spec, role: 'hall', mods: opt.hw > 1 ? others : [] });
    for (let i = 0; i < room.length; i++) if (room[i] === id) room[i] = hall;
    for (const j of opt.walls) { (cells[Math.floor(j / w)] as string[])[j % w] = '#'; room[j] = -1; }
    for (const r of opt.rows) {
      for (let u = 0; u < L; u++) set(u, r.wall, '#', -1);
      // n cabins share the row's length: (n - 1) dividing walls, the rest split evenly.
      const free = L - (r.n - 1);
      let u = 0;
      for (let k = 0; k < r.n; k++) {
        const width = Math.floor(free / r.n) + (k < free % r.n ? 1 : 0);
        const cab = outRoles.length;
        outRoles.push('quarters');
        const last = opt.hw === 1 && r === opt.rows[opt.rows.length - 1] && k === r.n - 1;
        outSpecs.push({ ...spec, mods: ['module.bed', ...(last ? others : [])], w: width, h: r.to - r.from + 1 });
        for (let du = 0; du < width; du++) for (let v = r.from; v <= r.to; v++) set(u + du, v, '_', cab);
        set(u + rng.int(0, width - 1), r.wall, 'D', -1);
        u += width;
        if (k < r.n - 1) { for (let v = r.from; v <= r.to; v++) set(u, v, '#', -1); u++; }
        cabins++;
      }
    }
    outSpecs[id] = undefined;
  }
  return { rows: cells.map((r, y) => r.join('').slice(0, (rows[y] ?? '').length)), roomOf: room, roles: outRoles, specs: outSpecs, cabins };
}

/** The best rectangle of room `id` for `beds` cabins, or null. */
function bestOption(cells: string[][], room: Int16Array, w: number, id: number, beds: number, kit: boolean): Option | null {
  const h = cells.length;
  const tiles: number[] = [];
  for (let i = 0; i < room.length; i++) if (room[i] === id && cells[Math.floor(i / w)]?.[i % w] === '_') tiles.push(i);
  if (tiles.length < beds * 9) return null;
  const inRoom = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && room[y * w + x] === id && cells[y]?.[x] === '_';
  const xs = tiles.map((i) => i % w), ys = tiles.map((i) => Math.floor(i / w));
  const bx0 = Math.min(...xs), bx1 = Math.max(...xs), by0 = Math.min(...ys), by1 = Math.max(...ys);
  // Prefix sums over the bounding box, for "is this rectangle all room floor".
  const BW = bx1 - bx0 + 2;
  const S = new Int32Array(BW * (by1 - by0 + 2));
  for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
    const i = (y - by0 + 1) * BW + (x - bx0 + 1);
    S[i] = (inRoom(x, y) ? 1 : 0) + (S[i - 1] as number) + (S[i - BW] as number) - (S[i - BW - 1] as number);
  }
  const full = (x0: number, y0: number, x1: number, y1: number): boolean => {
    const a = (yy: number, xx: number): number => S[(yy - by0) * BW + (xx - bx0)] as number;
    return a(y1 + 1, x1 + 1) - a(y0, x1 + 1) - a(y1 + 1, x0) + a(y0, x0) === (x1 - x0 + 1) * (y1 - y0 + 1);
  };
  // The tiles beside each door of the room: they must stay hallway.
  const doorSide: number[] = [];
  for (const i of tiles) for (const [dx, dy] of N4) if (cells[Math.floor(i / w) + dy]?.[(i % w) + dx] === 'D') doorSide.push(i);
  let best: Option | null = null;
  for (let y0 = by0; y0 <= by1; y0++) for (let x0 = bx0; x0 <= bx1; x0++) for (let y1 = y0; y1 <= by1; y1++) for (let x1 = x0; x1 <= bx1; x1++) {
    if (!full(x0, y0, x1, y1)) break; // a wider one would not be either
    for (const along of [0, 1] as const) {
      const L = along === 0 ? x1 - x0 + 1 : y1 - y0 + 1;
      const D = along === 0 ? y1 - y0 + 1 : x1 - x0 + 1;
      const cap = Math.floor((L + 1) / 3);
      const plans: { hw: number; rows: CabinRow[] }[] = [];
      for (const hw of [1, 2]) {
        // One row: the hallway along either long wall, the cabins (D - hw - 1 deep, 3 to 5) behind a wall.
        if (D - hw - 1 >= 3 && D - hw - 1 <= 5 && cap >= beds) {
          plans.push({ hw, rows: [{ wall: hw, from: hw + 1, to: D - 1, n: beds }] });
          plans.push({ hw, rows: [{ wall: D - hw - 1, from: 0, to: D - hw - 2, n: beds }] });
        }
        // Two rows: the hallway down the middle.
        const c1 = Math.floor((D - 2 - hw) / 2);
        const n1 = Math.ceil(beds / 2);
        if (c1 >= 3 && c1 <= 5 && D - 2 - hw - c1 >= 3 && D - 2 - hw - c1 <= 5 && n1 <= cap) {
          plans.push({ hw, rows: [{ wall: c1, from: 0, to: c1 - 1, n: n1 }, { wall: c1 + hw + 1, from: c1 + hw + 2, to: D - 1, n: beds - n1 }] });
        }
      }
      for (const p of plans) {
        const toWorld = (u: number, v: number): number => (along === 0 ? (y0 + v) * w + x0 + u : (y0 + u) * w + x0 + v);
        // Hallway and lobby: the room less the cabins and their walls.
        const inRect = (i: number): boolean => { const x = i % w, y = Math.floor(i / w); return x >= x0 && x <= x1 && y >= y0 && y <= y1; };
        const taken = new Set<number>();
        for (const r of p.rows) for (let u = 0; u < L; u++) for (let v = Math.min(r.wall, r.from); v <= Math.max(r.wall, r.to); v++) taken.add(toWorld(u, v));
        const hallSet = new Set(tiles.filter((i) => !taken.has(i)));
        if (!doorSide.every((i) => hallSet.has(i))) continue;
        // The cabins meet the lobby only through walls: lobby floor beside a cabin tile (diagonals too) is walled off.
        const walls = new Set<number>();
        for (const r of p.rows) for (let u = 0; u < L; u++) for (let v = r.from; v <= r.to; v++) {
          const i = toWorld(u, v);
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const j = i + dy * w + dx;
            if (!inRect(j) && inRoom(j % w, Math.floor(j / w))) walls.add(j);
          }
        }
        for (const j of walls) hallSet.delete(j);
        if (!doorSide.every((i) => hallSet.has(i))) continue;
        // The hallway is one piece.
        const start = hallSet.values().next().value as number;
        const seen = new Set([start]);
        const stack = [start];
        while (stack.length > 0) {
          const i = stack.pop() as number;
          for (const [dx, dy] of N4) { const j = i + dy * w + dx; if (hallSet.has(j) && !seen.has(j)) { seen.add(j); stack.push(j); } }
        }
        if (seen.size !== hallSet.size) continue;
        const depth = p.rows[0] ? p.rows[0].to - p.rows[0].from + 1 : 0;
        const width = (L - ((p.rows[0]?.n ?? 1) - 1)) / (p.rows[0]?.n ?? 1);
        const score = -Math.abs(width - 2.5) - Math.abs(depth - 3.5) - (hallSet.size - p.hw * L) * 0.02 - walls.size * 0.1 + (kit && p.hw === 2 ? 1.5 : 0);
        if (!best || score > best.score) best = { x0, y0, L, D, along, hw: p.hw, rows: p.rows, walls: [...walls], score };
      }
    }
  }
  return best;
}
