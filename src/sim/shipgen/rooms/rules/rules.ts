/**
 * Furnishing rules for station rooms: each arrangement of the signed-off mock (tools/shipgen/mocks/furnishingRules.ts)
 * as a function of the room's size and main door, in the room frame of parts.ts. A rule places the room's planned
 * beds, guns, generators and reactors itself and decides the extras (lockers between paired beds, tables and chairs,
 * batteries between generators and reactors, never in gun rooms); place.ts sets any other planned module (life support, a fabricator) and checks the result.
 */
import type { ModuleDef } from '../../../registry';
import type { RoomRole } from '../../types';
import type { Piece } from './check';
import { db, pods2, pods2Fit, tr, traumaFits, ward, wardBeds } from './bays';
import { HY, HYL, f1, f3, f3Fits } from './farm';
import { rw } from './refinery';
import { AC, B, seats, BT, OB, OBL, CD, DR, EX, FB, RF, G, GT, L, LS, MB, P, RK, RP, RS, SB, SP, SW, T, bunks, count, isCut, leftover, middle, off, range, rowsOf, sidePairs, tables, type Beds, type Run } from './parts';
import { PB, VB, AI, CR, bank, core, crates, lifeWalls, lifeWallsFit, machines, machinesFit, podsFit, pods, shuttle, walkwayFits, walkwayHold } from './plant';
import { laid, m4, messFloor } from './mess';
import { co, cu, gy, hl, mk, pz } from './social';
import { bg, ore, pa, qm, shelfSlots } from './stores';
import { bk, lb, rf, rf2, rf2Fits, su, ws } from './works';

/** What a rule is given: the room (frame), the planned modules, and the module defs. */
/**
 * What a rule sees: the room's frame size, the door's column under the bottom wall (d), the planned modules, and the
 * floor tiles just inside the room's other doors, in frame tiles (a through room: what stands there would block them).
 */
export interface Ctx {
  w: number; h: number; d: number; need: readonly string[]; defs: Record<string, ModuleDef>; doors?: readonly { x: number; y: number }[];
  /** The frame's corner tiles that are wall (a cut or round corner): nothing stands there. */
  cut?: readonly { x: number; y: number }[];
}

export interface RuleArrangement {
  name: string;
  weight: number;
  /** Whether the arrangement suits a room planned with these modules (default: any). */
  when?: (need: readonly string[], c: { w: number; h: number; defs: Record<string, ModuleDef> }) => boolean;
  rule: (c: Ctx) => Piece[];
  /** Tried in the room's deepest frames first (at least this wide), back wall farthest from the door: a helm to the bow. */
  deep?: number;
  /** Modules it stands in for planned ones (planned id → its own), each one for one. */
  swap?: Readonly<Record<string, string>>;
}

/** The room's sleeper piece (the first planned module that is a bed, not a med bed) and how many of it. */
const sleeper = (need: readonly string[], defs: Record<string, ModuleDef>): string => need.find((m) => defs[m]?.bed) ?? B;
const beds = (c: Ctx): Beds => { const def = sleeper(c.need, c.defs); return { left: count(c.need, def), def }; };
const pieces = (need: readonly string[], defs: Record<string, ModuleDef>): number => count(need, sleeper(need, defs));
const size = (c: Ctx, id: string): number => c.defs[id]?.footprint[0] ?? 2;
const isGun = (c: Ctx, id: string): boolean => !!(c.defs[id]?.weapon || c.defs[id]?.pointDefense);
const guns = (c: Ctx): string[] => c.need.filter((m) => isGun(c, m));
/** Whether the room is walked through: a door in its back wall too, none in its sides. */
const through = (c: Ctx): boolean => (c.doors ?? []).some((t) => t.y === 0) && !(c.doors ?? []).some((t) => t.x === 0 || t.x === c.w - 1);

/**
 * B1: bed pairs on the long walls (the door wall leaves a gap at the door), a game table in any stretch too short for a
 * pair. A room walked through (a door in its back wall too) lines the walls either side of the way through instead.
 */
function b1(c: Ctx): Piece[] {
  const { w, h, d } = c;
  let bank = beds(c);
  if (w >= h && !through(c)) {
    // Half the pairs on the back wall, half on the door wall either side of the door (two rows, as a barracks is built);
    // the back wall first, as many as it holds, where that leaves a bed over.
    const all = bank.left, half = Math.min(all, 2 * Math.ceil(all / 4)), back = { def: bank.def, left: half };
    let top = bunks(back, 0, w - 1, 0, 0);
    bank = { def: bank.def, left: all - half + back.left };
    let left = bunks(bank, 0, d - 2, h - 2, 2), right = bunks(bank, w - 1, d + 2, h - 2, 2);
    if (bank.left > 0) {
      bank = beds(c);
      top = bunks(bank, 0, w - 1, 0, 0); left = bunks(bank, 0, d - 2, h - 2, 2); right = bunks(bank, w - 1, d + 2, h - 2, 2);
    }
    const runs: Run[] = [
      { from: 0, to: w - 1, n: top.pairs, at: (v, end) => (end ? P(GT, v, 0, 1) : P(GT, v, 1, 0)) },
      { from: 0, to: d - 2, n: left.pairs, door: true, at: (v, end) => (end ? P(GT, v, h - 2, 1) : P(GT, v, h - 2, 2)) },
      { from: w - 1, to: d + 2, n: right.pairs, door: true, at: (v, end) => (end ? P(GT, v, h - 2, 1) : P(GT, v, h - 2, 2)) },
    ];
    return [...top.pieces, ...left.pieces, ...right.pieces, ...(bank.left > 0 ? [] : leftover(runs.filter((r) => r.n > 0)))];
  }
  const l = sidePairs(bank, true, w, 0, h - 1), r = sidePairs(bank, false, w, 0, h - 1);
  const runs: Run[] = [
    { from: 0, to: h - 1, n: l.pairs, at: (v, end) => (end ? P(GT, 0, v, 0) : P(GT, 1, v, 3)) },
    { from: 0, to: h - 1, n: r.pairs, at: (v, end) => (end ? P(GT, w - 2, v, 0) : P(GT, w - 2, v, 1)) },
  ];
  return [...l.pieces, ...r.pieces, ...(bank.left > 0 ? [] : leftover(runs.filter((q) => q.n > 0)))];
}

/** Pairs the back wall of a w-wide room holds (a bed, a locker, a bed, a tile between). */
const pairsAcross = (w: number): number => (w >= 3 ? Math.floor((w - 3) / 4) + 1 : 0);

/** B4: bunk pairs along the back wall, a rec corner at the door wall: an arcade in the corner by the door's far side, a game table on the other (not in a room walked through). */
function b4(c: Ctx): Piece[] {
  const { w, h, d } = c, left = d >= w >> 1;
  if (through(c)) return [];
  return [...bunks(beds(c), 0, w - 1, 0, 0).pieces, P(AC, left ? 0 : w - 1, h - 1, 2), P(GT, left ? w - 2 : 0, Math.max(3, h - 3), 0)];
}

/** B3: a pair in each corner of the long walls (the side walls of a room walked through), tables (or a game table) evenly spaced between; a corner left without a pair takes the game table. */
function b3(c: Ctx): Piece[] {
  const { w, h } = c, bank = beds(c), wide = w >= h && !through(c);
  // Each corner's pair a tile in from it where the corner is cut.
  const x0 = off(c, 0, 0, 0, 1), x1 = off(c, w - 1, 0, w - 1, -1), x2 = off(c, 0, h - 1, 0, 1), x3 = off(c, w - 1, h - 1, w - 1, -1);
  const y0 = off(c, 0, 0, 0, 1), y1 = off(c, w - 1, 0, 0, 1), y2 = off(c, 0, h - 1, h - 1, -1), y3 = off(c, w - 1, h - 1, h - 1, -1);
  const parts = wide
    ? [bunks(bank, x0, x0 + 2, 0, 0), bunks(bank, x1, x1 - 2, 0, 0), bunks(bank, x2, x2 + 2, h - 2, 2), bunks(bank, x3, x3 - 2, h - 2, 2)]
    : [sidePairs(bank, true, w, y0, y0 + 2), sidePairs(bank, false, w, y1, y1 + 2), sidePairs(bank, true, w, y2 - 2, y2), sidePairs(bank, false, w, y3 - 2, y3)];
  const mid = wide ? middle(3, 0, w - 4, h - 1, true) : middle(0, 3, w - 1, h - 4, false);
  // A corner the beds ran out before takes the game table, end on to its wall (a player either side), unless the middle has one.
  const corners = wide ? [P(GT, x0 + 1, 0, 1), P(GT, x1 - 1, 0, 1), P(GT, x2 + 1, h - 2, 1), P(GT, x3 - 1, h - 2, 1)]
    : [P(GT, 0, y0 + 1, 0), P(GT, w - 2, y1 + 1, 0), P(GT, 0, y2 - 1, 0), P(GT, w - 2, y3 - 1, 0)];
  const spare = corners.find((_, i) => parts[i]?.pairs === 0);
  return [...parts.flatMap((p) => p.pieces), ...mid, ...(spare && !mid.some((p) => p.def === GT) ? [spare] : [])];
}

/** Med beds along the back wall, stopping short of the recovery pod in the door-side corner when the room has one. */
function d1(c: Ctx): Piece[] {
  const pod = count(c.need, RP) > 0, n = count(c.need, MB);
  const xs = range(0, pod ? c.w - 4 : c.w - 1, 2).slice(0, n);
  return [...xs.map((x) => P(MB, x, 0, 0)), ...(pod ? [P(RP, c.w - 2, c.h - 2, 2)] : [])];
}

/** Med beds in bays down both side walls, the pod in the middle of the back wall. */
function d2(c: Ctx): Piece[] {
  const n = count(c.need, MB);
  const bays = range(0, c.h - 2, 2).flatMap((y): Piece[] => [P(MB, 0, y, 1), P(MB, c.w - 2, y, 1)]).slice(0, n);
  return [...bays, ...(count(c.need, RP) > 0 ? [P(RP, Math.floor(c.w / 2) - 1, 0, 0)] : [])];
}

/** D3: a narrow ward seen from its end: med beds down the long wall away from the door, lying across it, the pod at the far end. */
function d3(c: Ctx): Piece[] {
  const pod = count(c.need, RP) > 0, right = c.d < c.w / 2, x = right ? c.w - 2 : 0;
  const last = c.h - (Math.abs(c.d - (x + 0.5)) <= 1.5 ? 3 : 2);
  const beds = range(pod ? 3 : 0, last, 2).slice(0, count(c.need, MB)).map((y) => P(MB, x, y, 1));
  return [...(pod ? [P(RP, x, 0, 0)] : []), ...beds];
}

/** Units (gens, reactors) spread across the back wall, batteries in each gap side by side against it: two, or three (`along`). */
function spread(c: Ctx, units: string[], along: boolean): Piece[] {
  const k = units.length, s = units.map((u) => size(c, u)), total = s.reduce((a, b) => a + b, 0);
  const gap = k > 1 ? Math.floor((c.w - total) / (k - 1)) : 0;
  let x = 0;
  return units.flatMap((u, i): Piece[] => {
    const at = x, w = s[i] as number;
    x += w + gap;
    if (i === k - 1) return [P(u, at, 0)];
    // A battery stands a tile wide and two deep: side by side against the back wall.
    const n = along ? 3 : 2, bats = range(0, n - 1, 1).map((j) => P(BT, at + w + Math.floor((gap - n) / 2) + j, 0));
    return [P(u, at, 0), ...bats];
  });
}

/** Whether units (gens, reactors) stand in a row across a w-wide back wall, a tile apart. */
const across = (c: { w: number; defs: Record<string, ModuleDef> }, units: readonly string[]): boolean => units.reduce((n, u) => n + (c.defs[u]?.footprint[0] ?? 2) + 1, -1) <= c.w;
const powerUnits = (need: readonly string[], defs: Record<string, ModuleDef>): string[] => need.filter((m) => (defs[m]?.power ?? 0) > 0);

/**
 * R2: a long reactor room (more reactors than stand across its back wall): the reactors down both long walls, spread
 * from end to end, two batteries against the wall in each gap; the aisle down the middle to the door.
 */
function r2(c: Ctx): Piece[] {
  const units = powerUnits(c.need, c.defs);
  return [0, 1].flatMap((side) => {
    const list = units.filter((_, i) => i % 2 === side), wx = side === 0 ? 0 : c.w - 1;
    const y0 = off(c, wx, 0, 0, 1), y1 = off(c, wx, c.h - 1, c.h - 1, -1), s = list.map((u) => size(c, u));
    const gap = list.length > 1 ? Math.floor((y1 - y0 + 1 - s.reduce((a, b) => a + b, 0)) / (list.length - 1)) : 0;
    let y = y0;
    return list.flatMap((u, i): Piece[] => {
      const at = y, w = s[i] as number, x = side === 0 ? 0 : c.w - w;
      y += w + gap;
      if (i === list.length - 1 || gap < 1) return [P(u, x, at)];
      const by = at + w + Math.floor((gap - 1) / 2);
      return [P(u, x, at), P(BT, wx, by), P(BT, side === 0 ? 1 : c.w - 2, by)];
    });
  });
}

/** Guns in a row across the room at y, a tile apart, centred. */
function row(c: Ctx, list: readonly string[], y: (s: number) => number): Piece[] {
  let x = Math.floor((c.w - list.reduce((n, g) => n + size(c, g) + 1, -1)) / 2);
  return list.map((g) => { const s = size(c, g), p = P(g, x, y(s)); x += s + 1; return p; });
}

/**
 * G1: guns in a row across the middle, a tile apart, centred, clear of the door row when the room is deeper than a gun;
 * down the far side from the door, a tile apart, when the row does not fit across. No batteries in gun rooms (power
 * storage is the battery room's).
 */
function g1(c: Ctx): Piece[] {
  const list = guns(c);
  if (list.reduce((n, g) => n + size(c, g) + 1, -1) <= c.w) return row(c, list, (s) => Math.max(0, Math.min(Math.floor((c.h - s) / 2), c.h - 1 - s)));
  let y = 0;
  return list.map((g) => { const s = size(c, g), p = P(g, c.w - s >= 1 ? (c.d < c.w / 2 ? c.w - s : 0) : Math.floor((c.w - s) / 2), y); y += s + 1; return p; });
}

/** G2: two rows of three-wide columns, the top row's guns in the columns, the bottom row's centred under them. */
function g2(c: Ctx): Piece[] {
  const list = guns(c), cols = Math.ceil(list.length / 2), top = list.slice(0, cols), bottom = list.slice(cols);
  const gap = Math.floor((c.w - 3 * cols) / (cols + 1)), colX = (k: number): number => gap + k * (3 + gap), mid = (cols - 1) / 2;
  const place = (g: string, k: number, y: number): Piece => { const s = size(c, g), x = colX(k); return P(g, k < mid ? x : k > mid ? x + 3 - s : x + Math.floor((3 - s) / 2), y); };
  return [...top.map((g, k) => place(g, k, 1)), ...row(c, bottom, () => 5)];
}

/** G3: guns in the corners. */
function g3(c: Ctx): Piece[] {
  return guns(c).map((g, i): Piece => { const s = size(c, g); return P(g, i % 2 === 0 ? 1 : c.w - 1 - s, i < 2 ? 1 : c.h - 1 - s); });
}

const has = (id: string) => (need: readonly string[]): boolean => need.includes(id);
/**
 * A mess with a galley that is no hall: its floor within three times what its planned tables ask (a hub mess, long for
 * the branches off it, takes M4's line only: the corner and grid arrangements would cluster its few tables in a corner).
 */
const mess = (need: readonly string[], r: { w: number; h: number }): boolean => { const { w, h } = messFloor(count(need, T), count(need, G)); return need.includes(G) && r.w * r.h <= 3 * w * h; };

/** Consoles a station's bridge holds besides the helm. */
const OPS: readonly string[] = ['module.weaponsConsole', 'module.shieldConsole'];
/**
 * OP: an ops room (a bridge with no helm: a base's command room): its consoles on the back wall spread from corner to
 * corner (a tile in from a cut one), so a door in the middle of it stays clear; a table with its chairs on the back wall
 * between the two consoles (none when a door is near the back wall, or the gap is under two wide: nothing else fits
 * off the ways between the doors).
 */
function op(c: Ctx): Piece[] {
  return consoleRow(c, c.need.filter((m) => OPS.includes(m)));
}

const HELM = 'module.helm';
/** Whether a room fits its helm on the back wall with a row behind it to walk. */
const helmFits = (need: readonly string[], r: { w: number; h: number; defs: Record<string, ModuleDef> }): boolean => {
  const [hw, hd] = r.defs[HELM]?.footprint ?? [2, 2];
  return need.includes(HELM) && hw <= r.w && hd + 1 <= r.h;
};

/**
 * HF: the helm the frontmost module, on the back wall (the bow, on a ship) and centred on the door. Every other console
 * stands against a wall, never loose on the floor, turned across the room on a side wall (a quarter turn from the helm)
 * with its aft edge on the door wall: the first in one aft corner, the next in the other, then forward along the walls a
 * tile apart. Where that has no room: the corner a tile off the door wall, then elsewhere on a side wall, then the bow
 * wall beside the helm, then the door wall beside the door. The door's way to the helm stays clear (a tile either side
 * of it where there is room), and so does every other door's approach.
 */
function helmFront(c: Ctx): Piece[] {
  const fp = (m: string): readonly [number, number] => c.defs[m]?.footprint ?? [2, 2];
  const [hw, hd] = fp(HELM), hx = Math.max(0, Math.min(c.w - hw, c.d - Math.floor(hw / 2)));
  const out: Piece[] = [P(HELM, hx, 0, 0)];
  type Box = { x: number; y: number; w: number; h: number };
  const boxes: Box[] = [{ x: hx, y: 0, w: hw, h: hd }];
  const way: Box = { x: c.d, y: hd, w: 1, h: c.h - hd };
  const ways: Box[] = [way, ...(c.doors ?? []).map((t): Box => ({ x: t.x, y: t.y, w: 1, h: 1 })), { x: c.d, y: c.h - 1, w: 1, h: 1 }];
  const hit = (a: Box, b: Box, m: number): boolean => a.x < b.x + b.w + m && b.x < a.x + a.w + m && a.y < b.y + b.h + m && b.y < a.y + a.h + m;
  const free = (r: Box, m: number): boolean => {
    if (r.x < 0 || r.y < 0 || r.x + r.w > c.w || r.y + r.h > c.h) return false;
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (isCut(c, x, y)) return false;
    return !boxes.some((b) => hit(r, b, m)) && !ways.some((b) => hit(r, b, m));
  };
  const put = (m: string, r: Box, rot: number): void => { out.push(P(m, r.x, r.y, rot)); boxes.push(r); };
  const sideCount: number[] = [0, 0], load = (s: number): number => sideCount[s] ?? 0;
  c.need.filter((m) => OPS.includes(m)).forEach((m) => {
    const [len, d] = fp(m);
    // A side wall's spot: left turned east (rot 3), right turned west (rot 1), nearest the door wall first.
    const side = (s: number, at: number): [Box, number] => [{ x: s === 0 ? 0 : c.w - d, y: at, w: d, h: len }, s === 0 ? 3 : 1];
    const order = load(0) <= load(1) ? [0, 1] : [1, 0];
    for (const margin of [1, 0]) {
      for (let at = c.h - len; at >= 0; at--) {
        for (const s of order) {
          const [r, rot] = side(s, at);
          if (!free(r, margin)) continue;
          put(m, r, rot); sideCount[s] = load(s) + 1;
          return;
        }
      }
      // The bow wall beside the helm, outermost first (with a tile between where there is one), then the door wall.
      const spots: [Box, number][] = [];
      for (const x of [0, c.w - len]) spots.push([{ x, y: 0, w: len, h: d }, 0]);
      for (const x of [0, c.w - len]) spots.push([{ x, y: c.h - d, w: len, h: d }, 2]);
      const spot = spots.find(([r]) => free(r, margin));
      if (spot) { put(m, spot[0], spot[1]); return; }
    }
  });
  // A kind all there or none (the placer takes the rest of a kind).
  return out.filter((p) => out.filter((q) => q.def === p.def).length === c.need.filter((m) => m === p.def).length);
}

/** Consoles on the back wall from corner to corner, and the ops room's table between the outer two where it fits. */
function consoleRow(c: Ctx, list: readonly string[]): Piece[] {
  const sizes = list.map((m) => size(c, m)), x0 = off(c, 0, 0, 0, 1), x1 = off(c, c.w - 1, 0, c.w - 1, -1);
  const gap = list.length > 1 ? Math.floor((x1 - x0 + 1 - sizes.reduce((a, b) => a + b, 0)) / (list.length - 1)) : 0;
  let x = list.length > 1 ? x0 : Math.floor((c.w - (sizes[0] ?? 0)) / 2);
  const consoles = list.map((m, i) => { const p = P(m, i === list.length - 1 && i > 0 ? x1 + 1 - (sizes[i] as number) : x, 0, 0); x += (sizes[i] as number) + gap; return p; });
  const lo = list.length > 1 ? (consoles[0] as Piece).x + (sizes[0] as number) : 0, hi = list.length > 1 ? (consoles[consoles.length - 1] as Piece).x : 0;
  const tx = lo + Math.floor((hi - lo - 2) / 2);
  const seat = list.length > 1 && hi - lo >= 2 && c.h >= 5 && !(c.doors ?? []).some((t) => t.y <= 2);
  return [...consoles, ...(seat ? [P(T, tx, 1, 0), ...seats(tx, 1)] : [])];
}

/** Arrangements by room role. A room takes one that suits it (seeded), else the plain fallback (place.ts). */
export const RULES: Partial<Record<RoomRole, readonly RuleArrangement[]>> = {
  quarters: [
    // (Barracks as built: B1 wherever it fits; the others where it does not place every bed.)
    { name: 'B1 bunk pairs on the long walls', weight: 50, when: (n, r) => pieces(n, r.defs) >= 2, rule: b1 },
    { name: 'B3 two bays, shared tables', weight: 1, when: (n, r) => pieces(n, r.defs) >= 2 && pieces(n, r.defs) <= 8, rule: b3 },
    { name: 'B4 bunks on the back wall, a rec corner', weight: 1, when: (n, r) => { const k = pieces(n, r.defs); return k >= 2 && k <= 2 * pairsAcross(r.w) && r.w >= 6 && r.h >= 5; }, rule: b4 },
    { name: 'C1 cabin', weight: 1, when: (n, r) => pieces(n, r.defs) === 1, rule: (c) => [P(sleeper(c.need, c.defs), 0, 0, 0), P('module.storage_locker', c.w - 1, 0, 0)] },
  ],
  support: [
    {
      name: 'M1 table grid', weight: 1, when: mess,
      rule: (c) => { const x = off(c, 0, 0, 0, 1); return laid(c, [P(G, x, 0, 0), P(G, x + 2, 0, 0), P(LS, off(c, 0, c.h - 1, 0, 1), c.h - 2, 0), ...rowsOf(c.h).flatMap((y) => tables(5, c.w - 1, y + (c.h <= 5 ? 1 : 0), 1))]); },
    },
    { name: 'M2 tables in pairs', weight: 1, when: mess, rule: (c) => laid(c, [...range(off(c, 0, 0, 0, 1), c.h - 2, 3).filter((y) => !isCut(c, 0, y + 1)).map((y) => P(G, 0, y, 3)), ...rowsOf(c.h).flatMap((y) => tables(3, c.w - 1, y + (c.h <= 5 ? 1 : 0), 2))]) },
    {
      // One line of tables: a small mess only (a deep one would stand half empty).
      name: 'M3 galley corner, tables in line', weight: 1, when: (n, r) => mess(n, r) && Math.min(r.w, r.h) <= 7,
      rule: (c) => laid(c, [P(G, 0, 0, 3), P(G, 0, 2, 3), P(LS, 0, c.h - 1, 1), P(GT, 4, 1, 0), ...tables(7, c.w - 1, 1, 1), P('module.arcade', c.w - 1, c.h - 1, 2)]),
    },
    { name: 'M4 tables down the long axis', weight: 2, when: has(G), rule: (c) => laid(c, m4(c)) },
    { name: 'SU suit-up, lockers on the back wall', weight: 1, when: (n, r) => !n.includes(G) && n.includes(L) && count(n, L) <= r.w, rule: su },
    { name: 'GY gym, sparring droids in a row', weight: 1, when: (n, r) => n.includes(EX) && r.h >= 4 && r.w >= 3 * count(n, EX), rule: gy },
  ],
  medbay: [
    // (A big ward first: its own beds to its size, nothing else.)
    { name: 'D5 ward to size, med beds down the walls', weight: 50, when: (n, r) => n.length > 0 && n.every((m) => m === MB) && r.w >= 5 && r.w * r.h >= 30 && count(n, MB) <= wardBeds(r.w, r.h), rule: ward },
    { name: 'D1 beds along a wall', weight: 1, rule: d1 },
    { name: 'D2 bays, pod in the middle', weight: 1, when: (_, r) => r.w >= 9, rule: d2 },
    { name: 'D3 beds down the long wall', weight: 1, when: (_, r) => r.h > r.w, rule: d3 },
    { name: 'T2 trauma, recovery pods in the back corners', weight: 50, when: (n, r) => pods2Fit(n, r.w) && r.h >= 3, rule: pods2 },
    { name: 'TR trauma, pod and cots along the back wall', weight: 2, when: (n, r) => n.includes(RP) && count(n, RP) === 1 && r.h >= 4 && traumaFits(n, r.w), rule: tr },
  ],
  weapons: [
    { name: 'G1 guns in a row', weight: 1, rule: g1 },
    { name: 'G2 two rows of columns', weight: 1, rule: g2 },
    { name: 'G3 guns in the corners', weight: 1, when: (n, r) => n.filter((m) => r.defs[m]?.weapon || r.defs[m]?.pointDefense).length <= 4, rule: g3 },
  ],
  shields: [{ name: 'S1 gens, batteries between', weight: 1, rule: (c) => spread(c, c.need.filter((m) => c.defs[m]?.shieldGen), false) }],
  farm: [
    { name: 'F1 greenhouse: beds on end down both long walls', weight: 1, when: (_, r) => r.h > r.w && r.w >= 4, rule: f1 },
    { name: 'F3 farm floor: beds half on each long wall, facing over the aisle', weight: 50, when: (n, r) => f3Fits(n, r), rule: f3 },
    { name: 'F3s farm floor, small beds standing in where the large will not lie two to a wall', weight: 50, when: (n, r) => n[0] === HYL && !f3Fits(n, r) && f3Fits(n, r, HY), rule: f3, swap: { [HYL]: HY } },
  ],
  bridge: [
    { name: "CO chief's office, desk and planters", weight: 1, when: (n, r) => !n.includes('module.helm') && !n.some((m) => OPS.includes(m)) && r.w >= 5 && r.w <= 10 && r.h >= 4 && r.h <= 6, rule: co },
    { name: 'OP ops room, consoles on the back wall, a table', weight: 1, when: (n, r) => !n.includes('module.helm') && n.some((m) => OPS.includes(m)) && r.w >= 5 && r.h >= 5, rule: op },
    // The helm amid the consoles, all facing the back wall: a ship's bridge has its door aft, so they face the bow.
    { name: 'HF helm bridge, the helm forward on the door\'s line, the consoles on the side walls behind it', weight: 1, when: helmFits, rule: helmFront, deep: 3 },
  ],
  cargo: [{ name: 'CW walkway hold, crate rows along a walkway down the middle', weight: 50, when: walkwayFits, rule: walkwayHold }, {
    name: 'PA pantry, cold stores along the back wall', weight: 1,
    when: (n, r) => n.length > 0 && n.every((m) => m === RK || m === CD) && r.h >= 3 && r.h <= 4 && count(n, RK) + count(n, CD) <= shelfSlots(r.w).length,
    rule: pa,
  }, { name: 'CG warehouse, crates in aisles', weight: 1, when: (n, r) => n.length > 0 && n.every((m) => m === CR) && r.h >= 2, rule: crates }, {
    name: 'OS ore store, bins down both long walls round an aisle', weight: 1,
    when: (n, r) => n.length > 0 && (n.every((m) => m === OB) || n.every((m) => m === OBL)) && Math.min(r.w, r.h) >= 5 && Math.max(r.w, r.h) >= n.length + 1,
    rule: ore,
  }],
  core: [{ name: 'CR core vault, the AI core between its point defence', weight: 1, when: (n, r) => count(n, AI) === 1 && r.w >= 3 * n.length - 1, rule: core }],
  plant: [
    { name: 'L1 life support on the side walls', weight: 50, when: lifeWallsFit, rule: lifeWalls },
    { name: 'BA battery room, the cells in a bank round the console', weight: 1, when: (n, r) => n.includes(BT) && r.w >= 3 && r.h >= 3, rule: bank },
    { name: 'MR machine room, the machines on the back wall', weight: 1, when: machinesFit, rule: machines },
  ],
  armoury: [
    { name: 'QM quartermaster, armoury lockers round a desk', weight: 1, when: (n, r) => !n.includes(SW) && r.w >= 7 && r.h >= 5, rule: qm },
    { name: 'BG brig, stasis wheel at the back', weight: 1, when: (n, r) => count(n, SW) === 1 && r.w >= 7 && r.h >= 6, rule: bg },
  ],
  industry: [
    // Weight 100: in a hall big enough for it, RW is the arrangement (RF and RF2 are for the rooms it does not fit).
    { name: 'RW refinery hall, the machines against the walls, doorways clear', weight: 100, when: (n, r) => n.includes(RF) && Math.min(r.w, r.h) >= 7 && Math.max(r.w, r.h) >= 13, rule: rw },
    { name: 'RF refinery, an ore bin flush under each', weight: 1, when: (n, r) => n.includes(RF) && r.h >= 7 && r.w >= 4 * count(n, RF), rule: rf },
    { name: 'RF2 refineries in rows, an ore bin flush beside each (deep rooms)', weight: 1, when: (n, r) => n.includes(RF) && rf2Fits(r.w, r.h) >= count(n, RF), rule: rf2 },
    { name: 'WS workshop, fabricator between the racks', weight: 1, when: (n, r) => n.includes(FB) && !n.includes(SP) && !n.includes(RS) && r.h >= 4 && r.w >= 4 + 2 * count(n, FB), rule: ws },
    { name: 'BK breaker, scrapper between the bins', weight: 1, when: (n, r) => count(n, SP) === 1 && r.w >= 8 && r.h >= 5 && (count(n, SB) === 0 || count(n, SB) === 2), rule: bk },
    { name: 'LB lab, research modules along the back wall', weight: 1, when: (n, r) => n.includes(RS) && r.h >= 4 && r.w >= 3 * count(n, RS), rule: lb },
  ],
  hangar: [
    { name: 'SH shuttle hangar, the bay at the back', weight: 1, when: (n, r) => count(n, VB) === 1 && r.w >= 5 && r.h >= 5, rule: shuttle },
    { name: 'PB pod deck, bays in rows', weight: 1, when: (n, r) => n.length > 0 && n.every((m) => m === PB) && podsFit(n.length, r.w, r.h), rule: pods },
    { name: 'DB drone bay, bays spread across', weight: 1, when: (n, r) => n.length > 0 && n.every((m) => m === DR) && r.h >= 4 && r.w >= 2 * n.length, rule: db },
  ],
  hall: [{ name: 'HL hall street, planters and benches on the wall', weight: 1, when: (n, r) => n.length === 0 && r.w >= 8 && r.h >= 3 && r.h <= 4, rule: hl }],
  plaza: [
    { name: 'CU customs (a harbour customs hall), a desk and chairs', weight: 1, when: (n, r) => n.includes('module.mess_table') && r.w >= 7 && r.h >= 3, rule: cu },
    { name: 'MK market hall, consoles and benches on the walls', weight: 1, when: (n, r) => n.includes('module.console') && !n.includes('module.mess_table') && r.w >= 7 && r.h >= 7, rule: mk },
    { name: 'PZ parade hall, benches round the planters', weight: 1, when: (n, r) => n.length === 0 && r.w >= 9 && r.h >= 7, rule: pz },
  ],
  reactor: [
    { name: 'R1 reactors, batteries between', weight: 1, rule: (c) => spread(c, powerUnits(c.need, c.defs), true) },
    { name: 'R2 reactors down both long walls', weight: 1, when: (n, r) => r.h > r.w && !across(r, powerUnits(n, r.defs)), rule: r2 },
    // Turned lengthwise end to end along the back wall: a shallow room (a ship's reactor room is three deep at every tier).
    { name: 'R4 reactors lengthwise along the back wall', weight: 2, when: (n, r) => { const u = powerUnits(n, r.defs); return u.length > 0 && u.reduce((t, m) => t + (r.defs[m]?.footprint[1] ?? 2), 0) <= r.w && Math.max(...u.map((m) => r.defs[m]?.footprint[0] ?? 2)) + 1 <= r.h; }, rule: (c) => { let x = 0; return powerUnits(c.need, c.defs).map((m) => { const p = P(m, x, 0, 1); x += c.defs[m]?.footprint[1] ?? 2; return p; }); } },
    // Packed flush from one corner along the back wall: no gap to leave a pocket of floor behind (a tight room's way).
    { name: 'R3 reactors packed along the back wall', weight: 1, when: (n, r) => powerUnits(n, r.defs).reduce((t, m) => t + (r.defs[m]?.footprint[0] ?? 2), 0) <= r.w, rule: (c) => { let x = 0; return powerUnits(c.need, c.defs).map((m) => { const p = P(m, x, 0, 0); x += size(c, m); return p; }); } },
  ],
};
