import type { Rng } from '../rng';
import type { RoomSpec } from './plan';
import { isSecure, SIDE, type RingProgram } from './stationDepartments';

/**
 * The wheel's department search (docs/STATIONGEN2.md, step 2): the skeleton (the ring's radius) and the departments'
 * places are chosen together. Each department that stands as rectangles inside the ring is a block of its rooms at
 * their planned size (rooms first: the block's length and depth come from its rooms), and has a few places it may
 * take: lining a street (both sides of a spoke, from the ring inward) or lining the ring itself (inboard, beside a
 * spoke or at the diagonals). A candidate is one place for every department; its radius is the least that holds its
 * blocks (streets get longer and the ring's arcs wider as it grows), so the blocks size the ring, and the ring's
 * streets and arcs decide which blocks fit where. Candidates are ranked here by the district rules and their radius;
 * the best few are then built for real (stationWheel.ts), which settles the fit.
 */

export type Dir = 'n' | 's' | 'e' | 'w';

/** A room as it lines a street: its floor along the street and across it. */
export interface Unit { spec: RoomSpec; along: number; across: number }

/**
 * Where a department stands:
 *   street   lining spoke `d` (side -1 first, then 1), from the ring inward;
 *   beside   inboard of the ring beside spoke `d`, each side (-1 anticlockwise, 1 clockwise) its own list;
 *   diagonal inboard of the ring at the four diagonals, dealt round in turn (Palmanova's bastions);
 *   quads    inboard of the ring anywhere in the given quadrants' arcs.
 */
export type Place =
  | { kind: 'street'; d: Dir }
  | { kind: 'beside'; d: Dir }
  | { kind: 'diagonal' }
  | { kind: 'quads'; quads: number[] };

export type Dept = 'secure' | 'defence' | 'freight' | 'clinic' | 'works';

export interface Job { dept: Dept; place: Place; rooms: RoomSpec[][] }

export interface WheelCandidate {
  R: number;
  jobs: Job[];
  /** The quadrants habitation takes in the outer band, and the secure core's side (plant rooms stand there). */
  quiet: number[];
  secure: 'e' | 'w';
  freight: ('n' | 's')[];
  score: number;
  label: string;
}

const TAU = Math.PI * 2;
/** Least distance from the centre to a street room's near wall (clear of the rotunda). */
const UMIN = 7;
/** Angle kept clear between a spoke and the rooms beside it inboard of the ring. */
const CLEAR = 0.14;

/**
 * A street unit: the secure core's machine rooms stand across the street at their deeper side (they pack close, doors
 * at their ends); every other room lies along it, its long side on the street (a gun bay with two turrets needs its door
 * on the long side).
 */
export const unitOf = (r: RoomSpec): Unit => {
  const lo = Math.min(r.w, r.h), hi = Math.max(r.w, r.h);
  return isSecure(r) ? { spec: r, along: lo, across: hi } : { spec: r, along: hi, across: lo };
};

/** Half the floor width of spoke d plus its wall: 2 for the 3-wide concourse (north, south), 1 for the others. */
export const halfWidth = (d: Dir): number => (d === 'n' || d === 's' ? 2 : 1);

/** Where a run of street units starts for a unit `across` deep: the ring curves in towards the spoke at its far side. */
export const reachOf = (R: number, across: number, hw: number): number => Math.floor(Math.sqrt(Math.max(0, (R - 2) ** 2 - (across + hw + 2) ** 2))) - 1;

/** Street units that do not fit on spoke d at radius R (filling side -1, then side 1), by the street's geometry alone. */
function streetLeft(R: number, d: Dir, units: Unit[]): number {
  const hw = halfWidth(d);
  let i = 0;
  for (let side = 0; side < 2; side++) {
    let u = R - 3;
    for (; i < units.length; i++) {
      const { along: A, across: C } = units[i] as Unit;
      const u0 = Math.min(u, reachOf(R, C, hw)) - (A + 1);
      if (u0 < UMIN) break;
      u = u0;
    }
  }
  return units.length - i;
}

/** Angle a list of rooms takes inboard of the ring at radius R (each its longer side along the ring, walls apart). */
const angleOf = (rooms: RoomSpec[], R: number): number => {
  const deep = Math.max(0, ...rooms.map((r) => Math.min(r.w, r.h)));
  return rooms.reduce((t, r) => t + Math.max(r.w, r.h) + 3, 0) / Math.max(1, R - 3 - deep);
};

/** Quadrants beside spoke d on side s (-1 anticlockwise, 1 clockwise): north -1 is NW (3), north 1 is NE (0)... */
const QUAD: Record<Dir, [number, number]> = { n: [3, 0], e: [0, 1], s: [1, 2], w: [2, 3] };
export const quadOf = (d: Dir, side: -1 | 1): number => QUAD[d][side < 0 ? 0 : 1];

/**
 * Does a candidate's ring hold its blocks at radius R: every street run fits its spoke, and the inboard arcs of each
 * quadrant (less what the street runs take at its ends) hold the rooms that stand there.
 */
function fits(R: number, jobs: Job[], market: boolean): boolean {
  const streets = new Map<Dir, Unit[]>();
  const arc = [0, 0, 0, 0];
  const add = (q: number, a: number): void => { arc[q] = (arc[q] as number) + a; };
  for (const j of jobs) {
    const all = j.rooms.flat();
    if (j.place.kind === 'street') {
      streets.set(j.place.d, [...(streets.get(j.place.d) ?? []), ...all.map(unitOf)]);
    } else if (j.place.kind === 'beside') {
      const d = j.place.d;
      j.rooms.forEach((rs, k) => add(quadOf(d, k === 0 ? -1 : 1), rs.length > 0 ? angleOf(rs, R) + CLEAR : 0));
    } else if (j.place.kind === 'diagonal') {
      for (let q = 0; q < 4; q++) add(q, angleOf(all.filter((_, i) => i % 4 === q), R));
    } else {
      const qs = j.place.quads;
      qs.forEach((q, k) => add(q, angleOf(all.filter((_, i) => i % qs.length === k), R)));
    }
  }
  for (const [d, units] of streets) if (streetLeft(R, d, units) > 0) return false;
  // A street run takes the ring's inboard arc beside its spoke, as far round as its deepest room reaches.
  for (const [d, units] of [...streets, ...(market ? [['s', [{ across: 5 }]]] as [Dir, { across: number }[]][] : [])]) {
    const deep = Math.max(0, ...units.map((u) => u.across)) + halfWidth(d) + 2;
    for (const s of [-1, 1] as const) add(quadOf(d, s), Math.atan2(deep, R - 2));
  }
  return arc.every((a) => a <= TAU / 4 - 0.1);
}

/** Habitation's pair of quadrants: away from the secure core, the warehouses and the main (north) dock. */
function quietFor(rng: Rng, secure: Dir, freight: Dir[], guns: Dir | null): { quiet: number[]; v: number } {
  const near = (q: number, sides: readonly Dir[]): number => sides.filter((s) => SIDE[s].includes(q)).length;
  let best = { quiet: [0, 1], v: -Infinity };
  for (const quiet of [[0, 1], [1, 2], [2, 3], [3, 0]]) {
    let v = 0;
    for (const q of quiet) v -= near(q, [secure]) + 0.5 * near(q, freight) + 0.5 * near(q, ['n']) + 0.5 * near(q, guns ? [guns] : []);
    // A little noise, so the quiet quadrants vary between stations of a kind where the rules tie.
    v += rng.next() * 0.5;
    if (v > best.v) best = { quiet, v };
  }
  return best;
}

export interface SearchInput { prog: RingProgram; R0: number; market: boolean; westDocks: boolean }

/**
 * Every combination of places for the departments, each at the least radius (R0 up) that holds it, ranked: the district
 * rules (secure core astern, freight at the main dock, gun bays with the secure core, habitation in quiet quadrants)
 * less the radius over R0 (a bigger ring is emptier and stretches its band), plus a little noise so stations of a kind
 * differ.
 */
export function wheelCandidates(rng: Rng, inp: SearchInput): WheelCandidate[] {
  const { prog, R0, market, westDocks } = inp;
  const [secA, secB] = prog.secure;
  const out: WheelCandidate[] = [];
  const securePlaces: { d: 'e' | 'w'; ring: boolean }[] = (westDocks ? ['e'] as const : ['e', 'w'] as const).flatMap((d) => [{ d, ring: false }, { d, ring: true }]);
  const other = (d: 'e' | 'w'): 'e' | 'w' => (d === 'e' ? 'w' : 'e');
  for (const sec of securePlaces) for (const gunsAt of ['with', 'diagonal', 'other'] as const) for (const freightAt of ['beside', 'street', 'other'] as const) {
    if (prog.guns.length === 0 && gunsAt !== 'with') continue;
    if (prog.houses.length === 0 && freightAt !== 'beside') continue;
    const jobs: Job[] = [];
    const secPlace: Place = sec.ring ? { kind: 'beside', d: sec.d } : { kind: 'street', d: sec.d };
    // Gun bays with the secure core: after it on its street, or beside its spoke (each side's list continued).
    if (gunsAt === 'with') {
      const g0 = prog.guns.filter((_, i) => i % 2 === 0), g1 = prog.guns.filter((_, i) => i % 2 === 1);
      jobs.push({ dept: 'secure', place: secPlace, rooms: sec.ring ? [[...secA, ...g0], [...secB, ...g1]] : [[...secA, ...secB, ...prog.guns]] });
    } else {
      jobs.push({ dept: 'secure', place: secPlace, rooms: sec.ring ? [secA, secB] : [[...secA, ...secB]] });
      jobs.push({ dept: 'defence', place: gunsAt === 'diagonal' ? { kind: 'diagonal' } : { kind: 'street', d: other(sec.d) }, rooms: [prog.guns] });
    }
    // Warehouses at the dock spokes (north only for a market: the south concourse is its street), or on the free spoke.
    const docksAt: ('n' | 's')[] = market || prog.houses.length < 2 ? ['n'] : ['n', 's'];
    const houses = prog.houses;
    if (houses.length > 0) {
      if (freightAt === 'other') jobs.push({ dept: 'freight', place: { kind: 'street', d: other(sec.d) }, rooms: [houses] });
      else for (const [k, d] of docksAt.entries()) {
        const mine = houses.filter((_, i) => i % docksAt.length === k);
        jobs.push({ dept: 'freight', place: freightAt === 'street' ? { kind: 'street', d } : { kind: 'beside', d }, rooms: freightAt === 'street' ? [mine] : [mine.filter((_, i) => i % 2 === 0), mine.filter((_, i) => i % 2 === 1)] });
      }
    }
    if (prog.clinic.length > 0) jobs.push({ dept: 'clinic', place: { kind: 'street', d: other(sec.d) }, rooms: [prog.clinic] });
    if (prog.works.length > 0) jobs.push({ dept: 'works', place: { kind: 'quads', quads: [0, 1, 2, 3] }, rooms: [prog.works] });
    let R = R0;
    while (R < R0 + 40 && !fits(R, jobs, market)) R++;
    if (R >= R0 + 40) continue;
    const freightDirs: Dir[] = houses.length === 0 ? [] : freightAt === 'other' ? [other(sec.d)] : docksAt;
    const gunDir: Dir | null = gunsAt === 'other' ? other(sec.d) : null;
    const { quiet, v } = quietFor(rng, sec.d, freightDirs, gunDir);
    let score = v + (sec.d === 'e' ? 1 : 0) + (freightDirs.includes('n') ? 0.5 : 0) + (gunsAt === 'with' ? 0.5 : gunsAt === 'diagonal' ? 0.25 : 0) - 0.08 * (R - R0);
    score += rng.next() * 0.8;
    out.push({
      R, jobs, quiet, secure: sec.d, freight: freightDirs.filter((d): d is 'n' | 's' => d === 'n' || d === 's'), score,
      label: `secure ${sec.ring ? 'ring' : 'street'}-${sec.d} guns ${gunsAt} freight ${freightAt}`,
    });
  }
  return out.sort((a, b) => b.score - a.score);
}
