/**
 * Farming, "greenhouse torus": the whole outer band is four long curved greenhouses against the hull (the kind shows
 * in the outline: one continuous glass ring, no rooms cut across it). Inside: the main ring, a habitation band of
 * cabins with the big common rooms spanning the diagonals, an inner ring, a band of service rooms and a central garden
 * court. A dock arm north, a produce arm south to a freight dock; grain silos hang off east and west on 3-wide arms.
 */
import { Mock } from './mockKit';
import type { RoomRole } from '../../../src/sim';

export function farming(): ReturnType<Mock['build']> {
  const m = new Mock(124, 112, 62, 60);
  const { cx, cy } = m;
  const box = (id: number, x0: number, y0: number, x1: number, y1: number, rMax = 99): number => {
    m.paint(id, (x, y, r) => x >= cx + x0 && x < cx + x1 && y >= cy + y0 && y < cy + y1 && r < rMax);
    return id;
  };
  const q = (n: number, deg: number, role: RoomRole = 'quarters'): [RoomRole, number][] => Array.from({ length: n }, () => [role, deg / n]);

  const glass = m.room('farm');
  m.arc(glass, 32, 38);
  const ring = m.hall();
  m.arc(ring, 30, 32);
  const hab = m.room('quarters');
  m.arc(hab, 22, 30);
  const iring = m.hall();
  m.arc(iring, 20, 22);
  const service = m.room('support');
  m.arc(service, 12, 20);
  // Spokes on the axes from the court to the main ring.
  const spoke = m.hall();
  box(spoke, -1, -30, 1, 30, 30);
  box(spoke, -30, -1, 30, 1, 30);
  m.arc(m.hall('plaza'), 0, 12);

  // Dock arm north to two docks; silo connectors east and west, through the greenhouse ring.
  const arm = m.hall();
  box(arm, -1, -38, 2, -30);
  box(arm, -2, -46, 3, -38);
  box(arm, -9, -50, 10, -46);
  for (const x0 of [-9, 4]) box(m.room('dock'), x0, -56, x0 + 6, -50);
  for (const s of [1, -1]) {
    box(arm, s > 0 ? 30 : -38, -1, s > 0 ? 38 : -30, 2);
    box(arm, s > 0 ? 38 : -46, -2, s > 0 ? 46 : -38, 3);
    const silo = m.room('cargo');
    box(silo, s > 0 ? 46 : -58, -6, s > 0 ? 58 : -46, 7);
  }
  // South: a produce arm through the greenhouse ring to a freight dock.
  box(arm, -1, 30, 2, 38);
  box(arm, -2, 38, 3, 43);
  box(m.room('dock'), -3, 43, 4, 49);

  m.around(glass, 0, [['farm', 90], ['farm', 90], ['farm', 90], ['farm', 90]]);
  const habQuad = (big: RoomRole): [RoomRole, number][] => [...q(2, 22.5), [big, 45], ...q(2, 22.5)];
  m.around(hab, 0, [...habQuad('support'), ...habQuad('medbay'), ...habQuad('cargo'), ...habQuad('bridge')]);
  m.around(service, 0, [
    ['plant', 45], ['plant', 45], ['reactor', 45], ['shields', 45],
    ['support', 45], ['armoury', 45], ['core', 45], ['cargo', 45],
  ]);
  return m.clean().build('farming');
}
