import type { RoomSpec } from './plan';
import type { Rng } from '../rng';
import { isDock } from './stationDepartments';
import { cabinsOf, DOCK_DEPTH, fillBand, finish, K, line, site, stripsFor, type Built } from './stationFlowKit';
import type { FlowStation } from './stationFlowWheel';

/**
 * The ore spine: a works station as a wheel with a straight processing spine through it, east to west, out past the
 * hull at both ends. The kind shows in the outline.
 *
 *   the spine   a 3-wide haul street; the works halls and warehouses line it inside the ring, one depth a side
 *   its ends    beyond the ring: the harbour rooms in the band's depth, then a dock on each row's end outside the hull
 *   secure      a north spoke behind a gate, not joined to the ring: the machine rooms open onto it and nowhere else
 *   commons     a south spoke to the ring: messes and the medbay
 *   the band    cabins and the smaller rooms against the hull, on the lattice; the ring crosses the haul street
 *
 * Everything else inside the ring is open to space. The radius is the smallest that places every room.
 */

/** Haul street rows (3 wide) and spoke columns (2 wide). */
const HAUL = [-1, 2] as const;
const SP = [-1, 1] as const;

function build(rng: Rng, rooms: RoomSpec[], R: number): Built {
  const s = site(R, 32);
  const { g, reach, depth } = s;
  const used = new Set<RoomSpec>();
  const take = (pred: (r: RoomSpec) => boolean): RoomSpec[] => { const out = rooms.filter((r) => !used.has(r) && pred(r)); for (const r of out) used.add(r); return out; };
  const bySize = (a: RoomSpec, c: RoomSpec): number => c.w * c.h - a.w * a.h;

  // The haul street, tip to tip (the docks stand three tiles past the hull line at each end).
  const street = g.hall();
  const secure = g.hall();
  g.street(street, -R - K + 1, HAUL[0], R + K - 1, HAUL[1]);
  // Spokes: north behind a gate and short of the ring; south open, to the ring.
  g.street(secure, SP[0], -(reach - 1), SP[1], HAUL[0] - 1);
  g.gate(0, HAUL[0] - 1);
  g.street(street, SP[0], HAUL[1], SP[1], reach + 1);

  // Inside the ring: the big rooms line the street, works north and freight south, one depth a side.
  const works = take((r) => r.role === 'industry' || r.role === 'farm').sort(bySize);
  const freight = take((r) => r.role === 'cargo' && (!!r.warehouse || stripsFor(r) > 3)).sort(bySize);
  const north = works.length > 0 ? works : freight.splice(0, Math.ceil(freight.length / 2));
  const rows: [RoomSpec[], number, 1 | -1][] = [[north, HAUL[0] - 1, -1], [freight, HAUL[1], 1]];
  const left: RoomSpec[] = [];
  const rowDepth: number[] = [];
  // Where each row has got to on each side of the spokes, for rooms that carry on along it later.
  const segs: { dir: 1 | -1; at: number; edge: number; side: 1 | -1; floorDepth: number }[] = [];
  for (const [list, edge, side] of rows) {
    const floorDepth = Math.max(5, ...list.map((r) => Math.min(r.w, r.h)));
    rowDepth.push(floorDepth + 2);
    const o = { access: [street], floorDepth };
    for (const dir of [1, -1] as const) {
      const r = line(s, list.filter((_, i) => i % 2 === (dir > 0 ? 0 : 1)), 'x', dir, dir > 0 ? SP[1] : SP[0] - 1, edge, side, o);
      left.push(...r.rest);
      segs.push({ dir, at: r.at, edge, side, floorDepth });
    }
  }
  // Secure: machine rooms on the north spoke, past the works row; commons on the south spoke, past the freight row.
  const machines = take((r) => ['reactor', 'shields', 'core'].includes(r.role)).sort(bySize);
  const n0 = HAUL[0] - 1 - (rowDepth[0] as number), s0 = HAUL[1] + (rowDepth[1] as number);
  let over: RoomSpec[] = [];
  over.push(...line(s, machines.filter((_, i) => i % 2 === 0), 'y', -1, n0, SP[0] - 1, -1, { access: [secure], deep: true }).rest);
  over.push(...line(s, machines.filter((_, i) => i % 2 === 1), 'y', -1, n0, SP[1], 1, { access: [secure], deep: true }).rest);
  const commons = take((r) => r.role === 'support' || r.role === 'medbay').sort(bySize);
  over.push(...line(s, commons.filter((_, i) => i % 2 === 0), 'y', 1, s0, SP[0] - 1, -1, { deep: true }).rest);
  over.push(...line(s, commons.filter((_, i) => i % 2 === 1), 'y', 1, s0, SP[1], 1, { deep: true }).rest);
  // A room its spoke has no frontage for carries on along the haul street's rows instead of growing the whole ring.
  for (const seg of segs) {
    if (over.length === 0) break;
    over = line(s, over, 'x', seg.dir, seg.at, seg.edge, seg.side, { access: [street], floorDepth: seg.floorDepth }).rest;
  }
  left.push(...over);
  if (left.length > 0) return finish(s, rng, left, 0);

  // The spine's ends, beyond the ring: a harbour room in the band's depth on each row, then a dock past the hull line.
  let out = reach + 1;
  while (depth(out, 0) > 0) out++; // the first column outside the ring on the east flat
  const docks = take(isDock);
  const ends = [...take((r) => r.role === 'bridge' || r.role === 'armoury'), ...take((r) => r.role === 'plant')];
  const across = DOCK_DEPTH;
  // Row ends in the order they are filled: north-east, south-west, north-west, south-east.
  for (const [k, [sx, sy]] of ([[1, -1], [-1, 1], [-1, -1], [1, 1]] as const).entries()) {
    const y0 = sy < 0 ? HAUL[0] - across : HAUL[1], y1 = y0 + across;
    const room = ends[k], dock = docks[k];
    if (room) g.rect(g.room(room.role, { spec: room, access: [street] }), sx > 0 ? out : -R, y0, sx > 0 ? R : -out, y1);
    if (dock) g.rect(g.room('dock', { spec: dock, access: [street] }), sx > 0 ? R : -R - K, y0, sx > 0 ? R + K : -R, y1);
  }
  const extra = [...docks.slice(4), ...ends.slice(4)];
  if (extra.length > 0) return finish(s, rng, extra, 0);

  const band = take(() => true).flatMap(cabinsOf);
  const cabins = band.filter((r) => r.cabin), others = band.filter((r) => !r.cabin).sort((a, c) => stripsFor(c) - stripsFor(a));
  const spare = fillBand(s, cabins, others);
  return finish(s, rng, [...cabins, ...others], spare);
}

/** The ore spine for these rooms (the office and the docks among them). `trace` collects why each smaller radius failed. */
export function flowSpine(rng: Rng, rooms: RoomSpec[], trace?: string[]): FlowStation | null {
  for (let cells = 8; cells <= 14; cells++) {
    const r = build(rng, rooms, cells * K);
    if (r.left === 0) return { b: r.b, label: `stationFlowSpine ore-spine R ${cells * K} spare strips ${r.spare}` };
    trace?.push(`R ${cells * K}: ${r.why}`);
  }
  return null;
}
