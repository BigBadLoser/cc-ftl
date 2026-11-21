import type { ModuleDef } from '../../../registry';
import type { Piece } from './check';
import { BT, CN, L, LS, MB, P, RK, count, range } from './parts';
import { AI } from './plant';
import type { Ctx } from './rules';

/**
 * PROTOTYPE (#581): rooms furnished to their size. A bay hull's rooms run two to four times their plan's floor: these
 * arrangements stand the planned modules where they belong and line the rest of the walls with the room's own extras
 * (working ones where the room's job takes more: med beds, batteries; else lockers, racks, tanks, consoles). Each
 * extra goes in only where the room still works (place.ts), so a tight frame keeps what fits.
 */

/** Floor a room has past which these arrangements are tried (tiles). */
const BIG = 30;
const TANK = 'module.storage_tank', SG = (m: string, d: Record<string, ModuleDef>): boolean => !!d[m]?.shieldGen;

/** Pieces a tile apart down one side wall from row y0 to y1 (side 0 the left, facing in: rot 3; 1 the right: rot 1). */
function sideRun(c: Ctx, side: 0 | 1, ids: readonly string[], y0: number, y1: number): Piece[] {
  const out: Piece[] = [];
  let y = y0, i = 0;
  while (ids.length > 0) {
    const id = ids[i % ids.length] as string, [fw, fh] = c.defs[id]?.footprint ?? [1, 1];
    // (Turned a quarter: its width runs down the wall, its depth out from it.)
    if (y + fw - 1 > y1) break;
    out.push(P(id, side === 0 ? 0 : c.w - fh, y, side === 0 ? 3 : 1));
    y += fw + 1; i++;
  }
  return out;
}

/** The side walls' runs, below what stands `top` rows deep on the back wall, clear of the door's row. */
const sides = (c: Ctx, top: number, left: readonly string[], right: readonly string[]): Piece[] =>
  [...sideRun(c, 0, left, top + 1, c.h - 2), ...sideRun(c, 1, right, top + 1, c.h - 2)];

/** Units `ids` across the back wall, centred, a tile between each. */
function backRow(c: Ctx, ids: readonly string[]): Piece[] {
  const ws = ids.map((m) => c.defs[m]?.footprint[0] ?? 1), span = ws.reduce((a, b) => a + b, 0) + ids.length - 1;
  let x = Math.floor((c.w - span) / 2);
  return ids.map((m, i) => { const p = P(m, x, 0, 0); x += (ws[i] as number) + 1; return p; });
}

/**
 * Rows of `id` in the middle of the floor from row `y0`: each row facing the door (an aisle after it), two tiles in from
 * the side walls, a tile between (a piece that would block the way in is left out: place.ts).
 */
function island(c: Ctx, id: string, y0: number): Piece[] {
  const [fw, fh] = c.defs[id]?.footprint ?? [1, 1], out: Piece[] = [];
  for (let y = y0; y + fh - 1 <= c.h - 3; y += fh + 1) {
    for (let x = 2; x + fw - 1 <= c.w - 3; x += fw + 1) out.push(P(id, x, y, 0));
  }
  return out;
}

const big = (r: { w: number; h: number }): boolean => r.w * r.h >= BIG;
const depthOf = (c: Ctx, ids: readonly string[]): number => Math.max(0, ...ids.map((m) => c.defs[m]?.footprint[1] ?? 1));

/** D4 ward: med beds a tile apart along the back wall (as many as it holds), lockers and a console down the side walls. */
export const wardFits = (n: readonly string[], r: { w: number; h: number }): boolean =>
  big(r) && r.h >= 5 && n.length > 0 && n.every((m) => m === MB) && count(n, MB) <= Math.ceil(r.w / 2);
export function ward(c: Ctx): Piece[] {
  const beds = range(0, c.w - 1, 2).map((x) => P(MB, x, 0, 0));
  return [...beds, ...sides(c, 2, [CN, L], [L]), ...island(c, MB, 3)];
}

/** S2 shield room: the generators across the back wall, battery banks down the side walls, a console. */
export const shieldsFit = (n: readonly string[], r: { w: number; h: number; defs: Record<string, ModuleDef> }): boolean =>
  big(r) && n.length > 0 && n.every((m) => SG(m, r.defs)) && n.reduce((t, m) => t + (r.defs[m]?.footprint[0] ?? 2) + 1, -1) <= r.w;
export function shieldRoom(c: Ctx): Piece[] {
  const top = depthOf(c, c.need);
  return [...backRow(c, c.need), ...sides(c, top, [BT, BT, CN], [BT, BT]), ...island(c, BT, top + 1)];
}

/** C2 core vault: the AI core in the middle of the back wall between consoles, racks down the side walls. */
export const vaultFits = (n: readonly string[], r: { w: number; h: number }): boolean => big(r) && r.w >= 6 && n.length > 0 && n.every((m) => m === AI);
export function vault(c: Ctx): Piece[] {
  return [...backRow(c, [CN, ...c.need, CN]), ...sides(c, 2, [RK], [RK]), ...island(c, RK, 3)];
}

/** L2 life support: the units across the back wall, tanks down the side walls, a console. */
export const lifeFits = (n: readonly string[], r: { w: number; h: number }): boolean =>
  big(r) && n.length > 0 && n.every((m) => m === LS || m === 'module.fabricator') && count(n, LS) * 2 + 1 <= r.w;
export function life(c: Ctx): Piece[] {
  return [...backRow(c, c.need), ...sides(c, 2, [TANK, CN], [TANK]), ...island(c, TANK, 3)];
}
