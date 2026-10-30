import type { ModuleDef } from '../../registry';
import { accessTile, footprintTiles, openTilesOf, type Tile } from '../../modules/footprint';
import { CHAIR, SLEEP, bedSides, chairFront } from '../useTiles';

/**
 * Room quality: how well a furnished room is arranged, past being usable (rooms/usage.ts checks that). The terms are
 * Merrell et al. 2011's interior design guidelines, measured on the tile grid:
 *
 * - circulation: the walk between a room's entrances against the straight line (1 = straight; Merrell's circulation
 *   term). Rooms with one entrance score 1.
 * - pockets: the share of free floor that is a dead-end pocket (one or no free neighbour), nobody's use tile (an
 *   access tile, a seat, a bed side) and on no walk from an entrance to one: floor left over between pieces, the
 *   "chair behind a locker" kind of waste. A tight room's walkway ending at an access tile is not a pocket.
 * - alignment: the share of standing pieces set against a wall or lined up with a neighbour (an edge on the same line,
 *   within three tiles): Merrell's alignment term.
 * - balance: how far the pieces' centre of mass sits off the room's centre, over the room's radius (0 = centred;
 *   Merrell's visual balance). Rooms with fewer than three pieces score 0.
 * - density and openness, reported only: the share of floor under pieces, and the largest clear rectangle over the
 *   floor (a court wants it high, a hold low).
 * - rect and ragged, reported only (the room's shape, as the layout handed it over): floor over its bounding box (1 = a
 *   rectangle), and the floor's edge against walls over its bounding box's perimeter (1 = straight walls; a sawtooth
 *   diagonal wall runs it up).
 *
 * `score` folds them into 0..100 (weights provisional, for comparing one generator against another over many seeds).
 * Lights, deck marks and other walk-over pieces are not pieces here.
 */

export interface RoomQuality {
  room: number;
  floor: number;
  pieces: number;
  circulation: number;
  pockets: number;
  alignment: number;
  balance: number;
  density: number;
  openness: number;
  rect: number;
  ragged: number;
  score: number;
}

interface Mod { def: string; x: number; y: number; rot: number }

/** A furnished layout: rows (as in a ShipTemplate), its modules, and the room of each tile. */
export interface LayoutView { rows: readonly string[]; modules: readonly Mod[]; roomOf: Int16Array; defs: Record<string, ModuleDef> }

const N4: readonly Tile[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

/** Occupancy of a layout: the module on each tile, which tiles block walking (beds count), and every piece's use tiles. */
export function occupancy(v: LayoutView): { W: number; H: number; cell: (i: number) => string; occ: Int32Array; blocks: Uint8Array; use: Uint8Array } {
  const H = v.rows.length;
  const W = Math.max(...v.rows.map((r) => r.length));
  const cell = (i: number): string => v.rows[Math.floor(i / W)]?.[i % W] ?? '.';
  const occ = new Int32Array(W * H).fill(-1);
  const blocks = new Uint8Array(W * H);
  const use = new Uint8Array(W * H);
  const mark = (t: Tile): void => { if (t.x >= 0 && t.y >= 0 && t.x < W && t.y < H) use[t.y * W + t.x] = 1; };
  v.modules.forEach((m, k) => {
    const d = v.defs[m.def];
    if (!d) return;
    const open = openTilesOf(d, m.x, m.y, m.rot);
    for (const t of footprintTiles(d, m.x, m.y, m.rot)) {
      if (t.x < 0 || t.y < 0 || t.x >= W || t.y >= H) continue;
      const i = t.y * W + t.x;
      occ[i] = k;
      if ((d.solid || SLEEP.has(m.def)) && !open.some((o) => o.x === t.x && o.y === t.y)) blocks[i] = 1;
    }
    const a = accessTile(d, m.x, m.y, m.rot);
    if (a) mark(a);
    if (m.def === CHAIR) { mark({ x: m.x, y: m.y }); mark(chairFront(m.x, m.y, m.rot)); }
    if (SLEEP.has(m.def)) for (const s of bedSides(d, m.x, m.y, m.rot)) for (const t of s) mark(t);
  });
  return { W, H, cell, occ, blocks, use };
}

/** Quality of every room with floor (rooms crew never enter included: callers filter by role). */
export function roomQuality(v: LayoutView): RoomQuality[] {
  const { W, H, cell, occ, blocks, use } = occupancy(v);
  const free = (i: number): boolean => (cell(i) === '_' || cell(i) === 'D') && blocks[i] === 0;
  const nb = (i: number): number[] => {
    const x = i % W, y = Math.floor(i / W);
    return N4.filter((d) => x + d.x >= 0 && y + d.y >= 0 && x + d.x < W && y + d.y < H).map((d) => (y + d.y) * W + x + d.x);
  };
  const byRoom = new Map<number, number[]>();
  for (let i = 0; i < W * H; i++) {
    const r = v.roomOf[i] ?? -1;
    if (r >= 0 && cell(i) === '_') (byRoom.get(r) ?? byRoom.set(r, []).get(r) as number[]).push(i);
  }
  const out: RoomQuality[] = [];
  for (const [room, tiles] of byRoom) {
    const inRoom = new Set(tiles);
    // Pieces: standing modules with a tile in the room.
    const pieces = new Map<number, Tile[]>();
    for (const i of tiles) {
      const k = occ[i] as number;
      if (k < 0 || blocks[i] === 0) continue;
      (pieces.get(k) ?? pieces.set(k, []).get(k) as Tile[]).push({ x: i % W, y: Math.floor(i / W) });
    }
    const blocked = tiles.filter((i) => blocks[i] === 1);
    const freeTiles = tiles.filter(free);
    // Circulation: entrances are door tiles beside the room, or another room's floor straight across (an archway).
    const entries = new Set<number>();
    for (const i of tiles) for (const n of nb(i)) {
      if (cell(n) === 'D' || (cell(n) === '_' && (v.roomOf[n] ?? -1) !== room)) entries.add(i);
    }
    const ent = [...entries].filter(free);
    // Pockets: dead-end floor nobody stands on or walks through (off every shortest walk from the entrances to a use tile).
    const needed = new Set<number>();
    if (ent.length > 0) {
      const prev = new Map<number, number>(ent.map((i) => [i, -1]));
      const q = [...ent];
      for (let h = 0; h < q.length; h++) for (const n of nb(q[h] as number)) {
        if (!prev.has(n) && inRoom.has(n) && free(n)) { prev.set(n, q[h] as number); q.push(n); }
      }
      for (const i of freeTiles) if (use[i] === 1) for (let c = i; c >= 0 && !needed.has(c); c = prev.get(c) ?? -1) needed.add(c);
    }
    const pocket = freeTiles.filter((i) => use[i] === 0 && !needed.has(i) && nb(i).filter(free).length <= 1).length;
    let detour = 0, pairs = 0;
    for (let a = 0; a < ent.length; a++) {
      const dist = new Map<number, number>([[ent[a] as number, 0]]);
      const q = [ent[a] as number];
      for (let h = 0; h < q.length; h++) for (const n of nb(q[h] as number)) {
        if (!dist.has(n) && inRoom.has(n) && free(n)) { dist.set(n, (dist.get(q[h] as number) as number) + 1); q.push(n); }
      }
      for (let b = a + 1; b < ent.length; b++) {
        const p = ent[a] as number, o = ent[b] as number;
        const straight = Math.abs((p % W) - (o % W)) + Math.abs(Math.floor(p / W) - Math.floor(o / W));
        const d = dist.get(o);
        if (straight < 2 || d === undefined) continue;
        detour += d / straight;
        pairs++;
      }
    }
    // Alignment.
    const wallBy = (t: Tile): boolean => N4.some((d) => cell((t.y + d.y) * W + t.x + d.x) === '#');
    const box = [...pieces.values()].map((ts) => ({ ts, x0: Math.min(...ts.map((t) => t.x)), x1: Math.max(...ts.map((t) => t.x)), y0: Math.min(...ts.map((t) => t.y)), y1: Math.max(...ts.map((t) => t.y)) }));
    const aligned = box.filter((b) => b.ts.some(wallBy) || box.some((o) => o !== b
      && Math.max(o.x0 - b.x1, b.x0 - o.x1, o.y0 - b.y1, b.y0 - o.y1) <= 3
      && (o.x0 === b.x0 || o.x1 === b.x1 || o.y0 === b.y0 || o.y1 === b.y1))).length;
    // Balance.
    const cx = tiles.reduce((s, i) => s + (i % W), 0) / tiles.length, cy = tiles.reduce((s, i) => s + Math.floor(i / W), 0) / tiles.length;
    const mx = blocked.reduce((s, i) => s + (i % W), 0) / Math.max(1, blocked.length), my = blocked.reduce((s, i) => s + Math.floor(i / W), 0) / Math.max(1, blocked.length);
    const balance = pieces.size >= 3 ? Math.min(1, Math.hypot(mx - cx, my - cy) / Math.sqrt(tiles.length / Math.PI)) : 0;
    const q: RoomQuality = {
      room, floor: tiles.length, pieces: pieces.size,
      circulation: pairs > 0 ? detour / pairs : 1,
      pockets: freeTiles.length > 0 ? pocket / freeTiles.length : 0,
      alignment: box.length > 0 ? aligned / box.length : 1,
      balance,
      density: blocked.length / tiles.length,
      openness: largestRect(tiles, W, (i) => free(i) && inRoom.has(i)) / tiles.length,
      ...shape(tiles, W, inRoom),
      score: 0,
    };
    q.score = Math.round(100 * (0.35 * Math.max(0, 1 - 4 * q.pockets) + 0.25 * q.alignment + 0.2 / q.circulation + 0.2 * (1 - q.balance)));
    out.push(q);
  }
  return out.sort((a, b) => a.room - b.room);
}

/** A room's shape: floor over its bounding box, and its outline's length over the box's perimeter. */
function shape(tiles: readonly number[], W: number, inRoom: ReadonlySet<number>): { rect: number; ragged: number } {
  const xs = tiles.map((i) => i % W), ys = tiles.map((i) => Math.floor(i / W));
  const bw = Math.max(...xs) - Math.min(...xs) + 1, bh = Math.max(...ys) - Math.min(...ys) + 1;
  let edge = 0;
  for (const i of tiles) for (const d of [1, -1, W, -W]) if (!inRoom.has(i + d) && !(d === 1 && i % W === W - 1) && !(d === -1 && i % W === 0)) edge++;
  return { rect: tiles.length / (bw * bh), ragged: edge / (2 * (bw + bh)) };
}

/** Area of the largest all-`ok` rectangle among `tiles` (histogram method over their bounding box). */
function largestRect(tiles: readonly number[], W: number, ok: (i: number) => boolean): number {
  const xs = tiles.map((i) => i % W), ys = tiles.map((i) => Math.floor(i / W));
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const h = new Array<number>(x1 - x0 + 1).fill(0);
  let best = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) h[x - x0] = ok(y * W + x) ? (h[x - x0] as number) + 1 : 0;
    const st: number[] = [];
    for (let k = 0; k <= h.length; k++) {
      const v = k < h.length ? (h[k] as number) : 0;
      while (st.length > 0 && (h[st[st.length - 1] as number] as number) >= v) {
        const top = h[st.pop() as number] as number;
        const left = st.length > 0 ? (st[st.length - 1] as number) + 1 : 0;
        best = Math.max(best, top * (k - left));
      }
      st.push(k);
    }
  }
  return best;
}
