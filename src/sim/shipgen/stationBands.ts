import type { Builder } from './builder';
import { letterOf } from './canvas';
import type { RoomSpec } from './plan';

/**
 * Ring-band rooms: the rooms of a round ring fill the band outside (or inside) its corridor as ring segments cut by
 * straight partition walls, so a round station reads as a solid ring of rooms with no plating gaps. Segments are
 * stair-stepped polygons (rooms need not be rectangles: fit-out works on any floor set). Each segment is sized to its
 * room's floor area and doored straight onto the corridor (or, failing that, onto its neighbour). Quarters marked for
 * cabins are cut as one segment a bed, each its own room doored onto the corridor; the first keeps the room's other
 * planned modules (life support).
 */

/** Floor a band cabin should keep: a bed, its locker, a clear side, and the stair-stepped partitions of a diagonal slice. */
const CABIN = 24;

/** A quarters room marked for cabins as one cabin spec a bed (the first with the room's other modules). */
function cabinsOf(r: RoomSpec): RoomSpec[] {
  const beds = r.mods.filter((m) => m === 'module.bed').length;
  if (!r.cabins || r.role !== 'quarters' || beds < 2) return [r];
  const others = r.mods.filter((m) => m !== 'module.bed');
  return Array.from({ length: beds }, (_, i) => ({ role: 'quarters', mods: ['module.bed', ...(i === 0 ? others : [])], w: 2, h: i === 0 && others.length > 0 ? 5 : 4, cabin: true }));
}

const TAU = Math.PI * 2;

/** Band depth that suits a set of rooms (about the side of the average room). */
export const bandDepth = (rooms: RoomSpec[]): number =>
  Math.max(4, Math.min(7, Math.round(Math.sqrt(rooms.reduce((t, r) => t + r.w * r.h, 0) / Math.max(1, rooms.length)))));

/** Corridor radius at which a band `depth` deep holds `rooms` over `share` of the circle (side 1 outboard). */
export function bandRadius(rooms: RoomSpec[], depth: number, share = 1, side: 1 | -1 = 1): number {
  const area = rooms.reduce((t, r) => t + (r.w + 1) * (r.h + 1), 0) * 1.1;
  return Math.ceil(area / (TAU * share * depth) - (side * (depth + 2)) / 2);
}

/** Floor a band may give its rooms over their planned area before a flexible band is made shallower. */
const SPARE = 1.5;

/**
 * Stamp `rooms` as segments of the band between the corridor (radius R, label `ring`) and radius R +- (depth + 1),
 * over the angle ranges `arcs`. Returns false if a room gets too little floor or no door. A `flex` band (nothing stands
 * beyond it) with floor to spare is made shallower, down to 4 deep, so its rooms keep about their planned size.
 */
export function bandRooms(b: Builder, R: number, ring: number, roomsIn: RoomSpec[], depth0: number, arcs: [number, number][], side: 1 | -1 = 1, tag = '', flex = false): boolean {
  if (roomsIn.length === 0) return true;
  let depth = depth0;
  if (flex) {
    const planned = roomsIn.reduce((t, r) => t + r.w * r.h, 0);
    for (let d = depth0; d >= 4; d--) {
      const c = cutBand(b, R, ring, roomsIn, d, arcs, side);
      if (!c) break;
      depth = d;
      if ([...c.floor.values()].reduce((t, f) => t + f.length, 0) <= planned * SPARE) break;
    }
  }
  // Cabins where the band is wide enough for them; else the quarters stay whole. A band still with floor to spare would
  // swell its cabins: a crew mess beside each cabin run takes the excess, so a cabin keeps about CABIN tiles.
  let cabins = roomsIn.flatMap(cabinsOf);
  let cut = cabins.length > roomsIn.length ? cutBand(b, R, ring, cabins, depth, arcs, side) : null;
  if (cut) {
    // Floor goes to segments by weight (w * h + 4): a cabin (weight 12) keeps about CABIN tiles when the band's whole
    // weight is (its floor) * 12 / CABIN. The messes make up the difference, shared out by cabin run.
    const cut0 = cut;
    const floorAll = [...cut0.floor.values()].reduce((t, c) => t + c.length, 0);
    const weight = cabins.reduce((t, r) => t + r.w * r.h + 4, 0);
    const want = Math.round((floorAll * 12) / CABIN - weight);
    const runs = roomsIn.filter((q) => cabinsOf(q).length > 1).length;
    // Walls take floor too, so the share is a guess: smaller messes are tried until every room keeps its floor.
    for (const k of [1, 0.7, 0.45, 0.25]) {
      if (want * k <= 24 || runs === 0) break;
      const share = (want * k) / runs;
      const withMess = roomsIn.flatMap((q) => {
        const cs = cabinsOf(q);
        // The mess in the middle of its cabin run, so every cabin is a short walk from it.
        const h = cs.length >> 1;
        return cs.length === 1 ? cs : [...cs.slice(0, h), { role: 'support' as const, mods: [], w: Math.max(2, Math.round((share - 4) / depth)), h: depth }, ...cs.slice(h)];
      });
      const again = cutBand(b, R, ring, withMess, depth, arcs, side);
      if (again) { cabins = withMess; cut = again; break; }
    }
  }
  const rooms = cut ? cabins : roomsIn;
  const plan = cut ?? cutBand(b, R, ring, rooms, depth, arcs, side);
  if (!plan) return false;
  const { floor, isFloor } = plan;
  const cv = b.cv;
  const key = (x: number, y: number): string => `${x},${y}`;
  for (const [s, r] of rooms.entries()) {
    const cells = floor.get(s) ?? [];
    const xs = cells.map((p) => p[0]);
    const ys = cells.map((p) => p[1]);
    const bx = Math.min(...xs) - 1, by = Math.min(...ys) - 1;
    const rows = Array.from({ length: Math.max(...ys) - by + 2 }, () => Array<string>(Math.max(...xs) - bx + 2).fill('.'));
    for (const [x, y] of cells) (rows[y - by] as string[])[x - bx] = letterOf(r.role);
    // Walls: every 8-neighbour that is not floor of some band room.
    for (const [x, y] of cells) {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const row = rows[y + dy - by] as string[];
        if (row[x + dx - bx] === '.' && !isFloor.has(key(x + dx, y + dy))) row[x + dx - bx] = '#';
      }
    }
    if (!b.cv.stamp(rows.map((q) => q.join('')), bx, by, `band${R}${tag}:${s}`)) return false;
    b.parts.push({ x: bx, y: by, w: rows[0]?.length ?? 0, h: rows.length, key: `band${R}${tag}:${s}`, role: r.role, spec: r });
  }
  // Doors: straight through one wall onto the corridor; a segment with no wall on it doors onto a neighbour already
  // joined to the corridor, so every segment is reached (cutBand checked that this can be done).
  const labelOf = (s: number): number => { const c = (floor.get(s) ?? [])[0] as [number, number]; return cv.labelAt(c[0], c[1]); };
  const joined = new Set<number>([ring]);
  let left = rooms.map((_, s) => s);
  while (left.length > 0) {
    const next: number[] = [];
    for (const s of left) {
      const me = labelOf(s);
      const spots: [number, number, boolean][] = [];
      for (const [x, y] of floor.get(s) ?? []) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          if (cv.at(x + dx, y + dy) !== '#' || cv.at(x + 2 * dx, y + 2 * dy) !== '_') continue;
          const o = cv.labelAt(x + 2 * dx, y + 2 * dy);
          if (o !== me && joined.has(o)) spots.push([x + dx, y + dy, o === ring]);
        }
      }
      const best = spots.filter((p) => p[2]);
      const pick = best.length > 0 ? best : spots;
      if (pick.length === 0) { next.push(s); continue; }
      // A leaning door goes to the end of the segment nearest its arc's start or end (a dock bank); else the middle.
      const lean = (rooms[s] as RoomSpec).doorLean;
      const a0 = (arcs[0] as [number, number])[0];
      const pos = (p: [number, number, boolean]): number => (((Math.atan2(p[1], p[0]) - a0) % TAU) + TAU) % TAU;
      const d = (lean ? [...pick].sort((p, q) => lean * (pos(q) - pos(p)))[0] : pick[pick.length >> 1]) as [number, number, boolean];
      cv.setDoor(d[0], d[1]);
      joined.add(me);
    }
    if (next.length === left.length) return false;
    left = next;
  }
  return true;
}

/** The band's segments, one a room: floor cells by room, or null if a room gets too little floor (nothing stamped). */
function cutBand(b: Builder, R: number, ring: number, rooms: RoomSpec[], depth: number, arcs: [number, number][], side: 1 | -1): { floor: Map<number, [number, number][]>; isFloor: Set<string> } | null {
  const cv = b.cv;
  const lo = side > 0 ? R + 0.5 : R - depth - 1.5;
  const hi = side > 0 ? R + depth + 1.5 : R - 0.5;
  const M = Math.ceil(R + depth + 3);
  const total = arcs.reduce((t, [a, z]) => t + (z - a), 0);
  // Segments share the arc by planned floor; pinned rooms (the harbour office, a guard post) keep about their planned
  // floor instead of stretching with the rest when the arc has floor to spare: the others take the slack.
  const planned = (r: RoomSpec): number => r.w * r.h + 4;
  // Usable floor: the band's area less its far wall and partitions (about two thirds of it).
  const floorAll = total * ((lo + hi) / 2) * depth * 0.65;
  const fixedFloor = rooms.filter((r) => r.pinned).reduce((t, r) => t + planned(r), 0);
  const flexW = rooms.filter((r) => !r.pinned).reduce((t, r) => t + planned(r), 0);
  const stretch = flexW > 0 && floorAll > fixedFloor + flexW;
  // Half as much again as planned: the estimate is rough, and a segment under half its plan is rejected.
  const weights = rooms.map((r) => (stretch && r.pinned ? Math.min(planned(r), (1.5 * planned(r) * flexW) / (floorAll - fixedFloor)) : planned(r)));
  const sum = weights.reduce((t, w) => t + w, 0);
  // Arc position (0..total) where each segment ends.
  const ends: number[] = [];
  let acc = 0;
  for (const w of weights) { acc += (w / sum) * total; ends.push(acc); }
  const along = (a: number): number => {
    let t = 0;
    for (const [a0, a1] of arcs) {
      const x = ((a - a0) % TAU + TAU) % TAU;
      if (x <= a1 - a0) return t + x;
      t += a1 - a0;
    }
    return -1;
  };
  const angleAt = (pos: number): number => {
    let t = pos;
    for (const [a0, a1] of arcs) { if (t <= a1 - a0) return a0 + t; t -= a1 - a0; }
    return (arcs[arcs.length - 1] as [number, number])[1];
  };
  // Partitions are straight walls, not radial staircases: each crosses the band at its angle along the grid axis nearer
  // the radius there (a vertical wall where the radius runs north-south, a horizontal one where it runs east-west), so a
  // segment off the axes is a straight-sided quadrilateral. Away from a partition, the angle alone decides the side.
  const rm = (lo + hi) / 2;
  const win = Math.min(0.6, (1.5 * (depth + 2)) / rm);
  const cuts = ends.slice(0, -1).map((pos) => {
    const a = angleAt(pos);
    const vertical = Math.abs(Math.sin(a)) >= Math.abs(Math.cos(a));
    return { pos, a, vertical, px: rm * Math.cos(a), py: rm * Math.sin(a), sign: vertical ? Math.sign(-Math.sin(a)) : Math.sign(Math.cos(a)) };
  });
  const passed = (c: (typeof cuts)[number], x: number, y: number, ang: number, t: number): boolean => {
    const da = Math.atan2(Math.sin(ang - c.a), Math.cos(ang - c.a));
    if (Math.abs(da) > win) return t >= c.pos;
    return (c.vertical ? x - c.px : y - c.py) * c.sign >= 0;
  };
  const seg = new Map<string, number>();
  const key = (x: number, y: number): string => `${x},${y}`;
  for (let y = -M; y <= M; y++) {
    for (let x = -M; x <= M; x++) {
      const d = Math.hypot(x, y);
      if (d < lo || d > hi || cv.at(x, y) !== '.') continue;
      const ang = Math.atan2(y, x);
      const t = along(ang);
      if (t < 0) continue;
      seg.set(key(x, y), Math.min(rooms.length - 1, cuts.filter((c) => passed(c, x, y, ang, t)).length));
    }
  }
  // Partition walls: a band cell touching (4-neighbour) the next segment is wall; so is the band's far edge.
  const floor = new Map<number, [number, number][]>();
  for (const [k, s] of seg) {
    const [x, y] = k.split(',').map(Number) as [number, number];
    const d = Math.hypot(x, y);
    const edge = side > 0 ? d > hi - 1 : d < lo + 1;
    // One wall per partition: the cell on the lower segment's side of it.
    const part = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seg.get(key(x + (dx as number), y + (dy as number))) === (s + 1) % rooms.length && rooms.length > 1);
    if (edge || part) continue;
    floor.set(s, [...(floor.get(s) ?? []), [x, y]]);
  }
  // One-tile spurs (floor in no 2 x 2 square of its own segment, where a stair-stepped edge meets a partition) turn to
  // wall: nothing stands in them and they read as notches.
  for (const [s, cells] of floor) {
    const mine = new Set(cells.map(([x, y]) => key(x, y)));
    const inSquare = ([x, y]: [number, number]): boolean => [[0, 0], [-1, 0], [0, -1], [-1, -1]].some(([ox, oy]) =>
      [[0, 0], [1, 0], [0, 1], [1, 1]].every(([dx, dy]) => mine.has(key(x + (ox as number) + (dx as number), y + (oy as number) + (dy as number)))));
    floor.set(s, cells.filter(inSquare));
  }
  const isFloor = new Set<string>();
  for (const cells of floor.values()) for (const [x, y] of cells) isFloor.add(key(x, y));
  for (const [s, r] of rooms.entries()) if ((floor.get(s) ?? []).length < Math.max(4, Math.floor((r.w * r.h) / 2))) return null;
  // Every segment reaches the corridor: through a wall onto it, or through a chain of segments that does.
  const segOf = new Map<string, number>();
  for (const [s, cells] of floor) for (const [x, y] of cells) segOf.set(key(x, y), s);
  const links = new Map<number, Set<number>>();
  const onRing = new Set<number>();
  for (const [s, cells] of floor) for (const [x, y] of cells) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    if (isFloor.has(key(x + dx, y + dy))) continue;
    if (cv.at(x + 2 * dx, y + 2 * dy) === '_' && cv.labelAt(x + 2 * dx, y + 2 * dy) === ring) onRing.add(s);
    const t = segOf.get(key(x + 2 * dx, y + 2 * dy));
    if (t !== undefined && t !== s) { links.set(s, (links.get(s) ?? new Set()).add(t)); links.set(t, (links.get(t) ?? new Set()).add(s)); }
  }
  const reached = new Set(onRing);
  const stack = [...onRing];
  while (stack.length > 0) for (const t of links.get(stack.pop() as number) ?? []) if (!reached.has(t)) { reached.add(t); stack.push(t); }
  if (reached.size < rooms.length) return null;
  return { floor, isFloor };
}

/** A band over separate arcs with its rooms already grouped by arc (`stationDistricts.ts` `organPipes`), in order. */
export function bandGroups(b: Builder, R: number, ring: number, groups: RoomSpec[][], depth: number, arcs: [number, number][], side: 1 | -1 = 1, flex = false): boolean {
  return arcs.every((arc, k) => bandRooms(b, R, ring, groups[k] ?? [], depth, [arc], side, `${side > 0 ? 'o' : 'i'}${k}`, flex));
}

/**
 * A band over several separate arcs (cut by dock banks or spokes): rooms shared out to the arcs by length, each arc
 * banded on its own so no segment straddles a gap. Arcs too short for one room get none.
 */
export function bandArcs(b: Builder, R: number, ring: number, rooms: RoomSpec[], depth: number, arcs: [number, number][], side: 1 | -1 = 1, flex = false): boolean {
  const total = arcs.reduce((t, [a, z]) => t + (z - a), 0);
  const area = rooms.reduce((t, r) => t + r.w * r.h + 4, 0);
  let i = 0;
  let acc = 0;
  let want = 0;
  for (const [k, arc] of arcs.entries()) {
    want += ((arc[1] - arc[0]) / total) * area;
    const mine: RoomSpec[] = [];
    while (i < rooms.length && (k === arcs.length - 1 || acc + ((rooms[i] as RoomSpec).w * (rooms[i] as RoomSpec).h + 4) / 2 <= want)) {
      const r = rooms[i++] as RoomSpec;
      acc += r.w * r.h + 4;
      mine.push(r);
    }
    if (!bandRooms(b, R, ring, (flex ? mine : spared(mine, arc, R, depth, side)), depth, [arc], side, `${side > 0 ? 'o' : 'i'}${k}`, flex)) return false;
  }
  return true;
}

/** Floor a lounge takes when it fills spare band floor. */
const LOUNGE = 24;

/**
 * An arc with much more floor than its rooms plan (a ring sized by something else, such as the court or the rooms between
 * the rings) would stretch them into slivers: lounges (empty support rooms, furnished at fit-out) take the spare floor,
 * spread between the rooms. Arcs of cabins already put a mess in their spare floor (`bandRooms`); flexible bands get
 * shallower instead.
 */
function spared(rooms: RoomSpec[], arc: [number, number], R: number, depth: number, side: 1 | -1): RoomSpec[] {
  if (rooms.length === 0 || rooms.some((r) => r.cabins)) return rooms;
  const floor = (arc[1] - arc[0]) * (R + (side * (depth + 2)) / 2) * depth * 0.65;
  const planned = rooms.reduce((t, r) => t + r.w * r.h + 4, 0);
  // Conservative: dock banks and partitions take more of an arc than the estimate knows.
  if (planned >= floor * 0.45) return rooms;
  const n = Math.floor((floor * 0.6 - planned) / LOUNGE);
  if (n < 1) return rooms;
  const lounge: RoomSpec = { role: 'support', mods: [], w: Math.max(3, Math.round(LOUNGE / depth)), h: depth };
  const out: RoomSpec[] = [];
  // Every room keeps its place; the lounges go between them, the first after the first room (a dock end stays the room's).
  // Never between two pinned rooms (the office and the customs post stand together); their share goes further on.
  let owed = 0;
  rooms.forEach((r, i) => {
    out.push(r);
    owed += Math.round(((i + 1) * n) / rooms.length) - Math.round((i * n) / rooms.length);
    if (r.pinned && rooms[i + 1]?.pinned) return;
    for (; owed > 0; owed--) out.push({ ...lounge });
  });
  return out;
}
