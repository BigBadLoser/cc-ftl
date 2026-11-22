import type { RoomSpec } from '../../plan';
import { MIN_DEPTH, type Frame } from '../frame';
import { SOLID } from '../regions';
import { fillerSpec } from '../roomSize';
import type { BayPart, DockSite } from './part';

/**
 * A liner's drum (PROTOTYPE, #581): the widest section, its corners rounded, cut square. A garden in the middle, a ring
 * corridor round it (its north and south runs out to the hull's ends), single cabins in bands outboard (north and south
 * cut along the hull, fore and aft either side of the spine), lounges in the rounded corners. The spine runs in to the
 * ring from fore and aft. Every room but the corners is a rectangle. The rest of the ship is on bays: crew, mess, sick
 * bay and stores ahead of the drum (the airlocks just forward of it), the machinery aft.
 */

/** Rows (and columns from the drum's ends), out to in: a band of rooms, a wall, the ring (two), a wall, the garden. */
const BAND = 4, RING = 2;
const GARDEN = BAND + 1 + RING + 1 + 1;
/** A cabin's columns, its wall included. */
const CABIN = 4;

/** The drum's columns [x0, x1] (its end walls): the run round the deepest column at least three quarters its depth. */
function span(depth: (x: number) => number, a: number, b: number): { x0: number; x1: number } | null {
  let m = a;
  for (let x = a; x <= b; x++) if (depth(x) > depth(m)) m = x;
  const half = 0.75 * depth(m);
  let x0 = m, x1 = m;
  while (x0 - 1 >= a && depth(x0 - 1) >= half) x0--;
  while (x1 + 1 <= b && depth(x1 + 1) >= half) x1++;
  return x1 - x0 >= 2 * GARDEN + 3 ? { x0: x0 - 1, x1: x1 + 1 } : null;
}

/**
 * A tile's room in the drum: a key (tiles with one key are one room), 'hall' the ring, null a wall. `e` counts columns in
 * from the drum's nearer end wall, `f` rows in from its flat top: out to in, a band of rooms, a wall, the ring, a wall, the
 * garden; the ring's north and south runs go on out to the ends (the corners' way in).
 */
function cellOf(x0: number, x1: number, T: number, x: number, y: number): string | null {
  const e = Math.min(x - x0, x1 - x), f = T - Math.abs(y), ay = Math.abs(y), side = y < 0 ? 'n' : 's', end = x - x0 < x1 - x ? 'f' : 'a';
  const RING0 = BAND + 2, RING1 = BAND + 1 + RING;
  if (f >= RING0 && f <= RING1) return 'hall';
  if (f <= BAND) {
    // North and south: a lounge in each corner, then cabins along the hull, near-equal, a wall between each.
    if (e <= GARDEN - 2) return `lounge:${side}${end}`;
    if (e === GARDEN - 1) return null;
    const a = x0 + GARDEN, n = x1 - GARDEN - a + 1, k = Math.max(1, Math.floor((n + 1) / CABIN));
    for (let i = 0; i < k; i++) {
      const c0 = a + Math.round((i * (n + 1)) / k), c1 = a + Math.round(((i + 1) * (n + 1)) / k) - 2;
      if (x >= c0 && x <= c1) return `cabin:${side}${i}`;
    }
    return null;
  }
  if (f === BAND + 1) return null;
  // Inside the ring's runs: the ring's fore and aft runs, the garden between them, the spine in to the ring.
  if (e >= RING0 && e <= RING1) return 'hall';
  if (f === GARDEN - 1 && e > RING1) return null;
  if (e >= GARDEN && f >= GARDEN) return 'garden';
  if (e === GARDEN - 1) return null;
  if (ay <= 1) return e <= BAND + 1 ? 'hall' : null;
  if (e === BAND + 1) return null;
  // Fore and aft, beside the spine (its wall row between): a cabin each side, three rows deep at least.
  if (e <= BAND && ay >= 3 && f >= GARDEN && T - GARDEN - 2 >= MIN_DEPTH) return `cabin:${side}${end}`;
  return null;
}

/** The drum's columns and top, where the frame has one. */
function drumOf(fr: Frame): { x0: number; x1: number; T: number } | null {
  if (!fr.skip) return null;
  const [x0, x1] = fr.skip;
  let T = 0;
  for (let x = x0; x <= x1; x++) T = Math.max(T, fr.top(x));
  return { x0, x1, T };
}

/** Every room tile's key, interior tiles only (the hull's own wall left to it). */
function cells(fr: Frame): Map<string, [number, number][]> {
  const d = drumOf(fr), out = new Map<string, [number, number][]>();
  if (!d) return out;
  const inner = (x: number, y: number): boolean => fr.inside(x, y) && fr.inside(x + 1, y) && fr.inside(x - 1, y) && fr.inside(x, y + 1) && fr.inside(x, y - 1);
  for (let x = d.x0 + 1; x < d.x1; x++) for (let y = -fr.H; y <= fr.H; y++) {
    if (!inner(x, y)) continue;
    const k = cellOf(d.x0, d.x1, d.T, x, y) ?? 'wall';
    const got = out.get(k) ?? [];
    got.push([x, y]); out.set(k, got);
  }
  return out;
}

const SPECS: Record<string, (area: number) => RoomSpec> = {
  cabin: () => ({ role: 'quarters', mods: ['module.bed'], w: 3, h: 3 }),
  lounge: (a) => fillerSpec('lounge', a),
  garden: (a) => ({ role: 'support', mods: [...Array<string>(Math.max(2, Math.floor(a / 12))).fill('module.planter'), 'module.bench', 'module.bench'], w: 5, h: 5 }),
};

export const DRUM: BayPart = {
  // (Its annex (the pantry) beside the mess; a hold may take all its bays; the cabins the drum's or none.)
  program: { beside: true, holds: true, blocks: false },
  skip: (s: DockSite) => { const d = span(s.depth, s.xBand + MIN_DEPTH + s.CW + 2, s.xS); return d && [d.x0, d.x1]; },
  // (The airlocks just ahead of the drum: the first flat stretch forward of it.)
  dock: (s) => {
    const d = span(s.depth, s.xBand + MIN_DEPTH + s.CW + 2, s.xS);
    if (!d) return -1;
    for (let x = d.x0 - s.CW - 1; x > s.xBand + MIN_DEPTH; x--) if (s.flat(x)) return x;
    return -1;
  },
  zones: { forward: (b, fr) => b.x0 < (fr.skip?.[0] ?? Infinity), other: () => 'systems' },
  cabins: (fr) => [...cells(fr).keys()].filter((k) => k.startsWith('cabin:')).length,
  paint: (fr, { g, hall }) => {
    const ox = -Math.floor(fr.W / 2);
    for (const [k, ts] of cells(fr)) {
      const kind = k.split(':')[0] as string;
      const id = k === 'wall' ? SOLID : k === 'hall' ? hall : g.room(SPECS[kind]?.(ts.length).role ?? 'support', { spec: (SPECS[kind] as (a: number) => RoomSpec)(ts.length) });
      for (const [x, y] of ts) g.set(ox + x, y, id);
    }
  },
};
