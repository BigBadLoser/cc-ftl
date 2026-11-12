import type { RoomSpec } from '../plan';
import { DOCK_DEPTH, line } from './lattice';
import { cabinsWithin } from './quarters';
import { SOLID, SPACE } from './regions';
import { at, facing, key, rect, sides, type Built, type Ctx, type Dir, type Frame, type Port } from './model';

/**
 * The elements that stand anywhere: a corridor (Connection), a block (a box Section: a short street with rooms both
 * sides, the standard module), and a single room on a port (a dock, a pod). Each paints at a port's frame and returns
 * its own ports, or null when it does not fit there, having painted nothing it keeps (the assembler puts the grid back).
 */

const SIDE_DIR = (f: Frame, side: -1 | 1): Dir => facing(f, side);

/** Whether a two-wide street can run u0 <= u < u1 from a frame: open ground, but for the host's margin at the start. */
function clear(c: Ctx, f: Frame, u0: number, u1: number, v0 = -1, v1 = 1): boolean {
  for (let u = u0; u < u1; u++) for (let v = v0; v < v1; v++) {
    const [x, y] = at(f, u, v), a = c.g.at(x, y);
    if (!c.inside(x, y) || c.reserved.has(key(x, y)) || !(a === SPACE || (a === SOLID && u === u0))) return false;
  }
  return true;
}

export interface CorridorOpts {
  length: number;
  /** A gate at its foot: what lies beyond is controlled. */
  gated?: boolean;
  /** Side ports every this many tiles (0: none). */
  pitch?: number;
  /** A dogleg: halfway along it steps this many tiles sideways (to +v or -v, two at least) and carries on. No side ports. */
  shift?: number;
}

/** A corridor from a port: a two-wide hall, ports at its end and along both sides. */
export function corridor(c: Ctx, port: Port, o: CorridorOpts): Built | null {
  const f = port.frame, g = c.g;
  if (o.shift) return dogleg(c, port, Math.max(4, o.length), o.shift);
  if (!clear(c, f, 0, o.length)) return null;
  const hall = g.hall();
  const from = o.gated ? 1 : 0;
  g.street(hall, ...rect(f, from, o.length, -1, 1));
  if (o.gated) {
    g.rect(SOLID, ...rect(f, 0, 1, -2, 2));
    g.gate(...at(f, 0, 0));
  }
  const ports: Built['ports'] = [{ frame: { x: at(f, o.length, 0)[0], y: at(f, o.length, 0)[1], dir: f.dir }, kind: 'end', hall, along: o.length, side: 0 }];
  if (o.pitch) {
    for (let u = from + 2; u + 2 <= o.length; u += o.pitch) for (const side of [-1, 1] as const) {
      const [x, y] = at(f, u, side < 0 ? -2 : 1);
      ports.push({ frame: { x, y, dir: SIDE_DIR(f, side) }, kind: 'side', hall, along: u, side });
    }
  }
  return { ports, regions: [hall], box: rect(f, 0, o.length + 1, -2, 2), run: { frame: f, length: o.length, hall } };
}

/** A corridor that steps sideways halfway: out, across, and on in the same heading, `shift` tiles over. */
function dogleg(c: Ctx, port: Port, length: number, shift: number): Built | null {
  const f = port.frame, g = c.g;
  const t = Math.max(1, (length - 2) >> 1);
  const legs: [number, number, number, number][] = [[0, t + 2, -1, 1], [t, t + 2, Math.min(-1, shift - 1), Math.max(1, shift + 1)], [t, length, shift - 1, shift + 1]];
  if (!clear(c, f, 0, t + 2)) return null;
  for (const [u0, u1, v0, v1] of legs.slice(1)) for (let u = u0; u < u1; u++) for (let v = v0; v < v1; v++) {
    const [x, y] = at(f, u, v);
    if (!c.inside(x, y) || c.reserved.has(key(x, y)) || (g.at(x, y) !== SPACE && !(u < t + 2 && v >= -1 && v < 1))) return null;
  }
  const hall = g.hall();
  for (const [u0, u1, v0, v1] of legs) g.street(hall, ...rect(f, u0, u1, v0, v1));
  const [x, y] = at(f, length, shift), lo = Math.min(-2, shift - 2), hi = Math.max(2, shift + 2);
  return { ports: [{ frame: { x, y, dir: f.dir }, kind: 'end', hall, along: length, side: 0 }], regions: [hall], box: rect(f, 0, length + 1, lo, hi) };
}

/**
 * A hall where streets meet: a room-sized piece of street, `wide` across and `length` along, that the street behind
 * the port runs into. The street beyond leaves it `shift` tiles to one side, `width` wide, and each flank has a port
 * for a wing.
 */
export function concourse(c: Ctx, port: Port, o: { length: number; wide: number; shift: number; width: number }): Built | null {
  const f = port.frame, g = c.g, L = Math.max(4, o.length);
  let lo = Math.min(-1, o.shift - 1), hi = Math.max((port.width ?? 2) - 1, o.shift + o.width - 1);
  const more = Math.max(0, o.wide - (hi - lo));
  lo -= more >> 1; hi += more - (more >> 1);
  for (let u = 0; u < L; u++) for (let v = lo; v < hi; v++) {
    const [x, y] = at(f, u, v), a = g.at(x, y);
    if (!c.inside(x, y) || c.reserved.has(key(x, y)) || !(a === SPACE || (a === SOLID && u === 0))) return null;
  }
  const hall = g.hall('plaza', 'commons');
  g.street(hall, ...rect(f, 0, L, lo, hi));
  const [ex, ey] = at(f, L, o.shift), m = (L >> 1) - 1;
  const ports: Built['ports'] = [{ frame: { x: ex, y: ey, dir: f.dir }, kind: 'end', hall, along: L, side: 0, width: o.width }];
  for (const side of [-1, 1] as const) {
    const v = side < 0 ? lo - 1 : hi, [ax, ay] = at(f, m, v), [bx, by] = at(f, m + 1, v);
    ports.push({ frame: { x: Math.max(ax, bx), y: Math.max(ay, by), dir: facing(f, side) }, kind: 'side', hall, along: m, side, flank: true, node: true });
  }
  return { ports, regions: [hall], box: rect(f, 0, L + 1, lo - 1, hi + 1) };
}

export interface BlockOpts {
  /** One floor depth for both rows (a slab); the rooms' own when not given (staggered bays). */
  rowDepth?: number;
  /** A room stands across the far end (its biggest, or the first of this role); otherwise the street runs through to a port there. */
  cap?: boolean | RoomSpec['role'];
  /** The street's width in tiles (default 2): a main street is wider than a module's. */
  width?: number;
  /** Rooms of these roles stand at the far end of the rows (by the end room, when there is one). */
  far?: readonly RoomSpec['role'][];
  /** Both rows end together (the shorter one's last room is stretched). */
  even?: boolean;
  dept?: string;
  /** Docks stand in its rows at the far end, on the sides an airlock may face, with the space off them kept clear. */
  docks?: readonly RoomSpec[];
  /** A gate across its street at the foot: it joins its host directly and what is in it is controlled. */
  gate?: boolean;
  /**
   * A passage across it, out to both flanks, with a port at each: other sections join its sides. Midway; with 'any'
   * wherever along the block the seed has it (its foot and its far end included); with 'end' after its last rooms,
   * right before the end room when there is one, both rows running up to it; with 'inner' partway down, on each
   * flank whose row has a room either side of it (the other row runs through), or as 'end' when neither has.
   */
  cross?: boolean | 'any' | 'end' | 'inner';
  /** Cabins offered to it: they stand among its rooms, the shorter row first (bunks wherever there is room). */
  bunks?: readonly RoomSpec[];
}

/**
 * A block: the standard module. A street from the port with rooms lining both sides, closed by a room across its end
 * or open to carry on. Its size is its rooms': each room is its floor and its walls, laid out by the shared lining code,
 * so what a block holds is what was drawn, not an estimate.
 */
export function block(c: Ctx, port: Port, rooms: readonly RoomSpec[], o: BlockOpts = {}): Built | null {
  const f = port.frame, g = c.g;
  const docks = o.docks ?? [];
  if (rooms.length + docks.length === 0) return null;
  const bySize = [...rooms].sort((a, b) => b.w * b.h - a.w * a.h);
  const capOf = o.cap && rooms.length >= 3 ? (typeof o.cap === 'string' ? bySize.find((r) => r.role === o.cap) : undefined) ?? bySize[0] : undefined;
  // The street runs v = -1 up to X: two tiles and what a wider one adds, on its +v side.
  const X = Math.max(2, o.width ?? 2) - 2;
  // Long side to the street; one depth for the slab when asked (a room keeps its area). A dock block is a dock deep.
  const depth = docks.length > 0 ? DOCK_DEPTH - 2 : o.rowDepth;
  const farther = (r: RoomSpec): number => (o.far?.includes(r.role) ? 1 : 0);
  const shape = (r: RoomSpec): RoomSpec => (depth ? { ...r, w: Math.max(3, Math.ceil((r.w * r.h) / depth)), h: depth } : r.w >= r.h ? r : { ...r, w: r.h, h: r.w });
  const body = rooms.filter((r) => r !== capOf).sort((p, q) => farther(p) - farther(q)).map(shape);
  // A room's annex stands right after it in its row and opens into it. Quarters are cut into cabins where they stand,
  // a bed each, inside the room's own length: the row is no longer for it and the station no heavier.
  const rows = sides(body).map((row) => row.flatMap((r) => (r.annex ? [r, { ...shape(r.annex), annexed: true }] : [r])).flatMap(cabinsWithin)) as [RoomSpec[], RoomSpec[]];
  // Bunks: each goes into the shorter row, somewhere among its rooms.
  const bunks = o.bunks ?? [];
  for (const b of bunks) {
    const len = (row: RoomSpec[]): number => row.reduce((n, r) => n + r.w + 1, 0);
    const row = len(rows[0]) <= len(rows[1]) ? rows[0] : rows[1];
    const k = c.rng.int(0, row.length);
    row.splice(row[k]?.annexed ? k + 1 : k, 0, depth ? { ...b, h: depth } : b);
  }
  const legal = ([-1, 1] as const).filter((side) => facing(f, side) !== 'e'); // an airlock never faces east
  docks.forEach((d, i) => rows[(legal[i % legal.length] as number) < 0 ? 0 : 1].push({ ...d, w: 3, h: DOCK_DEPTH - 2 }));
  const run = (row: RoomSpec[]): number => row.reduce((n, r) => n + r.w + 1, 1);
  const L0 = Math.max(run(rows[0]), run(rows[1]), 4);
  if (o.even || docks.length > 0) for (const row of rows) {
    const k = row.map((r) => r.role !== 'dock' && !r.cabin && !r.annexed).lastIndexOf(true);
    if (k >= 0) row[k] = { ...(row[k] as RoomSpec), w: (row[k] as RoomSpec).w + L0 - run(row) };
  }
  const hall = g.hall('hall', o.dept ?? rooms[0]?.dept ?? docks[0]?.dept);
  const axis = f.dir === 'e' || f.dir === 'w' ? 'x' : 'y', dir = f.dir === 'e' || f.dir === 's' ? 1 : -1;
  const from = axis === 'x' ? f.x : f.y, across = axis === 'x' ? f.y : f.x;
  const regions = [hall], n0 = g.regions.length;
  const made: { side: -1 | 1; from: number; to: number }[] = [];
  // Rows from u: a deeper room after a shallower one brings a wall of its own, so a staggered row runs a little longer
  // than its rooms add up to, and the street is as long as the rows turn out.
  const lay = (list: RoomSpec[], side: -1 | 1, u: number): number | null => {
    const first = g.regions.length;
    const r = line(c.site, list, axis, dir, from + dir * u, side < 0 ? across - 2 : across + 1 + X, side, { access: [hall], free: c.free });
    made.push({ side, from: first, to: g.regions.length });
    return r.rest.length > 0 ? null : list.length > 0 ? (r.at - from) * dir : u;
  };
  const back = [Math.max(3, ...rows[0].map((r) => r.h)) + 3, Math.max(3, ...rows[1].map((r) => r.h)) + 2 + X];
  // On the flank of another block the rows start a tile out: the first tile is that block's back wall.
  const u0 = port.flank ? 1 : 0;
  // The street is as long as the rows turn out, so it never runs on alone past the last room.
  let L = u0 + 3;
  const ends = [u0, u0];
  // Whether a row's last room reaches its end (not when a passage across the block comes after it).
  const whole = [true, true];
  const ports: Built['ports'] = [], cross: [number, number, number, number][] = [];
  if (o.cross) {
    // First halves, the passage, then the rest.
    const mode = o.cross === 'inner' && rows.every((row) => row.length < 2) ? 'end' : o.cross;
    const where = mode === 'any' || mode === 'inner' ? c.rng.next() : 0.5;
    // Where each row is cut; a row that runs through (no passage on its flank) is cut at its end.
    const through = rows.map((row) => mode === 'inner' && row.length < 2);
    const cut = rows.map((row, k) => (mode === 'end' || through[k] ? row.length : mode === 'inner' ? 1 + Math.floor(where * (row.length - 1)) : mode === 'any' ? Math.round(where * row.length) : Math.ceil(row.length / 2)));
    // A passage never parts an annex from its room: it moves past the annex, or before the room, or that row runs through.
    for (const [k, row] of rows.entries()) {
      const n = cut[k] as number;
      if (n <= 0 || n >= row.length || !row[n]?.annexed) continue;
      if (n + 1 <= (mode === 'inner' ? row.length - 1 : row.length)) cut[k] = n + 1;
      else if (n - 1 >= (mode === 'inner' ? 1 : 0)) cut[k] = n - 1;
      else { through[k] = true; cut[k] = row.length; }
    }
    const e0 = lay(rows[0].slice(0, cut[0]), -1, u0), e1 = lay(rows[1].slice(0, cut[1]), 1, u0);
    if (e0 === null || e1 === null) return null;
    const e = Math.max(through[0] ? 0 : e0, through[1] ? 0 : e1, u0 + 2);
    // Before a passage at the end or partway the shorter row's last room runs on to it: no notch beside the passage.
    if (mode === 'end' || mode === 'inner') for (const [k, side] of ([-1, 1] as const).entries()) {
      const last = made.filter((m) => m.side === side && m.to > m.from).pop(), from = k === 0 ? e0 : e1;
      if (!last || from >= e || through[k]) continue;
      const id = last.to - 1, h = g.regions[id]?.spec?.h ?? 3;
      const box = side < 0 ? rect(f, from, e, -(h + 3), -1) : rect(f, from, e, 1 + X, h + 3 + X);
      let open = true;
      for (let y = box[1]; y < box[3] && open; y++) for (let x = box[0]; x < box[2] && open; x++) open = c.free(x, y);
      if (open) g.rect(id, ...box);
    }
    const lanes = [rect(f, e, e + 2, -(back[0] as number) + 1, -1), rect(f, e, e + 2, 1 + X, back[1] as number)].filter((_b, k) => !through[k]);
    for (const box of lanes) for (let y = box[1]; y < box[3]; y++) for (let x = box[0]; x < box[2]; x++) if (g.at(x, y) !== SPACE || !c.free(x, y)) return null;
    const m0 = through[0] ? e0 : lay(rows[0].slice(cut[0]), -1, e + 2), m1 = through[1] ? e1 : lay(rows[1].slice(cut[1]), 1, e + 2);
    if (m0 === null || m1 === null) return null;
    // An end room stands straight after a passage at the end; otherwise the street runs a tile past the passage.
    L = mode === 'end' && capOf ? e + 2 : Math.max(L, m0, m1, e + 3);
    ends[0] = m0; ends[1] = m1;
    whole[0] = through[0] || rows[0].length > (cut[0] as number); whole[1] = through[1] || rows[1].length > (cut[1] as number);
    cross.push(...lanes);
    for (const [k, side] of ([-1, 1] as const).entries()) {
      if (through[k]) continue;
      const v = side < 0 ? -(back[0] as number) : (back[1] as number);
      const [ax, ay] = at(f, e, v), [bx, by] = at(f, e + 1, v);
      ports.push({ frame: { x: Math.max(ax, bx), y: Math.max(ay, by), dir: facing(f, side) }, kind: 'side', hall, along: e, side, flank: true });
    }
  } else {
    const e0 = lay(rows[0], -1, u0), e1 = lay(rows[1], 1, u0);
    if (e0 === null || e1 === null) return null;
    L = Math.max(L, e0, e1);
    ends[0] = e0; ends[1] = e1;
  }
  if (!clear(c, f, 0, L, -1, 1 + X)) return null;
  // Under an end room the rows end together: the shorter row's last room runs on to the end room, so no notch is
  // left between them.
  if (capOf) for (const [k, side] of ([-1, 1] as const).entries()) {
    const last = made.filter((m) => m.side === side && m.to > m.from).pop();
    const end = ends[k] as number;
    if (!last || end >= L || !whole[k]) continue;
    const id = last.to - 1, h = g.regions[id]?.spec?.h ?? 3;
    const box = side < 0 ? rect(f, end, L, -(h + 3), -1) : rect(f, end, L, 1 + X, h + 3 + X);
    let open = true;
    for (let y = box[1]; y < box[3] && open; y++) for (let x = box[0]; x < box[2] && open; x++) open = c.free(x, y);
    if (open) g.rect(id, ...box);
  }
  g.street(hall, ...rect(f, o.gate ? 1 : 0, L, -1, 1 + X));
  for (const box of cross) g.street(hall, ...box);
  if (o.gate) {
    g.rect(SOLID, ...rect(f, 0, 1, -1, 1 + X));
    g.gate(...at(f, 0, 0));
  }
  let far = L;
  if (capOf) {
    // The end room spans the whole block, back wall to back wall: a head. Narrower, its corners would stand on the
    // last rooms' walls and build them two thick.
    const v0 = -(back[0] as number), v1 = (back[1] as number) + 1;
    // Its annex is cut from one end of it: the head is that much longer, the wall between them is the end room's,
    // and the annex opens into the end room.
    const nook = capOf.annex, nookArea = nook ? nook.w * nook.h : 0;
    const along = Math.max(3, Math.ceil((capOf.w * capOf.h + nookArea) / (v1 - v0 - 2 - (nook ? 1 : 0)))) + 2;
    const box = rect(f, L, L + along, v0, v1);
    for (let y = box[1]; y < box[3]; y++) for (let x = box[0]; x < box[2]; x++) if (!c.free(x, y)) return null;
    const head = g.room(capOf.role, { spec: capOf, access: [hall] });
    g.rect(head, ...box);
    if (nook) {
      const wide = Math.max(2, Math.ceil(nookArea / (along - 2))) + 1;
      g.rect(g.room(nook.role, { spec: nook, access: [head] }), ...(c.rng.chance(0.5) ? rect(f, L, L + along, v0, v0 + wide) : rect(f, L, L + along, v1 - wide, v1)));
    }
    far = L + along;
  } else ports.push({ frame: { x: at(f, L, 0)[0], y: at(f, L, 0)[1], dir: f.dir }, kind: 'end', hall, along: L, side: 0, ...(X > 0 ? { width: X + 2 } : {}) });
  for (let id = n0; id < g.regions.length; id++) regions.push(id);
  const deep = Math.max(back[0] as number, back[1] as number) + 1;
  const bounds = rect(f, 0, far + 1, -deep - 1, deep + 1);
  // The space off each dock stays open: where ships come in. It must be open now, and outside any hull still to fill.
  for (const m of made) for (let id = m.from; id < m.to; id++) {
    if (g.regions[id]?.role !== 'dock') continue;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let y = bounds[1]; y < bounds[3]; y++) for (let x = bounds[0]; x < bounds[2]; x++) if (g.at(x, y) === id) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const out = facing(f, m.side), D = 6;
    const zone: [number, number, number, number] = out === 'n' ? [x0, y0 - D, x1 + 1, y0] : out === 's' ? [x0, y1 + 1, x1 + 1, y1 + 1 + D] : out === 'w' ? [x0 - D, y0, x0, y1 + 1] : [x1 + 1, y0, x1 + 1 + D, y1 + 1];
    for (let y = zone[1]; y < zone[3]; y++) for (let x = zone[0]; x < zone[2]; x++) {
      if (!c.inside(x, y) || g.at(x, y) !== SPACE || c.site.hull?.(x, y)) return null;
      c.reserved.add(key(x, y));
    }
  }
  return { ports, regions, box: bounds, took: bunks.length };
}

/** A single room on a port, opening onto the hall behind it: a pod, or with `dock` a dock with its clear space kept. */
export function single(c: Ctx, port: Port, spec: RoomSpec, dock = false): Built | null {
  const f = port.frame, g = c.g;
  if (dock && f.dir === 'e') return null; // an airlock never faces east
  const wide = (dock ? 3 : Math.max(spec.w, spec.h)) + 2, along = dock ? DOCK_DEPTH : Math.min(spec.w, spec.h) + 2;
  const v0 = -Math.floor(wide / 2);
  const box = rect(f, 0, along, v0, v0 + wide);
  for (let y = box[1]; y < box[3]; y++) for (let x = box[0]; x < box[2]; x++) {
    if (!c.free(x, y)) return null;
  }
  // A dock keeps the space beyond it open: where ships come in.
  const beyond = rect(f, along, along + 6, v0, v0 + wide);
  if (dock) for (let y = beyond[1]; y < beyond[3]; y++) for (let x = beyond[0]; x < beyond[2]; x++) if (!c.inside(x, y) || g.at(x, y) !== SPACE) return null;
  const id = g.room(spec.role, { spec: dock ? { ...spec, w: 3, h: DOCK_DEPTH - 2 } : spec, access: [port.hall] });
  g.rect(id, ...box);
  if (dock) for (let y = beyond[1]; y < beyond[3]; y++) for (let x = beyond[0]; x < beyond[2]; x++) c.reserved.add(key(x, y));
  return { ports: [], regions: [id], box };
}
