import type { RoomSpec } from '../plan';
import { DOCK_DEPTH, line } from '../stationFlowKit';
import { SOLID, SPACE } from '../stationRegions';
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
}

/** A corridor from a port: a two-wide hall, ports at its end and along both sides. */
export function corridor(c: Ctx, port: Port, o: CorridorOpts): Built | null {
  const f = port.frame, g = c.g;
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

export interface BlockOpts {
  /** One floor depth for both rows (a slab); the rooms' own when not given (staggered bays). */
  rowDepth?: number;
  /** Its biggest room stands across the far end; otherwise the street runs through to a port there. */
  cap?: boolean;
  /** Both rows end together (the shorter one's last room is stretched). */
  even?: boolean;
  dept?: string;
  /** Docks stand in its rows at the far end, on the sides an airlock may face, with the space off them kept clear. */
  docks?: readonly RoomSpec[];
  /** A gate across its street at the foot: it joins its host directly and what is in it is controlled. */
  gate?: boolean;
  /** A passage across it midway, out to both flanks, with a port at each: other sections join its sides. */
  cross?: boolean;
  /** Cabins offered to it: they stand among its rooms, the shorter row first (bunks wherever there is room). */
  bunks?: readonly RoomSpec[];
}

/** A quarters room as cabins side by side, one bed each, taking the room's own length (walls between them included). */
function cabinsWithin(r: RoomSpec): RoomSpec[] {
  const beds = r.mods.filter((m) => m === 'module.bed').length;
  if (r.role !== 'quarters' || beds < 2) return [r];
  const others = r.mods.filter((m) => m !== 'module.bed');
  const room = Math.max(2 * beds, r.w - (beds - 1)), base = Math.floor(room / beds);
  return Array.from({ length: beds }, (_, i): RoomSpec => ({ ...r, mods: ['module.bed', ...(i === 0 ? others : [])], w: base + (i < room - base * beds ? 1 : 0), cabin: true, cabins: false }));
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
  const capOf = o.cap && rooms.length >= 3 ? [...rooms].sort((a, b) => b.w * b.h - a.w * a.h)[0] : undefined;
  // Long side to the street; one depth for the slab when asked (a room keeps its area). A dock block is a dock deep.
  const depth = docks.length > 0 ? DOCK_DEPTH - 2 : o.rowDepth;
  const body = rooms.filter((r) => r !== capOf).map((r) => (depth ? { ...r, w: Math.max(3, Math.ceil((r.w * r.h) / depth)), h: depth } : r.w >= r.h ? r : { ...r, w: r.h, h: r.w }));
  // Quarters are cut into cabins where they stand, a bed each, inside the room's own length: the row is no longer for
  // it and the station no heavier.
  const rows = sides(body).map((row) => row.flatMap(cabinsWithin)) as [RoomSpec[], RoomSpec[]];
  // Bunks: each goes into the shorter row, somewhere among its rooms.
  const bunks = o.bunks ?? [];
  for (const b of bunks) {
    const len = (row: RoomSpec[]): number => row.reduce((n, r) => n + r.w + 1, 0);
    const row = len(rows[0]) <= len(rows[1]) ? rows[0] : rows[1];
    row.splice(c.rng.int(0, row.length), 0, depth ? { ...b, h: depth } : b);
  }
  const legal = ([-1, 1] as const).filter((side) => facing(f, side) !== 'e'); // an airlock never faces east
  docks.forEach((d, i) => rows[(legal[i % legal.length] as number) < 0 ? 0 : 1].push({ ...d, w: 3, h: DOCK_DEPTH - 2 }));
  const run = (row: RoomSpec[]): number => row.reduce((n, r) => n + r.w + 1, 1);
  const L0 = Math.max(run(rows[0]), run(rows[1]), 4);
  if (o.even || docks.length > 0) for (const row of rows) {
    const k = row.map((r) => r.role !== 'dock' && !r.cabin).lastIndexOf(true);
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
    const r = line(c.site, list, axis, dir, from + dir * u, side < 0 ? across - 2 : across + 1, side, { access: [hall], free: c.free });
    made.push({ side, from: first, to: g.regions.length });
    return r.rest.length > 0 ? null : list.length > 0 ? (r.at - from) * dir : u;
  };
  const back = [Math.max(3, ...rows[0].map((r) => r.h)) + 3, Math.max(3, ...rows[1].map((r) => r.h)) + 2];
  // On the flank of another block the rows start a tile out: the first tile is that block's back wall.
  const u0 = port.flank ? 1 : 0;
  let L = L0 + u0;
  const ports: Built['ports'] = [], cross: [number, number, number, number][] = [];
  if (o.cross) {
    // First halves, the passage, then the rest.
    const cut = rows.map((row) => Math.ceil(row.length / 2));
    const e0 = lay(rows[0].slice(0, cut[0]), -1, u0), e1 = lay(rows[1].slice(0, cut[1]), 1, u0);
    if (e0 === null || e1 === null) return null;
    const e = Math.max(e0, e1, u0 + 2);
    const lanes = [rect(f, e, e + 2, -(back[0] as number) + 1, -1), rect(f, e, e + 2, 1, back[1] as number)];
    for (const box of lanes) for (let y = box[1]; y < box[3]; y++) for (let x = box[0]; x < box[2]; x++) if (g.at(x, y) !== SPACE || !c.free(x, y)) return null;
    const m0 = lay(rows[0].slice(cut[0]), -1, e + 2), m1 = lay(rows[1].slice(cut[1]), 1, e + 2);
    if (m0 === null || m1 === null) return null;
    L = Math.max(L, m0, m1, e + 3);
    cross.push(...lanes);
    for (const side of [-1, 1] as const) {
      const v = side < 0 ? -(back[0] as number) : (back[1] as number);
      const [ax, ay] = at(f, e, v), [bx, by] = at(f, e + 1, v);
      ports.push({ frame: { x: Math.max(ax, bx), y: Math.max(ay, by), dir: facing(f, side) }, kind: 'side', hall, along: e, side, flank: true });
    }
  } else {
    const e0 = lay(rows[0], -1, u0), e1 = lay(rows[1], 1, u0);
    if (e0 === null || e1 === null) return null;
    L = Math.max(L, e0, e1);
  }
  if (!clear(c, f, 0, L)) return null;
  g.street(hall, ...rect(f, o.gate ? 1 : 0, L, -1, 1));
  for (const box of cross) g.street(hall, ...box);
  if (o.gate) {
    g.rect(SOLID, ...rect(f, 0, 1, -1, 1));
    g.gate(...at(f, 0, 0));
  }
  let far = L;
  if (capOf) {
    // The end room spans the whole block, back wall to back wall: a head. Narrower, its corners would stand on the
    // last rooms' walls and build them two thick.
    const v0 = -(back[0] as number), v1 = (back[1] as number) + 1;
    const along = Math.max(3, Math.ceil((capOf.w * capOf.h) / (v1 - v0 - 2))) + 2;
    const box = rect(f, L, L + along, v0, v1);
    for (let y = box[1]; y < box[3]; y++) for (let x = box[0]; x < box[2]; x++) if (!c.free(x, y)) return null;
    g.rect(g.room(capOf.role, { spec: capOf, access: [hall] }), ...box);
    far = L + along;
  } else ports.push({ frame: { x: at(f, L, 0)[0], y: at(f, L, 0)[1], dir: f.dir }, kind: 'end', hall, along: L, side: 0 });
  for (let id = n0; id < g.regions.length; id++) regions.push(id);
  const deep = Math.max(back[0] as number, back[1] as number) + 1;
  const whole = rect(f, 0, far + 1, -deep - 1, deep + 1);
  // The space off each dock stays open: where ships come in. It must be open now, and outside any hull still to fill.
  for (const m of made) for (let id = m.from; id < m.to; id++) {
    if (g.regions[id]?.role !== 'dock') continue;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let y = whole[1]; y < whole[3]; y++) for (let x = whole[0]; x < whole[2]; x++) if (g.at(x, y) === id) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const out = facing(f, m.side), D = 6;
    const zone: [number, number, number, number] = out === 'n' ? [x0, y0 - D, x1 + 1, y0] : out === 's' ? [x0, y1 + 1, x1 + 1, y1 + 1 + D] : out === 'w' ? [x0 - D, y0, x0, y1 + 1] : [x1 + 1, y0, x1 + 1 + D, y1 + 1];
    for (let y = zone[1]; y < zone[3]; y++) for (let x = zone[0]; x < zone[2]; x++) {
      if (!c.inside(x, y) || g.at(x, y) !== SPACE || c.site.hull?.(x, y)) return null;
      c.reserved.add(key(x, y));
    }
  }
  return { ports, regions, box: whole, took: bunks.length };
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
