import type { Builder } from './builder';
import type { RoomSpec } from './plan';
import type { Rng } from '../rng';
import { isDock } from './stationDepartments';
import { cabinsOf, DOCK_DEPTH, fillBand, finish, K, line, site, stripsFor, type Built } from './stationFlowKit';
import { SOLID } from './stationRegions';
import { SHOP } from './stationRings';

/**
 * The flow wheel: the trading flow "harbour and market" (docs/STATIONFLOWS.md) as a round station whose size follows
 * from its program. One pass per candidate radius, smallest first; the first that places every room is kept.
 *
 *   harbour    a dock wing on the north flat; its only link to the station is the concourse, through a customs gate
 *   commons    a court at the centre, shops lining the streets where they leave it
 *   freight    warehouses on the east street
 *   secure     the west street behind a gate, not joined to the ring: machine rooms open onto it and nowhere else
 *   the band   cabins and the smaller rooms against the hull, on the lattice (stationFlowKit.ts)
 */

/** Concourse columns (3 wide) and street rows / spoke columns (2 wide). */
const CON = [-1, 2] as const;
const ST = [-1, 1] as const;
/** The court: its sides sit one shop's depth from the concourse, so the shops' back walls and its own line up. */
const COURT = { x0: CON[0] - SHOP.depth - 1, y0: -5, x1: CON[1] + SHOP.depth + 1, y1: 6 };

export interface FlowStation { b: Builder; label: string }

function build(rng: Rng, rooms: RoomSpec[], R: number, shops: number): Built {
  const s = site(R);
  const { g, reach } = s;
  const top = -R; // the hull's north flat: its first row of tiles
  const court = g.hall('plaza');
  const streets = g.hall();
  const secure = g.hall();
  g.street(streets, CON[0], top + 1, CON[1], COURT.y0);
  g.street(streets, COURT.x1, ST[0], reach + 1, ST[1]);
  g.street(streets, ST[0], COURT.y1, ST[1], reach + 1);
  g.street(court, COURT.x0, COURT.y0, COURT.x1, COURT.y1);
  // Secure: the west street stops at the ring's inner wall and does not pierce it; the court's own wall closes its east
  // end but for one gate.
  g.street(secure, -(reach - 1), ST[0], COURT.x0 - 1, ST[1]);
  g.gate(COURT.x0 - 1, ST[0]);

  // The dock wing on the north flat: a lobby along the hull, the docks beyond it; the hull line under the lobby is
  // solid but for the customs gate where the concourse crosses it.
  const docks = rooms.filter(isDock);
  const half = Math.ceil((docks.length * K) / 2);
  const lobby = g.hall();
  g.street(lobby, -half, top - 3, half, top);
  // A dock is its airlock (the hull row and three tiles in) and clear floor between it and the door.
  const dockTop = top - 3 - DOCK_DEPTH;
  g.rect(SOLID, -half - 1, dockTop, -half, top - 3);
  g.rect(SOLID, half, dockTop, half + 1, top - 3);
  docks.forEach((spec, i) => g.rect(g.room('dock', { spec, access: [lobby] }), -half + i * K, dockTop, -half + (i + 1) * K, top - 3));
  g.gate(0, top);

  const of = (pred: (r: RoomSpec) => boolean): RoomSpec[] => rooms.filter(pred);
  // A shop stands with its width along the street and its depth behind.
  const shop = (): RoomSpec => ({ role: 'shop', mods: [], w: SHOP.width, h: SHOP.depth, dept: 'commons' });
  const some = (n: number): RoomSpec[] => Array.from({ length: Math.max(0, n) }, shop);
  const quad = Math.ceil(shops / 4);
  const left: RoomSpec[] = [];
  // Commons: shops where the concourse and the south spoke leave the court; the office at the concourse's far end.
  const office = of((r) => r.role === 'bridge');
  left.push(...line(s, [...some(quad), ...office], 'y', -1, COURT.y0 - 1, CON[0] - 1, -1).rest);
  left.push(...line(s, some(quad), 'y', -1, COURT.y0 - 1, CON[1], 1).rest);
  left.push(...line(s, some(quad), 'y', 1, COURT.y1, ST[0] - 1, -1).rest);
  left.push(...line(s, some(shops - 3 * quad), 'y', 1, COURT.y1, ST[1], 1).rest);
  // Freight: warehouses and the biggest holds on the east street, past the court's corner.
  const cargo = of((r) => r.role === 'cargo').sort((a, c) => c.w * c.h - a.w * a.h);
  const big = cargo.filter((r) => r.warehouse || stripsFor(r) > 3);
  left.push(...line(s, big.filter((_, i) => i % 2 === 0), 'x', 1, COURT.x1 + 1, ST[0] - 1, -1).rest);
  left.push(...line(s, big.filter((_, i) => i % 2 === 1), 'x', 1, COURT.x1 + 1, ST[1], 1).rest);
  // Secure: machine rooms on the west street, behind its gate; they open onto it and nowhere else.
  const machines = of((r) => ['reactor', 'shields', 'core'].includes(r.role)).sort((a, c) => c.w * c.h - a.w * a.h);
  left.push(...line(s, machines.filter((_, i) => i % 2 === 0), 'x', -1, COURT.x0 - 2, ST[0] - 1, -1, { access: [secure], deep: true }).rest);
  left.push(...line(s, machines.filter((_, i) => i % 2 === 1), 'x', -1, COURT.x0 - 2, ST[1], 1, { access: [secure], deep: true }).rest);
  if (left.length > 0) return finish(s, rng, left, 0);

  const band = of((r) => !isDock(r) && r.role !== 'bridge' && !big.includes(r) && !machines.includes(r)).flatMap(cabinsOf);
  const cabins = band.filter((r) => r.cabin), others = band.filter((r) => !r.cabin).sort((a, c) => stripsFor(c) - stripsFor(a));
  const spare = fillBand(s, cabins, others);
  return finish(s, rng, [...cabins, ...others], spare);
}

/** The flow wheel for these rooms (the office among them, docks too); `market` gives it shops. `trace` collects why each smaller radius failed. */
export function flowWheel(rng: Rng, rooms: RoomSpec[], market: boolean, trace?: string[]): FlowStation | null {
  const shops = market ? Math.max(4, Math.min(12, Math.round(rooms.length / 3))) : 0;
  for (let cells = 8; cells <= 14; cells++) {
    const r = build(rng, rooms, cells * K, shops);
    if (r.left === 0) return { b: r.b, label: `stationFlow harbour-market R ${cells * K} shops ${shops} spare strips ${r.spare}` };
    trace?.push(`R ${cells * K}: ${r.why}`);
  }
  return null;
}
