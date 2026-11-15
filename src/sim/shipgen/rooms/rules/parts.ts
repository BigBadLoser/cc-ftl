/**
 * Building blocks of the furnishing rules (rules.ts), ported from the signed-off mock (tools/shipgen/mocks/furnishingRules.ts).
 * Room frame: (0, 0) the top-left floor tile of a w x h room whose main door is at (d, h), under the bottom wall.
 */
import type { Piece } from './check';

export const B = 'module.bed', L = 'module.storage_locker', T = 'module.mess_table', C = 'module.chair', G = 'module.galley';
export const LS = 'module.lifeSupport', GT = 'module.gametable', BT = 'module.battery', MB = 'module.med_bed', RP = 'module.recovery';

/** Furniture the station rooms' rules place (rooms with a rule of their own: stores, works, bays, social rooms). */
export const PL = 'module.planter', BE = 'module.bench', VM = 'module.vending', VR = 'module.vending_red', AC = 'module.arcade', CN = 'module.console';
export const RK = 'module.storage_rack', CD = 'module.storage_cold', AR = 'module.storage_armory', PT = 'module.storage_pallet', SB = 'module.storage_scrap';
export const FB = 'module.fabricator', SP = 'module.scrapper', RS = 'module.research', EX = 'module.exercise', DR = 'module.droneBay', SW = 'module.stasis_wheel';

export const count = (need: readonly string[], id: string): number => need.filter((m) => m === id).length;
export const P = (def: string, x: number, y: number, rot = 0): Piece => ({ def, x, y, rot });
export const range = (from: number, to: number, step: number): number[] => {
  const out: number[] = [];
  for (let v = from; step > 0 ? v <= to : v >= to; v += step) out.push(v);
  return out;
};

/**
 * Sleeper pieces still to place in a room, and the piece (a bed today; a bunk, two sleepers in one bed's footprint, once it
 * exists): rules take from it pair by pair, so a barracks holds its planned pieces and no more.
 */
export interface Beds { left: number; def: string }

/** Two chairs above and two below a table of two along x at (x, y). */
export const seats = (x: number, y: number): Piece[] => [P(C, x, y - 1, 2), P(C, x + 1, y - 1, 2), P(C, x, y + 1, 0), P(C, x + 1, y + 1, 0)];

/** Beds in pairs along a wall from x0 toward x1, a locker between the two of a pair, a tile between pairs. Returns the pieces and the pairs made. */
export function bunks(beds: Beds, x0: number, x1: number, y: number, rot: 0 | 2): { pieces: Piece[]; pairs: number } {
  const dir = x1 >= x0 ? 1 : -1, out: Piece[] = [];
  let pairs = 0;
  for (let p = x0; dir * (x1 - (p + 2 * dir)) >= 0 && beds.left > 0; p += 4 * dir) {
    out.push(P(beds.def, p, y, rot), P(L, p + dir, rot === 0 ? y : y + 1, rot));
    if (beds.left > 1) out.push(P(beds.def, p + 2 * dir, y, rot));
    beds.left -= Math.min(2, beds.left);
    pairs++;
  }
  return { pieces: out, pairs };
}

/** Beds in pairs down a side wall (left or right) from y0 toward y1, lying across it, a locker between the two. */
export function sidePairs(beds: Beds, left: boolean, w: number, y0: number, y1: number): { pieces: Piece[]; pairs: number } {
  const out: Piece[] = [], x = left ? 0 : w - 2, lx = left ? 0 : w - 1, rot = left ? 3 : 1;
  let pairs = 0;
  for (let p = y0; p + 2 <= y1 && beds.left > 0; p += 4) {
    out.push(P(beds.def, x, p, 1), P(L, lx, p + 1, rot));
    if (beds.left > 1) out.push(P(beds.def, x, p + 2, 1));
    beds.left -= Math.min(2, beds.left);
    pairs++;
  }
  return { pieces: out, pairs };
}

/** A wall's run of bed pairs (`n` made), from one end toward the other, and a game table at a tile of it: end on to the wall, or along it a tile off. */
export interface Run { from: number; to: number; n: number; at: (v: number, end: boolean) => Piece; door?: boolean }

/**
 * Each stretch a run of pairs leaves free at its far end takes a game table: end on to the wall where the stretch (with
 * the tile clear of the last bed) is three tiles or more, so a player sits either side (beside the door when the run ends
 * there); else along the wall, a tile off.
 */
export const leftover = (runs: Run[]): Piece[] => runs.flatMap((run) => {
  const dir = run.to >= run.from ? 1 : -1, len = Math.abs(run.to - run.from) + 1, n = run.n;
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
  { w: 3, h: 2, at: (x, y) => [P(T, x + 1, y, 1), P(C, x, y, 1), P(C, x, y + 1, 1), P(C, x + 2, y, 3), P(C, x + 2, y + 1, 3)] },
  { w: 2, h: 3, at: (x, y) => [P(T, x, y + 1, 0), P(C, x, y, 2), P(C, x + 1, y, 2), P(C, x, y + 2, 0), P(C, x + 1, y + 2, 0)] },
];
const GAMES: Block[] = [{ w: 1, h: 2, at: (x, y) => [P(GT, x, y, 1)] }, { w: 2, h: 1, at: (x, y) => [P(GT, x, y, 0)] }];

/**
 * Blocks spread evenly through the free area x0..x1, y0..y1 along its long axis (`wide`: along x), centred across it,
 * a clear tile at least on every side: as many mess tables as fit with equal gaps, else one game table; when no count
 * gives equal gaps, the nearest (gaps a tile apart at most). `most`: as many tables as fit, gaps as near equal as they go.
 */
export function middle(x0: number, y0: number, x1: number, y1: number, wide: boolean, most = false): Piece[] {
  const m = wide ? x1 - x0 + 1 : y1 - y0 + 1, c = wide ? y1 - y0 + 1 : x1 - x0 + 1;
  for (const exact of most ? [false] : [true, false]) for (const set of [BLOCKS, GAMES]) {
    let best: Piece[] | null = null, most = 0;
    for (const b of set) {
      const ba = wide ? b.w : b.h, bc = wide ? b.h : b.w;
      if (c - bc < 2 || (exact && (c - bc) % 2 !== 0)) continue;
      for (let n = Math.floor((m - 1) / (ba + 1)); n > most; n--) {
        const free = m - n * ba, g = Math.floor(free / (n + 1));
        if (g < 1 || (exact && free % (n + 1) !== 0)) continue;
        const extra = free - g * (n + 1), cross = Math.floor((c - bc) / 2);
        best = range(0, n - 1, 1).flatMap((i) => {
          const a = g + i * (ba + g) + Math.min(i + 1, Math.floor(extra / 2)) * (extra > 0 ? 1 : 0);
          return wide ? b.at(x0 + a, y0 + cross) : b.at(x0 + cross, y0 + a);
        });
        most = n;
        break;
      }
      if (set === GAMES && best) break;
    }
    if (best) return best;
  }
  return [];
}

/** Tables of two with their chairs, centred along y, `per` tables to a block, blocks two tiles apart, from x0 to x1. */
export function tables(x0: number, x1: number, y: number, per: number): Piece[] {
  const block = 3 * per - 1, n = Math.floor((x1 - x0 + 1 + 2) / (block + 2));
  if (n < 1) return [];
  const start = x0 + Math.floor((x1 - x0 + 1 - (n * (block + 2) - 2)) / 2);
  return range(0, n - 1, 1).flatMap((b) => range(0, per - 1, 1).flatMap((i): Piece[] => { const x = start + b * (block + 2) + i * 3; return [P(T, x, y, 0), ...seats(x, y)]; }));
}

export const rowsOf = (h: number): number[] => range(1, h - 3, 4);
