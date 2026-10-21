import { localBuilder } from './blocks';
import type { Builder, Part, Rect } from './builder';
import { letterOf } from './canvas';
import type { RoomSpec } from './plan';
import type { Rng } from '../rng';

/**
 * Round station rings: a 1-wide corridor on a rasterised circle (4-connected, so the outline is stair-stepped), with
 * rectangular rooms fitted along it outboard (or inboard), each pushed out from the circle until it lands clear and
 * doored straight onto the corridor.
 *   wheelStation       one round ring, a hub at the centre on two to four spokes (optionally rooms beside the hub)
 *   concentricStation  two nested round rings joined by spokes, the hub inside the inner one
 *   arcStation         a partial ring (a crescent), rooms on both faces, no hub
 */

const TAU = Math.PI * 2;
type Cell = { x: number; y: number };

/** A 4-connected chain of cells on a circle of radius R round (0, 0), angles a0..a1 (0 = east, clockwise on screen). */
export function circleCells(R: number, a0 = 0, a1 = TAU): Cell[] {
  const out: Cell[] = [];
  const seen = new Set<string>();
  const add = (x: number, y: number): void => {
    const k = `${x},${y}`;
    if (!seen.has(k)) { seen.add(k); out.push({ x, y }); }
  };
  const steps = Math.ceil(R * 12 * ((a1 - a0) / TAU)) + 8;
  let last: Cell | null = null;
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    const x = Math.round(R * Math.cos(a));
    const y = Math.round(R * Math.sin(a));
    if (last && last.x !== x && last.y !== y) add(x, last.y);
    add(x, y);
    last = { x, y };
  }
  return out;
}

/** Stamp a set of floor cells (role `role`) with walls round them; returns its bounding rect, or null on a clash. */
function stampCells(b: Builder, cells: Cell[], key: string): Rect | null {
  const floor = new Set(cells.map((c) => `${c.x},${c.y}`));
  const xs = cells.map((c) => c.x);
  const ys = cells.map((c) => c.y);
  const x0 = Math.min(...xs) - 1, y0 = Math.min(...ys) - 1, x1 = Math.max(...xs) + 1, y1 = Math.max(...ys) + 1;
  const letter = letterOf('hall');
  const rows: string[] = [];
  for (let y = y0; y <= y1; y++) {
    let row = '';
    for (let x = x0; x <= x1; x++) {
      if (floor.has(`${x},${y}`)) { row += letter; continue; }
      let wall = false;
      for (let dy = -1; dy <= 1 && !wall; dy++) for (let dx = -1; dx <= 1 && !wall; dx++) wall = floor.has(`${x + dx},${y + dy}`);
      row += wall ? '#' : '.';
    }
    rows.push(row);
  }
  return b.cv.stamp(rows, x0, y0, key) ? { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } : null;
}

/** A rect is free: its floor lands on space only, its walls on space or wall. */
function free(b: Builder, r: Rect): boolean {
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      const c = b.cv.at(x, y);
      const edge = x === r.x || y === r.y || x === r.x + r.w - 1 || y === r.y + r.h - 1;
      if (edge ? c !== '.' && c !== '#' : c !== '.') return false;
    }
  }
  return true;
}

/** Wall tiles of rect `r` (not corners) with `r`'s floor on one side and floor of label `label` on the other. */
function doorSpots(b: Builder, r: Rect, label: number): Cell[] {
  const out: Cell[] = [];
  const test = (x: number, y: number, ox: number, oy: number): void => {
    if (b.cv.at(x, y) === '#' && b.cv.labelAt(x + ox, y + oy) === label) out.push({ x, y });
  };
  for (let x = r.x + 1; x < r.x + r.w - 1; x++) { test(x, r.y, 0, -1); test(x, r.y + r.h - 1, 0, 1); }
  for (let y = r.y + 1; y < r.y + r.h - 1; y++) { test(r.x, y, -1, 0); test(r.x + r.w - 1, y, 1, 0); }
  return out;
}

/** The middle of a list of door spots. */
const mid = <T>(xs: T[]): T => xs[(xs.length - 1) >> 1] as T;

/**
 * Fit `rooms` along a round corridor of radius R (label `label`) over the given arcs, outboard (side 1) or inboard
 * (side -1): each room is centred on its share of the arc and pushed along the normal until it lands clear with a
 * door onto the corridor. Returns the rooms that found no place.
 */
function fitAlong(b: Builder, R: number, label: number, rooms: RoomSpec[], arcs: [number, number][], side: 1 | -1): RoomSpec[] {
  const total = arcs.reduce((t, [a, z]) => t + (z - a), 0);
  const len = rooms.reduce((t, r) => t + r.w + 2, 0);
  const left: RoomSpec[] = [];
  let at = 0;
  for (const r of rooms) {
    const t = ((at + (r.w + 2) / 2) / Math.max(len, 1)) * total;
    at += r.w + 2;
    let a = 0;
    let acc = 0;
    for (const [a0, a1] of arcs) {
      if (t <= acc + (a1 - a0)) { a = a0 + (t - acc); break; }
      acc += a1 - a0;
      a = a1;
    }
    const nx = Math.cos(a);
    const ny = Math.sin(a);
    const flat = Math.abs(ny) >= Math.abs(nx);
    let done = false;
    for (const rot of [flat, !flat]) {
      const W = (rot ? r.w : r.h) + 2;
      const H = (rot ? r.h : r.w) + 2;
      for (let d = side > 0 ? R - 1 : R + 1; !done && Math.abs(d - R) < 2 + Math.max(W, H); d += side * 0.5) {
        for (const s of [0, 1, -1, 2, -2]) {
          const cx = Math.round(nx * d - ny * s);
          const cy = Math.round(ny * d + nx * s);
          const rect = { x: cx - (W >> 1), y: cy - (H >> 1), w: W, h: H };
          if (!free(b, rect)) continue;
          const spots = doorSpots(b, rect, label);
          if (spots.length === 0) continue;
          const p = b.place(rect, r.role, r);
          if (!p) continue;
          const dp = mid(spots);
          b.cv.setDoor(dp.x, dp.y);
          done = true;
          break;
        }
      }
      if (done) break;
    }
    if (!done) left.push(r);
  }
  return left;
}

/** The round corridor of radius R stamped onto `b`; its rect and room label. */
function corridor(b: Builder, R: number, key: string, a0 = 0, a1 = TAU): { rect: Rect; label: number } | null {
  const cells = circleCells(R, a0, a1);
  const rect = stampCells(b, cells, key);
  const c = cells[0] as Cell;
  return rect ? { rect, label: b.cv.labelAt(c.x, c.y) } : null;
}

/** A straight 3-wide spoke on a cardinal axis from distance `a` to `z` (its end walls), doored to both labels. */
function spoke(b: Builder, d: 'n' | 's' | 'e' | 'w', a: number, z: number, inner: number, outer: number): boolean {
  const len = z - a + 1;
  if (len < 3) return false;
  const r: Rect = d === 'n' ? { x: -1, y: -z, w: 3, h: len } : d === 's' ? { x: -1, y: a, w: 3, h: len } : d === 'w' ? { x: -z, y: -1, w: len, h: 3 } : { x: a, y: -1, w: len, h: 3 };
  const p = b.place(r, 'hall');
  if (!p) return false;
  const ends = doorSpots(b, p, outer);
  const starts = doorSpots(b, p, inner);
  if (ends.length === 0 || starts.length === 0) return false;
  b.cv.setDoor(mid(ends).x, mid(ends).y);
  b.cv.setDoor(mid(starts).x, mid(starts).y);
  return true;
}

/** Distance from the centre to a hub's wall on a face. */
const face = (h: Part, d: 'n' | 's' | 'e' | 'w'): number => ({ n: -h.y, s: h.y + h.h - 1, w: -h.x, e: h.x + h.w - 1 })[d];

/** Radius whose circumference carries `rooms` (outboard, plus a margin), at least `min`. */
const radiusFor = (rooms: RoomSpec[], min: number, share = 1): number =>
  Math.max(min, Math.ceil((rooms.reduce((t, r) => t + r.w + 2, 0) * 0.85) / (TAU * share)));

export interface WheelOpts {
  spokes: ('n' | 's' | 'e' | 'w')[];
  /** Extra radius beyond what the rooms need. */
  extra: number;
  /** Rooms beside the hub, inside the ring (a filled centre). */
  centre: number;
}

/** Wheel: one round ring, rooms outboard, the hub at the centre on spokes. */
export function wheelStation(rng: Rng, hub: RoomSpec, rooms: RoomSpec[], o: WheelOpts): Builder | null {
  const b = localBuilder(rng);
  const hw = Math.max(hub.w, hub.h);
  const inside = rooms.slice(0, o.centre);
  const outside = rooms.slice(o.centre);
  const R = radiusFor(outside, Math.ceil(hw / 2) + 6 + (inside.length > 0 ? Math.max(0, ...inside.map((r) => r.w)) + 2 : 0)) + o.extra;
  const ring = corridor(b, R, 'wheel');
  if (!ring) return null;
  const h = b.place({ x: -(hw >> 1) - 1, y: -(hub.h >> 1) - 1, w: hw + 2, h: hub.h + 2 }, hub.role, { ...hub, w: hw });
  if (!h) return null;
  const hubLabel = b.cv.labelAt(h.x + 1, h.y + 1);
  for (const d of o.spokes) if (!spoke(b, d, face(h, d), R - 1, hubLabel, ring.label)) return null;
  // Centre rooms on the hub's free faces, the rest outboard.
  const faces = (['e', 'w', 'n', 's'] as const).filter((d) => !o.spokes.includes(d));
  const extraOut: RoomSpec[] = [];
  inside.forEach((r, i) => {
    const f = faces[i % Math.max(1, faces.length)];
    const ok = f ? b.attach(h, f, f === 'e' || f === 'w' ? { ...r, w: r.h, h: r.w } : r, 0) : null;
    if (!ok) extraOut.push(r);
  });
  const left = fitAlong(b, R, ring.label, [...outside, ...extraOut], [[0, TAU]], 1);
  // Rooms with no place outboard line the inside of the ring.
  return fitAlong(b, R, ring.label, left, [[0, TAU]], -1).length === 0 ? b : null;
}

/** Concentric: an inner and an outer round ring joined by spokes, rooms outboard of both, the hub in the middle. */
export function concentricStation(rng: Rng, hub: RoomSpec, roomsIn: RoomSpec[], spokes: ('n' | 's' | 'e' | 'w')[]): Builder | null {
  const b = localBuilder(rng);
  // Docks stay on the outer ring (airlocks face open space, not the centre).
  const rooms = [...roomsIn.filter((r) => r.role !== 'dock'), ...roomsIn.filter((r) => r.role === 'dock')];
  const hw = Math.max(hub.w, hub.h);
  // The inner ring carries rooms on both faces (its inboard half fills the centre round the hub).
  const k = Math.max(2, Math.round(rooms.length * 0.4));
  const inner = rooms.slice(0, Math.ceil(k / 2));
  const core = rooms.slice(Math.ceil(k / 2), k);
  const outer = rooms.slice(k);
  const depth = Math.max(3, ...inner.map((r) => Math.max(r.w, r.h))) + 2;
  // Inner rooms keep clear of the cardinal spokes: four arcs between them.
  const gap = 0.22;
  const arcs: [number, number][] = [0, 1, 2, 3].map((q) => [q * (TAU / 4) + gap, (q + 1) * (TAU / 4) - gap]);
  const coreDepth = Math.max(0, ...core.map((r) => Math.max(r.w, r.h))) + 2;
  const R1 = Math.max(radiusFor(inner, Math.ceil(hw / 2) + 6, 1 - (4 * gap) / TAU), Math.ceil(hw / 2) + coreDepth + 3);
  const R2 = Math.max(radiusFor(outer, 0), R1 + depth + 4);
  const r1 = corridor(b, R1, 'inner');
  const r2 = corridor(b, R2, 'outer');
  if (!r1 || !r2) return null;
  const h = b.place({ x: -(hw >> 1) - 1, y: -(hub.h >> 1) - 1, w: hw + 2, h: hub.h + 2 }, hub.role, { ...hub, w: hw });
  if (!h) return null;
  const hubLabel = b.cv.labelAt(h.x + 1, h.y + 1);
  for (const d of spokes) if (!spoke(b, d, face(h, d), R1 - 1, hubLabel, r1.label)) return null;
  for (const d of ['n', 's', 'e', 'w'] as const) if (!spoke(b, d, R1 + 1, R2 - 1, r1.label, r2.label)) return null;
  const left = fitAlong(b, R1, r1.label, inner, arcs, 1);
  const leftIn = fitAlong(b, R1, r1.label, core, arcs, -1);
  const left2 = fitAlong(b, R2, r2.label, [...outer, ...left, ...leftIn], [[0, TAU]], 1);
  return fitAlong(b, R2, r2.label, left2, [[0, TAU]], -1).length === 0 ? b : null;
}

/** Arc: a partial round ring (a crescent) of `span` radians, rooms on both faces, docks at its ends. */
export function arcStation(rng: Rng, hub: RoomSpec, rooms: RoomSpec[], span: number): Builder | null {
  const b = localBuilder(rng);
  const docks = rooms.filter((r) => r.role === 'dock');
  const all = [hub, ...rooms.filter((r) => r.role !== 'dock')];
  const outN = Math.ceil(all.length * 0.6);
  // Docks on the outer face, at the two ends first.
  const out = [docks[0], ...all.slice(0, outN), ...docks.slice(1)].filter((r): r is RoomSpec => !!r);
  const inn = all.slice(outN);
  const R = Math.max(radiusFor(out, 8, span / TAU), radiusFor(inn, 8, (span / TAU) * 0.7) + 4);
  const a0 = -Math.PI / 2 - span / 2;
  const ring = corridor(b, R, 'arc', a0, a0 + span);
  if (!ring) return null;
  const left = fitAlong(b, R, ring.label, out, [[a0, a0 + span]], 1);
  const left2 = fitAlong(b, R, ring.label, inn, [[a0 + 0.15, a0 + span - 0.15]], -1);
  const left3 = fitAlong(b, R, ring.label, [...left, ...left2], [[a0, a0 + span]], 1);
  return fitAlong(b, R, ring.label, left3, [[a0, a0 + span]], -1).length === 0 ? b : null;
}
