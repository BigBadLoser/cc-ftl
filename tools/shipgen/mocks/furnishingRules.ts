/**
 * Furnishing rules mock (dev tool, not shipped): each arrangement of `furnishing.ts` written as a rule that fills a
 * room of any size (door in the middle of the bottom wall), shown at several sizes per row.
 *   node tools/shipgen/cli.js --mock tools/shipgen/mocks/furnishingRules.ts --out <dir>
 */
import type { RoomRole } from '../../../src/sim';
import { sheet, type Piece, type RoomMock, type Sheet } from './furnishing';

const B = 'module.bed', L = 'module.storage_locker', T = 'module.mess_table', C = 'module.chair', G = 'module.galley';
const LS = 'module.lifeSupport', GT = 'module.gametable', BT = 'module.battery', MB = 'module.med_bed', RP = 'module.recovery';
const MD = 'module.massDriver', BL = 'module.burstLaser', PD = 'module.pointDefense';
const SIZE: Record<string, number> = { [MD]: 3, [BL]: 2, [PD]: 2 };

/** A rule: the pieces for a w x h room whose door is at (d, h) under the bottom wall. */
type Rule = (w: number, h: number, d: number) => Piece[];
const seats = (x: number, y: number): Piece[] => [[C, x, y - 1, 0], [C, x + 1, y - 1, 0], [C, x, y + 1, 2], [C, x + 1, y + 1, 2]];
const range = (from: number, to: number, step: number): number[] => { const out: number[] = []; for (let v = from; step > 0 ? v <= to : v >= to; v += step) out.push(v); return out; };
/** Beds in pairs along a wall from x0 toward x1, a locker between the two of a pair, a tile between pairs. */
const bunks = (x0: number, x1: number, y: number, rot: 0 | 2): Piece[] => {
  const dir = x1 >= x0 ? 1 : -1, out: Piece[] = [];
  for (let p = x0; dir * (x1 - (p + 2 * dir)) >= 0; p += 4 * dir) out.push([B, p, y, rot], [L, p + dir, rot === 0 ? y : y + 1, rot], [B, p + 2 * dir, y, rot]);
  return out;
};
/** Tables of two with their chairs, centred along y, `per` tables to a block, blocks two tiles apart, from x0 to x1. */
const tables = (x0: number, x1: number, y: number, per: number): Piece[] => {
  const block = 3 * per - 1, n = Math.floor((x1 - x0 + 1 + 2) / (block + 2));
  if (n < 1) return [];
  const start = x0 + Math.floor((x1 - x0 + 1 - (n * (block + 2) - 2)) / 2);
  return range(0, n - 1, 1).flatMap((b) => range(0, per - 1, 1).flatMap((i): Piece[] => { const x = start + b * (block + 2) + i * 3; return [[T, x, y, 0], ...seats(x, y)]; }));
};
const rowsOf = (h: number): number[] => range(1, h - 3, 4);

const RULES: Record<string, { role: RoomRole; rule: Rule }> = {
  'B1 bunk pairs on both walls': { role: 'quarters', rule: (w, h, d) => [...bunks(0, w - 1, 0, 0), ...bunks(0, d - 2, h - 2, 2), ...bunks(w - 1, d + 2, h - 2, 2)] },
  'B2 alcoves, game table': {
    role: 'quarters',
    rule: (w, h) => [...range(0, h - 3, 4).flatMap((y): Piece[] => [[B, 0, y, 1], [L, 0, y + 1, 3], [B, 0, y + 2, 1], [B, w - 2, y, 1], [L, w - 1, y + 1, 1], [B, w - 2, y + 2, 1]]), ...((n) => range(0, n - 1, 1).map((i): Piece => [GT, Math.floor((w - (4 * n - 2)) / 2) + 4 * i, Math.floor((h - 1) / 2), 0]))(Math.max(1, Math.floor((w - 4) / 5))), [L, Math.floor(w / 2), 0, 0]],
  },
  'B3 two bays, shared tables': {
    role: 'quarters',
    rule: (w, h) => [...bunks(0, 2, 0, 0), ...bunks(0, 2, h - 2, 2), ...bunks(w - 1, w - 3, 0, 0), ...bunks(w - 1, w - 3, h - 2, 2), ...tables(4, w - 5, Math.floor(h / 2) - 1, 1)],
  },
  'C1 cabin': { role: 'quarters', rule: (w) => [[B, 0, 0, 0], [L, w - 1, 0, 0]] },
  'M1 table grid': { role: 'support', rule: (w, h) => [[G, 0, 0, 0], [G, 2, 0, 0], [LS, 0, h - 2, 0], ...rowsOf(h).flatMap((y) => tables(5, w - 1, y + (h <= 5 ? 1 : 0), 1))] },
  'M2 tables in pairs': { role: 'support', rule: (w, h) => [...range(0, h - 2, 3).map((y): Piece => [G, 0, y, 3]), ...rowsOf(h).flatMap((y) => tables(3, w - 1, y + (h <= 5 ? 1 : 0), 2))] },
  'M3 galley corner, tables in line': {
    role: 'support',
    rule: (w, h) => [[G, 0, 0, 3], [G, 0, 2, 3], [LS, 0, h - 1, 1], [GT, 4, 1, 0], ...tables(7, w - 1, 1, 1), ['module.arcade', w - 1, h - 1, 2]],
  },
  'D1 beds along a wall': { role: 'medbay', rule: (w, h) => [...range(0, w - 4, 2).map((x): Piece => [MB, x, 0, 0]), [RP, w - 2, h - 2, 2]] },
  'D2 bays, pod in the middle': { role: 'medbay', rule: (w, h) => [...range(0, h - 2, 2).flatMap((y): Piece[] => [[MB, 0, y, 1], [MB, w - 2, y, 1]]), [RP, Math.floor(w / 2) - 1, 0, 0]] },
};

/** Units (gens, reactors) of width s spread across the room, two batteries in the middle of each gap between two. */
const spread = (def: string, k: number, s: number, along = false): Rule => (w) => {
  const gap = k > 1 ? Math.floor((w - k * s) / (k - 1)) : 0;
  return range(0, k - 1, 1).flatMap((i): Piece[] => {
    const x = i * (s + gap), mid = x + s + Math.floor((gap - 1) / 2);
    const bats: Piece[] = along ? range(0, 2, 1).map((j): Piece => [BT, x + s + Math.floor((gap - 3) / 2) + j, 0]) : [[BT, mid, 0], [BT, mid, 1]];
    return [[def, x, 0], ...(i < k - 1 ? bats : [])];
  });
};
/** G1: guns in a row across the middle, a tile apart; batteries in two corners. */
const g1 = (guns: string[]): Rule => (w, h) => {
  let x = Math.max(1, Math.floor((w - guns.reduce((n, g) => n + (SIZE[g] as number) + 1, -1)) / 2));
  const out = guns.map((g): Piece => { const s = SIZE[g] as number, p: Piece = [g, x, Math.floor((h - s) / 2)]; x += s + 1; return p; });
  return [...out, [BT, w - 1, 0], [BT, w - 1, 1], [BT, 0, h - 1], [BT, 1, h - 1]];
};
/** G2: two rows of columns; the bottom row under the outer columns first, batteries under any column left empty. */
const g2 = (guns: string[]): Rule => (w) => {
  const cols = Math.ceil(guns.length / 2), top = guns.slice(0, cols), bottom = guns.slice(cols);
  const gap = Math.floor((w - 3 * cols) / (cols + 1));
  const colX = (c: number): number => gap + c * (3 + gap);
  const order = range(0, cols - 1, 1).sort((p, q) => Math.abs(q - (cols - 1) / 2) - Math.abs(p - (cols - 1) / 2) || p - q);
  const place = (g: string, c: number, y: number): Piece => { const s = SIZE[g] as number, x = colX(c); return [g, c < (cols - 1) / 2 ? x : c > (cols - 1) / 2 ? x + 3 - s : x + Math.floor((3 - s) / 2), y]; };
  const under = new Map(bottom.map((g, i) => [order[i] as number, g]));
  return [
    ...top.map((g, c) => place(g, c, 1)),
    ...range(0, cols - 1, 1).flatMap((c): Piece[] => { const g = under.get(c); return g ? [place(g, c, 5)] : [[BT, colX(c) + 1, 5], [BT, colX(c) + 1, 6]]; }),
  ];
};
/** G3: guns in the corners, a column of batteries down the middle. */
const g3 = (guns: string[]): Rule => (w, h) => {
  const corner = (g: string, i: number): Piece => { const s = SIZE[g] as number; return [g, i % 2 === 0 ? 1 : w - 1 - s, i < 2 ? 1 : h - 1 - s]; };
  const m = Math.floor(w / 2);
  return [...guns.slice(0, 4).map(corner), [BT, m, 0], ...range(2, h - 3, 1).map((y): Piece => [BT, m, y])];
};

const room = (caption: string, role: RoomRole, rule: Rule, w: number, h: number): RoomMock => {
  const door = Math.floor(w / 2);
  return { caption: `${caption.split(' ')[0]} ${w}x${h}`, role, w, h, door, pieces: rule(w, h, door) };
};
const at = (name: string, sizes: [number, number][]): RoomMock[] => { const r = RULES[name] as { role: RoomRole; rule: Rule }; return sizes.map(([w, h]) => room(name, r.role, r.rule, w, h)); };

const GUNS5 = [MD, BL, MD, BL, PD];
export const RULE_ROWS: RoomMock[][] = [
  at('B1 bunk pairs on both walls', [[8, 6], [11, 6], [15, 6], [11, 8]]),
  at('B2 alcoves, game table', [[8, 6], [11, 6], [15, 6], [11, 8]]),
  at('B3 two bays, shared tables', [[9, 6], [11, 6], [15, 6], [11, 8]]),
  [...at('C1 cabin', [[3, 6], [4, 5], [5, 4], [3, 4]]), ...at('D1 beds along a wall', [[7, 4], [9, 4], [13, 5]])],
  at('M1 table grid', [[11, 5], [14, 5], [18, 6], [14, 9]]),
  at('M2 tables in pairs', [[11, 5], [14, 5], [18, 6], [14, 9]]),
  [...at('M3 galley corner, tables in line', [[11, 5], [14, 5], [18, 6]]), ...at('D2 bays, pod in the middle', [[9, 4], [11, 4], [11, 6]])],
  [room('G1', 'weapons', g1([MD, BL, PD]), 12, 7), room('G1', 'weapons', g1(GUNS5), 18, 7), room('G1', 'weapons', g1([MD, MD, BL, BL, PD, PD]), 22, 8)],
  [room('G2', 'weapons', g2([MD, BL, PD]), 10, 8), room('G2', 'weapons', g2(GUNS5), 15, 8), room('G2', 'weapons', g2([MD, BL, MD, BL, PD, PD]), 15, 8), room('G2', 'weapons', g2([MD, MD, BL, BL, PD, PD, BL]), 19, 8)],
  [room('G3', 'weapons', g3([MD, MD, BL, PD]), 13, 8), room('G3', 'weapons', g3([MD, MD, BL, PD]), 15, 10), room('G3', 'weapons', g3([BL, PD, BL, PD]), 9, 7)],
  [room('S1', 'shields', spread('module.shieldGen', 2, 2), 9, 5), room('S1', 'shields', spread('module.shieldGen', 3, 2), 12, 5), room('S1', 'shields', spread('module.shieldGen', 4, 2), 17, 5)],
  [room('R1', 'reactor', spread('module.reactor.mk3', 2, 2, true), 9, 6), room('R1', 'reactor', spread('module.reactor.mk3', 3, 2, true), 12, 6), room('R1', 'reactor', spread('module.reactor.mk3', 4, 2, true), 17, 6)],
];

export function mock(): Sheet { return sheet(RULE_ROWS, 'Furnishing rules'); }
