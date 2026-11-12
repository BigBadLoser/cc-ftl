import type { RoomSpec } from '../plan';
import { DOCK_DEPTH, K, line, type Site } from '../stationFlowKit';
import { SOLID } from '../stationRegions';
import type { Dir } from './types';

/**
 * The arm: the one structural element behind street, wing and spine. A straight street from the court outward in one
 * of four directions, with frontage on both sides: inside the ring, and (when it runs out) through the band's depth and
 * beyond the hull as a wing. Everything here is written in the arm's own frame (u outward from the centre, v across),
 * so the four directions share one piece of code.
 */

export interface ArmPlan {
  dir: Dir;
  width: 2 | 3;
  /** Rooms lining the part inside the ring, in order from the court (a market's shops first). */
  inner: RoomSpec[];
  /** Filler offered to the street's court end (shops): as many as still leave room for `inner`. */
  fill: RoomSpec[];
  /** Controlled: a public stub, a gate, then a street of its own that stops short of the ring. */
  gated: boolean;
  /** How far the street runs: only as far as its rooms, to the ring, or out through the hull. */
  reach: 'short' | 'ring' | 'out';
  /** Rooms lining the wing (the band's depth and beyond the hull). */
  outer: RoomSpec[];
  docks: RoomSpec[];
  /** A customs gate at the wing's foot. */
  customs: boolean;
  /** The department of the gated street or the wing, for the sheets. */
  dept?: string;
}

export interface ArmBuilt {
  ok: boolean;
  why: string;
  /** Street tiles (along the arm) with no room on either side, inside the ring. */
  bare: number;
  /** Tiles the wing stands out past the hull line. */
  out: number;
  /** The rooms that found no place, when it failed. */
  rest: RoomSpec[];
  /** Filler rooms placed. */
  filled: number;
}

interface Frame { axis: 'x' | 'y'; dir: 1 | -1; at: (u: number) => number; tile: (u: number, v: number) => [number, number]; rect: (u0: number, u1: number, v0: number, v1: number) => [number, number, number, number] }
/** North and south share their across coordinate, east and west theirs, so a street through the centre runs straight. */
const FRAME: Record<Dir, Frame> = {
  n: { axis: 'y', dir: -1, at: (u) => -1 - u, tile: (u, v) => [v, -1 - u], rect: (u0, u1, v0, v1) => [v0, -u1, v1, -u0] },
  s: { axis: 'y', dir: 1, at: (u) => u, tile: (u, v) => [v, u], rect: (u0, u1, v0, v1) => [v0, u0, v1, u1] },
  e: { axis: 'x', dir: 1, at: (u) => u, tile: (u, v) => [u, v], rect: (u0, u1, v0, v1) => [u0, v0, u1, v1] },
  w: { axis: 'x', dir: -1, at: (u) => -1 - u, tile: (u, v) => [-1 - u, v], rect: (u0, u1, v0, v1) => [-u1, v0, -u0, v1] },
};
/** Which way a wall on side `side` of an arm faces, and so whether an airlock may stand in it (never east: fit.ts). */
const faces = (dir: Dir, side: -1 | 1): Dir => (dir === 'n' || dir === 's' ? (side < 0 ? 'w' : 'e') : side < 0 ? 'n' : 's');

/** Rooms dealt to the two sides of a street, each next one to the shorter side, order kept. */
function sides(rooms: readonly RoomSpec[]): [RoomSpec[], RoomSpec[]] {
  const out: [RoomSpec[], RoomSpec[]] = [[], []];
  const len = [0, 0];
  for (const r of rooms) {
    const k = (len[0] as number) <= (len[1] as number) ? 0 : 1;
    out[k].push(r);
    len[k] = (len[k] as number) + r.w + 1;
  }
  return out;
}

/**
 * Build one arm on the site; `c` is the court's half-size (the arm starts at its edge). Its filler is tried from all of
 * it down to none, the grid put back between tries, until the rooms it must hold fit.
 */
export function buildArm(s: Site, c: number, arm: ArmPlan): ArmBuilt {
  for (let k = arm.fill.length; ; k--) {
    const m = s.g.mark();
    const r = buildOne(s, c, { ...arm, inner: [...arm.fill.slice(0, k), ...arm.inner] });
    if (r.ok || k === 0) return { ...r, filled: k };
    s.g.reset(m);
  }
}

function buildOne(s: Site, c: number, arm: ArmPlan): ArmBuilt {
  const { g } = s, f = FRAME[arm.dir];
  const [v0, v1] = arm.width === 3 ? [-1, 2] : [-1, 1];
  const depthAt = (u: number): number => s.depth(...f.tile(u, 0));
  let uWall = c;
  while (depthAt(uWall) > 3) uWall++; // the ring's inner wall
  let uRing = uWall;
  while (depthAt(uRing) === 3) uRing++;
  let uBand = uRing;
  while (depthAt(uBand) > 0) uBand++; // the first tile outside the ring
  const uHull = s.R;
  const toU = (at: number): number => (f.dir > 0 ? at : -1 - at);
  const street = (id: number, u0: number, u1: number, w0 = v0, w1 = v1): void => g.street(id, ...f.rect(u0, u1, w0, w1));
  // A row of rooms along one side from u. When the first will not fit (another arm's rooms hold the corner by the
  // court) it starts a few tiles further out; of the starts that fit, the first that builds no solid wall block where
  // it meets its neighbours. `upTo`: the row runs up to this wall when it ends a few tiles short of it (its last room
  // takes the gap), so no pocket is left between the last room and the ring.
  const lining = (specs: RoomSpec[], side: -1 | 1, from: number, o: Parameters<typeof line>[7], upTo?: number): { rest: RoomSpec[]; end: number; start: number } => {
    if (specs.length === 0) return { rest: [], end: from, start: from };
    const edge = side < 0 ? v0 - 1 : v1;
    // The quarter this row stands in, a little over: where it can meet anything.
    const box = f.rect(c - 3, uBand + 2, side < 0 ? v0 - 30 : v0 - 3, side < 0 ? v1 + 3 : v1 + 30);
    const before = g.blocks(...box);
    const tryAt = (u: number): { rest: RoomSpec[]; end: number; blocks: number } => {
      const m = g.mark();
      let r = line(s, specs, f.axis, f.dir, f.at(u), edge, side, o);
      const gap = upTo === undefined ? 0 : upTo - toU(r.at);
      if (r.rest.length === 0 && gap > 0 && gap <= 4) {
        g.reset(m);
        const last = specs[specs.length - 1] as RoomSpec;
        r = line(s, [...specs.slice(0, -1), { ...last, w: last.w + gap }], f.axis, f.dir, f.at(u), edge, side, o);
        if (r.rest.length > 0) { g.reset(m); r = line(s, specs, f.axis, f.dir, f.at(u), edge, side, o); }
      }
      return { rest: r.rest, end: toU(r.at), blocks: g.blocks(...box) - before };
    };
    let first = -1;
    for (let u = from; u <= from + 12; u++) {
      const m = g.mark();
      const r = tryAt(u);
      if (r.rest.length === 0 && r.blocks <= 0) return { rest: [], end: r.end, start: u };
      if (r.rest.length === 0 && first < 0) first = u;
      g.reset(m);
    }
    // None clean: the first that fits, else as much of the row as goes in at the start.
    const r = tryAt(first < 0 ? from : first);
    return { rest: r.rest, end: r.end, start: first < 0 ? from : first };
  };
  const fail = (what: string, rest: RoomSpec[]): ArmBuilt => ({ ok: false, why: `${arm.dir} arm ${what}: no room for ${rest.map((r) => `${r.role} ${r.w}x${r.h}`).join(', ')}`, bare: 0, out: 0, rest, filled: 0 });
  // A dead-end street ends in a room across its end: its biggest, when there are enough others to line the sides.
  const dead = arm.gated || arm.reach === 'short';
  const capOf = dead && arm.inner.length >= 3 ? [...arm.inner].filter((r) => r.role !== 'shop').sort((a, b) => b.w * b.h - a.w * a.h)[0] : undefined;
  // Rooms stand long side to the street, but for a controlled street (short of frontage by nature) and any room too
  // long for the street it is on: those turn their short side to it and run deep.
  const turned = (r: RoomSpec, deep: boolean): boolean => r.w > r.h && (deep || r.w + 2 > (uWall - c) / 2);
  const lineRooms = (deep: boolean): RoomSpec[] => arm.inner.filter((r) => r !== capOf).map((r) => (turned(r, deep) ? { ...r, w: r.h, h: r.w } : r));
  const [inL, inR] = sides(lineRooms(arm.gated));
  const need = Math.max(inL.reduce((n, r) => n + r.w + 1, 0), inR.reduce((n, r) => n + r.w + 1, 0));
  let bare = 0;
  // The end room: its long side across the street, centred on it, opening onto the street's end.
  const cap = (hallId: number, end: number): boolean => {
    if (!capOf) return true;
    const along = Math.min(capOf.w, capOf.h) + 2, across = Math.max(capOf.w, capOf.h) + 2;
    const w0 = Math.floor((v0 + v1) / 2) - Math.floor(across / 2);
    const [x0, y0, x1, y1] = f.rect(end, end + along, w0, w0 + across);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (!s.free(x, y)) return false;
    g.rect(g.room(capOf.role, { spec: capOf, access: [hallId] }), x0, y0, x1, y1);
    return true;
  };

  if (arm.gated) {
    // A two-tile public stub off the court, a solid line with one gate, then the department's own street. The gate
    // stands between two halls, so the fit-out's archway pass leaves it a door.
    const stub = g.hall(), own = g.hall('hall', arm.dept);
    const end = Math.min(c + 3 + need + 1, uWall);
    street(own, c + 3, end);
    street(stub, c, c + 2);
    g.rect(SOLID, ...f.rect(c + 2, c + 3, v0, v1));
    g.gate(...f.tile(c + 2, 0));
    for (const [list, side] of [[inL, -1], [inR, 1]] as const) {
      const r = lining(list, side, c + 3, { access: [own] });
      if (r.rest.length > 0) return fail('(gated)', r.rest);
    }
    if (!cap(own, end)) return fail('(gated) end', [capOf as RoomSpec]);
    return { ok: true, why: '', bare: 0, out: 0, rest: [], filled: 0 };
  }

  const hall = g.hall();
  const innerEnd = arm.reach === 'short' ? Math.min(c + need + 2, uWall) : uRing;
  street(hall, c, innerEnd);
  let lined = c;
  for (const [list, side] of [[inL, -1], [inR, 1]] as const) {
    const r = lining(list, side, c, {}, arm.reach === 'short' ? undefined : uWall);
    if (r.rest.length > 0) return fail('inside the ring', r.rest);
    lined = Math.max(lined, r.end);
  }
  bare = Math.max(0, Math.min(innerEnd, uWall) - lined);
  if (arm.reach === 'short' && !cap(hall, innerEnd)) return fail('end', [capOf as RoomSpec]);
  if (arm.reach !== 'out') return { ok: true, why: '', bare, out: 0, rest: [], filled: 0 };

  // The wing: from just outside the ring, through the band's depth and out past the hull.
  const wing = g.hall('hall', arm.dept);
  const start = uBand + (arm.customs ? 1 : 0);
  const flank = arm.dir === 'e' || arm.dir === 'w'; // docks on the flanks (they face north and south); else across the tip
  const [outL, outR] = sides(arm.outer);
  const rowOf = (list: RoomSpec[]): number => list.reduce((n, r) => n + r.w + 1, 0);
  // One depth for both rows: a dock's on a wing with flank docks, else the deepest room's short side (5 to 7).
  const floorDepth = flank && arm.docks.length > 0 ? DOCK_DEPTH - 2 : Math.max(5, Math.min(7, Math.max(0, ...arm.outer.map((r) => Math.min(r.w, r.h)))));
  // A wing reads as one: at least two lattice steps past the hull, both rows the same length (the last room of the
  // shorter row is stretched to it).
  const shaped = (list: RoomSpec[]): RoomSpec[] => list.map((r) => (r.role === 'dock' ? r : { ...r, w: Math.max(3, Math.ceil((r.w * r.h) / floorDepth)), h: floorDepth }));
  const rows = [shaped(outL), shaped(outR)];
  // The rows start at the band's first tile (their near wall is the ring's), whatever the street does at its foot.
  const tip = Math.max(uBand + 1 + Math.max(rowOf(rows[0] as RoomSpec[]), rowOf(rows[1] as RoomSpec[])), uHull + (flank ? 0 : 2 * K));
  for (const row of rows) {
    const last = row[row.length - 1];
    if (last) row[row.length - 1] = { ...last, w: last.w + Math.max(0, tip - (uBand + 1 + rowOf(row))) };
  }
  const dockSpec = (d: RoomSpec): RoomSpec => ({ ...d, w: 3, h: DOCK_DEPTH - 2, ...(arm.dept ? { dept: arm.dept } : {}) });
  let end = tip;
  if (flank) {
    // Flank docks: the last rooms of each row, past the hull line, on the sides an airlock may face.
    const legal = ([-1, 1] as const).filter((side) => faces(arm.dir, side) !== 'e');
    const share = legal.map((_, k) => arm.docks.filter((__, i) => i % legal.length === k).map(dockSpec));
    for (const [k, side] of legal.entries()) (rows[side < 0 ? 0 : 1] as RoomSpec[]).push(...(share[k] as RoomSpec[]));
    end = uBand + 1 + Math.max(rowOf(rows[0] as RoomSpec[]), rowOf(rows[1] as RoomSpec[]));
  }
  street(wing, start, end);
  if (arm.customs) {
    g.rect(SOLID, ...f.rect(uBand, uBand + 1, v0, v1));
    g.gate(...f.tile(uBand, 0));
  }
  for (const [k, side] of ([-1, 1] as const).entries()) {
    const r = line(s, rows[k] as RoomSpec[], f.axis, f.dir, f.at(uBand), side < 0 ? v0 - 1 : v1, side, { access: [wing], free: s.freeOut });
    if (r.rest.length > 0) return fail('wing', r.rest);
  }
  if (!flank && arm.docks.length > 0) {
    // Tip docks: a lobby across the end of the street, the docks beyond it facing outward.
    const half = Math.ceil((arm.docks.length * K) / 2);
    street(wing, end, end + 3, -half, half);
    g.rect(SOLID, ...f.rect(end + 3, end + 3 + DOCK_DEPTH, -half - 1, -half));
    g.rect(SOLID, ...f.rect(end + 3, end + 3 + DOCK_DEPTH, half, half + 1));
    arm.docks.forEach((d, i) => g.rect(g.room('dock', { spec: d, access: [wing], dept: arm.dept }), ...f.rect(end + 3, end + 3 + DOCK_DEPTH, -half + i * K, -half + (i + 1) * K)));
    end += 3 + DOCK_DEPTH;
  }
  return { ok: true, why: '', bare, out: end - uHull, rest: [], filled: 0 };
}
