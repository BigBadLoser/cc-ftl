/**
 * Medbay arrangement options for a carrier's medbay (dev tool, not shipped; #581): each option at the two common sizes,
 * door in the middle of the bottom wall.
 *   node tools/shipgen/cli.js --mock tools/shipgen/mocks/medbayMock.ts --out <dir>
 */
import { sheet, type Piece, type RoomMock, type Sheet } from './furnishing';

const MB = 'module.med_bed', L = 'module.storage_locker', CN = 'module.console', T = 'module.mess_table', C = 'module.chair', PL = 'module.planter';

type Rule = (w: number, h: number, d: number) => Piece[];
const range = (from: number, to: number, step: number): number[] => { const out: number[] = []; for (let v = from; v <= to; v += step) out.push(v); return out; };

/** A: a ward. Beds head to the side walls down both long walls, a locker between each pair, the aisle down the middle; a console by the door. */
const a: Rule = (w, h) => {
  const out: Piece[] = [];
  for (const [x, rot] of [[0, 3], [w - 2, 1]] as const) {
    let y = 0, n = 0;
    while (y <= h - 3) { out.push([MB, x, y, 1]); y += 1; n++; if (n % 2 === 1 && y <= h - 3) { out.push([L, rot === 3 ? 0 : w - 1, y, rot]); y += 1; } else y += 1; }
  }
  out.push([CN, 0, h - 1, 0]);
  return out;
};

/** B: beds along the back wall a locker between each, a treatment desk (table, chairs) in the middle, lockers on the side walls. */
const b: Rule = (w, h) => {
  const out: Piece[] = [];
  // (Pairs: a bed, a locker, a bed, a tile between pairs.)
  for (let x = 0; x + 2 <= w - 1; x += 4) out.push([MB, x, 0, 0], [L, x + 1, 0, 0], [MB, x + 2, 0, 0]);
  const tx = Math.floor(w / 2) - 1, ty = Math.min(4, h - 3);
  out.push([T, tx, ty, 0], [C, tx, ty - 1, 2], [C, tx + 1, ty + 1, 0]);
  for (const y of range(3, h - 2, 2)) out.push([L, 0, y, 3], [L, w - 1, y, 1]);
  return out;
};

/** C: triage forward, ward aft. A desk and lockers by the door; beds in pairs on the back wall, a planter at each end. */
const c: Rule = (w, h, d) => {
  const out: Piece[] = [[PL, 0, 0, 0], [PL, w - 1, 0, 0]];
  range(1, w - 2, 3).forEach((x) => { out.push([MB, x, 0, 0]); if (x + 1 <= w - 2) out.push([MB, x + 1, 0, 0]); });
  out.push([T, d + 2 <= w - 2 ? d + 2 : 0, h - 3, 0], [C, d + 2 <= w - 2 ? d + 2 : 0, h - 2, 0], [CN, 0, h - 1, 0], [L, w - 1, h - 1, 0], [L, w - 1, h - 2, 1]);
  return out;
};

/** D: two rows of beds facing each other across a wide aisle (back wall, and a row back to back in the middle), consoles at the ends. */
const dd: Rule = (w, h) => {
  const out: Piece[] = [];
  range(0, w - 1, 2).forEach((x) => out.push([MB, x, 0, 0]));
  const my = Math.min(h - 4, 4);
  range(1, w - 2, 2).forEach((x) => out.push([MB, x, my, 2]));
  out.push([CN, 0, my, 0], [CN, w - 1, my + 1, 0]);
  return out;
};

const room = (caption: string, rule: Rule, w: number, h: number): RoomMock => {
  const door = Math.floor(w / 2);
  return { caption: `${caption} ${w}x${h}`, role: 'medbay', w, h, door, pieces: rule(w, h, door) };
};
const SIZES: [number, number][] = [[8, 7], [7, 10]];
const row = (name: string, rule: Rule): RoomMock[] => SIZES.map(([w, h]) => room(name, rule, w, h));

export const ROWS: RoomMock[][] = [
  [...row('A ward', a), ...row('B desk', b)],
  [...row('C triage', c), ...row('D rows', dd)],
];

export function mock(): Sheet { return sheet(ROWS, 'Medbay options'); }
