/**
 * Trading A, "harbour wheel": round hull, rooms against it, a 2-wide main ring. Departments in sectors: the harbour
 * wing north (an inhabited pier, not a stick: docks at its tip corners, the customs office and armoury on one flank,
 * shops on the other, the 3-wide concourse up its middle), commons in the centre (market street, plaza, garden),
 * freight east (the warehouse wing with its own freight dock, holds beside it), habitation south-east (cabins on a
 * gallery, medbay, mess), secure south-west (reactors, shields, core). Defence gun bays sit round the band. Two voids
 * open to space flank the market street inside the ring.
 */
import { Mock, type Part } from './mockKit';
import type { RoomRole } from '../../../src/sim';

export function tradingA(): ReturnType<Mock['build']> {
  const m = new Mock(100, 98, 44, 52);
  const { cx, cy } = m;
  const R = 38, IN = 28;
  const box = (id: number, x0: number, y0: number, x1: number, y1: number, rMax = IN): number => {
    m.paint(id, (x, y, r) => x >= cx + x0 && x < cx + x1 && y >= cy + y0 && y < cy + y1 && r < rMax);
    return id;
  };
  const room = (role: RoomRole, target: number | undefined, x0: number, y0: number, x1: number, y1: number, o: { dept?: string; rMax?: number } = {}): number =>
    box(m.room(role, { target, dept: o.dept }), x0, y0, x1, y1, o.rMax);
  const cab = (n: number, deg: number): Part[] => Array.from({ length: n }, () => ['quarters', deg / n, 16] as Part);

  const band = m.room('quarters');
  m.arc(band, IN + 2, R);
  const ring = m.hall();
  m.arc(ring, IN, IN + 2);

  // Freight: the warehouse wing east with its freight dock; the ring runs straight past its inner face.
  const ware = room('cargo', 145, 28, -7, 46, 8, { rMax: 99 });
  m.regions[ware]!.doors = 2;
  box(ring, 26, -11, 28, 12, 99);
  const freight = room('dock', 21, 46, -2, 51, 3, { rMax: 99 });
  m.regions[freight]!.access = [ware];

  // Harbour wing north: concourse up the middle, docks at the tip corners, office and armoury west, shops east.
  const harbour = m.hall();
  box(harbour, -1, -50, 2, -6, 99);
  box(harbour, -3, -50, 4, -44, 99);
  room('dock', 21, -10, -50, -3, -44, { rMax: 99 });
  room('dock', 21, 4, -50, 11, -44, { rMax: 99 });
  room('bridge', 42, -10, -44, -1, -37, { rMax: 99 });
  room('armoury', 31, -10, -37, -1, -27, { rMax: 99 });
  room('shop', 21, 2, -44, 11, -37, { rMax: 99 });
  room('shop', 21, 2, -37, 11, -27, { rMax: 99 });
  m.arc(ring, IN, IN + 2); // the ring again, past the wing's foot
  box(harbour, -1, -50, 2, -6, 99);

  // Commons: market street, plaza, shops south of it, the garden and a bar north-west.
  const west = box(m.room('shop'), -8, -30, -1, -6);
  const east = box(m.room('shop'), 2, -30, 9, -6);
  box(m.hall('plaza'), -8, -6, 9, 6);
  const south = box(m.room('shop'), -8, 6, 9, 12);
  const street = m.hall();
  box(street, -28, -1, -8, 1);
  box(street, 9, -1, 28, 1);
  box(street, -1, 12, 1, 28);
  box(m.hall('garden'), -28, -12, -8, -1); // an open garden court; the bar opens onto it
  room('support', 35, -20, -18, -8, -12, { dept: 'commons' });
  // Freight inside the ring, beside the warehouse.
  const hold = room('cargo', 144, 9, -13, 28, -1);
  m.regions[room('cargo', 41, 9, -19, 20, -13)]!.access = [hold];
  // Voids open to space either side of the market street, beside the harbour wing.
  m.paint(-1, (x, y, r) => r < IN && y < cy - 18 && (x < cx - 8 || x >= cx + 9));
  m.paint(-1, (x, y, r) => r < IN && y < cy - 12 && y >= cy - 18 && (x < cx - 20 || x >= cx + 20));
  // Secure: engineering south-west.
  room('reactor', 42, -28, 1, -20, 12);
  room('shields', 42, -20, 1, -14, 12);
  room('shields', 42, -14, 1, -8, 12);
  room('core', 60, -28, 12, -14, 28);
  room('reactor', 30, -14, 12, -1, 17);
  room('plant', 45, -14, 17, -1, 28);
  // Habitation: medbay and a mess, then cabins either side of a 1-wide gallery off the south spoke.
  room('medbay', 52, 9, 1, 18, 8);
  room('support', 35, 18, 1, 28, 8);
  box(street, 1, 12, 9, 16);
  box(street, 1, 15, 28, 16);
  const upper = room('quarters', undefined, 9, 8, 28, 15);
  const lower = room('quarters', undefined, 1, 16, 28, 28);

  const shops = (n: number): Part[] => Array.from({ length: n }, () => ['shop', 1, 21] as Part);
  m.slice(west, 0, 360, shops(4), { axis: 'y' });
  m.slice(east, 0, 360, shops(4), { axis: 'y' });
  m.slice(south, 0, 360, shops(3), { axis: 'x' });
  m.slice(upper, 0, 360, cab(3, 3), { axis: 'x' });
  m.slice(lower, 0, 360, cab(3, 3), { axis: 'x' });
  // The band, clockwise from the warehouse. Diagonal rooms: the mess (habitation), two holds (freight) and a garden
  // (commons). The 36-degree part at 253 is the harbour wing, the 26-degree one the warehouse (no floor of their own).
  m.around(band, 14, [
    ['weapons', 14, 16], ['support', 34, 93], ...cab(7, 56), ['cargo', 34, 37], ['weapons', 8, 16], ...cab(5, 40),
    ['weapons', 8, 16], ['garden', 34, 139], ['shop', 11, 21], ['cargo', 36], ['shop', 11, 21], ['cargo', 34, 38],
    ['quarters', 14, 16], ['cargo', 26],
  ]);
  return m.clean().build('trading A');
}
