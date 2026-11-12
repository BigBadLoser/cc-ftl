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
}

/**
 * A block: the standard module. A street from the port with rooms lining both sides, closed by a room across its end
 * or open to carry on. Its size is its rooms': each room is its floor and its walls, laid out by the shared lining code,
 * so what a block holds is what was drawn, not an estimate.
 */
export function block(c: Ctx, port: Port, rooms: readonly RoomSpec[], o: BlockOpts = {}): Built | null {
  const f = port.frame, g = c.g;
  if (rooms.length === 0) return null;
  const capOf = o.cap && rooms.length >= 3 ? [...rooms].sort((a, b) => b.w * b.h - a.w * a.h)[0] : undefined;
  // Long side to the street; one depth for the slab when asked (a room keeps its area).
  const depth = o.rowDepth;
  const body = rooms.filter((r) => r !== capOf).map((r) => (depth ? { ...r, w: Math.max(3, Math.ceil((r.w * r.h) / depth)), h: depth } : r.w >= r.h ? r : { ...r, w: r.h, h: r.w }));
  const rows = sides(body);
  const run = (row: RoomSpec[]): number => row.reduce((n, r) => n + r.w + 1, 1);
  const L0 = Math.max(run(rows[0]), run(rows[1]), 4);
  if (o.even) for (const row of rows) { const last = row[row.length - 1]; if (last) row[row.length - 1] = { ...last, w: last.w + L0 - run(row) }; }
  if (!clear(c, f, 0, L0)) return null;
  const hall = g.hall('hall', o.dept ?? rooms[0]?.dept);
  const axis = f.dir === 'e' || f.dir === 'w' ? 'x' : 'y', dir = f.dir === 'e' || f.dir === 's' ? 1 : -1;
  const from = axis === 'x' ? f.x : f.y, across = axis === 'x' ? f.y : f.x;
  const regions = [hall], n0 = g.regions.length;
  // The rows first: a deeper room after a shallower one brings a wall of its own, so a staggered row runs a little
  // longer than its rooms add up to, and the street is as long as the rows turn out.
  let L = L0;
  for (const [k, side] of ([-1, 1] as const).entries()) {
    const r = line(c.site, rows[k] as RoomSpec[], axis, dir, from, side < 0 ? across - 2 : across + 1, side, { access: [hall], free: c.free });
    if (r.rest.length > 0) return null;
    L = Math.max(L, (r.at - from) * dir);
  }
  if (L > L0 && !clear(c, { ...f, x: at(f, L0, 0)[0], y: at(f, L0, 0)[1] }, 0, L - L0)) return null;
  g.street(hall, ...rect(f, 0, L, -1, 1));
  let far = L;
  if (capOf) {
    // The end room spans the whole block, back wall to back wall: a head. Narrower, its corners would stand on the
    // last rooms' walls and build them two thick.
    const back = (row: RoomSpec[]): number => Math.max(3, ...row.map((r) => r.h)) + 3;
    const v0 = -back(rows[0]), v1 = back(rows[1]);
    const along = Math.max(3, Math.ceil((capOf.w * capOf.h) / (v1 - v0 - 2))) + 2;
    const box = rect(f, L, L + along, v0, v1);
    for (let y = box[1]; y < box[3]; y++) for (let x = box[0]; x < box[2]; x++) if (!c.free(x, y)) return null;
    g.rect(g.room(capOf.role, { spec: capOf, access: [hall] }), ...box);
    far = L + along;
  }
  for (let id = n0; id < g.regions.length; id++) regions.push(id);
  const deep = Math.max(4, ...body.map((r) => r.h + 3));
  const ports: Built['ports'] = capOf ? [] : [{ frame: { x: at(f, L, 0)[0], y: at(f, L, 0)[1], dir: f.dir }, kind: 'end', hall, along: L, side: 0 }];
  return { ports, regions, box: rect(f, 0, far + 1, -deep - 1, deep + 1) };
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
