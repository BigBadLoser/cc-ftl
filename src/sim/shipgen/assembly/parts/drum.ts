import type { RoomSpec } from '../../plan';
import { BAND as SPINE, MIN_DEPTH, type Frame } from '../frame';
import { SOLID } from '../regions';
import { fillerSpec } from '../roomSize';
import type { BayPart, DockSite } from './part';

/**
 * A liner's drum (PROTOTYPE, #581): the widest section, its corners rounded. In the middle a square: a ring corridor
 * round a garden, the ring's outer walls on the hull line of the sections either side (that line runs on through the
 * drum), its sides as long as it is wide. Outboard of the square, north and south, a band of single cabins along the
 * hull, a suite in each corner (it reaches the ring's corner for its door); fore and aft of the square a shared room
 * either side of the spine (lounges forward, gyms aft), which runs in to the ring. The rest of the ship is on bays: crew, mess, med bay and stores ahead of
 * the drum (the airlocks in the middle of that section, clear of the drum), the machinery aft.
 */

/** Columns of floor between the drum's end walls and the ring's at least (a cabin's width). */
const END = 3;
/** Rows of floor in the band at least. */
const ROWS = 3;
/** A cabin's columns, its wall included. */
const CABIN = 4;
/** A corner suite's least floor. */
const SUITE = 9;


/** The drum: its end walls x0, x1, its hull's top row T, the sections' hull row H, the ring's end walls r0, r1. */
interface Drum { x0: number; x1: number; T: number; H: number; r0: number; r1: number }

/**
 * The drum's columns [x0, x1] (its end walls): the run round the deepest column at least three quarters its depth, with
 * room for the square, the band outboard of it and the cabins at its ends. `top` the hull's top row at a column.
 */
function drumIn(top: (x: number) => number, a: number, b: number): Drum | null {
  let m = a;
  for (let x = a; x <= b; x++) if (top(x) > top(m)) m = x;
  const T = top(m), deep = 0.75 * T;
  // (Its end columns, straight up from the sections either side, are its end walls.)
  let x0 = m, x1 = m;
  while (x0 - 1 >= a && top(x0 - 1) >= deep) x0--;
  while (x1 + 1 <= b && top(x1 + 1) >= deep) x1++;
  // The square's outer walls on the hull row of the sections either side (the higher: a neck is narrower).
  const H = Math.max(top(x0 - 1), top(x1 + 1)), k = Math.floor((x1 - x0 - 2 * H) / 2);
  if (T - H - 1 < ROWS || H - 4 < SPINE + 1 || k < END + 1) return null;
  return { x0, x1, T, H, r0: x0 + k, r1: x1 - k };
}

/**
 * A tile's room in the drum: a key (tiles with one key are one room), 'hall' the ring and spine, null a wall. Out from
 * the square: the band north and south (cabins, a suite each corner), the cabins fore and aft by the spine.
 */
function cellOf(d: Drum, x: number, y: number): string | null {
  const { x0, x1, H, r0, r1 } = d, ay = Math.abs(y), side = y < 0 ? 'n' : 's', end = x - x0 < x1 - x ? 'f' : 'a';
  if (ay > H) {
    // The corner suites over the ring's corridor columns (their door onto its corner), the cabins near-equal between.
    const c0 = r0 + 2, c1 = r1 - 2;
    if (x <= c0 || x >= c1) return `suite:${side}${end}`;
    if (x === c0 + 1 || x === c1 - 1) return null;
    const a = c0 + 2, n = c1 - 2 - a + 1, k = Math.max(1, Math.floor((n + 1) / CABIN));
    for (let i = 0; i < k; i++) {
      const lo = a + Math.round((i * (n + 1)) / k), hi = a + Math.round(((i + 1) * (n + 1)) / k) - 2;
      if (x >= lo && x <= hi) return `cabin:${side}${i}`;
    }
    return null;
  }
  if (ay === H) return null;
  if (x > r0 && x < r1) {
    // The square: the ring two wide inside its walls, the garden's wall, the garden.
    if (ay >= H - 2 || x <= r0 + 2 || x >= r1 - 2) return 'hall';
    if (ay === H - 3 || x === r0 + 3 || x === r1 - 3) return null;
    return 'garden';
  }
  // The spine in through the ring's end walls; fore and aft of the square, either side of it, a shared room: lounges
  // forward, gyms aft.
  if (ay < SPINE) return 'hall';
  if (x === r0 || x === r1 || ay === SPINE) return null;
  return `${end === 'f' ? 'lounge' : 'gym'}:${side}`;
}

/** The frame's drums, fore to aft. */
function drumsOf(fr: Frame): Drum[] {
  return (fr.skips ?? []).flatMap(([a, b]) => drumIn(fr.top, a - 1, b + 1) ?? []);
}

/** Every room tile's key, interior tiles only (the hull's own wall left to it). */
function cells(fr: Frame): Map<string, [number, number][]> {
  const out = new Map<string, [number, number][]>();
  const inner = (x: number, y: number): boolean => fr.inside(x, y) && fr.inside(x + 1, y) && fr.inside(x - 1, y) && fr.inside(x, y + 1) && fr.inside(x, y - 1);
  // (A drum's rooms keyed apart from another drum's; the halls and walls shared.)
  for (const [i, d] of drumsOf(fr).entries()) for (let x = d.x0 + 1; x < d.x1; x++) for (let y = -fr.H; y <= fr.H; y++) {
    if (!inner(x, y)) continue;
    const c = cellOf(d, x, y), k = c === null ? 'wall' : c === 'hall' ? c : `${c}#${i}`;
    const got = out.get(k) ?? [];
    got.push([x, y]); out.set(k, got);
  }
  // (A corner the hull's curve leaves too small for a suite is plating.)
  const wall = out.get('wall') ?? [];
  for (const [k, ts] of out) if (k.startsWith('suite:') && ts.length < SUITE) { wall.push(...ts); out.delete(k); }
  out.set('wall', wall);
  return out;
}

const SPECS: Record<string, (area: number) => RoomSpec> = {
  cabin: () => ({ role: 'quarters', mods: ['module.bed'], w: 3, h: 3 }),
  suite: () => ({ role: 'quarters', mods: ['module.bed', 'module.bed'], w: 4, h: 3 }),
  lounge: (a) => fillerSpec('lounge', a),
  gym: (a) => fillerSpec('gym', a),
  garden: (a) => ({ role: 'support', mods: [...Array<string>(Math.max(2, Math.floor(a / 12))).fill('module.planter'), 'module.bench', 'module.bench'], w: 5, h: 5 }),
};
/** Beds a drum room holds. */
const bedsIn = (k: string): number => SPECS[k.split(/[:#]/)[0] as string]?.(0).mods.filter((m) => m === 'module.bed').length ?? 0;

/**
 * The drums' columns for the frame (their end walls), fore to aft, or null where the hull has no room for one: the
 * deepest run first, then any as deep aft of it (a deep liner's second drum, a few bays of hull between).
 */
const skipOf = (s: DockSite): [number, number][] | null => {
  const top = (x: number): number => s.depth(x) + SPINE + 1, out: [number, number][] = [];
  let a = s.xBand + MIN_DEPTH + s.CW + 2, first: Drum | null = null;
  for (let d = drumIn(top, a, s.xS); d && (!first || d.T >= first.T - 1); d = drumIn(top, a, s.xS)) {
    first ??= d;
    out.push([d.x0, d.x1]);
    a = d.x1 + 2;
  }
  return out.length > 0 ? out : null;
};

export const DRUM: BayPart = {
  // (Its annexes (the pantry, the trauma room) beside their rooms; a hold may take all its bays; the cabins the drum's or none.)
  program: { beside: true, trauma: true, holds: true, blocks: false },
  skip: skipOf,
  // (The airlocks in the forward section, clear of the drum for a shuttle to dock: its middle, else the nearest flat
  // stretch forward of that, else aft of it.)
  dock: (s) => {
    const d = skipOf(s);
    if (!d) return -1;
    const x0 = (d[0] as [number, number])[0], lo = s.xBand + MIN_DEPTH + 1, hi = x0 - s.CW - MIN_DEPTH - 1, mid = Math.round((s.xBand + x0 - s.CW) / 2);
    for (let x = Math.min(mid, hi); x >= lo; x--) if (s.flat(x)) return x;
    for (let x = mid + 1; x <= hi; x++) if (s.flat(x)) return x;
    return -1;
  },
  zones: { forward: (b, fr) => b.x0 < (fr.skips?.[0]?.[0] ?? Infinity), other: () => 'systems' },
  cabins: (fr) => [...cells(fr).keys()].reduce((n, k) => n + bedsIn(k), 0),
  paint: (fr, { g, hall }) => {
    const ox = -Math.floor(fr.W / 2);
    for (const [k, ts] of cells(fr)) {
      const spec = SPECS[k.split(/[:#]/)[0] as string]?.(ts.length);
      const id = k === 'wall' ? SOLID : k === 'hall' ? hall : g.room(spec?.role ?? 'support', spec ? { spec } : {});
      for (const [x, y] of ts) g.set(ox + x, y, id);
    }
  },
};
