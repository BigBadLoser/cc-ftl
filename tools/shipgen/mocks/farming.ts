/**
 * Farming, "greenhouse hub": the kind shows as a ring around a square hub with open space between them. The hub is
 * four straight rectangular greenhouse halls (planter rows need straight runs) round a small court, with a row of
 * cabins on a 1-wide gallery along its north and south sides. Bridge spokes cross the voids to the main ring. The ring
 * band holds the secure block east, cabins south and west, the harbour north (a dock bank on the flat top with the
 * office and armoury beside it) and one big common room across each diagonal.
 */
import { Mock, type Part } from './mockKit';
import type { RoomRole } from '../../../src/sim';

export function farming(): ReturnType<Mock['build']> {
  const m = new Mock(92, 96, 46, 50);
  const { cx, cy } = m;
  const IN = 28, HUB = 19;
  const box = (id: number, x0: number, y0: number, x1: number, y1: number): number => {
    m.paint(id, (x, y) => x >= cx + x0 && x < cx + x1 && y >= cy + y0 && y < cy + y1);
    return id;
  };
  const room = (role: RoomRole, target: number | undefined, x0: number, y0: number, x1: number, y1: number): number => box(m.room(role, { target }), x0, y0, x1, y1);
  const cab = (n: number, deg: number): Part[] => Array.from({ length: n }, () => ['quarters', deg / n, 20] as Part);

  const band = m.room('quarters');
  m.arc(band, IN + 2, 38);
  const ring = m.hall();
  m.arc(ring, IN, IN + 2);

  // The hub: farm halls round a court, cabins on galleries north and south. Everything else inside the ring is void.
  const street = m.hall();
  for (const sy of [-1, 1]) {
    const y0 = sy < 0 ? -10 : 1, y1 = sy < 0 ? -1 : 10;
    room('farm', 122, -HUB, y0, -1, y1);
    room('farm', 109, 2, y0, HUB, y1);
    box(street, -HUB, sy < 0 ? -11 : 10, HUB, sy < 0 ? -10 : 11); // gallery
    const rowY0 = sy < 0 ? -HUB : 11, rowY1 = sy < 0 ? -11 : HUB;
    m.slice(room('quarters', undefined, -HUB, rowY0, -1, rowY1), 0, 360, cab(4, 4), { axis: 'x' });
    m.slice(room('quarters', undefined, 2, rowY0, HUB, rowY1), 0, 360, cab(4, 4), { axis: 'x' });
  }
  // Spokes: 3-wide north-south, 2-wide east-west; painted wider where they bridge the voids (space takes the edge tiles).
  box(street, -1, -IN, 2, IN);
  box(street, -2, -IN, 3, -HUB);
  box(street, -2, HUB, 3, IN);
  box(street, -IN, -1, IN, 1);
  box(street, -IN, -2, -HUB, 2);
  box(street, HUB, -2, IN, 2);
  box(m.hall('plaza'), -5, -5, 6, 5);
  m.arc(ring, IN, IN + 2);

  // Harbour north: the concourse through the band to a dock bank that steps out of the flat top.
  room('dock', 24, -8, -41, -1, -28);
  room('dock', 24, 2, -41, 9, -28);
  m.arc(ring, IN, IN + 2); // the ring again, under the dock bank
  box(street, -1, -38, 2, -IN);

  // The band, clockwise from the dock bank: the office, a mess across the north-east diagonal, the secure block east,
  // a common room across the south-east, the medbay and cabins south, a hold across the south-west, cabins and gun bays
  // west, a garden across the north-west, the armoury. The last part is the dock bank (no floor of its own).
  m.around(band, 285.5, [
    ['bridge', 12, 53], ['support', 40, 77, 'commons'], ['weapons', 8.5, 16], ['reactor', 12, 42], ['core', 12.5, 45], ['shields', 12, 42],
    ['support', 45, 55, 'commons'], ['medbay', 15, 53], ...cab(4, 30), ['cargo', 45, 75], ['weapons', 7.5, 16], ...cab(4, 30), ['weapons', 7.5, 16],
    ['garden', 40, 103], ['armoury', 12, 53], ['cargo', 31],
  ]);
  return m.clean().build('farming');
}
