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
/** Pockets of at least this many tiles get a band of rooms round their inside edge. */
const BAND_MIN = 200;

/**
 * Line the inside edge of a big pocket with rooms. Tiles 0-3 deep (from the pocket's walls) are the band, depth 4 its
 * inner wall, the rest the court. The band is cut by angle round the pocket's middle into rooms of about 24 tiles with a
 * single wall between neighbours; up to four slices that touch a corridor stay open as passages from that corridor into
 * the court. Each room doors onto the corridor it touches, else onto the court. Returns the court's tiles (canvas
 * indices), passages included; the band is stamped here.
 */
function band(b: Builder, pocket: number[], kinds: readonly RoomRole[], halls: Set<number>, key: string): number[] {
  const cv = b.cv;
  const S = cv.size;
  const off = S >> 1;
  const inP = new Set(pocket);
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  const nb = (k: number): number[] => N4.map(([dx, dy]) => k + dy * S + dx);
  // Depth from the pocket's edge.
  const depth = new Map<number, number>();
  const queue = pocket.filter((k) => nb(k).some((j) => !inP.has(j)));
  for (const k of queue) depth.set(k, 0);
  for (let i = 0; i < queue.length; i++) {
    const k = queue[i] as number;
    for (const j of nb(k)) if (inP.has(j) && !depth.has(j)) { depth.set(j, (depth.get(k) as number) + 1); queue.push(j); }
  }
  const inner = pocket.filter((k) => (depth.get(k) as number) > 4);
  if (inner.length < 40) return pocket;
  const xy = (k: number): [number, number] => [(k % S) - off, Math.floor(k / S) - off];
  const cx = pocket.reduce((t, k) => t + xy(k)[0], 0) / pocket.length;
  const cy = pocket.reduce((t, k) => t + xy(k)[1], 0) / pocket.length;
  const ang = (k: number): number => Math.atan2(xy(k)[1] - cy, xy(k)[0] - cx);
  const ring = pocket.filter((k) => (depth.get(k) as number) <= 4).sort((p, q) => ang(p) - ang(q));
  // Slices by angle, about 24 floor tiles each.
  const slice = new Map<number, number>();
  let id = 0;
  let size = 0;
  for (const k of ring) {
    if (size >= 30 && (depth.get(k) as number) === 0) { id++; size = 0; }
    slice.set(k, id);
    size++;
  }
  const count = id + 1;
  if (count < 3) return pocket;
  // A slice's tile with a wall next to it and a corridor straight across (a door spot onto that corridor).
  const hallSpot = (k: number): number | null => {
    for (const [dx, dy] of N4) {
      const w = k + dy * S + dx;
      const [wx, wy] = xy(w);
      if (cv.at(wx, wy) === '#' && halls.has(cv.labelAt(wx + dx, wy + dy))) return w;
    }
    return null;
  };
  // Passages: up to four slices on a corridor, spread round the court.
  // A passage slice touches a corridor and reaches the court (a slice in a narrow corner may not).
  const reachesCourt = (k: number): boolean => depth.get(k) === 4 && nb(k).some((j) => (depth.get(j) ?? 0) > 4);
  const onHall = Array.from({ length: count }, (_, i) =>
    ring.some((k) => slice.get(k) === i && hallSpot(k) !== null) && ring.some((k) => slice.get(k) === i && reachesCourt(k)));
  const candidates = onHall.flatMap((h, i) => (h ? [i] : []));
  const want = Math.min(4, candidates.length);
  const passage = new Set(Array.from({ length: want }, (_, i) => candidates[Math.floor(((i + 0.5) * candidates.length) / want)] as number));
  // Walls: the band's inner edge (except in passages) and one line between neighbouring slices.
  const prev = (i: number): number => (i + count - 1) % count;
  const wall = new Set<number>();
  for (const k of ring) {
    const i = slice.get(k) as number;
    if (!passage.has(i) && (depth.get(k) as number) === 4) wall.add(k);
    if (passage.has(i) && passage.has(prev(i))) continue;
    if (nb(k).some((j) => slice.get(j) === prev(i))) wall.add(k);
  }
  // Connected floor pieces of a tile set, largest first.
  const pieces = (ks: Iterable<number>): number[][] => {
    const set = new Set(ks);
    const seen = new Set<number>();
    const out: number[][] = [];
    for (const k of set) {
      if (seen.has(k)) continue;
      const comp = [k];
      seen.add(k);
      for (let q = 0; q < comp.length; q++) for (const j of nb(comp[q] as number)) if (set.has(j) && !seen.has(j)) { seen.add(j); comp.push(j); }
      out.push(comp);
    }
    return out.sort((p, q) => q.length - p.length);
  };
  // The court: the inner tiles and the passages, in one piece (a slice wall can cut a corner of a passage off).
  const [court = [], ...cut] = pieces([...inner, ...ring.filter((k) => passage.has(slice.get(k) as number) && !wall.has(k))]);
  // No corridor to door the court onto (a pocket ringed by rooms): leave it a plain court.
  if (!court.some((k) => hallSpot(k) !== null)) return pocket;
  const courtSet = new Set(court);
  // Roles the station plans rooms of (a band room is furnished like one of them).
  const planned = kinds.filter((r) => b.parts.some((p) => p.spec?.role === r));
  const roles = planned.length > 0 ? planned : kinds;
  // Rooms: each slice's largest piece of floor. Scraps (and pieces too small for a room) join the room beside them
  // through the wall between, or else become wall; a lone slab of wall would be handed to the corridor by wall thinning.
  const floors: number[][] = [];
  const bits: number[][] = [];
  for (let i = 0; i < count; i++) {
    if (passage.has(i)) continue;
    const [best = [], ...scraps] = pieces(ring.filter((k) => slice.get(k) === i && !wall.has(k)));
    bits.push(...scraps);
    if (best.length >= 6) floors.push(best); else bits.push(best);
  }
  // Passage pieces a slice wall cut off from the court are band rooms too.
  for (const c of cut) if (c.length >= 6) floors.push(c); else bits.push(c);
  const owner = new Map<number, number>();
  floors.forEach((f, r) => { for (const k of f) owner.set(k, r); });
  for (const bit of bits) {
    const mineBit = new Set(bit);
    // Walls between the bit and exactly one room, touching nothing else open (the court, a passage, another room).
    const joins = new Map<number, number[]>();
    for (const k of bit) {
      for (const j of nb(k)) {
        if (!wall.has(j)) continue;
        const rs = new Set(nb(j).flatMap((a) => (owner.has(a) ? [owner.get(a) as number] : [])));
        const open = nb(j).some((a) => !mineBit.has(a) && !owner.has(a) && !wall.has(a) && cv.at(...xy(a)) !== '#');
        if (rs.size !== 1 || open) continue;
        const r = [...rs][0] as number;
        joins.set(r, [...(joins.get(r) ?? []), j]);
      }
    }
    const [r, via] = [...joins.entries()].sort((p, q) => q[1].length - p[1].length)[0] ?? [];
    if (r === undefined || !via) { for (const k of bit) wall.add(k); continue; }
    for (const k of [...bit, ...via]) { wall.delete(k); owner.set(k, r); (floors[r] as number[]).push(k); }
  }
  // Each room doors onto the corridor it touches, else onto the court; one with nowhere for a door becomes wall. A
  // door's two side tiles must be wall (or this room): a door tile touching a third room's floor on a stair-step reads as
  // that room's door too, and door pruning may close it.
  const rooms: { floor: number[]; role: RoomRole; door: number }[] = [];
  for (const best of floors) {
    const mine = new Set(best);
    const flush = (w: number, k: number): boolean => {
      const along = Math.abs(w - k) === 1 ? S : 1;
      return [w - along, w + along].every((j) => mine.has(j) || wall.has(j) || cv.at(...xy(j)) === '#');
    };
    const toHall = best.flatMap((k) => { const w = hallSpot(k); return w !== null && flush(w, k) ? [w] : []; });
    const toCourt = best.flatMap((k) => N4.flatMap(([dx, dy]) => {
      const w = k + dy * S + dx;
      return wall.has(w) && courtSet.has(k + 2 * (dy * S + dx)) && flush(w, k) ? [w] : [];
    }));
    const spots = toHall.length > 0 ? toHall : toCourt;
    const door = spots[spots.length >> 1];
    if (door === undefined) { for (const k of best) wall.add(k); continue; }
    rooms.push({ floor: best, role: roles[rooms.length % roles.length] as RoomRole, door });
  }
  const stampSet = (ks: number[], c: string, k2: string): boolean => {
    if (ks.length === 0) return true;
    const ps = ks.map(xy);
    const bx = Math.min(...ps.map((p) => p[0]));
    const by = Math.min(...ps.map((p) => p[1]));
    const rows = Array.from({ length: Math.max(...ps.map((p) => p[1])) - by + 1 }, () => Array<string>(Math.max(...ps.map((p) => p[0])) - bx + 1).fill('.'));
    ps.forEach(([px, py]) => { (rows[py - by] as string[])[px - bx] = c; });
    return cv.stamp(rows.map((r) => r.join('')), bx, by, k2);
  };
  if (!stampSet([...wall], '#', `${key}:band walls`)) return pocket;
  rooms.forEach((r, i) => {
    const letter = letterOf(r.role);
    stampSet(r.floor, letter, `${key}:band${i}`);
    cv.setDoor(...xy(r.door));
    // Furnished like the station's own room of that role (one of each of its modules, the same stock).
    const like = b.parts.find((p) => p.spec?.role === r.role)?.spec;
    if (like) b.chunkSpecs.set(`${key}:band${i}:${letter}`, { ...like, mods: [...new Set(like.mods)] });
  });
  return court;
}

export function courtyards(b: Builder, rng: Rng, role: RoomRole, bandRoles: readonly RoomRole[] = [], minTiles = 12, shopDoors = 0.35): number {
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
      const pocket = fill(x, y, n + 1);
      if (pocket.length < minTiles) continue;
      // Big pockets get a band of rooms round their inside edge; the court is what is left in the middle.
      const cells = pocket.length >= BAND_MIN && bandRoles.length > 0 ? band(b, pocket, bandRoles, halls, `court${n}`) : pocket;
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
