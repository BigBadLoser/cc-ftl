import type { RoomSpec } from '../plan';
import { block, type BlockOpts } from './elements';
import { K } from './lattice';
import { pierHead } from './pierhead';
import { at, key, rect, sides, type Built, type Ctx, type Dir, type Frame, type Port } from './model';

/**
 * A quay: the harbour as one open concourse along the station's outside, every airlock standing in it against the outer
 * wall (the unit is part of the hall: no room and no door between a hatch and the concourse). Behind it, in the middle,
 * customs: an open hall the quay runs into, with the harbour's only gate on its far side, where the street leaves. The
 * harbour's rooms stand along the quay's inner side, either side of customs, and open onto the quay.
 *
 * Three forms of it (a fourth, `head`, is the end of a pier: pierhead.ts):
 *   quay       the airlocks along the outer wall at an even pitch
 *   gatehouse  the control room stands out in front of the quay, in the middle, the airlocks in a wing either side of it
 *   basin      two arms of concourse run out from the quay's ends, the airlocks in their inner walls facing each other:
 *              the shuttles lie between the arms
 *
 * With nothing behind its port (a station that starts here) the quay is laid first and the street runs on inland; on
 * a host the quay is the far end. A harbour may look any way.
 */

export interface QuayOpts {
  form: 'quay' | 'gatehouse' | 'basin' | 'head';
  /** The concourse: tiles across, the three an airlock unit takes included (the innermost of them is the unit's walkway). */
  wide: number;
  /** Tiles from one airlock to the next along a wall. */
  pitch: number;
  /** Customs: tiles across (the street's width and two at least). */
  customs: number;
  /**
   * block  every room stands along the quay's inner side, out to its ends: the harbour is one rectangle
   * taper  one room either side of customs, the quay running on a little past them, and the rest along the street inland
   * face   on a ring's rim: the rooms are the band of the flat face it stands on, customs in the band at the axis with
   *        its gate onto the ring, and the quay runs along the face outside the hull. It holds the rooms the face has
   *        length for (control first, then the armoury); the rest are left to the band beside it. Elsewhere, a block.
   */
  shape: 'block' | 'taper' | 'face';
}

const BACK: Record<Dir, Dir> = { n: 's', s: 'n', e: 'w', w: 'e' };
/** Open ground kept off a wall with airlocks in it: where the shuttles lie. */
const BERTH = 7;
/** A basin's width between its arms: a shuttle off each, nose to nose. */
const BASIN = 13;
const area = (r: RoomSpec): number => r.w * r.h;
/** A row of rooms at one floor depth: its length, walls counted. */
const need = (row: readonly RoomSpec[], depth: number): number => row.reduce((n, r) => n + Math.max(3, Math.ceil(area(r) / depth)) + 1, 1);

export function quay(c: Ctx, port: Port, rooms: readonly RoomSpec[], docks: readonly RoomSpec[], o: QuayOpts, b: BlockOpts): Built | null {
  const g = c.g, near = port.hall < 0, n0 = g.regions.length, N = docks.length, P = o.pitch;
  // The gatehouse is the control room; without one the harbour is a plain quay.
  const tower = o.form === 'gatehouse' ? rooms.find((r) => r.role === 'bridge') : undefined;
  // A pier head needs a street to end; with nothing behind the port the harbour is a plain quay.
  if (o.form === 'head' && !near) return pierHead(c, port, rooms, docks, o, b);
  const form = (o.form === 'gatehouse' && !tower) || o.form === 'head' ? 'quay' : o.form;
  if (N === 0) return null;
  const width = Math.max(2, b.width ?? port.width ?? 2), X = width - 2;
  // Which rooms line the quay, by side; the rest stand along the street.
  const inside = rooms.filter((r) => r !== tower), bySize = [...inside].sort((p, q) => area(q) - area(p));
  let rows: [RoomSpec[], RoomSpec[]], rest: RoomSpec[] = [];
  const cw = Math.max(o.customs, width + 2), c0 = -1 - ((cw - width) >> 1), c1 = c0 + cw;
  // A face: the flat of the hull this rim port stands on, as far as the hull line runs straight either side of the axis.
  const hull = c.site.hull, B = port.along, left: RoomSpec[] = [];
  let face: [number, number] | null = null;
  if (o.shape === 'face' && port.kind === 'rim' && hull) {
    // Short of a cut corner's block, which starts a cell before the cut.
    const lim = c.site.outline === 'square' ? c.site.R - K * (c.site.cut + 1) : Infinity;
    const flat = (v: number): boolean => Math.abs(v + 0.5) < lim && hull(...at(port.frame, B - 1, v)) && !hull(...at(port.frame, B, v));
    let v0 = 0, v1 = 0;
    while (flat(v0 - 1)) v0--;
    while (flat(v1 + 1)) v1++;
    face = [c0 - v0, v1 + 1 - c1];
    // Control first, then the armoury, then by size: each to the side with more length left, while it fits.
    const rank = (r: RoomSpec): number => (r.role === 'bridge' ? 0 : r.role === 'armoury' ? 1 : 2);
    rows = [[], []];
    for (const r of [...bySize].sort((p, q) => rank(p) - rank(q))) {
      const unit = r.annex ? [r, r.annex] : [r];
      const k = ([0, 1] as const).filter((i) => need([...rows[i], ...unit], B - 2) <= (face as [number, number])[i]).sort((i, j) => ((face as [number, number])[j] - need(rows[j], B - 2)) - ((face as [number, number])[i] - need(rows[i], B - 2)))[0];
      if (k === undefined) left.push(r);
      else rows[k].push(r);
    }
  } else if (o.shape !== 'taper') rows = sides(bySize);
  else {
    const first = inside.find((r) => r.role === 'bridge') ?? inside.find((r) => r.role === 'armoury') ?? bySize[0];
    const second = inside.find((r) => r.role === 'armoury' && r !== first) ?? bySize.find((r) => r !== first);
    rows = [first ? [first] : [], second ? [second] : []];
    rest = inside.filter((r) => r !== first && r !== second);
  }
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
  // Sizes. Customs stands in the middle; the quay reaches `A` tiles either side of it: what its form asks, and more
  // when the rooms beside customs need it. The rooms' depth is the least that fits them into that length, and they
  // take up whatever is left over.
  const edge = o.shape === 'taper' ? -1 : 1, Q = Math.max(4, o.wide);
  // The gatehouse: as deep as it is wide, six at most and four by five at least, centred on customs. A wing: two clear of it, its airlocks, two past the last.
  const th = tower ? Math.max(4, Math.min(6, Math.floor(Math.sqrt(area(tower))))) : 0, tw = tower ? Math.max(5, Math.ceil(area(tower) / th)) : 0;
  const t0 = (c0 + c1 - tw - 2) >> 1, t1 = t0 + tw + 2, wings = [Math.ceil(N / 2), N >> 1];
  const wing = (n: number): number => (n > 0 ? 2 + (n - 1) * P + 3 + 2 : 2);
  let A = form === 'quay' ? Math.ceil(((N - 1) * P + 3 + 4 - cw) / 2) : form === 'basin' ? Math.ceil((BASIN + 2 * Q - cw) / 2) : Math.max(c0 - t0 + wing(wings[0] as number), t1 - c1 + wing(wings[1] as number));
  A = Math.max(A, 2);
  const fit = (reach: number, depth: number): boolean => Math.max(need(rows[0], depth), need(rows[1], depth)) <= reach + edge;
  let D = face ? B - 2 : 4;
  if (!face) {
    while (D < 9 && !fit(A, D)) D++;
    while (!fit(A, D)) A++;
  }
  // The rooms' length either side of customs: the face's, else the quay's reach and a tile (a block) or less one (a taper).
  const span: [number, number] = face ?? [A + edge, A + edge];
  const T = D + 2 + Q, arm = form === 'basin' ? 4 + (Math.ceil(N / 2) - 1) * P + 3 + 2 : 0, far = T + (form === 'basin' ? arm : tower ? th + 2 : 0);
  // The frame everything is drawn in: from the gate line (u = 0) out to sea, v as the street has it.
  const f: Frame = near ? { x: at(from.frame, T - 1, 0)[0], y: at(from.frame, T - 1, 0)[1], dir: BACK[from.frame.dir] } : from.frame;
  // On a face the quay is as long as the face, and longer only when its airlocks need it.
  const q0 = Math.min(c0 - A, face ? c0 - face[0] : c0), q1 = Math.max(c1 + A, face ? c1 + face[1] : c1);
  const free = (box: readonly [number, number, number, number], open = false): boolean => {
    for (let y = box[1]; y < box[3]; y++) for (let x = box[0]; x < box[2]; x++) if (!c.free(x, y) || (open && c.site.hull?.(x, y) && !(c.site.depth?.(x, y) >= 4))) return false;
    return true;
  };
  const boxes = rows.map((_row, k) => (k === 0 ? rect(f, 0, D + 2, c0 - span[0], c0) : rect(f, 0, D + 2, c1, c1 + span[1])));
  if (!free(rect(f, 0, D + 2, c0 - 1, c1 + 1)) || !free(rect(f, D + 1, T + 1, q0 - 1, q1 + 1)) || boxes.some((bx, k) => (rows[k] as RoomSpec[]).length > 0 && !free(bx))) return null;
  // What stands out to sea, and the shuttles' ground: open now, outside any hull still to fill (the open ground
  // inboard of a ring will do: a harbour may lie inside an arc), and kept.
  const arms = form === 'basin' ? [rect(f, T, T + arm, q0, q0 + Q), rect(f, T, T + arm, q1 - Q, q1)] : [];
  const out = tower ? rect(f, T, T + th + 2, t0, t1) : null;
  const berths = form === 'basin'
    ? [rect(f, T + 1, T + arm + 1, q0 + Q + 1, q1 - Q - 1), rect(f, T + arm + 1, T + arm + 5, q0 - 1, q1 + 1)]
    : tower ? [rect(f, T + 1, T + 1 + BERTH, q0 - 1, t0), rect(f, T + 1, T + 1 + BERTH, t1, q1 + 1)] : [rect(f, T + 1, T + 1 + BERTH, q0 - 1, q1 + 1)];
  if ([...arms.map((r) => [r[0] - 1, r[1] - 1, r[2] + 1, r[3] + 1] as const), ...(out ? [out] : []), ...berths].some((r) => !free(r, true))) return null;

  const hall = g.hall('hall', 'harbour'), customs = g.hall('plaza', 'customs');
  g.street(hall, ...rect(f, D + 2, T, q0, q1));
  for (const r of arms) g.street(hall, ...r);
  g.street(customs, ...rect(f, 1, D + 2, c0, c1));
  g.gate(...at(f, 0, X >> 1));
  if (tower && out) g.rect(g.room(tower.role, { spec: { ...tower, w: tw, h: th }, access: [hall] }), ...out);
  // The rooms, from customs outwards on each side, sharing out the length that is over.
  for (const [k, row] of rows.entries()) {
    if (row.length === 0) continue;
    const len = row.map((r) => Math.max(3, Math.ceil(area(r) / D)));
    for (let over = (span[k] as number) - need(row, D), i = 0; over > 0; over--, i++) (len[i % len.length] as number)++;
    let v = k === 0 ? c0 : c1, parent = -1;
    for (const [i, r] of row.entries()) {
      const span = (len[i] as number) + (i === 0 ? 2 : 1);
      // On a face the rooms are band rooms among band rooms: the walls between them and their neighbours round the
      // ring are theirs (they rank below every strip).
      const id = g.room(r.role, { spec: { ...r, w: len[i] as number, h: D }, access: [r.annexed && parent >= 0 ? parent : hall], ...(face ? { rank: -1 - i - 8 * k } : {}) });
      g.rect(id, ...(k === 0 ? rect(f, 0, D + 2, v - span, v) : rect(f, 0, D + 2, v, v + span)));
      v += k === 0 ? -span : span;
      if (!r.annexed) parent = id;
    }
  }
  // The airlocks: a unit of three by three against its wall (part of the hall: the airlock module's own floor, its
  // walkway innermost), and its hatch in the wall.
  const unit = (d: RoomSpec, box: [number, number, number, number], hatch: [number, number]): void => {
    g.rect(g.hall('dock', 'airlock', { ...d, w: 3, h: 3 }), ...box);
    g.gate(...hatch);
  };
  for (const [i, d] of docks.entries()) {
    if (form === 'basin') {
      // On the arms' inner walls, dealt to one arm and the other, the first four tiles out from the quay.
      const u = T + 4 + (i >> 1) * P;
      if (i % 2 === 0) unit(d, rect(f, u, u + 3, q0 + Q - 3, q0 + Q), at(f, u + 1, q0 + Q));
      else unit(d, rect(f, u, u + 3, q1 - Q, q1 - Q + 3), at(f, u + 1, q1 - Q - 1));
      continue;
    }
    // Along the outer wall: evenly, or in a wing either side of the gatehouse, counted out from it.
    const lo = i < (wings[0] as number), k = lo ? i : i - (wings[0] as number);
    const v = tower ? (lo ? t0 - 5 - k * P : t1 + 2 + k * P) : q0 + i * P + ((q1 - q0 - ((N - 1) * P + 3)) >> 1);
    unit(d, rect(f, T - 3, T, v, v + 3), at(f, T, v + 1));
  }
  for (const r of berths) for (let y = r[1]; y < r[3]; y++) for (let x = r[0]; x < r[2]; x++) c.reserved.add(key(x, y));

  let box = rect(f, -1, far + 1, q0 - 1, q1 + 1);
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
  return { ports, regions, box, took, ...(left.length > 0 ? { left } : {}) };
}
