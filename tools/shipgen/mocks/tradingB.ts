/**
 * Trading B, "faceted bazaar": a 16-sided hull and main ring, so every divider and wing lands on a flat face.
 * Concentric: a square plaza with shops in the corners inside a 2-wide octagonal inner ring, four axis spokes,
 * department rooms beside each spoke and voids open to space across the diagonals between the rings. Two inhabited wings sit flush on flat
 * faces: the harbour wing east (docks at its tip corners, customs office and armoury on its flanks) and the freight
 * wing west (the warehouse with its freight dock, small holds beside its passage).
 */
import { Mock, polyR, type Part } from './mockKit';
import type { RoomRole } from '../../../src/sim';

export function tradingB(): ReturnType<Mock['build']> {
  const m = new Mock(124, 84, 62, 42);
  const { cx, cy } = m;
  const S = 16;
  const box = (id: number, x0: number, y0: number, x1: number, y1: number, rMax = 99): number => {
    m.paint(id, (x, y, r, a) => x >= cx + x0 && x < cx + x1 && y >= cy + y0 && y < cy + y1 && polyR(r, a, S) < rMax);
    return id;
  };
  const room = (role: RoomRole, target: number, x0: number, y0: number, x1: number, y1: number): number => box(m.room(role, { target }), x0, y0, x1, y1);
  const cab = (n: number, deg: number): Part[] => Array.from({ length: n }, () => ['quarters', deg / n, 16] as Part);
  const VOID: Part = ['cargo', 45, undefined, 'void'];

  const band = m.room('quarters');
  m.arc(band, 30, 38, 0, 360, S);
  const ring = m.hall();
  m.arc(ring, 28, 30, 0, 360, S);
  const dept = m.room('cargo');
  m.paint(dept, (_x, _y, r, a) => polyR(r, a, S) < 28 && polyR(r, a, 8) >= 17);
  const iring = m.hall();
  m.arc(iring, 15, 17, 0, 360, 8);
  const spoke = m.hall();
  box(spoke, -1, -28, 1, 28, 28);
  box(spoke, -28, -1, 28, 1, 28);
  // Inside the inner ring: a square plaza and two shops in each quadrant, all straight-walled.
  const inOct = (x: number, y: number): boolean => {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
    return polyR(Math.hypot(dx, dy), ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360, 8) < 15;
  };
  for (const sx of [1, -1]) for (const sy of [1, -1]) {
    const shop = (pred: (ax: number, ay: number) => boolean): void => {
      const id = m.room('shop', { target: 21 });
      m.paint(id, (x, y) => {
        const ax = sx > 0 ? x - cx : cx - 1 - x, ay = sy > 0 ? y - cy : cy - 1 - y; // 0-based distance from the spokes
        return inOct(x, y) && ax >= 1 && ay >= 1 && pred(ax, ay);
      });
    };
    shop((ax, ay) => ax < 6 && ay >= 7);
    shop((ax) => ax >= 6);
  }
  m.paint(m.hall('plaza'), (x, y) => Math.abs(x + 0.5 - cx) < 7 && Math.abs(y + 0.5 - cy) < 7);

  // Harbour wing east, flush on the east face: concourse, office and armoury on the flanks, docks at the tip corners.
  const arm = m.hall();
  box(arm, 28, -1, 52, 2);
  room('cargo', 32, 30, -7, 38, -1);
  room('shop', 21, 30, 2, 38, 8);
  room('bridge', 42, 38, -7, 46, -1);
  room('armoury', 31, 38, 2, 46, 8);
  room('dock', 21, 46, -7, 52, -1);
  room('dock', 21, 46, 2, 52, 8);
  // Freight wing west: a passage through the band to the warehouse, its freight dock on the tip.
  box(arm, -38, -1, -28, 2);
  room('cargo', 38, -38, -7, -30, -1);
  room('cargo', 37, -38, 2, -30, 8);
  const ware = room('cargo', 145, -54, -7, -38, 8);
  m.regions[ware]!.access = [arm];
  m.regions[room('dock', 21, -59, -2, -54, 3)]!.access = [ware];

  // Department rooms flank each spoke; the diagonals between the rings are open to space.
  m.around(dept, 0, [
    ['shields', 22.5, 42], VOID, ['reactor', 22.5, 42], ['core', 22.5, 60], VOID, ['cargo', 22.5, 41],
    ['plant', 22.5, 45], VOID, ['quarters', 22.5, 64, 'habitation'], ['medbay', 22.5, 52], VOID, ['support', 22.5, 35],
  ]);
  // The band: one big room across each diagonal (cuts mid-way along the 22.5-degree faces, never at the 45-degree
  // face's corners), cabins along the north and south faces, gun bays by the wings. The 26-degree parts are the wings.
  m.around(band, 13, [
    ['weapons', 9.5, 16], ['support', 45, 93], ...cab(5, 45), ['cargo', 45, 144], ['weapons', 9.5, 16], ['cargo', 26],
    ['weapons', 9.5, 16], ['garden', 45, 139], ...cab(5, 45), ['garden', 45, 106], ['weapons', 9.5, 16], ['cargo', 26],
  ]);
  return m.clean().build('trading B');
}
