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
/** Band rooms are at most this many tiles deep (from the pocket's wall), and at least MIN_SIDE on each side. */
const BAND_DEPTH = 4;
const MIN_SIDE = 3;

/**
 * Line the inside edge of a big pocket with rooms, by constrained growth (Lopes et al. 2010; docs/LAYOUT_RESEARCH.md).
 * Walking the pocket's edge, each free edge tile seeds a room that grows as a rectangle, one side at a time, up to
 * BAND_DEPTH deep and the length of the station's own room of that role; rooms keep a one-tile wall between them. Up to
 * four straight passages, three tiles wide, run in from the corridors and stay open, so the court left in the middle
 * opens onto the corridors. Curves get only the rectangles that fit; the rest of the edge stays court. Each room doors
 * onto the corridor it touches, else onto the court. Returns the court's tiles (canvas indices), passages included;
 * the band is stamped here.
 */
function band(b: Builder, pocket: number[], kinds: readonly RoomRole[], halls: Set<number>, key: string): number[] {
  const cv = b.cv;
  const S = cv.size;
  const off = S >> 1;
  const inP = new Set(pocket);
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  const nb = (k: number): number[] => N4.map(([dx, dy]) => k + dy * S + dx);
  const nb8 = (k: number): number[] => [-S - 1, -S, -S + 1, -1, 1, S - 1, S, S + 1].map((d) => k + d);
  const xy = (k: number): [number, number] => [(k % S) - off, Math.floor(k / S) - off];
  // Depth from the pocket's edge.
  const depth = new Map<number, number>();
  const edge = pocket.filter((k) => nb(k).some((j) => !inP.has(j)));
  const queue = [...edge];
  for (const k of queue) depth.set(k, 0);
  for (let i = 0; i < queue.length; i++) {
    const k = queue[i] as number;
    for (const j of nb(k)) if (inP.has(j) && !depth.has(j)) { depth.set(j, (depth.get(k) as number) + 1); queue.push(j); }
  }
  if (pocket.filter((k) => (depth.get(k) as number) > BAND_DEPTH).length < 40) return pocket;
  const cx = pocket.reduce((t, k) => t + xy(k)[0], 0) / pocket.length;
  const cy = pocket.reduce((t, k) => t + xy(k)[1], 0) / pocket.length;
  const ang = (k: number): number => Math.atan2(xy(k)[1] - cy, xy(k)[0] - cx);
  edge.sort((p, q) => ang(p) - ang(q));
  // A tile with a wall next to it and a corridor straight across: the wall tile (a door spot onto that corridor).
  const hallSpot = (k: number): number | null => {
    for (const [dx, dy] of N4) {
      const w = k + dy * S + dx;
      const [wx, wy] = xy(w);
      if (cv.at(wx, wy) === '#' && halls.has(cv.labelAt(wx + dx, wy + dy))) return w;
    }
    return null;
  };
  // Passages: up to four straight strips, three wide, from a corridor wall in past the band, spread round the pocket.
  const onHall = edge.filter((k) => hallSpot(k) !== null);
  const reserved = new Set<number>();
  const want = Math.min(4, onHall.length);
  for (let i = 0; i < want; i++) {
    const k = onHall[Math.floor(((i + 0.5) * onHall.length) / want)] as number;
    const d = (hallSpot(k) as number) - k;
    const side = Math.abs(d) === 1 ? S : 1;
    for (let t = 0; t <= BAND_DEPTH + 1; t++) for (let s = -1; s <= 1; s++) if (inP.has(k - t * d + s * side)) reserved.add(k - t * d + s * side);
  }
  // Roles the station plans rooms of (a band room is furnished like one of them, and sized like it).
  const planned = kinds.filter((r) => b.parts.some((p) => p.spec?.role === r));
  const roles = planned.length > 0 ? planned : kinds;
  const specOf = (r: RoomRole) => b.parts.find((p) => p.spec?.role === r)?.spec;
  // Growth: a tile is free for room r if it is in the band, unclaimed, clear of the passages, and no other room's floor
  // touches it (eight neighbours), so neighbours keep one wall between them.
  const owner = new Map<number, number>();
  const free = (k: number, r: number): boolean =>
    inP.has(k) && !owner.has(k) && !reserved.has(k) && (depth.get(k) as number) < BAND_DEPTH &&
    nb8(k).every((j) => !reserved.has(j) && (owner.get(j) ?? r) === r);
  const rooms: { floor: number[]; role: RoomRole }[] = [];
  for (const seed of edge) {
    const r = rooms.length;
    if (!free(seed, r)) continue;
    const role = roles[r % roles.length] as RoomRole;
    const long = Math.max(5, Math.min(9, specOf(role)?.w ?? 7));
    let [x0, y0] = xy(seed);
    let [x1, y1] = [x0, y0];
    const at = (x: number, y: number): number => (y + off) * S + x + off;
    const strip = (side: number): number[] => {
      const out: number[] = [];
      if (side === 0) for (let y = y0; y <= y1; y++) out.push(at(x1 + 1, y));
      if (side === 1) for (let y = y0; y <= y1; y++) out.push(at(x0 - 1, y));
      if (side === 2) for (let x = x0; x <= x1; x++) out.push(at(x, y1 + 1));
      if (side === 3) for (let x = x0; x <= x1; x++) out.push(at(x, y0 - 1));
      return out;
    };
    owner.set(seed, r);
    for (let grew = true; grew;) {
      grew = false;
      for (let side = 0; side < 4; side++) {
        const w = x1 - x0 + 1 + (side < 2 ? 1 : 0);
        const h = y1 - y0 + 1 + (side >= 2 ? 1 : 0);
        if (Math.max(w, h) > long || Math.min(w, h) > BAND_DEPTH) continue;
        const add = strip(side);
        if (!add.every((k) => free(k, r))) continue;
        for (const k of add) owner.set(k, r);
        if (side === 0) x1++; else if (side === 1) x0--; else if (side === 2) y1++; else y0--;
        grew = true;
      }
    }
    const floor = [...owner.entries()].filter(([, o]) => o === r).map(([k]) => k);
    if (Math.min(x1 - x0, y1 - y0) + 1 < MIN_SIDE) { for (const k of floor) owner.delete(k); continue; }
    rooms.push({ floor, role });
  }
  // The rest of the pocket: tiles touching a room are its walls, everything else is court (one piece; slivers wall).
  const walls = pocket.filter((k) => !owner.has(k) && nb8(k).some((j) => owner.has(j)));
  const wall = new Set(walls);
  const open = pocket.filter((k) => !owner.has(k) && !wall.has(k));
  const pieces: number[][] = [];
  const seen = new Set<number>();
  const openSet = new Set(open);
  for (const k of open) {
    if (seen.has(k)) continue;
    const comp = [k];
    seen.add(k);
    for (let q = 0; q < comp.length; q++) for (const j of nb(comp[q] as number)) if (openSet.has(j) && !seen.has(j)) { seen.add(j); comp.push(j); }
    pieces.push(comp);
  }
  pieces.sort((p, q) => q.length - p.length);
  const [court = [], ...slivers] = pieces;
  // L-growth (the method's second phase): a sliver cut off from the court joins the room beside it, through the wall
  // tiles that touch only that room and the sliver; one with no such room becomes wall.
  const roomOf = (k: number): number | undefined => owner.get(k);
  for (const sliver of slivers) {
    const mineS = new Set(sliver);
    const joins = new Map<number, Set<number>>();
    for (const k of sliver) {
      for (const j of nb(k)) {
        if (!wall.has(j)) continue;
        const rs = new Set(nb8(j).flatMap((a) => { const o = roomOf(a); return o === undefined ? [] : [o]; }));
        const other = nb8(j).some((a) => !mineS.has(a) && !owner.has(a) && !wall.has(a) && inP.has(a));
        if (rs.size !== 1 || other) continue;
        const r = [...rs][0] as number;
        // It must join the two edge to edge, not only at a corner.
        if (!nb(j).some((a) => owner.get(a) === r)) continue;
        (joins.get(r) ?? joins.set(r, new Set()).get(r)!).add(j);
      }
    }
    const [r, via] = [...joins.entries()].sort((p, q) => q[1].size - p[1].size)[0] ?? [];
    if (r === undefined || !via) { for (const k of sliver) wall.add(k); continue; }
    for (const k of [...sliver, ...via]) { wall.delete(k); owner.set(k, r); (rooms[r] as { floor: number[] }).floor.push(k); }
  }
  // No corridor to door the court onto: leave the pocket a plain court.
  if (rooms.length < 3 || !court.some((k) => hallSpot(k) !== null)) return pocket;
  const courtSet = new Set(court);
  // Doors: onto the corridor the room touches, else onto the court, mid-side. A door's two side tiles must be wall or
  // this room (a door touching a third room's floor reads as its door too, and door pruning may close it).
  const doors: number[] = [];
  const kept: { floor: number[]; role: RoomRole }[] = [];
  for (const room of rooms) {
    const mine = new Set(room.floor);
    const flush = (w: number, k: number): boolean => {
      const along = Math.abs(w - k) === 1 ? S : 1;
      return [w - along, w + along].every((j) => mine.has(j) || wall.has(j) || cv.at(...xy(j)) === '#');
    };
    const toHall = room.floor.flatMap((k) => { const w = hallSpot(k); return w !== null && flush(w, k) ? [w] : []; });
    const toCourt = room.floor.flatMap((k) => N4.flatMap(([dx, dy]) => {
      const w = k + dy * S + dx;
      return wall.has(w) && courtSet.has(k + 2 * (dy * S + dx)) && flush(w, k) ? [w] : [];
    }));
    const spots = toHall.length > 0 ? toHall : toCourt;
    const door = spots[spots.length >> 1];
    if (door === undefined) { for (const k of room.floor) wall.add(k); continue; }
    doors.push(door);
    kept.push(room);
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
  kept.forEach((r, i) => {
    const letter = letterOf(r.role);
    stampSet(r.floor, letter, `${key}:band${i}`);
    cv.setDoor(...xy(doors[i] as number));
    // Furnished like the station's own room of that role (one of each of its modules, the same stock).
    const like = specOf(r.role);
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
