import { localBuilder } from './blocks';
import type { Builder, Part, Rect } from './builder';
import { letterOf } from './canvas';
import { bandArcs, bandDepth, bandRadius, bandRooms } from './stationBands';
import { arcsBetween, dockBanks, without } from './stationDocks';
import type { RoomSpec } from './plan';
import type { Rng } from '../rng';

/**
 * Round station rings: a 1-wide corridor on a rasterised circle (4-connected, so the outline is stair-stepped). Its
 * rooms are a band of ring segments (`stationBands.ts`); docks are rectangles fitted beyond the band, each pushed out
 * from the circle until it lands clear and doored onto a band room.
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
function doorSpots(b: Builder, r: Rect, label: number | ((L: number) => boolean)): Cell[] {
  const ok = typeof label === 'number' ? (L: number): boolean => L === label : label;
  const out: Cell[] = [];
  const test = (x: number, y: number, ox: number, oy: number): void => {
    if (b.cv.at(x, y) === '#' && ok(b.cv.labelAt(x + ox, y + oy))) out.push({ x, y });
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
function fitAlong(b: Builder, R: number, label: number, rooms: RoomSpec[], arcs: [number, number][], side: 1 | -1, reach = 0, avoid?: Set<number>): RoomSpec[] {
  // With `reach`, rooms stand beyond a band of rooms and door onto any of them (never onto a dock: its airlock needs
  // the dock's side walls).
  const doorTo = reach > 0 ? (L: number): boolean => L >= 0 && !avoid?.has(L) : label;
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
      for (let d = (side > 0 ? R - 1 : R + 1) + side * reach; !done && Math.abs(d - R) < 2 + reach + Math.max(W, H); d += side * 0.5) {
        for (const s of [0, 1, -1, 2, -2]) {
          const cx = Math.round(nx * d - ny * s);
          const cy = Math.round(ny * d + nx * s);
          const rect = { x: cx - (W >> 1), y: cy - (H >> 1), w: W, h: H };
          if (!free(b, rect)) continue;
          const spots = doorSpots(b, rect, doorTo);
          if (spots.length === 0) continue;
          const p = b.place(rect, r.role, r);
          if (!p) continue;
          // A dock's door goes to one side: the airlock takes the middle of its far wall and the floor in front of it.
          const dp = r.role === 'dock' ? (spots[0] as Cell) : mid(spots);
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

export interface WheelOpts {
  spokes: ('n' | 's' | 'e' | 'w')[];
  /** Extra radius beyond what the rooms need. */
  extra: number;
  /** Rooms beside the hub, inside the ring (a filled centre). */
  centre: number;
}

const isDock = (r: RoomSpec): boolean => r.role === 'dock';
/**
 * System rooms keep rectangles (gun bays, shield generators, the core and reactors need square floor) and stand beyond
 * the band with the docks, facing open space (gun bays need it).
 */
const SYSTEM: readonly string[] = ['weapons', 'shields', 'core', 'reactor', 'bridge'];
const isSystem = (r: RoomSpec): boolean => SYSTEM.includes(r.role);
/**
 * Rim rooms beyond a band: docks first, near the top and bottom of the ring (airlocks face north or south), then the
 * system rooms anywhere along `arcs`.
 */
function rim(b: Builder, R: number, label: number, sys: RoomSpec[], docks: RoomSpec[], arcs: [number, number][], reach: number): boolean {
  const q = Math.PI / 2;
  const ns: [number, number][] = [[-q - 0.75, -q + 0.75], [q - 0.75, q + 0.75]];
  const within = arcs.length === 1 && (arcs[0] as [number, number])[1] - (arcs[0] as [number, number])[0] < TAU - 0.01
    ? ns.map(([a, z]): [number, number] => [Math.max(a, (arcs[0] as [number, number])[0]), Math.min(z, (arcs[0] as [number, number])[1])]).filter(([a, z]) => z > a)
    : ns;
  const left = fitAlong(b, R, label, docks, within.length > 0 ? within : arcs, 1, reach);
  return fitAlong(b, R, label, [...sys, ...left], arcs, 1, reach).length === 0;
}

/** Wheel: one round ring, its rooms a band of segments outboard, docks beyond them, the hub at the centre on spokes. */
export function wheelStation(rng: Rng, hub: RoomSpec, rooms: RoomSpec[], o: WheelOpts): Builder | null {
  const b = localBuilder(rng);
  const hw = Math.max(hub.w, hub.h);
  const docks = rooms.filter(isDock);
  const sys = rooms.filter(isSystem);
  const rest = rooms.filter((r) => !isDock(r) && !isSystem(r));
  const inside = rest.slice(0, o.centre);
  const band = rest.slice(o.centre);
  const depth = bandDepth(band);
  const R = Math.max(bandRadius([...band, ...sys, ...docks], depth), Math.ceil(hw / 2) + 6 + (inside.length > 0 ? Math.max(0, ...inside.map((r) => r.w)) + 2 : 0)) + o.extra;
  const ring = corridor(b, R, 'wheel');
  if (!ring) return null;
  const h = b.place({ x: -(hw >> 1) - 1, y: -(hub.h >> 1) - 1, w: hw + 2, h: hub.h + 2 }, hub.role, { ...hub, w: hw });
  if (!h) return null;
  const hubLabel = b.cv.labelAt(h.x + 1, h.y + 1);
  for (const d of o.spokes) if (!spoke(b, d, face(h, d), R - 1, hubLabel, ring.label)) return null;
  // Centre rooms on the hub's free faces; any that do not fit join the band.
  const faces = (['e', 'w', 'n', 's'] as const).filter((d) => !o.spokes.includes(d));
  inside.forEach((r, i) => {
    const f = faces[i % Math.max(1, faces.length)];
    const ok = f ? b.attach(h, f, f === 'e' || f === 'w' ? { ...r, w: r.h, h: r.w } : r, 0) : null;
    if (!ok) band.push(r);
  });
  return outerBand(b, R, ring.label, band, sys, docks, depth) ? b : null;
}

/** Widest court between a concentric station's inner band and its outer ring. */
const COURT = 14;

/** The four quarter arcs between cardinal spokes. */
const QUARTERS: [number, number][] = [0, 1, 2, 3].map((q) => [q * (TAU / 4) + 0.3, (q + 1) * (TAU / 4) - 0.3]);

/** Radius whose circumference carries the rim rooms side by side (rectangles beyond the band), clear of the docks. */
const rimRadius = (sys: RoomSpec[], docks: RoomSpec[]): number =>
  Math.ceil((sys.reduce((t, r) => t + Math.max(r.w, r.h) + 3, 0) * 1.2 + (docks.length * 4 + 24)) / TAU);

/**
 * The outboard band of a full round ring with its docks reserved first (dock banks on the north and south faces), the
 * band cut round them, then the system rooms on the rim beyond the band, clear of the banks.
 */
function outerBand(b: Builder, R: number, ring: number, band: RoomSpec[], sys: RoomSpec[], docks: RoomSpec[], depth: number): boolean {
  const banks = dockBanks(b, R, ring, docks, R + depth + 2);
  if (!banks) return false;
  if (!bandArcs(b, R, ring, band, depth, arcsBetween(banks.splits))) return false;
  const rim = without([[0, TAU]], banks.keep);
  const left = fitAlong(b, R, ring, sys, rim, 1, depth + 1, banks.labels);
  // Crowded rims: guns get a second pass on their own (fresh spots between the first ones); rooms that need no hull
  // (reactors, shields, the core) go inboard of the corridor instead, facing the centre.
  const guns = fitAlong(b, R, ring, left.filter((r) => r.role === 'weapons'), rim, 1, depth + 1, banks.labels);
  return guns.length === 0 && fitAlong(b, R, ring, left.filter((r) => r.role !== 'weapons'), QUARTERS, -1).length === 0;
}

/**
 * Concentric: an inner and an outer round ring joined by four cardinal spokes, the hub in the middle. Every soft room is
 * a ring segment: the inner ring carries bands on both faces (its inboard band fills the centre round the hub), the
 * outer ring one band outboard with its docks reserved first as banks on the north and south faces. System rooms stay
 * rectangles on the outer rim, beyond the band. The space between the inner band and the outer ring is the court.
 */
export function concentricStation(rng: Rng, hub: RoomSpec, roomsIn: RoomSpec[], spokes: ('n' | 's' | 'e' | 'w')[]): Builder | null {
  const b = localBuilder(rng);
  const docks = roomsIn.filter(isDock);
  const sys = roomsIn.filter(isSystem);
  const rest = roomsIn.filter((r) => !isDock(r) && !isSystem(r));
  const area = (rs: RoomSpec[]): number => rs.reduce((t, r) => t + r.w * r.h, 0);
  // Shares by floor area: about a fifth round the hub, a third outside the inner ring, the rest on the outer ring.
  const total = area(rest);
  const iIn: RoomSpec[] = [], iOut: RoomSpec[] = [], oBand: RoomSpec[] = [];
  for (const r of rest) (area(iIn) < total * 0.2 ? iIn : area(iOut) < total * 0.33 ? iOut : oBand).push(r);
  const hw = Math.max(hub.w, hub.h);
  const hubR = Math.ceil(Math.hypot(hw / 2 + 1, hub.h / 2 + 1));
  const dI = bandDepth(iIn);
  const dO = bandDepth(iOut);
  const dB = bandDepth(oBand);
  const R1a = Math.max(hubR + (iIn.length > 0 ? dI + 4 : 4), bandRadius(iIn, dI, 1, -1), bandRadius(iOut, dO));
  const R2 = Math.max(R1a + dO + 8, bandRadius([...oBand, ...sys, ...docks], dB), rimRadius(sys, docks) - dB - 2);
  // A rim-driven outer ring (many guns) would leave a vast court: the inner ring grows to keep the court at most
  // COURT tiles across, its segments longer.
  const R1 = Math.max(R1a, R2 - dO - 2 - COURT);
  const r1 = corridor(b, R1, 'inner');
  const r2 = corridor(b, R2, 'outer');
  if (!r1 || !r2) return null;
  const h = b.place({ x: -(hw >> 1) - 1, y: -(hub.h >> 1) - 1, w: hw + 2, h: hub.h + 2 }, hub.role, { ...hub, w: hw });
  if (!h) return null;
  const hubLabel = b.cv.labelAt(h.x + 1, h.y + 1);
  for (const d of spokes) if (!spoke(b, d, face(h, d), R1 - 1, hubLabel, r1.label)) return null;
  for (const d of ['n', 's', 'e', 'w'] as const) if (!spoke(b, d, R1 + 1, R2 - 1, r1.label, r2.label)) return null;
  const ANGLE = { e: 0, s: Math.PI / 2, w: Math.PI, n: -Math.PI / 2 } as const;
  // Spokes cut the inner bands into arcs: the hub's spokes inboard, the four cardinal ones outboard.
  if (!bandArcs(b, R1, r1.label, iIn, dI, arcsBetween(spokes.map((d) => ANGLE[d])), -1)) return null;
  if (!bandArcs(b, R1, r1.label, iOut, dO, arcsBetween([0, 1, 2, 3].map((q) => (q * TAU) / 4)))) return null;
  return outerBand(b, R2, r2.label, oBand, sys, docks, dB) ? b : null;
}

/** Arc: a partial round ring (a crescent) of `span` radians: a room band outside it, system rooms and docks beyond. */
export function arcStation(rng: Rng, hub: RoomSpec, rooms: RoomSpec[], span: number): Builder | null {
  const b = localBuilder(rng);
  const docks = rooms.filter(isDock);
  const inn = [hub, ...rooms.filter(isSystem)];
  const out = rooms.filter((r) => !isDock(r) && !isSystem(r));
  const dO = bandDepth(out);
  const R = Math.max(8, bandRadius([...out, ...inn], dO, span / TAU));
  const a0 = -Math.PI / 2 - span / 2;
  const ring = corridor(b, R, 'arc', a0, a0 + span);
  if (!ring) return null;
  if (!bandRooms(b, R, ring.label, out, dO, [[a0, a0 + span]])) return null;
  return rim(b, R, ring.label, inn, docks, [[a0, a0 + span]], dO + 1) ? b : null;
}
