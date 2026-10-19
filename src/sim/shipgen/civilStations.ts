import { localBuilder } from './blocks';
import type { Builder, Part, Rect, Side } from './builder';
import { truss } from './civilFrames';
import { dockSpec, engineSpec, reactorSpec, type RoomSpec } from './plan';
import type { Rng } from '../rng';

/**
 * Station builders with no bow or stern. Engines are small thruster rooms on east faces inside the structure (the
 * engine art faces +x only), never a drive section.
 *   ring     rooms round a corridor ring with an empty centre, a small hub joined by two to four spokes
 *   lattice  modules on a 2D grid with gaps, linked by short tubes (walkable) and beams (structure)
 */

const run = (specs: RoomSpec[]): number => specs.reduce((t, r) => t + r.w + 1, 1);

/** Deal rooms to sides, each to the side whose run is shortest so far (weighted per side: lopsided rims). */
function deal(rooms: RoomSpec[], sides: number, weight: number[]): RoomSpec[][] {
  const out: RoomSpec[][] = Array.from({ length: sides }, () => []);
  for (const r of [...rooms].sort((a, b) => b.w - a.w)) {
    const score = (k: number): number => run(out[k] as RoomSpec[]) * (weight[k] ?? 1);
    const i = out.reduce((best, _, k) => (score(k) < score(best) ? k : best), 0);
    (out[i] as RoomSpec[]).push(r);
  }
  return out;
}

export interface RingOpts {
  /** Extra half-size of the ring beyond what its rooms need. */
  extra: number;
  /** Rim weights for top, bottom and west (higher = fewer rooms there). */
  weight: number[];
  /** Rooms also lining the inside of the top and bottom runs (a thicker ring wall). */
  inner: boolean;
}

/** Ring station: a square corridor ring round an empty centre, rooms outboard, the hub joined by spokes. */
export function ringStation(rng: Rng, hub: RoomSpec, rooms: RoomSpec[], engines: number, reactors: number, spokes: Side[], o: RingOpts): Builder | null {
  const b = localBuilder(rng);
  const docks = [dockSpec(), dockSpec()];
  const [top, bot, wst] = deal(rooms, 3, o.weight) as [RoomSpec[], RoomSpec[], RoomSpec[]];
  top.push(docks[0] as RoomSpec);
  bot.push(docks[1] as RoomSpec);
  const east: RoomSpec[] = [];
  for (let i = 0; i < engines; i++) east.push(engineSpec(1, 'w'));
  for (let k = reactors; k > 0; k -= 2) east.push({ ...reactorSpec(Math.min(2, k)), w: 3, h: 2 * Math.min(2, k) + 1 });
  const along = (specs: RoomSpec[]): number => specs.reduce((t, r) => t + r.h + 1, 1);
  const hw = Math.max(hub.w, hub.h);
  const S = Math.max(9, Math.ceil(run(top) / 2) + 1, Math.ceil(run(bot) / 2) + 1, Math.ceil((along(wst) + 4) / 2), Math.ceil((along(east) + 4) / 2), Math.ceil(hw / 2) + 5) + o.extra;
  const T = b.place({ x: -S, y: -S, w: 2 * S, h: 3 }, 'hall');
  const B = b.place({ x: -S, y: S - 3, w: 2 * S, h: 3 }, 'hall');
  const W = b.place({ x: -S, y: -S + 2, w: 3, h: 2 * S - 4 }, 'hall');
  const E = b.place({ x: S - 3, y: -S + 2, w: 3, h: 2 * S - 4 }, 'hall');
  if (!T || !B || !W || !E) return null;
  for (const [a, c] of [[T, W], [T, E], [B, W], [B, E]] as const) if (!b.door(a, c)) return null;
  const h = b.place({ x: -Math.floor(hw / 2) - 1, y: -1 - Math.ceil(hub.h / 2), w: hw + 2, h: hub.h + 2 }, hub.role, { ...hub, w: hw });
  if (!h) return null;
  const spoke: Record<Side, Rect> = {
    w: { x: -S + 2, y: -2, w: h.x - (-S + 2) + 1, h: 3 },
    e: { x: h.x + h.w - 1, y: -2, w: S - 3 - (h.x + h.w - 1) + 1, h: 3 },
    n: { x: -1, y: -S + 2, w: 3, h: h.y - (-S + 2) + 1 },
    s: { x: -1, y: h.y + h.h - 1, w: 3, h: S - 3 - (h.y + h.h - 1) + 1 },
  };
  const ring: Record<Side, Part> = { n: T, s: B, w: W, e: E };
  for (const d of spokes) {
    const p = b.place(spoke[d], 'hall');
    if (!p || !b.door(p, h) || !b.door(p, ring[d])) return null;
  }
  // A thicker wall: some rooms move to the inside of the top and bottom runs, in the corners clear of the spokes.
  if (o.inner) {
    for (const [p, list, side] of [[T, top, 's'], [B, bot, 'n']] as const) {
      const keep: RoomSpec[] = [];
      let at = 2;
      for (const r of list) {
        const room = r.role !== 'dock' && at + r.w + 2 < S - 3 ? b.attach(p, side, { ...r, h: Math.min(r.h, 3) }, at) : null;
        if (room) at += r.w + 1;
        else keep.push(r);
      }
      list.splice(0, list.length, ...keep);
    }
  }
  // Rooms outboard, centred on each face.
  b.strip(T, 'n', top, T.x + Math.max(0, Math.floor((2 * S - run(top)) / 2)));
  b.strip(B, 's', bot, B.x + Math.max(0, Math.floor((2 * S - run(bot)) / 2)));
  const side = (p: Part, s: Side, specs: RoomSpec[]): boolean => {
    let y = Math.max(2, Math.floor((p.h - along(specs)) / 2));
    for (const r of specs) {
      const spec = s === 'w' && r.role === 'dock' ? { ...r, w: 4, h: 1 } : r;
      if (!b.attach(p, s, spec, y)) return false;
      y += spec.h + 1;
    }
    return true;
  };
  return side(W, 'w', wst) && side(E, 'e', east) ? b : null;
}

/**
 * Lattice station: modules (one room each) on a grid with gaps; each row's modules linked by tubes, rows linked by
 * one tube each, every other neighbour pair by a beam. Thrusters in the east column; airlocks on top and bottom.
 */
export interface LatticeOpts {
  gx: number;
  gy: number;
  /** Columns per row relative to a square grid (wide or tall lattices). */
  spread: number;
  /** Chance a cell stays empty (a long tube spans it). */
  holes: number;
  /** Extra module size. */
  pad: number;
}

export function latticeStation(rng: Rng, modsIn: RoomSpec[], engines: number, o: LatticeOpts): Builder | null {
  const b = localBuilder(rng);
  const { gx, gy } = o;
  const mods = modsIn.map((r) => ({ ...r, w: r.w + rng.int(0, o.pad), h: r.h + rng.int(0, Math.min(1, o.pad)) }));
  const eng = Array.from({ length: engines }, () => engineSpec(1, 'w'));
  const C = Math.max(2, Math.round(Math.sqrt((mods.length + eng.length) * o.spread)));
  // Rows fill west to east; a thruster closes each of the first rows (east-most there, so it faces open space).
  const grid: (RoomSpec | null)[][] = [];
  for (let k = 0, r = 0; k < mods.length || r < eng.length; r++) {
    const row: (RoomSpec | null)[] = mods.slice(k, k + (r < eng.length ? C - 1 : C));
    k += row.length;
    if (row.length === 0 && r >= eng.length) break;
    // Missing cells: an empty slot inside the row (never its first), a long tube spans it.
    for (let i = row.length - 1; i > 0; i--) if (rng.chance(o.holes)) row.splice(i, 0, null);
    grid.push(r < eng.length ? [...row, eng[r] as RoomSpec] : row);
  }
  const R = grid.length;
  const all = [...mods, ...eng];
  const C2 = Math.max(...grid.map((row) => row.length));
  const PX = Math.max(...all.map((r) => r.w)) + 2 + gx;
  const PY = Math.max(...all.map((r) => r.h)) + 2 + gy;
  const isEng = (r: number, c: number): boolean => grid[r]?.[c]?.role === 'engine';
  const oy = -Math.round((R * PY) / 2);
  const parts: (Part | null)[][] = grid.map((row, r) => row.map((s, c) => {
    if (!s) return null;
    const cx = c * PX + Math.floor(PX / 2);
    const cy = oy + r * PY + Math.floor(PY / 2);
    return b.place({ x: cx - Math.ceil((s.w + 2) / 2), y: cy - Math.ceil((s.h + 2) / 2), w: s.w + 2, h: s.h + 2 }, s.role, s);
  }));
  const at = (r: number, c: number): Part | null => parts[r]?.[c] ?? null;
  for (let r = 0; r < R; r++) {
    const cols = (grid[r] ?? []).map((_, c) => c).filter((c) => at(r, c));
    for (let i = 0; i + 1 < cols.length; i++) {
      const a = at(r, cols[i] as number) as Part;
      const z = at(r, cols[i + 1] as number) as Part;
      const cy = oy + r * PY + Math.floor(PY / 2);
      const t = b.place({ x: a.x + a.w - 1, y: cy - 2, w: z.x - (a.x + a.w - 1) + 1, h: 3 }, 'hall');
      if (!t || !b.door(a, t) || !b.door(t, z)) return null;
    }
  }
  for (let r = 0; r + 1 < R; r++) {
    const cols = Array.from({ length: C2 }, (_, c) => c).filter((c) => at(r, c) && at(r + 1, c) && !isEng(r, c) && !isEng(r + 1, c));
    if (cols.length === 0) return null;
    const link = rng.pick(cols);
    for (const c of cols) {
      const a = at(r, c) as Part;
      const z = at(r + 1, c) as Part;
      const cx = c * PX + Math.floor(PX / 2);
      if (c === link) {
        const t = b.place({ x: cx - 1, y: a.y + a.h - 1, w: 3, h: z.y - (a.y + a.h - 1) + 1 }, 'hall');
        if (!t || !b.door(a, t) || !b.door(t, z)) return null;
      } else truss(b, cx, a.y + a.h, 1, z.y - (a.y + a.h), `brace${r}${c}`);
    }
  }
  // Airlocks: one on top of a top-row module, one under a bottom-row module.
  const topRow = (parts[0] ?? []).filter((p, c): p is Part => !!p && !isEng(0, c));
  const botRow = (parts[R - 1] ?? []).filter((p, c): p is Part => !!p && !isEng(R - 1, c));
  const t0 = topRow[0];
  const b0 = botRow[botRow.length - 1] ?? botRow[0];
  if (!t0 || !b0 || !b.attach(t0, 'n', dockSpec(), Math.floor(t0.w / 2) - 1)) return null;
  if (!b.attach(b0, 's', dockSpec(), Math.floor(b0.w / 2) - 1)) return null;
  return b;
}
