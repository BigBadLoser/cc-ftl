import { localBuilder } from './blocks';
import type { Builder, Rect } from './builder';
import type { RoomSpec } from './plan';
import type { Rng } from '../rng';
import { bandArcs, bandDepth, bandRadius } from './stationBands';
import { isDock, isSystem, placeDepartments, ringProgram } from './stationDepartments';
import { dockBanks } from './stationDocks';
import { besideSpoke, centreOf, corridor, fitAlong, free, ROTUNDA, SHOP, span, spoke, widthOf } from './stationRings';
import { halfWidth, reachOf, unitOf, wheelCandidates, type Dir, type Job, type Unit, type WheelCandidate } from './stationWheelSearch';

/**
 * The trading wheel (docs/STATIONGEN2.md, step 2): one round ring, a rotunda at the centre on four spokes, the market
 * street down the south concourse. Departments are placed before rooms, together with the ring's size
 * (stationWheelSearch.ts): the best few candidates are built on a bare skeleton (ring, rotunda, spokes, market street),
 * their blocks placed for real (a candidate whose blocks do not all fit grows its ring and tries again); the best that
 * places every room gets its dock banks and outboard band, and keeps them if every public room of the band opens onto
 * the ring (else the next best). Nothing is placed anywhere its department was not given.
 */

const ANGLE: Record<Dir, number> = { e: 0, s: Math.PI / 2, w: Math.PI, n: -Math.PI / 2 };
/** Candidates built for real, and the radius steps a candidate may grow by when its blocks do not all fit. */
const TRIES = 6;
const GROW = [0, 3, 6];
/** Score lost per tile of radius (as in the search). */
const PER_TILE = 0.08;
const DIAGONALS = [-Math.PI / 4, Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4];

/**
 * Units lining one side of spoke d (side -1 or 1), from the ring inward, each opening onto the spoke through its middle;
 * a unit that meets something in its way moves on inward past it. Returns the units that found no place.
 */
function lineSide(b: Builder, R: number, d: Dir, side: -1 | 1, units: Unit[]): Unit[] {
  const xy = (u: number, v: number): [number, number] => (d === 's' ? [v, u] : d === 'n' ? [v, -u] : d === 'e' ? [u, v] : [-u, v]);
  const hw = halfWidth(d);
  let u = R - 3;
  for (const [i, unit] of units.entries()) {
    const { along: A, across: C } = unit;
    let done = false;
    for (let at = Math.min(u, reachOf(R, C, hw)); !done && at - (A + 1) > 0; at--) {
      const u0 = at - (A + 1);
      const v0 = side < 0 ? -hw - (C + 1) : hw;
      const [ax, ay] = xy(u0, v0), [bx, by] = xy(u0 + A + 1, v0 + C + 1);
      const rect: Rect = { x: Math.min(ax, bx), y: Math.min(ay, by), w: Math.abs(bx - ax) + 1, h: Math.abs(by - ay) + 1 };
      if (!free(b, rect) || !b.place(rect, unit.spec.role, unit.spec)) continue;
      const [dx, dy] = xy(u0 + ((A + 2) >> 1), side < 0 ? -hw : hw);
      b.cv.setDoor(dx, dy);
      u = u0;
      done = true;
    }
    if (!done) return units.slice(i);
  }
  return [];
}

/** A department's rooms in their place; returns the rooms that found none. */
function placeJob(b: Builder, R: number, ring: number, j: Job): RoomSpec[] {
  const p = j.place;
  if (p.kind === 'street') {
    const units = j.rooms.flat().map(unitOf);
    return lineSide(b, R, p.d, 1, lineSide(b, R, p.d, -1, units)).map((u) => u.spec);
  }
  if (p.kind === 'beside') {
    // Doors lean towards the spoke: a department beside a spoke is entered from its end of the arc.
    return j.rooms.flatMap((rs, k) => {
      const side = k === 0 ? -1 : 1;
      const lean = (r: RoomSpec): RoomSpec => (r.doorLean ? r : { ...r, doorLean: side > 0 ? -1 : 1 });
      return rs.length > 0 ? fitAlong(b, R, ring, rs.map(lean), besideSpoke(rs, R, ANGLE[p.d], side), -1) : [];
    });
  }
  if (p.kind === 'diagonal') {
    const all = [...j.rooms.flat()].sort((a, c) => c.w * c.h - a.w * a.h);
    return DIAGONALS.flatMap((at, q) => {
      const rs = all.filter((_, i) => i % 4 === q);
      return rs.length > 0 ? fitAlong(b, R, ring, rs, [span(rs, at, R)], -1) : [];
    });
  }
  const arcs = p.quads.map((q): [number, number] => [-Math.PI / 2 + (q * Math.PI) / 2 + 0.3, (q * Math.PI) / 2 - 0.3]);
  return fitAlong(b, R, ring, j.rooms.flat(), arcs, -1);
}

/** The ring, the rotunda, the four spokes and the market street's shops (as many as fit, both sides). */
function skeleton(rng: Rng, R: number, market: boolean): { b: Builder; ring: number } | null {
  const b = localBuilder(rng);
  const ring = corridor(b, R, 'wheel');
  const c = centreOf(b, null);
  if (!ring || !c) return null;
  for (const d of ['n', 'e', 's', 'w'] as const) if (!spoke(b, d, c.face(d), R - 1, c.label, ring.label, widthOf(d))) return null;
  if (market) {
    const shop = (): Unit => ({ spec: { role: 'shop', mods: [], w: SHOP.depth, h: SHOP.width, dept: 'commons' }, along: SHOP.width, across: SHOP.depth });
    for (const side of [-1, 1] as const) lineSide(b, R, 's', side, Array.from({ length: 2 * R }, shop));
  }
  return { b, ring: ring.label };
}

export interface PlannedWheel { b: Builder; label: string }

/** The trading wheel: rooms (the office first), docks among them; `market` lines the south concourse with shops. */
export function plannedWheel(rng: Rng, rooms: RoomSpec[], market: boolean): PlannedWheel | null {
  const docks = rooms.filter(isDock);
  const sys = rooms.filter(isSystem);
  const bandIn = rooms.filter((r) => !isDock(r) && !isSystem(r));
  const depth = bandDepth(bandIn);
  const prog = ringProgram(bandIn, sys);
  // The least ring: the band and its dock banks round the rotunda; the blocks inside may ask for more.
  const R0 = Math.max(bandRadius([...prog.band, ...docks], depth), ROTUNDA + 12);
  const cands = wheelCandidates(rng, { prog, R0, market, westDocks: false });
  // The search's radius is an estimate from the blocks' lengths: a candidate whose blocks do not all fit when built
  // grows a little and is tried again (the blocks set the size); each step costs it score.
  const built: { cand: WheelCandidate; b: Builder; ring: number; R: number; v: number }[] = [];
  for (const cand of cands.slice(0, TRIES)) {
    for (const g of GROW) {
      const R = cand.R + g;
      const sk = skeleton(rng, R, market);
      if (!sk) continue;
      if (cand.jobs.flatMap((j) => placeJob(sk.b, R, sk.ring, j)).length > 0) continue;
      built.push({ cand, b: sk.b, ring: sk.ring, R, v: cand.score - PER_TILE * g });
      break;
    }
  }
  // The best that also takes its dock banks and its band with every public room opening onto the ring.
  for (const { cand, b, ring, R } of built.sort((p, q) => q.v - p.v)) {
    const banks = dockBanks(b, R, ring, docks, R + Math.max(depth, 6) + 2);
    if (!banks) continue;
    const plan = { secure: cand.secure, freight: cand.freight, quiet: cand.quiet, market };
    const { arcs, band } = placeDepartments(rng, prog, banks.splits, market, plan);
    if (!bandArcs(b, R, ring, band, depth, arcs) || !publicOnRing(b, ring)) continue;
    return { b, label: `${cand.label} R ${R}` };
  }
  return null;
}

/** Public rooms of the band (the office, messes, medbays) whose door is not onto the ring. */
const PUBLIC: readonly string[] = ['bridge', 'support', 'medbay'];
function publicOnRing(b: Builder, ring: number): boolean {
  const cv = b.cv;
  return b.parts.filter((p) => p.key.startsWith('band') && PUBLIC.includes(p.role)).every((p) => {
    for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) {
      if (cv.at(x, y) !== 'D') continue;
      const around = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => cv.labelAt(x + (dx as number), y + (dy as number)));
      if (around.includes(ring) && around.some((L) => L >= 0 && cv.labels[L]?.chunk === p.key)) return true;
    }
    return false;
  });
}
