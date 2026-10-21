import type { Builder } from './builder';
import { letterOf } from './canvas';
import type { RoomSpec } from './plan';

/**
 * Ring-band rooms: the rooms of a round ring fill the band outside (or inside) its corridor as ring segments cut by
 * radial partition walls, so a round station reads as a solid ring of rooms with no plating gaps. Segments are
 * stair-stepped polygons (rooms need not be rectangles: fit-out works on any floor set). Each segment is sized to its
 * room's floor area and doored straight onto the corridor (or, failing that, onto its neighbour).
 */

const TAU = Math.PI * 2;

/** Band depth that suits a set of rooms (about the side of the average room). */
export const bandDepth = (rooms: RoomSpec[]): number =>
  Math.max(4, Math.min(7, Math.round(Math.sqrt(rooms.reduce((t, r) => t + r.w * r.h, 0) / Math.max(1, rooms.length)))));

/** Corridor radius at which a band `depth` deep holds `rooms` over `share` of the circle (side 1 outboard). */
export function bandRadius(rooms: RoomSpec[], depth: number, share = 1, side: 1 | -1 = 1): number {
  const area = rooms.reduce((t, r) => t + (r.w + 1) * (r.h + 1), 0) * 1.1;
  return Math.ceil(area / (TAU * share * depth) - (side * (depth + 2)) / 2);
}

/**
 * Stamp `rooms` as segments of the band between the corridor (radius R, label `ring`) and radius R +- (depth + 1),
 * over the angle ranges `arcs`. Returns false if a room gets too little floor or no door.
 */
export function bandRooms(b: Builder, R: number, ring: number, rooms: RoomSpec[], depth: number, arcs: [number, number][], side: 1 | -1 = 1): boolean {
  if (rooms.length === 0) return true;
  const cv = b.cv;
  const lo = side > 0 ? R + 0.5 : R - depth - 1.5;
  const hi = side > 0 ? R + depth + 1.5 : R - 0.5;
  const M = Math.ceil(R + depth + 3);
  const total = arcs.reduce((t, [a, z]) => t + (z - a), 0);
  const weights = rooms.map((r) => r.w * r.h + 4);
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
  const seg = new Map<string, number>();
  const key = (x: number, y: number): string => `${x},${y}`;
  for (let y = -M; y <= M; y++) {
    for (let x = -M; x <= M; x++) {
      const d = Math.hypot(x, y);
      if (d < lo || d > hi || cv.at(x, y) !== '.') continue;
      const t = along(Math.atan2(y, x));
      if (t < 0) continue;
      seg.set(key(x, y), Math.min(rooms.length - 1, ends.findIndex((e) => t < e) < 0 ? rooms.length - 1 : ends.findIndex((e) => t < e)));
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
  const isFloor = new Set<string>();
  for (const cells of floor.values()) for (const [x, y] of cells) isFloor.add(key(x, y));
  for (const [s, r] of rooms.entries()) {
    const cells = floor.get(s) ?? [];
    if (cells.length < Math.max(4, Math.floor((r.w * r.h) / 2))) return false;
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
    if (!b.cv.stamp(rows.map((q) => q.join('')), bx, by, `band${R}:${s}`)) return false;
    b.parts.push({ x: bx, y: by, w: rows[0]?.length ?? 0, h: rows.length, key: `band${R}:${s}`, role: r.role, spec: r });
  }
  // Doors: straight through one wall onto the corridor, else onto the previous segment.
  for (const [s] of rooms.entries()) {
    const cells = floor.get(s) ?? [];
    const me = cv.labelAt((cells[0] as [number, number])[0], (cells[0] as [number, number])[1]);
    const spots: [number, number, boolean][] = [];
    for (const [x, y] of cells) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        if (cv.at(x + dx, y + dy) !== '#' || cv.at(x + 2 * dx, y + 2 * dy) !== '_') continue;
        const o = cv.labelAt(x + 2 * dx, y + 2 * dy);
        if (o === ring) spots.push([x + dx, y + dy, true]);
        else if (o !== me) spots.push([x + dx, y + dy, false]);
      }
    }
    const best = spots.filter((p) => p[2]);
    const pick = best.length > 0 ? best : spots;
    if (pick.length === 0) return false;
    const d = pick[pick.length >> 1] as [number, number, boolean];
    cv.setDoor(d[0], d[1]);
  }
  return true;
}
