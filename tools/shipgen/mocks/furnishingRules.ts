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
const seats = (x: number, y: number): Piece[] => [[C, x, y - 1, 2], [C, x + 1, y - 1, 2], [C, x, y + 1, 0], [C, x + 1, y + 1, 0]];
const range = (from: number, to: number, step: number): number[] => { const out: number[] = []; for (let v = from; step > 0 ? v <= to : v >= to; v += step) out.push(v); return out; };
/** Beds in pairs along a wall from x0 toward x1, a locker between the two of a pair, a tile between pairs. */
const bunks = (x0: number, x1: number, y: number, rot: 0 | 2): Piece[] => {
  const dir = x1 >= x0 ? 1 : -1, out: Piece[] = [];
  for (let p = x0; dir * (x1 - (p + 2 * dir)) >= 0; p += 4 * dir) out.push([B, p, y, rot], [L, p + dir, rot === 0 ? y : y + 1, rot], [B, p + 2 * dir, y, rot]);
  return out;
};
/** Beds in pairs down a side wall (left or right) from y0 toward y1, lying across it, a locker between the two. */
const sidePairs = (left: boolean, w: number, y0: number, y1: number): Piece[] => {
  const out: Piece[] = [], x = left ? 0 : w - 2, lx = left ? 0 : w - 1, rot = left ? 3 : 1;
  for (let p = y0; p + 2 <= y1; p += 4) out.push([B, x, p, 1], [L, lx, p + 1, rot], [B, x, p + 2, 1]);
  return out;
};
/** A wall's run of bed pairs, from one end toward the other, and a game table at a given tile of it: end on to the wall, or along it a tile off. */
interface Run { from: number; to: number; at: (v: number, end: boolean) => Piece; door?: boolean }
/**
 * Each stretch a run of pairs leaves free at its far end takes a game table: end on to the wall where the stretch (with
 * the tile clear of the last bed) is three tiles or more, so a player sits either side (beside the door when the run ends
 * there, the user's pick); else along the wall, a tile off.
 */
const leftover = (runs: Run[]): Piece[] => runs.flatMap((run) => {
  const dir = run.to >= run.from ? 1 : -1, len = Math.abs(run.to - run.from) + 1, n = Math.floor((len + 1) / 4);
  const lo = n > 0 ? 4 * n : 0, free = len - lo, tile = (o: number): number => run.from + dir * o;
  const r0 = n > 0 ? lo - 1 : 0, span = len - r0;
  if (span >= 3) return [run.at(tile(run.door ? len - 1 : r0 + Math.floor((span - 1) / 2)), true)];
  if (free < 2) return [];
  const start = lo + Math.floor((free - 2) / 2);
  return [run.at(run.from + dir * (dir > 0 ? start : start + 1), false)];
});
/** A block of furniture: its size and its pieces from its top-left corner. */
interface Block { w: number; h: number; at: (x: number, y: number) => Piece[] }
const BLOCKS: Block[] = [
  { w: 3, h: 2, at: (x, y) => [[T, x + 1, y, 1], [C, x, y, 1], [C, x, y + 1, 1], [C, x + 2, y, 3], [C, x + 2, y + 1, 3]] },
  { w: 2, h: 3, at: (x, y) => [[T, x, y + 1, 0], [C, x, y, 2], [C, x + 1, y, 2], [C, x, y + 2, 0], [C, x + 1, y + 2, 0]] },
];
const GAMES: Block[] = [{ w: 1, h: 2, at: (x, y) => [[GT, x, y, 1]] }, { w: 2, h: 1, at: (x, y) => [[GT, x, y, 0]] }];
/**
 * Blocks spread evenly through the free area x0..x1, y0..y1 along its long axis (`wide`: along x), centred across it,
 * a clear tile at least on every side: as many mess tables as fit with equal gaps, else one game table; when no count
 * gives equal gaps, the nearest (gaps a tile apart at most).
 */
const middle = (x0: number, y0: number, x1: number, y1: number, wide: boolean): Piece[] => {
  const m = wide ? x1 - x0 + 1 : y1 - y0 + 1, c = wide ? y1 - y0 + 1 : x1 - x0 + 1;
  for (const exact of [true, false]) for (const set of [BLOCKS, GAMES]) {
    let best: Piece[] | null = null, most = 0;
    for (const b of set) {
      const ba = wide ? b.w : b.h, bc = wide ? b.h : b.w;
      if (c - bc < 2 || (exact && (c - bc) % 2 !== 0)) continue;
      for (let n = Math.floor((m - 1) / (ba + 1)); n > most; n--) {
        const free = m - n * ba, g = Math.floor(free / (n + 1));
        if (g < 1 || (exact && free % (n + 1) !== 0)) continue;
        const extra = free - g * (n + 1), cross = Math.floor((c - bc) / 2);
        best = range(0, n - 1, 1).flatMap((i) => { const a = g + i * (ba + g) + Math.min(i + 1, Math.floor(extra / 2)) * (extra > 0 ? 1 : 0); return wide ? b.at(x0 + a, y0 + cross) : b.at(x0 + cross, y0 + a); });
        most = n;
        break;
      }
      if (set === GAMES && best) break;
    }
    if (best) return best;
  }
  return [];
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
  // Bed rows on the long walls: across the top and bottom when the room is wide, down the sides when it is tall.
  'B1 bunk pairs on the long walls': {
    role: 'quarters',
    // Where a wall's run of pairs leaves a stretch too short for another pair, a game table stands in it, a tile off the wall.
    rule: (w, h, d) => {
      const runs: Run[] = w >= h
        ? [
          { from: 0, to: w - 1, at: (v, end) => (end ? [GT, v, 0, 1] : [GT, v, 1, 0]) },
          { from: 0, to: d - 2, door: true, at: (v, end) => (end ? [GT, v, h - 2, 1] : [GT, v, h - 2, 2]) },
          { from: w - 1, to: d + 2, door: true, at: (v, end) => (end ? [GT, v, h - 2, 1] : [GT, v, h - 2, 2]) },
        ]
        : [
          { from: 0, to: h - 1, at: (v, end) => (end ? [GT, 0, v, 0] : [GT, 1, v, 3]) },
          { from: 0, to: h - 1, at: (v, end) => (end ? [GT, w - 2, v, 0] : [GT, w - 2, v, 1]) },
        ];
      const beds = w >= h
        ? [...bunks(0, w - 1, 0, 0), ...bunks(0, d - 2, h - 2, 2), ...bunks(w - 1, d + 2, h - 2, 2)]
        : [...sidePairs(true, w, 0, h - 1), ...sidePairs(false, w, 0, h - 1)];
      return [...beds, ...leftover(runs)];
    },
  },
  // A pair in each corner of the long walls, tables between.
  'B3 two bays, shared tables': {
    role: 'quarters',
    // Between the bays: mess tables with chairs where they have a clear tile round them, else a game table, spaced evenly.
    rule: (w, h) => (w >= h
      ? [...bunks(0, 2, 0, 0), ...bunks(0, 2, h - 2, 2), ...bunks(w - 1, w - 3, 0, 0), ...bunks(w - 1, w - 3, h - 2, 2), ...middle(3, 0, w - 4, h - 1, true)]
      : [...sidePairs(true, w, 0, 2), ...sidePairs(false, w, 0, 2), ...sidePairs(true, w, h - 3, h - 1), ...sidePairs(false, w, h - 3, h - 1), ...middle(0, 3, w - 1, h - 4, false)]),
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
/** Guns in a row across the room at y, a tile apart, centred. */
const gunRow = (guns: string[], w: number, y: (s: number) => number): Piece[] => {
  let x = Math.floor((w - guns.reduce((n, g) => n + (SIZE[g] as number) + 1, -1)) / 2);
  return guns.map((g): Piece => { const s = SIZE[g] as number, p: Piece = [g, x, y(s)]; x += s + 1; return p; });
};
/** G1: guns in a row across the middle, a tile apart. No batteries in gun rooms (the user: power storage is the battery room's). */
const g1 = (guns: string[]): Rule => (w, h) => gunRow(guns, w, (s) => Math.floor((h - s) / 2));
/** G2: two rows of columns; the bottom row's guns centred under them. */
const g2 = (guns: string[]): Rule => (w) => {
  const cols = Math.ceil(guns.length / 2), top = guns.slice(0, cols), bottom = guns.slice(cols);
  const gap = Math.floor((w - 3 * cols) / (cols + 1));
  const colX = (c: number): number => gap + c * (3 + gap);
  const place = (g: string, c: number, y: number): Piece => { const s = SIZE[g] as number, x = colX(c); return [g, c < (cols - 1) / 2 ? x : c > (cols - 1) / 2 ? x + 3 - s : x + Math.floor((3 - s) / 2), y]; };
  return [...top.map((g, c) => place(g, c, 1)), ...gunRow(bottom, w, () => 5)];
};
/** G3: guns in the corners. */
const g3 = (guns: string[]): Rule => (w, h) => guns.slice(0, 4).map((g, i): Piece => { const s = SIZE[g] as number; return [g, i % 2 === 0 ? 1 : w - 1 - s, i < 2 ? 1 : h - 1 - s]; });

const room = (caption: string, role: RoomRole, rule: Rule, w: number, h: number): RoomMock => {
  const door = Math.floor(w / 2);
  return { caption: `${caption.split(' ')[0]} ${w}x${h}`, role, w, h, door, pieces: rule(w, h, door) };
};
const at = (name: string, sizes: [number, number][]): RoomMock[] => { const r = RULES[name] as { role: RoomRole; rule: Rule }; return sizes.map(([w, h]) => room(name, r.role, r.rule, w, h)); };

const GUNS5 = [MD, BL, MD, BL, PD];
export const RULE_ROWS: RoomMock[][] = [
  at('B1 bunk pairs on the long walls', [[8, 6], [11, 6], [15, 6], [5, 9], [6, 12]]),
  at('B3 two bays, shared tables', [[9, 6], [11, 6], [15, 6], [7, 10], [8, 15]]),
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
