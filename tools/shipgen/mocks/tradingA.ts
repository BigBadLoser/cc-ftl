/**
 * Trading A, "harbour wheel": stair-stepped round hull, rooms against it, a 2-wide main ring. A 3-wide harbour arm runs
 * out north to a dock hub, and in through a market street lined with shops to a central plaza. A big rectangular
 * warehouse breaks out of the east side with its own freight dock (the ring runs straight past its inner face).
 * Inside the ring: holds and harbour control north, engineering and the infirmary south, rectilinear blocks.
 */
import { Mock } from './mockKit';
import type { RoomRole } from '../../../src/sim';

export function tradingA(): ReturnType<Mock['build']> {
  const m = new Mock(102, 100, 44, 57);
  const { cx, cy } = m;
  const R = 38, IN = 28;
  const box = (id: number, x0: number, y0: number, x1: number, y1: number, rMax = IN): number => {
    m.paint(id, (x, y, r) => x >= cx + x0 && x < cx + x1 && y >= cy + y0 && y < cy + y1 && r < rMax);
    return id;
  };
  const room = (role: RoomRole, x0: number, y0: number, x1: number, y1: number, doors = 1): number => box(m.room(role, { doors }), x0, y0, x1, y1);

  const band = m.room('quarters');
  m.arc(band, IN + 2, R);
  const ring = m.hall();
  m.arc(ring, IN, IN + 2);

  // Warehouse wing east, freight dock on its end; the ring runs straight past it.
  const ware = box(m.room('cargo', { doors: 2 }), 28, -7, 46, 8, 99);
  box(ring, 26, -11, 28, 12, 99);
  const freight = box(m.room('dock'), 46, -2, 51, 3, 99);
  m.regions[freight]!.access = [ware];

  // Harbour arm north: 3-wide concourse from the plaza out past the hull to a dock hub.
  const harbour = m.hall();
  box(harbour, -2, -46, 3, -R, 99);
  box(harbour, -1, -R, 2, -6, 99);
  box(harbour, -9, -50, 10, -46, 99);
  for (const x0 of [-8, -2, 4]) box(m.room('dock'), x0, -56, x0 + 5, -50, 99);
  // Market street: shops both sides of the concourse.
  const west = box(m.room('shop'), -8, -30, -1, -6);
  const east = box(m.room('shop'), 2, -30, 9, -6);
  // Plaza, shops on its south side, cross street.
  box(m.hall('plaza'), -8, -6, 9, 6);
  const south = box(m.room('shop'), -8, 6, 9, 12);
  const street = m.hall();
  box(street, -28, -1, -8, 1);
  box(street, 9, -1, 28, 1);
  // South spoke from the plaza's shops to the ring.
  box(street, -1, 12, 1, 28);

  // North quadrants: holds west, harbour control east.
  room('cargo', -28, -14, -8, -1);
  room('support', -28, -28, -8, -14);
  room('bridge', 9, -14, 20, -1);
  room('armoury', 20, -14, 28, -1);
  room('garden', 9, -28, 28, -14);
  // South quadrants: engineering west, infirmary and mess east.
  room('reactor', -28, 1, -14, 12);
  room('shields', -14, 1, -8, 12);
  room('core', -28, 12, -12, 28);
  room('shields', -12, 12, -1, 28);
  room('medbay', 9, 1, 28, 12);
  // Cabin block on a 1-wide gallery off the south spoke.
  box(street, 1, 19, 28, 20);
  const upper = box(m.room('quarters'), 1, 12, 28, 19);
  const lower = box(m.room('quarters'), 1, 20, 28, 28);

  m.slice(west, 0, 360, ['shop', 'shop', 'shop', 'shop'], { axis: 'y' });
  m.slice(east, 0, 360, ['shop', 'shop', 'shop', 'shop'], { axis: 'y' });
  m.slice(south, 0, 360, ['shop', 'shop', 'shop'], { axis: 'x' });
  m.slice(upper, 0, 360, Array(4).fill('quarters'), { axis: 'x' });
  m.slice(lower, 0, 360, Array(4).fill('quarters'), { axis: 'x' });
  // Outer band, clockwise from the warehouse (0 = east, 90 = south). Big rooms span the diagonals.
  const q = (n: number, deg: number): [RoomRole, number][] => Array.from({ length: n }, () => ['quarters', deg / n]);
  m.around(band, 14, [
    ['weapons', 14], ['garden', 34], ...q(6, 56), ['cargo', 34], ['weapons', 8], ...q(4, 40), ['weapons', 8],
    ['plant', 34], ['shop', 14], ['shop', 14], ['shop', 14], ['shop', 14], ['cargo', 34], ['quarters', 14],
  ]);
  return m.clean().build('trading A');
}
