/**
 * Mining, "ore spine": a rectangular processing spine runs straight through the wheel east-west and out past the hull
 * at both ends: a 3-wide haul street with works and freight along it, ore holds on the parts outside the hull, docks at
 * the tips. Engineering (secure) sits mid-spine. The main ring is two arcs joining the haul street at each end. North of
 * the spine: the civil half (a court on the north spoke, medbay, mess, harbour office and armoury, cabins against the
 * hull); south: two voids open to space either side of a short spoke lined with plant rooms and ore bins.
 */
import { Mock, type Part } from './mockKit';

export function mining(): ReturnType<Mock['build']> {
  const m = new Mock(124, 92, 62, 46);
  const { cx, cy } = m;
  const box = (id: number, x0: number, y0: number, x1: number, y1: number, rMax = 99): number => {
    m.paint(id, (x, y, r) => x >= cx + x0 && x < cx + x1 && y >= cy + y0 && y < cy + y1 && r < rMax);
    return id;
  };
  const cab = (n: number, deg: number): Part[] => Array.from({ length: n }, () => ['quarters', deg / n, 16] as Part);
  // Band rooms that fall wholly inside the spine (the two 32-degree parts) end up with no floor and drop out.

  const band = m.room('quarters');
  m.arc(band, 30, 38);
  const ring = m.hall();
  m.arc(ring, 28, 30);
  const north = m.room('support');
  m.paint(north, (_x, y, r) => r < 28 && y < cy - 9);
  // South interior: open to space except the spoke and its rooms.
  m.paint(-1, (_x, y, r) => r < 28 && y >= cy + 10);

  // The spine: north row, haul street, south row; out past the hull to ore holds and tip docks.
  const street = m.hall();
  const rowN = box(m.room('cargo'), -48, -9, 48, -1);
  const rowS = box(m.room('cargo'), -48, 2, 48, 10);
  for (const x0 of [48, -55]) for (const y0 of [-9, 2]) box(m.room('dock', { target: 21 }), x0, y0, x0 + 7, y0 + 8);
  box(street, -55, -1, 55, 2);
  // Spokes: north to the court, south between the voids.
  box(street, -1, -28, 2, -9, 28);
  box(street, -1, 10, 2, 28, 28);

  m.slice(rowN, 0, 360, [
    ['cargo', 10, 96], ['industry', 13, 89], ['cargo', 7, 43], ['reactor', 5, 30], ['shields', 4, 16], ['core', 5, 27],
    ['shields', 4, 16], ['reactor', 4, 20], ['cargo', 7, 42], ['industry', 13, 86], ['cargo', 10, 96],
  ], { axis: 'x' });
  m.slice(rowS, 0, 360, [
    ['cargo', 10, 50], ['cargo', 7, 48], ['cargo', 7, 42], ['cargo', 7, 41], ['plant', 6, 30], ['plant', 6, 29],
    ['cargo', 7, 38], ['cargo', 7, 34], ['cargo', 7, 30], ['cargo', 10, 50],
  ], { axis: 'x' });

  // North: a court on the spoke; medbay and mess west, armoury and mess east; two rows of cabins behind.
  m.paint(m.hall('plaza'), (x, y, r) => r < 28 && x >= cx - 6 && x < cx + 7 && y >= cy - 21 && y < cy - 9);
  const nRoom = (role: Parameters<Mock['room']>[0], target: number | undefined, x0: number, y0: number, x1: number, y1: number): number => {
    const id = m.room(role, { target });
    m.paint(id, (x, y) => m.own[y * m.w + x] === north && x >= cx + x0 && x < cx + x1 && y >= cy + y0 && y < cy + y1);
    return id;
  };
  nRoom('support', 30, -26, -16, -17, -9);
  nRoom('medbay', 54, -17, -16, -6, -9);
  nRoom('armoury', 51, 7, -16, 16, -9);
  nRoom('support', 30, 16, -16, 26, -9);
  nRoom('quarters', 32, -17, -22, -6, -16); // a bunk room each side, opening on the court
  nRoom('quarters', 32, 7, -22, 18, -16);
  m.paint(-1, (x, y) => m.own[y * m.w + x] === north); // the rest: voids either side of the north spoke
  // South spoke between the two voids: a bar west, ore bins east.
  box(m.room('support', { target: 45, dept: 'commons' }), -8, 10, -1, 19, 28);
  for (const y0 of [10, 15, 20]) box(m.room('cargo', { target: 12 }), 2, y0, 7, y0 + 5, 28);

  // The band: gun bays beside the spine, holds across the south diagonals, a mess and the harbour office across the
  // north ones, cabins north and south. Cuts at 17.5 / 162.5 / 196 / 344 degrees land on the spine's edges; the two
  // parts between them lie inside the spine and drop out.
  m.around(band, 17.5, [
    ['weapons', 10, 16], ['cargo', 32.5, 34], ...cab(8, 60), ['cargo', 32.5, 34], ['weapons', 10, 16], ['cargo', 33.5],
    ['weapons', 10, 16], ['support', 34, 45], ...cab(8, 60), ['bridge', 34, 48], ['weapons', 10, 16], ['cargo', 33.5],
  ]);
  return m.clean().build('mining');
}
