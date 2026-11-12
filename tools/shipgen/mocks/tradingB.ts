/**
 * Trading B, "faceted bazaar": a 16-sided hull and main ring (flat faces, so every divider and arm can land on a
 * flat), concentric inside: an octagonal plaza ringed by shops and a 2-wide inner ring, four axis spokes, departments
 * between the rings. Dock arms east (three docks) and west (one); a cargo bay breaks out of the south face with its
 * freight dock. Rooms that span a diagonal face are the big ones, so no divider meets a one-step stair.
 */
import { Mock, polyR } from './mockKit';
import type { RoomRole } from '../../../src/sim';

export function tradingB(): ReturnType<Mock['build']> {
  const m = new Mock(112, 100, 52, 44);
  const { cx, cy } = m;
  const S = 16;
  const box = (id: number, x0: number, y0: number, x1: number, y1: number, rMax = 99): number => {
    m.paint(id, (x, y, r, a) => x >= cx + x0 && x < cx + x1 && y >= cy + y0 && y < cy + y1 && polyR(r, a, S) < rMax);
    return id;
  };
  const q = (n: number, deg: number, role: RoomRole = 'quarters'): [RoomRole, number][] => Array.from({ length: n }, () => [role, deg / n]);

  const band = m.room('quarters');
  m.arc(band, 30, 38, 0, 360, S);
  const ring = m.hall();
  m.arc(ring, 28, 30, 0, 360, S);
  const dept = m.room('cargo');
  m.paint(dept, (_x, _y, r, a) => polyR(r, a, S) < 28 && polyR(r, a, 8) >= 17);
  const iring = m.hall();
  m.arc(iring, 15, 17, 0, 360, 8);
  const shops = m.room('shop');
  m.arc(shops, 8, 15, 0, 360, 8);
  // Spokes on the axes, plaza to main ring.
  const spoke = m.hall();
  box(spoke, -1, -28, 1, 28, 28);
  box(spoke, -28, -1, 28, 1, 28);
  m.arc(m.hall('plaza'), 0, 8, 0, 360, 8);

  // East arm to a three-dock hub, short west arm to one dock.
  const arm = m.hall();
  box(arm, 28, -1, 46, 2);
  box(arm, 38, -2, 47, 3);
  box(arm, 46, -10, 51, 11);
  for (const y0 of [-10, -3, 4]) box(m.room('dock'), 51, y0, 57, y0 + 7);
  box(arm, -38, -1, -28, 2);
  box(arm, -44, -2, -38, 3);
  box(m.room('dock'), -50, -3, -44, 4);
  // Cargo bay out of the south face, freight dock on its end.
  const bay = box(m.room('cargo', { doors: 1 }), -6, 30, 7, 48);
  const freight = box(m.room('dock'), -2, 48, 3, 54);
  m.regions[freight]!.access = [bay];

  const quad: [RoomRole, number][] = [['shop', 22.5], ['shop', 45], ['shop', 22.5]];
  m.around(shops, 0, [...quad, ...quad, ...quad, ...quad]);
  m.around(dept, 0, [
    ['shields', 22.5], ['reactor', 45], ['core', 22.5],
    ['medbay', 22.5], ['support', 45], ['plant', 22.5],
    ['cargo', 22.5], ['cargo', 45], ['weapons', 22.5],
    ['armoury', 22.5], ['bridge', 45], ['shields', 22.5],
  ]);
  m.around(band, 0, [
    ...q(3, 22.5), ['garden', 45], ...q(2, 22.5), ...q(2, 22.5), ['cargo', 45], ['weapons', 7.5], ...q(2, 15),
    ...q(2, 15), ['weapons', 7.5], ['plant', 45], ...q(6, 45), ['support', 45], ['weapons', 7.5], ...q(2, 15),
  ]);
  return m.clean().build('trading B');
}
