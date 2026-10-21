import type { Builder } from './builder';
import { letterOf } from './canvas';
import type { Rng } from '../rng';
import type { RoomRole } from './types';

/**
 * Courtyards as rooms: every space pocket a station block encloses (a ring's centre, the sectors between spokes, the
 * band between two rings) becomes one open, pressurised room of `role` (a concourse, a garden deck, a drill hall),
 * walled by the walls already round it. Doors open onto the corridors that bound it (up to four, spread round it) and,
 * now and then, onto a room beside it (shops opening onto the concourse).
 */
export function courtyards(b: Builder, rng: Rng, role: RoomRole, minTiles = 12, shopDoors = 0.35): number {
  const cv = b.cv;
  const S = cv.size;
  const c = cv.cells;
  let x0 = S, y0 = S, x1 = 0, y1 = 0;
  for (let k = 0; k < c.length; k++) {
    if (c[k] === '.') continue;
    const x = k % S;
    const y = (k - x) / S;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  if (x1 < x0) return 0;
  x0--; y0--; x1++; y1++;
  const W = x1 - x0 + 1;
  const mark = new Int32Array(W * (y1 - y0 + 1)).fill(-1);
  const at = (x: number, y: number): string => (x < x0 || y < y0 || x > x1 || y > y1 ? '.' : (c[y * S + x] as string));
  const fill = (sx: number, sy: number, id: number): number[] => {
    const out: number[] = [];
    const stack = [[sx, sy]];
    mark[(sy - y0) * W + sx - x0] = id;
    while (stack.length > 0) {
      const [x, y] = stack.pop() as [number, number];
      out.push(y * S + x);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < x0 || ny < y0 || nx > x1 || ny > y1) continue;
        const m = (ny - y0) * W + nx - x0;
        if (mark[m] !== -1 || at(nx, ny) !== '.') continue;
        mark[m] = id;
        stack.push([nx, ny]);
      }
    }
    return out;
  };
  // Open space first (from the frame), then every pocket left over.
  fill(x0, y0, 0);
  const off = S >> 1;
  const letter = letterOf(role);
  let n = 0;
  // Corridors by label (every hall part, plus round corridors stamped as hall letters), and rooms that may open a
  // shop door onto the court (never system rooms: their equipment needs every wall).
  const SHOPS: readonly RoomRole[] = ['cargo', 'support', 'quarters', 'farm', 'industry', 'armoury'];
  const halls = new Set<number>();
  const shops = new Set<number>();
  const roleByKey = new Map(b.parts.map((p) => [p.key, p.role]));
  cv.labels.forEach((l, L) => {
    const role = roleByKey.get(l.chunk) ?? (l.letter === letterOf('hall') ? 'hall' : undefined);
    if (role === 'hall') halls.add(L);
    else if (role && SHOPS.includes(role)) shops.add(L);
  });
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (mark[(y - y0) * W + x - x0] !== -1 || at(x, y) !== '.') continue;
      const cells = fill(x, y, n + 1);
      if (cells.length < minTiles) continue;
      // Stamp the pocket as floor: its walls are the ones already round it.
      const xs = cells.map((k) => (k % S) - off);
      const ys = cells.map((k) => Math.floor(k / S) - off);
      const bx = Math.min(...xs), by = Math.min(...ys);
      const rows = Array.from({ length: Math.max(...ys) - by + 1 }, () => Array<string>(Math.max(...xs) - bx + 1).fill('.'));
      xs.forEach((cx, i) => { (rows[(ys[i] as number) - by] as string[])[cx - bx] = letter; });
      const key = `court${n}`;
      if (!cv.stamp(rows.map((r) => r.join('')), bx, by, key)) continue;
      const me = cv.labelAt(xs[0] as number, ys[0] as number);
      // Door candidates: a wall with the court on one side and floor straight across.
      const hallDoors: [number, number, number][] = [];
      const roomDoors = new Map<number, [number, number][]>();
      xs.forEach((cx, i) => {
        const cy = ys[i] as number;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          if (cv.at(cx + dx, cy + dy) !== '#' || cv.at(cx + 2 * dx, cy + 2 * dy) !== '_') continue;
          const other = cv.labelAt(cx + 2 * dx, cy + 2 * dy);
          if (other === me || other < 0) continue;
          if (halls.has(other)) hallDoors.push([cx + dx, cy + dy, Math.atan2(cy, cx)]);
          else if (shops.has(other)) roomDoors.set(other, [...(roomDoors.get(other) ?? []), [cx + dx, cy + dy]]);
        }
      });
      hallDoors.sort((a, b) => a[2] - b[2]);
      const k = Math.min(4, hallDoors.length);
      for (let i = 0; i < k; i++) {
        const d = hallDoors[Math.floor(((i + 0.5) * hallDoors.length) / k)] as [number, number, number];
        cv.setDoor(d[0], d[1]);
      }
      let doors = k;
      for (const spots of roomDoors.values()) {
        if (doors > 0 && !rng.chance(shopDoors)) continue;
        const d = spots[spots.length >> 1] as [number, number];
        cv.setDoor(d[0], d[1]);
        doors++;
      }
      n++;
    }
  }
  return n;
}
