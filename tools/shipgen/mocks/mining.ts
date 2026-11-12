/**
 * Mining, "ore spine": a rectangular processing spine runs straight through the wheel east-west and breaks out of the
 * hull at both ends with ore docks. Inside it: a 3-wide haul street, the two industry halls and a row of holds. The
 * main ring is two arcs that join the haul street at each end (one continuous loop). North of the spine: the civil half
 * (cabins against the hull, mess, medbay, office, armoury, a small court); south: engineering and more holds.
 */
import { Mock } from './mockKit';
import type { RoomRole } from '../../../src/sim';

export function mining(): ReturnType<Mock['build']> {
  const m = new Mock(124, 92, 62, 46);
  const { cx, cy } = m;
  const box = (id: number, x0: number, y0: number, x1: number, y1: number, rMax = 99): number => {
    m.paint(id, (x, y, r) => x >= cx + x0 && x < cx + x1 && y >= cy + y0 && y < cy + y1 && r < rMax);
    return id;
  };
  const q = (n: number, deg: number, role: RoomRole = 'quarters'): [RoomRole, number][] => Array.from({ length: n }, () => [role, deg / n]);

  const band = m.room('quarters');
  m.arc(band, 30, 38);
  const ring = m.hall();
  m.arc(ring, 28, 30);
  const north = m.room('support');
  m.paint(north, (_x, y, r) => r < 28 && y < cy - 10);
  const south = m.room('cargo');
  m.paint(south, (_x, y, r) => r < 28 && y >= cy + 10);

  // The spine: haul street, industry halls north of it, holds south; ends out past the hull to ore docks.
  const street = m.hall();
  box(street, -48, -1, 48, 2);
  const hallsN = m.room('industry');
  box(hallsN, -38, -10, 38, -1);
  const holdsS = m.room('cargo');
  box(holdsS, -38, 2, 38, 10);
  box(street, -48, -10, -38, 10);
  box(street, 38, -10, 48, 10);
  for (const s of [1, -1]) for (const y0 of [-10, 3]) {
    const x0 = s > 0 ? 48 : -55;
    box(m.room('dock'), x0, y0, x0 + 7, y0 + 7);
  }
  // A spoke north to the civil court, one south to engineering.
  box(street, -1, -28, 2, -10, 28);
  box(street, -1, 10, 2, 28, 28);

  m.slice(hallsN, 0, 360, ['cargo', 'industry', 'cargo', 'industry', 'cargo'], { axis: 'x' });
  m.slice(holdsS, 0, 360, Array(8).fill('cargo'), { axis: 'x' });
  // North half: civil rooms around a small court on the north spoke.
  m.paint(m.hall('plaza'), (x, y, r) => r < 28 && x >= cx - 6 && x < cx + 7 && y < cy - 10);
  m.within(north, m.room('medbay'), (x, y) => x < cx - 6 && y >= cy - 20);
  m.within(north, m.room('bridge'), (x, y) => x >= cx + 7 && y >= cy - 20);
  m.within(north, m.room('armoury'), (x, y) => x >= cx + 7 && y < cy - 20);
  m.within(north, m.room('plant'), (x, y) => x < cx - 6 && y < cy - 20);
  // South half: engineering.
  m.within(south, m.room('reactor'), (x, y) => x < cx - 1 && y < cy + 20);
  m.within(south, m.room('shields'), (x, y) => x >= cx + 2 && y < cy + 20);
  m.within(south, m.room('core'), (x, y) => x >= cx + 2 && y >= cy + 20);
  m.within(south, m.room('plant'), (x, y) => x < cx - 1 && y >= cy + 20);
  // The band: cabins north, holds and gun bays south; big rooms span the diagonals.
  m.around(band, 14, [
    ['weapons', 16], ['cargo', 34], ...q(4, 28), ...q(4, 28), ['cargo', 34], ['weapons', 16],
    ['weapons', 32], ['support', 34], ...q(6, 28), ...q(6, 28), ['support', 34], ['weapons', 32],
  ]);
  return m.clean().build('mining');
}
