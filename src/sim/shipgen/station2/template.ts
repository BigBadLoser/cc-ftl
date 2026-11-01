import type { Rng } from '../../rng';
import { shuffle } from '../civilKit';

/**
 * Station v2 structure templates (docs/STATIONGEN2.md section 3.3): the public circulation of a round station as a few
 * parameters, so stations of one kind differ in structure, not only in which room goes where. Directions are 0..7, a
 * multiple of 45 degrees from east, clockwise on screen (2 south, 4 west, 6 north). Diagonals are a clean 1:1 staircase
 * on the tile grid; no other angles are used.
 */

export type Dir8 = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const DIR_V: readonly (readonly [number, number])[] = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
export const dirAngle = (d: number): number => (d * Math.PI) / 4;

export interface Ring {
  /** Floor width. */
  w: number;
  /** A partial ring: the arc from `a0` (radians) clockwise over `span`. */
  arc?: { a0: number; span: number };
}

export interface Spoke {
  dir: Dir8;
  /** Floor half-width (floor width 2 * hw + 1 on a cardinal; a diagonal's rows are as wide). */
  hw: number;
  /** The ring it runs out to (0 the outermost). */
  reach: number;
  /** The ring it starts from (-1: the centre). A spoke between two rings links them without crossing the inner zone. */
  from: number;
}

/** A straight street off the centre, parallel to an axis (`horiz`: east-west), `off` tiles from the centre line. */
export interface Chord { horiz: boolean; off: number; hw: number; reach: number }

export interface Harbour {
  /** A cardinal face (0 east, 2 south, 4 west, 6 north). */
  dir: 0 | 2 | 4 | 6;
  docks: number;
}

export interface Template {
  kind: Family;
  /** rotunda: a round court at the centre; hub: a small round hall where the spokes meet; annular: a hub inside a court ring. */
  centre: 'rotunda' | 'hub' | 'annular';
  /** Radius of the centre (the court's outer edge for annular). */
  rc: number;
  /** Depth of each band from the hull inward: bands[0] the outer band (hull to ring 0), bands[k] between rings k-1 and k. */
  bands: number[];
  rings: Ring[];
  spokes: Spoke[];
  chords: Chord[];
  harbours: Harbour[];
  /** The outer band's depth (the template's choice; band depths inside it are solved). */
  outer: number;
  /** A wheel's open ring between the hub and the rim's inner band (its depth). */
  hollow?: number;
  /** Open sectors of the innermost zone (negative space), as [a0, span] in radians. A wheel's open quarters are these. */
  open: [number, number][];
}

function harbours(rng: Rng, docks: number): Harbour[] {
  const faces: (0 | 2 | 4 | 6)[] = [];
  const weight = (d: number): number => (d === 0 ? 1.5 : 3);
  const pickFace = (): 0 | 2 | 4 | 6 => {
    const all = ([0, 2, 4, 6] as const).filter((d) => !faces.includes(d));
    const tot = all.reduce((t: number, d) => t + weight(d), 0);
    let v = rng.next() * tot;
    for (const d of all) { v -= weight(d); if (v < 0) return d; }
    return all[all.length - 1] as 0 | 2 | 4 | 6;
  };
  const two = docks >= 4 && rng.chance(0.4);
  faces.push(pickFace());
  if (two) faces.push(pickFace());
  const a = two ? Math.ceil(docks / 2) : docks;
  return faces.map((dir, i) => ({ dir, docks: i === 0 ? a : docks - a }));
}

export type Family = 'concentric' | 'wheel' | 'concourse';

const CARDINAL: Dir8[] = [0, 2, 4, 6];
const opp = (d: Dir8): Dir8 => ((d + 4) % 8) as Dir8;

/**
 * A template of one of three structures (diagonal corridors wait until doors and pathing on 1:1 stairs are proven):
 *   concentric  two rings round a rotunda court, two to four cardinal spokes, sometimes links between the rings only
 *   wheel       a rim (rooms either side of one ring) round a small hub on cardinal spokes, its quarters open to space
 *   concourse   one ring and a straight street across the station off its centre, crossed by a street through the centre
 * `docks`: how many docks the station needs.
 */
export function sampleTemplate(rng: Rng, kind: Family, docks: number): Template {
  const hb = harbours(rng, docks);
  const faces = hb.map((h) => h.dir as Dir8);
  if (kind === 'wheel') {
    const set = rng.chance(0.75) ? [...CARDINAL] : shuffle(rng, CARDINAL).slice(0, 3).sort((a, b) => a - b);
    const open: [number, number][] = [];
    // Open quarters between the spokes; one may stay filled.
    const filled = rng.chance(0.35) ? rng.int(0, set.length - 1) : -1;
    set.forEach((d, i) => {
      const next = set[(i + 1) % set.length] as number;
      if (i !== filled) open.push([dirAngle(d), ((next - d + 8) % 8 || 8) * (Math.PI / 4)]);
    });
    return {
      kind, centre: 'hub', rc: rng.int(2, 3), outer: rng.int(9, 10), bands: [], rings: [{ w: rng.pick([2, 3]) }], hollow: rng.int(6, 10),
      spokes: set.map((dir) => ({ dir, hw: 1, reach: 0, from: -1 })), chords: [], harbours: hb, open,
    };
  }
  if (kind === 'concourse') {
    const horiz = rng.chance(0.5);
    const side = rng.pick([-1, 1]);
    // The cross street runs through the centre, square to the concourse.
    const cross: Dir8 = horiz ? (side < 0 ? 2 : 6) : (side < 0 ? 0 : 4);
    return {
      kind, centre: 'hub', rc: 1, outer: rng.int(9, 11), bands: [], rings: [{ w: rng.pick([2, 3]) }],
      spokes: [{ dir: cross, hw: 1, reach: 0, from: -1 }, { dir: opp(cross), hw: 1, reach: 0, from: -1 }],
      chords: [{ horiz, off: side * rng.int(6, 9), hw: rng.chance(0.5) ? 2 : 1, reach: 0 }], harbours: hb, open: [],
    };
  }
  // Concentric: the spokes include every harbour face (the concourse from the rotunda to the docks).
  const extra = shuffle(rng, CARDINAL.filter((d) => !faces.includes(d)));
  const set = [...new Set([...faces, ...extra.slice(0, Math.max(0, rng.int(2, 4) - faces.length))])];
  if (set.length === 1) set.push(opp(set[0] as Dir8));
  const spokes: Spoke[] = set.map((dir) => ({ dir, hw: 1, reach: 0, from: -1 }));
  // Links between the rings only, on the cardinals the main spokes leave free.
  for (const dir of CARDINAL.filter((d) => !set.includes(d))) if (rng.chance(0.6)) spokes.push({ dir, hw: 1, reach: 0, from: 1 });
  return {
    kind, centre: 'rotunda', rc: rng.int(4, 6), outer: rng.int(9, 11), bands: [], rings: [{ w: rng.pick([2, 3]) }, { w: 2 }],
    spokes, chords: [], harbours: hb, open: [],
  };
}

/** A short signature of the template's structure (topology string and diversity). */
export function templateSig(t: Template): string {
  const r = t.rings.map((g) => (g.arc ? 'a' : 'r') + g.w).join('');
  const s = [...t.spokes].map((p) => p.dir).sort().join('');
  const h = t.harbours.map((x) => 'ESWN'[x.dir / 2]).join('');
  return `${t.kind} ${t.centre} rings ${r} spokes ${s}${t.chords.length ? ' chord' : ''} harbour ${h}${t.open.length ? ` open ${t.open.length}` : ''}`;
}
