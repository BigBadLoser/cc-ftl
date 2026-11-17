import type { RoomSpec } from '../plan';
import type { RoomRole } from '../types';
import { at, rect, type Built, type Ctx, type Frame, type Port } from './model';
import { cabinsWithin } from './quarters';
import { SOLID, SPACE } from './regions';
import { stretchOf } from './sizing';

/**
 * A cross street (a T): at a port where a street ends, a street three wide runs across the port's heading both ways,
 * lined both sides. Painted like a pier head: its walls solid first and its floor cut out, so every wall is one tile
 * thick, and where it meets its host the host's own walls become its walls.
 *   near rows  rooms of the `near` roles, on the host's side of the street, either side of the host: beside its widest
 *              part, no deeper than the host runs back from the street
 *   far row    the rest, across the street from them, one depth, the street's whole length between its two ends
 *   back       with `back` roles: a back street behind the far row, joined to the cross street at both ends by a leg
 *              through a gate (the machinery behind gates), its rooms on its far side
 * The street is as long as its longest row needs; the far row fills it, the other rows are evened toward it as far as
 * their rooms may grow (`stretchOf`). The trade outpost's (docs/STATION_ASSEMBLY.md, "The trade outposts").
 */

export interface AcrossOpts {
  /** Roles of the rooms that stand on the host's side of the street, either side of it. */
  near?: readonly RoomRole[];
  /** Roles of the rooms on a back street behind the far row, gated at both its legs. */
  back?: readonly RoomRole[];
}

/** The cross street's width, and a back street's. */
const W = 3;

interface Unit { spec: RoomSpec; len: number; deep: number; cap: number; annexed: boolean }

const area = (r: RoomSpec): number => r.w * r.h;
/** A room shaped to a floor depth (its area kept), or with its long side along the street. */
const shaped = (r: RoomSpec, d?: number): RoomSpec => (d ? { ...r, w: Math.max(r.vehicle ? 5 : 3, Math.ceil(area(r) / d)), h: d } : r.w >= r.h ? r : { ...r, w: r.h, h: r.w });

/** A room as the units it stands in a row as: itself (or its cabins), then its annex. */
function unitsOf(r: RoomSpec, d?: number, most = Infinity): Unit[] {
  const main = shaped(r, d ?? (Math.min(r.w, r.h) > most ? most : undefined));
  const list = [main, ...(r.annex ? [{ ...shaped(r.annex, main.h), annexed: true }] : [])].flatMap(cabinsWithin);
  return list.map((s) => ({ spec: s, len: s.w, deep: s.h, annexed: !!s.annexed, cap: s.cabin || s.annexed ? s.w : Math.max(s.w, Math.floor((stretchOf(r) * area(r)) / s.h)) }));
}

const run = (row: readonly Unit[]): number => (row.length === 0 ? 0 : row.reduce((n, u) => n + u.len + 1, -1));

/** Grow a row's rooms toward `span` tiles (inner walls counted), the one with most room to grow first, none past its cap. */
function grow(row: Unit[], span: number): void {
  for (let guard = 0; guard < 400 && run(row) < span; guard++) {
    const room = row.map((u) => u.cap - u.len), k = room.indexOf(Math.max(...room));
    if (k < 0 || (room[k] as number) <= 0) return;
    (row[k] as Unit).len++;
  }
}

/** Rooms dealt either side of a middle, the first (most central) to one side, each next to the shorter: the row left to right. */
function middled(groups: readonly Unit[][]): Unit[] {
  const l: Unit[][] = [], r: Unit[][] = [];
  for (const grp of groups) (run(l.flat()) <= run(r.flat()) ? l : r).push(grp);
  return [...l.reverse().flat(), ...r.flat()];
}

export function across(c: Ctx, port: Port, rooms: readonly RoomSpec[], o: AcrossOpts, host: ReadonlySet<number>): Built | null {
  const g = c.g, f: Frame = port.frame, n0 = g.regions.length;
  const near = rooms.filter((r) => o.near?.includes(r.role)), back = rooms.filter((r) => o.back?.includes(r.role) && !near.includes(r));
  const far = rooms.filter((r) => !near.includes(r) && !back.includes(r));
  if (far.length === 0) return null;
  // The host: how far it runs back from the street on its centre line, and its width beside the near rows.
  const mid = ((port.width ?? 2) - 1) >> 1;
  const ours = (x: number, y: number): boolean => { const id = g.at(x, y); return id === SOLID || host.has(id); };
  let reach = 0;
  while (reach < 60 && ours(...at(f, -1 - reach, mid))) reach++;
  const nearRows = near.map((r) => unitsOf(r, undefined, Math.max(3, reach - 2)));
  const dN = Math.max(0, ...nearRows.flat().map((u) => u.deep));
  const filled = (v: number): boolean => { for (let u = -dN - 2; u < 0; u++) if (g.at(...at(f, u, v)) !== SPACE) return true; return false; };
  let h0 = mid, h1 = mid;
  while (h0 > mid - 60 && filled(h0 - 1)) h0--;
  while (h1 < mid + 60 && filled(h1 + 1)) h1++;
  // Near rooms dealt to the two sides, the biggest first; on each side the smallest stands next to the host.
  const halves: [Unit[][], Unit[][]] = [[], []];
  for (const grp of [...nearRows].sort((p, q) => run(q) - run(p))) (run(halves[0].flat()) <= run(halves[1].flat()) ? halves[0] : halves[1]).push(grp);
  const nearL = halves[0].sort((p, q) => run(p) - run(q)).flat(), nearR = halves[1].sort((p, q) => run(p) - run(q)).flat();
  // The back row, its core at the middle and its guns at the ends.
  const order: RoomRole[] = ['core', 'shields', 'reactor', 'plant', 'hangar', 'weapons'];
  const rank = (r: RoomSpec): number => { const i = order.indexOf(r.role); return i < 0 ? order.length : i; };
  const backRow = middled([...back].sort((p, q) => rank(p) - rank(q)).map((r) => unitsOf(r)));
  // The far row: the common rooms in the middle; one depth, the least that keeps it no longer than the rows round it.
  const farOrder = (r: RoomSpec): number => (r.role === 'support' ? 0 : r.role === 'medbay' ? 1 : 2);
  const farSorted = [...far].sort((p, q) => farOrder(p) - farOrder(q) || area(q) - area(p));
  const depths = far.map((r) => Math.min(r.w, r.h)).sort((p, q) => p - q);
  const d0 = Math.max(4, depths[depths.length >> 1] ?? 4);
  // Where the street runs: from V0 to V1 across, wide enough for the near rows beside the host...
  const needL = nearL.reduce((n, u) => n + u.len + 1, 0), needR = nearR.reduce((n, u) => n + u.len + 1, 0);
  const span = (farLen: number): [number, number] => {
    let V0 = h0 - needL + 1, V1 = h1 + needR - 1;
    const want = Math.max(farLen + 8, run(backRow), V1 - V0 + 1);
    const extra = want - (V1 - V0 + 1);
    V0 -= extra >> 1;
    V1 += extra - (extra >> 1);
    return [V0, V1];
  };
  const others = Math.max(run(backRow), h1 - h0 - 1 + needL + needR);
  let dF = d0, farRow: Unit[] = [];
  for (let d = d0; d <= Math.max(d0, 7); d++) {
    dF = d;
    farRow = middled(farSorted.map((r) => unitsOf(r, d)));
    if (run(farRow) + 8 <= others) break;
  }
  const [V0, V1] = span(run(farRow));
  // ...the far row filling it, a garden at its end for what its rooms may not take.
  grow(farRow, V1 - V0 - 7);
  const short = V1 - V0 - 7 - run(farRow);
  if (short >= 4) farRow.push({ spec: { role: 'garden', dept: 'commons', mods: [], w: short - 1, h: dF }, len: short - 1, deep: dF, cap: short - 1, annexed: false });
  else if (short > 0) (farRow.find((u) => !u.annexed && !u.spec.cabin) ?? (farRow[farRow.length - 1] as Unit)).len += short;
  grow(nearL, h0 - V0);
  grow(nearR, V1 - h1);
  grow(backRow, V1 - V0 + 1);

  // Boxes, u0 <= u < u1 by v0 <= v < v1.
  type Box = [number, number, number, number];
  const B = 5 + dF, gated = back.length > 0;
  const floors: { unit: Unit; box: Box; to: 'cross' | 'back' }[] = [];
  const lay = (row: Unit[], from: number, step: 1 | -1, u0: (un: Unit) => number, u1: (un: Unit) => number, to: 'cross' | 'back'): void => {
    let v = from;
    for (const un of row) {
      const a = step > 0 ? v : v - un.len + 1;
      floors.push({ unit: un, box: [u0(un), u1(un), a, a + un.len], to });
      v += step * (un.len + 1);
    }
  };
  lay(nearL, h0 - 1, -1, (un) => -1 - un.deep, () => -1, 'cross');
  lay(nearR, h1 + 1, 1, (un) => -1 - un.deep, () => -1, 'cross');
  lay(farRow, V0 + 4, 1, () => W + 1, () => W + 1 + dF, 'cross');
  if (backRow.length > 0) lay(backRow, V0 + ((V1 - V0 + 1 - run(backRow)) >> 1), 1, () => B + W + 1, (un) => B + W + 1 + un.deep, 'back');
  const streets: Box[] = [[0, W, V0, V1 + 1]];
  if (gated) streets.push([B, B + W, V0, V1 + 1], [W + 1, B, V0, V0 + W], [W + 1, B, V1 + 1 - W, V1 + 1]);
  const box = (b: Box): [number, number, number, number] => rect(f, b[0], b[1], b[2], b[3]);
  // Open ground for every floor and street (the host's margin across its open end included).
  for (const b of [...streets, ...floors.map((fl) => fl.box)]) {
    const [x0, y0, x1, y1] = box(b);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (!c.free(x, y)) return null;
  }
  // Solid round it all: over open ground and over rooms' walls where it meets them (never over a hall).
  const solid = (b: Box): void => g.rect(SOLID, ...box([b[0] - 1, b[1] + 1, b[2] - 1, b[3] + 1]), (x, y) => { const id = g.at(x, y); return id === SPACE || (id >= 0 && !g.regions[id]?.hall); });
  for (const b of [...streets, ...floors.map((fl) => fl.box)]) solid(b);
  const cross = g.hall('hall', 'commons');
  g.rect(cross, ...box(streets[0] as Box));
  const rear = gated ? g.hall('hall', 'secure') : -1;
  if (gated) {
    for (const b of streets.slice(1)) g.rect(rear, ...box(b));
    // A gate in each leg, on the far row's front wall line.
    g.gate(...at(f, W, V0 + 1));
    g.gate(...at(f, W, V1 - 1));
  }
  let before = -1;
  for (const fl of floors) {
    const s = fl.unit.spec, access = fl.unit.annexed && before >= 0 ? before : fl.to === 'cross' ? cross : rear;
    const id = g.room(s.role, { spec: { ...s, w: fl.unit.len, h: fl.unit.deep }, access: [access], doors: s.warehouse ? 2 : 1 });
    g.rect(id, ...box(fl.box));
    if (!fl.unit.annexed) before = id;
  }
  const regions: number[] = [];
  for (let id = n0; id < g.regions.length; id++) regions.push(id);
  const deepest = Math.max(dN, 0), backDeep = Math.max(0, ...backRow.map((u) => u.deep));
  return { ports: [], regions, box: box([-deepest - 3, (gated ? B + W + 2 + backDeep : W + 2 + dF) + 1, V0 - 2, V1 + 3]), took: 0 };
}
