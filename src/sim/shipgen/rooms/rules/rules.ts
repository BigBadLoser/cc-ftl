/**
 * Furnishing rules for station rooms: each arrangement of the signed-off mock (tools/shipgen/mocks/furnishingRules.ts)
 * as a function of the room's size and main door, in the room frame of parts.ts. A rule places the room's planned
 * beds, guns, generators and reactors itself and decides the extras (lockers between paired beds, tables and chairs,
 * batteries between generators and reactors, never in gun rooms); place.ts sets any other planned module (life support, a fabricator) and checks the result.
 */
import type { ModuleDef } from '../../../registry';
import type { RoomRole } from '../../types';
import type { Piece } from './check';
import { db, tr, traumaFits } from './bays';
import { f1 } from './farm';
import { AC, B, BT, CD, DR, EX, FB, G, GT, L, LS, MB, P, RK, RP, RS, SB, SP, SW, bunks, count, leftover, middle, range, rowsOf, sidePairs, tables, type Beds, type Run } from './parts';
import { co, cu, gy, hl, pz } from './social';
import { bg, pa, qm, shelfSlots } from './stores';
import { bk, lb, su, ws } from './works';

/** What a rule is given: the room (frame), the planned modules, and the module defs. */
export interface Ctx { w: number; h: number; d: number; need: readonly string[]; defs: Record<string, ModuleDef> }

export interface RuleArrangement {
  name: string;
  weight: number;
  /** Whether the arrangement suits a room planned with these modules (default: any). */
  when?: (need: readonly string[], c: { w: number; h: number; defs: Record<string, ModuleDef> }) => boolean;
  rule: (c: Ctx) => Piece[];
}

/** The room's sleeper piece (the first planned module that is a bed, not a med bed) and how many of it. */
const sleeper = (need: readonly string[], defs: Record<string, ModuleDef>): string => need.find((m) => defs[m]?.bed) ?? B;
const beds = (c: Ctx): Beds => { const def = sleeper(c.need, c.defs); return { left: count(c.need, def), def }; };
const pieces = (need: readonly string[], defs: Record<string, ModuleDef>): number => count(need, sleeper(need, defs));
const size = (c: Ctx, id: string): number => c.defs[id]?.footprint[0] ?? 2;
const isGun = (c: Ctx, id: string): boolean => !!(c.defs[id]?.weapon || c.defs[id]?.pointDefense);
const guns = (c: Ctx): string[] => c.need.filter((m) => isGun(c, m));

/** B1: bed pairs on the long walls (the door wall leaves a gap at the door), a game table in any stretch too short for a pair. */
function b1(c: Ctx): Piece[] {
  const { w, h, d } = c, bank = beds(c);
  if (w >= h) {
    const top = bunks(bank, 0, w - 1, 0, 0), left = bunks(bank, 0, d - 2, h - 2, 2), right = bunks(bank, w - 1, d + 2, h - 2, 2);
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

/** B4: bunk pairs along the back wall, a rec corner at the door wall: an arcade in the corner by the door's far side, a game table on the other. */
function b4(c: Ctx): Piece[] {
  const { w, h, d } = c, left = d >= w >> 1;
  return [...bunks(beds(c), 0, w - 1, 0, 0).pieces, P(AC, left ? 0 : w - 1, h - 1, 2), P(GT, left ? w - 2 : 0, Math.max(3, h - 3), 0)];
}

/** B3: a pair in each corner of the long walls, tables (or a game table) evenly spaced between. */
function b3(c: Ctx): Piece[] {
  const { w, h } = c, bank = beds(c);
  const parts = w >= h
    ? [bunks(bank, 0, 2, 0, 0), bunks(bank, w - 1, w - 3, 0, 0), bunks(bank, 0, 2, h - 2, 2), bunks(bank, w - 1, w - 3, h - 2, 2)]
    : [sidePairs(bank, true, w, 0, 2), sidePairs(bank, false, w, 0, 2), sidePairs(bank, true, w, h - 3, h - 1), sidePairs(bank, false, w, h - 3, h - 1)];
  return [...parts.flatMap((p) => p.pieces), ...(w >= h ? middle(3, 0, w - 4, h - 1, true) : middle(0, 3, w - 1, h - 4, false))];
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

/**
 * M4: a long mess: the galleys on a short wall, tables with their chairs down the long axis in a line (two where the
 * room is wide enough across), evenly spaced and centred (`middle`).
 */
function m4(c: Ctx): Piece[] {
  const tall = c.h > c.w, across = tall ? c.w : c.h, lines = across >= 9 ? 2 : 1, span = Math.floor(across / lines);
  const galleys = tall ? [P(G, 0, 0, 0), ...(c.w >= 5 ? [P(G, c.w - 2, 0, 0)] : [])] : [P(G, 0, 0, 3), ...(c.h >= 5 ? [P(G, 0, c.h - 2, 3)] : [])];
  return [...galleys, ...range(0, lines - 1, 1).flatMap((k) => (tall
    ? middle(k * span, 2, k * span + span - 1, c.h - 1, false, true)
    : middle(2, k * span, c.w - 1, k * span + span - 1, true, true)).filter((p) => p.def !== GT))];
}

/** Units (gens, reactors) spread across the back wall, batteries in each gap: two stacked, or three in a row (`along`). */
function spread(c: Ctx, units: string[], along: boolean): Piece[] {
  const k = units.length, s = units.map((u) => size(c, u)), total = s.reduce((a, b) => a + b, 0);
  const gap = k > 1 ? Math.floor((c.w - total) / (k - 1)) : 0;
  let x = 0;
  return units.flatMap((u, i): Piece[] => {
    const at = x, w = s[i] as number;
    x += w + gap;
    if (i === k - 1) return [P(u, at, 0)];
    const bats = along ? range(0, 2, 1).map((j) => P(BT, at + w + Math.floor((gap - 3) / 2) + j, 0)) : [P(BT, at + w + Math.floor((gap - 1) / 2), 0), P(BT, at + w + Math.floor((gap - 1) / 2), 1)];
    return [P(u, at, 0), ...bats];
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

/** Arrangements by room role. A room takes one that suits it (seeded), else the plain fallback (place.ts). */
export const RULES: Partial<Record<RoomRole, readonly RuleArrangement[]>> = {
  quarters: [
    { name: 'B1 bunk pairs on the long walls', weight: 2, when: (n, r) => pieces(n, r.defs) >= 2, rule: b1 },
    { name: 'B3 two bays, shared tables', weight: 1, when: (n, r) => pieces(n, r.defs) >= 2 && pieces(n, r.defs) <= 8, rule: b3 },
    { name: 'B4 bunks on the back wall, a rec corner', weight: 1, when: (n, r) => { const k = pieces(n, r.defs); return k >= 2 && k <= 2 * pairsAcross(r.w) && r.w >= 6 && r.h >= 5; }, rule: b4 },
    { name: 'C1 cabin', weight: 1, when: (n, r) => pieces(n, r.defs) === 1, rule: (c) => [P(sleeper(c.need, c.defs), 0, 0, 0), P('module.storage_locker', c.w - 1, 0, 0)] },
  ],
  support: [
    { name: 'M1 table grid', weight: 1, when: has(G), rule: (c) => [P(G, 0, 0, 0), P(G, 2, 0, 0), P(LS, 0, c.h - 2, 0), ...rowsOf(c.h).flatMap((y) => tables(5, c.w - 1, y + (c.h <= 5 ? 1 : 0), 1))] },
    { name: 'M2 tables in pairs', weight: 1, when: has(G), rule: (c) => [...range(0, c.h - 2, 3).map((y) => P(G, 0, y, 3)), ...rowsOf(c.h).flatMap((y) => tables(3, c.w - 1, y + (c.h <= 5 ? 1 : 0), 2))] },
    {
      name: 'M3 galley corner, tables in line', weight: 1, when: has(G),
      rule: (c) => [P(G, 0, 0, 3), P(G, 0, 2, 3), P(LS, 0, c.h - 1, 1), P(GT, 4, 1, 0), ...tables(7, c.w - 1, 1, 1), P('module.arcade', c.w - 1, c.h - 1, 2)],
    },
    { name: 'M4 tables down the long axis', weight: 2, when: has(G), rule: m4 },
    { name: 'SU suit-up, lockers on the back wall', weight: 1, when: (n, r) => !n.includes(G) && n.includes(L) && count(n, L) <= r.w, rule: su },
    { name: 'GY gym, sparring droids in a row', weight: 1, when: (n, r) => n.includes(EX) && r.h >= 4 && r.w >= 3 * count(n, EX), rule: gy },
  ],
  medbay: [
    { name: 'D1 beds along a wall', weight: 1, rule: d1 },
    { name: 'D2 bays, pod in the middle', weight: 1, when: (_, r) => r.w >= 9, rule: d2 },
    { name: 'D3 beds down the long wall', weight: 1, when: (_, r) => r.h > r.w, rule: d3 },
    { name: 'TR trauma, pod and cots along the back wall', weight: 2, when: (n, r) => n.includes(RP) && count(n, RP) === 1 && r.h >= 4 && traumaFits(n, r.w), rule: tr },
  ],
  weapons: [
    { name: 'G1 guns in a row', weight: 1, rule: g1 },
    { name: 'G2 two rows of columns', weight: 1, rule: g2 },
    { name: 'G3 guns in the corners', weight: 1, when: (n, r) => n.filter((m) => r.defs[m]?.weapon || r.defs[m]?.pointDefense).length <= 4, rule: g3 },
  ],
  shields: [{ name: 'S1 gens, batteries between', weight: 1, rule: (c) => spread(c, c.need.filter((m) => c.defs[m]?.shieldGen), false) }],
  farm: [{ name: 'F1 greenhouse: beds on end down both long walls', weight: 1, when: (_, r) => r.h > r.w && r.w >= 4, rule: f1 }],
  bridge: [{ name: "CO chief's office, desk and planters", weight: 1, when: (n, r) => !n.includes('module.helm') && r.w >= 5 && r.w <= 10 && r.h >= 4 && r.h <= 6, rule: co }],
  cargo: [{
    name: 'PA pantry, cold stores along the back wall', weight: 1,
    when: (n, r) => n.length > 0 && n.every((m) => m === RK || m === CD) && r.h >= 3 && r.h <= 4 && count(n, RK) + count(n, CD) <= shelfSlots(r.w).length,
    rule: pa,
  }],
  armoury: [
    { name: 'QM quartermaster, armoury lockers round a desk', weight: 1, when: (n, r) => !n.includes(SW) && r.w >= 7 && r.h >= 5, rule: qm },
    { name: 'BG brig, stasis wheel at the back', weight: 1, when: (n, r) => count(n, SW) === 1 && r.w >= 7 && r.h >= 6, rule: bg },
  ],
  industry: [
    { name: 'WS workshop, fabricator between the racks', weight: 1, when: (n, r) => n.includes(FB) && !n.includes(SP) && !n.includes(RS) && r.h >= 4 && r.w >= 4 + 2 * count(n, FB), rule: ws },
    { name: 'BK breaker, scrapper between the bins', weight: 1, when: (n, r) => count(n, SP) === 1 && r.w >= 8 && r.h >= 5 && (count(n, SB) === 0 || count(n, SB) === 2), rule: bk },
    { name: 'LB lab, research modules along the back wall', weight: 1, when: (n, r) => n.includes(RS) && r.h >= 4 && r.w >= 3 * count(n, RS), rule: lb },
  ],
  hangar: [{ name: 'DB drone bay, bays spread across', weight: 1, when: (n, r) => n.length > 0 && n.every((m) => m === DR) && r.h >= 4 && r.w >= 2 * n.length, rule: db }],
  hall: [{ name: 'HL hall street, planters and benches on the wall', weight: 1, when: (n, r) => n.length === 0 && r.w >= 8 && r.h >= 3 && r.h <= 4, rule: hl }],
  plaza: [
    { name: 'CU customs, a desk and chairs', weight: 1, when: (n, r) => n.length === 0 && r.w >= 7 && r.h >= 3 && r.h <= 4, rule: cu },
    { name: 'PZ parade hall, benches round the planters', weight: 1, when: (n, r) => n.length === 0 && r.w >= 9 && r.h >= 7, rule: pz },
  ],
  reactor: [{ name: 'R1 reactors, batteries between', weight: 1, rule: (c) => spread(c, c.need.filter((m) => (c.defs[m]?.power ?? 0) > 0), true) }],
};
