/**
 * Power and gun rooms' arrangements (rules.ts): reactors and shield generators spread with batteries between (`spread`,
 * R2), guns in rows, columns and corners (G1 to G3).
 */
import type { ModuleDef } from '../../../registry';
import type { Piece } from './check';
import { BT, P, off, range } from './parts';
import type { Ctx } from './rules';

export const size = (c: Ctx, id: string): number => c.defs[id]?.footprint[0] ?? 2;
const isGun = (c: Ctx, id: string): boolean => !!(c.defs[id]?.weapon || c.defs[id]?.pointDefense);
export const guns = (c: Ctx): string[] => c.need.filter((m) => isGun(c, m));

/** Units (gens, reactors) spread across the back wall, batteries in each gap side by side against it: two, or three (`along`). */
export function spread(c: Ctx, units: string[], along: boolean): Piece[] {
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
export const across = (c: { w: number; defs: Record<string, ModuleDef> }, units: readonly string[]): boolean => units.reduce((n, u) => n + (c.defs[u]?.footprint[0] ?? 2) + 1, -1) <= c.w;
export const powerUnits = (need: readonly string[], defs: Record<string, ModuleDef>): string[] => need.filter((m) => (defs[m]?.power ?? 0) > 0);

/**
 * R2: a long reactor room (more reactors than stand across its back wall): the reactors down both long walls, spread
 * from end to end, two batteries against the wall in each gap; the aisle down the middle to the door.
 */
export function r2(c: Ctx): Piece[] {
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
export function g1(c: Ctx): Piece[] {
  const list = guns(c);
  if (list.reduce((n, g) => n + size(c, g) + 1, -1) <= c.w) return row(c, list, (s) => Math.max(0, Math.min(Math.floor((c.h - s) / 2), c.h - 1 - s)));
  let y = 0;
  return list.map((g) => { const s = size(c, g), p = P(g, c.w - s >= 1 ? (c.d < c.w / 2 ? c.w - s : 0) : Math.floor((c.w - s) / 2), y); y += s + 1; return p; });
}

/** G2: two rows of three-wide columns, the top row's guns in the columns, the bottom row's centred under them. */
export function g2(c: Ctx): Piece[] {
  const list = guns(c), cols = Math.ceil(list.length / 2), top = list.slice(0, cols), bottom = list.slice(cols);
  const gap = Math.floor((c.w - 3 * cols) / (cols + 1)), colX = (k: number): number => gap + k * (3 + gap), mid = (cols - 1) / 2;
  const place = (g: string, k: number, y: number): Piece => { const s = size(c, g), x = colX(k); return P(g, k < mid ? x : k > mid ? x + 3 - s : x + Math.floor((3 - s) / 2), y); };
  return [...top.map((g, k) => place(g, k, 1)), ...row(c, bottom, () => 5)];
}

/** G3: guns in the corners. */
export function g3(c: Ctx): Piece[] {
  return guns(c).map((g, i): Piece => { const s = size(c, g); return P(g, i % 2 === 0 ? 1 : c.w - 1 - s, i < 2 ? 1 : c.h - 1 - s); });
}
