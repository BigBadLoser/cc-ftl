import type { RoomSpec } from '../plan';
import { block, type BlockOpts } from './elements';
import { at, key, rect, sides, type Built, type Ctx, type Dir, type Frame, type Port } from './model';

/**
 * A quay: the harbour as one open concourse along the station's outside, every airlock standing in it against the outer
 * wall (the unit is part of the hall: no room and no door between a hatch and the concourse). Behind it, in the middle,
 * customs: an open hall the quay runs into, with the harbour's only gate on its far side, where the street leaves. The
 * harbour's rooms stand along the quay's inner side, either side of customs, and open onto the quay.
 *
 * With nothing behind its port (a station that starts here) the quay is laid first and the street runs on inland; on
 * a host the quay is the far end. An airlock never faces east, so neither does a quay.
 */

export interface QuayOpts {
  /** The concourse: tiles across, the two an airlock unit takes included. */
  wide: number;
  /** Tiles from one airlock to the next along the wall. */
  pitch: number;
  /** Customs: tiles across (the street's width and two at least); 0: none, the street runs straight onto the quay, ungated. */
  customs: number;
  /** Customs and the street at one end of the quay (either, as the seed has it), every room to one side; default: in the middle. */
  end?: boolean;
  /**
   * block  every room stands along the quay's inner side, out to its ends: the harbour is one rectangle
   * taper  one room either side of customs, the quay running on a little past them, and the rest along the street inland
   */
  shape: 'block' | 'taper';
}

const BACK: Record<Dir, Dir> = { n: 's', s: 'n', e: 'w', w: 'e' };
/** Open ground kept off the quay's outer wall: where the shuttles lie. */
const BERTH = 7;
const area = (r: RoomSpec): number => r.w * r.h;
/** A row of rooms at one floor depth: its length, walls counted. */
const need = (row: readonly RoomSpec[], depth: number): number => row.reduce((n, r) => n + Math.max(3, Math.ceil(area(r) / depth)) + 1, 1);

export function quay(c: Ctx, port: Port, rooms: readonly RoomSpec[], docks: readonly RoomSpec[], o: QuayOpts, b: BlockOpts): Built | null {
  const g = c.g, near = port.hall < 0, n0 = g.regions.length;
  if (docks.length === 0 || (near ? BACK[port.frame.dir] : port.frame.dir) === 'e') return null;
  const width = Math.max(2, b.width ?? port.width ?? 2), X = width - 2;
  // Which rooms line the quay, by side; the rest stand along the street.
  const bySize = [...rooms].sort((p, q) => area(q) - area(p));
  let rows: [RoomSpec[], RoomSpec[]], rest: RoomSpec[] = [];
  if (o.shape === 'block') rows = sides(bySize);
  else {
    const first = rooms.find((r) => r.role === 'bridge') ?? bySize[0], second = rooms.find((r) => r.role === 'armoury' && r !== first) ?? bySize.find((r) => r !== first);
    rows = [first ? [first] : [], second ? [second] : []];
    rest = rooms.filter((r) => r !== first && r !== second);
  }
  if (o.end) rows = c.rng.chance(0.5) ? [[...rows[0], ...rows[1]], []] : [[], [...rows[1], ...rows[0]]];
  rows = rows.map((row) => row.flatMap((r) => (r.annex ? [r, { ...r.annex, annexed: true }] : [r]))) as [RoomSpec[], RoomSpec[]];
  // On a host the rooms along the street come first and the quay ends the branch.
  let from = port, took = 0, ports: Built['ports'] = [], inland: Built['box'] | null = null;
  const lined = (at: Port): Built | null => block(c, at, rest, { ...b, cap: false, gate: false });
  if (!near && rest.length > 0) {
    const blk = lined(port), end = blk?.ports.find((p) => p.kind === 'end');
    if (!blk || !end) return null;
    ports = blk.ports.filter((p) => p !== end);
    took = blk.took ?? 0;
    inland = blk.box;
    from = { ...end, owner: -1, used: false };
  }
  // Sizes. The quay is as long as its airlocks ask, and longer when the rooms beside customs need it; the rooms'
  // depth is the least that fits them into its length, and they take up whatever is left over.
  const cw = o.customs > 0 ? Math.max(o.customs, width + 2) : width, edge = o.shape === 'block' ? 1 : -1;
  const fit = (len: number, depth: number): boolean => Math.max(need(rows[0], depth), need(rows[1], depth)) <= (o.end ? len - cw : (len - cw) >> 1) + edge;
  let Lq = (docks.length - 1) * o.pitch + 3 + 4, D = 4;
  if (!o.end && (Lq - cw) % 2 !== 0) Lq++;
  while (D < 9 && !fit(Lq, D)) D++;
  while (!fit(Lq, D)) Lq += 2;
  // The quay's reach either side of customs.
  const A = rows.map((row) => (o.end ? (row.length > 0 ? Lq - cw : 0) : (Lq - cw) >> 1)) as [number, number];
  if (o.end && A[0] + A[1] === 0) A[0] = Lq - cw;
  const Q = Math.max(4, o.wide), T = D + 2 + Q;
  // The frame everything is drawn in: from the gate line (u = 0) out to sea, v as the street has it.
  const f: Frame = near ? { x: at(from.frame, T - 1, 0)[0], y: at(from.frame, T - 1, 0)[1], dir: BACK[from.frame.dir] } : from.frame;
  const c0 = -1 - ((cw - width) >> 1), c1 = c0 + cw, q0 = c0 - A[0], q1 = c1 + A[1];
  const boxes = rows.map((_row, k) => (k === 0 ? rect(f, 0, D + 2, q0 - edge, c0) : rect(f, 0, D + 2, c1, q1 + edge)));
  const free = (box: readonly [number, number, number, number]): boolean => {
    for (let y = box[1]; y < box[3]; y++) for (let x = box[0]; x < box[2]; x++) if (!c.free(x, y)) return false;
    return true;
  };
  if (!free(rect(f, 0, D + 2, c0 - 1, c1 + 1)) || !free(rect(f, D + 1, T + 1, q0 - 1, q1 + 1)) || boxes.some((bx, k) => (rows[k] as RoomSpec[]).length > 0 && !free(bx))) return null;
  // The shuttles' ground off the outer wall: open now, outside any hull still to fill, and kept.
  const berth = rect(f, T + 1, T + 1 + BERTH, q0 - 1, q1 + 1);
  for (let y = berth[1]; y < berth[3]; y++) for (let x = berth[0]; x < berth[2]; x++) if (!c.free(x, y) || c.site.hull?.(x, y)) return null;

  const hall = g.hall('hall', 'harbour');
  g.street(hall, ...rect(f, D + 2, T, q0, q1));
  let customs = hall;
  if (o.customs > 0) {
    customs = g.hall('plaza', 'customs');
    g.street(customs, ...rect(f, 1, D + 2, c0, c1));
    g.gate(...at(f, 0, X >> 1));
  } else g.street(hall, ...rect(f, 0, D + 2, c0, c1));
  // The rooms, from customs outwards on each side, sharing out the length that is over.
  for (const [k, row] of rows.entries()) {
    if (row.length === 0) continue;
    const len = row.map((r) => Math.max(3, Math.ceil(area(r) / D)));
    for (let over = (A[k] as number) + edge - need(row, D), i = 0; over > 0; over--, i++) (len[i % len.length] as number)++;
    let v = k === 0 ? c0 : c1, parent = -1;
    for (const [i, r] of row.entries()) {
      const span = (len[i] as number) + (i === 0 ? 2 : 1);
      const id = g.room(r.role, { spec: { ...r, w: len[i] as number, h: D }, access: [r.annexed && parent >= 0 ? parent : hall] });
      g.rect(id, ...(k === 0 ? rect(f, 0, D + 2, v - span, v) : rect(f, 0, D + 2, v, v + span)));
      v += k === 0 ? -span : span;
      if (!r.annexed) parent = id;
    }
  }
  // The airlocks: a unit of three by two against the outer wall, its hatch in the wall, evenly along the quay.
  const v0 = q0 + ((Lq - ((docks.length - 1) * o.pitch + 3)) >> 1);
  for (const [i, d] of docks.entries()) {
    const v = v0 + i * o.pitch;
    g.rect(g.hall('dock', 'airlock', { ...d, w: 3, h: 2 }), ...rect(f, T - 2, T, v, v + 3));
    g.gate(...at(f, T, v + 1));
  }
  for (let y = berth[1]; y < berth[3]; y++) for (let x = berth[0]; x < berth[2]; x++) c.reserved.add(key(x, y));

  let box = rect(f, -1, T + 1, q0 - 1, q1 + 1);
  if (near) {
    const [x, y] = at(f, -1, 0);
    const end: Built['ports'][number] = { frame: { x, y, dir: BACK[f.dir] }, kind: 'end', hall: customs, along: T, side: 0, ...(X > 0 ? { width } : {}) };
    if (rest.length > 0) {
      const blk = lined({ ...end, owner: -1, used: false });
      if (!blk) return null;
      ports = blk.ports;
      took = blk.took ?? 0;
      inland = blk.box;
    } else ports = [end];
  }
  const regions: number[] = [];
  for (let id = n0; id < g.regions.length; id++) regions.push(id);
  if (inland) box = [Math.min(box[0], inland[0]), Math.min(box[1], inland[1]), Math.max(box[2], inland[2]), Math.max(box[3], inland[3])];
  return { ports, regions, box, took };
}
